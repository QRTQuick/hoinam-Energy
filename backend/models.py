from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    orders = relationship("Order", back_populates="user")
    installations = relationship("Installation", back_populates="user")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "firebase_uid": self.firebase_uid,
            "email": self.email,
            "full_name": self.full_name,
            "phone": self.phone,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    sku: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    category: Mapped[str] = mapped_column(String(128), default="Portable Power", nullable=False)
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="NGN", nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    highlights: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    installations = relationship("Installation", back_populates="product")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "sku": self.sku,
            "category": self.category,
            "summary": self.summary,
            "description": self.description,
            "price": float(self.price),
            "currency": self.currency,
            "stock": self.stock,
            "image_url": self.image_url,
            "highlights": self.highlights or [],
            "featured": self.featured,
            "active": self.active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="confirmed", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(32), default="paid", nullable=False)
    payment_reference: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="NGN", nullable=False)
    shipping_address: Mapped[dict] = mapped_column(JSON, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[list] = mapped_column(JSON, nullable=False)

    user = relationship("User", back_populates="orders")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "order_number": self.order_number,
            "user_id": self.user_id,
            "status": self.status,
            "payment_status": self.payment_status,
            "payment_reference": self.payment_reference,
            "total_amount": float(self.total_amount),
            "currency": self.currency,
            "shipping_address": self.shipping_address,
            "notes": self.notes,
            "items": self.items,
            "created_at": self.created_at.isoformat(),
        }


class Installation(TimestampMixin, Base):
    __tablename__ = "installations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    preferred_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_type: Mapped[str] = mapped_column(String(128), default="Solar Installation", nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    state: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user = relationship("User", back_populates="installations")
    product = relationship("Product", back_populates="installations")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "preferred_date": self.preferred_date.isoformat() if self.preferred_date else None,
            "service_type": self.service_type,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "phone": self.phone,
            "notes": self.notes,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "created_at": self.created_at.isoformat(),
        }
