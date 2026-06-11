"""permission layering and role guide progress"""

from alembic import op
import sqlalchemy as sa


revision = "20260611_0010"
down_revision = "20260610_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_guide_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guide_key", sa.String(length=120), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "guide_key", "version", name="uq_user_guide_progress"),
    )

    op.execute(
        """
        UPDATE sub_tasks
        SET owner_id = department_tasks.owner_id
        FROM department_tasks
        WHERE sub_tasks.department_task_id = department_tasks.id
          AND sub_tasks.status != 'archived'
        """
    )
    op.execute(
        """
        DELETE FROM sub_task_owners
        USING sub_tasks
        WHERE sub_task_owners.sub_task_id = sub_tasks.id
          AND sub_tasks.status != 'archived'
        """
    )
    op.execute(
        """
        INSERT INTO sub_task_owners (sub_task_id, user_id)
        SELECT sub_tasks.id, department_task_owners.user_id
        FROM sub_tasks
        JOIN department_task_owners
          ON department_task_owners.department_task_id = sub_tasks.department_task_id
        WHERE sub_tasks.status != 'archived'
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        DELETE FROM role_permissions
        USING roles, permissions
        WHERE role_permissions.role_id = roles.id
          AND role_permissions.permission_id = permissions.id
          AND roles.code IN ('parent_owner', 'department_owner')
          AND permissions.code = 'task.edit_sub'
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT roles.id, permissions.id
        FROM roles, permissions
        WHERE roles.code = 'department_owner'
          AND permissions.code = 'task.split_department'
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        DELETE FROM user_roles
        USING roles AS department_role, user_roles AS task_assignment, roles AS task_role
        WHERE user_roles.role_id = department_role.id
          AND department_role.code = 'department_owner'
          AND task_assignment.user_id = user_roles.user_id
          AND task_assignment.role_id = task_role.id
          AND task_role.code = 'task_owner'
          AND NOT EXISTS (
              SELECT 1 FROM departments WHERE departments.manager_id = user_roles.user_id
          )
        """
    )


def downgrade() -> None:
    op.drop_table("user_guide_progress")
