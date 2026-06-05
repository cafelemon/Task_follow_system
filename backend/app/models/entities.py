from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")

    manager: Mapped["User | None"] = relationship(foreign_keys=[manager_id])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    open_id: Mapped[str | None] = mapped_column(String(120), unique=True)
    username: Mapped[str | None] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(260))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    title: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="active")
    source: Mapped[str] = mapped_column(String(32), default="manual")
    open_id_bound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    department: Mapped[Department | None] = relationship(foreign_keys=[department_id])
    roles: Mapped[list["Role"]] = relationship(secondary="user_roles", back_populates="users")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    users: Mapped[list[User]] = relationship(secondary="user_roles", back_populates="roles")
    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permissions", back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    roles: Mapped[list[Role]] = relationship(secondary="role_permissions", back_populates="permissions")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class DepartmentTaskDepartment(Base):
    __tablename__ = "department_task_departments"

    department_task_id: Mapped[int] = mapped_column(ForeignKey("department_tasks.id"), primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), primary_key=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship()


class StrategicGoal(Base):
    __tablename__ = "strategic_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="active")


class ParentTask(Base):
    __tablename__ = "parent_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text)
    goal_id: Mapped[int] = mapped_column(ForeignKey("strategic_goals.id"))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    priority: Mapped[str] = mapped_column(String(32), default="normal")
    status: Mapped[str] = mapped_column(String(32), default="in_progress")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    goal: Mapped[StrategicGoal] = relationship()
    department: Mapped[Department] = relationship()
    owner: Mapped[User] = relationship()
    department_tasks: Mapped[list["DepartmentTask"]] = relationship(back_populates="parent_task")


class DepartmentTask(Base):
    __tablename__ = "department_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(240))
    parent_task_id: Mapped[int] = mapped_column(ForeignKey("parent_tasks.id"))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="in_progress")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date | None] = mapped_column(Date)
    pending_split_count: Mapped[int] = mapped_column(Integer, default=0)
    pending_split_codes: Mapped[list[str] | None] = mapped_column(JSONB)

    parent_task: Mapped[ParentTask] = relationship(back_populates="department_tasks")
    department: Mapped[Department] = relationship()
    departments: Mapped[list[Department]] = relationship(secondary="department_task_departments")
    owner: Mapped[User] = relationship()
    sub_tasks: Mapped[list["SubTask"]] = relationship(back_populates="department_task")


class SubTask(Base):
    __tablename__ = "sub_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(240))
    department_task_id: Mapped[int] = mapped_column(ForeignKey("department_tasks.id"))
    executor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(32), default="pending_update")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(32), default="none")
    due_date: Mapped[date | None] = mapped_column(Date)

    department_task: Mapped[DepartmentTask] = relationship(back_populates="sub_tasks")
    executor: Mapped[User] = relationship(foreign_keys=[executor_id])
    owner: Mapped[User] = relationship(foreign_keys=[owner_id])


class WeeklyUpdate(Base):
    __tablename__ = "weekly_updates"
    __table_args__ = (UniqueConstraint("sub_task_id", "week_key", name="uq_weekly_update_subtask_week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    sub_task_id: Mapped[int] = mapped_column(ForeignKey("sub_tasks.id"))
    week_key: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    this_week: Mapped[str | None] = mapped_column(Text)
    next_week: Mapped[str | None] = mapped_column(Text)
    risk: Mapped[str | None] = mapped_column(Text)
    needs_coordination: Mapped[bool] = mapped_column(Boolean, default=False)
    submitter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sub_task: Mapped[SubTask] = relationship()
    submitter: Mapped[User] = relationship()


class WeeklyUpdateRevision(Base):
    __tablename__ = "weekly_update_revisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    weekly_update_id: Mapped[int] = mapped_column(ForeignKey("weekly_updates.id"))
    editor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    snapshot: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TaskEvent(Base):
    __tablename__ = "task_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    object_type: Mapped[str] = mapped_column(String(60))
    object_id: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(240))
    content: Mapped[str | None] = mapped_column(Text)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    actor: Mapped[User | None] = relationship()


class RiskRecord(Base):
    __tablename__ = "risk_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True)
    sub_task_id: Mapped[int] = mapped_column(ForeignKey("sub_tasks.id"))
    level: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sub_task: Mapped[SubTask] = relationship()


class CoordinationItem(Base):
    __tablename__ = "coordination_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sub_task_id: Mapped[int] = mapped_column(ForeignKey("sub_tasks.id"))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="open")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sub_task: Mapped[SubTask] = relationship()


class NotificationRecord(Base):
    __tablename__ = "notification_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notification_type: Mapped[str] = mapped_column(String(80))
    related_type: Mapped[str | None] = mapped_column(String(60))
    related_id: Mapped[int | None] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(240))
    web_url: Mapped[str | None] = mapped_column(String(500))
    send_status: Mapped[str] = mapped_column(String(32), default="mock_sent")
    clicked: Mapped[bool] = mapped_column(Boolean, default=False)
    result: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    target_user: Mapped[User] = relationship()


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(240))
    storage_path: Mapped[str] = mapped_column(String(500))
    related_type: Mapped[str] = mapped_column(String(60))
    related_id: Mapped[int] = mapped_column(Integer)
    uploader_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BaseSyncRun(Base):
    __tablename__ = "base_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(160), default="2026任务跟踪表")
    base_token: Mapped[str | None] = mapped_column(String(160))
    table_name: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text)
    raw_summary: Mapped[dict | None] = mapped_column(JSONB)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
