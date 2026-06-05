from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import secrets

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

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
