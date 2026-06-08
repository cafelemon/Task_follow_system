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
        try:
            await self._get_tenant_access_token()
        except Exception as exc:
            return {**status, "ok": False, "message": str(exc)}
        return {**status, "ok": True, "message": "飞书 tenant_access_token 获取成功"}

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


lark_client = LarkClient()
