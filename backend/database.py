from __future__ import annotations

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker
from sqlalchemy.pool import NullPool

from .config import get_settings

Base = declarative_base()
SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)
)
_engine = None


def get_engine():
    global _engine

    if _engine is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is required.")
        _engine = create_engine(
            settings.database_url,
            future=True,
            pool_pre_ping=True,
            poolclass=NullPool,
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
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates(engine)


def ensure_schema_updates(engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    column_specs = {
        "users": {
            "needs_monitoring": "BOOLEAN NOT NULL DEFAULT false",
            "monitoring_reason": "TEXT",
        },
        "products": {
            "brand": "VARCHAR(80)",
            "store_slug": "VARCHAR(80)",
        },
        "orders": {
            "payment_method": "VARCHAR(32) NOT NULL DEFAULT 'opay_transfer'",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in column_specs.items():
            if table_name not in tables:
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN {column_name} {column_type}'))


def check_database_url() -> None:
    """Raise early at startup if DATABASE_URL is missing or malformed."""
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required but not set. "
            "Add it to your .env file or deployment environment."
        )
