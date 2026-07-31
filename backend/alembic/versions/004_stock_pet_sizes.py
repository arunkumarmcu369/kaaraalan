"""Split stock update log PET totals into 300 ml and 250 ml."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_stock_pet_sizes"
down_revision: Union[str, None] = "003_stock_update_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_update_logs",
        sa.Column("previous_pet_300_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stock_update_logs",
        sa.Column("previous_pet_250_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stock_update_logs",
        sa.Column("new_pet_300_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stock_update_logs",
        sa.Column("new_pet_250_total", sa.Integer(), nullable=False, server_default="0"),
    )
    # Preserve prior combined PET totals in the 250 ml bucket for history continuity
    op.execute(
        "UPDATE stock_update_logs SET "
        "previous_pet_250_total = previous_pet_total, "
        "new_pet_250_total = new_pet_total"
    )
    op.drop_column("stock_update_logs", "previous_pet_total")
    op.drop_column("stock_update_logs", "new_pet_total")
    op.alter_column("stock_update_logs", "previous_pet_300_total", server_default=None)
    op.alter_column("stock_update_logs", "previous_pet_250_total", server_default=None)
    op.alter_column("stock_update_logs", "new_pet_300_total", server_default=None)
    op.alter_column("stock_update_logs", "new_pet_250_total", server_default=None)


def downgrade() -> None:
    op.add_column(
        "stock_update_logs",
        sa.Column("previous_pet_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "stock_update_logs",
        sa.Column("new_pet_total", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        "UPDATE stock_update_logs SET "
        "previous_pet_total = previous_pet_300_total + previous_pet_250_total, "
        "new_pet_total = new_pet_300_total + new_pet_250_total"
    )
    op.drop_column("stock_update_logs", "previous_pet_300_total")
    op.drop_column("stock_update_logs", "previous_pet_250_total")
    op.drop_column("stock_update_logs", "new_pet_300_total")
    op.drop_column("stock_update_logs", "new_pet_250_total")
    op.alter_column("stock_update_logs", "previous_pet_total", server_default=None)
    op.alter_column("stock_update_logs", "new_pet_total", server_default=None)
