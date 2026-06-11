import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.entities import (
    Attachment,
    BaseSyncRun,
    CoordinationItem,
    DepartmentTask,
    DepartmentTaskOwner,
    RiskRecord,
    Role,
    SubTask,
    SubTaskExecutor,
    SubTaskOwner,
    TaskEvent,
    User,
    UserRole,
    WeeklyUpdate,
    WeeklyUpdateRevision,
)
from app.services.business import executor_people, generate_code, owner_people
from app.services.local_excel_import import parse_date, parse_status

REPO_ROOT = Path(__file__).resolve().parents[3]
CONTAINER_SOURCE_ROOT = Path("/data/base_download")


def default_source_path(filename: str) -> Path:
    container_path = CONTAINER_SOURCE_ROOT / filename
    return container_path if container_path.exists() else REPO_ROOT / filename


DEFAULT_DEPARTMENT_CSV = default_source_path("2026公司工作任务跟踪表_02_部门任务_总表格.csv")
DEFAULT_SUB_TASK_CSV = default_source_path("2026公司工作任务跟踪表_03_部门拆解任务_子任务拆分表格.csv")
DEFAULT_WEEKLY_CSV = default_source_path("2026公司工作任务跟踪表_04_周更新进度_表格.csv")
W23_KEY = "2026-W23"
W24_KEY = "2026-W24"
BLANK_VALUES = {"", "/", "无", "暂无", "无。", "暂无。", "无遗留事项", "无遗留事项。"}


@dataclass
class SourceSubTask:
    task_code: str
    source_sub_code: str
    title: str
    owners: list[str]
    executors: list[str]
    due_date: Any
    status: str
    risk: str
    this_week: str
    next_week: str
    prev_week: str


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def meaningful_text(value: Any) -> str:
    text = clean_text(value)
    return "" if text in BLANK_VALUES else text


def normalize_title(value: str) -> str:
    return re.sub(r"\s+", " ", clean_text(value))


def split_people(value: Any) -> list[str]:
    raw = clean_text(value)
    items = [item.strip() for item in re.split(r"[\n,，、;；]+", raw) if item.strip()]
    return list(dict.fromkeys(items))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def task_code_from_weekly_row(row: dict[str, str]) -> str:
    task_item = clean_text(row.get("任务项"))
    match = re.match(r"(T-\d{3}-\d{2})\b", task_item)
    return match.group(1) if match else ""


def role_by_code(db: Session, code: str) -> Role | None:
    return db.scalar(select(Role).where(Role.code == code))


def add_roles(db: Session, user: User, role_codes: list[str]) -> bool:
    changed = False
    existing = set(
        db.scalars(
            select(Role.code)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user.id)
        ).all()
    )
    for code in role_codes:
        if code in existing:
            continue
        role = role_by_code(db, code)
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))
            existing.add(code)
            changed = True
    return changed


def resolve_user(
    db: Session,
    name: str,
    department_task: DepartmentTask | None,
    summary: dict[str, Any],
) -> User:
    matches = list(db.scalars(select(User).where(User.name == name)).all())
    if len(matches) > 1:
        raise RuntimeError(f"人员姓名重复，无法安全匹配：{name}")
    if matches:
        return matches[0]
    user = User(
        name=name,
        department=department_task.department if department_task else None,
        status="pending",
        source="csv_alignment_2_1_0",
    )
    db.add(user)
    db.flush()
    summary["users_created"] += 1
    summary["created_users"].append(name)
    return user


def resolve_people(
    db: Session,
    names: list[str],
    department_task: DepartmentTask | None,
    summary: dict[str, Any],
) -> list[User]:
    return [resolve_user(db, name, department_task, summary) for name in names]


def sync_department_task_owners(db: Session, task: DepartmentTask, users: list[User]) -> bool:
    current = {user.id for user in owner_people(task)}
    desired = [user.id for user in users]
    if task.owner_id == desired[0] and current == set(desired):
        return False
    task.owner_id = users[0].id
    db.execute(delete(DepartmentTaskOwner).where(DepartmentTaskOwner.department_task_id == task.id))
    db.add_all(DepartmentTaskOwner(department_task_id=task.id, user_id=user.id) for user in users)
    db.flush()
    return True


def sync_sub_task_owners(db: Session, task: SubTask, users: list[User]) -> bool:
    current = {user.id for user in owner_people(task)}
    desired = [user.id for user in users]
    if task.owner_id == desired[0] and current == set(desired):
        return False
    task.owner_id = users[0].id
    db.execute(delete(SubTaskOwner).where(SubTaskOwner.sub_task_id == task.id))
    db.add_all(SubTaskOwner(sub_task_id=task.id, user_id=user.id) for user in users)
    db.flush()
    return True


def sync_inherited_sub_task_owners(db: Session, task: DepartmentTask, users: list[User]) -> int:
    changed = 0
    for sub_task in task.sub_tasks:
        if sub_task.status != "archived" and sync_sub_task_owners(db, sub_task, users):
            changed += 1
    return changed


def sync_sub_task_executors(db: Session, task: SubTask, users: list[User]) -> bool:
    current = {user.id for user in executor_people(task)}
    desired = [user.id for user in users]
    if task.executor_id == desired[0] and current == set(desired):
        return False
    task.executor_id = users[0].id
    db.execute(delete(SubTaskExecutor).where(SubTaskExecutor.sub_task_id == task.id))
    db.add_all(SubTaskExecutor(sub_task_id=task.id, user_id=user.id) for user in users)
    db.flush()
    return True


def add_event(
    db: Session,
    *,
    object_type: str,
    object_id: int,
    event_type: str,
    title: str,
    actor_id: int | None,
    content: str | None,
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


def generate_sub_task_code(db: Session, department_task: DepartmentTask) -> str:
    prefix = f"{department_task.code}-"
    existing = {
        code
        for code in db.scalars(select(SubTask.code).where(SubTask.code.like(f"{prefix}%"))).all()
        if code
    }
    index = 1
    while True:
        code = f"{prefix}{index:02d}"
        if code not in existing:
            return code
        index += 1


def progress_for_source_status(status: str) -> int | None:
    return 100 if status == "completed" else None


def upsert_weekly(
    db: Session,
    *,
    sub_task: SubTask,
    assignee: User,
    submitter: User,
    week_key: str,
    this_week: str,
    next_week: str,
    risk: str,
    summary: dict[str, Any],
) -> bool:
    if not any([this_week, next_week, risk]):
        return False
    update = db.scalar(
        select(WeeklyUpdate).where(
            WeeklyUpdate.sub_task_id == sub_task.id,
            WeeklyUpdate.assignee_id == assignee.id,
            WeeklyUpdate.week_key == week_key,
        )
    )
    created = update is None
    if update is None:
        update = WeeklyUpdate(
            sub_task_id=sub_task.id,
            assignee_id=assignee.id,
            week_key=week_key,
            submitter_id=submitter.id,
            progress=sub_task.progress or 0,
        )
        db.add(update)
        snapshot = None
    else:
        snapshot = {
            "status": update.status,
            "progress": update.progress,
            "this_week": update.this_week,
            "next_week": update.next_week,
            "risk": update.risk,
            "risk_level": update.risk_level,
            "needs_coordination": update.needs_coordination,
            "submitted_at": update.submitted_at.isoformat() if update.submitted_at else None,
        }

    changed = created
    if this_week and update.this_week != this_week:
        update.this_week = this_week
        changed = True
    if next_week and update.next_week != next_week:
        update.next_week = next_week
        changed = True
    if risk and update.risk != risk:
        update.risk = risk
        changed = True
    if update.status != "submitted":
        update.status = "submitted"
        changed = True
    if changed:
        if snapshot is not None:
            db.add(
                WeeklyUpdateRevision(
                    weekly_update_id=update.id,
                    editor_id=submitter.id,
                    snapshot=snapshot,
                )
            )
        update.submitter_id = submitter.id
        update.submitted_at = datetime.now(timezone.utc)
        progress = progress_for_source_status(sub_task.status)
        if progress is not None:
            update.progress = progress
        summary["weekly_updates_upserted"][week_key] += 1
        add_event(
            db,
            object_type="sub_task",
            object_id=sub_task.id,
            event_type="csv_alignment_weekly_upserted",
            title="2.1.0 同步周更新",
            actor_id=submitter.id,
            content=f"{week_key} / {assignee.name}",
        )
    return changed


def cleanup_obvious_test_sub_tasks(db: Session, actor: User | None, summary: dict[str, Any]) -> None:
    tasks = list(
        db.scalars(
            select(SubTask).where(
                SubTask.title.like("__codex_tmp_%"),
            )
        ).all()
    )
    for task in tasks:
        db.execute(delete(Attachment).where(Attachment.related_type == "sub_task", Attachment.related_id == task.id))
        db.execute(delete(CoordinationItem).where(CoordinationItem.sub_task_id == task.id))
        db.execute(delete(RiskRecord).where(RiskRecord.sub_task_id == task.id))
        db.execute(delete(WeeklyUpdateRevision).where(WeeklyUpdateRevision.weekly_update_id.in_(
            select(WeeklyUpdate.id).where(WeeklyUpdate.sub_task_id == task.id)
        )))
        db.execute(delete(WeeklyUpdate).where(WeeklyUpdate.sub_task_id == task.id))
        db.execute(delete(SubTaskExecutor).where(SubTaskExecutor.sub_task_id == task.id))
        db.execute(delete(SubTaskOwner).where(SubTaskOwner.sub_task_id == task.id))
        db.execute(delete(TaskEvent).where(TaskEvent.object_type == "sub_task", TaskEvent.object_id == task.id))
        db.delete(task)
        summary["test_sub_tasks_removed"] += 1
        summary["removed_test_sub_tasks"].append(task.code)
        if actor:
            add_event(
                db,
                object_type="sub_task",
                object_id=task.id,
                event_type="csv_alignment_test_removed",
                title="2.1.0 清理测试子任务",
                actor_id=actor.id,
                content=task.code,
            )


def source_sub_tasks(sub_task_rows: list[dict[str, str]], weekly_rows: list[dict[str, str]]) -> list[SourceSubTask]:
    weekly_prev: dict[tuple[str, str, str], str] = {}
    for row in weekly_rows:
        task_code = task_code_from_weekly_row(row)
        sub_code = clean_text(row.get("子任务编号"))
        title = normalize_title(clean_text(row.get("具体任务")))
        previous = meaningful_text(row.get("上周任务进度（自动更新）"))
        if task_code and sub_code and title and previous:
            weekly_prev[(task_code, sub_code, title)] = previous

    result: list[SourceSubTask] = []
    for row in sub_task_rows:
        task_code = clean_text(row.get("任务编号"))
        source_sub_code = clean_text(row.get("子任务编号"))
        title = clean_text(row.get("具体任务"))
        if not source_sub_code or not title:
            continue
        owners = split_people(row.get("任务负责人（负责拆解任务到执行者）"))
        executors = split_people(row.get("执行责任人 (人员 )"))
        prev_week = meaningful_text(row.get("上周任务进度"))
        prev_week = prev_week or weekly_prev.get((task_code, source_sub_code, normalize_title(title)), "")
        result.append(
            SourceSubTask(
                task_code=task_code,
                source_sub_code=source_sub_code,
                title=title,
                owners=owners,
                executors=executors,
                due_date=parse_date(row.get("截止时间")),
                status=parse_status(row.get("状态")),
                risk=meaningful_text(row.get("遗留事项")),
                this_week=meaningful_text(row.get("本周进度")),
                next_week=meaningful_text(row.get("下一步计划")),
                prev_week=prev_week,
            )
        )
    return result


def empty_summary() -> dict[str, Any]:
    return {
        "department_rows": 0,
        "source_sub_tasks": 0,
        "department_owner_updates": 0,
        "sub_tasks_created": 0,
        "sub_tasks_updated": 0,
        "sub_tasks_matched": 0,
        "users_created": 0,
        "created_users": [],
        "weekly_updates_upserted": defaultdict(int),
        "test_sub_tasks_removed": 0,
        "removed_test_sub_tasks": [],
        "extra_business_sub_tasks": [],
        "blocking_errors": [],
    }


def sync_alignment(
    db: Session,
    *,
    department_csv: Path,
    sub_task_csv: Path,
    weekly_csv: Path,
    apply: bool,
) -> dict[str, Any]:
    summary = empty_summary()
    actor = db.scalar(select(User).where(User.is_admin.is_(True)).order_by(User.id))

    department_rows = read_csv(department_csv)
    sub_task_rows = read_csv(sub_task_csv)
    weekly_rows = read_csv(weekly_csv)
    sources = source_sub_tasks(sub_task_rows, weekly_rows)
    summary["department_rows"] = len(department_rows)
    summary["source_sub_tasks"] = len(sources)

    source_key_counts = Counter((item.task_code, normalize_title(item.title)) for item in sources)
    duplicate_source_keys = [key for key, count in source_key_counts.items() if count > 1]
    if duplicate_source_keys:
        summary["blocking_errors"].append(f"03 表存在重复 任务编号+具体任务：{duplicate_source_keys[:10]}")

    department_tasks = {
        task.code: task for task in db.scalars(select(DepartmentTask).order_by(DepartmentTask.code)).all()
    }
    existing_by_key: dict[tuple[str, str], list[SubTask]] = defaultdict(list)
    for task in db.scalars(select(SubTask).order_by(SubTask.code)).all():
        if task.department_task:
            existing_by_key[(task.department_task.code, normalize_title(task.title))].append(task)

    for key, tasks in existing_by_key.items():
        if len(tasks) > 1:
            summary["blocking_errors"].append(f"系统内存在重复子任务匹配键：{key}")

    if summary["blocking_errors"]:
        raise RuntimeError("; ".join(summary["blocking_errors"]))

    for row in department_rows:
        task_code = clean_text(row.get("任务编号"))
        owner_names = split_people(row.get("任务负责人"))
        if not task_code or not owner_names:
            continue
        department_task = department_tasks.get(task_code)
        if not department_task:
            summary["blocking_errors"].append(f"02 表部门任务不存在：{task_code}")
            continue
        owners = resolve_people(db, owner_names, department_task, summary)
        for user in owners:
            add_roles(db, user, ["task_owner"])
        if sync_department_task_owners(db, department_task, owners):
            summary["department_owner_updates"] += 1
            sync_inherited_sub_task_owners(db, department_task, owners)
            if actor:
                add_event(
                    db,
                    object_type="department_task",
                    object_id=department_task.id,
                    event_type="csv_alignment_department_owners_updated",
                    title="2.1.0 同步部门任务负责人",
                    actor_id=actor.id,
                    content=department_task.code,
                )

    source_task_ids: set[int] = set()
    for item in sources:
        department_task = department_tasks.get(item.task_code)
        if not department_task:
            summary["blocking_errors"].append(f"03 表部门任务不存在：{item.task_code}")
            continue
        matches = existing_by_key.get((item.task_code, normalize_title(item.title)), [])
        if len(matches) > 1:
            summary["blocking_errors"].append(f"子任务匹配多条：{item.task_code} {item.title}")
            continue
        owners = list(department_task.owners or [department_task.owner])
        executors = resolve_people(db, item.executors, department_task, summary) if item.executors else owners[:1]
        for user in executors:
            add_roles(db, user, ["executor"])

        if matches:
            sub_task = matches[0]
            summary["sub_tasks_matched"] += 1
        else:
            sub_task = SubTask(
                code=generate_sub_task_code(db, department_task),
                title=item.title,
                department_task=department_task,
                owner=owners[0],
                executor=executors[0],
                status=item.status,
                progress=progress_for_source_status(item.status) or 0,
                risk_level="none",
                due_date=item.due_date,
            )
            db.add(sub_task)
            db.flush()
            sync_sub_task_owners(db, sub_task, owners)
            sync_sub_task_executors(db, sub_task, executors)
            summary["sub_tasks_created"] += 1
            if actor:
                add_event(
                    db,
                    object_type="sub_task",
                    object_id=sub_task.id,
                    event_type="csv_alignment_sub_task_created",
                    title="2.1.0 新增子任务",
                    actor_id=actor.id,
                    content=f"{sub_task.code} / {item.source_sub_code}",
                )

        source_task_ids.add(sub_task.id)
        changed_fields: list[str] = []
        if sync_sub_task_owners(db, sub_task, owners):
            changed_fields.append("owners")
        if sync_sub_task_executors(db, sub_task, executors):
            changed_fields.append("executors")
        if item.due_date and sub_task.due_date != item.due_date:
            sub_task.due_date = item.due_date
            changed_fields.append("due_date")
        if sub_task.status != item.status:
            sub_task.status = item.status
            changed_fields.append("status")
        if sub_task.risk_level != "none":
            sub_task.risk_level = "none"
            changed_fields.append("risk_level")
        progress = progress_for_source_status(item.status)
        if progress is not None and sub_task.progress != progress:
            sub_task.progress = progress
            changed_fields.append("progress")
        if changed_fields:
            summary["sub_tasks_updated"] += 1
            if actor:
                add_event(
                    db,
                    object_type="sub_task",
                    object_id=sub_task.id,
                    event_type="csv_alignment_sub_task_updated",
                    title="2.1.0 同步子任务",
                    actor_id=actor.id,
                    content=", ".join(changed_fields),
                )

        submitter = actor or owners[0]
        for assignee in executors:
            upsert_weekly(
                db,
                sub_task=sub_task,
                assignee=assignee,
                submitter=submitter,
                week_key=W23_KEY,
                this_week=item.prev_week,
                next_week="",
                risk="",
                summary=summary,
            )
            upsert_weekly(
                db,
                sub_task=sub_task,
                assignee=assignee,
                submitter=submitter,
                week_key=W24_KEY,
                this_week=item.this_week,
                next_week=item.next_week,
                risk=item.risk,
                summary=summary,
            )

    cleanup_obvious_test_sub_tasks(db, actor, summary)

    for task in db.scalars(select(SubTask).order_by(SubTask.code)).all():
        if task.id not in source_task_ids and not clean_text(task.title).startswith("__codex_tmp_"):
            summary["extra_business_sub_tasks"].append(
                {
                    "code": task.code,
                    "department_task": task.department_task.code if task.department_task else None,
                    "title": task.title,
                    "status": task.status,
                }
            )

    if summary["blocking_errors"]:
        raise RuntimeError("; ".join(summary["blocking_errors"]))

    serializable_summary = dict(summary)
    serializable_summary["weekly_updates_upserted"] = dict(summary["weekly_updates_upserted"])
    if apply:
        db.add(
            BaseSyncRun(
                source_name="2026公司工作任务跟踪表 CSV",
                table_name="02_部门任务,03_部门拆解任务,04_周更新进度",
                status="success",
                record_count=summary["source_sub_tasks"],
                message="2.1.0 CSV 增量同步：部门负责人、子任务执行人和 W23/W24 周更新对齐。",
                raw_summary=serializable_summary,
                actor_id=actor.id if actor else None,
            )
        )
        db.commit()
    else:
        db.rollback()
    return serializable_summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--department-csv", type=Path, default=DEFAULT_DEPARTMENT_CSV)
    parser.add_argument("--sub-task-csv", type=Path, default=DEFAULT_SUB_TASK_CSV)
    parser.add_argument("--weekly-csv", type=Path, default=DEFAULT_WEEKLY_CSV)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    for path in [args.department_csv, args.sub_task_csv, args.weekly_csv]:
        if not path.exists():
            raise FileNotFoundError(path)

    with SessionLocal() as db:
        try:
            summary = sync_alignment(
                db,
                department_csv=args.department_csv,
                sub_task_csv=args.sub_task_csv,
                weekly_csv=args.weekly_csv,
                apply=args.apply,
            )
        except Exception:
            db.rollback()
            raise

    print(json.dumps({"ok": True, "mode": "apply" if args.apply else "dry-run", "summary": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
