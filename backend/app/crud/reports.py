from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud import dashboard as dashboard_crud
from app.crud import stocks as stocks_crud
from app.models.order import Order
from app.models.product import ProductVariant
from app.models.stock import Stock, StockMovement
from app.models.user import User


from app.services.period import resolve_period_bounds


def resolve_report_period(
    range_key: str = "today",
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[datetime, datetime, str]:
    """Return (start, end, label) for the selected report period."""
    start, end, first, num_days = resolve_period_bounds(
        range_key, date_from=date_from, date_to=date_to
    )
    last = (end - timedelta(days=1)).date()
    label = first.isoformat() if num_days == 1 else f"{first.isoformat()} to {last.isoformat()}"
    return start, end, label

def _crate_label(variant: ProductVariant | None) -> str:
    if not variant:
        return "—"
    return stocks_crud._display_size_label(variant.bottle_type, variant.volume_liters)


def _bucket_key(variant: ProductVariant | None) -> str | None:
    if not variant:
        return None
    return dashboard_crud._package_bucket(variant)


async def build_daily_report(
    db: AsyncSession,
    *,
    admin: User,
    range_key: str = "today",
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    start, end, period_label = resolve_report_period(range_key, date_from, date_to)
    generated_at = datetime.now(timezone.utc)

    if range_key == "custom":
        if date_from and date_to and date_from == date_to:
            summary = await dashboard_crud.admin_summary(db, "today", date_from)
        else:
            summary = await _summary_for_bounds(db, start, end)
    elif range_key == "yesterday":
        yday = datetime.now(timezone.utc).date() - timedelta(days=1)
        summary = await dashboard_crud.admin_summary(db, "today", yday)
    elif range_key == "today":
        summary = await dashboard_crud.admin_summary(db, "today")
    elif range_key in ("7d", "30d"):
        summary = await dashboard_crud.admin_summary(db, range_key)
    else:
        summary = await _summary_for_bounds(db, start, end)

    orders = await _orders_in_period(db, start, end)
    stock_matrix = await stocks_crud.get_stock_matrix(db)
    stock_history = await _stock_history_detail(db, start, end)
    batch_production = await _batch_production_summary(db, start, end)

    return {
        "meta": {
            "company": "KAARAALAN GOLI SODA",
            "title": "Daily Business Report",
            "period_label": period_label,
            "range_key": range_key,
            "generated_at": generated_at,
            "generated_by": admin.username or "admin",
            "footer_note": "Generated From: Kaaraalan Admin Portal",
        },
        "summary": {
            "pending_orders": int(summary.get("pending_orders") or 0),
            "total_orders": int(summary.get("todays_orders") or 0),
            "revenue": Decimal(summary.get("revenue") or 0),
            "low_stock_alerts": int(summary.get("low_stock_alerts") or 0),
        },
        "orders": orders,
        "stock_rows": stock_matrix.get("rows") or [],
        "stock_totals": stock_matrix.get("totals") or {"glass": 0, "pet_300": 0, "pet_220": 0},
        "batch_production": batch_production,
        "stock_history": stock_history,
    }


async def _summary_for_bounds(db: AsyncSession, start: datetime, end: datetime) -> dict:
    pending = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.status == "pending", Order.created_at >= start, Order.created_at < end)
    ) or 0
    orders_count = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.created_at >= start, Order.created_at < end)
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
        "revenue": revenue,
    }


async def _orders_in_period(db: AsyncSession, start: datetime, end: datetime) -> list[dict]:
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.dealer), selectinload(Order.items))
        .where(Order.created_at >= start, Order.created_at < end)
        .order_by(Order.created_at.desc())
    )
    rows = []
    for order in result.scalars().all():
        qty = sum(i.quantity for i in (order.items or []))
        rows.append(
            {
                "order_number": order.order_number,
                "dealer_name": (order.dealer.dealer_name if order.dealer else "").upper(),
                "created_at": order.created_at,
                "due_date": order.due_date,
                "total_quantity": qty,
                "total_amount": order.total_amount,
                "status": order.status,
            }
        )
    return rows


async def _stock_history_detail(db: AsyncSession, start: datetime, end: datetime) -> list[dict]:
    """Per flavour / crate type stock movements with previous / change / new."""
    result = await db.execute(
        select(StockMovement)
        .options(
            selectinload(StockMovement.variant).selectinload(ProductVariant.product),
        )
        .where(StockMovement.created_at >= start, StockMovement.created_at < end)
        .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
    )
    movements = list(result.scalars().all())
    if not movements:
        return []

    variant_ids = {m.product_variant_id for m in movements}

    # Current quantities for reconstructing previous/new
    stock_result = await db.execute(
        select(Stock).where(Stock.product_variant_id.in_(variant_ids))
    )
    current_by_variant = {s.product_variant_id: int(s.quantity_available) for s in stock_result.scalars().all()}

    # All movements for these variants (needed to reconstruct balances after each event)
    later_result = await db.execute(
        select(StockMovement)
        .where(StockMovement.product_variant_id.in_(variant_ids))
        .order_by(StockMovement.created_at.asc(), StockMovement.id.asc())
    )
    all_for_variants = list(later_result.scalars().all())

    after_qty: dict = {}
    by_variant: dict = defaultdict(list)
    for m in all_for_variants:
        by_variant[m.product_variant_id].append(m)

    for variant_id, items in by_variant.items():
        current = current_by_variant.get(variant_id, 0)
        running_after = current
        for m in reversed(items):
            after_qty[m.id] = running_after
            running_after = running_after - int(m.change_qty)

    # Order numbers for system reasons
    order_ids = {m.reference_order_id for m in movements if m.reference_order_id}
    order_numbers: dict = {}
    if order_ids:
        orders = await db.execute(select(Order).where(Order.id.in_(order_ids)))
        order_numbers = {o.id: o.order_number for o in orders.scalars().all()}

    # Usernames
    user_ids = {m.created_by for m in movements if m.created_by}
    usernames: dict = {}
    if user_ids:
        users = await db.execute(select(User).where(User.id.in_(user_ids)))
        usernames = {u.id: u.username for u in users.scalars().all()}

    rows = []
    for m in movements:
        if int(m.change_qty) == 0:
            continue
        variant = m.variant
        flavour = ""
        if variant and variant.product:
            flavour = (stocks_crud._canonical_flavour(variant.product.flavour_name) or variant.product.flavour_name or "").upper()
        crate = _crate_label(variant)
        change = int(m.change_qty)
        new_qty = after_qty.get(m.id)
        if new_qty is None:
            # Fallback if movement somehow missing from reconstruction
            new_qty = current_by_variant.get(m.product_variant_id, 0)
        previous = new_qty - change

        reason_key = (m.reason or "").lower()
        if reason_key == "order_approved":
            updated_by = "SYSTEM"
            order_no = order_numbers.get(m.reference_order_id)
            reason = f"Order {order_no} Approved" if order_no else "Order Approved"
        else:
            updated_by = "ADMIN"
            username = usernames.get(m.created_by)
            if username:
                updated_by = f"ADMIN ({username})"
            reason = "Manual Update"

        rows.append(
            {
                "created_at": m.created_at,
                "flavour": flavour or "—",
                "bottle_type": crate,
                "updated_by": updated_by,
                "reason": reason,
                "previous": previous,
                "change": change,
                "new": new_qty,
            }
        )
    return rows


async def _batch_production_summary(db: AsyncSession, start: datetime, end: datetime) -> list[dict]:
    """
    Treat positive stock movements (restock/adjustment) as production events.
    Group by flavour + timestamp (minute) so bulk matrix updates become one production line per flavour.
    """
    result = await db.execute(
        select(StockMovement)
        .options(selectinload(StockMovement.variant).selectinload(ProductVariant.product))
        .where(
            StockMovement.created_at >= start,
            StockMovement.created_at < end,
            StockMovement.change_qty > 0,
            StockMovement.reason.in_(["restock", "adjustment"]),
        )
        .order_by(StockMovement.created_at.asc())
    )
    movements = list(result.scalars().all())
    if not movements:
        return []

    grouped: dict[tuple, dict] = {}
    for m in movements:
        variant = m.variant
        if not variant or not variant.product:
            continue
        flavour = stocks_crud._canonical_flavour(variant.product.flavour_name) or variant.product.flavour_name
        bucket = _bucket_key(variant)
        if not flavour or not bucket:
            continue
        # Group to the minute so simultaneous matrix updates coalesce
        ts = m.created_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        local = ts.astimezone()
        key = (flavour.upper(), local.strftime("%Y-%m-%d %H:%M"))
        row = grouped.get(key)
        if not row:
            row = {
                "flavour": flavour.upper(),
                "glass": 0,
                "pet_300": 0,
                "pet_220": 0,
                "produced_at": ts,
            }
            grouped[key] = row
        row[bucket] = row.get(bucket, 0) + int(m.change_qty)
        if ts > row["produced_at"]:
            row["produced_at"] = ts

    rows = []
    for row in sorted(grouped.values(), key=lambda r: r["produced_at"], reverse=True):
        line = dashboard_crud._flavour_batch_line(row["glass"], row["pet_300"], row["pet_220"])
        if line["total_crates"] <= 0:
            continue
        rows.append(
            {
                "flavour": row["flavour"],
                "total_crates": line["total_crates"],
                "total_batches": line["batches_required"],
                "total_syrup_kg": line["total_syrup_kg"],
                "produced_at": row["produced_at"],
            }
        )
    return rows
