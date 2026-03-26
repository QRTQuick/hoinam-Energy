from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


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
