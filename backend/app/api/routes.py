from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import __version__
from app.db.session import get_db
from app.models.entities import (
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
    GoalCreate,
    LoginRequest,
    MockNotificationRequest,
    OpenIdLoginRequest,
    ParentTaskCreate,
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
    serialize_goal,
    serialize_parent_task,
    serialize_sub_task,
    serialize_user,
    serialize_weekly_update,
    upsert_weekly_update,
)
from app.services.permissions import (
    can_access_sub_task,
    get_current_user,
    refresh_role_permissions,
    require_admin,
    require_permission,
    user_permission_codes,
)
from app.services.auth import SESSION_COOKIE, SESSION_DAYS, create_session, delete_session, verify_password
from app.services.lark_sync import import_base_2026, preview_base_2026

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/auth/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return {
        "user": serialize_user(current_user),
        "permission_codes": sorted(user_permission_codes(current_user)),
        "week_key": current_week_key(),
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
def list_parent_tasks(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [
        serialize_parent_task(task)
        for task in db.scalars(select(ParentTask).order_by(ParentTask.id)).all()
    ]


@router.post("/parent-tasks", status_code=201)
def create_parent_task(
    payload: ParentTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("task.create_parent")),
) -> dict:
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
    return serialize_parent_task(task)


@router.get("/department-tasks")
def list_department_tasks(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [
        serialize_department_task(task)
        for task in db.scalars(select(DepartmentTask).order_by(DepartmentTask.id)).all()
    ]


@router.post("/department-tasks", status_code=201)
def create_department_task(
    payload: DepartmentTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("task.split_department")),
) -> dict:
    parent_task = db.get(ParentTask, payload.parent_task_id)
    if not parent_task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parent task not found")
    task = DepartmentTask(code=generate_code(db, DepartmentTask, "DT"), **payload.model_dump())
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
    return serialize_department_task(task)


@router.get("/sub-tasks")
def list_sub_tasks(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    return [serialize_sub_task(task) for task in db.scalars(select(SubTask).order_by(SubTask.id)).all()]


@router.post("/sub-tasks", status_code=201)
def create_sub_task(
    payload: SubTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("task.edit_sub")),
) -> dict:
    department_task = db.get(DepartmentTask, payload.department_task_id)
    if not department_task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Department task not found")
    task = SubTask(code=generate_code(db, SubTask, "ST"), **payload.model_dump())
    db.add(task)
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


@router.post("/weekly-updates")
def save_weekly_update(
    payload: WeeklyUpdateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("weekly_update.submit")),
) -> dict:
    sub_task = db.get(SubTask, payload.sub_task_id)
    if not sub_task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sub task not found")
    if not can_access_sub_task(db, current_user, sub_task):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="No access to this sub task")
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
