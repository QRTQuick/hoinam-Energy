from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _normalize_database_url(value: str) -> str:
    value = (value or "").strip()
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _admin_email_set() -> set[str]:
    return {email.lower() for email in _env_list("ADMIN_EMAILS")}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: _normalize_database_url(os.getenv("DATABASE_URL", ""))
    )
    default_currency: str = field(
        default_factory=lambda: os.getenv("DEFAULT_CURRENCY", "NGN").strip() or "NGN"
    )
    cors_origins: list[str] = field(default_factory=lambda: _env_list("CORS_ORIGINS"))
    frontend_url: str = field(
        default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:5000").rstrip("/")
    )
    paystack_secret_key: str = field(default_factory=lambda: os.getenv("PAYSTACK_SECRET_KEY", "").strip())
    allow_demo_payments: bool = field(
        default_factory=lambda: _env_flag("ALLOW_DEMO_PAYMENTS", default=False)
    )
    admin_emails: set[str] = field(default_factory=_admin_email_set)
    firebase_credentials_json: str = field(
        default_factory=lambda: os.getenv("FIREBASE_CREDENTIALS_JSON", "").strip()
    )

    def firebase_credentials(self) -> dict[str, Any] | None:
        if not self.firebase_credentials_json:
            return None

        payload = json.loads(self.firebase_credentials_json)
        private_key = payload.get("private_key")
        if private_key:
            payload["private_key"] = private_key.replace("\\n", "\n")
        return payload

    @property
    def paystack_callback_url(self) -> str:
        return f"{self.frontend_url}/checkout.html?payment=complete"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
