from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
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
from app.services.period import resolve_period_bounds


def _period_bounds(
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[datetime, datetime, date, int]:
    """Return (start_dt, end_dt, first_day, num_days) for the selected filter."""
    return resolve_period_bounds(
        range_key,
        on_date=on_date,
        date_from=date_from,
        date_to=date_to,
    )


async def admin_summary(
    db: AsyncSession,
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    start, end, _, _ = _period_bounds(range_key, on_date, date_from, date_to)

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


async def pending_orders_detail(
    db: AsyncSession,
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    start, end, _, _ = _period_bounds(range_key, on_date, date_from, date_to)
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.dealer), selectinload(Order.items))
        .where(
            Order.status == "pending",
            Order.created_at >= start,
            Order.created_at < end,
        )
        .order_by(Order.created_at.desc())
    )
    items = []
    for order in result.scalars().all():
        total_qty = sum(i.quantity for i in (order.items or []))
        items.append(
            {
                "id": order.id,
                "order_number": order.order_number,
                "dealer_name": order.dealer.dealer_name if order.dealer else None,
                "created_at": order.created_at,
                "due_date": order.due_date,
                "total_quantity": total_qty,
                "total_amount": order.total_amount,
                "status": order.status,
            }
        )
    return items


async def revenue_report(
    db: AsyncSession,
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """Per-dealer revenue for the selected dashboard filter."""
    start, end, _, _ = _period_bounds(range_key, on_date, date_from, date_to)
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.dealer))
        .where(
            Order.status.in_(["approved", "fulfilled"]),
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
        .order_by(Order.reviewed_at.desc())
    )

    by_dealer: dict[str, dict] = {}
    for order in result.scalars().all():
        dealer_name = (order.dealer.dealer_name if order.dealer else "UNKNOWN").upper()
        key = str(order.dealer_id) if order.dealer_id else dealer_name
        row = by_dealer.get(key)
        if not row:
            row = {
                "dealer_id": order.dealer_id,
                "dealer_name": dealer_name,
                "orders_count": 0,
                "total_revenue": Decimal("0"),
                "paid_amount": Decimal("0"),
                "pending_amount": Decimal("0"),
            }
            by_dealer[key] = row
        amount = Decimal(order.total_amount or 0)
        row["orders_count"] += 1
        row["total_revenue"] += amount
        if order.status == "fulfilled":
            row["paid_amount"] += amount
        else:
            row["pending_amount"] += amount

    items = sorted(by_dealer.values(), key=lambda r: r["dealer_name"])
    grand_total = sum((r["total_revenue"] for r in items), Decimal("0"))
    grand_paid = sum((r["paid_amount"] for r in items), Decimal("0"))
    grand_pending = sum((r["pending_amount"] for r in items), Decimal("0"))
    return {
        "items": items,
        "grand_total_revenue": grand_total,
        "grand_paid_amount": grand_paid,
        "grand_pending_amount": grand_pending,
    }


async def sales_trend(
    db: AsyncSession,
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    start, end, first_day, days = _period_bounds(range_key, on_date, date_from, date_to)

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items)
            .selectinload(OrderItem.variant)
            .selectinload(ProductVariant.product)
        )
        .where(
            Order.status.in_(["approved", "fulfilled"]),
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
    )
    orders = result.scalars().all()

    series_keys: set[str] = set()
    daily: dict[str, dict[str, int]] = {}
    # day -> flavour -> package bucket counts
    daily_flavour: dict[str, dict[str, dict[str, int]]] = {}
    categories = [(first_day + timedelta(days=i)).isoformat() for i in range(days)]
    for cat in categories:
        daily[cat] = {}
        daily_flavour[cat] = {
            f: {"glass": 0, "pet_300": 0, "pet_220": 0} for f in FLAVOUR_ORDER
        }

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
            qty = item.quantity
            bottle = v.bottle_type or ""
            if bottle in ("pet", "plastic"):
                ml = int(round(float(v.volume_liters) * 1000))
                if ml == 300:
                    key = "PET (300 ml)"
                    bucket = "pet_300"
                elif ml == 220:
                    key = "PET (220 ml)"
                    bucket = "pet_220"
                else:
                    key = f"PET ({ml} ml)"
                    bucket = None
            else:
                key = "GLASS"
                bucket = "glass"
            series_keys.add(key)
            daily[day][key] = daily[day].get(key, 0) + qty

            flavour = _canonical_flavour(v.product.flavour_name) if v.product else None
            if flavour and bucket:
                daily_flavour[day][flavour][bucket] += int(qty or 0)

    keys = sorted(series_keys) or ["GLASS", "PET (300 ml)", "PET (220 ml)"]
    series = [
        {"name": k, "type": "line", "stack": "Total", "data": [daily[c].get(k, 0) for c in categories]}
        for k in keys
    ]

    flavour_series = []
    for flavour in FLAVOUR_ORDER:
        data = []
        breakdown = []
        for cat in categories:
            counts = daily_flavour[cat][flavour]
            glass = int(counts["glass"])
            pet_300 = int(counts["pet_300"])
            pet_220 = int(counts["pet_220"])
            total = glass + pet_300 + pet_220
            data.append(total)
            breakdown.append(
                {
                    "glass": glass,
                    "pet_300": pet_300,
                    "pet_220": pet_220,
                    "total": total,
                }
            )
        flavour_series.append(
            {
                "name": flavour,
                "type": "line",
                "data": data,
                "breakdown": breakdown,
            }
        )

    return {"categories": categories, "series": series, "flavour_series": flavour_series}


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
    db: AsyncSession,
    range_key: str = "7d",
    on_date: date | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    order_id: UUID | None = None,
) -> dict:
    """Syrup batches per flavour from approved orders (fractional, by package type)."""
    start, end, _, _ = _period_bounds(range_key, on_date, date_from, date_to)

    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.dealer),
            selectinload(Order.items)
            .selectinload(OrderItem.variant)
            .selectinload(ProductVariant.product),
        )
        .where(
            Order.status == "approved",
            Order.reviewed_at >= start,
            Order.reviewed_at < end,
        )
        .order_by(Order.reviewed_at.asc(), Order.order_number.asc())
    )
    orders = list(result.scalars().all())

    def _order_total_crates(order: Order) -> int:
        return sum(int(item.quantity or 0) for item in (order.items or []))

    order_options = [
        {
            "id": order.id,
            "order_number": order.order_number,
            "dealer_name": (order.dealer.dealer_name if order.dealer else None),
            "created_at": order.created_at,
            "status": order.status,
            "total_crates": _order_total_crates(order),
        }
        for order in orders
    ]

    selected_order = None
    calc_orders = orders
    if order_id is not None:
        match = next((o for o in orders if o.id == order_id), None)
        if not match:
            raise LookupError("Approved order not found for the selected period.")
        calc_orders = [match]
        selected_order = {
            "id": match.id,
            "order_number": match.order_number,
            "dealer_name": (match.dealer.dealer_name if match.dealer else None),
            "created_at": match.created_at,
            "status": match.status,
            "total_crates": _order_total_crates(match),
        }

    crates_by_flavour = {
        f: {"glass": 0, "pet_300": 0, "pet_220": 0} for f in FLAVOUR_ORDER
    }
    for order in calc_orders:
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
        # Single-order view: only flavours present on that order
        if order_id is not None and line["total_crates"] <= 0:
            continue
        flavours.append({"flavour": flavour.upper(), **line})
        grand_crates += line["total_crates"]
        grand_batches += line["batches_required"]
        grand_syrup += line["total_syrup_kg"]

    return {
        "flavours": flavours,
        "grand_total_crates": grand_crates,
        "grand_total_batches": _round2(grand_batches),
        "grand_total_syrup_kg": _round2(grand_syrup),
        "orders": order_options,
        "selected_order": selected_order,
    }


async def dealer_summary(
    db: AsyncSession,
    dealer_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    range_key: str | None = None,
) -> dict:
    if range_key:
        start, end, _, _ = _period_bounds(
            range_key,
            date_from=date_from if range_key == "custom" else None,
            date_to=date_to if range_key == "custom" else None,
        )
        filters = [
            Order.dealer_id == dealer_id,
            Order.created_at >= start,
            Order.created_at < end,
        ]
    else:
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
    db: AsyncSession,
    *,
    user_id: Optional[UUID] = None,
    admin_feed: bool = False,
    page: int = 1,
    page_size: int = 20,
    unread_only: bool = False,
) -> tuple[list[Notification], dict, int]:
    query = select(Notification)
    count_q = select(func.count()).select_from(Notification)
    unread_q = select(func.count()).select_from(Notification).where(Notification.is_read.is_(False))

    if admin_feed:
        query = query.where(Notification.user_id.is_(None))
        count_q = count_q.where(Notification.user_id.is_(None))
        unread_q = unread_q.where(Notification.user_id.is_(None))
    elif user_id is not None:
        query = query.where(Notification.user_id == user_id)
        count_q = count_q.where(Notification.user_id == user_id)
        unread_q = unread_q.where(Notification.user_id == user_id)
    else:
        return [], paginate(0, page, page_size), 0

    if unread_only:
        query = query.where(Notification.is_read.is_(False))
        count_q = count_q.where(Notification.is_read.is_(False))

    total = await db.scalar(count_q) or 0
    unread = await db.scalar(unread_q) or 0
    result = await db.execute(
        query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), paginate(total, page, page_size), unread


async def mark_notifications_read(
    db: AsyncSession,
    ids: list[UUID] | None = None,
    *,
    user_id: Optional[UUID] = None,
    admin_feed: bool = False,
) -> int:
    query = select(Notification)
    if ids:
        query = query.where(Notification.id.in_(ids))
    else:
        query = query.where(Notification.is_read.is_(False))

    if admin_feed:
        query = query.where(Notification.user_id.is_(None))
    elif user_id is not None:
        query = query.where(Notification.user_id == user_id)
    else:
        return 0

    result = await db.execute(query)
    notes = result.scalars().all()
    for n in notes:
        n.is_read = True
    await db.flush()
    return len(notes)
