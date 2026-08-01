from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dealer import Dealer
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.product import ProductVariant
from app.models.stock import Stock
from app.services.helpers import paginate


def _period_bounds(range_key: str = "7d", on_date: date | None = None) -> tuple[datetime, datetime, date, int]:
    """Return (start_dt, end_dt, first_day, num_days) for the selected filter or date."""
    if on_date is not None:
        start = datetime.combine(on_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end, on_date, 1

    today = datetime.now(timezone.utc).date()
    if range_key == "today":
        start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end, today, 1

    days = 30 if range_key == "30d" else 7
    first = today - timedelta(days=days - 1)
    start = datetime.combine(first, datetime.min.time()).replace(tzinfo=timezone.utc)
    end = datetime.combine(today + timedelta(days=1), datetime.min.time()).replace(tzinfo=timezone.utc)
    return start, end, first, days


async def admin_summary(
    db: AsyncSession, range_key: str = "7d", on_date: date | None = None
) -> dict:
    start, end, _, _ = _period_bounds(range_key, on_date)

    pending = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(
            Order.status == "pending",
            Order.created_at >= start,
            Order.created_at < end,
        )
    ) or 0
    orders_count = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.created_at >= start, Order.created_at < end)
    ) or 0
    active_dealers = await db.scalar(
        select(func.count()).select_from(Dealer).where(Dealer.is_active.is_(True))
    ) or 0

    stocks = await db.execute(
        select(Stock).join(ProductVariant).where(ProductVariant.is_active.is_(True))
    )
    low = sum(1 for s in stocks.scalars().all() if s.quantity_available <= s.reorder_level)

    revenue = await db.scalar(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.status.in_(["approved", "fulfilled"]),
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
    ) or Decimal("0")

    return {
        "pending_orders": pending,
        "todays_orders": orders_count,
        "low_stock_alerts": low,
        "active_dealers": active_dealers,
        "revenue": revenue,
    }


async def sales_trend(
    db: AsyncSession, range_key: str = "7d", on_date: date | None = None
) -> dict:
    start, end, first_day, days = _period_bounds(range_key, on_date)

    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.variant))
        .where(
            Order.status.in_(["approved", "fulfilled"]),
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
    )
    orders = result.scalars().all()

    series_keys: set[str] = set()
    daily: dict[str, dict[str, int]] = {}
    categories = [(first_day + timedelta(days=i)).isoformat() for i in range(days)]
    for cat in categories:
        daily[cat] = {}

    for order in orders:
        if not order.reviewed_at:
            continue
        day = order.reviewed_at.date().isoformat()
        if day not in daily:
            continue
        for item in order.items:
            v = item.variant
            if not v:
                continue
            bottle = v.bottle_type or ""
            if bottle in ("pet", "plastic"):
                ml = int(round(float(v.volume_liters) * 1000))
                if ml == 300:
                    key = "PET (300 ml)"
                elif ml == 220:
                    key = "PET (220 ml)"
                else:
                    key = f"PET ({ml} ml)"
            else:
                key = "GLASS"
            series_keys.add(key)
            daily[day][key] = daily[day].get(key, 0) + item.quantity

    keys = sorted(series_keys) or ["GLASS", "PET (300 ml)", "PET (220 ml)"]
    series = [
        {"name": k, "type": "line", "stack": "Total", "data": [daily[c].get(k, 0) for c in categories]}
        for k in keys
    ]
    return {"categories": categories, "series": series}


# Syrup batch rules — per flavour, fractional batches by package type
SYRUP_KG_PER_BATCH = 52
CRATES_PER_BATCH = {
    "glass": 30,
    "pet_300": 20,
    "pet_220": 25,
}

FLAVOUR_ORDER = [
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


def _canonical_flavour(name: str) -> str | None:
    key = _flavour_key(name)
    for flavour in FLAVOUR_ORDER:
        if _flavour_key(flavour) == key:
            return flavour
    return None


def _round2(value: float) -> float:
    return round(float(value) + 0.0, 2)


def _package_bucket(variant: ProductVariant) -> str | None:
    bottle = variant.bottle_type or ""
    if bottle in ("pet", "plastic"):
        ml = int(round(float(variant.volume_liters) * 1000))
        if ml == 250:
            ml = 220
        if ml == 300:
            return "pet_300"
        if ml == 220:
            return "pet_220"
        return None
    return "glass"


def _flavour_batch_line(glass: int, pet_300: int, pet_220: int) -> dict:
    g = int(glass or 0)
    p300 = int(pet_300 or 0)
    p220 = int(pet_220 or 0)
    total_crates = g + p300 + p220
    batches = (
        (g / CRATES_PER_BATCH["glass"])
        + (p300 / CRATES_PER_BATCH["pet_300"])
        + (p220 / CRATES_PER_BATCH["pet_220"])
    )
    syrup = batches * SYRUP_KG_PER_BATCH
    return {
        "total_crates": total_crates,
        "batches_required": _round2(batches),
        "total_syrup_kg": _round2(syrup),
    }


async def batch_required(
    db: AsyncSession, range_key: str = "7d", on_date: date | None = None
) -> dict:
    """Syrup batches per flavour from approved orders (fractional, by package type)."""
    start, end, _, _ = _period_bounds(range_key, on_date)

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items)
            .selectinload(OrderItem.variant)
            .selectinload(ProductVariant.product)
        )
        .where(
            Order.status == "approved",
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
    )
    orders = result.scalars().all()

    crates_by_flavour = {
        f: {"glass": 0, "pet_300": 0, "pet_220": 0} for f in FLAVOUR_ORDER
    }
    for order in orders:
        for item in order.items:
            v = item.variant
            if not v or not v.product:
                continue
            flavour = _canonical_flavour(v.product.flavour_name)
            if not flavour:
                continue
            bucket = _package_bucket(v)
            if not bucket:
                continue
            crates_by_flavour[flavour][bucket] += int(item.quantity or 0)

    flavours = []
    grand_crates = 0
    grand_batches = 0.0
    grand_syrup = 0.0
    for flavour in FLAVOUR_ORDER:
        counts = crates_by_flavour[flavour]
        line = _flavour_batch_line(counts["glass"], counts["pet_300"], counts["pet_220"])
        flavours.append({"flavour": flavour.upper(), **line})
        grand_crates += line["total_crates"]
        grand_batches += line["batches_required"]
        grand_syrup += line["total_syrup_kg"]

    return {
        "flavours": flavours,
        "grand_total_crates": grand_crates,
        "grand_total_batches": _round2(grand_batches),
        "grand_total_syrup_kg": _round2(grand_syrup),
    }


async def dealer_summary(
    db: AsyncSession,
    dealer_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    filters = [Order.dealer_id == dealer_id]
    if date_from:
        filters.append(
            Order.created_at
            >= datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        )
    if date_to:
        filters.append(
            Order.created_at
            <= datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)
        )

    base = select(func.count()).select_from(Order).where(*filters)
    pending = await db.scalar(base.where(Order.status == "pending")) or 0
    approved = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(*filters, Order.status.in_(["approved", "fulfilled"]))
    ) or 0
    rejected = await db.scalar(base.where(Order.status == "rejected")) or 0
    total = await db.scalar(select(func.count()).select_from(Order).where(*filters)) or 0

    recent_q = select(Order).where(*filters).order_by(Order.created_at.desc()).limit(5)
    recent = await db.execute(recent_q)
    recent_orders = [
        {
            "id": str(o.id),
            "order_number": o.order_number,
            "status": o.status,
            "rejection_reason": o.rejection_reason,
            "total_amount": float(o.total_amount),
            "due_date": str(o.due_date),
            "created_at": o.created_at.isoformat(),
        }
        for o in recent.scalars().all()
    ]
    return {
        "pending_orders": pending,
        "approved_orders": approved,
        "rejected_orders": rejected,
        "total_orders": total,
        "recent_orders": recent_orders,
    }


async def list_notifications(
    db: AsyncSession, page: int = 1, page_size: int = 20, unread_only: bool = False
) -> tuple[list[Notification], dict, int]:
    query = select(Notification)
    count_q = select(func.count()).select_from(Notification)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
        count_q = count_q.where(Notification.is_read.is_(False))

    total = await db.scalar(count_q) or 0
    unread = await db.scalar(
        select(func.count()).select_from(Notification).where(Notification.is_read.is_(False))
    ) or 0
    result = await db.execute(
        query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), paginate(total, page, page_size), unread


async def mark_notifications_read(db: AsyncSession, ids: list[UUID] | None = None) -> int:
    if ids:
        result = await db.execute(select(Notification).where(Notification.id.in_(ids)))
    else:
        result = await db.execute(select(Notification).where(Notification.is_read.is_(False)))
    notes = result.scalars().all()
    for n in notes:
        n.is_read = True
    await db.flush()
    return len(notes)
