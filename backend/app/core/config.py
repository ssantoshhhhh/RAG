from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env files."""

    app_name: str = "DocuMind"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = "postgresql+psycopg://documind:documind@localhost:5432/documind"

    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cookie_secure: bool = False
    cookie_domain: str | None = None

    frontend_origin: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    data_dir: Path = Path("data")
    chroma_persist_dir: Path = Path("data/chroma")
    chroma_collection: str = "documind_documents"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    chunk_size_tokens: int = 500
    chunk_overlap_tokens: int = 100
    min_chunk_tokens: int = 50
    retrieval_top_k: int = 5
    similarity_threshold: float = 0.2
    max_upload_bytes: int = 10 * 1024 * 1024

    llm_provider: Literal["ollama", "gemini"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3:instruct"
    ollama_timeout_seconds: float = 120.0
    ollama_num_ctx: int = 8192
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 45.0
    max_history_messages: int = 6

    sciq_import_email: str | None = None
    sciq_import_password: str | None = None

    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def llm_configured(self) -> bool:
        if self.llm_provider == "gemini":
            return bool(self.gemini_api_key)
        return bool(self.ollama_base_url.strip() and self.ollama_model.strip())

    @property
    def llm_model_name(self) -> str:
        if self.llm_provider == "gemini":
            return self.gemini_model.removeprefix("models/")
        return self.ollama_model

    @property
    def cors_origin_list(self) -> list[str]:
        origins = {o.strip() for o in self.cors_origins.split(",") if o.strip()}
        origins.add(self.frontend_origin)
        return sorted(origins)

    @property
    def resolved_data_dir(self) -> Path:
        path = self.data_dir
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def resolved_chroma_dir(self) -> Path:
        path = self.chroma_persist_dir
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def uploads_dir(self) -> Path:
        return self.resolved_data_dir / "uploads"

    @property
    def extracted_dir(self) -> Path:
        return self.resolved_data_dir / "extracted"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
