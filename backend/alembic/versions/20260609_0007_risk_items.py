"""risk items and legacy risk cleanup"""

from alembic import op
import sqlalchemy as sa


revision = "20260609_0007"
down_revision = "20260608_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=80), nullable=False, unique=True),
        sa.Column("sub_task_id", sa.Integer(), sa.ForeignKey("sub_tasks.id"), nullable=False),
        sa.Column("source_weekly_update_id", sa.Integer(), sa.ForeignKey("weekly_updates.id"), nullable=True),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("impact_score", sa.Integer(), nullable=False),
        sa.Column("likelihood_score", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=32), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_risk_items_sub_task_id", "risk_items", ["sub_task_id"])
    op.create_index("ix_risk_items_status_level", "risk_items", ["status", "level"])
    op.execute("DELETE FROM risk_records")
    op.execute("DELETE FROM coordination_items")
    op.execute("UPDATE sub_tasks SET risk_level = 'none' WHERE risk_level IS DISTINCT FROM 'none'")
    op.execute("UPDATE weekly_updates SET risk_level = NULL WHERE risk_level IS NOT NULL")


def downgrade() -> None:
    op.drop_index("ix_risk_items_status_level", table_name="risk_items")
    op.drop_index("ix_risk_items_sub_task_id", table_name="risk_items")
    op.drop_table("risk_items")
