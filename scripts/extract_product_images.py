#!/usr/bin/env python3
"""
Product Image Extractor
Downloads product images from brand websites and stores them locally.

Usage:
    python scripts/extract_product_images.py

This script helps populate product images from:
- EcoFlow Store: https://www.ecoflow.com/
- Deye Store: https://www.deye.com/
- Buttu Store: https://buttu.com/

Make sure to:
1. Check brand websites for product image URLs
2. Update the BRAND_IMAGE_URLS dictionary below
3. Place images in /assets/images/products/ with naming convention: {product-slug}.png
"""

import os
import sys
import requests
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime

# Configure image URLs by brand
# You'll need to manually add these from the brand websites
BRAND_IMAGE_URLS = {
    "ecoflow": {
        # Example: "EcoFlow Delta Pro": "https://..."
    },
    "deye": {
        # Example: "Deye Inverter": "https://..."
    },
    "buttu": {
        # Example: "Buttu Solar Panel": "https://..."
    },
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

PRODUCTS_DIR = Path(__file__).resolve().parents[1] / "assets" / "images" / "products"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def download_image(url: str, filename: str) -> bool:
    """Download image from URL and save locally"""
    if not url:
        return False
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        response.raise_for_status()
        
        # Determine file extension
        parsed_url = urlparse(url)
        path = parsed_url.path
        ext = Path(path).suffix.lower() or ".png"
        
        if ext not in ALLOWED_EXTENSIONS:
            ext = ".png"
        
        filepath = PRODUCTS_DIR / f"{filename}{ext}"
        
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        print(f"✓ Downloaded: {filepath}")
        return True
    except Exception as e:
        print(f"✗ Failed to download {url}: {e}")
        return False


def extract_from_urls():
    """Extract images from configured URLs"""
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    
    total = 0
    downloaded = 0
    
    for brand, products in BRAND_IMAGE_URLS.items():
        print(f"\n📦 Processing {brand.upper()} products...")
        
        for product_name, image_url in products.items():
            total += 1
            # Convert product name to slug
            slug = product_name.lower().replace(" ", "-").replace("_", "-")
            slug = "".join(c if c.isalnum() or c == "-" else "" for c in slug)
            
            if download_image(image_url, slug):
                downloaded += 1
    
    print(f"\n{'='*50}")
    print(f"Download Summary:")
    print(f"  Total products: {total}")
    print(f"  Successfully downloaded: {downloaded}")
    print(f"  Failed: {total - downloaded}")
    print(f"  Images saved to: {PRODUCTS_DIR}")
    

def generate_setup_guide():
    """Print a guide for manually adding product images"""
    guide = """
╔════════════════════════════════════════════════════════════════╗
║        PRODUCT IMAGE EXTRACTION GUIDE                          ║
╚════════════════════════════════════════════════════════════════╝

HOW TO ADD PRODUCT IMAGES:

1. MANUAL METHOD (Recommended for first-time):
   ─────────────────────────────────────────
   a) Visit each brand website:
      - EcoFlow: https://www.ecoflow.com/products
      - Deye: https://www.deye.com/products
      - Buttu: https://buttu.com/products
   
   b) Right-click on product images and select "Save image as..."
   
   c) Save images to: /assets/images/products/
   
   d) Rename images using product slug format:
      Example: "EcoFlow Delta Pro" → "ecoflow-delta-pro.png"

2. AUTOMATED METHOD (Using the extractor):
   ──────────────────────────────────────
   a) Add product URLs to BRAND_IMAGE_URLS in this script
   b) Run: python scripts/extract_product_images.py
   c) Images will be automatically downloaded and saved

3. NAMING CONVENTION:
   ─────────────────
   Use this format for all product images:
   - Transform product name to lowercase
   - Replace spaces with hyphens
   - Remove special characters
   
   Examples:
   ✓ "EcoFlow Delta Pro" → "ecoflow-delta-pro.png"
   ✓ "DEYE Inverter 50K" → "deye-inverter-50k.png"
   ✓ "Buttu 400W Panel" → "buttu-400w-panel.png"

4. SUPPORTED FORMATS:
   ──────────────────
   - PNG (recommended)
   - JPG/JPEG
   - WebP

5. DIRECTORY STRUCTURE:
   ────────────────────
   hoinam-Energy/
   └── assets/
       └── images/
           └── products/
               ├── ecoflow-delta-pro.png
               ├── deye-inverter-50k.png
               └── ... (more products)

6. DATABASE UPDATE:
   ────────────────
   Once images are added:
   a) Log in as admin
   b) Go to /admin.html
   c) Upload the STOCK INVENTORY.xlsx file
   d) The system will automatically link images to products

═══════════════════════════════════════════════════════════════════
"""
    print(guide)


if __name__ == "__main__":
    print("Product Image Extractor Tool")
    print("=" * 50)
    
    # Check if any URLs are configured
    has_urls = any(BRAND_IMAGE_URLS.values())
    
    if has_urls:
        print("\nAttempting to extract from configured URLs...")
        extract_from_urls()
    else:
        print("\nNo image URLs configured yet.")
        print("\nTo add images, you can:")
        print("1. See the guide above for manual method")
        print("2. Edit this script to add product image URLs")
    
    print("\n")
    generate_setup_guide()
