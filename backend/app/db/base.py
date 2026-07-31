from app.db.session import Base

# Import all models so Alembic and metadata discover them
from app.models.user import User  # noqa: F401
from app.models.dealer import Dealer  # noqa: F401
from app.models.product import Product, ProductVariant  # noqa: F401
from app.models.stock import Stock, StockMovement  # noqa: F401
from app.models.stock_update_log import StockUpdateLog  # noqa: F401
from app.models.order import Order, OrderItem  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.notification import Notification  # noqa: F401

__all__ = ["Base"]
