from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, MessageOut, PasswordChangeRequest, UserOut
from app.services.auth_service import (
    authenticate_user,
    clear_auth_cookies,
    issue_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    user_to_out,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await authenticate_user(db, body.username, body.password)
    await issue_tokens(db, user, response)
    return user_to_out(user)


@router.post("/refresh", response_model=UserOut)
async def refresh(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie(alias=settings.REFRESH_COOKIE_NAME)] = None,
):
    user = await rotate_refresh_token(db, refresh_token, response)
    return user_to_out(user)


@router.post("/logout", response_model=MessageOut)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie(alias=settings.REFRESH_COOKIE_NAME)] = None,
):
    await revoke_refresh_token(db, refresh_token)
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return user_to_out(user)


@router.post("/change-password", response_model=MessageOut)
async def change_password(
    body: PasswordChangeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not verify_password(body.current_password, user.password_hash):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    user.must_reset_password = False
    await db.flush()
    return {"message": "Password updated"}
