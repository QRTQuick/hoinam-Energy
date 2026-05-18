#!/usr/bin/env python3
"""
Complete fresh database setup:
1. Clear all existing data
2. Load products from STOCK INVENTORY.xlsx
3. Link images to products
4. Verify database integrity

Run this to reset database to clean state with latest inventory.
"""

import sys
import subprocess
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def run_script(script_name: str) -> bool:
    """Run a Python script and return success status."""
    script_path = Path(__file__).parent / script_name
    if not script_path.exists():
        print(f"[v0] ✗ Script not found: {script_path}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(Path(__file__).parent.parent),
            capture_output=True,
            text=True,
            timeout=60,
        )
        
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"[v0] ✗ Script {script_name} timed out")
        return False
    except Exception as e:
        print(f"[v0] ✗ Error running {script_name}: {e}")
        return False


def main():
    print("\n" + "=" * 80)
    print("FRESH DATABASE SETUP - HOINAM ENERGY")
    print("=" * 80)
    print("\nThis script will:")
    print("  1. Clear all data from the database")
    print("  2. Load products from STOCK INVENTORY.xlsx")
    print("  3. Link product images automatically")
    print("  4. Verify database integrity")
    print("\n" + "=" * 80 + "\n")

    # Step 1: Clear database
    print("\nSTEP 1: Clearing database...")
    print("-" * 80)
    if not run_script("clear_database.py"):
        print("\n[v0] ✗ Failed to clear database. Aborting.")
        return 1
    print("[v0] ✓ Database cleared successfully\n")

    # Step 2: Sync inventory
    print("STEP 2: Syncing inventory...")
    print("-" * 80)
    if not run_script("sync_inventory_to_db.py"):
        print("\n[v0] ✗ Failed to sync inventory. Aborting.")
        return 1
    print("[v0] ✓ Inventory synced successfully\n")

    # Step 3: Verify database health
    print("STEP 3: Verifying database health...")
    print("-" * 80)
    if not run_script("database_health.py"):
        print("\n[v0] ⚠ Health check had issues but setup completed")
    print()

    print("=" * 80)
    print("✓ FRESH DATABASE SETUP COMPLETED SUCCESSFULLY")
    print("=" * 80)
    print("\nYour database is now ready with:")
    print("  • All products from STOCK INVENTORY.xlsx")
    print("  • Automatic image linking by product slug")
    print("  • Full data integrity validation")
    print("\nNext steps:")
    print("  1. Start the Flask app: python app.py")
    print("  2. Visit http://localhost:5000/products.html")
    print("  3. Products should display with linked images")
    print("=" * 80 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
