#!/usr/bin/env python3
"""
Generate a comprehensive database health report.
Usage: python scripts/database_health.py
"""

import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import get_session, close_session
from backend.models import Product, User, Order
from sqlalchemy import func


def generate_health_report():
    """Generate comprehensive database health report."""
    session = get_session()
    
    try:
        timestamp = datetime.now().isoformat()
        
        print(f"\n{'='*70}")
        print(f"DATABASE HEALTH REPORT")
        print(f"Generated: {timestamp}")
        print(f"{'='*70}\n")
        
        # Product statistics
        print("PRODUCT STATISTICS:")
        print("-" * 70)
        
        total_products = session.query(func.count(Product.id)).scalar() or 0
        active_products = session.query(func.count(Product.id)).filter(Product.active == True).scalar() or 0
        featured_products = session.query(func.count(Product.id)).filter(Product.featured == True).scalar() or 0
        
        products_with_images = session.query(func.count(Product.id)).filter(
            Product.image_url != None
        ).scalar() or 0
        products_in_stock = session.query(func.count(Product.id)).filter(
            Product.stock > 0
        ).scalar() or 0
        
        products_missing_name = session.query(func.count(Product.id)).filter(
            Product.name == None
        ).scalar() or 0
        products_missing_slug = session.query(func.count(Product.id)).filter(
            Product.slug == None
        ).scalar() or 0
        products_missing_category = session.query(func.count(Product.id)).filter(
            Product.category == None
        ).scalar() or 0
        products_with_negative_stock = session.query(func.count(Product.id)).filter(
            Product.stock < 0
        ).scalar() or 0
        
        print(f"  Total Products: {total_products}")
        print(f"  Active Products: {active_products} ({100*active_products//max(total_products,1)}%)")
        print(f"  Featured Products: {featured_products}")
        print(f"  Products with Images: {products_with_images} ({100*products_with_images//max(total_products,1)}%)")
        print(f"  Products in Stock: {products_in_stock} ({100*products_in_stock//max(total_products,1)}%)")
        
        # Data quality issues
        print("\nDATA QUALITY ISSUES:")
        print("-" * 70)
        
        critical_issues = products_missing_name + products_missing_slug + products_with_negative_stock
        
        if critical_issues == 0:
            print("  ✓ No critical data issues found")
        else:
            print(f"  ✗ {critical_issues} critical issues detected:")
            if products_missing_name > 0:
                print(f"    - {products_missing_name} products missing name")
            if products_missing_slug > 0:
                print(f"    - {products_missing_slug} products missing slug")
            if products_missing_category > 0:
                print(f"    - {products_missing_category} products missing category")
            if products_with_negative_stock > 0:
                print(f"    - {products_with_negative_stock} products with negative stock")
        
        # User & Order statistics
        print("\nUSER STATISTICS:")
        print("-" * 70)
        
        total_users = session.query(func.count(User.id)).scalar() or 0
        active_users = session.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
        admin_users = session.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
        
        print(f"  Total Users: {total_users}")
        print(f"  Active Users: {active_users}")
        print(f"  Admin Users: {admin_users}")
        
        print("\nORDER STATISTICS:")
        print("-" * 70)
        
        total_orders = session.query(func.count(Order.id)).scalar() or 0
        confirmed_orders = session.query(func.count(Order.id)).filter(Order.status == "confirmed").scalar() or 0
        paid_orders = session.query(func.count(Order.id)).filter(Order.payment_status == "paid").scalar() or 0
        
        print(f"  Total Orders: {total_orders}")
        print(f"  Confirmed Orders: {confirmed_orders}")
        print(f"  Paid Orders: {paid_orders}")
        
        # Calculate integrity score
        print("\nDATA INTEGRITY SCORE:")
        print("-" * 70)
        
        issues_score = critical_issues * 10
        integrity_score = max(0, 100 - issues_score)
        
        if integrity_score >= 95:
            status = "✓ EXCELLENT"
        elif integrity_score >= 85:
            status = "✓ GOOD"
        elif integrity_score >= 70:
            status = "⚠ FAIR"
        else:
            status = "✗ POOR"
        
        print(f"  Score: {integrity_score}/100 ({status})")
        print(f"  Critical Issues: {critical_issues}")
        
        print(f"\n{'='*70}")
        print("RECOMMENDATIONS:")
        print("-" * 70)
        
        if critical_issues > 0:
            print("  1. Run 'python scripts/repair_products.py --confirm' to fix data issues")
            print("  2. Review products with missing fields in the admin panel")
            print("  3. Add missing images for products without image URLs")
        else:
            print("  ✓ Database is healthy, no repairs needed")
        
        print(f"\n{'='*70}\n")
        
        return integrity_score >= 70
        
    except Exception as e:
        print(f"\nERROR: Failed to generate report - {e}")
        return False
    finally:
        close_session()


if __name__ == "__main__":
    success = generate_health_report()
    sys.exit(0 if success else 1)
