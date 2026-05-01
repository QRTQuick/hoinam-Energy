"""Fetch the last 10 missing EcoFlow images."""
import json, urllib.request
from pathlib import Path

IMG_DIR = Path("assets/images/products")
HEADERS = {"User-Agent": "Mozilla/5.0"}

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None

def dl(url, dest):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
            if len(data) < 5000:
                return False
            dest.write_bytes(data)
            return True
    except Exception:
        return False

# filename -> list of (store, handle) to try
TARGETS = {
    "delta-3-1000-air-plus.png":          [
        ("https://ca.ecoflow.com", "delta-3-1000-air-plus-portable-power-station"),
        ("https://us.ecoflow.com", "delta-3-1000-air-plus-portable-power-station"),
        ("https://ca.ecoflow.com", "ecoflow-delta-3-1000-air-plus"),
    ],
    "delta-pro-ultra-battery-6kwh.png":   [
        ("https://ca.ecoflow.com", "delta-pro-ultra-extra-battery"),
        ("https://us.ecoflow.com", "delta-pro-ultra-extra-battery"),
        ("https://ca.ecoflow.com", "ecoflow-delta-pro-ultra-extra-battery"),
        ("https://ca.ecoflow.com", "delta-pro-ultra-battery"),
    ],
    "delta-pro-ultra-inverter-7-2kw.png": [
        ("https://ca.ecoflow.com", "delta-pro-ultra-portable-power-station"),
        ("https://us.ecoflow.com", "delta-pro-ultra-portable-power-station"),
        ("https://ca.ecoflow.com", "ecoflow-delta-pro-ultra"),
    ],
    "ecoflow-25kw-30kwh-system.png":      [
        ("https://ca.ecoflow.com", "25kw-30kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-25kw-30kwh"),
    ],
    "ecoflow-30kw-30kwh-system.png":      [
        ("https://ca.ecoflow.com", "30kw-30kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-30kw-30kwh"),
    ],
    "ecoflow-5kw-10kwh-system.png":       [
        ("https://ca.ecoflow.com", "5kw-10kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-5kw-10kwh"),
    ],
    "ecoflow-5kw-battery.png":            [
        ("https://ca.ecoflow.com", "ecoflow-5kwh-battery"),
        ("https://ca.ecoflow.com", "5kwh-battery"),
        ("https://ca.ecoflow.com", "ecoflow-5kw-battery"),
    ],
    "ecoflow-6kw-10kwh-system.png":       [
        ("https://ca.ecoflow.com", "6kw-10kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-6kw-10kwh"),
    ],
    "ecoflow-6kw-15kwh-system.png":       [
        ("https://ca.ecoflow.com", "6kw-15kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-6kw-15kwh"),
    ],
    "ecoflow-6kw-5kwh-system.png":        [
        ("https://ca.ecoflow.com", "6kw-5kwh-solar-system"),
        ("https://ca.ecoflow.com", "ecoflow-6kw-5kwh"),
    ],
}

# Catalog search terms as fallback
SEARCH_TERMS = {
    "delta-3-1000-air-plus.png":          ["delta 3 1000 air", "delta 3 air plus"],
    "delta-pro-ultra-battery-6kwh.png":   ["delta pro ultra extra battery", "delta pro ultra battery"],
    "delta-pro-ultra-inverter-7-2kw.png": ["delta pro ultra portable", "delta pro ultra"],
    "ecoflow-5kw-battery.png":            ["5kwh battery", "5kw battery"],
}

# DB slug mapping
SLUG_MAP = {
    "delta-3-1000-air-plus.png":          ["delta-3-1000-air-plus", "ecoflow-delta-3-1000-air-plus"],
    "delta-pro-ultra-battery-6kwh.png":   ["delta-pro-ultra-battery-6kwh", "ecoflow-delta-pro-ultra-battery-6kwh"],
    "delta-pro-ultra-inverter-7-2kw.png": ["delta-pro-ultra-inverter-7-2kw", "ecoflow-delta-pro-ultra-inverter-7-2kw"],
    "ecoflow-25kw-30kwh-system.png":      ["ecoflow-25kw-30kwh-system"],
    "ecoflow-30kw-30kwh-system.png":      ["ecoflow-30kw-30kwh-system"],
    "ecoflow-5kw-10kwh-system.png":       ["ecoflow-5kw-10kwh-system"],
    "ecoflow-5kw-battery.png":            ["ecoflow-5kw-battery"],
    "ecoflow-6kw-10kwh-system.png":       ["ecoflow-6kw-10kwh-system"],
    "ecoflow-6kw-15kwh-system.png":       ["ecoflow-6kw-15kwh-system"],
    "ecoflow-6kw-5kwh-system.png":        ["ecoflow-6kw-5kwh-system"],
}

# Fallback: use similar existing images
FALLBACK_IMAGES = {
    "delta-3-1000-air-plus.png":          "/assets/images/products/ecoflow-delta-3-1000-air-plus.png",
    "delta-pro-ultra-battery-6kwh.png":   "/assets/images/products/ecoflow-delta-pro-ultra-battery-6kwh.png",
    "delta-pro-ultra-inverter-7-2kw.png": "/assets/images/products/ecoflow-delta-pro-ultra-inverter-7-2kw.png",
    "ecoflow-25kw-30kwh-system.png":      "/assets/images/products/ecoflow-25-kw-30-kwh.png",
    "ecoflow-30kw-30kwh-system.png":      "/assets/images/products/ecoflow-30-kw-30-kwh.png",
    "ecoflow-5kw-10kwh-system.png":       "/assets/images/products/ecoflow-5-kw-10-kwh.png",
    "ecoflow-5kw-battery.png":            "/assets/images/products/ecoflow-5kw-batter.png",
    "ecoflow-6kw-10kwh-system.png":       "/assets/images/products/ecoflow-6-kw-10-kwh.png",
    "ecoflow-6kw-15kwh-system.png":       "/assets/images/products/ecoflow-6-kw-15-kwh.png",
    "ecoflow-6kw-5kwh-system.png":        "/assets/images/products/ecoflow-6-kw-5-kwh.png",
}

ok_downloads = []
db_updates = {}

for fname, tries in TARGETS.items():
    dest = IMG_DIR / fname
    if dest.is_file():
        print(f"SKIP {fname}")
        continue

    found = False
    for store, handle in tries:
        d = fetch_json(f"{store}/products/{handle}.json")
        if d:
            imgs = d.get("product", {}).get("images", [])
            if imgs:
                src = imgs[0]["src"]
                print(f"  {fname}: found at {handle}", end=" ")
                if dl(src, dest):
                    print("OK")
                    ok_downloads.append(fname)
                    found = True
                    break
                else:
                    print("DL FAILED")

    if not found:
        # Try catalog search
        terms = SEARCH_TERMS.get(fname, [])
        for store in ["https://ca.ecoflow.com", "https://us.ecoflow.com"]:
            for page in range(1, 4):
                data = fetch_json(f"{store}/products.json?limit=250&page={page}")
                if not data or not data.get("products"):
                    break
                for p in data["products"]:
                    title = p.get("title", "").lower()
                    imgs = p.get("images", [])
                    if not imgs:
                        continue
                    if any(t in title for t in terms):
                        src = imgs[0]["src"]
                        print(f"  {fname}: catalog match '{p['title']}'", end=" ")
                        if dl(src, dest):
                            print("OK")
                            ok_downloads.append(fname)
                            found = True
                            break
                if found:
                    break
            if found:
                break

    if not found:
        # Use existing similar image via DB image_url update
        fallback = FALLBACK_IMAGES.get(fname)
        if fallback:
            fallback_path = Path(".") / fallback.lstrip("/")
            if fallback_path.is_file():
                db_updates[fname] = fallback
                print(f"  {fname}: using fallback {fallback}")
            else:
                print(f"  {fname}: FAILED (no fallback either)")
        else:
            print(f"  {fname}: FAILED")

print(f"\nDownloaded: {len(ok_downloads)}, DB fallbacks: {len(db_updates)}")

# Update DB
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
    for fname in ok_downloads:
        local_path = f"/assets/images/products/{fname}"
        for slug in SLUG_MAP.get(fname, []):
            p = session.query(Product).filter(Product.slug == slug).first()
            if p:
                p.image_url = local_path
                updated += 1
    for fname, fallback_path in db_updates.items():
        for slug in SLUG_MAP.get(fname, []):
            p = session.query(Product).filter(Product.slug == slug).first()
            if p and not p.image_url:
                p.image_url = fallback_path
                updated += 1
    session.commit()
    print(f"Updated {updated} DB image_url fields.")
