from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.empty_crates import EmptyCrateBalance, EmptyCrateUpdateLog
from app.models.order import Order, OrderItem
from app.models.product import ProductVariant
from app.models.user import User
from app.services.helpers import paginate
from app.services.period import resolve_period_bounds

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

NON_COLOUR_KEY = "Non-Colour"

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


def _status(available: int, required: int) -> str:
    remaining = available - required
    if remaining < 0:
        return "shortage"
    if required > 0 and remaining < max(1, int(required * 0.2)):
        return "low"
    return "enough"


async def ensure_balances(db: AsyncSession) -> dict[str, EmptyCrateBalance]:
    result = await db.execute(select(EmptyCrateBalance))
    by_flavour = {row.flavour_name: row for row in result.scalars().all()}
    changed = False
    for flavour in [*FLAVOUR_ORDER, NON_COLOUR_KEY]:
        if flavour not in by_flavour:
            row = EmptyCrateBalance(id=uuid4(), flavour_name=flavour, available=0)
            db.add(row)
            by_flavour[flavour] = row
            changed = True
    if changed:
        await db.flush()
    return by_flavour


async def _required_by_flavour(
    db: AsyncSession,
    *,
    range_key: str,
    date_from: date | None,
    date_to: date | None,
    order_id: UUID | None,
) -> tuple[dict[str, int], list[dict], dict | None]:
    start, end, _, _ = resolve_period_bounds(range_key, date_from=date_from, date_to=date_to)

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

    order_options = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "dealer_name": o.dealer.dealer_name if o.dealer else None,
        }
        for o in orders
    ]

    selected_order = None
    calc_orders = orders
    if order_id is not None:
        match = next((o for o in orders if o.id == order_id), None)
        if not match:
            raise HTTPException(status_code=404, detail="Approved order not found for the selected period.")
        calc_orders = [match]
        selected_order = {
            "id": match.id,
            "order_number": match.order_number,
            "dealer_name": match.dealer.dealer_name if match.dealer else None,
        }

    required = {f: 0 for f in FLAVOUR_ORDER}
    for order in calc_orders:
        for item in order.items or []:
            v = item.variant
            if not v or not v.product:
                continue
            flavour = _canonical_flavour(v.product.flavour_name)
            if not flavour:
                continue
            required[flavour] += int(item.quantity or 0)

    return required, order_options, selected_order


async def get_summary(
    db: AsyncSession,
    *,
    range_key: str = "today",
    date_from: date | None = None,
    date_to: date | None = None,
    order_id: UUID | None = None,
) -> dict:
    balances = await ensure_balances(db)
    required, order_options, selected_order = await _required_by_flavour(
        db,
        range_key=range_key,
        date_from=date_from,
        date_to=date_to,
        order_id=order_id,
    )

    flavours = []
    total_available = 0
    total_required = 0
    for flavour in FLAVOUR_ORDER:
        available = int(balances[flavour].available or 0)
        req = int(required.get(flavour) or 0)
        remaining = available - req
        flavours.append(
            {
                "flavour": flavour,
                "available": available,
                "required": req,
                "remaining": remaining,
                "status": _status(available, req),
            }
        )
        total_available += available
        total_required += req

    total_remaining = total_available - total_required
    flavour_shortage = sum(max(0, int(f["required"]) - int(f["available"])) for f in flavours)
    order_enough = flavour_shortage == 0
    non_colour = int(balances[NON_COLOUR_KEY].available or 0)
    return {
        "flavours": flavours,
        "non_colour_available": non_colour,
        "totals": {
            "available": total_available,
            "required": total_required,
            "remaining": total_remaining,
            "shortage": flavour_shortage,
            "status": _status(total_available, total_required),
            "enough": order_enough,
        },
        "orders": order_options,
        "selected_order": selected_order,
    }


def _parse_non_negative_int(value, label: str) -> int:
    try:
        if isinstance(value, bool):
            raise ValueError
        if isinstance(value, float):
            if not value.is_integer():
                raise ValueError
            parsed = int(value)
        else:
            parsed = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid available value for {label}")
    if parsed < 0:
        raise HTTPException(status_code=400, detail=f"Available crates cannot be negative for {label}")
    return parsed


async def _set_balance(
    db: AsyncSession,
    *,
    balances: dict[str, EmptyCrateBalance],
    key: str,
    new_value: int,
    admin: User,
    note: str | None,
) -> bool:
    row = balances[key]
    previous = int(row.available or 0)
    if previous == new_value:
        return False
    row.available = new_value
    row.updated_at = datetime.now(timezone.utc)
    db.add(
        EmptyCrateUpdateLog(
            id=uuid4(),
            flavour_name=key,
            previous_value=previous,
            new_value=new_value,
            difference=new_value - previous,
            comment=note,
            updated_by_id=admin.id,
            updated_by_username=admin.username or "admin",
        )
    )
    return True


async def update_balances(
    db: AsyncSession,
    *,
    admin: User,
    items: list[dict],
    non_colour_available: int | None = None,
    comment: str | None = None,
) -> dict:
    balances = await ensure_balances(db)
    note = (comment or "").strip() or None
    changed = False

    for item in items:
        flavour = _canonical_flavour(item.get("flavour"))
        if not flavour:
            continue
        new_value = _parse_non_negative_int(item.get("available"), flavour)
        if await _set_balance(
            db, balances=balances, key=flavour, new_value=new_value, admin=admin, note=note
        ):
            changed = True

    if non_colour_available is not None:
        nc_value = _parse_non_negative_int(non_colour_available, NON_COLOUR_KEY)
        if await _set_balance(
            db,
            balances=balances,
            key=NON_COLOUR_KEY,
            new_value=nc_value,
            admin=admin,
            note=note,
        ):
            changed = True

    if changed:
        await db.flush()

    return {"message": "Empty crates updated" if changed else "No changes"}


async def list_history(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 25,
    range_key: str = "30d",
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[dict], dict]:
    start, end, _, _ = resolve_period_bounds(range_key, date_from=date_from, date_to=date_to)
    filters = [
        EmptyCrateUpdateLog.created_at >= start,
        EmptyCrateUpdateLog.created_at < end,
    ]
    count_q = select(func.count()).select_from(EmptyCrateUpdateLog).where(*filters)
    total = await db.scalar(count_q) or 0
    result = await db.execute(
        select(EmptyCrateUpdateLog)
        .where(*filters)
        .order_by(EmptyCrateUpdateLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for log in result.scalars().all():
        items.append(
            {
                "id": log.id,
                "flavour": log.flavour_name,
                "previous_value": log.previous_value,
                "new_value": log.new_value,
                "difference": log.difference,
                "comment": log.comment,
                "updated_by": log.updated_by_username,
                "created_at": log.created_at,
            }
        )
    return items, paginate(total, page, page_size)
