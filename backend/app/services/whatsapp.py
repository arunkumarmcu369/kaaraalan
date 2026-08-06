"""WhatsApp Cloud API client + dealer phone helpers."""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger("kaaralan.whatsapp")


def whatsapp_enabled() -> bool:
    return bool(
        settings.WHATSAPP_ENABLED
        and settings.WHATSAPP_TOKEN
        and settings.WHATSAPP_PHONE_NUMBER_ID
    )


def normalize_whatsapp_number(phone: str | None) -> str | None:
    """Return digits-only E.164-style number without '+', e.g. 919361934041."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone).strip())
    if not digits:
        return None
    if len(digits) == 10 and digits[0] in "6789":
        digits = "91" + digits
    if digits.startswith("0") and len(digits) == 11:
        digits = "91" + digits[1:]
    if len(digits) < 10 or len(digits) > 15:
        return None
    return digits


async def _graph_post(payload: dict[str, Any]) -> dict[str, Any] | None:
    if not whatsapp_enabled():
        logger.info("WhatsApp disabled or not configured — skip send")
        return None

    url = (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
        f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code >= 400:
            logger.error(
                "WhatsApp API error %s: %s",
                resp.status_code,
                resp.text[:800],
            )
            return None
        data = resp.json()
        logger.info("WhatsApp message sent: %s", data.get("messages", data))
        return data
    except Exception:
        logger.exception("WhatsApp send failed")
        return None


async def send_text(to_phone: str, body: str) -> dict[str, Any] | None:
    to = normalize_whatsapp_number(to_phone)
    if not to or not body.strip():
        return None
    return await _graph_post(
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": body.strip()},
        }
    )


async def send_template(
    to_phone: str,
    template_name: str,
    *,
    language_code: str = "en",
    body_params: list[str] | None = None,
) -> dict[str, Any] | None:
    """Send an approved WhatsApp template (utility/marketing)."""
    to = normalize_whatsapp_number(to_phone)
    if not to or not template_name:
        return None

    components: list[dict[str, Any]] = []
    if body_params:
        components.append(
            {
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in body_params],
            }
        )

    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code or settings.WHATSAPP_TEMPLATE_LANG},
        },
    }
    if components:
        payload["template"]["components"] = components

    return await _graph_post(payload)


async def send_dealer_message(
    to_phone: str,
    *,
    template_name: str | None,
    template_params: list[str] | None,
    text_body: str,
) -> dict[str, Any] | None:
    """
    Prefer template when WHATSAPP_USE_TEMPLATES is on; otherwise text.
    If template fails and fallback is allowed, try text.
    """
    if not whatsapp_enabled():
        return None

    if settings.WHATSAPP_USE_TEMPLATES and template_name:
        result = await send_template(
            to_phone,
            template_name,
            language_code=settings.WHATSAPP_TEMPLATE_LANG,
            body_params=template_params,
        )
        if result:
            return result
        if not settings.WHATSAPP_ALLOW_TEXT_FALLBACK:
            return None
        logger.warning("Template %s failed — falling back to text", template_name)

    if text_body:
        return await send_text(to_phone, text_body)
    return None
