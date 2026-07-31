from typing import Annotated, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_dealer
from app.crud import dashboard as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AdminSummary,
    BatchRequiredOut,
    DealerSummary,
    NotificationOut,
    SalesTrendOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin/summary", response_model=AdminSummary)
async def admin_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern="^(today|7d|30d)$"),
    date: Optional[date] = None,
):
    return await crud.admin_summary(db, range, date)


@router.get("/admin/sales-trend", response_model=SalesTrendOut)
async def sales_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern="^(today|7d|30d)$"),
    date: Optional[date] = None,
):
    return await crud.sales_trend(db, range, date)


@router.get("/admin/batch-required", response_model=BatchRequiredOut)
async def batch_required(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern="^(today|7d|30d)$"),
    date: Optional[date] = None,
):
    return await crud.batch_required(db, range, date)


@router.get("/dealer/summary", response_model=DealerSummary)
async def dealer_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    if not user.dealer:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Dealer profile missing")
    return await crud.dealer_summary(db, user.dealer.id, date_from, date_to)


@router.get("/notifications")
async def notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
):
    items, meta, unread = await crud.list_notifications(db, page, page_size, unread_only)
    return {
        "items": [
            {
                "id": n.id,
                "type": n.type,
                "message": n.message,
                "order_id": n.order_id,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in items
        ],
        "meta": meta,
        "unread_count": unread,
    }


class MarkReadBody(BaseModel):
    ids: Optional[list[UUID]] = None


@router.post("/notifications/mark-read")
async def mark_read(
    body: MarkReadBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    count = await crud.mark_notifications_read(db, body.ids)
    return {"marked": count}
