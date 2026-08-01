from datetime import date
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.crud import empty_crates as crud
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/empty-crates", tags=["empty-crates"])

PERIOD_PATTERN = "^(today|yesterday|7d|30d|custom)$"


class EmptyCrateItemIn(BaseModel):
    flavour: str
    available: int = Field(ge=0)


class EmptyCrateUpdateIn(BaseModel):
    items: list[EmptyCrateItemIn]
    non_colour_available: Optional[int] = Field(default=None, ge=0)
    comment: Optional[str] = Field(default=None, max_length=255)


@router.get("/summary")
async def empty_crates_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    range: str = Query("today", pattern=PERIOD_PATTERN),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    order_id: Optional[UUID] = None,
):
    try:
        return await crud.get_summary(
            db,
            range_key=range,
            date_from=date_from,
            date_to=date_to,
            order_id=order_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/balances")
async def update_empty_crates(
    body: EmptyCrateUpdateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    result = await crud.update_balances(
        db,
        admin=admin,
        items=[item.model_dump() for item in body.items],
        non_colour_available=body.non_colour_available,
        comment=body.comment,
    )
    summary = await crud.get_summary(db, range_key="today")
    return {
        **result,
        "flavours": summary["flavours"],
        "non_colour_available": summary["non_colour_available"],
        "totals": summary["totals"],
    }


@router.get("/history")
async def empty_crates_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    range: str = Query("30d", pattern=PERIOD_PATTERN),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    try:
        items, meta = await crud.list_history(
            db,
            page=page,
            page_size=page_size,
            range_key=range,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"items": items, "meta": meta}
