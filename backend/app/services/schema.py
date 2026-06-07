from sqlalchemy import text

from app.db.session import engine


def ensure_runtime_schema() -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(120)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(260)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(32) DEFAULT 'manual'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS open_id_bound_at TIMESTAMPTZ",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)",
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
        "ALTER TABLE department_tasks ADD COLUMN IF NOT EXISTS pending_split_count INTEGER DEFAULT 0",
        "ALTER TABLE department_tasks ADD COLUMN IF NOT EXISTS pending_split_codes JSONB",
        "ALTER TABLE sub_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
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
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
