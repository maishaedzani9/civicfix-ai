from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CivicFix AI API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://civicfix:civicfix@localhost:5432/civicfix"
    supabase_jwt_issuer: str = Field(default="", description="Expected JWT issuer")
    supabase_jwks_url: str = Field(default="", description="Supabase JWKS URL")
    supabase_jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:3000"

    demo_mode: bool = False
    demo_jwt_secret: str = ""
    ai_api_key: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4.1-mini"
    evidence_directory: str = "uploads"
    supabase_url: str = ""
    supabase_service_key: str = ""
    evidence_bucket: str = "incident-evidence"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def authentication_configured(self) -> bool:
        return bool(self.supabase_jwt_issuer and self.supabase_jwks_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
