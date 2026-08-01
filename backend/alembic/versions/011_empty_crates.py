"""Empty crates balances and update history (independent of stock/orders)."""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "011_empty_crates"
down_revision: Union[str, None] = "010_user_password_plain"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FLAVOURS = [
    "Paneer",
    "Lemon",
    "Orange",
    "BlueBerry",
    "Ginger",
    "Nannari",
    "Grape",
    "Pineapple",
]


def upgrade() -> None:
    op.create_table(
        "empty_crate_balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("flavour_name", sa.String(length=100), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("flavour_name", name="uq_empty_crate_flavour"),
    )
    op.create_table(
        "empty_crate_update_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("flavour_name", sa.String(length=100), nullable=False),
        sa.Column("previous_value", sa.Integer(), nullable=False),
        sa.Column("new_value", sa.Integer(), nullable=False),
        sa.Column("difference", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(length=255), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by_username", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            index=True,
        ),
    )

    empty_crate_balances = sa.table(
        "empty_crate_balances",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("flavour_name", sa.String()),
        sa.column("available", sa.Integer()),
    )
    op.bulk_insert(
        empty_crate_balances,
        [{"id": uuid.uuid4(), "flavour_name": flavour, "available": 0} for flavour in FLAVOURS],
    )


def downgrade() -> None:
    op.drop_table("empty_crate_update_logs")
    op.drop_table("empty_crate_balances")
