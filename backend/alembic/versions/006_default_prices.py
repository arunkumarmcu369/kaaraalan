"""Set default product prices: Glass 325, PET 220ml 455, PET 300ml 525."""

from typing import Sequence, Union

from alembic import op

revision: str = "006_default_prices"
down_revision: Union[str, None] = "005_pet_220_ml"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE product_variants SET price = 325.00 "
        "WHERE bottle_type = 'glass'"
    )
    op.execute(
        "UPDATE product_variants SET price = 455.00 "
        "WHERE bottle_type IN ('pet', 'plastic') AND volume_liters = 0.22"
    )
    op.execute(
        "UPDATE product_variants SET price = 525.00 "
        "WHERE bottle_type IN ('pet', 'plastic') AND volume_liters = 0.30"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE product_variants SET price = 12.00 "
        "WHERE bottle_type = 'glass'"
    )
    op.execute(
        "UPDATE product_variants SET price = 15.00 "
        "WHERE bottle_type IN ('pet', 'plastic') AND volume_liters = 0.22"
    )
    op.execute(
        "UPDATE product_variants SET price = 18.00 "
        "WHERE bottle_type IN ('pet', 'plastic') AND volume_liters = 0.30"
    )
