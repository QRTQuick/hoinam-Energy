from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.config import get_settings
from backend.database import Base
from backend.models import Product
from backend.seed import SEED_PRODUCTS, seed_products
from backend.utils import slugify, to_decimal

CONFLICTING_TABLES = ["products", "orders", "installations", "users"]


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def humanize_category(value: str | None) -> str:
    if not value:
        return "Portable Power"
    cleaned = value.replace("_", " ").replace("-", " ").strip()
    return " ".join(word.capitalize() for word in cleaned.split()) or "Portable Power"


def build_seed_lookup() -> dict[str, dict]:
    return {normalize_key(item["name"]): item for item in SEED_PRODUCTS}


def summary_for_product(name: str, description: str | None, seed_meta: dict | None) -> str:
    if seed_meta and seed_meta.get("summary"):
        return seed_meta["summary"]

    description = (description or "").strip()
    if not description:
        return f"{name} ready for storefront publication."
    if len(description) <= 255:
        return description
    return f"{description[:252].rstrip()}..."


def backup_and_drop_conflicting_tables(engine) -> list[tuple[str, str, int]]:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names(schema="public"))
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    backups: list[tuple[str, str, int]] = []

    with engine.begin() as connection:
        for table_name in CONFLICTING_TABLES:
            if table_name not in existing_tables:
                continue

            row_count = connection.execute(
                text(f'SELECT COUNT(*) FROM public."{table_name}"')
            ).scalar_one()
            backup_name = f"{table_name}_backup_pre_hoinam_{stamp}"
            connection.execute(
                text(
                    f'CREATE TABLE public."{backup_name}" AS TABLE public."{table_name}"'
                )
            )
            connection.execute(text(f'DROP TABLE public."{table_name}" CASCADE'))
            backups.append((table_name, backup_name, row_count))

    return backups


def import_legacy_products(engine) -> int:
    inspector = inspect(engine)
    if "Products" not in inspector.get_table_names(schema="public"):
        return 0

    seed_lookup = build_seed_lookup()
    settings = get_settings()

    with Session(engine) as session:
        legacy_rows = session.execute(
            text(
                'SELECT id, name, category, price, stock, description, "createdAt", "updatedAt" '
                'FROM public."Products" ORDER BY name'
            )
        ).mappings().all()

        imported = 0
        for row in legacy_rows:
            seed_meta = seed_lookup.get(normalize_key(row["name"]))
            canonical_name = seed_meta["name"] if seed_meta else row["name"].strip()
            product = Product(
                name=canonical_name,
                slug=slugify(canonical_name),
                sku=slugify(canonical_name).upper().replace("-", "_"),
                category=seed_meta.get("category") if seed_meta else humanize_category(row["category"]),
                summary=summary_for_product(canonical_name, row["description"], seed_meta),
                description=(row["description"] or (seed_meta or {}).get("description")),
                price=to_decimal(row["price"]),
                currency=settings.default_currency,
                stock=int(row["stock"] or 0),
                image_url=None,
                highlights=(seed_meta or {}).get("highlights", []),
                featured=bool((seed_meta or {}).get("featured", False)),
                active=True,
            )

            if row["createdAt"] is not None:
                product.created_at = row["createdAt"]
            if row["updatedAt"] is not None:
                product.updated_at = row["updatedAt"]

            session.add(product)
            imported += 1

        session.commit()
        seed_products(session)
        return imported


def main() -> int:
    load_dotenv(ROOT / ".env")
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required.")

    engine = create_engine(database_url, future=True, pool_pre_ping=True)

    print("Starting Neon schema migration...")
    backups = backup_and_drop_conflicting_tables(engine)
    if backups:
        for source_name, backup_name, row_count in backups:
            print(f'Backed up {source_name} ({row_count} rows) to "{backup_name}"')
    else:
        print("No conflicting lowercase tables needed backup.")

    Base.metadata.create_all(bind=engine)
    print("Created fresh lowercase schema for users, products, orders, and installations.")

    imported_products = import_legacy_products(engine)
    print(f"Imported {imported_products} product rows from legacy \"Products\".")

    with engine.connect() as connection:
        for table_name in ["users", "products", "orders", "installations"]:
            count = connection.execute(
                text(f'SELECT COUNT(*) FROM public."{table_name}"')
            ).scalar_one()
            print(f"{table_name}: {count}")

    print("Migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
