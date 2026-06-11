#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ipaddress
import os
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_PATH = ROOT / ".env"
TARGET_KEYS = (
    "TASK_FOLLOW_WEB_BASE_URL",
    "TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI",
    "TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE",
)


def read_env_lines(path: Path) -> list[str]:
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def env_value(lines: list[str], key: str) -> str | None:
    prefix = f"{key}="
    for line in lines:
        if line.startswith(prefix):
            return line[len(prefix) :].strip().strip('"').strip("'")
    return None


def detect_interface_ipv4(interface: str) -> str:
    result = subprocess.run(
        ["ipconfig", "getifaddr", interface],
        check=False,
        capture_output=True,
        text=True,
    )
    candidate = result.stdout.strip()
    if candidate:
        return validate_ipv4(candidate)

    result = subprocess.run(
        ["ifconfig", interface],
        check=True,
        capture_output=True,
        text=True,
    )
    match = re.search(r"\binet\s+(\d+\.\d+\.\d+\.\d+)\b", result.stdout)
    if not match:
        raise RuntimeError(f"Cannot detect IPv4 for interface {interface}")
    return validate_ipv4(match.group(1))


def validate_ipv4(value: str) -> str:
    try:
        ip = ipaddress.ip_address(value.strip())
    except ValueError as exc:
        raise RuntimeError(f"Invalid IPv4 address: {value}") from exc
    if ip.version != 4 or ip.is_loopback:
        raise RuntimeError(f"LAN host must be a non-loopback IPv4 address: {value}")
    return str(ip)


def update_env_lines(lines: list[str], updates: dict[str, str]) -> tuple[list[str], dict[str, tuple[str | None, str]]]:
    changes: dict[str, tuple[str | None, str]] = {}
    remaining = dict(updates)
    output: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0] if "=" in line and not line.lstrip().startswith("#") else None
        if key in updates:
            new_line = f"{key}={updates[key]}"
            old_value = line.split("=", 1)[1] if "=" in line else None
            if line != new_line:
                changes[key] = (old_value, updates[key])
            output.append(new_line)
            remaining.pop(key, None)
        else:
            output.append(line)
    if output and remaining:
        output.append("")
    for key, value in remaining.items():
        output.append(f"{key}={value}")
        changes[key] = (None, value)
    return output, changes


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync local LAN URL settings for task-follow-system.")
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV_PATH, help="Path to .env")
    parser.add_argument("--interface", default="en0", help="Network interface used for LAN tests")
    parser.add_argument("--host", help="Override detected LAN IPv4")
    parser.add_argument("--port", type=int, help="HTTP port, default reads TASK_FOLLOW_DOCKER_HTTP_PORT or 8080")
    parser.add_argument("--check", action="store_true", help="Print target values without writing .env")
    parser.add_argument("--apply", action="store_true", help="Write target values to .env")
    parser.add_argument("--format", choices=("text", "shell"), default="text", help="Output format")
    args = parser.parse_args()

    if args.check == args.apply:
        parser.error("choose exactly one of --check or --apply")

    env_lines = read_env_lines(args.env)
    host = validate_ipv4(args.host) if args.host else detect_interface_ipv4(args.interface)
    port = args.port or int(env_value(env_lines, "TASK_FOLLOW_DOCKER_HTTP_PORT") or os.getenv("TASK_FOLLOW_DOCKER_HTTP_PORT", "8080"))
    web_base_url = f"http://{host}:{port}"
    redirect_uri = f"{web_base_url}/api/auth/lark-oauth/callback"
    updates = {
        "TASK_FOLLOW_WEB_BASE_URL": web_base_url,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI": redirect_uri,
        "TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE": "request_host",
    }

    new_lines, changes = update_env_lines(env_lines, updates)
    if args.apply and changes:
        args.env.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

    if args.format == "shell":
        print(f"TASK_FOLLOW_LAN_HOST={shell_quote(host)}")
        print(f"TASK_FOLLOW_WEB_BASE_URL={shell_quote(web_base_url)}")
        print(f"TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI={shell_quote(redirect_uri)}")
        print(f"TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE={shell_quote('request_host')}")
        return 0

    action = "apply" if args.apply else "check"
    print(f"mode: {action}")
    print(f"interface: {args.interface}")
    print(f"host: {host}")
    print(f"web_base_url: {web_base_url}")
    print(f"lark_oauth_redirect_uri: {redirect_uri}")
    print("lark_oauth_redirect_mode: request_host")
    print(f"changed_keys: {', '.join(changes) if changes else 'none'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
