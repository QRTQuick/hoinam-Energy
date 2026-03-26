from __future__ import annotations

from sqlalchemy import create_engine
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
