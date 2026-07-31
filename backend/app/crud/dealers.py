from math import ceil
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.dealer import Dealer
from app.models.user import User
from app.schemas.dealer import DealerCreate, DealerUpdate
from app.services.helpers import generate_password, generate_unique_username, paginate


async def create_dealer(db: AsyncSession, data: DealerCreate, admin_id: UUID) -> tuple[dict, str, str]:
    username = await generate_unique_username(db, data.shop_name, data.dealer_name)
    password = generate_password(14)
    user = User(
        id=uuid4(),
        username=username,
        password_hash=hash_password(password),
        role="dealer",
        must_reset_password=True,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    dealer_id = uuid4()
    dealer = Dealer(
        id=dealer_id,
        user_id=user.id,
        dealer_name=data.dealer_name,
        shop_name=data.shop_name,
        phone=data.phone,
        email=str(data.email) if data.email else None,
        address=data.address,
        gst_number=data.gst_number,
        onboarded_by=admin_id,
        is_active=True,
    )
    db.add(dealer)
    await db.flush()

    out = {
        "id": dealer_id,
        "user_id": user.id,
        "dealer_name": data.dealer_name,
        "shop_name": data.shop_name,
        "phone": data.phone,
        "email": str(data.email) if data.email else None,
        "address": data.address,
        "gst_number": data.gst_number,
        "is_active": True,
        "username": username,
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
    for field, value in payload.items():
        if field == "email" and value is not None:
            value = str(value)
        setattr(dealer, field, value)
    if "is_active" in payload and dealer.user is not None:
        dealer.user.is_active = payload["is_active"]
    await db.flush()
    return await get_dealer(db, dealer_id)


async def soft_delete_dealer(db: AsyncSession, dealer_id: UUID) -> Dealer:
    return await update_dealer(db, dealer_id, DealerUpdate(is_active=False))


def dealer_to_out(dealer: Dealer, username: str | None = None) -> dict:
    resolved_username = username
    if resolved_username is None and "user" in dealer.__dict__:
        resolved_username = dealer.user.username if dealer.user else None
    return {
        "id": dealer.id,
        "user_id": dealer.user_id,
        "dealer_name": dealer.dealer_name,
        "shop_name": dealer.shop_name,
        "phone": dealer.phone,
        "email": dealer.email,
        "address": dealer.address,
        "gst_number": dealer.gst_number,
        "is_active": dealer.is_active,
        "username": resolved_username,
        "created_at": dealer.created_at,
    }
