#!/usr/bin/env python3
"""
Clear the database and prepare for fresh data load from inventory.

This script truncates all tables while respecting foreign key constraints.
It's designed to be run before syncing inventory data to ensure a clean state.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import Base, engine, SessionLocal
from backend.models import Product, Order, Installation, User, Coupon
from sqlalchemy import text


def clear_database():
    """Clear all data from the database while maintaining schema."""
    session = SessionLocal()
    
    try:
        print("[v0] Starting database cleanup...")
        
        # Disable foreign key constraints temporarily
        session.execute(text("SET session_replication_role = 'replica'"))
        
        # Get all tables in order
        tables = [
            "installations",
            "orders",
            "products",
            "users",
            "coupons",
        ]
        
        # Clear each table
        for table in tables:
            print(f"[v0] Truncating {table}...")
            session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        
        # Re-enable foreign key constraints
        session.execute(text("SET session_replication_role = 'origin'"))
        
        # Reset sequences
        print("[v0] Resetting sequences...")
        for table in tables:
            session.execute(
                text(f"SELECT setval('{table}_id_seq', 1, false)")
            )
        
        session.commit()
        print("[v0] ✓ Database cleared successfully!")
        print("[v0] Ready to load inventory data.")
        return True
        
    except Exception as e:
        session.rollback()
        print(f"[v0] ✗ Error clearing database: {e}")
        return False
    finally:
        session.close()


if __name__ == "__main__":
    success = clear_database()
    sys.exit(0 if success else 1)
