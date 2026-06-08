from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import quote, urlencode

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.entities import AuthSession, User

SESSION_COOKIE = "task_follow_session"
SESSION_DAYS = 7


def hash_password(password: str, *, salt: bytes | None = None, iterations: int = 260000) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return (
        f"pbkdf2_sha256${iterations}$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(digest).decode()}"
    )


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        scheme, iterations_text, salt_text, digest_text = password_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _lark_link_secret() -> bytes:
    secret = settings.lark_link_secret or settings.lark_app_secret
    if not secret:
        raise RuntimeError("Missing TASK_FOLLOW_LINK_SECRET or TASK_FOLLOW_LARK_APP_SECRET")
    return secret.encode("utf-8")


def _lark_oauth_state_secret() -> bytes:
    secret = settings.lark_oauth_state_secret or settings.lark_link_secret or settings.lark_app_secret
    if not secret:
        raise RuntimeError("Missing TASK_FOLLOW_LARK_OAUTH_STATE_SECRET")
    return secret.encode("utf-8")


def normalize_next_path(next_path: str | None) -> str:
    if not next_path or not next_path.startswith("/") or next_path.startswith("//"):
        return "/meeting-board/overview"
    if "\n" in next_path or "\r" in next_path:
        return "/meeting-board/overview"
    return next_path


def create_lark_login_token(user: User, next_path: str | None) -> str:
    if not user.open_id:
        raise ValueError("User has no open_id")
    payload = {
        "user_id": user.id,
        "open_id": user.open_id,
        "next_path": normalize_next_path(next_path),
        "exp": int(time.time()) + settings.lark_link_ttl_seconds,
        "nonce": secrets.token_urlsafe(12),
    }
    payload_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    payload_part = _b64url_encode(payload_text)
    signature = hmac.new(_lark_link_secret(), payload_part.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_part}.{_b64url_encode(signature)}"


def create_lark_login_url(user: User, next_path: str | None) -> str:
    token = create_lark_login_token(user, next_path)
    return f"{settings.web_base_url.rstrip('/')}/api/auth/lark-link?token={quote(token)}"


def create_lark_oauth_state(next_path: str | None) -> str:
    payload = {
        "next_path": normalize_next_path(next_path),
        "exp": int(time.time()) + settings.lark_oauth_state_ttl_seconds,
        "nonce": secrets.token_urlsafe(12),
    }
    payload_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    payload_part = _b64url_encode(payload_text)
    signature = hmac.new(_lark_oauth_state_secret(), payload_part.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_part}.{_b64url_encode(signature)}"


def verify_lark_oauth_state(state: str) -> str:
    try:
        payload_part, signature_part = state.split(".", 1)
        expected = hmac.new(_lark_oauth_state_secret(), payload_part.encode("ascii"), hashlib.sha256).digest()
        actual = _b64url_decode(signature_part)
        if not hmac.compare_digest(actual, expected):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="飞书免登 state 无效") from exc

    if int(payload.get("exp") or 0) < int(time.time()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="飞书免登 state 已过期")
    return normalize_next_path(payload.get("next_path"))


def create_lark_oauth_authorize_url(next_path: str | None) -> str:
    if not settings.lark_app_id:
        raise RuntimeError("Missing TASK_FOLLOW_LARK_APP_ID")
    query = urlencode(
        {
            "app_id": settings.lark_app_id,
            "redirect_uri": settings.lark_oauth_redirect_uri,
            "state": create_lark_oauth_state(next_path),
        }
    )
    return f"{settings.lark_api_base_url}/open-apis/authen/v1/authorize?{query}"


def verify_lark_login_token(db: Session, token: str) -> tuple[User, str]:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected = hmac.new(_lark_link_secret(), payload_part.encode("ascii"), hashlib.sha256).digest()
        actual = _b64url_decode(signature_part)
        if not hmac.compare_digest(actual, expected):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="飞书链接无效") from exc

    if int(payload.get("exp") or 0) < int(time.time()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="飞书链接已过期")

    user = db.get(User, payload.get("user_id"))
    if not user or user.status == "disabled":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="账号不可用")
    if not user.open_id or user.open_id != payload.get("open_id"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="飞书身份已变更")
    return user, normalize_next_path(payload.get("next_path"))


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    session = AuthSession(
        token_hash=token_hash(token),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
    )
    user.last_login_at = datetime.now(timezone.utc)
    db.add(session)
    db.add(user)
    db.commit()
    return token


def delete_session(db: Session, token: str | None) -> None:
    if not token:
        return
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(token)))
    if session:
        db.delete(session)
        db.commit()


def current_user_from_cookie(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> User:
    if not session_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(session_token)))
    expires_at = session.expires_at if session else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not session or not expires_at or expires_at < datetime.now(timezone.utc):
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return session.user
