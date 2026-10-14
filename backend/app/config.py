import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
FRONTEND_DIR = BASE_DIR.parent / "frontend"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str = f"sqlite:///{BASE_DIR / 'fitness.db'}"

    admin_username: str = "admin"
    admin_password: str = ""
    secret_key: str = ""
    access_token_minutes: int = 60

    inquiry_notify_email: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    seed_sample_data: bool = True
    enable_api_docs: bool = False


settings = Settings()


def get_secret_key() -> str:
    """Use SECRET_KEY if set, otherwise generate one once and persist it."""
    if settings.secret_key:
        return settings.secret_key
    path = BASE_DIR / ".secret_key"
    if path.exists():
        return path.read_text().strip()
    key = secrets.token_urlsafe(48)
    path.write_text(key)
    path.chmod(0o600)
    return key
