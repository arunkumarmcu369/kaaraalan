from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product, ProductVariant
from app.models.stock import Stock
from app.schemas.product import CatalogProductCreate, CatalogProductUpdate
from app.services.helpers import generate_sku, paginate


def _normalize_type(bottle_type: str) -> str:
    if bottle_type in ("pet", "plastic"):
        return "pet"
    return "glass"


def _size_ml_from_volume(bottle_type: str, volume_liters) -> Optional[int]:
    if _normalize_type(bottle_type) != "pet":
        return None
    ml = int(round(float(volume_liters) * 1000))
    return ml if ml in (220, 300) else ml or None


def _size_label(product_type: str, size_ml: Optional[int]) -> str:
    if product_type == "pet" and size_ml == 300:
        return "PET (300 ml)"
    if product_type == "pet" and size_ml == 220:
        return "PET (220 ml)"
    if product_type == "glass":
        return "GLASS"
    return "—"


def _volume_from_size(product_type: str, size_ml: Optional[int]) -> Decimal:
    if product_type == "pet":
        return Decimal(str(size_ml)) / Decimal("1000")
    return Decimal("0")


def catalog_item_from_variant(variant: ProductVariant) -> dict:
    product_type = _normalize_type(variant.bottle_type)
    size_ml = _size_ml_from_volume(variant.bottle_type, variant.volume_liters)
    return {
        "id": variant.id,
        "product_id": variant.product_id,
        "name": variant.product.flavour_name if variant.product else "",
        "product_type": product_type,
        "size_ml": size_ml,
        "size_label": _size_label(product_type, size_ml),
        "price": variant.price,
        "stock": variant.stock.quantity_available if variant.stock else 0,
        "sku": variant.sku,
        "is_active": variant.is_active and (variant.product.is_active if variant.product else True),
        "created_at": variant.created_at,
    }


def variant_to_out(variant: ProductVariant) -> dict:
    item = catalog_item_from_variant(variant)
    return {
        "id": variant.id,
        "product_id": variant.product_id,
        "bottle_type": variant.bottle_type,
        "volume_liters": variant.volume_liters,
        "sku": variant.sku,
        "price": variant.price,
        "is_active": variant.is_active,
        "quantity_available": item["stock"],
        "reorder_level": variant.stock.reorder_level if variant.stock else 0,
        "flavour_name": item["name"],
        "product_type": item["product_type"],
        "size_ml": item["size_ml"],
        "size_label": item["size_label"],
    }


async def list_catalog(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
    active_only: bool = False,
    product_type: Optional[str] = None,
) -> tuple[list[dict], dict]:
    query = (
        select(ProductVariant)
        .join(Product)
        .options(selectinload(ProductVariant.stock), selectinload(ProductVariant.product))
    )
    count_q = select(func.count()).select_from(ProductVariant).join(Product)

    if active_only:
        query = query.where(ProductVariant.is_active.is_(True), Product.is_active.is_(True))
        count_q = count_q.where(ProductVariant.is_active.is_(True), Product.is_active.is_(True))

    if product_type:
        if product_type == "pet":
            query = query.where(ProductVariant.bottle_type.in_(["pet", "plastic"]))
            count_q = count_q.where(ProductVariant.bottle_type.in_(["pet", "plastic"]))
        else:
            query = query.where(ProductVariant.bottle_type == "glass")
            count_q = count_q.where(ProductVariant.bottle_type == "glass")

    total = await db.scalar(count_q) or 0
    result = await db.execute(
        query.order_by(Product.flavour_name, ProductVariant.bottle_type)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [catalog_item_from_variant(v) for v in result.scalars().all()]
    return items, paginate(total, page, page_size)


async def create_catalog_product(db: AsyncSession, data: CatalogProductCreate) -> dict:
    name = data.name.strip()
    result = await db.execute(
        select(Product).where(func.lower(Product.flavour_name) == name.lower())
    )
    product = result.scalar_one_or_none()
    if not product:
        product = Product(
            id=uuid4(),
            flavour_name=name,
            description=None,
            is_active=True,
        )
        db.add(product)
        await db.flush()
    else:
        product.is_active = True
        if product.flavour_name != name:
            product.flavour_name = name

    bottle_type = data.product_type
    volume = _volume_from_size(data.product_type, data.size_ml)

    existing_q = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == product.id,
            ProductVariant.bottle_type.in_(
                ["pet", "plastic"] if bottle_type == "pet" else [bottle_type]
            ),
            ProductVariant.volume_liters == volume,
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{name} already has a GLASS product"
                if bottle_type == "glass"
                else f"{name} already has a PET ({data.size_ml} ml) product"
            ),
        )

    variant = ProductVariant(
        id=uuid4(),
        product_id=product.id,
        bottle_type=bottle_type,
        volume_liters=volume,
        sku=generate_sku(name, bottle_type, float(volume) if volume else 0),
        price=data.price,
        is_active=True,
    )
    db.add(variant)
    await db.flush()

    stock = Stock(
        id=uuid4(),
        product_variant_id=variant.id,
        quantity_available=data.stock,
        reorder_level=10,
    )
    db.add(stock)
    await db.flush()
    return await get_catalog_item(db, variant.id)


async def get_catalog_item(db: AsyncSession, variant_id: UUID) -> dict:
    variant = await get_variant(db, variant_id)
    return catalog_item_from_variant(variant)


async def get_variant(db: AsyncSession, variant_id: UUID) -> ProductVariant:
    result = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.stock), selectinload(ProductVariant.product))
        .where(ProductVariant.id == variant_id)
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return variant


async def update_catalog_product(db: AsyncSession, variant_id: UUID, data: CatalogProductUpdate) -> dict:
    variant = await get_variant(db, variant_id)
    payload = data.model_dump(exclude_unset=True)

    if "name" in payload and variant.product:
        variant.product.flavour_name = payload["name"]

    product_type = payload.get("product_type") or _normalize_type(variant.bottle_type)
    if "product_type" in payload:
        variant.bottle_type = payload["product_type"]

    if product_type == "glass":
        variant.volume_liters = Decimal("0")
    elif "size_ml" in payload and payload["size_ml"] is not None:
        variant.volume_liters = _volume_from_size("pet", payload["size_ml"])
    elif product_type == "pet" and _size_ml_from_volume(variant.bottle_type, variant.volume_liters) is None:
        raise HTTPException(status_code=400, detail="PET products require size_ml of 220 or 300")

    if "price" in payload:
        variant.price = payload["price"]
    if "is_active" in payload:
        variant.is_active = payload["is_active"]
        if variant.product:
            variant.product.is_active = payload["is_active"]
    if "stock" in payload:
        if not variant.stock:
            variant.stock = Stock(
                id=uuid4(),
                product_variant_id=variant.id,
                quantity_available=payload["stock"],
                reorder_level=10,
            )
            db.add(variant.stock)
        else:
            variant.stock.quantity_available = payload["stock"]

    await db.flush()
    return await get_catalog_item(db, variant_id)


async def soft_delete_catalog_product(db: AsyncSession, variant_id: UUID) -> dict:
    return await update_catalog_product(db, variant_id, CatalogProductUpdate(is_active=False))


# Back-compat helpers used by stocks/orders display
async def list_products(db: AsyncSession, active_only: bool = False) -> list[Product]:
    query = select(Product).options(
        selectinload(Product.variants).selectinload(ProductVariant.stock)
    )
    if active_only:
        query = query.where(Product.is_active.is_(True))
    result = await db.execute(query.order_by(Product.flavour_name))
    return list(result.scalars().all())


def product_to_out(product: Product) -> dict:
    return {
        "id": product.id,
        "flavour_name": product.flavour_name,
        "description": product.description,
        "is_active": product.is_active,
        "created_at": product.created_at,
        "variants": [variant_to_out(v) for v in product.variants],
    }
