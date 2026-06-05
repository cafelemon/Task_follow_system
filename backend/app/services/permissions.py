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
        "task.edit_sub",
        "weekly_update.submit",
        "dashboard.view_department",
        "risk.mark",
        "notification.nudge",
        "timeline.view",
    ],
    "department_owner": [
        "task.edit_sub",
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
    if sub_task.executor_id == user.id or sub_task.owner_id == user.id:
        return True
    department_task = db.get(DepartmentTask, sub_task.department_task_id)
    if department_task and department_task.owner_id == user.id:
        return True
    if department_task:
        parent_task = db.get(ParentTask, department_task.parent_task_id)
        if parent_task and parent_task.owner_id == user.id:
            return True
    if "dashboard.view_department" in codes and user.department_id:
        return bool(department_task and department_task.department_id == user.department_id)
    return False


def refresh_role_permissions(db: Session, role: Role, permission_codes: list[str]) -> Role:
    permissions = list(db.scalars(select(Permission).where(Permission.code.in_(permission_codes))).all())
    role.permissions = permissions
    db.add(role)
    db.flush()
    return role
