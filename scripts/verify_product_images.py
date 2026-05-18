#!/usr/bin/env python
"""
Verify product images and database configuration.

Usage:
    python scripts/verify_product_images.py

This script checks:
    1. Product images in the file system
    2. Image linking in database
    3. Product data integrity
    4. Frontend configuration
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))

from backend.inventory import parse_stock_inventory
from backend.utils import resolve_product_image_url, PRODUCT_IMAGE_EXTENSIONS

# Use ASCII characters for cross-platform compatibility
OK = "[OK]"
FAIL = "[X]"
WARN = "[!]"


def check_image_files():
    """Check image files in the products directory."""
    image_dir = project_root / "assets" / "images" / "products"

    print("\n1. Checking image files...")
    if not image_dir.exists():
        print(f"   {FAIL} Image directory not found: {image_dir}")
        return []

    images = []
    for ext in PRODUCT_IMAGE_EXTENSIONS:
        images.extend(image_dir.glob(f"*{ext}"))

    # Sort by name
    images.sort(key=lambda x: x.name)

    print(f"   {OK} Found {len(images)} image files")
    print(f"     Directory: {image_dir}")

    # Group by extension
    ext_count = {}
    for img in images:
        ext = img.suffix.lower()
        ext_count[ext] = ext_count.get(ext, 0) + 1

    for ext, count in sorted(ext_count.items()):
        print(f"     {ext:8} : {count:3} files")

    return images


def check_inventory_parsing():
    """Check inventory parsing and image linking."""
    print("\n2. Parsing inventory file...")

    try:
        products = parse_stock_inventory()
        print(f"   {OK} Parsed {len(products)} products from STOCK INVENTORY.xlsx")
    except Exception as e:
        print(f"   {FAIL} Failed to parse inventory: {e}")
        return []

    # Check image linking
    with_images = sum(1 for p in products if p.get("image_url"))
    without_images = len(products) - with_images

    print(f"   {OK} Products with images: {with_images}/{len(products)}")
    if without_images > 0:
        print(f"   {WARN} Products without images: {without_images}")
        for product in products:
            if not product.get("image_url"):
                print(f"     - {product['name']}")

    return products


def check_image_existence(products: list[dict]):
    """Verify that images referenced by products actually exist."""
    print("\n3. Verifying image files exist...")

    image_dir = project_root / "assets" / "images" / "products"
    missing_images = []

    for product in products:
        image_url = product.get("image_url")
        if not image_url:
            continue

        # Extract filename from URL
        if image_url.startswith("/assets/images/products/"):
            filename = image_url.replace("/assets/images/products/", "")
            image_path = image_dir / filename

            if not image_path.exists():
                missing_images.append(
                    {
                        "product": product["name"],
                        "expected_path": str(image_path),
                        "url": image_url,
                    }
                )

    if missing_images:
        print(f"   {FAIL} Found {len(missing_images)} missing image files:")
        for item in missing_images[:10]:
            print(f"     - {item['product']}")
            print(f"       URL: {item['url']}")
    else:
        print(f"   {OK} All {len(products)} image files verified to exist")

    return missing_images


def check_slug_collisions(products: list[dict]):
    """Check for slug collisions (duplicate slugs)."""
    print("\n4. Checking for slug collisions...")

    slug_map = {}
    collisions = []

    for product in products:
        slug = product.get("slug")
        if slug in slug_map:
            collisions.append(
                {"slug": slug, "products": [slug_map[slug]["name"], product["name"]]}
            )
        else:
            slug_map[slug] = product

    if collisions:
        print(f"   {FAIL} Found {len(collisions)} slug collisions:")
        for collision in collisions:
            print(f"     - {collision['slug']}: {collision['products']}")
    else:
        print(f"   {OK} No slug collisions found ({len(slug_map)} unique slugs)")

    return collisions


def check_data_integrity(products: list[dict]):
    """Check overall data integrity."""
    print("\n5. Checking data integrity...")

    issues = []

    for product in products:
        # Check required fields
        if not product.get("name"):
            issues.append(f"Product missing name: {product}")
        if not product.get("slug"):
            issues.append(f"Product {product.get('name')} missing slug")
        if "price" not in product or product.get("price") is None:
            issues.append(f"Product {product.get('name')} missing price")
        elif product.get("price") < 0:
            issues.append(f"Product {product.get('name')} has a negative price")
        if not product.get("brand"):
            issues.append(f"Product {product.get('name')} missing brand")

    if issues:
        print(f"   {FAIL} Found {len(issues)} data issues:")
        for issue in issues[:10]:
            print(f"     - {issue}")
        if len(issues) > 10:
            print(f"     ... and {len(issues) - 10} more")
    else:
        print(f"   {OK} All {len(products)} products have required fields")

    return issues


def generate_report(products: list[dict]):
    """Generate a summary report."""
    print("\n6. Generating summary report...")

    # Brand distribution
    brands = {}
    for product in products:
        brand = product.get("brand", "Unknown")
        brands[brand] = brands.get(brand, 0) + 1

    print("   Brand distribution:")
    for brand, count in sorted(brands.items(), key=lambda x: x[1], reverse=True):
        print(f"     {brand:20} : {count:3} products")

    # Category distribution
    categories = {}
    for product in products:
        category = product.get("category", "Unknown")
        categories[category] = categories.get(category, 0) + 1

    print("\n   Category distribution:")
    for category, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"     {category:25} : {count:3} products")

    # Stock summary
    total_stock = sum(int(p.get("stock", 0)) for p in products)
    avg_stock = total_stock / len(products) if products else 0

    print(f"\n   Stock summary:")
    print(f"     Total units: {total_stock}")
    print(f"     Average per product: {avg_stock:.1f}")

    # Featured products
    featured = sum(1 for p in products if p.get("featured"))
    print(f"\n   Featured products: {featured}/{len(products)}")


def main():
    """Main verification function."""
    print("=" * 70)
    print("PRODUCT IMAGES AND INVENTORY VERIFICATION")
    print("=" * 70)

    # Check image files
    images = check_image_files()

    # Parse inventory
    products = check_inventory_parsing()
    if not products:
        return 1

    # Verify images exist
    missing = check_image_existence(products)

    # Check for collisions
    collisions = check_slug_collisions(products)

    # Check data integrity
    issues = check_data_integrity(products)

    # Generate report
    generate_report(products)

    # Summary
    print("\n" + "=" * 70)
    if not missing and not collisions and not issues:
        print("SUCCESS: ALL VERIFICATION CHECKS PASSED")
    else:
        print("WARNING: SOME ISSUES FOUND:")
        if missing:
            print(f"  - {len(missing)} missing image files")
        if collisions:
            print(f"  - {len(collisions)} slug collisions")
        if issues:
            print(f"  - {len(issues)} data integrity issues")
    print("=" * 70)

    return 0 if (not missing and not collisions and not issues) else 1


if __name__ == "__main__":
    sys.exit(main())
