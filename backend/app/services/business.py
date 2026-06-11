from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    DepartmentTask,
    NotificationRecord,
    ParentTask,
    RiskItem,
    StrategicGoal,
    SubTask,
    TaskEvent,
    User,
    WeeklyUpdate,
    WeeklyUpdateRevision,
)
from app.services.auth import create_lark_login_url
from app.services.lark_client import lark_client

RISK_ORDER = {"none": 0, "low": 1, "medium": 2, "high": 3}
ACTIVE_RISK_STATUSES = {"open", "in_progress"}


def risk_level_from_score(score: int) -> str:
    if score >= 15:
        return "high"
    if score >= 8:
        return "medium"
    return "low"


def risk_score(impact_score: int, likelihood_score: int) -> tuple[int, str]:
    score = impact_score * likelihood_score
    return score, risk_level_from_score(score)


def current_week_key(today: date | None = None) -> str:
    today = today or date.today()
    year, week, _ = today.isocalendar()
    return f"{year}-W{week:02d}"


def generate_code(db: Session, model: type, prefix: str) -> str:
    count = db.scalar(select(func.count()).select_from(model)) or 0
    return f"{prefix}-2026-{count + 1:03d}"


def add_event(
    db: Session,
    object_type: str,
    object_id: int,
    event_type: str,
    title: str,
    actor_id: int | None,
    content: str | None = None,
) -> None:
    db.add(
        TaskEvent(
            object_type=object_type,
            object_id=object_id,
            event_type=event_type,
            title=title,
            content=content,
            actor_id=actor_id,
        )
    )


def serialize_user(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "open_id": user.open_id,
        "is_admin": user.is_admin,
        "department": user.department.name if user.department else None,
        "department_id": user.department_id,
        "title": user.title,
        "roles": [{"id": role.id, "code": role.code, "name": role.name} for role in user.roles],
    }


def serialize_person_brief(user: User) -> dict:
    return {"id": user.id, "name": user.name}


def task_people(people: list[User] | None, fallback: User | None) -> list[User]:
    selected = list(people or [])
    if not selected and fallback:
        selected = [fallback]
    if fallback:
        return [fallback, *sorted([user for user in selected if user.id != fallback.id], key=lambda item: item.id)]
    return sorted(selected, key=lambda item: item.id)


def owner_people(task: ParentTask | DepartmentTask | SubTask) -> list[User]:
    return task_people(getattr(task, "owners", None), getattr(task, "owner", None))


def executor_people(task: SubTask) -> list[User]:
    return task_people(task.executors, task.executor)


def people_payload(people: list[User]) -> tuple[list[int], list[dict], str | None]:
    ids = [user.id for user in people]
    items = [serialize_person_brief(user) for user in people]
    return ids, items, "、".join(user.name for user in people) if people else None


def highest_risk(levels: list[str | None]) -> str:
    chosen = "none"
    for level in levels:
        if level and RISK_ORDER.get(level, 0) > RISK_ORDER.get(chosen, 0):
            chosen = level
    return chosen


def recalculate_sub_task_from_week(db: Session, sub_task: SubTask, week_key: str) -> None:
    assignees = executor_people(sub_task)
    updates = list(
        db.scalars(
            select(WeeklyUpdate).where(
                WeeklyUpdate.sub_task_id == sub_task.id,
                WeeklyUpdate.week_key == week_key,
                WeeklyUpdate.status == "submitted",
            )
        ).all()
    )
    if not updates:
        return
    progress_by_assignee = {update.assignee_id: update.progress or 0 for update in updates}
    expected_count = max(len(assignees), 1)
    sub_task.progress = round(sum(progress_by_assignee.values()) / expected_count)
    risk_level = highest_risk([update.risk_level for update in updates])
    sub_task.risk_level = risk_level
    if len(progress_by_assignee) >= expected_count and all(value >= 100 for value in progress_by_assignee.values()):
        sub_task.status = "completed"
    elif risk_level in {"high", "medium", "low"}:
        sub_task.status = "risk"
    elif sub_task.status == "pending_update":
        sub_task.status = "in_progress"


def serialize_goal(goal: StrategicGoal) -> dict:
    return {
        "id": goal.id,
        "code": goal.code,
        "name": goal.name,
        "description": goal.description,
        "year": goal.year,
        "progress": goal.progress,
        "status": goal.status,
    }


def serialize_parent_task(task: ParentTask) -> dict:
    department_tasks = task.department_tasks or []
    sub_tasks = [sub_task for department_task in department_tasks for sub_task in department_task.sub_tasks]
    owner_ids, owners, owner_text = people_payload(owner_people(task))
    return {
        "id": task.id,
        "code": task.code,
        "title": task.title,
        "description": task.description,
        "goal_id": task.goal_id,
        "goal": task.goal.name if task.goal else None,
        "department_id": task.department_id,
        "department": task.department.name if task.department else None,
        "owner_id": task.owner_id,
        "owner_ids": owner_ids,
        "owners": owners,
        "owner": owner_text,
        "priority": task.priority,
        "status": task.status,
        "progress": task.progress,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "department_task_count": len(department_tasks),
        "sub_task_count": len(sub_tasks),
        "pending_split_count": sum(department_task.pending_split_count or 0 for department_task in department_tasks),
    }


def serialize_department_task(task: DepartmentTask) -> dict:
    departments = task.departments or ([task.department] if task.department else [])
    owner_ids, owners, owner_text = people_payload(owner_people(task))
    return {
        "id": task.id,
        "code": task.code,
        "title": task.title,
        "parent_task_id": task.parent_task_id,
        "parent_task": task.parent_task.title if task.parent_task else None,
        "department_id": task.department_id,
        "department": task.department.name if task.department else None,
        "department_ids": [department.id for department in departments],
        "departments": [{"id": department.id, "name": department.name} for department in departments],
        "owner_id": task.owner_id,
        "owner_ids": owner_ids,
        "owners": owners,
        "owner": owner_text,
        "status": task.status,
        "progress": task.progress,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "sub_task_count": len(task.sub_tasks),
        "pending_split_count": task.pending_split_count or 0,
        "pending_split_codes": task.pending_split_codes or [],
    }


def sub_task_weekly_status(task: SubTask, update: WeeklyUpdate | None) -> str:
    if task.status == "completed":
        return "completed"
    if task.status == "pending_update":
        return "not_started"
    if update:
        return "updated"
    return "missing_update"


def serialize_sub_task(task: SubTask, current_update: WeeklyUpdate | None = None) -> dict:
    executor_ids, executors, executor_text = people_payload(executor_people(task))
    owner_ids, owners, owner_text = people_payload(owner_people(task))
    return {
        "id": task.id,
        "code": task.code,
        "title": task.title,
        "department_task_id": task.department_task_id,
        "department_task": task.department_task.title if task.department_task else None,
        "parent_task": task.department_task.parent_task.title if task.department_task else None,
        "executor_id": task.executor_id,
        "executor_ids": executor_ids,
        "executors": executors,
        "executor": executor_text,
        "owner_id": task.owner_id,
        "owner_ids": owner_ids,
        "owners": owners,
        "owner": owner_text,
        "status": task.status,
        "weekly_status": sub_task_weekly_status(task, current_update),
        "weekly_update_status": current_update.status if current_update else None,
        "progress": task.progress,
        "risk_level": task.risk_level,
        "due_date": task.due_date.isoformat() if task.due_date else None,
    }


def serialize_department_task_tree(task: DepartmentTask) -> dict:
    return {
        **serialize_department_task(task),
        "sub_tasks": [serialize_sub_task(sub_task) for sub_task in sorted(task.sub_tasks, key=lambda item: item.code)],
    }


def serialize_weekly_update(update: WeeklyUpdate) -> dict:
    return {
        "id": update.id,
        "sub_task_id": update.sub_task_id,
        "sub_task": update.sub_task.title if update.sub_task else None,
        "assignee_id": update.assignee_id,
        "assignee": update.assignee.name if update.assignee else None,
        "week_key": update.week_key,
        "status": update.status,
        "progress": update.progress,
        "this_week": update.this_week,
        "next_week": update.next_week,
        "risk": update.risk,
        "risk_level": update.risk_level,
        "needs_coordination": update.needs_coordination,
        "submitter_id": update.submitter_id,
        "submitter": update.submitter.name if update.submitter else None,
        "submitted_at": update.submitted_at.isoformat() if update.submitted_at else None,
    }


def serialize_risk_item(item: RiskItem) -> dict:
    sub_task = item.sub_task
    department_task = sub_task.department_task if sub_task else None
    parent_task = department_task.parent_task if department_task else None
    return {
        "id": item.id,
        "code": item.code,
        "sub_task_id": item.sub_task_id,
        "sub_task_code": sub_task.code if sub_task else None,
        "sub_task": sub_task.title if sub_task else None,
        "department_task": department_task.title if department_task else None,
        "department_task_code": department_task.code if department_task else None,
        "parent_task": parent_task.title if parent_task else None,
        "parent_task_code": parent_task.code if parent_task else None,
        "source_weekly_update_id": item.source_weekly_update_id,
        "title": item.title,
        "description": item.description,
        "impact_score": item.impact_score,
        "likelihood_score": item.likelihood_score,
        "score": item.score,
        "level": item.level,
        "owner_id": item.owner_id,
        "owner": item.owner.name if item.owner else None,
        "status": item.status,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "resolution_note": item.resolution_note,
        "created_by": item.created_by.name if item.created_by else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def upsert_weekly_update(
    db: Session,
    *,
    sub_task: SubTask,
    user: User,
    assignee: User,
    week_key: str,
    progress: int | None,
    this_week: str | None,
    next_week: str | None,
    risk: str | None,
    risk_level: str | None,
    needs_coordination: bool,
    submit: bool,
) -> WeeklyUpdate:
    update = db.scalar(
        select(WeeklyUpdate).where(
            WeeklyUpdate.sub_task_id == sub_task.id,
            WeeklyUpdate.week_key == week_key,
            WeeklyUpdate.assignee_id == assignee.id,
        )
    )
    if update and update.status == "submitted" and submit:
        db.add(
            WeeklyUpdateRevision(
                weekly_update_id=update.id,
                editor_id=user.id,
                snapshot=serialize_weekly_update(update),
            )
        )
    if not update:
        update = WeeklyUpdate(
            sub_task_id=sub_task.id,
            assignee_id=assignee.id,
            week_key=week_key,
            submitter_id=user.id,
        )
        db.add(update)
    update.progress = progress if progress is not None else (update.progress or sub_task.progress or 0)
    update.this_week = this_week
    update.next_week = next_week
    update.risk = risk
    update.risk_level = risk_level
    update.needs_coordination = needs_coordination
    update.status = "submitted" if submit else "draft"
    if submit:
        update.submitted_at = datetime.now(timezone.utc)
    db.flush()
    if submit:
        recalculate_sub_task_from_week(db, sub_task, week_key)
    if submit:
        add_event(
            db,
            "sub_task",
            sub_task.id,
            "weekly_update_submitted",
            "提交周更新",
            user.id,
            this_week,
        )
    db.commit()
    db.refresh(update)
    return update


def missing_update_assignments(db: Session, week_key: str) -> list[tuple[SubTask, User]]:
    submitted_pairs = {
        (row[0], row[1])
        for row in db.execute(
            select(WeeklyUpdate.sub_task_id, WeeklyUpdate.assignee_id).where(
                WeeklyUpdate.week_key == week_key, WeeklyUpdate.status == "submitted"
            )
        ).all()
    }
    sub_tasks = list(db.scalars(select(SubTask)).all())
    missing: list[tuple[SubTask, User]] = []
    for task in sub_tasks:
        if (
            task.status in {"completed", "archived"}
            or not task.department_task
            or task.department_task.status == "archived"
            or not task.department_task.parent_task
            or task.department_task.parent_task.status == "archived"
        ):
            continue
        for assignee in executor_people(task):
            if (task.id, assignee.id) not in submitted_pairs:
                missing.append((task, assignee))
    return missing


def missing_update_sub_tasks(db: Session, week_key: str) -> list[SubTask]:
    seen: set[int] = set()
    tasks: list[SubTask] = []
    for task, _assignee in missing_update_assignments(db, week_key):
        if task.id not in seen:
            seen.add(task.id)
            tasks.append(task)
    return tasks


def build_meeting_board(db: Session, week_key: str) -> dict:
    sub_tasks = list(db.scalars(select(SubTask)).all())
    risks = list(
        db.scalars(
            select(RiskItem).where(
                RiskItem.status.in_(ACTIVE_RISK_STATUSES),
                RiskItem.level == "high",
            )
        ).all()
    )
    completed = [task for task in sub_tasks if task.status == "completed"]
    missing = missing_update_assignments(db, week_key)

    return {
        "week_key": week_key,
        "decision_items": [],
        "high_risks": [
            {
                "title": risk.title,
                "owner": risk.owner.name if risk.owner else people_payload(owner_people(risk.sub_task))[2],
                "problem": risk.description or (risk.sub_task.title if risk.sub_task else None),
                "suggestion": "建议升级协调并确认处理时限。",
            }
            for risk in risks
        ],
        "missing_updates": [
            {
                "title": task.title,
                "owner": assignee.name,
                "problem": f"{week_key} 尚未提交周更新。",
                "suggestion": "提醒执行人今日完成填报，避免影响部门进度统计。",
            }
            for task, assignee in missing
        ],
        "completed": [serialize_sub_task(task) for task in completed],
        "next_focus": [
            serialize_sub_task(task)
            for task in sorted(sub_tasks, key=lambda item: item.due_date or date.max)[:5]
            if task.status != "completed"
        ],
    }


def create_mock_notifications(db: Session, week_key: str) -> int:
    created = 0
    for task, assignee in missing_update_assignments(db, week_key):
        db.add(
            NotificationRecord(
                target_user_id=assignee.id,
                notification_type="weekly_update_reminder",
                related_type="sub_task",
                related_id=task.id,
                title=f"{week_key} 周更新提醒",
                web_url=f"{settings.web_base_url}/weekly-updates?subTaskId={task.id}&assigneeId={assignee.id}",
                result="模拟发送，等待用户处理",
            )
        )
        created += 1
    db.commit()
    return created


def _card_title(title: str, *, preview: bool = False) -> str:
    return f"[验收示例] {title}" if preview else title


def _card_field(label: str, value: str) -> dict:
    return {
        "is_short": True,
        "text": {"tag": "lark_md", "content": f"**{label}**\n{value or '-'}"},
    }


def _business_card(
    *,
    template: str,
    title: str,
    summary: str,
    fields: list[tuple[str, str]],
    note: str,
    action_text: str,
    web_url: str,
    preview: bool = False,
) -> dict:
    elements: list[dict] = [
        {"tag": "div", "text": {"tag": "lark_md", "content": summary}},
        {"tag": "hr"},
    ]
    if fields:
        elements.append({"tag": "div", "fields": [_card_field(label, value) for label, value in fields]})
    elements.extend(
        [
            {"tag": "note", "elements": [{"tag": "plain_text", "content": note}]},
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": action_text},
                        "url": web_url,
                        "type": "primary",
                    }
                ],
            },
        ]
    )
    return {
        "config": {"wide_screen_mode": True, "enable_forward": False},
        "header": {
            "template": template,
            "title": {"tag": "plain_text", "content": _card_title(title, preview=preview)},
        },
        "elements": elements,
    }


def build_weekly_update_lark_card(task: SubTask, week_key: str, web_url: str) -> dict:
    department_task = task.department_task
    parent_task = department_task.parent_task if department_task else None
    return {
        "config": {"wide_screen_mode": True, "enable_forward": False},
        "header": {
            "template": "orange",
            "title": {"tag": "plain_text", "content": f"{week_key} 周更新提醒"},
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"你有一个子任务尚未提交本周更新：\n**{task.title}**",
                },
            },
            {
                "tag": "div",
                "fields": [
                    {
                        "is_short": True,
                        "text": {
                            "tag": "lark_md",
                            "content": f"**母任务：**\n{parent_task.title if parent_task else '-'}",
                        },
                    },
                    {
                        "is_short": True,
                        "text": {
                            "tag": "lark_md",
                            "content": f"**部门任务：**\n{department_task.title if department_task else '-'}",
                        },
                    },
                ],
            },
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "填写周更新"},
                        "url": web_url,
                        "type": "primary",
                    }
                ],
            },
        ],
    }


def build_weekly_update_digest_card(
    tasks: list[SubTask],
    week_key: str,
    web_url: str,
    *,
    preview: bool = False,
) -> dict:
    visible = tasks[:8]
    lines = [f"{index}. **{task.code}** {task.title}" for index, task in enumerate(visible, start=1)]
    if len(tasks) > len(visible):
        lines.append(f"...另有 **{len(tasks) - len(visible)}** 项，请进入系统查看")
    return _business_card(
        template="orange",
        title=f"{week_key} 周更新待提交",
        summary=f"本周还有 **{len(tasks)}** 个子任务未提交更新：\n\n" + "\n".join(lines),
        fields=[("统计周期", week_key), ("待提交数量", f"{len(tasks)} 项")],
        note="请补充本周完成内容、遗留事项和下一步计划。",
        action_text="填写本周更新",
        web_url=web_url,
        preview=preview,
    )


def build_department_task_split_card(task: DepartmentTask, web_url: str, *, preview: bool = False) -> dict:
    parent = task.parent_task
    return _business_card(
        template="blue",
        title="部门任务待拆解",
        summary=f"新的部门任务已分配给你，请明确子任务、负责人和执行人。\n\n**{task.code} {task.title}**",
        fields=[
            ("所属母任务", f"{parent.code} {parent.title}" if parent else "-"),
            ("截止日期", task.due_date.isoformat() if task.due_date else "待确定"),
        ],
        note="拆解后请确认每个子任务均有明确执行人和截止时间。",
        action_text="前往拆解子任务",
        web_url=web_url,
        preview=preview,
    )


def build_department_task_due_card(
    task: DepartmentTask,
    days_left: int,
    web_url: str,
    *,
    preview: bool = False,
) -> dict:
    deadline_text = "今天截止" if days_left == 0 else f"距离截止还有 **{days_left} 天**"
    parent = task.parent_task
    return _business_card(
        template="red" if days_left <= 1 else "orange",
        title="部门任务临近截止",
        summary=f"{deadline_text}，请检查子任务推进情况并安排收尾。\n\n**{task.code} {task.title}**",
        fields=[
            ("所属母任务", f"{parent.code} {parent.title}" if parent else "-"),
            ("当前进度", f"{task.progress}%"),
            ("截止日期", task.due_date.isoformat() if task.due_date else "-"),
            ("剩余时间", "今天" if days_left == 0 else f"T-{days_left}"),
        ],
        note="如存在阻塞或交付风险，请及时登记风险项并推动处理。",
        action_text="查看部门任务",
        web_url=web_url,
        preview=preview,
    )


def build_risk_item_card(risk: RiskItem, trigger: str, web_url: str, *, preview: bool = False) -> dict:
    sub_task = risk.sub_task
    department_task = sub_task.department_task if sub_task else None
    owner_name = risk.owner.name if risk.owner else "-"
    due_date = risk.due_date.isoformat() if risk.due_date else "未设置"
    return _business_card(
        template="red",
        title=f"风险提醒：{trigger}",
        summary=f"检测到需要优先处理的风险项：\n\n**{risk.code} {risk.title}**\n{risk.description or '暂无补充说明'}",
        fields=[
            ("风险评分", f"{risk.impact_score} × {risk.likelihood_score} = **{risk.score}**"),
            ("风险等级", "高风险" if risk.level == "high" else risk.level),
            ("风险责任人", owner_name),
            ("处理日期", due_date),
            ("来源子任务", f"{sub_task.code} {sub_task.title}" if sub_task else "-"),
            ("部门任务", f"{department_task.code} {department_task.title}" if department_task else "-"),
        ],
        note="请由风险责任人牵头处理，并在系统中持续更新状态和关闭说明。",
        action_text="查看并处理风险",
        web_url=web_url,
        preview=preview,
    )


def build_lark_test_card(web_url: str) -> dict:
    return {
        "config": {"wide_screen_mode": True, "enable_forward": False},
        "header": {
            "template": "blue",
            "title": {"tag": "plain_text", "content": "2.3.1 飞书测试卡片"},
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": "这是一条公司任务跟踪系统的本地联调消息。",
                },
            },
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {"tag": "plain_text", "content": "打开任务系统"},
                        "url": web_url,
                        "type": "primary",
                    }
                ],
            },
        ],
    }


def lark_entry_url(
    user: User,
    next_path: str,
    *,
    notification_id: int | None = None,
) -> str:
    fallback = f"{settings.web_base_url}{next_path}"
    if not user.open_id:
        return fallback
    try:
        return create_lark_login_url(user, next_path, notification_id=notification_id)
    except RuntimeError:
        return fallback


def prepare_notification_link(
    db: Session,
    record: NotificationRecord,
    target: User,
    next_path: str,
) -> str:
    db.add(record)
    db.flush()
    record.web_url = lark_entry_url(target, next_path, notification_id=record.id)
    return record.web_url


def notification_delivery_block(target: User) -> tuple[str, str] | None:
    if target.status == "disabled":
        return "blocked", "目标用户已停用"
    if not target.open_id:
        return "blocked", "目标用户未绑定飞书 open_id"
    if settings.notification_delivery_mode == "allowlist":
        email = (target.email or "").strip().lower()
        if email not in settings.notification_allowlist_emails:
            return "suppressed", "调试白名单模式：未向该用户真实发送"
    return None


async def deliver_notification(
    target: User,
    *,
    card: dict | None = None,
    text: str | None = None,
) -> tuple[bool, str, str]:
    blocked = notification_delivery_block(target)
    if blocked:
        return False, blocked[0], blocked[1]
    if card is not None:
        result = await lark_client.send_interactive_card(target.open_id or "", card)
    else:
        result = await lark_client.send_text(target.open_id or "", text or "")
    return result.ok, result.status, result.message


def notification_exists(db: Session, dedupe_key: str) -> bool:
    return db.scalar(select(NotificationRecord.id).where(NotificationRecord.dedupe_key == dedupe_key)) is not None


def risk_notification_targets(risk: RiskItem) -> list[User]:
    people: list[User] = []
    if risk.owner:
        people.append(risk.owner)
    if risk.sub_task:
        people.extend(owner_people(risk.sub_task))
        if risk.sub_task.department_task:
            people.extend(owner_people(risk.sub_task.department_task))
    deduped: dict[int, User] = {}
    for user in people:
        if user and user.status != "disabled":
            deduped[user.id] = user
    return list(deduped.values())


async def send_risk_item_notifications(db: Session, risk: RiskItem, trigger: str) -> dict:
    created = 0
    sent = 0
    failed = 0
    blocked = 0
    suppressed = 0
    skipped = 0
    results = []
    for target in risk_notification_targets(risk):
        trigger_key = {
            "新增高风险": "created_high",
            "升级为高风险": "escalated_high",
            "风险逾期": f"overdue:{risk.due_date.isoformat() if risk.due_date else 'none'}",
        }.get(trigger, trigger)
        dedupe_key = f"risk_item_alert:{risk.id}:{trigger_key}:{target.id}"
        if notification_exists(db, dedupe_key):
            skipped += 1
            continue
        next_path = f"/sub-tasks/{risk.sub_task_id}/update"
        record = NotificationRecord(
            target_user_id=target.id,
            notification_type="risk_item_alert",
            related_type="risk_item",
            related_id=risk.id,
            title=f"高风险提醒：{risk.title}",
            send_status="pending",
            dedupe_key=dedupe_key,
        )
        web_url = prepare_notification_link(db, record, target, next_path)
        created += 1
        ok, delivery_status, message = await deliver_notification(
            target,
            card=build_risk_item_card(risk, trigger, web_url),
        )
        record.send_status = delivery_status
        record.result = message[:200]
        sent += 1 if ok else 0
        failed += 1 if delivery_status == "failed" else 0
        blocked += 1 if delivery_status == "blocked" else 0
        suppressed += 1 if delivery_status == "suppressed" else 0
        results.append(
            {
                "record_id": record.id,
                "target_user": target.name,
                "send_status": record.send_status,
                "result": record.result,
            }
        )
    db.commit()
    return {
        "created": created,
        "sent": sent,
        "failed": failed,
        "blocked": blocked,
        "suppressed": suppressed,
        "skipped": skipped,
        "results": results,
    }


async def send_risk_overdue_reminders(db: Session, *, today: date | None = None) -> dict:
    today = today or date.today()
    risks = list(
        db.scalars(
            select(RiskItem).where(
                RiskItem.status.in_(ACTIVE_RISK_STATUSES),
                RiskItem.due_date < today,
            )
        ).all()
    )
    totals = {
        "risks": len(risks),
        "created": 0,
        "sent": 0,
        "failed": 0,
        "blocked": 0,
        "suppressed": 0,
        "skipped": 0,
    }
    results = []
    for risk in risks:
        result = await send_risk_item_notifications(db, risk, "风险逾期")
        for key in ("created", "sent", "failed", "blocked", "suppressed", "skipped"):
            totals[key] += result[key]
        results.append({"risk_id": risk.id, "risk": risk.title, "result": result})
    return {**totals, "results": results}


async def send_lark_card_preview_suite(db: Session, target_user_id: int) -> dict:
    target = db.get(User, target_user_id)
    if not target:
        return {"ok": False, "send_status": "blocked", "message": "目标用户不存在"}

    parent = SimpleNamespace(code="PT-2026-001", title="年度重点产品交付")
    department_task = SimpleNamespace(
        id=0,
        code="DT-2026-001",
        title="完成核心模块联调与交付准备",
        parent_task=parent,
        due_date=date.today() + timedelta(days=3),
        progress=72,
    )
    sub_tasks = [
        SimpleNamespace(code=f"ST-2026-{index:03d}", title=title, department_task=department_task)
        for index, title in enumerate(
            ["接口联调与异常场景验证", "用户验收问题收敛", "上线材料与操作手册完善"],
            start=1,
        )
    ]
    risk_owner = SimpleNamespace(name=target.name)
    risk = SimpleNamespace(
        id=0,
        code="RI-2026-001",
        title="关键接口稳定性尚未达到交付标准",
        description="高并发场景仍存在偶发超时，需要在验收前完成定位和复测。",
        impact_score=4,
        likelihood_score=4,
        score=16,
        level="high",
        owner=risk_owner,
        due_date=date.today() + timedelta(days=2),
        sub_task=sub_tasks[0],
    )
    preview_specs = [
        (
            "weekly_update_digest",
            "周更新汇总提醒（验收示例）",
            "/weekly-updates",
            lambda url: build_weekly_update_digest_card(
                sub_tasks,
                current_week_key(),
                url,
                preview=True,
            ),
        ),
        (
            "department_task_split_required",
            "部门任务拆解提醒（验收示例）",
            "/department-tasks",
            lambda url: build_department_task_split_card(department_task, url, preview=True),
        ),
        (
            "department_task_due_soon",
            "部门任务临期提醒（验收示例）",
            "/department-tasks",
            lambda url: build_department_task_due_card(department_task, 3, url, preview=True),
        ),
        (
            "risk_item_alert",
            "风险项提醒（验收示例）",
            "/sub-tasks",
            lambda url: build_risk_item_card(risk, "新增高风险", url, preview=True),
        ),
    ]
    sent = failed = blocked = suppressed = 0
    results = []
    for notification_type, title, next_path, card_builder in preview_specs:
        record = NotificationRecord(
            target_user_id=target.id,
            notification_type=notification_type,
            related_type="card_preview",
            related_id=None,
            title=title,
            send_status="pending",
        )
        web_url = prepare_notification_link(db, record, target, next_path)
        ok, delivery_status, message = await deliver_notification(target, card=card_builder(web_url))
        record.send_status = delivery_status
        record.result = message[:200]
        sent += 1 if ok else 0
        failed += 1 if delivery_status == "failed" else 0
        blocked += 1 if delivery_status == "blocked" else 0
        suppressed += 1 if delivery_status == "suppressed" else 0
        results.append(
            {
                "record_id": record.id,
                "notification_type": notification_type,
                "send_status": delivery_status,
                "result": record.result,
            }
        )
    db.commit()
    return {
        "ok": sent == len(preview_specs),
        "target_user": target.name,
        "created": len(preview_specs),
        "sent": sent,
        "failed": failed,
        "blocked": blocked,
        "suppressed": suppressed,
        "results": results,
    }


async def send_lark_test_message(db: Session, target_user_id: int) -> dict:
    target = db.get(User, target_user_id)
    if not target:
        return {"ok": False, "send_status": "blocked", "message": "目标用户不存在"}

    record = NotificationRecord(
        target_user_id=target.id,
        notification_type="lark_test_message",
        related_type="user",
        related_id=target.id,
        title="2.3.1 飞书测试卡片",
        send_status="pending",
    )
    web_url = prepare_notification_link(db, record, target, "/meeting-board/overview")

    _ok, delivery_status, message = await deliver_notification(
        target,
        card=build_lark_test_card(web_url),
    )
    record.send_status = delivery_status
    record.result = message[:200]

    db.commit()
    db.refresh(record)
    return {
        "ok": record.send_status == "sent",
        "record_id": record.id,
        "target_user": target.name,
        "send_status": record.send_status,
        "message": record.result,
    }


async def send_weekly_update_reminders(db: Session, week_key: str) -> dict:
    created = 0
    sent = 0
    failed = 0
    blocked = 0
    results = []
    suppressed = 0
    skipped = 0
    grouped: dict[int, tuple[User, list[SubTask]]] = {}
    task_groups: dict[int, list[SubTask]] = defaultdict(list)
    targets: dict[int, User] = {}
    for task, target in missing_update_assignments(db, week_key):
        task_groups[target.id].append(task)
        targets[target.id] = target
    for target_id, tasks in task_groups.items():
        grouped[target_id] = (targets[target_id], sorted(tasks, key=lambda item: item.code))

    for target, tasks in grouped.values():
        dedupe_key = f"weekly_update_digest:{week_key}:{target.id}"
        if notification_exists(db, dedupe_key):
            skipped += 1
            continue
        next_path = "/weekly-updates"
        record = NotificationRecord(
            target_user_id=target.id,
            notification_type="weekly_update_digest",
            related_type="weekly_update",
            related_id=None,
            title=f"{week_key} 周更新汇总提醒（{len(tasks)} 项）",
            send_status="pending",
            dedupe_key=dedupe_key,
        )
        web_url = prepare_notification_link(db, record, target, next_path)
        created += 1

        ok, delivery_status, message = await deliver_notification(
            target,
            card=build_weekly_update_digest_card(tasks, week_key, web_url),
        )
        record.send_status = delivery_status
        record.result = message[:200]
        sent += 1 if ok else 0
        failed += 1 if delivery_status == "failed" else 0
        blocked += 1 if delivery_status == "blocked" else 0
        suppressed += 1 if delivery_status == "suppressed" else 0
        results.append(
            {
                "record_id": record.id,
                "target_user": target.name,
                "sub_task_count": len(tasks),
                "send_status": record.send_status,
                "result": record.result,
            }
        )
    db.commit()
    return {
        "created": created,
        "sent": sent,
        "failed": failed,
        "blocked": blocked,
        "suppressed": suppressed,
        "skipped": skipped,
        "results": results,
    }


async def send_department_task_split_notifications(
    db: Session,
    task: DepartmentTask,
    targets: list[User],
    *,
    event: str,
) -> dict:
    created = sent = failed = blocked = suppressed = skipped = 0
    results = []
    for target in targets:
        dedupe_key = f"department_task_split_required:{task.id}:{target.id}:{event}"
        if notification_exists(db, dedupe_key):
            skipped += 1
            continue
        record = NotificationRecord(
            target_user_id=target.id,
            notification_type="department_task_split_required",
            related_type="department_task",
            related_id=task.id,
            title=f"部门任务待拆解：{task.title}",
            send_status="pending",
            dedupe_key=dedupe_key,
        )
        web_url = prepare_notification_link(db, record, target, "/department-tasks")
        created += 1
        ok, delivery_status, message = await deliver_notification(
            target,
            card=build_department_task_split_card(task, web_url),
        )
        record.send_status = delivery_status
        record.result = message[:200]
        sent += 1 if ok else 0
        failed += 1 if delivery_status == "failed" else 0
        blocked += 1 if delivery_status == "blocked" else 0
        suppressed += 1 if delivery_status == "suppressed" else 0
        results.append(
            {
                "record_id": record.id,
                "target_user": target.name,
                "send_status": delivery_status,
                "result": record.result,
            }
        )
    db.commit()
    return {
        "created": created,
        "sent": sent,
        "failed": failed,
        "blocked": blocked,
        "suppressed": suppressed,
        "skipped": skipped,
        "results": results,
    }


async def send_department_task_due_reminders(db: Session, *, today: date | None = None) -> dict:
    today = today or date.today()
    window_end = today + timedelta(days=7)
    tasks = list(
        db.scalars(
            select(DepartmentTask)
            .where(
                DepartmentTask.due_date.is_not(None),
                DepartmentTask.due_date >= today,
                DepartmentTask.due_date <= window_end,
                DepartmentTask.status.not_in(["completed", "archived"]),
            )
            .order_by(DepartmentTask.due_date, DepartmentTask.id)
        ).all()
    )
    created = sent = failed = blocked = suppressed = skipped = 0
    results = []
    for task in tasks:
        if not task.parent_task or task.parent_task.status == "archived" or not task.due_date:
            continue
        days_left = (task.due_date - today).days
        for target in owner_people(task):
            dedupe_key = f"department_task_due_soon:{task.id}:{task.due_date.isoformat()}:{target.id}"
            if notification_exists(db, dedupe_key):
                skipped += 1
                continue
            record = NotificationRecord(
                target_user_id=target.id,
                notification_type="department_task_due_soon",
                related_type="department_task",
                related_id=task.id,
                title=f"部门任务临近截止：{task.title}",
                send_status="pending",
                dedupe_key=dedupe_key,
            )
            web_url = prepare_notification_link(db, record, target, "/department-tasks")
            created += 1
            ok, delivery_status, message = await deliver_notification(
                target,
                card=build_department_task_due_card(task, days_left, web_url),
            )
            record.send_status = delivery_status
            record.result = message[:200]
            sent += 1 if ok else 0
            failed += 1 if delivery_status == "failed" else 0
            blocked += 1 if delivery_status == "blocked" else 0
            suppressed += 1 if delivery_status == "suppressed" else 0
            results.append(
                {
                    "record_id": record.id,
                    "department_task_id": task.id,
                    "target_user": target.name,
                    "days_left": days_left,
                    "send_status": delivery_status,
                    "result": record.result,
                }
            )
    db.commit()
    return {
        "tasks": len(tasks),
        "created": created,
        "sent": sent,
        "failed": failed,
        "blocked": blocked,
        "suppressed": suppressed,
        "skipped": skipped,
        "results": results,
    }
