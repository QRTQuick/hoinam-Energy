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


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


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
        default_factory=lambda: os.getenv(
            "FRONTEND_URL", "http://localhost:5000"
        ).rstrip("/")
    )
    opay_merchant_name: str = field(
        default_factory=lambda: os.getenv("OPAY_MERCHANT_NAME", "Hoinam Energy").strip()
    )
    opay_bank_name: str = field(
        default_factory=lambda: os.getenv("OPAY_BANK_NAME", "OPay").strip()
    )
    opay_account_number: str = field(
        default_factory=lambda: os.getenv("OPAY_ACCOUNT_NUMBER", "").strip()
    )
    opay_account_name: str = field(
        default_factory=lambda: os.getenv("OPAY_ACCOUNT_NAME", "").strip()
    )
    bank_transfer_account_number: str = field(
        default_factory=lambda: os.getenv("BANK_TRANSFER_ACCOUNT_NUMBER", "").strip()
    )
    bank_transfer_account_name: str = field(
        default_factory=lambda: os.getenv("BANK_TRANSFER_ACCOUNT_NAME", "").strip()
    )
    bank_transfer_bank_name: str = field(
        default_factory=lambda: os.getenv("BANK_TRANSFER_BANK_NAME", "").strip()
    )
    smtp_host: str = field(
        default_factory=lambda: os.getenv("SMTP_HOST", "smtp-relay.brevo.com").strip()
    )
    smtp_port: int = field(default_factory=lambda: _env_int("SMTP_PORT", 587))
    smtp_username: str = field(
        default_factory=lambda: os.getenv("SMTP_USERNAME", "").strip()
    )
    smtp_password: str = field(
        default_factory=lambda: os.getenv("SMTP_PASSWORD", "").strip()
    )
    smtp_from_email: str = field(
        default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", "").strip()
    )
    smtp_use_tls: bool = field(
        default_factory=lambda: _env_flag("SMTP_USE_TLS", True)
    )
    smtp_timeout_seconds: int = field(
        default_factory=lambda: _env_int("SMTP_TIMEOUT_SECONDS", 15)
    )
    order_notification_email: str = field(
        default_factory=lambda: os.getenv(
            "ORDER_NOTIFICATION_EMAIL", "sales@hoinamenergy.com"
        ).strip()
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
