from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_dealer, get_current_user
from app.crud import orders as crud
from app.db.session import get_db
from app.models.dealer import Dealer
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut, OrderReject
from app.services.report_export import build_orders_pdf

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderOut)
async def create_order(
    body: OrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
):
    if not user.dealer:
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


@router.get("/export/pdf")
async def export_orders_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
    status: Optional[str] = None,
    dealer_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    period_label: Optional[str] = None,
):
    orders = await crud.list_orders_for_export(
        db,
        status_filter=status,
        dealer_id=dealer_id,
        date_from=date_from,
        date_to=date_to,
    )

    dealer_label = "All dealers"
    if dealer_id:
        dealer = await db.get(Dealer, dealer_id)
        if not dealer:
            raise HTTPException(status_code=404, detail="Dealer not found")
        dealer_label = (dealer.dealer_name or "").upper() or str(dealer_id)

    if date_from and date_to and date_from == date_to:
        dates_label = date_from.isoformat()
    elif date_from and date_to:
        dates_label = f"{date_from.isoformat()} to {date_to.isoformat()}"
    elif date_from:
        dates_label = f"From {date_from.isoformat()}"
    elif date_to:
        dates_label = f"Until {date_to.isoformat()}"
    else:
        dates_label = "All dates"

    period_text = period_label.strip() if period_label else dates_label
    if period_label and dates_label != "All dates" and period_label.strip() != dates_label:
        period_text = f"{period_label.strip()} ({dates_label})"

    rows = []
    total_amount = Decimal("0.00")
    for order in orders:
        out = crud.order_to_out(order)
        rows.append(
            {
                "order_number": out["order_number"],
                "dealer_name": (out["dealer_name"] or "").upper() if out["dealer_name"] else "—",
                "created_at": out["created_at"],
                "due_date": out["due_date"],
                "total_quantity": out["total_quantity"],
                "total_amount": out["total_amount"],
                "status": out["status"],
            }
        )
        total_amount += Decimal(out["total_amount"] or 0)

    generated_at = datetime.now(timezone.utc)
    data = {
        "meta": {
            "company": "Kaaraalan Goli Soda",
            "title": "Orders Report",
            "generated_by": admin.username or "admin",
            "generated_at": generated_at,
        },
        "filters": {
            "period_label": period_text,
            "status_label": status.upper() if status else "All statuses",
            "dealer_label": dealer_label,
        },
        "orders": rows,
        "total_orders": len(rows),
        "total_amount": total_amount,
    }

    content = build_orders_pdf(data)
    stamp = generated_at.strftime("%Y%m%d_%H%M%S")
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="kaaraalan_orders_{stamp}.pdf"'
        },
    )


@router.get("/mine")
async def my_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_dealer)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    if not user.dealer:
        raise HTTPException(status_code=400, detail="Dealer profile missing")
    items, meta = await crud.list_orders(
        db,
        page=page,
        page_size=page_size,
        dealer_id=user.dealer.id,
        date_from=date_from,
        date_to=date_to,
    )
    return {"items": [crud.order_to_out(o) for o in items], "meta": meta}


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    order = await crud.get_order(db, order_id)
    if user.role == "dealer" and (not user.dealer or order.dealer_id != user.dealer.id):
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


@router.patch("/{order_id}/fulfill", response_model=OrderOut)
async def fulfill_order(
    order_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    return crud.order_to_out(await crud.fulfill_order(db, order_id, admin.id))
