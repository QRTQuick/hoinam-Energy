from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from pathlib import Path


PRODUCT_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".svg")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def _product_image_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "images" / "products"


@lru_cache(maxsize=256)
def _resolved_product_image_from_slug(slug: str) -> str | None:
    if not slug:
        return None

    image_dir = _product_image_dir()
    for extension in PRODUCT_IMAGE_EXTENSIONS:
        candidate = image_dir / f"{slug}{extension}"
        if candidate.is_file():
            return f"/assets/images/products/{slug}{extension}"

    return None


def resolve_product_image_url(name: str | None = None, image_url: str | None = None, slug: str | None = None) -> str | None:
    if image_url and str(image_url).strip():
        return str(image_url).strip()

    lookup_slug = (slug or slugify(name or "")).strip()
    if not lookup_slug:
        return None

    return _resolved_product_image_from_slug(lookup_slug)


def generate_order_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"HN-{stamp}-{uuid.uuid4().hex[:8].upper()}"


def generate_payment_reference() -> str:
    return f"HOINAM-{uuid.uuid4().hex[:12].upper()}"


def to_decimal(value) -> Decimal:
    if value in (None, ""):
        return Decimal("0.00")
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def to_minor_units(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
