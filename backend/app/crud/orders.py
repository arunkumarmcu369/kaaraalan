from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dealer import Dealer
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.product import ProductVariant
from app.models.stock import Stock, StockMovement
from app.schemas.order import OrderCreate, OrderReject
from app.services.helpers import generate_order_number, paginate
from app.websocket.manager import ws_manager


async def _next_order_seq(db: AsyncSession) -> int:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"ORD-{today}-"
    result = await db.scalar(
        select(func.count()).select_from(Order).where(Order.order_number.like(f"{prefix}%"))
    )
    return (result or 0) + 1


async def _dealer_user_id(db: AsyncSession, dealer_id: UUID) -> Optional[UUID]:
    dealer = await db.get(Dealer, dealer_id)
    return dealer.user_id if dealer else None


async def _notify_dealer(
    db: AsyncSession,
    *,
    dealer_id: UUID,
    order: Order,
    notif_type: str,
    message: str,
) -> None:
    user_id = await _dealer_user_id(db, dealer_id)
    if not user_id:
        return
    notif = Notification(
        id=uuid4(),
        type=notif_type,
        message=message,
        order_id=order.id,
        user_id=user_id,
        is_read=False,
    )
    db.add(notif)
    await db.flush()
    await ws_manager.send_dealer(
        user_id,
        {
            "type": "order_updated",
            "order_id": str(order.id),
            "status": order.status,
            "order_number": order.order_number,
            "message": message,
            "rejection_reason": order.rejection_reason,
        },
    )


async def create_order(db: AsyncSession, dealer_id: UUID, data: OrderCreate) -> Order:
    if data.due_date < date.today():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Due date cannot be in the past")

    items_data = []
    total = Decimal("0.00")
    for item in data.items:
        result = await db.execute(
            select(ProductVariant)
            .options(selectinload(ProductVariant.product))
            .where(ProductVariant.id == item.product_variant_id, ProductVariant.is_active.is_(True))
        )
        variant = result.scalar_one_or_none()
        if not variant:
            raise HTTPException(status_code=404, detail=f"Variant {item.product_variant_id} not found")
        # Stock is not checked or deducted here — dealers may always place pending orders.
        # Stock is validated/deducted only when an admin approves the order.
        line_total = Decimal(variant.price) * item.quantity
        total += line_total
        items_data.append((variant, item.quantity, Decimal(variant.price), line_total))

    seq = await _next_order_seq(db)
    order = Order(
        id=uuid4(),
        order_number=generate_order_number(seq),
        dealer_id=dealer_id,
        status="pending",
        due_date=data.due_date,
        total_amount=total,
        mrp_glass=data.mrp_glass,
        mrp_pet_300=data.mrp_pet_300,
        mrp_pet_220=data.mrp_pet_220,
    )
    db.add(order)
    await db.flush()

    for variant, qty, unit_price, line_total in items_data:
        db.add(
            OrderItem(
                id=uuid4(),
                order_id=order.id,
                product_variant_id=variant.id,
                quantity=qty,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    dealer = await db.get(Dealer, dealer_id)
    dealer_label = (dealer.dealer_name if dealer else "dealer").upper()
    total_qty = sum(i.quantity for i in data.items)
    notif = Notification(
        id=uuid4(),
        type="new_order",
        message=(
            f"New order {order.order_number} from {dealer_label} "
            f"— {total_qty} crates"
        ),
        order_id=order.id,
        user_id=None,
        is_read=False,
    )
    db.add(notif)
    await db.flush()

    await ws_manager.broadcast_admins(
        {
            "type": "new_order",
            "order_id": str(order.id),
            "order_number": order.order_number,
            "dealer_name": dealer_label if dealer else "",
            "quantity": total_qty,
            "due_date": str(order.due_date),
            "message": notif.message,
        }
    )

    loaded = await get_order(db, order.id)
    from app.services.whatsapp_notify import notify_order_placed

    await notify_order_placed(loaded)
    return loaded


async def get_order(db: AsyncSession, order_id: UUID) -> Order:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.dealer),
            selectinload(Order.items).selectinload(OrderItem.variant).selectinload(ProductVariant.product),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


async def list_orders(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
    dealer_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> tuple[list[Order], dict]:
    query = select(Order).options(
        selectinload(Order.dealer),
        selectinload(Order.items).selectinload(OrderItem.variant).selectinload(ProductVariant.product),
    )
    count_q = select(func.count()).select_from(Order)

    if status_filter:
        query = query.where(Order.status == status_filter)
        count_q = count_q.where(Order.status == status_filter)
    if dealer_id:
        query = query.where(Order.dealer_id == dealer_id)
        count_q = count_q.where(Order.dealer_id == dealer_id)
    if date_from:
        query = query.where(Order.created_at >= datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc))
        count_q = count_q.where(Order.created_at >= datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc))
    if date_to:
        query = query.where(Order.created_at <= datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc))
        count_q = count_q.where(Order.created_at <= datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc))

    total = await db.scalar(count_q) or 0
    result = await db.execute(
        query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all()), paginate(total, page, page_size)


async def list_orders_for_export(
    db: AsyncSession,
    status_filter: Optional[str] = None,
    dealer_id: Optional[UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[Order]:
    """All orders matching filters (no pagination) for PDF/CSV export."""
    query = select(Order).options(
        selectinload(Order.dealer),
        selectinload(Order.items).selectinload(OrderItem.variant).selectinload(ProductVariant.product),
    )
    if status_filter:
        query = query.where(Order.status == status_filter)
    if dealer_id:
        query = query.where(Order.dealer_id == dealer_id)
    if date_from:
        query = query.where(
            Order.created_at
            >= datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc)
        )
    if date_to:
        query = query.where(
            Order.created_at
            <= datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)
        )
    result = await db.execute(query.order_by(Order.created_at.desc()))
    return list(result.scalars().all())


async def list_dealer_orders(
    db: AsyncSession, dealer_id: UUID, page: int = 1, page_size: int = 20
) -> tuple[list[Order], dict]:
    return await list_orders(db, page=page, page_size=page_size, dealer_id=dealer_id)


async def approve_order(db: AsyncSession, order_id: UUID, admin_id: UUID) -> Order:
    from app.crud import stocks as stocks_crud
    from app.models.user import User

    order = await get_order(db, order_id)
    if order.status != "pending":
        raise HTTPException(status_code=400, detail=f"Order is already {order.status}")

    # Atomic stock check + deduct
    for item in order.items:
        result = await db.execute(
            select(Stock).where(Stock.product_variant_id == item.product_variant_id).with_for_update()
        )
        stock = result.scalar_one_or_none()
        if not stock or stock.quantity_available < item.quantity:
            avail = stock.quantity_available if stock else 0
            sku = item.variant.sku if item.variant else str(item.product_variant_id)
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Warning: Insufficient stock for {sku}. "
                    f"Need {item.quantity}, have {avail}. "
                    "Update stock or reject the order."
                ),
            )

    mapping = await stocks_crud._load_flavour_variant_map(db)
    prev_totals = stocks_crud._totals_from_rows(stocks_crud._matrix_rows_from_map(mapping))

    for item in order.items:
        result = await db.execute(
            select(Stock).where(Stock.product_variant_id == item.product_variant_id).with_for_update()
        )
        stock = result.scalar_one()
        stock.quantity_available -= item.quantity
        db.add(
            StockMovement(
                id=uuid4(),
                product_variant_id=item.product_variant_id,
                change_qty=-item.quantity,
                reason="order_approved",
                reference_order_id=order.id,
                created_by=admin_id,
            )
        )

    order.status = "approved"
    order.reviewed_by = admin_id
    order.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    mapping = await stocks_crud._load_flavour_variant_map(db)
    new_totals = stocks_crud._totals_from_rows(stocks_crud._matrix_rows_from_map(mapping))
    admin = await db.get(User, admin_id)
    if admin:
        await stocks_crud.record_stock_totals_log(
            db,
            admin=admin,
            prev_totals=prev_totals,
            new_totals=new_totals,
            source="system",
            note=f"Approved Order {order.order_number}",
        )

    await ws_manager.broadcast_admins(
        {
            "type": "order_updated",
            "order_id": str(order.id),
            "status": "approved",
            "order_number": order.order_number,
        }
    )
    await _notify_dealer(
        db,
        dealer_id=order.dealer_id,
        order=order,
        notif_type="order_approved",
        message=f"Order {order.order_number} was approved",
    )
    loaded = await get_order(db, order.id)
    from app.services.whatsapp_notify import notify_order_approved

    await notify_order_approved(loaded)
    return loaded


async def reject_order(db: AsyncSession, order_id: UUID, admin_id: UUID, data: OrderReject) -> Order:
    order = await get_order(db, order_id)
    if order.status != "pending":
        raise HTTPException(status_code=400, detail=f"Order is already {order.status}")

    order.status = "rejected"
    order.rejection_reason = data.reason
    order.reviewed_by = admin_id
    order.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    await ws_manager.broadcast_admins(
        {
            "type": "order_updated",
            "order_id": str(order.id),
            "status": "rejected",
            "order_number": order.order_number,
        }
    )
    await _notify_dealer(
        db,
        dealer_id=order.dealer_id,
        order=order,
        notif_type="order_rejected",
        message=f"Order {order.order_number} was rejected: {data.reason}",
    )
    loaded = await get_order(db, order.id)
    from app.services.whatsapp_notify import notify_order_rejected

    await notify_order_rejected(loaded)
    return loaded


async def fulfill_order(db: AsyncSession, order_id: UUID, admin_id: UUID) -> Order:
    order = await get_order(db, order_id)
    if order.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Only approved orders can be fulfilled (current: {order.status})",
        )

    order.status = "fulfilled"
    order.reviewed_by = admin_id
    order.reviewed_at = datetime.now(timezone.utc)
    await db.flush()

    await ws_manager.broadcast_admins(
        {
            "type": "order_updated",
            "order_id": str(order.id),
            "status": "fulfilled",
            "order_number": order.order_number,
        }
    )
    await _notify_dealer(
        db,
        dealer_id=order.dealer_id,
        order=order,
        notif_type="order_fulfilled",
        message=f"Order {order.order_number} was marked fulfilled / dispatched",
    )
    loaded = await get_order(db, order.id)
    from app.services.whatsapp_notify import notify_order_dispatched

    await notify_order_dispatched(loaded)
    return loaded


def order_to_out(order: Order) -> dict:
    items = []
    total_qty = 0
    for item in order.items:
        total_qty += item.quantity
        v = item.variant
        bottle = v.bottle_type if v else None
        product_type = "pet" if bottle in ("pet", "plastic") else ("glass" if bottle else None)
        size_ml = None
        if product_type == "pet" and v:
            size_ml = int(round(float(v.volume_liters) * 1000)) or None
        items.append(
            {
                "id": item.id,
                "product_variant_id": item.product_variant_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
                "flavour_name": v.product.flavour_name if v and v.product else None,
                "name": v.product.flavour_name if v and v.product else None,
                "bottle_type": bottle,
                "product_type": product_type,
                "size_ml": size_ml,
                "size_label": (
                    "GLASS"
                    if product_type == "glass"
                    else (
                        "PET (300 ml)"
                        if size_ml == 300
                        else "PET (220 ml)"
                        if size_ml == 220
                        else (f"PET ({size_ml} ml)" if size_ml else "—")
                    )
                ),
                "volume_liters": v.volume_liters if v else None,
                "sku": v.sku if v else None,
            }
        )
    return {
        "id": order.id,
        "order_number": order.order_number,
        "dealer_id": order.dealer_id,
        "dealer_name": order.dealer.dealer_name if order.dealer else None,
        "shop_name": order.dealer.shop_name if order.dealer else None,
        "phone": order.dealer.phone if order.dealer else None,
        "email": order.dealer.email if order.dealer else None,
        "address": order.dealer.address if order.dealer else None,
        "status": order.status,
        "due_date": order.due_date,
        "total_amount": order.total_amount,
        "mrp_glass": order.mrp_glass,
        "mrp_pet_300": order.mrp_pet_300,
        "mrp_pet_220": order.mrp_pet_220,
        "rejection_reason": order.rejection_reason,
        "reviewed_at": order.reviewed_at,
        "created_at": order.created_at,
        "items": items,
        "total_quantity": total_qty,
    }
