import json, urllib.request
from pathlib import Path
HEADERS = {"User-Agent": "Mozilla/5.0"}
IMG_DIR = Path("assets/images/products")

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

TARGETS = {
    "river-3-ups.png": [
        ("https://ca.ecoflow.com", "river-3-ups-portable-power-station"),
        ("https://us.ecoflow.com", "river-3-ups-portable-power-station"),
        ("https://uk.ecoflow.com", "river-3-ups-portable-power-station"),
        ("https://ca.ecoflow.com", "ecoflow-river-3-ups"),
        ("https://us.ecoflow.com", "ecoflow-river-3-ups"),
    ],
    "delta-2-extra-battery.png": [
        ("https://ca.ecoflow.com", "delta-2-extra-battery"),
        ("https://us.ecoflow.com", "delta-2-extra-battery"),
        ("https://ca.ecoflow.com", "ecoflow-delta-2-extra-battery"),
        ("https://us.ecoflow.com", "ecoflow-delta-2-extra-battery"),
        ("https://ca.ecoflow.com", "delta-2-eb"),
        ("https://us.ecoflow.com", "delta-2-eb"),
    ],
}

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
                print(f"Found {fname}: {store}/products/{handle}")
                if dl(src, dest):
                    print(f"  Downloaded OK")
                    found = True
                    break
    if not found:
        # Search catalog
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
                    if fname == "river-3-ups.png" and "river 3 ups" in title:
                        src = imgs[0]["src"]
                        print(f"Catalog found {fname}: {p['title']}")
                        if dl(src, dest):
                            print("  Downloaded OK")
                            found = True
                            break
                    elif fname == "delta-2-extra-battery.png" and "delta 2 extra battery" in title and "max" not in title and "pro" not in title:
                        src = imgs[0]["src"]
                        print(f"Catalog found {fname}: {p['title']}")
                        if dl(src, dest):
                            print("  Downloaded OK")
                            found = True
                            break
                if found:
                    break
            if found:
                break
    if not found:
        print(f"FAILED: {fname}")

print("Done.")
