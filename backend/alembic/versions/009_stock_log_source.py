"""Add source and note to stock_update_logs for admin vs system updates."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_stock_log_source"
down_revision: Union[str, None] = "008_notification_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_update_logs",
        sa.Column("source", sa.String(20), nullable=False, server_default="admin"),
    )
    op.add_column(
        "stock_update_logs",
        sa.Column("note", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stock_update_logs", "note")
    op.drop_column("stock_update_logs", "source")
