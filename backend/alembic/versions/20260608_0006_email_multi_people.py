"""email binding and multi-person task relationships"""

from alembic import op
import sqlalchemy as sa


revision = "20260608_0006"
down_revision = "20260608_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_mobile")
    op.drop_column("users", "mobile")
    op.add_column("users", sa.Column("email", sa.String(length=180), nullable=True))
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "parent_task_owners",
        sa.Column("parent_task_id", sa.Integer(), sa.ForeignKey("parent_tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "department_task_owners",
        sa.Column("department_task_id", sa.Integer(), sa.ForeignKey("department_tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "sub_task_owners",
        sa.Column("sub_task_id", sa.Integer(), sa.ForeignKey("sub_tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "sub_task_executors",
        sa.Column("sub_task_id", sa.Integer(), sa.ForeignKey("sub_tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.execute("INSERT INTO parent_task_owners (parent_task_id, user_id) SELECT id, owner_id FROM parent_tasks")
    op.execute("INSERT INTO department_task_owners (department_task_id, user_id) SELECT id, owner_id FROM department_tasks")
    op.execute("INSERT INTO sub_task_owners (sub_task_id, user_id) SELECT id, owner_id FROM sub_tasks")
    op.execute("INSERT INTO sub_task_executors (sub_task_id, user_id) SELECT id, executor_id FROM sub_tasks")

    op.add_column("weekly_updates", sa.Column("assignee_id", sa.Integer(), nullable=True))
    op.add_column("weekly_updates", sa.Column("risk_level", sa.String(length=32), nullable=True))
    op.create_foreign_key("fk_weekly_updates_assignee_id_users", "weekly_updates", "users", ["assignee_id"], ["id"])
    op.execute(
        """
        UPDATE weekly_updates
        SET assignee_id = sub_tasks.executor_id
        FROM sub_tasks
        WHERE weekly_updates.sub_task_id = sub_tasks.id
          AND weekly_updates.assignee_id IS NULL
        """
    )
    op.alter_column("weekly_updates", "assignee_id", nullable=False)
    op.drop_constraint("uq_weekly_update_subtask_week", "weekly_updates", type_="unique")
    op.create_unique_constraint(
        "uq_weekly_update_subtask_week_assignee",
        "weekly_updates",
        ["sub_task_id", "week_key", "assignee_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_weekly_update_subtask_week_assignee", "weekly_updates", type_="unique")
    op.create_unique_constraint("uq_weekly_update_subtask_week", "weekly_updates", ["sub_task_id", "week_key"])
    op.drop_constraint("fk_weekly_updates_assignee_id_users", "weekly_updates", type_="foreignkey")
    op.drop_column("weekly_updates", "risk_level")
    op.drop_column("weekly_updates", "assignee_id")

    op.drop_table("sub_task_executors")
    op.drop_table("sub_task_owners")
    op.drop_table("department_task_owners")
    op.drop_table("parent_task_owners")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")
    op.add_column("users", sa.Column("mobile", sa.String(length=32), nullable=True))
    op.create_index("ix_users_mobile", "users", ["mobile"], unique=True)
