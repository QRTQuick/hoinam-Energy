from __future__ import annotations

from urllib.parse import urlparse, urlunparse, urlencode, parse_qs

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

from .config import get_settings

Base = declarative_base()
SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)
)
_engine = None


def _sanitize_database_url(url: str) -> str:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    qs.pop("channel_binding", None)
    qs.setdefault("sslmode", ["require"])
    new_query = urlencode({k: v[0] for k, v in qs.items()})
    return urlunparse(parsed._replace(query=new_query))


def _is_serverless() -> bool:
    """Detect Vercel / serverless environment."""
    import os
    return bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))


def get_engine():
    global _engine

    if _engine is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is required.")

        clean_url = _sanitize_database_url(settings.database_url)

        if _is_serverless():
            # Serverless: NullPool avoids connection exhaustion across invocations
            _engine = create_engine(
                clean_url,
                future=True,
                poolclass=NullPool,
                echo=False,
                connect_args={
                    "connect_timeout": 10,
                    "options": "-c statement_timeout=30000",
                },
            )
        else:
            # Persistent server (local dev, Railway, Render, etc.):
            # Use a small connection pool so connections are reused across requests.
            _engine = create_engine(
                clean_url,
                future=True,
                poolclass=QueuePool,
                pool_size=3,
                max_overflow=5,
                pool_timeout=20,
                pool_recycle=300,       # recycle connections every 5 min
                pool_pre_ping=True,     # test connection before use
                echo=False,
                connect_args={
                    "connect_timeout": 10,
                    "options": "-c statement_timeout=30000",
                },
            )
        SessionLocal.configure(bind=_engine)

    return _engine


def get_session():
    get_engine()
    return SessionLocal()


def close_session() -> None:
    SessionLocal.remove()


def init_database() -> None:
    engine = get_engine()
    # create_all is idempotent — only creates tables that don't exist yet
    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates(engine)
    _remove_bluetti_products(engine)


def _remove_bluetti_products(engine) -> None:
    """Archive Buttu products from the database (Bluetti is a valid brand)."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE products SET active = false "
                "WHERE LOWER(brand) = 'buttu' OR LOWER(store_slug) = 'buttu'"
            )
        )


def _ensure_schema_updates(engine) -> None:
    """Add missing columns to existing tables without dropping data."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # Map of table → {column_name: DDL type string}
    column_specs: dict[str, dict[str, str]] = {
        "users": {
            "needs_monitoring": "BOOLEAN NOT NULL DEFAULT false",
            "monitoring_reason": "TEXT",
        },
        "products": {
            "sku": "VARCHAR(64)",
            "brand": "VARCHAR(80)",
            "store_slug": "VARCHAR(80)",
            "category": "VARCHAR(128) NOT NULL DEFAULT 'Portable Power'",
            "summary": "VARCHAR(500)",
            "description": "TEXT",
            "price": "NUMERIC(12, 2) NOT NULL DEFAULT 0",
            "currency": "VARCHAR(16) NOT NULL DEFAULT 'NGN'",
            "stock": "INTEGER NOT NULL DEFAULT 0",
            "image_url": "TEXT",
            "highlights": "JSON NOT NULL DEFAULT '[]'::json",
            "featured": "BOOLEAN NOT NULL DEFAULT false",
            "active": "BOOLEAN NOT NULL DEFAULT true",
            "specs": "JSON",
            "created_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
            "updated_at": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
        },
        "orders": {
            "payment_method": "VARCHAR(32) NOT NULL DEFAULT 'bank_transfer'",
            "payment_details": "JSON",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in column_specs.items():
            if table_name not in tables:
                continue
            existing_columns = {
                col["name"] for col in inspector.get_columns(table_name)
            }
            for column_name, column_type in columns.items():
                if column_name not in existing_columns:
                    connection.execute(
                        text(
                            f'ALTER TABLE "{table_name}" ADD COLUMN {column_name} {column_type}'
                        )
                    )


def check_database_url() -> None:
    """Raise early at startup if DATABASE_URL is missing or malformed."""
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required but not set. "
            "Add it to your .env file or deployment environment."
        )
