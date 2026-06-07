from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import __version__
from app.db.session import get_db
from app.models.entities import (
    Attachment,
    CoordinationItem,
    Department,
    DepartmentTask,
    NotificationRecord,
    ParentTask,
    Permission,
    RiskRecord,
    Role,
    StrategicGoal,
    SubTask,
    TaskEvent,
    User,
    WeeklyUpdate,
)
from app.schemas.dto import (
    DepartmentTaskCreate,
    DepartmentTaskUpdate,
    GoalCreate,
    LoginRequest,
    MockNotificationRequest,
    OpenIdLoginRequest,
    ParentTaskCreate,
    ParentTaskUpdate,
    PersonCreate,
    PersonUpdate,
    RolePermissionUpdate,
    SubTaskCreate,
    WeeklyUpdateUpsert,
)
from app.services.business import (
    build_meeting_board,
    create_mock_notifications,
    current_week_key,
    generate_code,
    serialize_department_task,
    serialize_department_task_tree,
    serialize_goal,
    serialize_parent_task,
    serialize_sub_task,
    serialize_user,
    serialize_weekly_update,
    upsert_weekly_update,
)
from app.services.permissions import (
    can_access_parent_task,
    can_access_department_task,
    can_edit_parent_task,
    can_create_department_task,
    can_edit_department_task,
    can_split_sub_task,
    can_access_sub_task,
    can_manage_parent_tasks,
    can_view_parent_task_page,
    can_view_department_directory,
    get_current_user,
    refresh_role_permissions,
    require_admin,
    require_permission,
    user_permission_codes,
)
from app.services.auth import SESSION_COOKIE, SESSION_DAYS, create_session, delete_session, verify_password
from app.services.lark_sync import import_base_2026, preview_base_2026

router = APIRouter(prefix="/api")


def feature_payload(db: Session, user: User) -> dict:
    can_manage_parent = can_manage_parent_tasks(user)
    return {
        "can_view_parent_tasks": can_view_parent_task_page(db, user),
        "can_create_parent_tasks": can_manage_parent,
        "can_delete_parent_tasks": can_manage_parent,
        "can_manage_parent_tasks": can_manage_parent,
        "can_switch_department": can_view_department_directory(user),
    }


def generate_sub_task_code(db: Session, department_task: DepartmentTask) -> str:
    prefix = f"{department_task.code}-"
    existing = {
        code
        for code in db.scalars(select(SubTask.code).where(SubTask.code.like(f"{prefix}%"))).all()
        if code
    }
    index = len(existing) + 1
    while True:
        code = f"{prefix}{index:02d}"
        if code not in existing and not db.scalar(select(SubTask.id).where(SubTask.code == code)):
            return code
        index += 1


def resolve_departments(db: Session, department_id: int | None, department_ids: list[int] | None) -> tuple[int, list[Department]]:
    selected_ids = list(dict.fromkeys(department_ids or ([] if department_id is None else [department_id])))
    if not selected_ids:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="负责部门不能为空")
    departments = list(db.scalars(select(Department).where(Department.id.in_(selected_ids))).all())
    found_ids = {department.id for department in departments}
    if found_ids != set(selected_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department not found")
    ordered_departments = sorted(departments, key=lambda item: selected_ids.index(item.id))
    return selected_ids[0], ordered_departments


def serialize_department_task_for_user(db: Session, user: User, task: DepartmentTask) -> dict:
    return {
        **serialize_department_task(task),
        "can_edit": can_edit_department_task(db, user, task),
        "can_delete": can_edit_department_task(db, user, task),
        "can_split": can_split_sub_task(db, user, task),
    }


def serialize_department_task_tree_for_user(db: Session, user: User, task: DepartmentTask) -> dict:
    current_week = current_week_key()
    updates = {
        update.sub_task_id: update
        for update in db.scalars(
            select(WeeklyUpdate).where(
                WeeklyUpdate.week_key == current_week,
                WeeklyUpdate.sub_task_id.in_([sub_task.id for sub_task in task.sub_tasks] or [0]),
            )
        ).all()
    }
    return {
        **serialize_department_task_for_user(db, user, task),
        "sub_tasks": [
            serialize_sub_task(sub_task, updates.get(sub_task.id))
            for sub_task in sorted(task.sub_tasks, key=lambda item: item.code)
        ],
    }


def week_key_from_date(value: date) -> str:
    year, week, _ = value.isocalendar()
    return f"{year}-W{week:02d}"


def monday_from_week_key(week_key: str) -> date:
    year_text, week_text = week_key.split("-W", 1)
    return date.fromisocalendar(int(year_text), int(week_text), 1)


def week_keys_between(start: date, end: date) -> list[str]:
    current = start - timedelta(days=start.weekday())
    final = end - timedelta(days=end.weekday())
    keys: list[str] = []
    while current <= final:
        keys.append(week_key_from_date(current))
        current += timedelta(days=7)
    return keys


def visible_sub_tasks(db: Session, user: User) -> list[SubTask]:
    return [
        task
        for task in db.scalars(select(SubTask).order_by(SubTask.code)).all()
        if task.department_task
        and task.department_task.status != "archived"
        and task.department_task.parent_task
        and task.department_task.parent_task.status != "archived"
        and can_access_sub_task(db, user, task)
    ]


def visible_department_tasks(db: Session, user: User) -> list[DepartmentTask]:
    return [
        task
        for task in db.scalars(
            select(DepartmentTask)
            .join(ParentTask)
            .where(DepartmentTask.status != "archived", ParentTask.status != "archived")
            .order_by(DepartmentTask.code)
        ).all()
        if can_access_department_task(db, user, task)
    ]


def update_by_sub_task(db: Session, sub_tasks: list[SubTask], week_key: str) -> dict[int, WeeklyUpdate]:
    ids = [task.id for task in sub_tasks]
    if not ids:
        return {}
    return {
        update.sub_task_id: update
        for update in db.scalars(
            select(WeeklyUpdate).where(WeeklyUpdate.week_key == week_key, WeeklyUpdate.sub_task_id.in_(ids))
        ).all()
    }


def earliest_update_week_map(db: Session, sub_tasks: list[SubTask]) -> dict[int, str]:
    ids = [task.id for task in sub_tasks]
    if not ids:
        return {}
    result: dict[int, str] = {}
    for update in db.scalars(
        select(WeeklyUpdate).where(WeeklyUpdate.sub_task_id.in_(ids)).order_by(WeeklyUpdate.week_key)
    ).all():
        result.setdefault(update.sub_task_id, update.week_key)
    return result


def task_start_date(task: SubTask, earliest_weeks: dict[int, str]) -> date:
    if task.started_at:
        return task.started_at.date()
    if task.id in earliest_weeks:
        return monday_from_week_key(earliest_weeks[task.id])
    return monday_from_week_key(current_week_key())


def sub_task_summary(task: SubTask, current_update: WeeklyUpdate | None = None) -> dict:
    return {
        **serialize_sub_task(task, current_update),
        "parent_task_id": task.department_task.parent_task_id if task.department_task else None,
        "parent_task_code": task.department_task.parent_task.code if task.department_task and task.department_task.parent_task else None,
        "parent_task": task.department_task.parent_task.title if task.department_task and task.department_task.parent_task else None,
        "department_task_code": task.department_task.code if task.department_task else None,
        "department_task": task.department_task.title if task.department_task else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
    }


def build_meeting_overview_payload(db: Session, user: User, week_key: str) -> dict:
    sub_tasks = visible_sub_tasks(db, user)
    current_updates = update_by_sub_task(db, sub_tasks, week_key)
    today = date.today()
    active_tasks = [task for task in sub_tasks if task.status != "completed"]
    updated_tasks = [task for task in active_tasks if task.id in current_updates]
    missing_tasks = [task for task in active_tasks if task.id not in current_updates]
    risk_tasks = [task for task in sub_tasks if task.risk_level in {"high", "medium", "low"}]
    overdue_tasks = [task for task in active_tasks if task.due_date and task.due_date < today]
    completed_tasks = [task for task in sub_tasks if task.status == "completed"]
    weeks = week_keys_between(monday_from_week_key(week_key) - timedelta(days=35), monday_from_week_key(week_key))
    trend_updates = list(
        db.scalars(select(WeeklyUpdate).where(WeeklyUpdate.week_key.in_(weeks))).all()
    )
    visible_ids = {task.id for task in sub_tasks}
    trend = [
        {
            "week_key": key,
            "submitted": len([item for item in trend_updates if item.week_key == key and item.status == "submitted" and item.sub_task_id in visible_ids]),
            "draft": len([item for item in trend_updates if item.week_key == key and item.status == "draft" and item.sub_task_id in visible_ids]),
        }
        for key in weeks
    ]
    gantt_source = sorted(active_tasks, key=lambda item: item.due_date or date.max)[:14]
    earliest_weeks = earliest_update_week_map(db, gantt_source)
    return {
        "week_key": week_key,
        "cards": {
            "active_sub_tasks": len(active_tasks),
            "updated_this_week": len(updated_tasks),
            "missing_updates": len(missing_tasks),
            "risk_tasks": len(risk_tasks),
            "overdue_tasks": len(overdue_tasks),
            "completed_tasks": len(completed_tasks),
        },
        "weekly_bar": [
            {"name": "已更新", "value": len(updated_tasks)},
            {"name": "待更新", "value": len(missing_tasks)},
            {"name": "已完成", "value": len(completed_tasks)},
        ],
        "risk_pie": [
            {"name": "高风险", "value": len([task for task in risk_tasks if task.risk_level == "high"])},
            {"name": "中风险", "value": len([task for task in risk_tasks if task.risk_level == "medium"])},
            {"name": "低风险", "value": len([task for task in risk_tasks if task.risk_level == "low"])},
            {"name": "无风险", "value": len([task for task in sub_tasks if task.risk_level not in {"high", "medium", "low"}])},
        ],
        "trend": trend,
        "gantt": [
            {
                "id": task.id,
                "code": task.code,
                "title": task.title,
                "owner": task.owner.name if task.owner else None,
                "executor": task.executor.name if task.executor else None,
                "status": task.status,
                "start_date": task_start_date(task, earliest_weeks).isoformat(),
                "due_date": task.due_date.isoformat() if task.due_date else today.isoformat(),
            }
            for task in gantt_source
        ],
        "risk_overdue": [
            {
                **sub_task_summary(task, current_updates.get(task.id)),
                "issue_type": "逾期" if task in overdue_tasks else "风险",
            }
            for task in sorted(
                {task.id: task for task in risk_tasks + overdue_tasks}.values(),
                key=lambda item: item.due_date or date.max,
            )
        ],
    }


def build_parent_board_payload(db: Session, user: User, week_key: str) -> dict:
    sub_tasks = visible_sub_tasks(db, user)
    current_updates = update_by_sub_task(db, sub_tasks, week_key)
    today = date.today()
    rows = []
    by_parent: dict[int, list[SubTask]] = defaultdict(list)
    for task in sub_tasks:
        if task.department_task and task.department_task.parent_task:
            by_parent[task.department_task.parent_task.id].append(task)
    for parent_id, tasks in by_parent.items():
        parent = tasks[0].department_task.parent_task
        department_task_ids = {task.department_task_id for task in tasks}
        active = [task for task in tasks if task.status != "completed"]
        rows.append(
            {
                "id": parent_id,
                "code": parent.code,
                "title": parent.title,
                "owner": parent.owner.name if parent.owner else None,
                "department": parent.department.name if parent.department else None,
                "department_task_count": len(department_task_ids),
                "sub_task_count": len(tasks),
                "missing_updates": len([task for task in active if task.id not in current_updates]),
                "risk_count": len([task for task in tasks if task.risk_level in {"high", "medium", "low"}]),
                "overdue_count": len([task for task in active if task.due_date and task.due_date < today]),
                "completed_count": len([task for task in tasks if task.status == "completed"]),
            }
        )
    return {"week_key": week_key, "rows": sorted(rows, key=lambda item: item["code"])}


def build_department_board_payload(db: Session, user: User, week_key: str) -> dict:
    sub_tasks = visible_sub_tasks(db, user)
    current_updates = update_by_sub_task(db, sub_tasks, week_key)
    today = date.today()
    rows_by_department: dict[int, dict] = {}
    for task in sub_tasks:
        department_task = task.department_task
        departments = department_task.departments or ([department_task.department] if department_task.department else [])
        for department in departments:
            row = rows_by_department.setdefault(
                department.id,
                {
                    "id": department.id,
                    "name": department.name,
                    "department_task_ids": set(),
                    "sub_task_ids": set(),
                    "missing_updates": 0,
                    "risk_count": 0,
                    "overdue_count": 0,
                    "completed_count": 0,
                },
            )
            row["department_task_ids"].add(department_task.id)
            row["sub_task_ids"].add(task.id)
            if task.status != "completed" and task.id not in current_updates:
                row["missing_updates"] += 1
            if task.risk_level in {"high", "medium", "low"}:
                row["risk_count"] += 1
            if task.status != "completed" and task.due_date and task.due_date < today:
                row["overdue_count"] += 1
            if task.status == "completed":
                row["completed_count"] += 1
    rows = []
    for row in rows_by_department.values():
        rows.append(
            {
                **{key: value for key, value in row.items() if key not in {"department_task_ids", "sub_task_ids"}},
                "department_task_count": len(row["department_task_ids"]),
                "sub_task_count": len(row["sub_task_ids"]),
            }
        )
    return {"week_key": week_key, "rows": sorted(rows, key=lambda item: item["name"])}


def build_timeline_matrix_payload(db: Session, user: User) -> dict:
    sub_tasks = visible_sub_tasks(db, user)
    current_monday = monday_from_week_key(current_week_key())
    earliest_weeks = earliest_update_week_map(db, sub_tasks)
    start_dates = [task_start_date(task, earliest_weeks) for task in sub_tasks] or [current_monday]
    first_monday = min(start_dates) - timedelta(days=min(start_dates).weekday())
    if (current_monday - first_monday).days > 49:
        first_monday = current_monday - timedelta(days=49)
    weeks = week_keys_between(first_monday, current_monday)
    updates = {
        (update.sub_task_id, update.week_key): update
        for update in db.scalars(
            select(WeeklyUpdate).where(
                WeeklyUpdate.sub_task_id.in_([task.id for task in sub_tasks] or [0]),
                WeeklyUpdate.week_key.in_(weeks),
            )
        ).all()
    }
    attachments_by_update: dict[int, list[dict]] = defaultdict(list)
    update_ids = [update.id for update in updates.values()]
    if update_ids:
        for attachment in db.scalars(
            select(Attachment).where(
                Attachment.related_type == "weekly_update",
                Attachment.related_id.in_(update_ids),
            )
        ).all():
            attachments_by_update[attachment.related_id].append(
                {"id": attachment.id, "filename": attachment.filename}
            )
    tree: dict[int, dict] = {}
    for task in sub_tasks:
        department_task = task.department_task
        parent_task = department_task.parent_task
        parent_node = tree.setdefault(
            parent_task.id,
            {"id": parent_task.id, "code": parent_task.code, "title": parent_task.title, "department_tasks": {}},
        )
        department_node = parent_node["department_tasks"].setdefault(
            department_task.id,
            {"id": department_task.id, "code": department_task.code, "title": department_task.title, "sub_tasks": []},
        )
        cells = {}
        for week in weeks:
            update = updates.get((task.id, week))
            cells[week] = {
                "this_week": update.this_week if update else None,
                "risk": update.risk if update else None,
                "attachments": attachments_by_update.get(update.id, []) if update else [],
            }
        department_node["sub_tasks"].append(
            {
                "id": task.id,
                "code": task.code,
                "title": task.title,
                "executor": task.executor.name if task.executor else None,
                "owner": task.owner.name if task.owner else None,
                "status": task.status,
                "started_at": task_start_date(task, earliest_weeks).isoformat(),
                "cells": cells,
            }
        )
    parents = []
    for parent in sorted(tree.values(), key=lambda item: item["code"]):
        parent["department_tasks"] = sorted(parent["department_tasks"].values(), key=lambda item: item["code"])
        for department_task in parent["department_tasks"]:
            department_task["sub_tasks"] = sorted(department_task["sub_tasks"], key=lambda item: item["code"])
        parents.append(parent)
    return {"week_key": current_week_key(), "weeks": weeks, "parents": parents}


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/auth/me")
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user": serialize_user(current_user),
        "permission_codes": sorted(user_permission_codes(current_user)),
        "week_key": current_week_key(),
        "features": feature_payload(db, current_user),
    }


@router.post("/auth/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if user.status not in {"active", "pending"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="账号已停用")
    token = create_session(db, user)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
    )
    db.refresh(user)
    return {
        "user": serialize_user(user),
        "permission_codes": sorted(user_permission_codes(user)),
        "week_key": current_week_key(),
        "features": feature_payload(db, user),
    }


@router.post("/auth/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> dict:
    delete_session(db, session_token)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.post("/auth/openid-login")
def openid_login(payload: OpenIdLoginRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.open_id == payload.open_id))
    if not user:
        user = db.scalar(select(User).where(User.open_id.is_(None), User.name == payload.name))
        if user:
            user.open_id = payload.open_id
            user.open_id_bound_at = datetime.now(timezone.utc)
            user.source = user.source or "manual"
        else:
            user = User(
                name=payload.name,
                open_id=payload.open_id,
                status="pending",
                source="feishu_pending",
                open_id_bound_at=datetime.now(timezone.utc),
            )
            db.add(user)
    if user.status == "disabled":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="账号已停用")
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_session(db, user)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
    )
    return {
        "user": serialize_user(user),
        "permission_codes": sorted(user_permission_codes(user)),
        "week_key": current_week_key(),
        "features": feature_payload(db, user),
    }


def serialize_person(user: User) -> dict:
    item = serialize_user(user) or {}
    item.update(
        {
            "username": user.username,
            "status": user.status,
            "source": user.source,
            "is_admin": user.is_admin,
            "open_id_bound_at": user.open_id_bound_at.isoformat() if user.open_id_bound_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        }
    )
    return item


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> list[dict]:
    return [serialize_user(user) for user in db.scalars(select(User).order_by(User.id)).all()]


@router.get("/user-options")
def list_user_options(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [
        {
            "id": user.id,
            "name": user.name,
            "department": user.department.name if user.department else None,
            "title": user.title,
        }
        for user in db.scalars(select(User).where(User.status != "disabled").order_by(User.name)).all()
    ]


@router.get("/people")
def list_people(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[dict]:
    users = db.scalars(select(User).order_by(User.is_admin.desc(), User.id)).all()
    return [serialize_person(user) for user in users]


@router.post("/people", status_code=201)
def create_person(
    payload: PersonCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    if db.scalar(select(User).where(User.name == payload.name, User.open_id.is_(None))):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="已存在同名未绑定人员")
    user = User(
        name=payload.name,
        department_id=payload.department_id,
        title=payload.title,
        status=payload.status,
        source="manual",
    )
    roles = db.scalars(select(Role).where(Role.id.in_(payload.role_ids))).all() if payload.role_ids else []
    user.roles = list(roles)
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_person(user)


@router.put("/people/{user_id}")
def update_person(
    user_id: int,
    payload: PersonUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    role_ids = data.pop("role_ids", None)
    for key, value in data.items():
        setattr(user, key, value)
    if role_ids is not None:
        user.roles = list(db.scalars(select(Role).where(Role.id.in_(role_ids))).all()) if role_ids else []
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_person(user)


@router.get("/departments")
def list_departments(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    departments = db.scalars(select(Department).order_by(Department.id)).all()
    return [
        {
            "id": item.id,
            "name": item.name,
            "manager_id": item.manager_id,
            "manager": item.manager.name if item.manager else None,
            "status": item.status,
        }
        for item in departments
    ]


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [
        {
            "id": role.id,
            "code": role.code,
            "name": role.name,
            "description": role.description,
            "permission_codes": [permission.code for permission in role.permissions],
        }
        for role in db.scalars(select(Role).order_by(Role.id)).all()
    ]


@router.get("/permissions")
def list_permissions(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    roles = db.scalars(select(Role).order_by(Role.id)).all()
    permissions = db.scalars(select(Permission).order_by(Permission.id)).all()
    return {
        "permissions": [
            {"id": item.id, "code": item.code, "name": item.name, "description": item.description}
            for item in permissions
        ],
        "matrix": [
            {
                "role_id": role.id,
                "role_code": role.code,
                "role_name": role.name,
                "permission_codes": [permission.code for permission in role.permissions],
            }
            for role in roles
        ],
    }


@router.put("/permissions/matrix")
def update_permission_matrix(
    payload: RolePermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    role = db.get(Role, payload.role_id)
    if not role:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Role not found")
    refresh_role_permissions(db, role, payload.permission_codes)
    db.add(
        TaskEvent(
            object_type="role",
            object_id=role.id,
            event_type="permission_matrix_updated",
            title="更新权限矩阵",
            content=",".join(payload.permission_codes),
            actor_id=current_user.id,
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/sync/base-2026/preview")
def preview_base_sync(_: User = Depends(require_admin)) -> dict:
    return preview_base_2026()


@router.post("/sync/base-2026/import")
def import_base_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    return import_base_2026(db, current_user.id)


@router.get("/goals")
def list_goals(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [serialize_goal(goal) for goal in db.scalars(select(StrategicGoal).order_by(StrategicGoal.id))]


@router.get("/goals/{goal_id}/parent-tasks")
def list_goal_parent_tasks(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    goal = db.get(StrategicGoal, goal_id)
    if not goal:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Goal not found")
    tasks = db.scalars(
        select(ParentTask)
        .where(ParentTask.goal_id == goal_id, ParentTask.status != "archived")
        .order_by(ParentTask.code)
    ).all()
    return [
        {**serialize_parent_task(task), "can_edit": can_edit_parent_task(current_user, task)}
        for task in tasks
        if can_access_parent_task(current_user, task)
    ]


@router.post("/goals", status_code=201)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("task.create_parent")),
) -> dict:
    goal = StrategicGoal(
        code=generate_code(db, StrategicGoal, "SG"),
        name=payload.name,
        description=payload.description,
        year=payload.year,
        progress=payload.progress,
    )
    db.add(goal)
    db.flush()
    db.add(
        TaskEvent(
            object_type="strategic_goal",
            object_id=goal.id,
            event_type="created",
            title="创建战略目标",
            content=goal.name,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(goal)
    return serialize_goal(goal)


@router.get("/parent-tasks")
def list_parent_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[dict]:
    if not can_view_parent_task_page(db, current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to parent task management")
    return [
        {**serialize_parent_task(task), "can_edit": can_edit_parent_task(current_user, task)}
        for task in db.scalars(
            select(ParentTask).where(ParentTask.status != "archived").order_by(ParentTask.id)
        ).all()
        if can_access_parent_task(current_user, task)
    ]


@router.get("/parent-tasks/{parent_task_id}/department-tasks")
def list_parent_department_tasks(
    parent_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    parent_task = db.get(ParentTask, parent_task_id)
    if not parent_task or parent_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    if not can_access_parent_task(current_user, parent_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this parent task")
    return [
        serialize_department_task_tree_for_user(db, current_user, task)
        for task in db.scalars(
            select(DepartmentTask)
            .join(ParentTask)
            .where(DepartmentTask.parent_task_id == parent_task_id)
            .where(ParentTask.status != "archived")
            .where(DepartmentTask.status != "archived")
            .order_by(DepartmentTask.code)
        ).all()
        if can_access_department_task(db, current_user, task)
    ]


@router.get("/parent-tasks/{parent_task_id}")
def get_parent_task(
    parent_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    parent_task = db.get(ParentTask, parent_task_id)
    if not parent_task or parent_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    if not can_access_parent_task(current_user, parent_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this parent task")
    return {**serialize_parent_task(parent_task), "can_edit": can_edit_parent_task(current_user, parent_task)}


@router.post("/parent-tasks", status_code=201)
def create_parent_task(
    payload: ParentTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not can_manage_parent_tasks(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No create access to parent tasks")
    task = ParentTask(code=generate_code(db, ParentTask, "MT"), **payload.model_dump())
    db.add(task)
    db.flush()
    db.add(
        TaskEvent(
            object_type="parent_task",
            object_id=task.id,
            event_type="created",
            title="创建母任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return {**serialize_parent_task(task), "can_edit": can_edit_parent_task(current_user, task)}


@router.put("/parent-tasks/{parent_task_id}")
def update_parent_task(
    parent_task_id: int,
    payload: ParentTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = db.get(ParentTask, parent_task_id)
    if not task or task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    if not can_edit_parent_task(current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No edit access to this parent task")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(task, key, value)
    db.add(
        TaskEvent(
            object_type="parent_task",
            object_id=task.id,
            event_type="updated",
            title="编辑母任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return {**serialize_parent_task(task), "can_edit": can_edit_parent_task(current_user, task)}


@router.delete("/parent-tasks/{parent_task_id}")
def archive_parent_task(
    parent_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = db.get(ParentTask, parent_task_id)
    if not task or task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    if not can_manage_parent_tasks(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No delete access to parent tasks")
    task.status = "archived"
    db.add(
        TaskEvent(
            object_type="parent_task",
            object_id=task.id,
            event_type="archived",
            title="归档母任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    return {"ok": True}


@router.get("/department-tasks")
def list_department_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return [
        serialize_department_task_tree_for_user(db, current_user, task)
        for task in db.scalars(
            select(DepartmentTask)
            .join(ParentTask)
            .where(ParentTask.status != "archived", DepartmentTask.status != "archived")
            .order_by(DepartmentTask.id)
        ).all()
        if can_access_department_task(db, current_user, task)
    ]


@router.get("/department-tasks/overview")
def department_tasks_overview(
    department_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    can_switch = can_view_department_directory(current_user)
    all_tasks = [
        task
        for task in db.scalars(
            select(DepartmentTask)
            .join(ParentTask)
            .where(ParentTask.status != "archived", DepartmentTask.status != "archived")
            .order_by(DepartmentTask.code)
        ).all()
        if can_access_department_task(db, current_user, task)
    ]
    visible_department_ids: set[int] = set()
    for task in all_tasks:
        departments = task.departments or ([task.department] if task.department else [])
        visible_department_ids.update(department.id for department in departments)
    if not can_switch and current_user.department_id:
        visible_department_ids = {current_user.department_id}
    selected_department_id = department_id if can_switch and department_id else None
    if not selected_department_id and not can_switch and current_user.department_id:
        selected_department_id = current_user.department_id
    if selected_department_id:
        all_tasks = [
            task
            for task in all_tasks
            if selected_department_id
            in ({department.id for department in task.departments} | {task.department_id})
        ]
    departments = [
        {"id": department.id, "name": department.name}
        for department in db.scalars(select(Department).order_by(Department.name)).all()
        if department.id in visible_department_ids
    ]
    parent_groups = []
    for parent in db.scalars(select(ParentTask).where(ParentTask.status != "archived").order_by(ParentTask.code)).all():
        tasks = [task for task in all_tasks if task.parent_task_id == parent.id]
        if not tasks:
            continue
        sub_tasks = [sub_task for task in tasks for sub_task in task.sub_tasks]
        parent_groups.append(
            {
                **serialize_parent_task(parent),
                "department_task_count": len(tasks),
                "sub_task_count": len(sub_tasks),
                "pending_split_count": sum(task.pending_split_count or 0 for task in tasks),
                "risk_count": len(
                    [
                        sub_task
                        for sub_task in sub_tasks
                        if sub_task.risk_level in {"high", "medium", "low"}
                    ]
                ),
                "department_tasks": [
                    {
                        **serialize_department_task_for_user(db, current_user, task),
                        "sub_tasks": [serialize_sub_task(sub_task) for sub_task in task.sub_tasks],
                    }
                    for task in tasks
                ],
            }
        )
    return {
        "can_switch_department": can_switch,
        "selected_department_id": selected_department_id,
        "departments": departments,
        "department_tasks": [serialize_department_task_tree_for_user(db, current_user, task) for task in all_tasks],
        "parent_tasks": parent_groups,
    }


@router.post("/department-tasks", status_code=201)
def create_department_task(
    payload: DepartmentTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    parent_task = db.get(ParentTask, payload.parent_task_id)
    if not parent_task or parent_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    if not can_create_department_task(current_user, parent_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No create access to department tasks")
    primary_department_id, departments = resolve_departments(db, payload.department_id, payload.department_ids)
    data = payload.model_dump(exclude={"department_ids"})
    data["department_id"] = primary_department_id
    task = DepartmentTask(code=generate_code(db, DepartmentTask, "DT"), **data)
    task.departments = departments
    db.add(task)
    db.flush()
    db.add(
        TaskEvent(
            object_type="department_task",
            object_id=task.id,
            event_type="split",
            title="拆分部门任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_department_task_for_user(db, current_user, task)


@router.put("/department-tasks/{department_task_id}")
def update_department_task(
    department_task_id: int,
    payload: DepartmentTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = db.get(DepartmentTask, department_task_id)
    if not task or task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department task not found")
    if not can_edit_department_task(db, current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No edit access to this department task")
    data = payload.model_dump(exclude_unset=True)
    department_ids = data.pop("department_ids", None)
    if department_ids is not None or "department_id" in data:
        primary_department_id, departments = resolve_departments(db, data.get("department_id"), department_ids)
        data["department_id"] = primary_department_id
        task.departments = departments
    for key, value in data.items():
        setattr(task, key, value)
    db.add(
        TaskEvent(
            object_type="department_task",
            object_id=task.id,
            event_type="updated",
            title="编辑部门任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_department_task_for_user(db, current_user, task)


@router.delete("/department-tasks/{department_task_id}")
def archive_department_task(
    department_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = db.get(DepartmentTask, department_task_id)
    if not task or task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department task not found")
    if not can_edit_department_task(db, current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No delete access to this department task")
    task.status = "archived"
    db.add(
        TaskEvent(
            object_type="department_task",
            object_id=task.id,
            event_type="archived",
            title="归档部门任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    return {"ok": True}


@router.get("/sub-tasks")
def list_sub_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    week = current_week_key()
    updates = {
        update.sub_task_id: update
        for update in db.scalars(select(WeeklyUpdate).where(WeeklyUpdate.week_key == week)).all()
    }
    return [
        serialize_sub_task(task, updates.get(task.id))
        for task in db.scalars(select(SubTask).order_by(SubTask.id)).all()
        if can_access_sub_task(db, current_user, task)
        and task.department_task
        and task.department_task.status != "archived"
        and task.department_task.parent_task
        and task.department_task.parent_task.status != "archived"
    ]


@router.get("/sub-tasks/{sub_task_id}")
def get_sub_task(
    sub_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = db.get(SubTask, sub_task_id)
    if not task or not task.department_task or task.department_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
    update = db.scalar(
        select(WeeklyUpdate).where(
            WeeklyUpdate.sub_task_id == task.id,
            WeeklyUpdate.week_key == current_week_key(),
        )
    )
    return serialize_sub_task(task, update)


@router.post("/sub-tasks", status_code=201)
def create_sub_task(
    payload: SubTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    department_task = db.get(DepartmentTask, payload.department_task_id)
    if not department_task or department_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department task not found")
    if not can_split_sub_task(db, current_user, department_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No split access to this department task")
    data = payload.model_dump()
    data["owner_id"] = data["owner_id"] or department_task.owner_id
    task = SubTask(code=generate_sub_task_code(db, department_task), **data)
    db.add(task)
    if department_task.pending_split_count:
        department_task.pending_split_count = max((department_task.pending_split_count or 0) - 1, 0)
        codes = list(department_task.pending_split_codes or [])
        department_task.pending_split_codes = codes[1:] if codes else []
    db.flush()
    db.add(
        TaskEvent(
            object_type="sub_task",
            object_id=task.id,
            event_type="created",
            title="创建子任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_sub_task(task)


@router.post("/sub-tasks/{sub_task_id}/start")
def start_sub_task(
    sub_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("weekly_update.submit")),
) -> dict:
    task = db.get(SubTask, sub_task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
    if task.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Completed task cannot be restarted")
    if task.status == "pending_update":
        task.status = "in_progress"
        task.started_at = datetime.now(timezone.utc)
        db.add(
            TaskEvent(
                object_type="sub_task",
                object_id=task.id,
                event_type="started",
                title="开启子任务",
                content=task.title,
                actor_id=current_user.id,
            )
        )
        db.commit()
        db.refresh(task)
    return serialize_sub_task(task)


@router.post("/sub-tasks/{sub_task_id}/complete")
def complete_sub_task(
    sub_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("weekly_update.submit")),
) -> dict:
    task = db.get(SubTask, sub_task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
    task.status = "completed"
    task.progress = 100
    db.add(
        TaskEvent(
            object_type="sub_task",
            object_id=task.id,
            event_type="completed",
            title="完成子任务",
            content=task.title,
            actor_id=current_user.id,
        )
    )
    db.commit()
    db.refresh(task)
    return serialize_sub_task(task)


@router.get("/weekly-updates")
def list_weekly_updates(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    stmt = select(WeeklyUpdate).order_by(WeeklyUpdate.id.desc())
    if week_key:
        stmt = stmt.where(WeeklyUpdate.week_key == week_key)
    updates = db.scalars(stmt).all()
    return [
        serialize_weekly_update(update)
        for update in updates
        if can_access_sub_task(db, current_user, update.sub_task)
    ]


@router.get("/weekly-updates/current")
def current_weekly_update(
    sub_task_id: int,
    week_key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    sub_task = db.get(SubTask, sub_task_id)
    if not sub_task or not sub_task.department_task or sub_task.department_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, sub_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
    target_week = week_key or current_week_key()
    update = db.scalar(
        select(WeeklyUpdate).where(
            WeeklyUpdate.sub_task_id == sub_task_id,
            WeeklyUpdate.week_key == target_week,
        )
    )
    if update:
        return serialize_weekly_update(update)
    return {
        "id": None,
        "sub_task_id": sub_task.id,
        "sub_task": sub_task.title,
        "week_key": target_week,
        "status": "empty",
        "progress": sub_task.progress or 0,
        "this_week": None,
        "next_week": None,
        "risk": None,
        "needs_coordination": False,
        "submitter_id": current_user.id,
        "submitter": current_user.name,
        "submitted_at": None,
    }


@router.post("/weekly-updates")
def save_weekly_update(
    payload: WeeklyUpdateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("weekly_update.submit")),
) -> dict:
    sub_task = db.get(SubTask, payload.sub_task_id)
    if not sub_task or not sub_task.department_task or sub_task.department_task.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, sub_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
    if sub_task.status == "pending_update":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Sub task must be started before weekly update")
    if sub_task.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Completed task cannot be updated")
    update = upsert_weekly_update(
        db,
        sub_task=sub_task,
        user=current_user,
        week_key=payload.week_key,
        progress=payload.progress,
        this_week=payload.this_week,
        next_week=payload.next_week,
        risk=payload.risk,
        risk_level=payload.risk_level,
        needs_coordination=payload.needs_coordination,
        submit=payload.submit,
    )
    return serialize_weekly_update(update)


@router.get("/timeline")
def timeline(
    object_type: str | None = None,
    object_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(TaskEvent).order_by(TaskEvent.created_at.desc(), TaskEvent.id.desc())
    if object_type:
        stmt = stmt.where(TaskEvent.object_type == object_type)
    if object_id:
        stmt = stmt.where(TaskEvent.object_id == object_id)
    return [
        {
            "id": item.id,
            "object_type": item.object_type,
            "object_id": item.object_id,
            "event_type": item.event_type,
            "title": item.title,
            "content": item.content,
            "actor": item.actor.name if item.actor else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in db.scalars(stmt).all()
    ]


@router.get("/timeline/matrix")
def timeline_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return build_timeline_matrix_payload(db, current_user)


@router.get("/risks")
def list_risks(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    risks = db.scalars(select(RiskRecord).order_by(RiskRecord.id.desc())).all()
    return [
        {
            "id": item.id,
            "code": item.code,
            "sub_task_id": item.sub_task_id,
            "sub_task": item.sub_task.title if item.sub_task else None,
            "level": item.level,
            "description": item.description,
            "status": item.status,
            "owner": item.sub_task.owner.name if item.sub_task and item.sub_task.owner else None,
            "executor": item.sub_task.executor.name if item.sub_task and item.sub_task.executor else None,
            "due_date": item.sub_task.due_date.isoformat()
            if item.sub_task and item.sub_task.due_date
            else None,
        }
        for item in risks
    ]


@router.get("/meeting-board")
def meeting_board(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    return build_meeting_board(db, week_key or current_week_key())


@router.get("/meeting-board/overview")
def meeting_board_overview(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return build_meeting_overview_payload(db, current_user, week_key or current_week_key())


@router.get("/meeting-board/parent")
def meeting_board_parent(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return build_parent_board_payload(db, current_user, week_key or current_week_key())


@router.get("/meeting-board/department")
def meeting_board_department(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return build_department_board_payload(db, current_user, week_key or current_week_key())


@router.get("/meeting-board/export")
def export_meeting_board(
    week_key: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("meeting.export")),
) -> Response:
    board = build_meeting_board(db, week_key or current_week_key())
    lines = [f"# {board['week_key']} 会议材料", ""]
    for section, title in [
        ("decision_items", "必须决策事项"),
        ("high_risks", "高风险任务"),
        ("missing_updates", "未更新任务"),
        ("completed", "本周完成事项"),
    ]:
        lines.append(f"## {title}")
        for item in board[section]:
            lines.append(f"- {item.get('title')}: {item.get('problem') or item.get('status', '')}")
        lines.append("")
    return Response("\n".join(lines), media_type="text/markdown; charset=utf-8")


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    records = db.scalars(select(NotificationRecord).order_by(NotificationRecord.id.desc())).all()
    return [
        {
            "id": item.id,
            "target_user": item.target_user.name if item.target_user else None,
            "notification_type": item.notification_type,
            "related_type": item.related_type,
            "related_id": item.related_id,
            "title": item.title,
            "web_url": item.web_url,
            "send_status": item.send_status,
            "clicked": item.clicked,
            "result": item.result,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in records
    ]


@router.post("/notifications/mock-reminders")
def mock_reminders(
    payload: MockNotificationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("notification.nudge")),
) -> dict:
    return {"created": create_mock_notifications(db, payload.week_key)}


@router.get("/attachments")
def list_attachments(_: User = Depends(get_current_user)) -> list[dict]:
    return []


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    week_key = current_week_key()
    sub_tasks = list(db.scalars(select(SubTask)).all())
    updates = list(
        db.scalars(select(WeeklyUpdate).where(WeeklyUpdate.week_key == week_key)).all()
    )
    submitted = [item for item in updates if item.status == "submitted"]
    risk_tasks = [item for item in sub_tasks if item.risk_level in {"high", "medium", "low"}]
    overdue = [item for item in sub_tasks if item.due_date and item.due_date < __import__("datetime").date.today() and item.status != "completed"]
    return {
        "week_key": week_key,
        "current_user": serialize_user(current_user),
        "cards": {
            "parent_in_progress": db.scalar(
                select(__import__("sqlalchemy").func.count()).select_from(ParentTask).where(ParentTask.status == "in_progress")
            ),
            "weekly_due": len([item for item in sub_tasks if item.status != "completed"]),
            "risk_tasks": len(risk_tasks),
            "overdue_tasks": len(overdue),
        },
        "weekly_progress": {
            "expected": len([item for item in sub_tasks if item.status != "completed"]),
            "submitted": len(submitted),
            "missing": max(len([item for item in sub_tasks if item.status != "completed"]) - len(submitted), 0),
        },
        "risk_summary": {
            "high": len([item for item in risk_tasks if item.risk_level == "high"]),
            "medium": len([item for item in risk_tasks if item.risk_level == "medium"]),
            "low": len([item for item in risk_tasks if item.risk_level == "low"]),
        },
    }


@router.get("/coordination-items")
def list_coordination_items(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    items = db.scalars(select(CoordinationItem).order_by(CoordinationItem.id.desc())).all()
    return [
        {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "status": item.status,
            "sub_task": item.sub_task.title if item.sub_task else None,
            "owner_id": item.owner_id,
        }
        for item in items
    ]
