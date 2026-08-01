from typing import Any
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.admin_connections: list[WebSocket] = []
        self.dealer_connections: dict[str, list[WebSocket]] = {}

    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.admin_connections.append(websocket)

    def disconnect_admin(self, websocket: WebSocket) -> None:
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

    async def connect_dealer(self, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        key = str(user_id)
        self.dealer_connections.setdefault(key, []).append(websocket)

    def disconnect_dealer(self, user_id: UUID, websocket: WebSocket) -> None:
        key = str(user_id)
        conns = self.dealer_connections.get(key) or []
        if websocket in conns:
            conns.remove(websocket)
        if not conns and key in self.dealer_connections:
            del self.dealer_connections[key]

    async def broadcast_admins(self, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.admin_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)

    async def send_dealer(self, user_id: UUID, message: dict[str, Any]) -> None:
        key = str(user_id)
        conns = list(self.dealer_connections.get(key) or [])
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_dealer(user_id, ws)


ws_manager = ConnectionManager()
