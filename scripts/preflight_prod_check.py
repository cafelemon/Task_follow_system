#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
EXPECTED_VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
PRODUCTION_BASE_URL = "https://task.citronmicrobot.com:4442"
PRODUCTION_CALLBACK = f"{PRODUCTION_BASE_URL}/api/auth/lark-oauth/callback"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def add_issue(items: list[dict[str, str]], code: str, message: str) -> None:
    items.append({"code": code, "message": message})


def validate_base_url(raw_url: str, blockers: list[dict[str, str]]) -> tuple[str, bool]:
    base_url = raw_url.strip().rstrip("/")
    if "[" in base_url or "](" in base_url or ")" in base_url:
        add_issue(
            blockers,
            "env:base_url_format",
            "base_url 必须是纯文本 URL，例如 https://task.citronmicrobot.com:4442，不要粘贴 Markdown 链接格式",
        )
        return base_url, False
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        add_issue(blockers, "env:base_url_format", f"base_url 不是有效 HTTP(S) URL：{raw_url!r}")
        return base_url, False
    return base_url, True


def check_env(expected_base_url: str, blockers: list[dict[str, str]], warnings: list[dict[str, str]]) -> None:
    expected_callback = f"{expected_base_url.rstrip('/')}/api/auth/lark-oauth/callback"
    checks = {
        "TASK_FOLLOW_WEB_BASE_URL": expected_base_url,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI": expected_callback,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE": "configured",
        "TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE": "all",
        "TASK_FOLLOW_SCHEDULER_ENABLED": "true",
        "TASK_FOLLOW_COOKIE_SECURE": "true",
    }
    for key, expected in checks.items():
        actual = os.getenv(key)
        if actual != expected:
            add_issue(blockers, f"env:{key}", f"{key} 应为 {expected!r}，当前为 {actual!r}")
    cors = {item.strip() for item in os.getenv("TASK_FOLLOW_CORS_ORIGINS", "").split(",") if item.strip()}
    if cors != {expected_base_url}:
        add_issue(blockers, "env:TASK_FOLLOW_CORS_ORIGINS", f"CORS 应只允许 {expected_base_url}，当前为 {sorted(cors)}")
    if os.getenv("TASK_FOLLOW_NOTIFICATION_ALLOWLIST_EMAILS"):
        add_issue(warnings, "env:allowlist_emails", "生产 all 模式下仍配置了 allowlist 邮箱；不会限制发送，但建议清空")
    required_secrets = [
        "TASK_FOLLOW_LARK_APP_ID",
        "TASK_FOLLOW_LARK_APP_SECRET",
        "TASK_FOLLOW_LINK_SECRET",
        "TASK_FOLLOW_LARK_OAUTH_STATE_SECRET",
    ]
    for key in required_secrets:
        if not os.getenv(key):
            add_issue(blockers, f"env:{key}", f"{key} 为空")
    if not os.getenv("TASK_FOLLOW_ADMIN_PASSWORD") and not os.getenv("TASK_FOLLOW_ADMIN_PASSWORD_HASH"):
        add_issue(warnings, "env:admin_password", "未配置初始管理员密码或哈希；仅当数据库已有管理员时可接受")


def check_compose(expected_base_url: str, blockers: list[dict[str, str]], warnings: list[dict[str, str]]) -> None:
    env = os.environ.copy()
    env.setdefault("TASK_FOLLOW_DOCKER_HTTP_PORT", "28081")
    env.setdefault("TASK_FOLLOW_BACKEND_ENV_FILE", "../env_of")
    expected_callback = f"{expected_base_url.rstrip('/')}/api/auth/lark-oauth/callback"
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", "deploy/docker-compose.yml", "config"],
            cwd=ROOT,
            env=env,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as exc:
        add_issue(warnings, "compose:unavailable", f"Docker Compose 配置未验证：{exc}")
        return
    if result.returncode != 0:
        add_issue(blockers, "compose:config", result.stderr.strip() or result.stdout.strip())
        return
    config = result.stdout
    if "28081:80" not in config and "published: \"28081\"" not in config:
        add_issue(blockers, "compose:port", "Compose 配置未显示 28081 作为生产内网 HTTP 入口")
    expected_pairs = {
        "TASK_FOLLOW_WEB_BASE_URL": expected_base_url,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI": expected_callback,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE": "configured",
        "TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE": "all",
        "TASK_FOLLOW_COOKIE_SECURE": "true",
        "TASK_FOLLOW_CORS_ORIGINS": expected_base_url,
    }
    for key, expected in expected_pairs.items():
        if f"{key}: {expected}" not in config and f"{key}: \"{expected}\"" not in config:
            add_issue(blockers, f"compose:{key}", f"Compose 后端环境未展开为 {key}={expected}")
    if "10.10." in config:
        add_issue(blockers, "compose:lan_url", "Compose 展开结果仍包含 10.10.* 局域网地址")
    if "request_host" in config:
        add_issue(blockers, "compose:request_host", "Compose 展开结果仍包含 request_host OAuth 模式")


def http_get(url: str, timeout: float = 8) -> tuple[int, str, str | None]:
    opener = build_opener(NoRedirect)
    request = Request(url, headers={"User-Agent": f"task-follow-preflight/{EXPECTED_VERSION}"})
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace"), response.headers.get("Location")
    except HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace"), exc.headers.get("Location")
    except URLError as exc:
        raise RuntimeError(str(exc)) from exc


def check_http(base_url: str, blockers: list[dict[str, str]]) -> None:
    try:
        status, body, _location = http_get(f"{base_url.rstrip('/')}/api/health")
    except Exception as exc:
        add_issue(blockers, "http:health", f"正式入口健康检查不可达：{exc}")
        return
    if status != 200:
        add_issue(blockers, "http:health_status", f"/api/health 返回 HTTP {status}")
        return
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        add_issue(blockers, "http:health_json", "/api/health 未返回 JSON")
        return
    if payload.get("version") != EXPECTED_VERSION:
        add_issue(blockers, "http:version", f"/api/health version 应为 {EXPECTED_VERSION}，当前为 {payload.get('version')!r}")

    try:
        status, _body, location = http_get(f"{base_url.rstrip('/')}/api/auth/lark-oauth/start?next_path=/meeting-board/overview")
    except Exception as exc:
        add_issue(blockers, "http:oauth_start", f"OAuth start 不可达：{exc}")
        return
    if status not in {302, 307} or not location:
        add_issue(blockers, "http:oauth_redirect", f"OAuth start 应返回 302/307，当前 HTTP {status}")
        return
    redirect_uri = parse_qs(urlparse(location).query).get("redirect_uri", [""])[0]
    if redirect_uri != f"{base_url.rstrip('/')}/api/auth/lark-oauth/callback":
        add_issue(blockers, "http:oauth_callback", f"OAuth redirect_uri 错误：{redirect_uri}")


async def check_lark(blockers: list[dict[str, str]], warnings: list[dict[str, str]]) -> None:
    sys.path.insert(0, str(BACKEND))
    try:
        from app.services.lark_client import lark_client
    except Exception as exc:
        add_issue(warnings, "lark:import", f"无法导入飞书客户端：{exc}")
        return
    try:
        result = await lark_client.health_check()
    except Exception as exc:
        add_issue(blockers, "lark:diagnostic", f"飞书诊断异常：{exc}")
        return
    if not result.get("ok"):
        add_issue(blockers, "lark:diagnostic", result.get("message") or "飞书诊断未通过")


def format_people(items: list[dict[str, Any]]) -> str:
    sample = "、".join(f"{item['name']}(id={item['id']})" for item in items[:20])
    suffix = "" if len(items) <= 20 else f" 等 {len(items)} 人"
    return f"{sample}{suffix}"


def collect_open_id_payload() -> dict[str, Any]:
    from datetime import date, timedelta

    from sqlalchemy import select
    from app.db.session import SessionLocal
    from app.models.entities import DepartmentTask, RiskItem, User
    from app.services.business import (
        ACTIVE_RISK_STATUSES,
        current_week_key,
        missing_update_assignments,
        owner_people,
        risk_notification_targets,
    )

    today = date.today()
    window_end = today + timedelta(days=7)
    with SessionLocal() as db:
        target_scenarios: dict[int, dict[str, Any]] = {}

        def add_target(user: User, scenario: str) -> None:
            if not user or user.status == "disabled":
                return
            row = target_scenarios.setdefault(user.id, {"id": user.id, "name": user.name, "scenarios": set()})
            row["scenarios"].add(scenario)

        for _task, assignee in missing_update_assignments(db, current_week_key()):
            add_target(assignee, "weekly_update_digest")

        department_tasks = db.scalars(
            select(DepartmentTask).where(DepartmentTask.status.not_in(["completed", "archived"]))
        ).all()
        for task in department_tasks:
            if task.parent_task and task.parent_task.status == "archived":
                continue
            for owner in owner_people(task):
                add_target(owner, "department_task_split_required")
            if task.due_date and today <= task.due_date <= window_end:
                for owner in owner_people(task):
                    add_target(owner, "department_task_due_soon")

        risks = db.scalars(select(RiskItem).where(RiskItem.status.in_(ACTIVE_RISK_STATUSES))).all()
        for risk in risks:
            if risk.level == "high" or (risk.due_date and risk.due_date < today):
                for target in risk_notification_targets(risk):
                    add_target(target, "risk_item_alert")

        target_ids = set(target_scenarios)
        target_missing = []
        for row in target_scenarios.values():
            user = db.get(User, row["id"])
            if user and user.status != "disabled" and not user.open_id:
                target_missing.append(
                    {
                        "id": user.id,
                        "name": user.name,
                        "scenarios": sorted(row["scenarios"]),
                    }
                )

        non_target_missing = [
            {"id": user.id, "name": user.name}
            for user in db.scalars(
                select(User)
                .where(User.status != "disabled", User.open_id.is_(None))
                .order_by(User.id)
            ).all()
            if user.id not in target_ids
        ]
    return {
        "target_missing": target_missing,
        "non_target_missing": non_target_missing,
    }


def open_id_check_code() -> str:
    return r"""
import json
from datetime import date, timedelta
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import DepartmentTask, RiskItem, User
from app.services.business import ACTIVE_RISK_STATUSES, current_week_key, missing_update_assignments, owner_people, risk_notification_targets

today = date.today()
window_end = today + timedelta(days=7)
with SessionLocal() as db:
    target_scenarios = {}
    def add_target(user, scenario):
        if not user or user.status == "disabled":
            return
        row = target_scenarios.setdefault(user.id, {"id": user.id, "name": user.name, "scenarios": set()})
        row["scenarios"].add(scenario)

    for _task, assignee in missing_update_assignments(db, current_week_key()):
        add_target(assignee, "weekly_update_digest")

    department_tasks = db.scalars(select(DepartmentTask).where(DepartmentTask.status.not_in(["completed", "archived"]))).all()
    for task in department_tasks:
        if task.parent_task and task.parent_task.status == "archived":
            continue
        for owner in owner_people(task):
            add_target(owner, "department_task_split_required")
        if task.due_date and today <= task.due_date <= window_end:
            for owner in owner_people(task):
                add_target(owner, "department_task_due_soon")

    risks = db.scalars(select(RiskItem).where(RiskItem.status.in_(ACTIVE_RISK_STATUSES))).all()
    for risk in risks:
        if risk.level == "high" or (risk.due_date and risk.due_date < today):
            for target in risk_notification_targets(risk):
                add_target(target, "risk_item_alert")

    target_ids = set(target_scenarios)
    target_missing = []
    for row in target_scenarios.values():
        user = db.get(User, row["id"])
        if user and user.status != "disabled" and not user.open_id:
            target_missing.append({"id": user.id, "name": user.name, "scenarios": sorted(row["scenarios"])})

    non_target_missing = [
        {"id": user.id, "name": user.name}
        for user in db.scalars(select(User).where(User.status != "disabled", User.open_id.is_(None)).order_by(User.id)).all()
        if user.id not in target_ids
    ]

print(json.dumps({"target_missing": target_missing, "non_target_missing": non_target_missing}, ensure_ascii=False))
"""


def check_open_ids(blockers: list[dict[str, str]], warnings: list[dict[str, str]]) -> None:
    sys.path.insert(0, str(BACKEND))
    payload: dict[str, Any] | None = None
    direct_error: str | None = None
    try:
        try:
            payload = collect_open_id_payload()
        except Exception as exc:
            direct_error = f"宿主机数据库检查失败，将尝试 Docker 容器检查：{exc}"
    except Exception as exc:
        direct_error = f"无法导入数据库模型，将尝试 Docker 容器检查：{exc}"
    if payload is None:
        try:
            result = subprocess.run(
                ["docker", "exec", "-i", "task-follow-system-backend-1", "python", "-"],
                input=open_id_check_code(),
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except Exception as exc:
            if direct_error:
                add_issue(warnings, "db:direct_connect", direct_error)
            add_issue(blockers, "db:connect", f"数据库不可用或模型查询失败：{exc}")
            return
        if result.returncode != 0:
            if direct_error:
                add_issue(warnings, "db:direct_connect", direct_error)
            add_issue(blockers, "db:connect", result.stderr.strip() or result.stdout.strip())
            return
        payload = json.loads(result.stdout or "{}")
    target_missing = payload.get("target_missing", [])
    non_target_missing = payload.get("non_target_missing", [])
    if target_missing:
        scenario_text = "；".join(
            f"{item['name']}(id={item['id']}:{','.join(item.get('scenarios', []))})"
            for item in target_missing[:20]
        )
        suffix = "" if len(target_missing) <= 20 else f" 等 {len(target_missing)} 人"
        add_issue(blockers, "db:missing_open_id_targets", f"存在正式通知目标未绑定 open_id：{scenario_text}{suffix}")
    if non_target_missing:
        add_issue(warnings, "db:missing_open_id_non_targets", f"存在暂无正式通知目标的人员未绑定 open_id，可后续补齐：{format_people(non_target_missing)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight checks for task-follow-system production rollout.")
    parser.add_argument("--base-url", default=PRODUCTION_BASE_URL)
    parser.add_argument("--env-file", default="env_of")
    parser.add_argument("--skip-http", action="store_true")
    parser.add_argument("--skip-lark", action="store_true")
    parser.add_argument("--skip-db", action="store_true")
    args = parser.parse_args()

    load_env_file(ROOT / args.env_file)
    blockers: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    base_url, valid_base_url = validate_base_url(args.base_url, blockers)
    if valid_base_url:
        check_env(base_url, blockers, warnings)
        check_compose(base_url, blockers, warnings)
    if not args.skip_http:
        if valid_base_url:
            check_http(base_url, blockers)
    if not args.skip_lark:
        asyncio.run(check_lark(blockers, warnings))
    if not args.skip_db:
        check_open_ids(blockers, warnings)

    payload: dict[str, Any] = {
        "ready": not blockers,
        "expected_version": EXPECTED_VERSION,
        "base_url": base_url,
        "blockers": blockers,
        "warnings": warnings,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not blockers else 2


if __name__ == "__main__":
    raise SystemExit(main())
