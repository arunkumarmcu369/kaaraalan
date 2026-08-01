import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class StockUpdateLog(Base):
    """Bulk stock update history (glass + PET 300/220 totals)."""

    __tablename__ = "stock_update_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    previous_glass_total: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_pet_300_total: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_pet_220_total: Mapped[int] = mapped_column(Integer, nullable=False)
    new_glass_total: Mapped[int] = mapped_column(Integer, nullable=False)
    new_pet_300_total: Mapped[int] = mapped_column(Integer, nullable=False)
    new_pet_220_total: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    updated_by_username: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="admin")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    updated_by = relationship("User")
