"""add user mobile for lark open id resolving"""

from alembic import op
import sqlalchemy as sa


revision = "20260608_0005"
down_revision = "20260605_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mobile", sa.String(length=32), nullable=True))
    op.create_index("ix_users_mobile", "users", ["mobile"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_mobile", table_name="users")
    op.drop_column("users", "mobile")
