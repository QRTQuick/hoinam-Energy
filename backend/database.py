from __future__ import annotations

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker
from sqlalchemy.pool import QueuePool

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

        # Configure connection pooling for high concurrency
        # pool_size: number of connections to keep in the pool
        # max_overflow: additional connections that can be created when pool is exhausted
        # pool_recycle: recycle connections after this many seconds (helps with connection timeout issues)
        # pool_pre_ping: test connections before using them
        _engine = create_engine(
            settings.database_url,
            future=True,
            pool_size=30,
            max_overflow=60,
            pool_recycle=3600,
            pool_pre_ping=True,
            poolclass=QueuePool,
            echo=False,
            connect_args={
                "connect_timeout": 10,
                "options": "-c statement_timeout=30000",  # 30 second timeout per statement
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

            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, column_type in columns.items():
                if column_name in existing_columns:
                    continue
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
