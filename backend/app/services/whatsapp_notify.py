"""Fire-and-forget WhatsApp notifications for order events (never raises)."""

from __future__ import annotations

import logging

from app.core.config import settings
from app.models.order import Order
from app.services import whatsapp
from app.services import whatsapp_messages as msg

logger = logging.getLogger("kaaralan.whatsapp")


def _dealer_phone(order: Order) -> str | None:
    if not order.dealer:
        return None
    return order.dealer.phone


async def notify_order_placed(order: Order) -> None:
    try:
        phone = _dealer_phone(order)
        if phone:
            await whatsapp.send_dealer_message(
                phone,
                template_name=settings.WHATSAPP_TEMPLATE_ORDER_PLACED or None,
                template_params=msg.template_params_order_placed(order),
                text_body=msg.order_placed_text(order),
            )
        if settings.WHATSAPP_ADMIN_PHONE:
            await whatsapp.send_text(
                settings.WHATSAPP_ADMIN_PHONE,
                msg.admin_new_order_text(order),
            )
    except Exception:
        logger.exception("notify_order_placed failed for %s", getattr(order, "order_number", "?"))


async def notify_order_approved(order: Order) -> None:
    try:
        phone = _dealer_phone(order)
        if not phone:
            return
        await whatsapp.send_dealer_message(
            phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_APPROVED or None,
            template_params=msg.template_params_order_approved(order),
            text_body=msg.order_approved_text(order),
        )
    except Exception:
        logger.exception("notify_order_approved failed for %s", getattr(order, "order_number", "?"))


async def notify_order_rejected(order: Order) -> None:
    try:
        phone = _dealer_phone(order)
        if not phone:
            return
        await whatsapp.send_dealer_message(
            phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_REJECTED or None,
            template_params=msg.template_params_order_rejected(order),
            text_body=msg.order_rejected_text(order),
        )
    except Exception:
        logger.exception("notify_order_rejected failed for %s", getattr(order, "order_number", "?"))


async def notify_order_dispatched(order: Order) -> None:
    try:
        phone = _dealer_phone(order)
        if not phone:
            return
        await whatsapp.send_dealer_message(
            phone,
            template_name=settings.WHATSAPP_TEMPLATE_ORDER_DISPATCHED or None,
            template_params=msg.template_params_order_dispatched(order),
            text_body=msg.order_dispatched_text(order),
        )
    except Exception:
        logger.exception(
            "notify_order_dispatched failed for %s", getattr(order, "order_number", "?")
        )
