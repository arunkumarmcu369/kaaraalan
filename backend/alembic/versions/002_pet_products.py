"""Allow PET bottle type and zero volume for glass products.

Revision ID: 002_pet_products
Revises: 001_initial
Create Date: 2026-07-31
"""
from typing import Sequence, Union

from alembic import op

revision: str = "002_pet_products"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS ck_variant_bottle")
    op.execute(
        "ALTER TABLE product_variants ADD CONSTRAINT ck_variant_bottle "
        "CHECK (bottle_type IN ('glass','plastic','pet'))"
    )
    op.execute("UPDATE product_variants SET bottle_type = 'pet' WHERE bottle_type = 'plastic'")


def downgrade() -> None:
    op.execute("UPDATE product_variants SET bottle_type = 'plastic' WHERE bottle_type = 'pet'")
    op.execute("ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS ck_variant_bottle")
    op.execute(
        "ALTER TABLE product_variants ADD CONSTRAINT ck_variant_bottle "
        "CHECK (bottle_type IN ('glass','plastic'))"
    )
