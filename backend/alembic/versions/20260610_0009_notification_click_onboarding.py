"""notification click tracking and user onboarding"""

from alembic import op
import sqlalchemy as sa


revision = "20260610_0009"
down_revision = "20260610_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("onboarding_version", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("onboarding_status", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notification_records", sa.Column("first_clicked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("notification_records", sa.Column("last_clicked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "notification_records",
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("notification_records", "click_count")
    op.drop_column("notification_records", "last_clicked_at")
    op.drop_column("notification_records", "first_clicked_at")
    op.drop_column("users", "onboarding_completed_at")
    op.drop_column("users", "onboarding_status")
    op.drop_column("users", "onboarding_version")
