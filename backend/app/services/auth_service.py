from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    safe_decode_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services.helpers import hash_token


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    common = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE,
        "samesite": "lax",
        "path": "/",
    }
    # Don't set domain for localhost — browsers reject Domain=localhost
    if settings.COOKIE_DOMAIN and settings.COOKIE_DOMAIN not in ("localhost", "127.0.0.1"):
        common["domain"] = settings.COOKIE_DOMAIN

    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **common,
    )
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    common = {"path": "/"}
    if settings.COOKIE_DOMAIN and settings.COOKIE_DOMAIN not in ("localhost", "127.0.0.1"):
        common["domain"] = settings.COOKIE_DOMAIN
    response.delete_cookie(settings.ACCESS_COOKIE_NAME, **common)
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, **common)


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.dealer)).where(User.username == username)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return user


async def issue_tokens(db: AsyncSession, user: User, response: Response) -> None:
    jti = str(uuid4())
    access = create_access_token(user.id, {"role": user.role})
    refresh = create_refresh_token(user.id, jti)
    token_row = RefreshToken(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(token_row)
    await db.flush()
    set_auth_cookies(response, access, refresh)


async def rotate_refresh_token(
    db: AsyncSession, refresh_token: Optional[str], response: Response
) -> User:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    payload = safe_decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = hash_token(refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if not stored:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token not found")

    if stored.revoked:
        # Reuse detection — revoke all tokens for this user
        await db.execute(
            update(RefreshToken).where(RefreshToken.user_id == stored.user_id).values(revoked=True)
        )
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected — session invalidated",
        )

    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        stored.revoked = True
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user_result = await db.execute(
        select(User).options(selectinload(User.dealer)).where(User.id == stored.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    stored.revoked = True
    new_jti = str(uuid4())
    new_refresh = create_refresh_token(user.id, new_jti)
    new_row = RefreshToken(
        id=uuid4(),
        user_id=user.id,
        token_hash=hash_token(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(new_row)
    await db.flush()
    stored.replaced_by_id = new_row.id

    access = create_access_token(user.id, {"role": user.role})
    set_auth_cookies(response, access, new_refresh)
    return user


async def revoke_refresh_token(db: AsyncSession, refresh_token: Optional[str]) -> None:
    if not refresh_token:
        return
    token_hash = hash_token(refresh_token)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True


def user_to_out(user: User) -> dict:
    data = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "must_reset_password": user.must_reset_password,
        "is_active": user.is_active,
        "dealer_id": None,
        "dealer_name": None,
    }
    if user.dealer:
        data["dealer_id"] = user.dealer.id
        data["dealer_name"] = user.dealer.dealer_name
    return data
