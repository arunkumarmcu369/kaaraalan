from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin
from app.crud import dealers as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.dealer import DealerCreate, DealerCredentialsOut, DealerOut, DealerUpdate

router = APIRouter(prefix="/dealers", tags=["dealers"])


@router.post("", response_model=DealerCredentialsOut)
async def create_dealer(
    body: DealerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_admin)],
):
    dealer_out, username, password = await crud.create_dealer(db, body, admin.id)
    return {
        "dealer": dealer_out,
        "username": username,
        "password": password,
    }


@router.get("")
async def list_dealers(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    active_only: bool = False,
):
    items, meta = await crud.list_dealers(db, page, page_size, search, active_only)
    return {"items": [crud.dealer_to_out(d) for d in items], "meta": meta}


@router.get("/{dealer_id}", response_model=DealerOut)
async def get_dealer(
    dealer_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return crud.dealer_to_out(await crud.get_dealer(db, dealer_id))


@router.patch("/{dealer_id}", response_model=DealerOut)
async def update_dealer(
    dealer_id: UUID,
    body: DealerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return crud.dealer_to_out(await crud.update_dealer(db, dealer_id, body))


@router.delete("/{dealer_id}", response_model=DealerOut)
async def delete_dealer(
    dealer_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return crud.dealer_to_out(await crud.soft_delete_dealer(db, dealer_id))
