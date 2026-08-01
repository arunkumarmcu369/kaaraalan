from typing import Annotated, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_dealer
from app.crud import stocks as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.stock import (
    DealerStockGroup,
    StockMatrixBulkUpdate,
    StockMatrixOut,
    StockOut,
    StockUpdate,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/matrix", response_model=StockMatrixOut)
async def stock_matrix(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return await crud.get_stock_matrix(db)


@router.put("/matrix", response_model=StockMatrixOut)
async def update_stock_matrix(
    body: StockMatrixBulkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    return await crud.bulk_update_stock_matrix(db, body, admin)


@router.get("/history")
async def stock_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    items, meta = await crud.list_stock_update_history(
        db, page, page_size, date_from=date_from, date_to=date_to
    )
    return {"items": items, "meta": meta}


@router.get("/low-stock")
async def low_stock(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    items = await crud.list_low_stock_items(db)
    return {"items": items, "count": len(items)}


@router.get("")
async def list_stocks(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    bottle_type: Optional[str] = None,
    low_only: bool = False,
):
    items, meta = await crud.list_stocks(db, page, page_size, bottle_type, low_only)
    return {"items": [crud.stock_to_out(s) for s in items], "meta": meta}


@router.get("/dealer-view", response_model=list[DealerStockGroup])
async def dealer_view(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_dealer)],
):
    return await crud.dealer_stock_view(db)


@router.patch("/{variant_id}", response_model=StockOut)
async def update_stock(
    variant_id: UUID,
    body: StockUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    stock = await crud.update_stock(db, variant_id, body, admin.id)
    return crud.stock_to_out(stock)
