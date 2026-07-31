import hashlib
import math
import re
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_password(length: int = 12) -> str:
    return secrets.token_urlsafe(length)[:length]


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")[:20] or "dealer"


async def generate_unique_username(db: AsyncSession, shop_name: str | None, dealer_name: str) -> str:
    base = slugify(shop_name or dealer_name)
    for _ in range(20):
        suffix = secrets.token_hex(2)
        username = f"{base}_{suffix}"
        exists = await db.scalar(select(User.id).where(User.username == username))
        if not exists:
            return username
    return f"dealer_{uuid.uuid4().hex[:8]}"


def generate_order_number(seq: int, when: datetime | None = None) -> str:
    when = when or datetime.now(timezone.utc)
    return f"ORD-{when.strftime('%Y%m%d')}-{seq:04d}"


def generate_sku(flavour: str, bottle_type: str, volume: float) -> str:
    flav = slugify(flavour).upper().replace("_", "")[:8]
    vol = str(volume).replace(".", "")
    return f"{flav}-{bottle_type[:1].upper()}-{vol}-{secrets.token_hex(2).upper()}"


def paginate(total: int, page: int, page_size: int) -> dict:
    total_pages = max(1, math.ceil(total / page_size)) if total else 1
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages}
