from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user
from app.crud import products as crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.product import CatalogProductCreate, CatalogProductOut, CatalogProductUpdate

router = APIRouter(tags=["products"])


@router.get("/products")
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    active_only: bool = False,
    product_type: Optional[str] = Query(None, pattern="^(glass|pet)$"),
):
    if user.role == "dealer":
        active_only = True
    items, meta = await crud.list_catalog(db, page, page_size, active_only, product_type)
    if user.role == "dealer":
        # Dealers must never receive inventory quantities
        items = [
            {k: v for k, v in item.items() if k not in ("stock", "quantity_available", "reorder_level")}
            for item in items
        ]
    return {"items": items, "meta": meta}


@router.post("/products", response_model=CatalogProductOut)
async def create_product(
    body: CatalogProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return await crud.create_catalog_product(db, body)


@router.patch("/products/{product_id}", response_model=CatalogProductOut)
async def update_product(
    product_id: UUID,
    body: CatalogProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    # product_id here is the catalog/variant id used by UI lists
    return await crud.update_catalog_product(db, product_id, body)


@router.delete("/products/{product_id}/permanent", response_model=CatalogProductOut)
async def permanently_delete_product(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return await crud.hard_delete_catalog_product(db, product_id)


@router.post("/products/{product_id}/reactivate", response_model=CatalogProductOut)
async def reactivate_product(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return await crud.reactivate_catalog_product(db, product_id)


@router.delete("/products/{product_id}", response_model=CatalogProductOut)
async def deactivate_product(
    product_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    """Soft-deactivate (reversible). Kept as DELETE for existing clients."""
    return await crud.soft_delete_catalog_product(db, product_id)


@router.patch("/variants/{variant_id}", response_model=CatalogProductOut)
async def update_variant(
    variant_id: UUID,
    body: CatalogProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    return await crud.update_catalog_product(db, variant_id, body)
