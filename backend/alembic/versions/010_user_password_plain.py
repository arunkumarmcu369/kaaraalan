"""Add recoverable password_plain for admin dealer credential display."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_user_password_plain"
down_revision: Union[str, None] = "009_stock_log_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_plain", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_plain")
