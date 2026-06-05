import os


class Settings:
    app_name: str
    app_version: str
    database_url: str
    attachment_root: str
    web_base_url: str
    seed_demo_data: bool

    def __init__(self) -> None:
        self.app_name = os.getenv("TASK_FOLLOW_APP_NAME", "公司任务跟踪系统")
        self.app_version = os.getenv("TASK_FOLLOW_APP_VERSION", "1.0.0")
        self.database_url = os.getenv(
            "TASK_FOLLOW_DATABASE_URL",
            "postgresql+psycopg://task_user:task_password@localhost:5432/task_follow",
        )
        self.attachment_root = os.getenv("TASK_FOLLOW_ATTACHMENT_ROOT", "../data/attachments")
        self.web_base_url = os.getenv("TASK_FOLLOW_WEB_BASE_URL", "http://localhost:8080")
        self.seed_demo_data = os.getenv("TASK_FOLLOW_SEED_DEMO_DATA", "true").lower() == "true"
        self.admin_username = os.getenv("TASK_FOLLOW_ADMIN_USERNAME", "jiafei0108")
        self.admin_name = os.getenv("TASK_FOLLOW_ADMIN_NAME", "贾飞")
        self.admin_password = os.getenv("TASK_FOLLOW_ADMIN_PASSWORD")
        self.admin_password_hash = os.getenv("TASK_FOLLOW_ADMIN_PASSWORD_HASH")


settings = Settings()
