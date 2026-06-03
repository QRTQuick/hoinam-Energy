from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .utils import resolve_product_image_url


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
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    needs_monitoring: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    monitoring_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

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
            "needs_monitoring": self.needs_monitoring,
            "monitoring_reason": self.monitoring_reason,
            "created_at": self.created_at.isoformat(),
        }


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    sku: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    store_slug: Mapped[str | None] = mapped_column(
        String(80), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(
        String(128), default="Portable Power", nullable=False
    )
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(16), default="NGN", nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    highlights: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    specs: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    installations = relationship("Installation", back_populates="product")
    inventory_movements = relationship("InventoryMovement", back_populates="product")

    def to_dict(self) -> dict:
        # Resolve image URL with validation
        resolved_image = resolve_product_image_url(
            self.name, self.image_url, self.slug
        )
        
        # Ensure image_url is always a valid string (never None)
        # Frontend expects a string, even if it's a placeholder
        image_url = resolved_image or "/assets/images/products/placeholder.svg"
        highlights = self.highlights or []
        
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "sku": self.sku,
            "brand": self.brand or "Energy",  # Provide fallback
            "store_slug": self.store_slug,
            "category": self.category or "Portable Power",  # Provide fallback
            "summary": self.summary,
            "description": self.description,
            "price": float(self.price),
            "currency": self.currency,
            "stock": max(0, self.stock),  # Ensure non-negative
            "image_url": image_url,
            "highlights": highlights,
            "features": highlights,
            "featured": self.featured,
            "active": self.active,
            "specs": self.specs or {},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class JobListing(TimestampMixin, Base):
    __tablename__ = "job_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    company: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    salary: Mapped[str | None] = mapped_column(String(128), nullable=True)
    job_type: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    categories: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    summary: Mapped[str | None] = mapped_column(String(500), nullable=True)
    about_company: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsibilities: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    requirements: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    benefits: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    application_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    how_to_apply: Mapped[str | None] = mapped_column(Text, nullable=True)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    immediate_start: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "company": self.company,
            "logo_url": self.logo_url or "/assets/images/hoinam-logo.png",
            "location": self.location,
            "salary": self.salary,
            "job_type": self.job_type,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "categories": self.categories or [],
            "summary": self.summary,
            "about_company": self.about_company,
            "responsibilities": self.responsibilities or [],
            "requirements": self.requirements or [],
            "benefits": self.benefits or [],
            "application_email": self.application_email,
            "email_subject": self.email_subject,
            "how_to_apply": self.how_to_apply,
            "featured": self.featured,
            "active": self.active,
            "immediate_start": self.immediate_start,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="confirmed", nullable=False, index=True)
    payment_status: Mapped[str] = mapped_column(
        String(32), default="paid", nullable=False, index=True
    )
    payment_method: Mapped[str] = mapped_column(
        String(32), default="opay_transfer", nullable=False, index=True
    )
    payment_reference: Mapped[str] = mapped_column(
        String(128), unique=True, nullable=False, index=True
    )
    payment_details: Mapped[dict | None] = mapped_column(JSON, default=dict, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="NGN", nullable=False)
    shipping_address: Mapped[dict] = mapped_column(JSON, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[list] = mapped_column(JSON, nullable=False)
    sales_channel: Mapped[str] = mapped_column(
        String(32), default="website", nullable=False, index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    sales_order_number: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    invoice_number: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )
    receipt_number: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True, index=True
    )

    user = relationship("User", back_populates="orders")
    created_by = relationship("User", foreign_keys=[created_by_id])
    documents = relationship("DocumentRecord", back_populates="order")
    inventory_movements = relationship("InventoryMovement", back_populates="order")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "order_number": self.order_number,
            "user_id": self.user_id,
            "status": self.status,
            "payment_status": self.payment_status,
            "payment_method": self.payment_method,
            "payment_reference": self.payment_reference,
            "payment_details": self.payment_details or {},
            "total_amount": float(self.total_amount),
            "currency": self.currency,
            "shipping_address": self.shipping_address,
            "notes": self.notes,
            "items": self.items,
            "sales_channel": self.sales_channel,
            "created_by_id": self.created_by_id,
            "sales_order_number": self.sales_order_number,
            "invoice_number": self.invoice_number,
            "receipt_number": self.receipt_number,
            "created_at": self.created_at.isoformat(),
        }


class Installation(TimestampMixin, Base):
    __tablename__ = "installations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"), nullable=True, index=True
    )
    preferred_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    service_type: Mapped[str] = mapped_column(
        String(128), default="Solar Installation", nullable=False
    )
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
            "preferred_date": (
                self.preferred_date.isoformat() if self.preferred_date else None
            ),
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


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, index=True
    )
    verification_code: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(16), default="NGN", nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True
    )  # bank_transfer, opay_transfer, opay_app, pay_on_delivery
    status: Mapped[str] = mapped_column(
        String(32), default="pending", nullable=False, index=True
    )  # pending, confirmed, failed
    receipt_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    transaction_details: Mapped[dict] = mapped_column(
        JSON, default=dict, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    order = relationship("Order")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "verification_code": self.verification_code,
            "amount": float(self.amount),
            "currency": self.currency,
            "payment_method": self.payment_method,
            "status": self.status,
            "receipt_url": self.receipt_url,
            "receipt_uploaded_at": (
                self.receipt_uploaded_at.isoformat()
                if self.receipt_uploaded_at
                else None
            ),
            "transaction_details": self.transaction_details,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }


class DocumentRecord(TimestampMixin, Base):
    __tablename__ = "document_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id"), nullable=False, index=True
    )
    document_type: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True
    )  # sales_order | invoice | payment_receipt
    document_number: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default="generated", nullable=False, index=True
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    order = relationship("Order", back_populates="documents")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "order_id": self.order_id,
            "document_type": self.document_type,
            "document_number": self.document_number,
            "status": self.status,
            "generated_at": self.generated_at.isoformat(),
            "created_at": self.created_at.isoformat(),
        }


class InventoryMovement(TimestampMixin, Base):
    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False, index=True
    )
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("orders.id"), nullable=True, index=True
    )
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    movement_type: Mapped[str] = mapped_column(
        String(32), nullable=False, index=True
    )  # sale | admin_sale | adjustment | import
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    new_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product", back_populates="inventory_movements")
    order = relationship("Order", back_populates="inventory_movements")
    actor = relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name if self.product else None,
            "order_id": self.order_id,
            "order_number": self.order.order_number if self.order else None,
            "actor_user_id": self.actor_user_id,
            "actor": self.actor.to_dict() if self.actor else None,
            "movement_type": self.movement_type,
            "quantity": self.quantity,
            "previous_stock": self.previous_stock,
            "new_stock": self.new_stock,
            "note": self.note,
            "created_at": self.created_at.isoformat(),
        }


class BlogPost(TimestampMixin, Base):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    excerpt: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(100), default="News", nullable=False, index=True)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    author = relationship("User")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "excerpt": self.excerpt,
            "content": self.content,
            "image_url": self.image_url,
            "author_id": self.author_id,
            "author": self.author.to_dict() if self.author else None,
            "is_published": self.is_published,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "category": self.category,
            "tags": self.tags or [],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class BlogSubscriber(TimestampMixin, Base):
    __tablename__ = "blog_subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    unsubscribe_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


class Feedback(TimestampMixin, Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    service_type: Mapped[str] = mapped_column(
        String(64), default="general", nullable=False, index=True
    )  # general | pre_service | post_service | product | installation
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1–5
    message: Mapped[str] = mapped_column(Text, nullable=False)
    order_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default="new", nullable=False, index=True
    )  # new | reviewed | resolved

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "service_type": self.service_type,
            "rating": self.rating,
            "message": self.message,
            "order_number": self.order_number,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }


class Coupon(TimestampMixin, Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    discount_type: Mapped[str] = mapped_column(
        String(16), default="percent", nullable=False
    )  # percent | fixed
    discount_value: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )  # e.g. 2.00 for 2% or 500.00 for ₦500 off
    min_order_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = unlimited
    uses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "description": self.description,
            "discount_type": self.discount_type,
            "discount_value": float(self.discount_value),
            "min_order_amount": float(self.min_order_amount),
            "max_uses": self.max_uses,
            "uses": self.uses,
            "is_active": self.is_active,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat(),
        }
