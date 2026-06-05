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
