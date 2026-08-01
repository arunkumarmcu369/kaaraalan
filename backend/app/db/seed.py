import logging
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password, encrypt_password
from app.models.dealer import Dealer
from app.models.notification import Notification
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.refresh_token import RefreshToken
from app.models.stock import Stock, StockMovement
from app.models.user import User
from app.services.helpers import generate_sku

logger = logging.getLogger("kaaralan")

FLAVOURS = [
    "Paneer",
    "Lemon",
    "Orange",
    "BlueBerry",
    "Ginger",
    "Nannari",
    "Grape",
    "Pineapple",
]

# Legacy spellings so existing DB rows are renamed instead of duplicated.
_FLAVOUR_LOOKUP = {
    "blueberry": ["blueberry", "blue berry", "blue-berry"],
    "pineapple": ["pineapple", "pine apple", "pine-apple"],
}


def _flavour_lookup_keys(flavour: str) -> list[str]:
    key = " ".join(flavour.strip().lower().replace("_", " ").replace("-", " ").split())
    return _FLAVOUR_LOOKUP.get(key, [key])

# (bottle_type, volume_liters, default_price, default_stock)
VARIANT_SPECS = [
    ("glass", Decimal("0"), Decimal("325.00"), 100),
    ("pet", Decimal("0.22"), Decimal("455.00"), 100),
    ("pet", Decimal("0.30"), Decimal("525.00"), 100),
]


async def seed_admin(db: AsyncSession) -> None:
    """Ensure admin exists with configured seed credentials (upsert password)."""
    result = await db.execute(select(User).where(User.username == settings.ADMIN_SEED_USERNAME))
    existing = result.scalar_one_or_none()
    if existing:
        existing.password_hash = hash_password(settings.ADMIN_SEED_PASSWORD)
        existing.role = "admin"
        existing.must_reset_password = False
        existing.is_active = True
        await db.flush()
        return

    admin = User(
        id=uuid4(),
        username=settings.ADMIN_SEED_USERNAME,
        password_hash=hash_password(settings.ADMIN_SEED_PASSWORD),
        role="admin",
        must_reset_password=False,
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    logger.warning(
        "Seeded admin user → username=%s password=%s (change in production)",
        settings.ADMIN_SEED_USERNAME,
        settings.ADMIN_SEED_PASSWORD,
    )
    print(
        f"\n{'='*60}\n"
        f"  ADMIN CREDENTIALS (first run)\n"
        f"  Username: {settings.ADMIN_SEED_USERNAME}\n"
        f"  Password: {settings.ADMIN_SEED_PASSWORD}\n"
        f"{'='*60}\n"
    )


def _variant_key(bottle_type: str, volume_liters) -> tuple:
    normalized = "pet" if bottle_type in ("pet", "plastic") else bottle_type
    return (normalized, round(float(volume_liters), 2))


async def seed_flavours(db: AsyncSession) -> None:
    """Ensure the 8 canonical flavours exist with Glass + PET 220/300 variants."""
    created = 0
    for flavour in FLAVOURS:
        result = await db.execute(
            select(Product)
            .options(selectinload(Product.variants).selectinload(ProductVariant.stock))
            .where(func.lower(Product.flavour_name).in_(_flavour_lookup_keys(flavour)))
            .order_by(Product.created_at)
        )
        products = list(result.scalars().unique().all())

        if products:
            product = products[0]
            product.is_active = True
            if product.flavour_name != flavour:
                product.flavour_name = flavour
            all_variants = []
            for p in products:
                all_variants.extend(list(p.variants))
        else:
            product = Product(
                id=uuid4(),
                flavour_name=flavour,
                description=None,
                is_active=True,
            )
            db.add(product)
            await db.flush()
            created += 1
            all_variants = []

        existing = {_variant_key(v.bottle_type, v.volume_liters): v for v in all_variants}

        for bottle_type, volume, price, stock_qty in VARIANT_SPECS:
            key = _variant_key(bottle_type, volume)
            variant = existing.get(key)

            if variant:
                if not variant.is_active:
                    variant.is_active = True
                variant.price = price
                if variant.stock is None:
                    db.add(
                        Stock(
                            id=uuid4(),
                            product_variant_id=variant.id,
                            quantity_available=stock_qty,
                            reorder_level=10,
                        )
                    )
                continue

            variant = ProductVariant(
                id=uuid4(),
                product_id=product.id,
                bottle_type=bottle_type,
                volume_liters=volume,
                sku=generate_sku(flavour, bottle_type, float(volume)),
                price=price,
                is_active=True,
            )
            db.add(variant)
            await db.flush()
            db.add(
                Stock(
                    id=uuid4(),
                    product_variant_id=variant.id,
                    quantity_available=stock_qty,
                    reorder_level=10,
                )
            )
            created += 1

    if created:
        logger.info("Seeded / updated flavour catalog (%s new rows)", created)
        await db.flush()


# City dealers for testing — username/password match dealer name (lowercase).
SAMPLE_DEALERS = [
    {"dealer_name": "ERODE", "username": "erode", "password": "erode", "phone": "9876500001"},
    {"dealer_name": "COIMBATORE", "username": "coimbatore", "password": "coimbatore", "phone": "9876500002"},
    {"dealer_name": "TIRUPPUR", "username": "tiruppur", "password": "tiruppur", "phone": "9876500003"},
    {"dealer_name": "NAMAKKAL", "username": "namakkal", "password": "namakkal", "phone": "9876500004"},
    {"dealer_name": "OOTY", "username": "ooty", "password": "ooty", "phone": "9876500005"},
    {"dealer_name": "DINDIGUL", "username": "dindigul", "password": "dindigul", "phone": "9876500006"},
    {"dealer_name": "KOLLIMALAI", "username": "kollimalai", "password": "kollimalai", "phone": "9876500007"},
    {"dealer_name": "KARUR", "username": "karur", "password": "karur", "phone": "9876500008"},
    {"dealer_name": "SALEM", "username": "salem", "password": "salem", "phone": "9876500009"},
]


async def _delete_dealer_cascade(db: AsyncSession, dealer: Dealer) -> None:
    """Remove a dealer and related orders / auth rows."""
    order_ids = list(
        (await db.execute(select(Order.id).where(Order.dealer_id == dealer.id))).scalars().all()
    )
    if order_ids:
        await db.execute(
            update(StockMovement)
            .where(StockMovement.reference_order_id.in_(order_ids))
            .values(reference_order_id=None)
        )
        await db.execute(delete(Notification).where(Notification.order_id.in_(order_ids)))
        await db.execute(delete(OrderItem).where(OrderItem.order_id.in_(order_ids)))
        await db.execute(delete(Order).where(Order.id.in_(order_ids)))

    user_id = dealer.user_id
    await db.delete(dealer)
    await db.flush()

    if user_id:
        await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
        user = await db.get(User, user_id)
        if user and user.role == "dealer":
            await db.delete(user)
            await db.flush()


async def seed_dealers(db: AsyncSession) -> None:
    """Ensure sample city dealers exist.

    In production (COOKIE_SECURE=true) never delete real dealers — only upsert the sample list.
    Locally, non-canonical dealers are removed so the demo set stays clean.
    """
    from app.core.config import settings

    keep_usernames = {d["username"].lower() for d in SAMPLE_DEALERS}
    admin = (
        await db.execute(select(User).where(User.role == "admin").order_by(User.created_at).limit(1))
    ).scalar_one_or_none()
    admin_id = admin.id if admin else None

    if not settings.COOKIE_SECURE:
        result = await db.execute(select(Dealer).options(selectinload(Dealer.user)))
        for dealer in list(result.scalars().all()):
            username = (dealer.user.username if dealer.user else "").lower()
            if username not in keep_usernames:
                await _delete_dealer_cascade(db, dealer)

    for spec in SAMPLE_DEALERS:
        username = spec["username"]
        shop_name = f"{spec['dealer_name']} Dealer"
        result = await db.execute(
            select(User).options(selectinload(User.dealer)).where(User.username == username)
        )
        user = result.scalar_one_or_none()

        if user:
            user.password_hash = hash_password(spec["password"])
            user.password_plain = encrypt_password(spec["password"])
            user.role = "dealer"
            user.must_reset_password = False
            user.is_active = True
            if user.dealer:
                user.dealer.dealer_name = spec["dealer_name"]
                user.dealer.shop_name = shop_name
                user.dealer.phone = spec["phone"]
                user.dealer.is_active = True
            else:
                db.add(
                    Dealer(
                        id=uuid4(),
                        user_id=user.id,
                        dealer_name=spec["dealer_name"],
                        shop_name=shop_name,
                        phone=spec["phone"],
                        email=None,
                        address=f"{spec['dealer_name']}, Tamil Nadu",
                        gst_number=None,
                        onboarded_by=admin_id,
                        is_active=True,
                    )
                )
            continue

        user = User(
            id=uuid4(),
            username=username,
            password_hash=hash_password(spec["password"]),
            password_plain=encrypt_password(spec["password"]),
            role="dealer",
            must_reset_password=False,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        db.add(
            Dealer(
                id=uuid4(),
                user_id=user.id,
                dealer_name=spec["dealer_name"],
                shop_name=shop_name,
                phone=spec["phone"],
                email=None,
                address=f"{spec['dealer_name']}, Tamil Nadu",
                gst_number=None,
                onboarded_by=admin_id,
                is_active=True,
            )
        )

    await db.flush()
    logger.info("Seeded %s city dealers (removed other sample dealers)", len(SAMPLE_DEALERS))
