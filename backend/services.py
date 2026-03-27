from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal

from sqlalchemy import func, select

from .config import get_settings
from .models import Product, User
from .utils import slugify, to_decimal


def ensure_unique_full_name(session, full_name: str | None, *, exclude_user_id: int | None = None) -> None:
    if not full_name:
        return

    normalized = " ".join(full_name.split())
    query = select(User).where(func.lower(User.full_name) == normalized.lower())
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)

    existing = session.execute(query).scalar_one_or_none()
    if existing:
        raise ValueError("Full name is already in use. Please use a different name.")


def sync_user_from_claims(session, claims: dict) -> User:
    firebase_uid = claims["uid"]
    email = (claims.get("email") or "").strip().lower() or None
    full_name = (claims.get("name") or claims.get("display_name") or "").strip() or None
    phone = claims.get("phone_number")

    user = session.execute(select(User).where(User.firebase_uid == firebase_uid)).scalar_one_or_none()
    if user is None and email:
        user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()

    role = "admin" if claims.get("admin") or (email and email in get_settings().admin_emails) else "user"

    if user is None:
        ensure_unique_full_name(session, full_name)
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            full_name=full_name,
            phone=phone,
            role=role,
        )
        session.add(user)
    else:
        user.firebase_uid = firebase_uid
        user.email = email
        if full_name and full_name != user.full_name:
            ensure_unique_full_name(session, full_name, exclude_user_id=user.id)
            user.full_name = full_name
        user.phone = phone or user.phone
        if role == "admin" or not user.role:
            user.role = role

    session.commit()
    return user


def normalize_product_payload(payload: dict) -> dict:
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("Product name is required.")

    highlights = payload.get("highlights") or []
    if isinstance(highlights, str):
        highlights = [item.strip() for item in highlights.split(",") if item.strip()]

    return {
        "name": name,
        "slug": payload.get("slug") or slugify(name),
        "sku": payload.get("sku") or slugify(name).upper().replace("-", "_"),
        "category": payload.get("category") or "Portable Power",
        "summary": payload.get("summary"),
        "description": payload.get("description"),
        "price": to_decimal(payload.get("price")),
        "currency": payload.get("currency") or get_settings().default_currency,
        "stock": int(payload.get("stock", 0)),
        "image_url": payload.get("image_url"),
        "highlights": highlights,
        "featured": bool(payload.get("featured", False)),
        "active": bool(payload.get("active", True)),
    }


def apply_product_payload(product: Product, payload: dict) -> Product:
    normalized = normalize_product_payload(payload)
    for field_name, value in normalized.items():
        setattr(product, field_name, value)
    return product


def calculate_order_items(session, raw_items: Iterable[dict], *, lock_products: bool = False):
    items = list(raw_items or [])
    if not items:
        raise ValueError("At least one product is required.")

    requested_ids = []
    quantities = {}

    for item in items:
        product_id = item.get("product_id")
        quantity = int(item.get("quantity", 0))
        if not product_id or quantity <= 0:
            raise ValueError("Each cart item must include a valid product_id and quantity.")
        requested_ids.append(product_id)
        quantities[product_id] = quantities.get(product_id, 0) + quantity

    query = session.query(Product).filter(Product.id.in_(requested_ids), Product.active.is_(True))
    if lock_products:
        query = query.with_for_update()
    products = {product.id: product for product in query.all()}

    normalized_items = []
    total = Decimal("0.00")

    for product_id in requested_ids:
        if product_id not in products:
            raise ValueError(f"Product {product_id} could not be found.")

    for product_id, quantity in quantities.items():
        product = products[product_id]
        if lock_products and quantity > product.stock:
            raise ValueError(f"Not enough stock available for {product.name}.")

        line_total = (product.price or Decimal("0.00")) * quantity
        total += line_total
        normalized_items.append(
            {
                "product_id": product.id,
                "name": product.name,
                "quantity": quantity,
                "unit_price": float(product.price),
                "line_total": float(line_total),
                "currency": product.currency,
                "image_url": product.image_url,
            }
        )

    return normalized_items, total
