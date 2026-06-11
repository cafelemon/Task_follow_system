from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import (
    DepartmentTask,
    ParentTask,
    Permission,
    Role,
    SubTask,
    User,
)
from app.services.auth import current_user_from_cookie

PERMISSIONS: list[tuple[str, str]] = [
    ("task.create_parent", "新建母任务"),
    ("task.split_department", "拆分部门任务"),
    ("task.edit_sub", "编辑子任务"),
    ("weekly_update.submit", "填写周更新"),
    ("dashboard.view_department", "查看部门汇总"),
    ("dashboard.view_all", "查看全公司看板"),
    ("meeting.export", "导出会议材料"),
    ("risk.mark", "风险标记"),
    ("notification.nudge", "催办任务"),
    ("timeline.view", "查看时间线"),
    ("permission.manage", "人员权限配置"),
    ("system.operate", "系统设置"),
]

ROLE_DEFAULTS: dict[str, list[str]] = {
    "admin": [code for code, _ in PERMISSIONS],
    "general_manager": [
        "task.create_parent",
        "task.split_department",
        "dashboard.view_all",
        "meeting.export",
        "risk.mark",
        "notification.nudge",
        "timeline.view",
    ],
    "secretary": [
        "task.create_parent",
        "task.split_department",
        "dashboard.view_all",
        "meeting.export",
        "risk.mark",
        "notification.nudge",
        "timeline.view",
    ],
    "parent_owner": [
        "task.split_department",
        "weekly_update.submit",
        "dashboard.view_department",
        "risk.mark",
        "notification.nudge",
        "timeline.view",
    ],
    "department_owner": [
        "task.split_department",
        "weekly_update.submit",
        "dashboard.view_department",
        "notification.nudge",
        "timeline.view",
    ],
    "task_owner": ["task.edit_sub", "weekly_update.submit", "risk.mark", "timeline.view"],
    "executor": ["weekly_update.submit", "timeline.view"],
    "observer": ["dashboard.view_department", "dashboard.view_all", "timeline.view"],
    "it_maintainer": ["permission.manage", "system.operate", "timeline.view"],
}


def get_current_user(current_user: User = Depends(current_user_from_cookie)) -> User:
    return current_user


def user_permission_codes(user: User) -> set[str]:
    return {permission.code for role in user.roles for permission in role.permissions}


def user_role_codes(user: User) -> set[str]:
    return {role.code for role in user.roles}


def _related_user_ids(users: list[User] | None, fallback_id: int | None = None) -> set[int]:
    ids = {item.id for item in users or []}
    if not ids and fallback_id:
        ids.add(fallback_id)
    return ids


def task_owner_ids(task: ParentTask | DepartmentTask | SubTask) -> set[int]:
    return _related_user_ids(getattr(task, "owners", None), getattr(task, "owner_id", None))


def sub_task_executor_ids(task: SubTask) -> set[int]:
    return _related_user_ids(task.executors, task.executor_id)


def is_department_owner(user: User) -> bool:
    return bool(user.department_id and "department_owner" in user_role_codes(user))


def department_task_department_ids(task: DepartmentTask) -> set[int]:
    ids = {department.id for department in task.departments or []}
    if task.department_id:
        ids.add(task.department_id)
    return ids


def department_owner_leads_parent(user: User, task: ParentTask) -> bool:
    return bool(is_department_owner(user) and user.department_id == task.department_id)


def department_owner_manages_task(user: User, task: DepartmentTask) -> bool:
    if not is_department_owner(user):
        return False
    if user.department_id in department_task_department_ids(task):
        return True
    return bool(task.parent_task and user.department_id == task.parent_task.department_id)


def can_view_department_directory(user: User) -> bool:
    roles = user_role_codes(user)
    return user.is_admin or "permission.manage" in user_permission_codes(user) or "general_manager" in roles


def has_full_parent_task_access(user: User) -> bool:
    roles = user_role_codes(user)
    return (
        user.is_admin
        or "permission.manage" in user_permission_codes(user)
        or bool({"general_manager", "secretary", "observer"} & roles)
    )


def can_manage_parent_tasks(user: User) -> bool:
    roles = user_role_codes(user)
    return (
        user.is_admin
        or "permission.manage" in user_permission_codes(user)
        or bool({"general_manager", "secretary"} & roles)
    )


def can_access_parent_task(user: User, task: ParentTask) -> bool:
    if task.status == "archived":
        return False
    if has_full_parent_task_access(user):
        return True
    return user.id in task_owner_ids(task) or department_owner_leads_parent(user, task)


def can_edit_parent_task(user: User, task: ParentTask) -> bool:
    if task.status == "archived":
        return False
    if can_manage_parent_tasks(user):
        return True
    return user.id in task_owner_ids(task)


def can_create_department_task(user: User, parent_task: ParentTask) -> bool:
    if parent_task.status == "archived":
        return False
    return (
        can_manage_parent_tasks(user)
        or user.id in task_owner_ids(parent_task)
        or department_owner_leads_parent(user, parent_task)
    )


def can_edit_department_task(db: Session, user: User, task: DepartmentTask) -> bool:
    if task.status == "archived":
        return False
    parent_task = db.get(ParentTask, task.parent_task_id)
    if not parent_task or parent_task.status == "archived":
        return False
    return (
        can_manage_parent_tasks(user)
        or user.id in task_owner_ids(parent_task)
        or department_owner_manages_task(user, task)
    )


def can_split_sub_task(db: Session, user: User, task: DepartmentTask) -> bool:
    if task.status == "archived":
        return False
    parent_task = db.get(ParentTask, task.parent_task_id)
    if not parent_task or parent_task.status == "archived":
        return False
    return user.id in task_owner_ids(task)


def can_view_parent_task_page(db: Session, user: User) -> bool:
    if has_full_parent_task_access(user):
        return True
    return any(
        user.id in task_owner_ids(task) or department_owner_leads_parent(user, task)
        for task in db.scalars(select(ParentTask).where(ParentTask.status != "archived")).all()
    )


def require_permission(code: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if code not in user_permission_codes(current_user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {code}")
        return current_user

    return dependency


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin and "permission.manage" not in user_permission_codes(current_user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Admin permission required")
    return current_user


def can_access_sub_task(db: Session, user: User, sub_task: SubTask) -> bool:
    codes = user_permission_codes(user)
    if "dashboard.view_all" in codes or "permission.manage" in codes:
        return True
    if user.id in sub_task_executor_ids(sub_task) or user.id in task_owner_ids(sub_task):
        return True
    department_task = db.get(DepartmentTask, sub_task.department_task_id)
    if department_task and department_task.status == "archived":
        return False
    if department_task and user.id in task_owner_ids(department_task):
        return True
    if department_task:
        parent_task = db.get(ParentTask, department_task.parent_task_id)
        if parent_task and user.id in task_owner_ids(parent_task):
            return True
        if department_owner_manages_task(user, department_task):
            return True
    return False


def can_manage_sub_task_updates(user: User) -> bool:
    return user.is_admin or "permission.manage" in user_permission_codes(user)


def sub_task_execution_relation(user: User, sub_task: SubTask) -> str | None:
    is_executor = user.id in sub_task_executor_ids(sub_task)
    is_owner = user.id in task_owner_ids(sub_task)
    if is_executor and is_owner:
        return "both"
    if is_executor:
        return "executor"
    if is_owner:
        return "owner"
    codes = user_permission_codes(user)
    if user.is_admin or "dashboard.view_all" in codes or "permission.manage" in codes:
        return "management"
    return None


def can_view_sub_task_execution_entry(user: User, sub_task: SubTask) -> bool:
    return sub_task_execution_relation(user, sub_task) is not None


def can_update_sub_task_weekly(user: User, sub_task: SubTask, assignee_id: int | None = None) -> bool:
    if can_manage_sub_task_updates(user):
        return True
    target_id = assignee_id or user.id
    return target_id == user.id and user.id in sub_task_executor_ids(sub_task)


def can_access_department_task(db: Session, user: User, task: DepartmentTask) -> bool:
    if task.status == "archived":
        return False
    codes = user_permission_codes(user)
    if "dashboard.view_all" in codes or "permission.manage" in codes:
        return True
    if user.id in task_owner_ids(task):
        return True
    parent_task = db.get(ParentTask, task.parent_task_id)
    if parent_task and user.id in task_owner_ids(parent_task):
        return True
    return department_owner_manages_task(user, task)


def refresh_role_permissions(db: Session, role: Role, permission_codes: list[str]) -> Role:
    permissions = list(db.scalars(select(Permission).where(Permission.code.in_(permission_codes))).all())
    role.permissions = permissions
    db.add(role)
    db.flush()
    return role
