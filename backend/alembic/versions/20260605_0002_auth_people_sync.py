"""auth people and base sync

Revision ID: 20260605_0002
Revises: 20260605_0001
Create Date: 2026-06-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260605_0002"
down_revision = "20260605_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("username", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(260), nullable=True))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("source", sa.String(32), nullable=False, server_default="manual"))
    op.add_column("users", sa.Column("open_id_bound_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "base_sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(160), nullable=False, server_default="2026任务跟踪表"),
        sa.Column("base_token", sa.String(160), nullable=True),
        sa.Column("table_name", sa.String(160), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("record_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("raw_summary", postgresql.JSONB(), nullable=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("base_sync_runs")
    op.drop_table("auth_sessions")
    op.drop_index("ix_users_username", table_name="users")
    for column in [
        "last_login_at",
        "open_id_bound_at",
        "source",
        "is_admin",
        "password_hash",
        "username",
    ]:
        op.drop_column("users", column)
