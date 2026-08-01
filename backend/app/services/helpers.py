import hashlib
import math
import re
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def generate_password(length: int = 10) -> str:
    """Secure random password using letters + digits."""
    alphabet = string.ascii_letters + string.digits
    length = max(8, min(int(length), 64))
    return "".join(secrets.choice(alphabet) for _ in range(length))


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")[:20] or "dealer"


def dealer_username_base(dealer_name: str) -> str:
    """Lowercase dealer name with spaces/punctuation removed."""
    base = re.sub(r"[^a-z0-9]", "", (dealer_name or "").lower())
    return base[:40] or "dealer"


async def generate_unique_username(db: AsyncSession, shop_name: str | None, dealer_name: str) -> str:
    """Username from dealer name (no spaces). Append 1, 2, … if taken."""
    base = dealer_username_base(dealer_name)
    candidate = base
    n = 0
    while await db.scalar(select(User.id).where(User.username == candidate)):
        n += 1
        candidate = f"{base}{n}"
    return candidate


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
