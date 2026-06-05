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
        "department_task_count": len(task.department_tasks),
    }


def serialize_department_task(task: DepartmentTask) -> dict:
    return {
        "id": task.id,
        "code": task.code,
        "title": task.title,
        "parent_task_id": task.parent_task_id,
        "parent_task": task.parent_task.title if task.parent_task else None,
        "department_id": task.department_id,
        "department": task.department.name if task.department else None,
        "owner_id": task.owner_id,
        "owner": task.owner.name if task.owner else None,
        "status": task.status,
        "progress": task.progress,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "sub_task_count": len(task.sub_tasks),
    }


def serialize_sub_task(task: SubTask) -> dict:
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
        "progress": task.progress,
        "risk_level": task.risk_level,
        "due_date": task.due_date.isoformat() if task.due_date else None,
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
    progress: int,
    this_week: str | None,
    next_week: str | None,
    risk: str | None,
    risk_level: str,
    needs_coordination: bool,
    submit: bool,
) -> WeeklyUpdate:
    update = db.scalar(
        select(WeeklyUpdate).where(
            WeeklyUpdate.sub_task_id == sub_task.id, WeeklyUpdate.week_key == week_key
        )
    )
    if update and update.status == "submitted":
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
    update.progress = progress
    update.this_week = this_week
    update.next_week = next_week
    update.risk = risk
    update.needs_coordination = needs_coordination
    update.status = "submitted" if submit else "draft"
    if submit:
        update.submitted_at = datetime.now(timezone.utc)
    sub_task.progress = progress
    sub_task.risk_level = risk_level
    if progress >= 100:
        sub_task.status = "completed"
    elif risk_level in {"high", "medium", "low"}:
        sub_task.status = "risk"
    else:
        sub_task.status = "in_progress"
    db.flush()
    if risk and risk_level in {"high", "medium", "low"}:
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
    if needs_coordination:
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
    add_event(
        db,
        "sub_task",
        sub_task.id,
        "weekly_update_submitted" if submit else "weekly_update_draft",
        "提交周更新" if submit else "保存周更新草稿",
        user.id,
        this_week,
    )
    db.commit()
    db.refresh(update)
    return update


def build_meeting_board(db: Session, week_key: str) -> dict:
    submitted_ids = {
        row[0]
        for row in db.execute(
            select(WeeklyUpdate.sub_task_id).where(
                WeeklyUpdate.week_key == week_key, WeeklyUpdate.status == "submitted"
            )
        ).all()
    }
    sub_tasks = list(db.scalars(select(SubTask)).all())
    risks = list(db.scalars(select(RiskRecord).where(RiskRecord.status == "open")).all())
    coordination = list(
        db.scalars(select(CoordinationItem).where(CoordinationItem.status == "open")).all()
    )
    completed = [task for task in sub_tasks if task.status == "completed"]
    missing = [task for task in sub_tasks if task.id not in submitted_ids and task.status != "completed"]

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
    board = build_meeting_board(db, week_key)
    created = 0
    for item in board["missing_updates"]:
        task = db.scalar(select(SubTask).where(SubTask.title == item["title"]))
        if not task:
            continue
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
