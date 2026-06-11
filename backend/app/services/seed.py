from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import (
    Attachment,
    AuthSession,
    BaseSyncRun,
    CoordinationItem,
    Department,
    DepartmentTask,
    DepartmentTaskDepartment,
    NotificationRecord,
    ParentTask,
    Permission,
    RiskRecord,
    RiskItem,
    Role,
    StrategicGoal,
    SubTask,
    TaskEvent,
    User,
    UserRole,
    WeeklyUpdate,
    WeeklyUpdateRevision,
)
from app.services.auth import hash_password
from app.services.permissions import PERMISSIONS, ROLE_DEFAULTS, refresh_role_permissions

BASE_DEPARTMENTS = ["研发中心", "数字与信息中心", "质量体系部", "信息中心"]

ROLE_DEFINITIONS = [
    ("admin", "系统管理员", "系统全局配置与用户管理"),
    ("general_manager", "总经理", "跨部门查看与管理公司任务推进"),
    ("secretary", "总经办/秘书", "全局监控与会议材料导出"),
    ("parent_owner", "母任务负责人", "母任务全生命周期管理"),
    ("department_owner", "部门负责人", "部门任务承接与进度跟踪"),
    ("task_owner", "任务负责人", "子任务执行与周更新跟进"),
    ("executor", "子任务执行人", "具体任务执行与进度汇报"),
    ("observer", "观察角色", "只读权限，查看任务进度"),
    ("it_maintainer", "信息中心维护人员", "系统运维与数据备份"),
]


def configured_admin_password_hash() -> str | None:
    if settings.admin_password_hash:
        return settings.admin_password_hash
    if settings.admin_password:
        return hash_password(settings.admin_password)
    return None


def clear_business_data(db: Session, *, include_sync_runs: bool = True) -> None:
    models = [
        Attachment,
        NotificationRecord,
        CoordinationItem,
        RiskItem,
        RiskRecord,
        TaskEvent,
        WeeklyUpdateRevision,
        WeeklyUpdate,
        SubTask,
        DepartmentTaskDepartment,
        DepartmentTask,
        ParentTask,
        StrategicGoal,
    ]
    if include_sync_runs:
        models.append(BaseSyncRun)
    for model in models:
        db.execute(delete(model))
    non_admin_user_ids = select(User.id).where(User.is_admin.is_(False))
    db.execute(delete(AuthSession).where(AuthSession.user_id.in_(non_admin_user_ids)))
    db.execute(delete(UserRole).where(UserRole.user_id.in_(non_admin_user_ids)))
    db.execute(
        update(Department)
        .where(Department.manager_id.in_(non_admin_user_ids))
        .values(manager_id=None)
    )
    db.execute(delete(User).where(User.is_admin.is_(False)))
    db.commit()


def seed_demo_data(db: Session) -> None:
    if not settings.seed_demo_data:
        return

    departments: dict[str, Department] = {}
    for name in BASE_DEPARTMENTS:
        department = db.scalar(select(Department).where(Department.name == name))
        if not department:
            department = Department(name=name)
            db.add(department)
            db.flush()
        departments[name] = department

    roles: dict[str, Role] = {}
    for code, name, description in ROLE_DEFINITIONS:
        role = db.scalar(select(Role).where(Role.code == code))
        if not role:
            role = Role(code=code, name=name, description=description)
            db.add(role)
            db.flush()
        else:
            role.name = name
            role.description = description
        roles[code] = role

    for code, name in PERMISSIONS:
        permission = db.scalar(select(Permission).where(Permission.code == code))
        if not permission:
            db.add(Permission(code=code, name=name))
        else:
            permission.name = name
    db.flush()

    for role_code, permission_codes in ROLE_DEFAULTS.items():
        refresh_role_permissions(db, roles[role_code], permission_codes)

    admin_password_hash = configured_admin_password_hash()
    admin = db.scalar(select(User).where(User.username == settings.admin_username))
    if not admin:
        if not admin_password_hash:
            raise RuntimeError(
                "TASK_FOLLOW_ADMIN_PASSWORD or TASK_FOLLOW_ADMIN_PASSWORD_HASH is required "
                "when creating the initial administrator."
            )
        admin = User(
            username=settings.admin_username,
            password_hash=admin_password_hash,
            is_admin=True,
            name=settings.admin_name,
            department=departments["信息中心"],
            title="系统管理员",
            source="system",
            status="active",
        )
        db.add(admin)
        db.flush()
    else:
        if admin_password_hash:
            admin.password_hash = admin_password_hash
        admin.is_admin = True
        admin.name = settings.admin_name
        admin.department = departments["信息中心"]
        admin.title = "系统管理员"
        admin.source = "system"
        admin.status = "active"
    admin.roles = [roles["admin"], roles["it_maintainer"]]
    departments["信息中心"].manager_id = admin.id
    db.execute(delete(AuthSession))
    db.commit()
