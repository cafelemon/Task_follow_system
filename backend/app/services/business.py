from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    CoordinationItem,
    DepartmentTask,
    NotificationRecord,
    ParentTask,
    RiskRecord,
    StrategicGoal,
    SubTask,
    TaskEvent,
    User,
    WeeklyUpdate,
    WeeklyUpdateRevision,
)
from app.services.auth import create_lark_login_url
from app.services.lark_client import lark_client


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
        "owner": task.owner.name if task.owner else None,
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
        "owner": task.owner.name if task.owner else None,
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
    return {
        "id": task.id,
        "code": task.code,
        "title": task.title,
        "department_task_id": task.department_task_id,
        "department_task": task.department_task.title if task.department_task else None,
        "parent_task": task.department_task.parent_task.title if task.department_task else None,
        "executor_id": task.executor_id,
        "executor": task.executor.name if task.executor else None,
        "owner_id": task.owner_id,
        "owner": task.owner.name if task.owner else None,
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
        "week_key": update.week_key,
        "status": update.status,
        "progress": update.progress,
        "this_week": update.this_week,
        "next_week": update.next_week,
        "risk": update.risk,
        "needs_coordination": update.needs_coordination,
        "submitter_id": update.submitter_id,
        "submitter": update.submitter.name if update.submitter else None,
        "submitted_at": update.submitted_at.isoformat() if update.submitted_at else None,
    }


def upsert_weekly_update(
    db: Session,
    *,
    sub_task: SubTask,
    user: User,
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
            WeeklyUpdate.sub_task_id == sub_task.id, WeeklyUpdate.week_key == week_key
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
        update = WeeklyUpdate(sub_task_id=sub_task.id, week_key=week_key, submitter_id=user.id)
        db.add(update)
    update.progress = progress if progress is not None else (update.progress or sub_task.progress or 0)
    update.this_week = this_week
    update.next_week = next_week
    update.risk = risk
    update.needs_coordination = needs_coordination
    update.status = "submitted" if submit else "draft"
    if submit:
        update.submitted_at = datetime.now(timezone.utc)
    if progress is not None:
        sub_task.progress = progress
        if progress >= 100:
            sub_task.status = "completed"
        elif sub_task.status == "pending_update":
            sub_task.status = "in_progress"
    if risk_level:
        sub_task.risk_level = risk_level
        if risk_level in {"high", "medium", "low"}:
            sub_task.status = "risk"
    db.flush()
    if submit and risk and risk_level in {"high", "medium", "low"}:
        exists = db.scalar(
            select(RiskRecord).where(RiskRecord.sub_task_id == sub_task.id, RiskRecord.status == "open")
        )
        if not exists:
            db.add(
                RiskRecord(
                    code=generate_code(db, RiskRecord, "R"),
                    sub_task_id=sub_task.id,
                    level=risk_level,
                    description=risk,
                    created_by_id=user.id,
                )
            )
    if submit and needs_coordination:
        exists = db.scalar(
            select(CoordinationItem).where(
                CoordinationItem.sub_task_id == sub_task.id, CoordinationItem.status == "open"
            )
        )
        if not exists:
            db.add(
                CoordinationItem(
                    sub_task_id=sub_task.id,
                    title=f"{sub_task.title} 需要协调",
                    description=risk or "周更新中标记为需要协调。",
                    owner_id=sub_task.owner_id,
                )
            )
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


def missing_update_sub_tasks(db: Session, week_key: str) -> list[SubTask]:
    submitted_ids = {
        row[0]
        for row in db.execute(
            select(WeeklyUpdate.sub_task_id).where(
                WeeklyUpdate.week_key == week_key, WeeklyUpdate.status == "submitted"
            )
        ).all()
    }
    sub_tasks = list(db.scalars(select(SubTask)).all())
    return [task for task in sub_tasks if task.id not in submitted_ids and task.status != "completed"]


def build_meeting_board(db: Session, week_key: str) -> dict:
    sub_tasks = list(db.scalars(select(SubTask)).all())
    risks = list(db.scalars(select(RiskRecord).where(RiskRecord.status == "open")).all())
    coordination = list(
        db.scalars(select(CoordinationItem).where(CoordinationItem.status == "open")).all()
    )
    completed = [task for task in sub_tasks if task.status == "completed"]
    missing = missing_update_sub_tasks(db, week_key)

    return {
        "week_key": week_key,
        "decision_items": [
            {
                "title": item.title,
                "owner": item.sub_task.owner.name if item.sub_task and item.sub_task.owner else None,
                "problem": item.description,
                "suggestion": "请在会议中明确责任边界与下一步时间点。",
            }
            for item in coordination
        ],
        "high_risks": [
            {
                "title": risk.sub_task.title,
                "owner": risk.sub_task.owner.name if risk.sub_task and risk.sub_task.owner else None,
                "problem": risk.description,
                "suggestion": "建议升级协调并确认处理时限。",
            }
            for risk in risks
            if risk.level == "high"
        ],
        "missing_updates": [
            {
                "title": task.title,
                "owner": task.executor.name if task.executor else None,
                "problem": f"{week_key} 尚未提交周更新。",
                "suggestion": "提醒执行人今日完成填报，避免影响部门进度统计。",
            }
            for task in missing
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
    for task in missing_update_sub_tasks(db, week_key):
        db.add(
            NotificationRecord(
                target_user_id=task.executor_id,
                notification_type="weekly_update_reminder",
                related_type="sub_task",
                related_id=task.id,
                title=f"{week_key} 周更新提醒",
                web_url=f"{settings.web_base_url}/weekly-updates?subTaskId={task.id}",
                result="模拟发送，等待用户处理",
            )
        )
        created += 1
    db.commit()
    return created


def build_weekly_update_lark_card(task: SubTask, week_key: str, web_url: str) -> dict:
    department_task = task.department_task
    parent_task = department_task.parent_task if department_task else None
    return {
        "config": {"wide_screen_mode": True},
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


def build_lark_test_card(web_url: str) -> dict:
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "template": "blue",
            "title": {"tag": "plain_text", "content": "2.0.2 飞书测试卡片"},
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


def lark_entry_url(user: User, next_path: str) -> str:
    fallback = f"{settings.web_base_url}{next_path}"
    if not user.open_id:
        return fallback
    try:
        return create_lark_login_url(user, next_path)
    except RuntimeError:
        return fallback


async def send_lark_test_message(db: Session, target_user_id: int) -> dict:
    target = db.get(User, target_user_id)
    if not target:
        return {"ok": False, "send_status": "blocked", "message": "目标用户不存在"}

    web_url = lark_entry_url(target, "/meeting-board/overview")
    record = NotificationRecord(
        target_user_id=target.id,
        notification_type="lark_test_message",
        related_type="user",
        related_id=target.id,
        title="2.0.2 飞书测试卡片",
        web_url=web_url,
        send_status="pending",
    )
    db.add(record)
    db.flush()

    if not target.open_id:
        record.send_status = "blocked"
        record.result = "目标用户未绑定飞书 open_id"
    else:
        result = await lark_client.send_interactive_card(
            target.open_id,
            build_lark_test_card(web_url),
        )
        record.send_status = result.status
        record.result = result.message[:200]

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
    for task in missing_update_sub_tasks(db, week_key):
        next_path = f"/weekly-updates?subTaskId={task.id}"
        target = task.executor
        web_url = lark_entry_url(target, next_path) if target else f"{settings.web_base_url}{next_path}"
        record = NotificationRecord(
            target_user_id=task.executor_id,
            notification_type="weekly_update_reminder",
            related_type="sub_task",
            related_id=task.id,
            title=f"{week_key} 周更新提醒",
            web_url=web_url,
            send_status="pending",
        )
        db.add(record)
        db.flush()
        created += 1

        if not target or not target.open_id:
            record.send_status = "blocked"
            record.result = "目标用户未绑定飞书 open_id"
            blocked += 1
        else:
            card = build_weekly_update_lark_card(task, week_key, web_url)
            result = await lark_client.send_interactive_card(target.open_id, card)
            record.send_status = result.status
            record.result = result.message[:200]
            sent += 1 if result.ok else 0
            failed += 1 if result.status == "failed" else 0
            blocked += 1 if result.status == "blocked" else 0
        results.append(
            {
                "record_id": record.id,
                "target_user": target.name if target else None,
                "sub_task_id": task.id,
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
        "results": results,
    }
