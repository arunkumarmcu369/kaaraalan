"""Add stock_update_logs for bulk stock entry history."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_stock_update_logs"
down_revision: Union[str, None] = "002_pet_products"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_update_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("previous_glass_total", sa.Integer(), nullable=False),
        sa.Column("previous_pet_total", sa.Integer(), nullable=False),
        sa.Column("new_glass_total", sa.Integer(), nullable=False),
        sa.Column("new_pet_total", sa.Integer(), nullable=False),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by_username", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_stock_update_logs_created_at", "stock_update_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_stock_update_logs_created_at", table_name="stock_update_logs")
    op.drop_table("stock_update_logs")
