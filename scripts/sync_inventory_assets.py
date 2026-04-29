from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.inventory import parse_stock_inventory

PRODUCT_DIR = ROOT / "assets" / "images" / "products"
HEADERS = {"User-Agent": "Mozilla/5.0 HoinamEnergyInventorySync/1.0"}


def compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def extension_from_url(url: str, content_type: str = "") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        return suffix
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    if "svg" in content_type:
        return ".svg"
    return ".jpg"


def og_image_from_html(html: str) -> str | None:
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return match.group(1).replace("&amp;", "&")
    return None


def fetch_json(url: str):
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    return response.json()


def fetch_text(url: str) -> str | None:
    try:
        response = requests.get(url, headers=HEADERS, timeout=8)
        if response.status_code >= 400:
            return None
        return response.text
    except requests.RequestException:
        return None


def ecoflow_image_lookup() -> dict[str, str]:
    payload = fetch_json("https://us.ecoflow.com/products.json?limit=250")
    lookup: dict[str, str] = {}
    for product in payload.get("products", []):
        title = product.get("title") or ""
        handle = product.get("handle") or ""
        images = product.get("images") or []
        image_url = images[0].get("src") if images else None
        if not image_url:
            continue
        for key_source in [title, handle, title.replace("EcoFlow", ""), handle.replace("ecoflow", "")]:
            lookup[compact(key_source)] = image_url
    return lookup


def match_ecoflow_image(product: dict, lookup: dict[str, str]) -> str | None:
    reference_key = compact(product.get("reference") or product["name"].replace(product.get("brand") or "", ""))
    for key, image_url in lookup.items():
        if reference_key and (reference_key == key or reference_key in key or key in reference_key):
            return image_url
    return None


def has_local_image(slug: str) -> bool:
    return any((PRODUCT_DIR / f"{slug}{extension}").is_file() for extension in [".png", ".jpg", ".jpeg", ".webp", ".svg"])


def bluetti_candidates(reference: str) -> list[str]:
    base = re.sub(r"[^a-z0-9]+", "-", reference.lower()).strip("-")
    first_component = re.split(r"[+/]", reference, maxsplit=1)[0]
    first = re.sub(r"[^a-z0-9]+", "-", first_component.lower()).strip("-")
    candidates = [
        base,
        first,
        f"bluetti-{base}-portable-power-station",
        f"bluetti-{first}-portable-power-station",
        f"{base}-portable-power-station",
        f"{first}-portable-power-station",
        f"{base}-power-station",
        f"{first}-power-station",
    ]
    seen = set()
    return [item for item in candidates if item and not (item in seen or seen.add(item))]


def bluetti_image_url(reference: str) -> str | None:
    for slug in bluetti_candidates(reference):
        html = fetch_text(f"https://www.bluettipower.com/products/{slug}")
        if not html:
            continue
        image_url = og_image_from_html(html)
        if image_url:
            return image_url
    return None


def deye_image_url(reference: str) -> str | None:
    search_url = f"https://deye.com/wp-json/wp/v2/search?search={quote_plus(reference)}&subtype=product"
    try:
        results = fetch_json(search_url)
    except requests.RequestException:
        return None
    if not results:
        return None
    product_url = results[0].get("url")
    if not product_url:
        return None
    html = fetch_text(product_url)
    return og_image_from_html(html or "")


def download_image(image_url: str, slug: str) -> bool:
    try:
        response = requests.get(image_url, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except requests.RequestException:
        return False

    extension = extension_from_url(image_url, response.headers.get("Content-Type", ""))
    target = PRODUCT_DIR / f"{slug}{extension}"
    if target.is_file() and target.stat().st_size > 0:
        return False

    target.write_bytes(response.content)
    return True


def main() -> int:
    PRODUCT_DIR.mkdir(parents=True, exist_ok=True)
    products = parse_stock_inventory()
    ecoflow_lookup = ecoflow_image_lookup()
    downloaded = 0
    attempted = 0

    for product in products:
      brand = (product.get("brand") or "").lower()
      reference = product.get("reference") or product["name"]
      image_url = None

      if has_local_image(product["slug"]):
          continue

      if brand == "ecoflow":
          image_url = match_ecoflow_image(product, ecoflow_lookup)
      elif brand == "bluetti":
          image_url = bluetti_image_url(reference)
      elif brand == "deye":
          image_url = deye_image_url(reference)

      if not image_url:
          continue

      attempted += 1
      if download_image(image_url, product["slug"]):
          downloaded += 1
          print(f"downloaded {product['slug']} <- {image_url}")

    print(f"attempted={attempted} downloaded={downloaded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
