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
    owner_id: int
    priority: str = "normal"
    due_date: date | None = None


class DepartmentTaskCreate(BaseModel):
    title: str
    parent_task_id: int
    department_id: int
    owner_id: int
    due_date: date | None = None


class SubTaskCreate(BaseModel):
    title: str
    department_task_id: int
    owner_id: int
    executor_id: int
    due_date: date | None = None


class WeeklyUpdateUpsert(BaseModel):
    sub_task_id: int
    week_key: str
    progress: int = Field(ge=0, le=100)
    this_week: str | None = None
    next_week: str | None = None
    risk: str | None = None
    risk_level: str = "none"
    needs_coordination: bool = False
    submit: bool = False


class RolePermissionUpdate(BaseModel):
    role_id: int
    permission_codes: list[str]


class MockNotificationRequest(BaseModel):
    week_key: str


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


class PersonUpdate(BaseModel):
    name: str | None = None
    department_id: int | None = None
    role_ids: list[int] | None = None
    title: str | None = None
    status: str | None = None
