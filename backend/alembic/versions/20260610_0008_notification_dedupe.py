"""notification dedupe key"""

from alembic import op
import sqlalchemy as sa


revision = "20260610_0008"
down_revision = "20260609_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_records", sa.Column("dedupe_key", sa.String(length=240), nullable=True))
    op.create_index(
        "ix_notification_records_dedupe_key",
        "notification_records",
        ["dedupe_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_records_dedupe_key", table_name="notification_records")
    op.drop_column("notification_records", "dedupe_key")
