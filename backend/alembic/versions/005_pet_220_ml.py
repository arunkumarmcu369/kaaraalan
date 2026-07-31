"""Rename PET 250 ml to PET 220 ml in stock logs and product volumes."""

from typing import Sequence, Union

from alembic import op

revision: str = "005_pet_220_ml"
down_revision: Union[str, None] = "004_stock_pet_sizes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("stock_update_logs", "previous_pet_250_total", new_column_name="previous_pet_220_total")
    op.alter_column("stock_update_logs", "new_pet_250_total", new_column_name="new_pet_220_total")
    op.execute(
        "UPDATE product_variants "
        "SET volume_liters = 0.22 "
        "WHERE bottle_type IN ('pet', 'plastic') "
        "AND volume_liters = 0.25"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE product_variants "
        "SET volume_liters = 0.25 "
        "WHERE bottle_type IN ('pet', 'plastic') "
        "AND volume_liters = 0.22"
    )
    op.alter_column("stock_update_logs", "previous_pet_220_total", new_column_name="previous_pet_250_total")
    op.alter_column("stock_update_logs", "new_pet_220_total", new_column_name="new_pet_250_total")
