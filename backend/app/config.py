"""Application settings, loaded from environment variables / backend/.env."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Settings:
    """Mutable so tests can override paths and thresholds."""

    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", "").strip())
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini")
    embedding_model: str = "text-embedding-3-small"
    admin_password: str = field(default_factory=lambda: os.getenv("ADMIN_PASSWORD", "admin123"))

    knowledge_dir: Path = BASE_DIR / "knowledge"
    orders_file: Path = BASE_DIR / "data" / "orders.json"
    storage_dir: Path = BASE_DIR / "storage"

    # Cost controls
    max_output_tokens: int = field(default_factory=lambda: _int("MAX_OUTPUT_TOKENS", 350))
    retrieval_k: int = 4
    max_history_messages: int = 8
    max_message_chars: int = 1000
    rate_limit_per_minute: int = field(default_factory=lambda: _int("RATE_LIMIT_PER_MINUTE", 12))

    # Chunks with cosine distance above this are treated as "not relevant".
    relevance_max_distance: float = field(default_factory=lambda: _float("RELEVANCE_MAX_DISTANCE", 0.62))
    request_timeout: float = 25.0

    @property
    def db_path(self) -> Path:
        return self.storage_dir / "app.db"

    @property
    def chroma_dir(self) -> Path:
        return self.storage_dir / "chroma"

    @property
    def has_api_key(self) -> bool:
        return bool(self.openai_api_key)


settings = Settings()
