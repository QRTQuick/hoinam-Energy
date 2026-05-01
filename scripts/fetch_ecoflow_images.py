"""
Download missing EcoFlow product images using EcoFlow's Shopify JSON API.
Run from project root: python scripts/fetch_ecoflow_images.py
"""
import json
import urllib.request
import urllib.error
from pathlib import Path

IMG_DIR = Path("assets/images/products")
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Map: local filename -> EcoFlow Shopify product handle (ca.ecoflow.com)
PRODUCTS = {
    # River series
    "river-3-ups.png":          "river-3-ups-portable-power-station",
    "river-3-plus.png":         "river-3-plus-portable-power-station",
    "river-3-max-plus.png":     "river-3-max-plus-portable-power-station",
    # Delta series
    "delta-3-classic.png":      "delta-3-classic-portable-power-station",
    "delta-3.png":              "delta-3-series-portable-power-station",
    "delta-3-max.png":          "delta-3-max-portable-power-station",
    "delta-3-ultra.png":        "delta-3-ultra-portable-power-station",
    "delta-pro.png":            "delta-pro-portable-power-station",
    "delta-pro-3.png":          "delta-pro-3-portable-power-station",
    # Extra batteries
    "delta-2-extra-battery.png":      "delta-2-extra-battery",
    "delta-2-max-extra-battery.png":  "delta-2-max-extra-battery",
    "delta-pro-extra-battery.png":    "delta-pro-extra-battery",
    "delta-pro-3-extra-battery.png":  "delta-pro-3-extra-battery",
}

# Also update DB image_url for these slugs
DB_SLUG_MAP = {
    "river-3-ups.png":          ["river-3-ups", "ecoflow-river-3-ups"],
    "river-3-plus.png":         ["river-3-plus", "ecoflow-river-3-plus"],
    "river-3-max-plus.png":     ["river-3-max-plus", "ecoflow-river-3-max-plus"],
    "delta-3-classic.png":      ["delta-3-classic", "ecoflow-delta-3-classic"],
    "delta-3.png":              ["delta-3", "ecoflow-delta-3"],
    "delta-3-max.png":          ["delta-3-max", "ecoflow-delta-3-max"],
    "delta-3-ultra.png":        ["delta-3-ultra", "ecoflow-delta-3-ultra"],
    "delta-pro.png":            ["delta-pro", "ecoflow-delta-pro"],
    "delta-pro-3.png":          ["delta-pro-3", "ecoflow-delta-pro-3"],
    "delta-2-extra-battery.png":      ["delta-2-extra-battery", "ecoflow-delta-2-eb"],
    "delta-2-max-extra-battery.png":  ["delta-2-max-extra-battery", "ecoflow-delta-2-max-eb"],
    "delta-pro-extra-battery.png":    ["delta-pro-extra-battery", "ecoflow-delta-pro-eb"],
    "delta-pro-3-extra-battery.png":  ["delta-pro-3-extra-battery", "ecoflow-delta-pro-3-eb"],
}

STORES = [
    "https://ca.ecoflow.com",
    "https://us.ecoflow.com",
    "https://uk.ecoflow.com",
]


def fetch_json(url: str) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def download_image(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            if len(data) < 10_000:
                return False
            dest.write_bytes(data)
            return True
    except Exception:
        return False


def get_product_image_url(handle: str) -> str | None:
    for store in STORES:
        data = fetch_json(f"{store}/products/{handle}.json")
        if not data:
            continue
        images = data.get("product", {}).get("images", [])
        if images:
            return images[0]["src"]
    return None


def run():
    missing = [f for f in PRODUCTS if not (IMG_DIR / f).is_file()]

    if not missing:
        print("All images already present.")
        return

    print(f"Fetching {len(missing)} missing EcoFlow product images...\n")
    ok = 0
    failed = []

    for filename in missing:
        handle = PRODUCTS[filename]
        dest = IMG_DIR / filename
        print(f"  {filename:50s} ", end="", flush=True)

        img_url = get_product_image_url(handle)
        if img_url and download_image(img_url, dest):
            print(f"OK  ({img_url[:60]}...)")
            ok += 1
        else:
            print("FAILED")
            failed.append((filename, handle))

    print(f"\nDownloaded: {ok}/{len(missing)}")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for f, h in failed:
            print(f"  {f}  (handle: {h})")

    # Update DB image_url for downloaded files
    if ok > 0:
        print("\nUpdating database image_url fields...")
        import sys, os
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        os.environ.setdefault("DATABASE_URL",
            "postgresql://neondb_owner:npg_zt4qUnGN7Klw@ep-old-hill-ak0neb1m.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require")
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        from backend.database import get_engine
        from backend.models import Product
        from sqlalchemy.orm import Session

        engine = get_engine()
        with Session(engine) as session:
            updated = 0
            for filename in missing:
                if not (IMG_DIR / filename).is_file():
                    continue
                local_path = f"/assets/images/products/{filename}"
                slugs = DB_SLUG_MAP.get(filename, [])
                for slug in slugs:
                    p = session.query(Product).filter(Product.slug == slug).first()
                    if p and not p.image_url:
                        p.image_url = local_path
                        updated += 1
            session.commit()
            print(f"Updated {updated} product image_url fields in DB.")


if __name__ == "__main__":
    run()
