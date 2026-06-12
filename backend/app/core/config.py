import os


def parse_csv_env(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


class Settings:
    app_name: str
    app_version: str
    database_url: str
    attachment_root: str
    web_base_url: str
    seed_demo_data: bool

    def __init__(self) -> None:
        self.app_name = os.getenv("TASK_FOLLOW_APP_NAME", "公司任务跟踪系统")
        self.app_version = os.getenv("TASK_FOLLOW_APP_VERSION", "1.3.0")
        self.database_url = os.getenv(
            "TASK_FOLLOW_DATABASE_URL",
            "postgresql+psycopg://task_user:task_password@localhost:5432/task_follow",
        )
        self.attachment_root = os.getenv("TASK_FOLLOW_ATTACHMENT_ROOT", "../data/attachments")
        self.web_base_url = os.getenv("TASK_FOLLOW_WEB_BASE_URL", "http://localhost:8080")
        self.seed_demo_data = os.getenv("TASK_FOLLOW_SEED_DEMO_DATA", "false").lower() == "true"
        self.cors_origins = parse_csv_env(os.getenv("TASK_FOLLOW_CORS_ORIGINS", "http://localhost:8080"))
        self.cookie_secure = os.getenv("TASK_FOLLOW_COOKIE_SECURE", "false").lower() == "true"
        self.admin_username = os.getenv("TASK_FOLLOW_ADMIN_USERNAME", "jiafei0108")
        self.admin_name = os.getenv("TASK_FOLLOW_ADMIN_NAME", "贾飞")
        self.admin_password = os.getenv("TASK_FOLLOW_ADMIN_PASSWORD")
        self.admin_password_hash = os.getenv("TASK_FOLLOW_ADMIN_PASSWORD_HASH")
        self.lark_enabled = os.getenv("TASK_FOLLOW_LARK_ENABLED", "false").lower() == "true"
        self.lark_app_id = os.getenv("TASK_FOLLOW_LARK_APP_ID")
        self.lark_app_secret = os.getenv("TASK_FOLLOW_LARK_APP_SECRET")
        self.lark_api_base_url = os.getenv("TASK_FOLLOW_LARK_API_BASE_URL", "https://open.feishu.cn")
        self.lark_message_receive_id_type = os.getenv("TASK_FOLLOW_LARK_MESSAGE_RECEIVE_ID_TYPE", "open_id")
        self.lark_token_refresh_margin_seconds = int(os.getenv("TASK_FOLLOW_LARK_TOKEN_REFRESH_MARGIN_SECONDS", "300"))
        self.lark_request_timeout_seconds = float(os.getenv("TASK_FOLLOW_LARK_REQUEST_TIMEOUT_SECONDS", "12"))
        self.lark_message_max_chars = int(os.getenv("TASK_FOLLOW_LARK_MESSAGE_MAX_CHARS", "1800"))
        self.lark_link_secret = os.getenv("TASK_FOLLOW_LINK_SECRET")
        self.lark_link_ttl_seconds = int(os.getenv("TASK_FOLLOW_LARK_LINK_TTL_SECONDS", str(7 * 24 * 60 * 60)))
        self.lark_oauth_redirect_uri = os.getenv(
            "TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI",
            f"{self.web_base_url.rstrip('/')}/api/auth/lark-oauth/callback",
        )
        self.lark_oauth_redirect_mode = os.getenv("TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE", "configured")
        self.lark_oauth_state_secret = os.getenv("TASK_FOLLOW_LARK_OAUTH_STATE_SECRET")
        self.lark_oauth_state_ttl_seconds = int(os.getenv("TASK_FOLLOW_LARK_OAUTH_STATE_TTL_SECONDS", "600"))
        self.scheduler_enabled = os.getenv("TASK_FOLLOW_SCHEDULER_ENABLED", "true").lower() == "true"
        self.scheduler_timezone = os.getenv("TASK_FOLLOW_SCHEDULER_TIMEZONE", "Asia/Shanghai")
        self.notification_delivery_mode = os.getenv("TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE", "all").lower()
        self.notification_allowlist_emails = {
            item.strip().lower()
            for item in os.getenv("TASK_FOLLOW_NOTIFICATION_ALLOWLIST_EMAILS", "").split(",")
            if item.strip()
        }


settings = Settings()
