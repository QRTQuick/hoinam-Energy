#!/usr/bin/env python
"""
Sync product prices, stock, descriptions, and image links from STOCK INVENTORY.xlsx.

Run from the project root:
    python scripts/update_inventory_prices.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from backend.database import close_session, get_session, init_database
from backend.inventory import DEFAULT_INVENTORY_PATH, parse_stock_inventory
from backend.models import Product
from backend.seed import upsert_inventory_products


def existing_product_lookup(session):
    products = session.query(Product).all()
    by_slug = {product.slug: product for product in products if product.slug}
    by_sku = {product.sku: product for product in products if product.sku}
    return by_slug, by_sku


def count_matches(session, inventory_products: list[dict]) -> tuple[int, int]:
    by_slug, by_sku = existing_product_lookup(session)
    matched_ids = set()

    for product in inventory_products:
        existing = (
            by_sku.get(product.get("sku"))
            or by_slug.get(product.get("slug"))
            or by_slug.get(product.get("legacy_slug"))
        )
        if existing is not None:
            matched_ids.add(existing.id)

    updated = len(matched_ids)
    created = len(inventory_products) - updated
    return updated, created


def main() -> int:
    print("=" * 70)
    print("INVENTORY PRICE UPDATE")
    print("=" * 70)

    if not DEFAULT_INVENTORY_PATH.is_file():
        print(f"[X] Inventory workbook not found: {DEFAULT_INVENTORY_PATH}")
        return 1

    inventory_products = parse_stock_inventory(DEFAULT_INVENTORY_PATH)
    if not inventory_products:
        print("[X] No products were found in STOCK INVENTORY.xlsx")
        return 1

    with_images = sum(1 for product in inventory_products if product.get("image_url"))
    print(f"[OK] Parsed {len(inventory_products)} products from STOCK INVENTORY.xlsx")
    print(f"[OK] Products with local images: {with_images}/{len(inventory_products)}")

    session = None
    try:
        init_database()
        session = get_session()
        updated, created = count_matches(session, inventory_products)
        upsert_inventory_products(session, [dict(product) for product in inventory_products])
    except Exception as exc:
        if session is not None:
            session.rollback()
        print(f"[X] Inventory update failed: {exc}")
        return 1
    finally:
        if session is not None:
            close_session()

    print(f"[OK] Updated existing products: {updated}")
    print(f"[OK] Created new products: {created}")
    print("[OK] Inventory sync complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
