"""add sub task started_at

Revision ID: 20260605_0004
Revises: 20260605_0003
Create Date: 2026-06-05
"""

from alembic import op
import sqlalchemy as sa

revision = "20260605_0004"
down_revision = "20260605_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sub_tasks", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("sub_tasks", "started_at")
