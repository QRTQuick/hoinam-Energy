from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook

from .utils import resolve_product_image_url, slugify, to_decimal


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INVENTORY_PATH = ROOT / "STOCK INVENTORY.xlsx"

BRAND_NAMES = {
    "ECOFLOW": "EcoFlow",
    "BLUETTI": "Bluetti",
    "DEYE": "Deye",
}

STORE_SLUGS = {
    "ECOFLOW": "ecoflow",
    "BLUETTI": "bluetti",
    "DEYE": "deye",
}

FEATURED_REFERENCES = {
    "river 3 plus",
    "river 2 max",
    "delta 2 max",
    "delta pro 3",
    "ac180",
    "ac200pl",
    "ep500p",
    "sun-6k-sg04lp1-eu-sm2",
    "se-g10.2 (10.24kwh 51.2v)",
}


def clean_text(value) -> str:
    return " ".join(str(value or "").replace("_", " ").split())


def display_brand(raw_brand: str | None) -> str:
    key = clean_text(raw_brand).upper()
    return BRAND_NAMES.get(key, clean_text(raw_brand) or "Hoinam")


def store_slug(raw_brand: str | None) -> str:
    key = clean_text(raw_brand).upper()
    return STORE_SLUGS.get(key, slugify(display_brand(raw_brand)))


def product_display_name(brand: str, reference: str) -> str:
    reference = clean_text(reference)
    if not reference:
        return brand
    if reference.lower().startswith(brand.lower()):
        return reference
    return f"{brand} {reference}"


def infer_category(row_name: str | None, reference: str, description: str, brand: str) -> str:
    label = clean_text(row_name).lower()
    haystack = f"{label} {reference} {description}".lower()

    if "solar panel" in haystack:
        return "Solar Panels"
    if "portable power station" in label or any(term in haystack for term in ["river", "delta", "ac180", "eb3a", "ep500"]):
        return "Portable Power"
    if "inverter" in haystack or "sun-" in haystack:
        return "Inverters"
    if any(term in haystack for term in ["battery", "b300", "b300s", "b700", "kwh", "bos-"]):
        return "Batteries"
    if any(term in haystack for term in ["meter", "junction", "base", "trolly", "trolley", "pdu"]):
        return "Accessories"
    if "+" in reference:
        return "Energy Kits"
    if brand == "Deye":
        return "Inverters"
    return "Energy Systems"


def parse_stock_inventory(path: str | Path | None = None) -> list[dict]:
    source = path or DEFAULT_INVENTORY_PATH
    if hasattr(source, "read"):
        workbook = load_workbook(source, data_only=True)
    else:
        inventory_path = Path(source)
        if not inventory_path.is_file():
            return []
        workbook = load_workbook(inventory_path, data_only=True)
    sheet = workbook.active
    current_brand = None
    products: list[dict] = []

    for row in sheet.iter_rows(min_row=2, values_only=True):
        sn, row_name, reference, description, quantity, rate = (list(row) + [None] * 6)[:6]

        if sn and not any([row_name, reference, description, quantity, rate]):
            current_brand = clean_text(sn)
            continue

        reference_text = clean_text(reference)
        if not reference_text:
            continue

        brand = display_brand(current_brand)
        brand_slug = store_slug(current_brand)
        name = product_display_name(brand, reference_text)
        slug = slugify(name)
        legacy_slug = slugify(reference_text)
        description_text = clean_text(description)
        category = infer_category(row_name, reference_text, description_text, brand)
        stock = int(quantity) if quantity not in (None, "") else 0
        price = to_decimal(rate)
        image_url = (
            resolve_product_image_url(name, None, slug)
            or resolve_product_image_url(reference_text, None, legacy_slug)
        )

        products.append(
            {
                "name": name,
                "slug": slug,
                "sku": f"{brand_slug.upper()}-{legacy_slug.upper().replace('-', '_')}",
                "brand": brand,
                "store_slug": brand_slug,
                "category": category,
                "summary": description_text[:255] if description_text else f"{name} from the {brand} store.",
                "description": description_text or f"{name} imported from the Hoinam Energy stock inventory.",
                "price": price,
                "currency": "NGN",
                "stock": stock,
                "image_url": image_url,
                "highlights": [
                    f"{brand} store",
                    category,
                    "Imported from Hoinam stock inventory",
                ],
                "featured": reference_text.strip().lower() in FEATURED_REFERENCES,
                "active": True,
                "legacy_slug": legacy_slug,
                "reference": reference_text,
            }
        )

    return products
