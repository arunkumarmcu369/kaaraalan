"""WhatsApp Cloud API webhooks (verify + inbound messages)."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Annotated, Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.notification import Notification
from app.websocket.manager import ws_manager

logger = logging.getLogger("kaaralan.whatsapp")

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _verify_signature(raw_body: bytes, signature_header: str | None) -> bool:
    secret = (settings.WHATSAPP_APP_SECRET or "").strip()
    if not secret:
        # Signature check optional until App Secret is configured
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = signature_header.removeprefix("sha256=")
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, expected)


@router.get("/webhook")
async def verify_webhook(
    hub_mode: Annotated[Optional[str], Query(alias="hub.mode")] = None,
    hub_verify_token: Annotated[Optional[str], Query(alias="hub.verify_token")] = None,
    hub_challenge: Annotated[Optional[str], Query(alias="hub.challenge")] = None,
):
    """Meta webhook verification handshake."""
    expected = (settings.WHATSAPP_VERIFY_TOKEN or "").strip()
    if hub_mode == "subscribe" and expected and hub_verify_token == expected:
        logger.info("WhatsApp webhook verified")
        return Response(content=hub_challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_hub_signature_256: Annotated[Optional[str], Header()] = None,
):
    """Receive inbound WhatsApp messages and status updates."""
    raw = await request.body()
    if not _verify_signature(raw, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        import json

        payload: dict[str, Any] = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        return {"status": "ignored"}

    if payload.get("object") != "whatsapp_business_account":
        return {"status": "ignored"}

    for entry in payload.get("entry") or []:
        for change in entry.get("changes") or []:
            value = change.get("value") or {}
            await _handle_statuses(value.get("statuses") or [])
            await _handle_inbound_messages(db, value)

    return {"status": "ok"}


async def _handle_statuses(statuses: list[dict[str, Any]]) -> None:
    for st in statuses:
        logger.info(
            "WhatsApp status: id=%s status=%s recipient=%s",
            st.get("id"),
            st.get("status"),
            st.get("recipient_id"),
        )


async def _handle_inbound_messages(db: AsyncSession, value: dict[str, Any]) -> None:
    messages = value.get("messages") or []
    contacts = {c.get("wa_id"): c for c in (value.get("contacts") or []) if c.get("wa_id")}

    for message in messages:
        wa_id = message.get("from")
        msg_type = message.get("type")
        contact = contacts.get(wa_id) or {}
        profile_name = ((contact.get("profile") or {}).get("name")) or wa_id or "Customer"

        text = ""
        if msg_type == "text":
            text = ((message.get("text") or {}).get("body") or "").strip()
        else:
            text = f"[{msg_type} message]"

        logger.info("WhatsApp inbound from %s (%s): %s", profile_name, wa_id, text[:200])

        # Surface dealer replies in admin notification feed
        preview = text if len(text) <= 160 else text[:157] + "…"
        notif = Notification(
            id=uuid4(),
            type="whatsapp_inbound",
            message=f"WhatsApp from {profile_name} (+{wa_id}): {preview}",
            order_id=None,
            user_id=None,
            is_read=False,
        )
        db.add(notif)
        await db.flush()
        await ws_manager.broadcast_admins(
            {
                "type": "whatsapp_inbound",
                "from": wa_id,
                "name": profile_name,
                "message": preview,
            }
        )
