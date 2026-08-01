from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product, ProductVariant
from app.models.stock import Stock, StockMovement
from app.models.stock_update_log import StockUpdateLog
from app.models.user import User
from app.schemas.stock import StockMatrixBulkUpdate, StockUpdate
from app.services.helpers import paginate

CANONICAL_FLAVOURS = [
    "Paneer",
    "Lemon",
    "Orange",
    "BlueBerry",
    "Ginger",
    "Nannari",
    "Grape",
    "Pineapple",
]

_FLAVOUR_ALIASES = {
    "blue berry": "blueberry",
    "blue-berry": "blueberry",
    "pine apple": "pineapple",
    "pine-apple": "pineapple",
    "panneer": "paneer",
    "panner": "paneer",
}


def _flavour_key(name: str) -> str:
    key = " ".join(str(name or "").strip().lower().replace("_", " ").replace("-", " ").split())
    return _FLAVOUR_ALIASES.get(key, key)


def _canonical_flavour(name: str) -> Optional[str]:
    key = _flavour_key(name)
    for flavour in CANONICAL_FLAVOURS:
        if _flavour_key(flavour) == key:
            return flavour
    return None


def _is_pet(bottle_type: str) -> bool:
    return bottle_type in ("pet", "plastic")


def _display_size_label(bottle_type: str, volume_liters=None, size_ml: Optional[int] = None) -> str:
    if not _is_pet(bottle_type):
        return "GLASS"
    ml = size_ml
    if ml is None and volume_liters is not None:
        ml = int(round(float(volume_liters) * 1000))
    if ml == 300:
        return "PET (300 ml)"
    if ml == 220:
        return "PET (220 ml)"
    return f"PET ({ml} ml)" if ml else "—"


async def list_stocks(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    bottle_type: Optional[str] = None,
    low_only: bool = False,
) -> tuple[list[Stock], dict]:
    query = (
        select(Stock)
        .join(ProductVariant)
        .options(selectinload(Stock.variant).selectinload(ProductVariant.product))
        .where(ProductVariant.is_active.is_(True))
    )
    if bottle_type:
        if bottle_type in ("pet", "plastic"):
            query = query.where(ProductVariant.bottle_type.in_(["pet", "plastic"]))
        else:
            query = query.where(ProductVariant.bottle_type == bottle_type)

    result = await db.execute(query.order_by(ProductVariant.sku))
    stocks = list(result.scalars().all())

    if low_only:
        stocks = [s for s in stocks if s.quantity_available <= s.reorder_level]

    total = len(stocks)
    start = (page - 1) * page_size
    page_items = stocks[start : start + page_size]
    return page_items, paginate(total, page, page_size)


async def update_stock(
    db: AsyncSession, variant_id: UUID, data: StockUpdate, user_id: UUID
) -> Stock:
    result = await db.execute(
        select(Stock)
        .options(selectinload(Stock.variant).selectinload(ProductVariant.product))
        .where(Stock.product_variant_id == variant_id)
    )
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock not found")

    new_qty = stock.quantity_available + data.quantity_delta
    if new_qty < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock for adjustment")

    stock.quantity_available = new_qty
    if data.reorder_level is not None:
        stock.reorder_level = data.reorder_level

    movement = StockMovement(
        id=uuid4(),
        product_variant_id=variant_id,
        change_qty=data.quantity_delta,
        reason=data.reason,
        created_by=user_id,
    )
    db.add(movement)
    await db.flush()
    await db.refresh(stock)
    return stock


async def dealer_stock_view(db: AsyncSession) -> list[dict]:
    """Return flavour groups with glass/pet variants (including zero stock for order matrix)."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.variants).selectinload(ProductVariant.stock))
        .where(Product.is_active.is_(True))
        .order_by(Product.flavour_name)
    )
    products = result.scalars().all()
    groups = []
    for product in products:
        variants = []
        for v in product.variants:
            if not v.is_active:
                continue
            qty = v.stock.quantity_available if v.stock else 0
            variants.append(
                {
                    "id": v.id,
                    "bottle_type": v.bottle_type,
                    "product_type": "pet" if _is_pet(v.bottle_type) else "glass",
                    "volume_liters": v.volume_liters,
                    "size_ml": int(round(float(v.volume_liters) * 1000))
                    if _is_pet(v.bottle_type)
                    else None,
                    "size_label": _display_size_label(v.bottle_type, v.volume_liters),
                    "sku": v.sku,
                    "price": v.price,
                    "quantity_available": qty,
                    "flavour_name": product.flavour_name,
                    "name": product.flavour_name,
                }
            )
        if variants:
            groups.append(
                {
                    "product_id": product.id,
                    "flavour_name": product.flavour_name,
                    "description": product.description,
                    "variants": variants,
                }
            )
    return groups


async def _load_flavour_variant_map(db: AsyncSession) -> dict[str, dict]:
    """Map canonical flavour → {glass, pet_300, pet_220} variant lists."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.variants).selectinload(ProductVariant.stock))
        .where(Product.is_active.is_(True))
    )
    mapping: dict[str, dict] = {
        f: {"glass": [], "pet_300": [], "pet_220": []} for f in CANONICAL_FLAVOURS
    }
    for product in result.scalars().all():
        canon = _canonical_flavour(product.flavour_name)
        if not canon:
            continue
        for v in product.variants:
            if not v.is_active:
                continue
            if not _is_pet(v.bottle_type):
                mapping[canon]["glass"].append(v)
                continue
            size_ml = int(round(float(v.volume_liters) * 1000))
            if size_ml == 300:
                mapping[canon]["pet_300"].append(v)
            elif size_ml == 220:
                mapping[canon]["pet_220"].append(v)
    return mapping


def _qty(variant: ProductVariant) -> int:
    return int(variant.stock.quantity_available) if variant.stock else 0


def _matrix_rows_from_map(mapping: dict[str, dict]) -> list[dict]:
    rows = []
    for flavour in CANONICAL_FLAVOURS:
        rows.append(
            {
                "flavour": flavour,
                "glass": sum(_qty(v) for v in mapping[flavour]["glass"]),
                "pet_300": sum(_qty(v) for v in mapping[flavour]["pet_300"]),
                "pet_220": sum(_qty(v) for v in mapping[flavour]["pet_220"]),
            }
        )
    return rows


def _totals_from_rows(rows: list[dict]) -> dict:
    return {
        "glass": sum(int(r["glass"]) for r in rows),
        "pet_300": sum(int(r["pet_300"]) for r in rows),
        "pet_220": sum(int(r["pet_220"]) for r in rows),
    }


async def _latest_log(db: AsyncSession) -> Optional[StockUpdateLog]:
    result = await db.execute(
        select(StockUpdateLog).order_by(StockUpdateLog.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def get_stock_matrix(db: AsyncSession) -> dict:
    mapping = await _load_flavour_variant_map(db)
    rows = _matrix_rows_from_map(mapping)
    totals = _totals_from_rows(rows)
    log = await _latest_log(db)
    info = {
        "last_updated_at": log.created_at if log else None,
        "updated_by": log.updated_by_username if log else None,
        "previous_total_glass": log.previous_glass_total if log else None,
        "previous_total_pet_300": log.previous_pet_300_total if log else None,
        "previous_total_pet_220": log.previous_pet_220_total if log else None,
        "current_total_glass": totals["glass"],
        "current_total_pet_300": totals["pet_300"],
        "current_total_pet_220": totals["pet_220"],
    }
    return {"rows": rows, "totals": totals, "info": info}


async def _ensure_stock(db: AsyncSession, variant: ProductVariant) -> Stock:
    if variant.stock:
        return variant.stock
    stock = Stock(
        id=uuid4(),
        product_variant_id=variant.id,
        quantity_available=0,
        reorder_level=10,
    )
    db.add(stock)
    await db.flush()
    variant.stock = stock
    return stock


async def _set_absolute_qty(
    db: AsyncSession, variant: ProductVariant, new_qty: int, user_id: UUID
) -> None:
    stock = await _ensure_stock(db, variant)
    old = int(stock.quantity_available)
    delta = int(new_qty) - old
    if delta == 0:
        return
    stock.quantity_available = int(new_qty)
    db.add(
        StockMovement(
            id=uuid4(),
            product_variant_id=variant.id,
            change_qty=delta,
            reason="restock" if delta > 0 else "adjustment",
            created_by=user_id,
        )
    )


async def _set_bucket_qty(
    db: AsyncSession,
    variants: list[ProductVariant],
    new_qty: int,
    user_id: UUID,
    label: str,
    flavour: str,
) -> None:
    if variants:
        primary, *extras = variants
        await _set_absolute_qty(db, primary, new_qty, user_id)
        for v in extras:
            await _set_absolute_qty(db, v, 0, user_id)
    elif new_qty > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No {label} product found for {flavour}",
        )


async def bulk_update_stock_matrix(
    db: AsyncSession, data: StockMatrixBulkUpdate, admin: User
) -> dict:
    mapping = await _load_flavour_variant_map(db)
    prev_rows = _matrix_rows_from_map(mapping)
    prev_totals = _totals_from_rows(prev_rows)

    incoming = {_canonical_flavour(r.flavour) or r.flavour: r for r in data.rows}
    for flavour in CANONICAL_FLAVOURS:
        row = incoming.get(flavour)
        if not row:
            continue
        await _set_bucket_qty(
            db, mapping[flavour]["glass"], row.glass, admin.id, "GLASS", flavour
        )
        await _set_bucket_qty(
            db, mapping[flavour]["pet_300"], row.pet_300, admin.id, "PET (300 ml)", flavour
        )
        await _set_bucket_qty(
            db, mapping[flavour]["pet_220"], row.pet_220, admin.id, "PET (220 ml)", flavour
        )

    await db.flush()

    mapping = await _load_flavour_variant_map(db)
    new_rows = _matrix_rows_from_map(mapping)
    new_totals = _totals_from_rows(new_rows)

    log = StockUpdateLog(
        id=uuid4(),
        previous_glass_total=prev_totals["glass"],
        previous_pet_300_total=prev_totals["pet_300"],
        previous_pet_220_total=prev_totals["pet_220"],
        new_glass_total=new_totals["glass"],
        new_pet_300_total=new_totals["pet_300"],
        new_pet_220_total=new_totals["pet_220"],
        updated_by_id=admin.id,
        updated_by_username=admin.username,
    )
    db.add(log)
    await db.flush()

    return await get_stock_matrix(db)


async def list_stock_update_history(
    db: AsyncSession, page: int = 1, page_size: int = 25
) -> tuple[list[dict], dict]:
    total = await db.scalar(select(func.count()).select_from(StockUpdateLog)) or 0
    result = await db.execute(
        select(StockUpdateLog)
        .order_by(StockUpdateLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [
        {
            "id": log.id,
            "previous_glass_total": log.previous_glass_total,
            "previous_pet_300_total": log.previous_pet_300_total,
            "previous_pet_220_total": log.previous_pet_220_total,
            "new_glass_total": log.new_glass_total,
            "new_pet_300_total": log.new_pet_300_total,
            "new_pet_220_total": log.new_pet_220_total,
            "updated_by": log.updated_by_username,
            "created_at": log.created_at,
        }
        for log in result.scalars().all()
    ]
    return items, paginate(total, page, page_size)


def stock_to_out(stock: Stock) -> dict:
    v = stock.variant
    bottle = v.bottle_type if v else ""
    product_type = "pet" if bottle in ("pet", "plastic") else "glass"
    size_ml = None
    if product_type == "pet" and v:
        size_ml = int(round(float(v.volume_liters) * 1000)) or None
    return {
        "id": stock.id,
        "product_variant_id": stock.product_variant_id,
        "quantity_available": stock.quantity_available,
        "reorder_level": stock.reorder_level,
        "updated_at": stock.updated_at,
        "flavour_name": v.product.flavour_name if v and v.product else "",
        "name": v.product.flavour_name if v and v.product else "",
        "bottle_type": bottle,
        "product_type": product_type,
        "size_ml": size_ml,
        "size_label": _display_size_label(bottle, v.volume_liters if v else None, size_ml),
        "volume_liters": v.volume_liters if v else 0,
        "sku": v.sku if v else "",
        "price": v.price if v else 0,
        "is_low": stock.quantity_available <= stock.reorder_level,
    }
