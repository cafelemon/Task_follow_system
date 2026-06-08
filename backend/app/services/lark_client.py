import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


@dataclass
class LarkSendResult:
    ok: bool
    status: str
    message: str
    raw: dict[str, Any] | None = None


class LarkClient:
    def __init__(self) -> None:
        self._tenant_access_token: str | None = None
        self._tenant_access_token_expire_at = 0.0
        self._app_access_token: str | None = None
        self._app_access_token_expire_at = 0.0

    @property
    def configured(self) -> bool:
        return bool(settings.lark_app_id and settings.lark_app_secret)

    def config_status(self) -> dict[str, Any]:
        return {
            "enabled": settings.lark_enabled,
            "configured": self.configured,
            "app_id_configured": bool(settings.lark_app_id),
            "app_secret_configured": bool(settings.lark_app_secret),
            "api_base_url": settings.lark_api_base_url,
            "receive_id_type": settings.lark_message_receive_id_type,
        }

    async def health_check(self) -> dict[str, Any]:
        status = self.config_status()
        if not settings.lark_enabled:
            return {**status, "ok": False, "message": "飞书真实发送未启用"}
        if not self.configured:
            return {**status, "ok": False, "message": "缺少飞书企业自建应用 app_id 或 app_secret"}
        checks: dict[str, Any] = {}
        try:
            await self._get_tenant_access_token()
        except Exception as exc:
            checks["tenant_token"] = {"ok": False, "message": str(exc)}
            return {**status, "checks": checks, "ok": False, "message": str(exc)}
        checks["tenant_token"] = {"ok": True, "message": "飞书 tenant_access_token 获取成功"}
        try:
            await self._get_app_access_token()
            checks["oauth_app_token"] = {"ok": True, "message": "飞书 app_access_token 获取成功"}
        except Exception as exc:
            checks["oauth_app_token"] = {"ok": False, "message": str(exc)}
        try:
            await self.batch_get_user_ids_by_email(["diagnostic@example.com"])
            checks["email_lookup"] = {"ok": True, "message": "邮箱换 open_id 接口可调用"}
        except Exception as exc:
            checks["email_lookup"] = {"ok": False, "message": str(exc)}
        ok = checks["tenant_token"]["ok"] and checks["oauth_app_token"]["ok"]
        return {**status, "checks": checks, "ok": ok, "message": "飞书基础凭证检查完成"}

    async def batch_get_user_ids_by_email(self, emails: list[str]) -> dict[str, Any]:
        normalized = [item.strip().lower() for item in emails if item and item.strip()]
        if not normalized:
            return {"users": {}, "missing_emails": []}
        if len(normalized) > 50:
            raise ValueError("邮箱一次最多查询 50 个")
        token = await self._get_tenant_access_token()
        url = f"{settings.lark_api_base_url}/open-apis/contact/v3/users/batch_get_id"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        }
        params = {"user_id_type": "open_id"}
        payload = {"emails": normalized}
        async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
            response = await client.post(url, headers=headers, params=params, json=payload)
        response.raise_for_status()
        data = response.json()
        code = data.get("code", 0)
        if code != 0:
            raise RuntimeError(data.get("msg") or f"飞书邮箱查询接口返回 code={code}")
        body = data.get("data") or {}
        return {
            "users": self._normalize_email_lookup_users(body),
            "missing_emails": body.get("emails_not_exist") or body.get("email_not_exist") or [],
            "raw": body,
        }

    async def get_user_access_token(self, code: str) -> dict[str, Any]:
        token = await self._get_app_access_token()
        url = f"{settings.lark_api_base_url}/open-apis/authen/v1/access_token"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        }
        payload = {"grant_type": "authorization_code", "code": code}
        async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
            response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        code_value = data.get("code", 0)
        if code_value != 0:
            raise RuntimeError(data.get("msg") or f"飞书免登 token 接口返回 code={code_value}")
        return data.get("data") or data

    async def get_user_info(self, user_access_token: str) -> dict[str, Any]:
        url = f"{settings.lark_api_base_url}/open-apis/authen/v1/user_info"
        headers = {"Authorization": f"Bearer {user_access_token}"}
        async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
            response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        code_value = data.get("code", 0)
        if code_value != 0:
            raise RuntimeError(data.get("msg") or f"飞书用户信息接口返回 code={code_value}")
        return data.get("data") or data

    async def send_text(self, open_id: str, text: str) -> LarkSendResult:
        content = {"text": text[: settings.lark_message_max_chars]}
        return await self._send_message(open_id, "text", content)

    async def send_interactive_card(self, open_id: str, card: dict[str, Any]) -> LarkSendResult:
        return await self._send_message(open_id, "interactive", card)

    async def _send_message(self, open_id: str, msg_type: str, content: dict[str, Any]) -> LarkSendResult:
        if not settings.lark_enabled:
            return LarkSendResult(False, "blocked", "飞书真实发送未启用")
        if not self.configured:
            return LarkSendResult(False, "blocked", "缺少飞书企业自建应用 app_id 或 app_secret")
        if not open_id:
            return LarkSendResult(False, "blocked", "目标用户未绑定飞书 open_id")

        try:
            token = await self._get_tenant_access_token()
            url = f"{settings.lark_api_base_url}/open-apis/im/v1/messages"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            }
            params = {"receive_id_type": settings.lark_message_receive_id_type}
            payload = {
                "receive_id": open_id,
                "msg_type": msg_type,
                "content": json.dumps(content, ensure_ascii=False),
            }
            async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
                response = await client.post(url, headers=headers, params=params, json=payload)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            return LarkSendResult(False, "failed", str(exc))

        code = data.get("code", 0)
        if code != 0:
            return LarkSendResult(False, "failed", data.get("msg") or f"飞书接口返回 code={code}", data)
        return LarkSendResult(True, "sent", "飞书消息发送成功", data)

    async def _get_tenant_access_token(self) -> str:
        now = time.time()
        refresh_at = self._tenant_access_token_expire_at - settings.lark_token_refresh_margin_seconds
        if self._tenant_access_token and now < refresh_at:
            return self._tenant_access_token

        if not self.configured:
            raise RuntimeError("缺少飞书企业自建应用 app_id 或 app_secret")

        url = f"{settings.lark_api_base_url}/open-apis/auth/v3/tenant_access_token/internal"
        payload = {"app_id": settings.lark_app_id, "app_secret": settings.lark_app_secret}
        async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
            response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

        code = data.get("code", 0)
        token = data.get("tenant_access_token") or ""
        if code != 0 or not token:
            raise RuntimeError(data.get("msg") or f"飞书 token 接口返回 code={code}")

        expires_in = int(data.get("expire") or data.get("expire_in") or 7200)
        self._tenant_access_token = token
        self._tenant_access_token_expire_at = time.time() + expires_in
        return token

    async def _get_app_access_token(self) -> str:
        now = time.time()
        refresh_at = self._app_access_token_expire_at - settings.lark_token_refresh_margin_seconds
        if self._app_access_token and now < refresh_at:
            return self._app_access_token

        if not self.configured:
            raise RuntimeError("缺少飞书企业自建应用 app_id 或 app_secret")

        url = f"{settings.lark_api_base_url}/open-apis/auth/v3/app_access_token/internal"
        payload = {"app_id": settings.lark_app_id, "app_secret": settings.lark_app_secret}
        async with httpx.AsyncClient(timeout=settings.lark_request_timeout_seconds, trust_env=False) as client:
            response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

        code = data.get("code", 0)
        token = data.get("app_access_token") or ""
        if code != 0 or not token:
            raise RuntimeError(data.get("msg") or f"飞书 app token 接口返回 code={code}")

        expires_in = int(data.get("expire") or data.get("expire_in") or 7200)
        self._app_access_token = token
        self._app_access_token_expire_at = time.time() + expires_in
        return token

    def _normalize_email_lookup_users(self, body: dict[str, Any]) -> dict[str, dict[str, Any]]:
        users: dict[str, dict[str, Any]] = {}
        for item in body.get("user_list") or []:
            email = str(item.get("email") or "").strip().lower()
            if email:
                users[email] = item
        for email, value in (body.get("email_users") or {}).items():
            if isinstance(value, list) and value:
                users[str(email).strip().lower()] = value[0]
            elif isinstance(value, dict):
                users[str(email).strip().lower()] = value
        return users


lark_client = LarkClient()
