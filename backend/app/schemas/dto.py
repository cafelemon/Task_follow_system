from datetime import date

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    name: str
    description: str | None = None
    year: int = 2026
    progress: int = Field(default=0, ge=0, le=100)


class ParentTaskCreate(BaseModel):
    title: str
    description: str | None = None
    goal_id: int
    department_id: int
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    priority: str = "normal"
    due_date: date | None = None


class ParentTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    goal_id: int | None = None
    department_id: int | None = None
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    priority: str | None = None
    due_date: date | None = None


class DepartmentTaskCreate(BaseModel):
    title: str
    parent_task_id: int
    department_id: int
    department_ids: list[int] | None = None
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    due_date: date | None = None


class DepartmentTaskUpdate(BaseModel):
    title: str | None = None
    department_id: int | None = None
    department_ids: list[int] | None = None
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    due_date: date | None = None


class SubTaskCreate(BaseModel):
    title: str
    department_task_id: int
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    executor_id: int | None = None
    executor_ids: list[int] | None = None
    due_date: date | None = None


class SubTaskUpdate(BaseModel):
    title: str | None = None
    owner_id: int | None = None
    owner_ids: list[int] | None = None
    executor_id: int | None = None
    executor_ids: list[int] | None = None
    due_date: date | None = None


class WeeklyUpdateUpsert(BaseModel):
    sub_task_id: int
    assignee_id: int | None = None
    week_key: str
    progress: int | None = Field(default=None, ge=0, le=100)
    this_week: str | None = None
    next_week: str | None = None
    risk: str | None = None
    risk_level: str | None = None
    needs_coordination: bool = False
    submit: bool = False


class RolePermissionUpdate(BaseModel):
    role_id: int
    permission_codes: list[str]


class MockNotificationRequest(BaseModel):
    week_key: str


class LarkTestMessageRequest(BaseModel):
    target_user_id: int


class LoginRequest(BaseModel):
    username: str
    password: str


class OpenIdLoginRequest(BaseModel):
    open_id: str
    name: str


class PersonCreate(BaseModel):
    name: str
    department_id: int | None = None
    role_ids: list[int] = []
    title: str | None = None
    status: str = "active"
    open_id: str | None = None
    email: str | None = None


class PersonUpdate(BaseModel):
    name: str | None = None
    department_id: int | None = None
    role_ids: list[int] | None = None
    title: str | None = None
    status: str | None = None
    open_id: str | None = None
    email: str | None = None
