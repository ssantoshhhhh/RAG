from hmac import compare_digest

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    decode_token,
    issue_auth_cookies,
)
from app.db.session import get_db
from app.models import User
from app.repositories import user_repo
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = auth_service.register_user(db, payload)
    issue_auth_cookies(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> User:
    user = auth_service.authenticate_user(db, payload)
    issue_auth_cookies(response, user.id)
    return user


@router.post("/refresh", response_model=UserOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing"
        )
    try:
        user_id = decode_token(token, "refresh")
    except jwt.ExpiredSignatureError as exc:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        ) from exc

    user = user_repo.get_by_id(db, user_id)
    if user is None:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    issue_auth_cookies(response, user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_auth_cookies(response)


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    settings = get_settings()
    reset_url = auth_service.request_password_reset(db, str(payload.email))

    trusted_caller = bool(settings.internal_api_key) and compare_digest(
        request.headers.get("x-internal-key", ""), settings.internal_api_key or ""
    )
    if reset_url and settings.is_production and not trusted_caller:
        reset_url = None

    return ForgotPasswordResponse(
        message=auth_service.GENERIC_RESET_MESSAGE, reset_url=reset_url
    )


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)
) -> None:
    auth_service.reset_password(db, token=payload.token, new_password=payload.password)
    clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
