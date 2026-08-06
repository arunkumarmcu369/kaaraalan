"""Build dealer-friendly WhatsApp copy for order lifecycle events."""

from __future__ import annotations

from app.models.order import Order


def _format_due(order: Order) -> str:
    if not order.due_date:
        return "—"
    return order.due_date.strftime("%d-%m-%Y")


def _size_label(variant) -> str:
    if not variant:
        return "—"
    bottle = variant.bottle_type or ""
    if bottle in ("pet", "plastic"):
        ml = int(round(float(variant.volume_liters or 0) * 1000)) or 0
        if ml == 300:
            return "PET (300 ml)"
        if ml == 220:
            return "PET (220 ml)"
        return f"PET ({ml} ml)" if ml else "PET"
    return "GLASS"


def _items_summary(order: Order, *, max_lines: int = 12) -> str:
    lines: list[str] = []
    for item in order.items or []:
        v = item.variant
        flavour = v.product.flavour_name if v and v.product else "Item"
        size = _size_label(v)
        qty = item.quantity or 0
        lines.append(f"• {flavour} {size} × {qty}")
    if not lines:
        return "• (see portal for details)"
    if len(lines) > max_lines:
        extra = len(lines) - max_lines
        lines = lines[:max_lines] + [f"• …and {extra} more"]
    return "\n".join(lines)


def _dealer_greeting(order: Order) -> str:
    name = (order.dealer.dealer_name if order.dealer else "Dealer") or "Dealer"
    return name.strip().upper()


def _total_qty(order: Order) -> int:
    return sum(int(i.quantity or 0) for i in (order.items or []))


def order_placed_text(order: Order) -> str:
    return (
        f"🟢 *KAARAALAN GOLI SODA*\n\n"
        f"Hello {_dealer_greeting(order)},\n\n"
        f"Your order has been received successfully.\n\n"
        f"*Order ID:*\n{order.order_number}\n\n"
        f"*Items:*\n{_items_summary(order)}\n\n"
        f"*Status:* Pending Approval\n"
        f"*Expected delivery:* {_format_due(order)}\n\n"
        f"We'll notify you once the order is approved.\n\n"
        f"Thank you."
    )


def order_approved_text(order: Order) -> str:
    return (
        f"🟢 *KAARAALAN GOLI SODA*\n\n"
        f"Hello {_dealer_greeting(order)},\n\n"
        f"Your order has been *approved*.\n\n"
        f"*Order ID:*\n{order.order_number}\n\n"
        f"*Expected Delivery:*\n{_format_due(order)}\n\n"
        f"*Items:*\n{_items_summary(order)}\n\n"
        f"Thank you."
    )


def order_rejected_text(order: Order) -> str:
    reason = (order.rejection_reason or "Please contact the administrator.").strip()
    return (
        f"🟢 *KAARAALAN GOLI SODA*\n\n"
        f"Hello {_dealer_greeting(order)},\n\n"
        f"Your order *{order.order_number}* has been *rejected*.\n\n"
        f"*Reason:*\n{reason}\n\n"
        f"Please contact the administrator if you need help."
    )


def order_dispatched_text(order: Order) -> str:
    return (
        f"🟢 *KAARAALAN GOLI SODA*\n\n"
        f"Hello {_dealer_greeting(order)},\n\n"
        f"Your order *{order.order_number}* has been *dispatched*.\n\n"
        f"*Expected arrival:*\n{_format_due(order)}\n\n"
        f"Thank you for choosing KAARAALAN GOLI SODA."
    )


def admin_new_order_text(order: Order) -> str:
    return (
        f"🔔 *New dealer order*\n\n"
        f"*Order:* {order.order_number}\n"
        f"*Dealer:* {_dealer_greeting(order)}\n"
        f"*Crates:* {_total_qty(order)}\n"
        f"*Due:* {_format_due(order)}\n\n"
        f"Open Admin Portal to review."
    )


def template_params_order_placed(order: Order) -> list[str]:
    return [
        _dealer_greeting(order),
        order.order_number,
        _items_summary(order, max_lines=8).replace("\n", " | "),
        _format_due(order),
    ]


def template_params_order_approved(order: Order) -> list[str]:
    return [
        _dealer_greeting(order),
        order.order_number,
        _format_due(order),
    ]


def template_params_order_rejected(order: Order) -> list[str]:
    return [
        order.order_number,
        (order.rejection_reason or "Please contact admin").strip()[:200],
    ]


def template_params_order_dispatched(order: Order) -> list[str]:
    return [
        order.order_number,
        _format_due(order),
    ]
