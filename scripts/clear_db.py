"""
Clear all data from the Neon database.

Drops and recreates all tables (users, products, orders, installations),
then re-seeds products from seed.py.

Usage:
    python scripts/clear_db.py            # wipe + reseed
    python scripts/clear_db.py --no-seed  # wipe only
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from backend.config import get_settings
from backend.database import Base, get_engine
from backend.seed import seed_products
from sqlalchemy.orm import Session


def main() -> None:
    reseed = "--no-seed" not in sys.argv

    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set in your .env file.")

    engine = get_engine()

    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating schema...")
    Base.metadata.create_all(bind=engine)

    if reseed:
        print("Seeding products...")
        with Session(engine) as session:
            seed_products(session)
        print("Seed complete.")

    print("Done.")


if __name__ == "__main__":
    main()
