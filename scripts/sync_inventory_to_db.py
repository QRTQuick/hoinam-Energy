#!/usr/bin/env python
"""
Sync products from STOCK INVENTORY.xlsx to the database with image linking.

Usage:
    python scripts/sync_inventory_to_db.py

This script:
    1. Parses the STOCK INVENTORY.xlsx file
    2. Automatically links images to products based on product slug
    3. Syncs all products to the database
    4. Reports on products with/without images
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path for imports
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from backend.config import get_settings
from backend.database import init_database, get_session, close_session
from backend.inventory import parse_stock_inventory
from backend.models import Product
from backend.seed import upsert_inventory_products

OK = "[OK]"
FAIL = "[X]"
WARN = "[!]"


def main():
    """Main sync function."""
    print("=" * 70)
    print("INVENTORY TO DATABASE SYNC")
    print("=" * 70)

    # Initialize database
    print("\n1. Initializing database connection...")
    try:
        init_database()
        print(f"   {OK} Database initialized")
    except Exception as e:
        print(f"   {FAIL} Failed to initialize database: {e}")
        return 1

    # Parse inventory
    print("\n2. Parsing STOCK INVENTORY.xlsx...")
    try:
        inventory_products = parse_stock_inventory()
        print(f"   {OK} Found {len(inventory_products)} products in inventory")
    except Exception as e:
        print(f"   {FAIL} Failed to parse inventory: {e}")
        return 1

    if not inventory_products:
        print(f"   {FAIL} No products found in inventory file")
        return 1

    # Check image linking
    print("\n3. Checking image links...")
    with_images = sum(1 for p in inventory_products if p.get("image_url"))
    without_images = len(inventory_products) - with_images
    print(f"   {OK} Products with images: {with_images}/{len(inventory_products)}")
    if without_images > 0:
        print(f"   {WARN} Products without images: {without_images}")

    # Sync to database
    print("\n4. Syncing products to database...")
    session = None
    try:
        session = get_session()
        upsert_inventory_products(session, inventory_products)
        print(f"   {OK} Successfully synced to database")
    except Exception as e:
        print(f"   {FAIL} Failed to sync products: {e}")
        if session:
            session.rollback()
        return 1
    finally:
        if session:
            close_session()

    # Verify sync
    print("\n5. Verifying database sync...")
    session = None
    try:
        session = get_session()
        db_products = session.query(Product).filter(Product.active.is_(True)).all()
        db_with_images = sum(1 for p in db_products if p.image_url)
        print(f"   {OK} Database now has {len(db_products)} active products")
        print(f"   {OK} Products with images in DB: {db_with_images}/{len(db_products)}")

        # Show first 10 products
        if db_products:
            print("\n   First 10 products in database:")
            for i, product in enumerate(db_products[:10], 1):
                img_status = "IMG" if product.image_url else "NOIMG"
                print(
                    f"     {i:2}. {img_status} {product.name:50} - {product.price} NGN"
                )
    except Exception as e:
        print(f"   {FAIL} Failed to verify: {e}")
        return 1
    finally:
        if session:
            close_session()

    print("\n" + "=" * 70)
    print("SYNC COMPLETED SUCCESSFULLY")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Run the Flask app: python app.py")
    print("  2. Navigate to /products.html to view products")
    print("  3. Products should display with their linked images")
    print("=" * 70)

    return 0


if __name__ == "__main__":
    sys.exit(main())
