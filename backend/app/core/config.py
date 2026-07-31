from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    """Railway/Postgres often provide postgresql://; SQLAlchemy async needs +asyncpg."""
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kaaralan_goli_soda"
    SECRET_KEY: str = "change_this_to_a_long_random_string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    IDLE_SESSION_TIMEOUT_MINUTES: int = 60
    COOKIE_SECURE: bool = False
    # Empty = host-only cookie (recommended for api.kaaraalan.in).
    # Production alternative: .kaaraalan.in (shared across subdomains).
    COOKIE_DOMAIN: str = ""
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ADMIN_SEED_USERNAME: str = "admin"
    ADMIN_SEED_PASSWORD: str = "admin"

    ACCESS_COOKIE_NAME: str = "access_token"
    REFRESH_COOKIE_NAME: str = "refresh_token"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_db_url(cls, value: str) -> str:
        if not value:
            return value
        return _normalize_database_url(str(value))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
