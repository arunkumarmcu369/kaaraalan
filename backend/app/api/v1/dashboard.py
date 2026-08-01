from typing import Annotated, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_dealer, get_current_user
from app.crud import dashboard as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AdminSummary,
    BatchRequiredOut,
    DealerSummary,
    NotificationOut,
    PendingOrderDetailOut,
    RevenueReportOut,
    SalesTrendOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

PERIOD_PATTERN = "^(today|yesterday|7d|30d|custom)$"


def _period_kwargs(
    range: str,
    date: Optional[date],
    date_from: Optional[date],
    date_to: Optional[date],
) -> dict:
    return {
        "range_key": range,
        "on_date": date,
        "date_from": date_from,
        "date_to": date_to,
    }


@router.get("/admin/summary", response_model=AdminSummary)
async def admin_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern=PERIOD_PATTERN),
    date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return await crud.admin_summary(db, **_period_kwargs(range, date, date_from, date_to))


@router.get("/admin/pending-orders", response_model=list[PendingOrderDetailOut])
async def pending_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern=PERIOD_PATTERN),
    date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return await crud.pending_orders_detail(db, **_period_kwargs(range, date, date_from, date_to))


@router.get("/admin/revenue-report", response_model=RevenueReportOut)
async def revenue_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern=PERIOD_PATTERN),
    date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return await crud.revenue_report(db, **_period_kwargs(range, date, date_from, date_to))


@router.get("/admin/sales-trend", response_model=SalesTrendOut)
async def sales_trend(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern=PERIOD_PATTERN),
    date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return await crud.sales_trend(db, **_period_kwargs(range, date, date_from, date_to))


@router.get("/admin/batch-required", response_model=BatchRequiredOut)
async def batch_required(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("7d", pattern=PERIOD_PATTERN),
    date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    order_id: Optional[UUID] = None,
):
    try:
        return await crud.batch_required(
            db,
            order_id=order_id,
            **_period_kwargs(range, date, date_from, date_to),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/dealer/summary", response_model=DealerSummary)
async def dealer_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
    range: Optional[str] = Query(None, pattern=PERIOD_PATTERN),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    if not user.dealer:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Dealer profile missing")
    return await crud.dealer_summary(
        db,
        user.dealer.id,
        date_from=date_from,
        date_to=date_to,
        range_key=range,
    )


@router.get("/notifications")
async def notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
):
    if user.role == "admin":
        items, meta, unread = await crud.list_notifications(
            db, admin_feed=True, page=page, page_size=page_size, unread_only=unread_only
        )
    else:
        items, meta, unread = await crud.list_notifications(
            db, user_id=user.id, page=page, page_size=page_size, unread_only=unread_only
        )
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
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role == "admin":
        count = await crud.mark_notifications_read(db, body.ids, admin_feed=True)
    else:
        count = await crud.mark_notifications_read(db, body.ids, user_id=user.id)
    return {"marked": count}
