"""Fetch the last 4 missing images by searching the full product catalog."""
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

def download(url, dest):
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

# Search all products for the ones we need
SEARCH_TERMS = {
    "river-3-ups.png":               ["river 3 ups", "river3 ups"],
    "delta-2-extra-battery.png":     ["delta 2 extra battery", "delta2 extra battery"],
    "delta-2-max-extra-battery.png": ["delta 2 max extra battery"],
    "delta-pro-extra-battery.png":   ["delta pro extra battery"],
}

SLUG_MAP = {
    "river-3-ups.png":               ["river-3-ups", "ecoflow-river-3-ups"],
    "delta-2-extra-battery.png":     ["delta-2-extra-battery", "ecoflow-delta-2-eb"],
    "delta-2-max-extra-battery.png": ["delta-2-max-extra-battery", "ecoflow-delta-2-max-eb"],
    "delta-pro-extra-battery.png":   ["delta-pro-extra-battery", "ecoflow-delta-pro-eb"],
}

found_images = {}

for store in ["https://ca.ecoflow.com", "https://us.ecoflow.com"]:
    for page in range(1, 6):
        data = fetch_json(f"{store}/products.json?limit=250&page={page}")
        if not data or not data.get("products"):
            break
        for p in data["products"]:
            title = p.get("title", "").lower()
            handle = p.get("handle", "")
            imgs = p.get("images", [])
            if not imgs:
                continue
            for fname, terms in SEARCH_TERMS.items():
                if fname in found_images:
                    continue
                if any(t in title for t in terms):
                    found_images[fname] = (imgs[0]["src"], handle, p["title"])
                    break

print("Found:")
for fname, (url, handle, title) in found_images.items():
    print(f"  {fname}: {title} ({handle})")
    print(f"    {url[:80]}")

ok = 0
for fname, (img_url, handle, title) in found_images.items():
    dest = IMG_DIR / fname
    if dest.is_file():
        continue
    print(f"\nDownloading {fname}...", end=" ", flush=True)
    if download(img_url, dest):
        print("OK")
        ok += 1
    else:
        print("FAILED")

print(f"\nDownloaded {ok} images.")

if ok > 0:
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
        for fname in found_images:
            if not (IMG_DIR / fname).is_file():
                continue
            local_path = f"/assets/images/products/{fname}"
            for slug in SLUG_MAP.get(fname, []):
                p = session.query(Product).filter(Product.slug == slug).first()
                if p and not p.image_url:
                    p.image_url = local_path
                    updated += 1
        session.commit()
        print(f"Updated {updated} DB image_url fields.")
