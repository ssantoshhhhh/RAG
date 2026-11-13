import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models import User
from app.repositories import password_reset_repo, user_repo
from app.schemas.auth import LoginRequest, RegisterRequest

GENERIC_RESET_MESSAGE = (
    "If an account exists for that email, we've sent instructions to reset your password."
)


def register_user(db: Session, payload: RegisterRequest) -> User:
    if user_repo.get_by_email(db, str(payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    user = user_repo.create(
        db,
        email=str(payload.email),
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: LoginRequest) -> User:
    user = user_repo.get_by_email(db, str(payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user


def request_password_reset(db: Session, email: str) -> str | None:
    """Create a single-use reset token and return its reset URL.

    Email delivery happens in the Next.js server (nodemailer). The API route
    only exposes this URL to trusted internal callers or outside production.
    """
    settings = get_settings()
    user = user_repo.get_by_email(db, email)
    if user is None:
        return None

    token = secrets.token_urlsafe(32)
    password_reset_repo.delete_for_user(db, user.id)
    password_reset_repo.create(
        db,
        user_id=user.id,
        token_hash=password_reset_repo.hash_token(token),
        expires_at=datetime.now(UTC)
        + timedelta(minutes=settings.password_reset_expire_minutes),
    )
    db.commit()

    return f"{settings.frontend_origin.rstrip('/')}/reset-password?token={token}"


def reset_password(db: Session, *, token: str, new_password: str) -> None:
    record = password_reset_repo.get_by_hash(db, password_reset_repo.hash_token(token))
    if record is None or record.used_at is not None or _is_expired(record.expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired",
        )

    user = user_repo.get_by_id(db, record.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired",
        )

    user.password_hash = hash_password(new_password)
    password_reset_repo.mark_used(db, record)
    db.commit()


def _is_expired(value: datetime) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value <= datetime.now(UTC)
