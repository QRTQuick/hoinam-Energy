"""Download the remaining 7 missing EcoFlow images using correct handles."""
import json, urllib.request
from pathlib import Path

IMG_DIR = Path("assets/images/products")
HEADERS = {"User-Agent": "Mozilla/5.0"}

DOWNLOADS = {
    "river-3-ups.png":               ("https://ca.ecoflow.com", "river-3-ups-portable-power-station"),
    "river-3-max-plus.png":          ("https://ca.ecoflow.com", "ecoflow-delta-3-max-plus-portable-power-station-2048wh-edm-only"),
    "delta-3-max.png":               ("https://ca.ecoflow.com", "delta-3-max-series-portable-power-station-2048wh"),
    "delta-3-ultra.png":             ("https://ca.ecoflow.com", "ecoflow-delta-3-ultra-portable-power-station"),
    "delta-2-extra-battery.png":     ("https://ca.ecoflow.com", "delta-2-extra-battery"),
    "delta-2-max-extra-battery.png": ("https://ca.ecoflow.com", "delta-2-max-extra-battery"),
    "delta-pro-extra-battery.png":   ("https://ca.ecoflow.com", "delta-pro-extra-battery"),
}

# Direct image URLs found from search
DIRECT_URLS = {
    "river-3-ups.png":               None,  # will try JSON
    "river-3-max-plus.png":          "https://cdn.shopify.com/s/files/1/0438/0901/3914/files/D3MP_028c242b-c1ae-459b-82c1-232fde.png",
    "delta-3-max.png":               "https://cdn.shopify.com/s/files/1/0438/0901/3914/files/D3MP_e5fda900-06e0-4c5d-aad1-b60fde.png",
    "delta-3-ultra.png":             "https://cdn.shopify.com/s/files/1/0438/0901/3914/files/D3U_427446d8-bc0e-4579-9f60-9ef1470.png",
    "delta-2-extra-battery.png":     None,
    "delta-2-max-extra-battery.png": None,
    "delta-pro-extra-battery.png":   None,
}

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

ok = 0
for fname, (store, handle) in DOWNLOADS.items():
    dest = IMG_DIR / fname
    if dest.is_file():
        print(f"  SKIP  {fname} (already exists)")
        continue

    print(f"  {fname:50s} ", end="", flush=True)

    # Try direct URL first
    direct = DIRECT_URLS.get(fname)
    if direct and download(direct, dest):
        print(f"OK (direct)")
        ok += 1
        continue

    # Try JSON API
    data = fetch_json(f"{store}/products/{handle}.json")
    if data:
        imgs = data.get("product", {}).get("images", [])
        if imgs:
            img_url = imgs[0]["src"]
            if download(img_url, dest):
                print(f"OK ({img_url[:60]})")
                ok += 1
                continue

    # Try alternate stores
    for alt_store in ["https://us.ecoflow.com", "https://uk.ecoflow.com"]:
        data = fetch_json(f"{alt_store}/products/{handle}.json")
        if data:
            imgs = data.get("product", {}).get("images", [])
            if imgs:
                img_url = imgs[0]["src"]
                if download(img_url, dest):
                    print(f"OK ({alt_store})")
                    ok += 1
                    break
    else:
        print("FAILED")

print(f"\nDownloaded {ok} images.")

# Update DB
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

    SLUG_MAP = {
        "river-3-ups.png":               ["river-3-ups", "ecoflow-river-3-ups"],
        "river-3-max-plus.png":          ["river-3-max-plus", "ecoflow-river-3-max-plus"],
        "delta-3-max.png":               ["delta-3-max", "ecoflow-delta-3-max"],
        "delta-3-ultra.png":             ["delta-3-ultra", "ecoflow-delta-3-ultra"],
        "delta-2-extra-battery.png":     ["delta-2-extra-battery", "ecoflow-delta-2-eb"],
        "delta-2-max-extra-battery.png": ["delta-2-max-extra-battery", "ecoflow-delta-2-max-eb"],
        "delta-pro-extra-battery.png":   ["delta-pro-extra-battery", "ecoflow-delta-pro-eb"],
    }

    engine = get_engine()
    with Session(engine) as session:
        updated = 0
        for fname, slugs in SLUG_MAP.items():
            if not (IMG_DIR / fname).is_file():
                continue
            local_path = f"/assets/images/products/{fname}"
            for slug in slugs:
                p = session.query(Product).filter(Product.slug == slug).first()
                if p and not p.image_url:
                    p.image_url = local_path
                    updated += 1
        session.commit()
        print(f"Updated {updated} DB image_url fields.")
