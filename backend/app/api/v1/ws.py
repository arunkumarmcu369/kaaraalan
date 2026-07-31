from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Cookie, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import settings
from app.core.security import safe_decode_token
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.websocket.manager import ws_manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/admin")
async def admin_ws(
    websocket: WebSocket,
    access_token: Annotated[Optional[str], Cookie(alias=settings.ACCESS_COOKIE_NAME)] = None,
):
    if not access_token:
        access_token = websocket.query_params.get("token")

    if not access_token:
        await websocket.close(code=4401)
        return

    payload = safe_decode_token(access_token)
    if not payload or payload.get("type") != "access" or payload.get("role") != "admin":
        await websocket.close(code=4403)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(str(payload["sub"]))))
        user = result.scalar_one_or_none()
        if not user or not user.is_active or user.role != "admin":
            await websocket.close(code=4403)
            return

    await ws_manager.connect_admin(websocket)
    try:
        await websocket.send_json({"type": "connected", "message": "Admin WebSocket connected"})
        while True:
            # Keep alive — client may send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)
    except Exception:
        ws_manager.disconnect_admin(websocket)
