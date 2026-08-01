from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decrypt_password, encrypt_password, hash_password
from app.models.dealer import Dealer
from app.models.notification import Notification
from app.models.order import Order
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.dealer import DealerCreate, DealerUpdate
from app.services.helpers import generate_unique_username, paginate


async def create_dealer(db: AsyncSession, data: DealerCreate, admin_id: UUID) -> tuple[dict, str, str]:
    dealer_name = data.dealer_name.strip().upper()
    username = await generate_unique_username(db, data.shop_name, dealer_name)
    password = dealer_name
    user = User(
        id=uuid4(),
        username=username,
        password_hash=hash_password(password),
        password_plain=encrypt_password(password),
        role="dealer",
        must_reset_password=True,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    phone = (data.phone or "").strip() or ""

    dealer_id = uuid4()
    dealer = Dealer(
        id=dealer_id,
        user_id=user.id,
        dealer_name=dealer_name,
        shop_name=(data.shop_name.strip().upper() if data.shop_name else None),
        phone=phone,
        email=str(data.email) if data.email else None,
        address=None,
        gst_number=None,
        onboarded_by=admin_id,
        is_active=True,
    )
    db.add(dealer)
    await db.flush()

    out = {
        "id": dealer_id,
        "user_id": user.id,
        "dealer_name": dealer.dealer_name,
        "shop_name": dealer.shop_name,
        "phone": phone or None,
        "email": str(data.email) if data.email else None,
        "address": None,
        "gst_number": None,
        "is_active": True,
        "username": username,
        "password": password,
        "created_at": datetime.now(timezone.utc),
    }
    return out, username, password


async def list_dealers(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    active_only: bool = False,
) -> tuple[list[Dealer], dict]:
    query = select(Dealer).options(selectinload(Dealer.user))
    count_q = select(func.count()).select_from(Dealer)

    if active_only:
        query = query.where(Dealer.is_active.is_(True))
        count_q = count_q.where(Dealer.is_active.is_(True))

    if search:
        like = f"%{search}%"
        filt = or_(
            Dealer.dealer_name.ilike(like),
            Dealer.shop_name.ilike(like),
            Dealer.phone.ilike(like),
            Dealer.email.ilike(like),
        )
        query = query.where(filt)
        count_q = count_q.where(filt)

    total = await db.scalar(count_q) or 0
    result = await db.execute(
        query.order_by(Dealer.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), paginate(total, page, page_size)


async def get_dealer(db: AsyncSession, dealer_id: UUID) -> Dealer:
    result = await db.execute(
        select(Dealer).options(selectinload(Dealer.user)).where(Dealer.id == dealer_id)
    )
    dealer = result.scalar_one_or_none()
    if not dealer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dealer not found")
    return dealer


async def update_dealer(db: AsyncSession, dealer_id: UUID, data: DealerUpdate) -> Dealer:
    dealer = await get_dealer(db, dealer_id)
    payload = data.model_dump(exclude_unset=True)
    username = payload.pop("username", None)
    password = payload.pop("password", None)
    payload.pop("current_password", None)
    payload.pop("address", None)
    payload.pop("gst_number", None)
    payload.pop("is_active", None)

    for field, value in payload.items():
        if field == "email" and value is not None:
            value = str(value)
        if field == "dealer_name" and value is not None:
            value = str(value).strip().upper()
        if field == "shop_name" and value is not None:
            value = str(value).strip().upper() or None
        if field == "phone":
            value = str(value or "").strip()
        setattr(dealer, field, value)

    if dealer.user is not None:
        if username is not None:
            new_username = username.strip().lower()
            if not new_username:
                raise HTTPException(status_code=400, detail="Username cannot be empty")
            existing = await db.scalar(
                select(User.id).where(User.username == new_username, User.id != dealer.user_id)
            )
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
            dealer.user.username = new_username

        if password is not None and str(password).strip():
            plain = str(password).strip()
            dealer.user.password_hash = hash_password(plain)
            dealer.user.password_plain = encrypt_password(plain)
            dealer.user.must_reset_password = True

    await db.flush()
    return await get_dealer(db, dealer_id)


async def deactivate_dealer(db: AsyncSession, dealer_id: UUID) -> Dealer:
    """Soft-deactivate dealer: block login and new orders; keep historical data."""
    dealer = await get_dealer(db, dealer_id)
    dealer.is_active = False
    if dealer.user is not None:
        dealer.user.is_active = False
        # Invalidate sessions so a deactivated dealer cannot stay logged in
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == dealer.user_id))
    await db.flush()
    return await get_dealer(db, dealer_id)


async def reactivate_dealer(db: AsyncSession, dealer_id: UUID) -> Dealer:
    """Restore dealer login and ordering access."""
    dealer = await get_dealer(db, dealer_id)
    dealer.is_active = True
    if dealer.user is not None:
        dealer.user.is_active = True
    await db.flush()
    return await get_dealer(db, dealer_id)


DEALER_HISTORICAL_DELETE_MSG = (
    "This dealer has historical records and cannot be deleted. Please deactivate instead."
)


async def hard_delete_dealer(db: AsyncSession, dealer_id: UUID) -> None:
    """Permanently delete dealer only when there are no historical records."""
    dealer = await get_dealer(db, dealer_id)
    user_id = dealer.user_id

    order_count = await db.scalar(
        select(func.count()).select_from(Order).where(Order.dealer_id == dealer.id)
    )
    notif_count = 0
    if user_id:
        notif_count = await db.scalar(
            select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
        ) or 0
    order_notif_count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .join(Order, Notification.order_id == Order.id)
        .where(Order.dealer_id == dealer.id)
    )

    if (order_count or 0) > 0 or (notif_count or 0) > 0 or (order_notif_count or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=DEALER_HISTORICAL_DELETE_MSG,
        )

    if user_id:
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))

    await db.delete(dealer)
    await db.flush()

    if user_id:
        user = await db.get(User, user_id)
        if user and user.role == "dealer":
            await db.delete(user)
            await db.flush()


def dealer_to_out(dealer: Dealer, username: str | None = None) -> dict:
    resolved_username = username
    plain_password = None
    if resolved_username is None and "user" in dealer.__dict__:
        resolved_username = dealer.user.username if dealer.user else None
    if "user" in dealer.__dict__ and dealer.user is not None:
        plain_password = decrypt_password(dealer.user.password_plain)
    return {
        "id": dealer.id,
        "user_id": dealer.user_id,
        "dealer_name": dealer.dealer_name,
        "shop_name": dealer.shop_name,
        "phone": dealer.phone or None,
        "email": dealer.email,
        "address": dealer.address,
        "gst_number": dealer.gst_number,
        "is_active": dealer.is_active,
        "username": resolved_username,
        "password": plain_password,
        "created_at": dealer.created_at,
    }
