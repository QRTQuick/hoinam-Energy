#!/usr/bin/env python3
"""
Validate product data integrity and report issues.
Usage: python scripts/validate_products.py
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import get_session, close_session
from backend.models import Product


def validate_products():
    """Validate all products and report data integrity issues."""
    session = get_session()
    
    try:
        products = session.query(Product).all()
        total = len(products)
        
        print(f"\n{'='*70}")
        print(f"PRODUCT DATA VALIDATION REPORT")
        print(f"{'='*70}\n")
        print(f"Total products: {total}\n")
        
        issues = {
            "missing_name": [],
            "missing_slug": [],
            "missing_price": [],
            "negative_stock": [],
            "missing_category": [],
            "missing_image": [],
        }
        
        for product in products:
            # Check for missing/invalid name
            if not product.name or not str(product.name).strip():
                issues["missing_name"].append(product.id)
            
            # Check for missing/invalid slug
            if not product.slug or not str(product.slug).strip():
                issues["missing_slug"].append(product.id)
            
            # Check for missing/zero price
            if product.price is None or product.price <= 0:
                issues["missing_price"].append(product.id)
            
            # Check for negative stock
            if product.stock < 0:
                issues["negative_stock"].append(product.id)
            
            # Check for missing category
            if not product.category or not str(product.category).strip():
                issues["missing_category"].append(product.id)
            
            # Check for missing image
            if not product.image_url or not str(product.image_url).strip():
                issues["missing_image"].append(product.id)
        
        # Print results
        print("DATA INTEGRITY ISSUES:")
        print("-" * 70)
        
        total_issues = 0
        for issue_type, product_ids in issues.items():
            if product_ids:
                print(f"\n✗ {issue_type.upper()}: {len(product_ids)} products")
                for pid in product_ids[:5]:  # Show first 5
                    product = next((p for p in products if p.id == pid), None)
                    if product:
                        print(f"  - ID {pid}: {product.name or '(no name)'}")
                if len(product_ids) > 5:
                    print(f"  ... and {len(product_ids) - 5} more")
                total_issues += len(product_ids)
            else:
                print(f"\n✓ {issue_type.upper()}: OK")
        
        print(f"\n{'='*70}")
        print(f"SUMMARY:")
        print(f"  Total Products: {total}")
        print(f"  Total Issues Found: {total_issues}")
        
        if total_issues == 0:
            print(f"  Status: ✓ ALL PRODUCTS VALID")
        else:
            integrity_score = max(0, 100 - (total_issues * 10))
            print(f"  Integrity Score: {integrity_score}/100")
            print(f"  Status: ✗ DATA ISSUES DETECTED")
        
        print(f"{'='*70}\n")
        
        return total_issues == 0
        
    finally:
        close_session()


if __name__ == "__main__":
    success = validate_products()
    sys.exit(0 if success else 1)
