"""department task departments and pending split markers

Revision ID: 20260605_0003
Revises: 20260605_0002
Create Date: 2026-06-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260605_0003"
down_revision = "20260605_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "department_tasks",
        sa.Column("pending_split_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "department_tasks",
        sa.Column("pending_split_codes", postgresql.JSONB(), nullable=True),
    )
    op.create_table(
        "department_task_departments",
        sa.Column(
            "department_task_id",
            sa.Integer(),
            sa.ForeignKey("department_tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.execute(
        """
        INSERT INTO department_task_departments (department_task_id, department_id)
        SELECT id, department_id
        FROM department_tasks
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("department_task_departments")
    op.drop_column("department_tasks", "pending_split_codes")
    op.drop_column("department_tasks", "pending_split_count")
