from sqlalchemy import text

from app.db.session import engine


def ensure_runtime_schema() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(120)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(260)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'manual'",
        "DROP INDEX IF EXISTS ix_users_mobile",
        "ALTER TABLE users DROP COLUMN IF EXISTS mobile",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(180)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS open_id_bound_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_version VARCHAR(32)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(32)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ",
        """
        CREATE TABLE IF NOT EXISTS user_guide_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            guide_key VARCHAR(120) NOT NULL,
            version VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_guide_progress UNIQUE (user_id, guide_key, version)
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email)",
        "DROP INDEX IF EXISTS ix_users_username",
        """
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id SERIAL PRIMARY KEY,
            token_hash VARCHAR(128) UNIQUE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS base_sync_runs (
            id SERIAL PRIMARY KEY,
            source_name VARCHAR(160) DEFAULT '2026任务跟踪表',
            base_token VARCHAR(160),
            table_name VARCHAR(160),
            status VARCHAR(32) DEFAULT 'pending',
            record_count INTEGER DEFAULT 0,
            message TEXT,
            raw_summary JSONB,
            actor_id INTEGER REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS work_items (
            id SERIAL PRIMARY KEY,
            submitter_id INTEGER NOT NULL REFERENCES users(id),
            department_id INTEGER REFERENCES departments(id),
            week_key VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            category VARCHAR(60) NOT NULL,
            status VARCHAR(32) DEFAULT 'pending' NOT NULL,
            related_department_task_id INTEGER REFERENCES department_tasks(id),
            collaboration_department_id INTEGER REFERENCES departments(id),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_work_items_submitter_status ON work_items(submitter_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_work_items_category_status ON work_items(category, status)",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS converted_sub_task_id INTEGER REFERENCES sub_tasks(id)",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS submitter_department_approved_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS submitter_department_approved_at TIMESTAMPTZ",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS submitter_department_approval_comment TEXT",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS collaboration_department_approved_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS collaboration_department_approved_at TIMESTAMPTZ",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS collaboration_department_approval_comment TEXT",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS escalated_by_id INTEGER REFERENCES users(id)",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ",
        "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS escalation_comment TEXT",
        """
        CREATE TABLE IF NOT EXISTS work_item_events (
            id SERIAL PRIMARY KEY,
            work_item_id INTEGER NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
            actor_id INTEGER REFERENCES users(id),
            action VARCHAR(60) NOT NULL,
            comment TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_work_item_events_work_item_id ON work_item_events(work_item_id)",
        """
        CREATE TABLE IF NOT EXISTS work_item_automation_settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category VARCHAR(60) NOT NULL,
            notify_enabled BOOLEAN DEFAULT FALSE NOT NULL,
            auto_approve_enabled BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            CONSTRAINT uq_work_item_automation_user_category UNIQUE (user_id, category)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_work_item_automation_user ON work_item_automation_settings(user_id)",
        """
        CREATE TABLE IF NOT EXISTS weekly_reports (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            week_key VARCHAR(20) NOT NULL,
            task_update_snapshot JSONB DEFAULT '[]'::jsonb NOT NULL,
            work_item_snapshot JSONB DEFAULT '[]'::jsonb NOT NULL,
            risk_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL,
            next_plan_snapshot JSONB DEFAULT '[]'::jsonb NOT NULL,
            export_text TEXT NOT NULL,
            status VARCHAR(32) DEFAULT 'confirmed' NOT NULL,
            confirmed_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            CONSTRAINT uq_weekly_reports_user_week UNIQUE (user_id, week_key)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_weekly_reports_user_week ON weekly_reports(user_id, week_key)",
        "ALTER TABLE department_tasks ADD COLUMN IF NOT EXISTS pending_split_count INTEGER DEFAULT 0",
        "ALTER TABLE department_tasks ADD COLUMN IF NOT EXISTS pending_split_codes JSONB",
        "ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
        "ALTER TABLE weekly_updates ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id)",
        "ALTER TABLE weekly_updates ADD COLUMN IF NOT EXISTS risk_level VARCHAR(32)",
        """
        CREATE TABLE IF NOT EXISTS risk_items (
            id SERIAL PRIMARY KEY,
            code VARCHAR(80) UNIQUE NOT NULL,
            sub_task_id INTEGER NOT NULL REFERENCES sub_tasks(id),
            source_weekly_update_id INTEGER REFERENCES weekly_updates(id),
            title VARCHAR(240) NOT NULL,
            description TEXT,
            impact_score INTEGER NOT NULL,
            likelihood_score INTEGER NOT NULL,
            score INTEGER NOT NULL,
            level VARCHAR(32) NOT NULL,
            owner_id INTEGER NOT NULL REFERENCES users(id),
            status VARCHAR(32) DEFAULT 'open' NOT NULL,
            due_date DATE,
            resolution_note TEXT,
            created_by_id INTEGER REFERENCES users(id),
            updated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_risk_items_sub_task_id ON risk_items(sub_task_id)",
        "CREATE INDEX IF NOT EXISTS ix_risk_items_status_level ON risk_items(status, level)",
        "DELETE FROM risk_records",
        "DELETE FROM coordination_items",
        "UPDATE sub_tasks SET risk_level = 'none' WHERE risk_level IS DISTINCT FROM 'none'",
        "UPDATE weekly_updates SET risk_level = NULL WHERE risk_level IS NOT NULL",
        "ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(240)",
        "ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ",
        "ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ",
        "ALTER TABLE notification_records ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0",
        "UPDATE notification_records SET click_count = 0 WHERE click_count IS NULL",
        "ALTER TABLE notification_records ALTER COLUMN click_count SET NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_notification_records_dedupe_key ON notification_records(dedupe_key)",
        """
        UPDATE weekly_updates
        SET assignee_id = sub_tasks.executor_id
        FROM sub_tasks
        WHERE weekly_updates.sub_task_id = sub_tasks.id
          AND weekly_updates.assignee_id IS NULL
        """,
        "ALTER TABLE weekly_updates ALTER COLUMN assignee_id SET NOT NULL",
        "ALTER TABLE weekly_updates DROP CONSTRAINT IF EXISTS uq_weekly_update_subtask_week",
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_weekly_update_subtask_week_assignee'
            ) THEN
                ALTER TABLE weekly_updates
                ADD CONSTRAINT uq_weekly_update_subtask_week_assignee
                UNIQUE (sub_task_id, week_key, assignee_id);
            END IF;
        END $$;
        """,
        """
        CREATE TABLE IF NOT EXISTS department_task_departments (
            department_task_id INTEGER NOT NULL REFERENCES department_tasks(id) ON DELETE CASCADE,
            department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
            PRIMARY KEY (department_task_id, department_id)
        )
        """,
        """
        INSERT INTO department_task_departments (department_task_id, department_id)
        SELECT id, department_id
        FROM department_tasks
        ON CONFLICT DO NOTHING
        """,
        """
        CREATE TABLE IF NOT EXISTS parent_task_owners (
            parent_task_id INTEGER NOT NULL REFERENCES parent_tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (parent_task_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS department_task_owners (
            department_task_id INTEGER NOT NULL REFERENCES department_tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (department_task_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sub_task_owners (
            sub_task_id INTEGER NOT NULL REFERENCES sub_tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (sub_task_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS sub_task_executors (
            sub_task_id INTEGER NOT NULL REFERENCES sub_tasks(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (sub_task_id, user_id)
        )
        """,
        """
        INSERT INTO parent_task_owners (parent_task_id, user_id)
        SELECT id, owner_id FROM parent_tasks
        ON CONFLICT DO NOTHING
        """,
        """
        INSERT INTO department_task_owners (department_task_id, user_id)
        SELECT id, owner_id FROM department_tasks
        ON CONFLICT DO NOTHING
        """,
        """
        INSERT INTO sub_task_owners (sub_task_id, user_id)
        SELECT id, owner_id FROM sub_tasks
        ON CONFLICT DO NOTHING
        """,
        """
        INSERT INTO sub_task_executors (sub_task_id, user_id)
        SELECT id, executor_id FROM sub_tasks
        ON CONFLICT DO NOTHING
        """,
        """
        UPDATE sub_tasks
        SET owner_id = department_tasks.owner_id
        FROM department_tasks
        WHERE sub_tasks.department_task_id = department_tasks.id
          AND sub_tasks.status != 'archived'
          AND sub_tasks.owner_id IS DISTINCT FROM department_tasks.owner_id
        """,
        """
        DELETE FROM sub_task_owners
        USING sub_tasks
        WHERE sub_task_owners.sub_task_id = sub_tasks.id
          AND sub_tasks.status != 'archived'
        """,
        """
        INSERT INTO sub_task_owners (sub_task_id, user_id)
        SELECT sub_tasks.id, department_task_owners.user_id
        FROM sub_tasks
        JOIN department_task_owners
          ON department_task_owners.department_task_id = sub_tasks.department_task_id
        WHERE sub_tasks.status != 'archived'
        ON CONFLICT DO NOTHING
        """,
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
