from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_dealer, get_current_user
from app.crud import orders as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut, OrderReject

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut)
async def create_order(
    body: OrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
):
    if not user.dealer:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Dealer profile missing")
    order = await crud.create_order(db, user.dealer.id, body)
    return crud.order_to_out(order)


@router.get("")
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    dealer_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    items, meta = await crud.list_orders(db, page, page_size, status, dealer_id, date_from, date_to)
    return {"items": [crud.order_to_out(o) for o in items], "meta": meta}


@router.get("/mine")
async def my_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    if not user.dealer:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Dealer profile missing")
    items, meta = await crud.list_dealer_orders(db, user.dealer.id, page, page_size)
    return {"items": [crud.order_to_out(o) for o in items], "meta": meta}


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    order = await crud.get_order(db, order_id)
    if user.role == "dealer" and (not user.dealer or order.dealer_id != user.dealer.id):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    return crud.order_to_out(order)


@router.patch("/{order_id}/approve", response_model=OrderOut)
async def approve_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    return crud.order_to_out(await crud.approve_order(db, order_id, admin.id))


@router.patch("/{order_id}/reject", response_model=OrderOut)
async def reject_order(
    order_id: UUID,
    body: OrderReject,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    return crud.order_to_out(await crud.reject_order(db, order_id, admin.id, body))
