#!/usr/bin/env python3
"""
Product Image Download Helper
Downloads product images from official brand websites and stores them in assets/images/products
"""

import os
import requests
from pathlib import Path
from urllib.parse import urljoin, urlparse

# Product images to download with their sources
PRODUCT_IMAGES = {
    # EcoFlow products
    "ecoflow-delta-pro": "https://d2qebagb7wr69t.cloudfront.net/img/D0102_01.png",
    "ecoflow-river-2": "https://d2qebagb7wr69t.cloudfront.net/img/D2102_Hero.png",
    "ecoflow-delta-2": "https://d2qebagb7wr69t.cloudfront.net/img/D0502_Hero.png",
    
    # Bluetti products
    "bluetti-ac500": "https://www.bluettipower.com/cdn/shop/files/AC500_product_image.png",
    "bluetti-b230s": "https://www.bluettipower.com/cdn/shop/files/B230S_product.png",
    "bluetti-pv200": "https://www.bluettipower.com/cdn/shop/files/PV200_product.png",
    
    # Deye products
    "deye-sun-12k-es": "https://www.deye.com/image/deye-sun-12k-es.png",
    "deye-sun-10k-es": "https://www.deye.com/image/deye-sun-10k-es.png",
    
    # Generic placeholders for Buttu
    "buttu-solar-panel": "https://via.placeholder.com/300x300?text=Buttu+Solar+Panel",
    "buttu-mounting-kit": "https://via.placeholder.com/300x300?text=Buttu+Mounting",
}

def download_image(url, filename, output_dir):
    """Download image from URL and save to output directory"""
    try:
        print(f"Downloading {filename}...", end=" ")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Determine file extension from URL or content-type
        ext = Path(urlparse(url).path).suffix or ".png"
        if not ext.startswith("."):
            ext = f".{ext}"
        
        # Save image
        filepath = output_dir / f"{filename}{ext}"
        with open(filepath, "wb") as f:
            f.write(response.content)
        
        print(f"✓ Saved to {filepath}")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def main():
    """Download all product images"""
    # Create output directory
    output_dir = Path(__file__).parent.parent / "assets" / "images" / "products"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📁 Output directory: {output_dir}")
    print(f"📥 Starting download of {len(PRODUCT_IMAGES)} product images...\n")
    
    successful = 0
    failed = 0
    
    for filename, url in PRODUCT_IMAGES.items():
        if download_image(url, filename, output_dir):
            successful += 1
        else:
            failed += 1
    
    print(f"\n✅ Complete!")
    print(f"   Successful: {successful}")
    print(f"   Failed: {failed}")
    print(f"   Total: {successful + failed}")
    
    print(f"\n💡 Tip: You can manually add more products by placing images in:")
    print(f"   {output_dir}")
    print(f"\n📝 File naming: Use product slug + extension (e.g., 'product-name.png')")

if __name__ == "__main__":
    main()
