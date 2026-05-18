#!/usr/bin/env python3
"""
Repair product data by fixing missing/invalid fields.
Usage: python scripts/repair_products.py [--confirm]
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import get_session, close_session
from backend.models import Product
from backend.utils import slugify


def repair_products(confirm=False):
    """Repair product data integrity issues."""
    session = get_session()
    
    try:
        products = session.query(Product).all()
        repairs = {
            "slug_generated": 0,
            "negative_stock_reset": 0,
            "category_set": 0,
        }
        
        print(f"\n{'='*70}")
        print(f"PRODUCT DATA REPAIR")
        print(f"{'='*70}\n")
        
        for product in products:
            # Fix missing/invalid slug
            if not product.slug or not str(product.slug).strip():
                new_slug = slugify(product.name or f"product-{product.id}")
                print(f"  → ID {product.id}: Generating slug: '{new_slug}'")
                product.slug = new_slug
                repairs["slug_generated"] += 1
            
            # Fix negative stock
            if product.stock < 0:
                print(f"  → ID {product.id}: Resetting negative stock ({product.stock} → 0)")
                product.stock = 0
                repairs["negative_stock_reset"] += 1
            
            # Fix missing category
            if not product.category or not str(product.category).strip():
                print(f"  → ID {product.id}: Setting default category")
                product.category = "Portable Power"
                repairs["category_set"] += 1
        
        print(f"\n{'='*70}")
        print(f"REPAIR SUMMARY:")
        print(f"  Slugs Generated: {repairs['slug_generated']}")
        print(f"  Stock Reset: {repairs['negative_stock_reset']}")
        print(f"  Categories Set: {repairs['category_set']}")
        
        total_repairs = sum(repairs.values())
        
        if total_repairs == 0:
            print(f"\n  Status: ✓ NO REPAIRS NEEDED")
        else:
            if confirm:
                print(f"\n  Status: Applying {total_repairs} repairs...")
                session.commit()
                print(f"  ✓ All repairs committed to database")
            else:
                print(f"\n  Status: DRY RUN - {total_repairs} repairs would be applied")
                print(f"  → Run with --confirm flag to apply changes")
                session.rollback()
        
        print(f"{'='*70}\n")
        
        return total_repairs == 0
        
    except Exception as e:
        print(f"\nERROR: {e}")
        session.rollback()
        return False
    finally:
        close_session()


if __name__ == "__main__":
    confirm = "--confirm" in sys.argv
    success = repair_products(confirm=confirm)
    sys.exit(0 if success else 1)
