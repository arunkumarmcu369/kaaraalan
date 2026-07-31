"""Add MRP reference fields to orders (label printing only)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_order_mrp"
down_revision: Union[str, None] = "006_default_prices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("mrp_glass", sa.Numeric(10, 2), nullable=True))
    op.add_column("orders", sa.Column("mrp_pet_300", sa.Numeric(10, 2), nullable=True))
    op.add_column("orders", sa.Column("mrp_pet_220", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "mrp_pet_220")
    op.drop_column("orders", "mrp_pet_300")
    op.drop_column("orders", "mrp_glass")
