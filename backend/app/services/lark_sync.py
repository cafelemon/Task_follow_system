import json
import re
import subprocess
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import (
    BaseSyncRun,
    Department,
    DepartmentTask,
    ParentTask,
    StrategicGoal,
    SubTask,
    User,
)
from app.services.business import generate_code
from app.services.seed import clear_business_data


@dataclass
class CliResult:
    ok: bool
    stdout: str = ""
    stderr: str = ""
    error: str | None = None


def run_lark_cli(args: list[str], timeout_seconds: int = 12) -> CliResult:
    try:
        completed = subprocess.run(
            ["lark-cli", *args],
            check=False,
            text=True,
            capture_output=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return CliResult(ok=False, error=f"lark-cli timeout after {timeout_seconds}s")
    except FileNotFoundError:
        return CliResult(ok=False, error="lark-cli not found")
    return CliResult(
        ok=completed.returncode == 0,
        stdout=completed.stdout,
        stderr=completed.stderr,
        error=None if completed.returncode == 0 else completed.stderr or completed.stdout,
    )


def parse_json(stdout: str) -> dict[str, Any]:
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {}


def payload_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    for container in [payload, payload.get("data") or {}]:
        for key in ["items", "results", "records"]:
            items = container.get(key)
            if isinstance(items, list):
                return items
    return []


def extract_base_token(result: dict[str, Any]) -> str | None:
    candidates = [
        result.get("token"),
        result.get("obj_token"),
        result.get("app_token"),
        result.get("base_token"),
        result.get("url"),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        match = re.search(r"(app[a-zA-Z0-9_]+)", str(candidate))
        if match:
            return match.group(1)
    return None


def preview_base_2026() -> dict[str, Any]:
    version = run_lark_cli(["--version"], timeout_seconds=6)
    if not version.ok:
        return {"ok": False, "stage": "version", "message": version.error or "lark-cli unavailable"}
    status = run_lark_cli(["auth", "status"], timeout_seconds=8)
    if not status.ok:
        return {"ok": False, "stage": "auth", "message": status.error or "auth status failed"}
    search = run_lark_cli(
        ["drive", "+search", "--query", "2026任务跟踪表", "--doc-types", "bitable", "--format", "json"],
        timeout_seconds=15,
    )
    if not search.ok:
        return {"ok": False, "stage": "search", "message": search.error or "search failed"}
    payload = parse_json(search.stdout)
    results = payload_items(payload)
    if not results:
        return {"ok": False, "stage": "search", "message": "未找到 2026任务跟踪表", "results": []}
    first = results[0]
    base_token = extract_base_token(first)
    if not base_token:
        return {"ok": False, "stage": "token", "message": "无法从搜索结果解析 Base token", "results": results}
    tables_result = run_lark_cli(
        ["base", "+table-list", "--base-token", base_token, "--offset", "0", "--limit", "50"],
        timeout_seconds=15,
    )
    if not tables_result.ok:
        return {"ok": False, "stage": "table-list", "message": tables_result.error, "base_token": base_token}
    tables_payload = parse_json(tables_result.stdout)
    tables = payload_items(tables_payload)
    table_previews = []
    for table in tables[:5]:
        table_id = table.get("table_id") or table.get("id") or table.get("tableId")
        table_name = table.get("table_name") or table.get("name") or table_id
        fields = []
        if table_id:
            field_result = run_lark_cli(
                [
                    "base",
                    "+field-list",
                    "--base-token",
                    base_token,
                    "--table-id",
                    str(table_id),
                    "--offset",
                    "0",
                    "--limit",
                    "100",
                ],
                timeout_seconds=15,
            )
            if field_result.ok:
                fields_payload = parse_json(field_result.stdout)
                fields = payload_items(fields_payload)
        table_previews.append({"table_id": table_id, "table_name": table_name, "fields": fields})
    return {
        "ok": True,
        "base_token": base_token,
        "title": first.get("title") or first.get("name") or "2026任务跟踪表",
        "tables": table_previews,
    }


def cell_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        return "、".join(cell_text(item) for item in value if cell_text(item))
    if isinstance(value, dict):
        for key in ["text", "name", "value", "display_value", "title"]:
            if key in value:
                return cell_text(value[key])
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def pick(fields: dict[str, Any], *names: str) -> str:
    normalized = {key.replace(" ", "").lower(): value for key, value in fields.items()}
    for name in names:
        value = normalized.get(name.replace(" ", "").lower())
        if value is not None:
            return cell_text(value)
    return ""


def ensure_department(db: Session, name: str) -> Department:
    name = name or "未分配"
    department = db.scalar(select(Department).where(Department.name == name))
    if not department:
        department = Department(name=name, status="active")
        db.add(department)
        db.flush()
    return department


def ensure_person(db: Session, name: str, department: Department | None = None) -> User:
    name = name or "未知用户"
    user = db.scalar(select(User).where(User.name == name))
    if not user:
        user = User(name=name, department=department, status="pending", source="base_import")
        db.add(user)
        db.flush()
    elif department and not user.department_id:
        user.department = department
    return user


def parse_date(text: str) -> date | None:
    match = re.search(r"20\d{2}[-/]\d{1,2}[-/]\d{1,2}", text or "")
    if not match:
        return None
    parts = re.split(r"[-/]", match.group(0))
    return date(int(parts[0]), int(parts[1]), int(parts[2]))


def import_base_2026(db: Session, actor_id: int) -> dict[str, Any]:
    preview = preview_base_2026()
    run = BaseSyncRun(
        source_name="2026任务跟踪表",
        base_token=preview.get("base_token"),
        status="blocked" if not preview.get("ok") else "running",
        message=preview.get("message"),
        raw_summary=preview,
        actor_id=actor_id,
    )
    db.add(run)
    db.commit()
    if not preview.get("ok"):
        return {"ok": False, "run_id": run.id, "message": preview.get("message"), "preview": preview}

    base_token = preview["base_token"]
    tables = preview.get("tables") or []
    imported = 0
    clear_business_data(db, include_sync_runs=False)
    goal = StrategicGoal(
        code=generate_code(db, StrategicGoal, "SG"),
        name="2026 任务跟踪",
        description="从飞书多维表格 2026任务跟踪表 一次性同步导入。",
        year=2026,
        progress=0,
    )
    db.add(goal)
    db.flush()
    default_department = ensure_department(db, "未分配")
    default_owner = db.get(User, actor_id)

    for table in tables:
        table_id = table.get("table_id")
        table_name = table.get("table_name")
        if not table_id:
            continue
        records_result = run_lark_cli(
            [
                "base",
                "+record-list",
                "--base-token",
                base_token,
                "--table-id",
                str(table_id),
                "--limit",
                "200",
                "--offset",
                "0",
                "--format",
                "json",
            ],
            timeout_seconds=20,
        )
        if not records_result.ok:
            continue
        records_payload = parse_json(records_result.stdout)
        records = payload_items(records_payload)
        parent_task = ParentTask(
            code=generate_code(db, ParentTask, "MT"),
            title=str(table_name or "Base 导入任务"),
            description="从 Base 表同步生成的母任务。",
            goal=goal,
            department=default_department,
            owner=default_owner,
            progress=0,
        )
        db.add(parent_task)
        db.flush()
        for record in records:
            fields = record.get("fields") or record
            title = pick(fields, "任务名称", "任务", "标题", "事项", "工作内容") or f"Base 记录 {imported + 1}"
            department_name = pick(fields, "部门", "责任部门", "所属部门")
            owner_name = pick(fields, "负责人", "任务负责人", "责任人", "执行人")
            status = pick(fields, "状态", "任务状态") or "in_progress"
            progress_text = pick(fields, "进度", "完成率", "当前进度")
            department = ensure_department(db, department_name) if department_name else default_department
            owner = ensure_person(db, owner_name, department) if owner_name else default_owner
            progress_match = re.search(r"\d+", progress_text)
            progress = min(int(progress_match.group(0)), 100) if progress_match else 0
            due_date = parse_date(pick(fields, "截止日期", "截止时间", "计划完成时间"))
            department_task = DepartmentTask(
                code=generate_code(db, DepartmentTask, "DT"),
                title=title,
                parent_task=parent_task,
                department=department,
                owner=owner,
                progress=progress,
                status="completed" if "完成" in status else "in_progress",
                due_date=due_date,
            )
            db.add(department_task)
            db.flush()
            sub_task = SubTask(
                code=generate_code(db, SubTask, "ST"),
                title=title,
                department_task=department_task,
                owner=owner,
                executor=owner,
                progress=progress,
                status=department_task.status,
                due_date=due_date,
                risk_level="high" if "风险" in status or "延期" in status else "none",
            )
            db.add(sub_task)
            imported += 1
    run.status = "success"
    run.record_count = imported
    run.message = f"导入 {imported} 条任务记录"
    db.add(run)
    db.commit()
    return {"ok": True, "run_id": run.id, "imported": imported}
