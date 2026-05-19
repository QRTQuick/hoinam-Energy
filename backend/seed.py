from __future__ import annotations

from decimal import Decimal

from .config import get_settings
from .inventory import parse_stock_inventory
from .models import Coupon, JobListing, Product
from .utils import slugify, to_decimal


SEED_PRODUCTS = [
    {
        "name": "River 600",
        "stock": 8,
        "price": "680000",
        "description": "A compact EcoFlow power station suited for light backup loads, outdoor teams, and everyday emergency charging.",
    },
    {
        "name": "110W Solar Panel Foldable",
        "stock": 3,
        "price": "250000",
        "image_url": "/assets/images/products/110w-solar-panel-foldable.png",
        "description": "Foldable solar panel solution for mobile charging, camping, field teams, and rapid deployment energy needs.",
        "category": "Solar Panels",
    },
    {
        "name": "River 2",
        "stock": 1,
        "price": "420000",
        "image_url": "/assets/images/products/river-2.png",
        "description": "A simple portable power station for lighting, communication devices, and basic appliance support during outages.",
    },
    {
        "name": "River 2 Max",
        "stock": 1,
        "price": "690000",
        "image_url": "/assets/images/products/river-2-max.png",
        "description": "A flexible mid-range power station for customers who need more runtime without moving into a larger Delta setup.",
    },
    {
        "name": "River 3 Max",
        "stock": 1,
        "price": "980000",
        "description": "Built for larger day-to-day backup needs, field operations, and users who need stronger runtime from a transportable unit.",
    },
    {
        "name": "River 2 Pro",
        "stock": 5,
        "price": "980000",
        "image_url": "/assets/images/products/river-2-pro.png",
        "description": "Designed for customers who need more headroom for longer outages, essential office equipment, and hybrid solar charging.",
    },
    {
        "name": "Delta 3 2000 Air",
        "stock": 14,
        "price": "2200000",
        "description": "A premium EcoFlow system for deeper home backup, installers, and businesses that need stronger performance and longer uptime.",
        "category": "Home Backup",
    },
    {
        "name": "Delta 2 Max",
        "stock": 18,
        "price": "1800000",
        "image_url": "/assets/images/products/delta-2-max.png",
        "description": "A versatile backup platform for homeowners and growing businesses that need dependable energy storage and solar expansion.",
        "category": "Home Backup",
    },
]


SEED_JOB_LISTINGS = [
    {
        "title": "Sales and Marketing Representative",
        "slug": "sales-and-marketing-representative-hoinam-energy-aba",
        "company": "Hoinam Energy",
        "logo_url": "/assets/images/hoinam-logo.png",
        "location": "Aba, Abia State, Nigeria",
        "salary": "Competitive base salary + uncapped commissions",
        "job_type": "Full-time (Immediate Start)",
        "deadline": "2026-05-15",
        "categories": ["Full-Time", "Marketing", "Sales", "Engineering"],
        "summary": "Join Hoinam Energy immediately to expand our Aba market, educate customers about solar solutions, and drive revenue growth.",
        "about_company": "Hoinam Energy is a fast-growing renewable energy company dedicated to providing affordable, reliable, and sustainable off-grid solar solutions to homes and businesses.",
        "responsibilities": [
            "Lead Generation: Identify and generate new sales leads through field canvassing, cold calling, networking, and community outreach within Aba and surrounding areas.",
            "Customer Education: Guide residential and commercial prospects through the long-term benefits of our solar products, including inverters, solar panels, and battery storage.",
            "Sales Presentations: Conduct client meetings, assess energy needs, and deliver tailored sales proposals and quotations.",
            "Deal Closing: Negotiate terms, close sales agreements, and ensure all customer targets are met or exceeded.",
            "Relationship Management: Build and maintain strong, lasting customer relationships to generate referrals and ensure 100% customer satisfaction.",
            "Market Intelligence: Gather feedback from the field on competitor activities and customer preferences to help improve marketing strategies.",
        ],
        "requirements": [
            "Education: Minimum of OND/HND/B.Sc. in Marketing, Business Administration, Engineering or a related field.",
            "Experience: 2+ years of proven experience in sales or business development. Experience in the solar, electrical, or renewable energy sector is a major plus.",
            "Skills: Outstanding communication, negotiation, and interpersonal skills.",
            "Drive: Self-motivated, target-driven, and highly comfortable working in the field and on the move.",
            "Language: Fluency in English, Igbo, and Pidgin is required.",
        ],
        "benefits": [
            "Competitive base salary plus an attractive, uncapped commission structure on every successful sale.",
            "Comprehensive product and sales training.",
            "Opportunities for career advancement in the renewable energy industry.",
        ],
        "application_email": "admin@hoinamenergy.com",
        "email_subject": "Solar Sales Rep - Aba",
        "how_to_apply": "Interested and qualified candidates should send their updated CV to admin@hoinamenergy.com using \"Solar Sales Rep - Aba\" as the subject of the email. This position requires an immediate start. Shortlisted candidates will be contacted for urgent interviews.",
        "featured": True,
        "active": True,
        "immediate_start": True,
    }
]


def seed_products(session) -> None:
    settings = get_settings()
    inventory_products = parse_stock_inventory()
    if inventory_products:
        upsert_inventory_products(session, inventory_products)
        return

    existing_names = {name for (name,) in session.query(Product.name).all()}

    for product_data in SEED_PRODUCTS:
        if product_data["name"] in existing_names:
            continue

        product = Product(
            name=product_data["name"],
            slug=slugify(product_data["name"]),
            sku=slugify(product_data["name"]).upper().replace("-", "_"),
            category=product_data.get("category", "Portable Power"),
            description=product_data["description"],
            price=to_decimal(product_data["price"]),
            currency=settings.default_currency,
            stock=product_data["stock"],
            image_url=product_data.get("image_url"),
        )
        session.add(product)

    session.commit()


def seed_coupons(session) -> None:
    """Ensure the default SORRY2 coupon exists."""
    existing = session.query(Coupon).filter(Coupon.code == "SORRY2").first()
    if not existing:
        coupon = Coupon(
            code="SORRY2",
            description="2% apology discount — issued when a product is out of stock.",
            discount_type="percent",
            discount_value=Decimal("2.00"),
            min_order_amount=Decimal("0.00"),
            max_uses=None,
            is_active=True,
            expires_at=None,
        )
        session.add(coupon)
        session.commit()


def seed_jobs(session) -> None:
    """Ensure the default public job listing exists."""
    for job_data in SEED_JOB_LISTINGS:
        existing = (
            session.query(JobListing)
            .filter(JobListing.slug == job_data["slug"])
            .first()
        )

        if existing is None:
            job = JobListing()
            session.add(job)
        else:
            job = existing

        for key, value in job_data.items():
            if key == "deadline" and value:
                from datetime import date

                value = date.fromisoformat(value)
            setattr(job, key, value)

    session.commit()


def upsert_inventory_products(session, inventory_products: list[dict]) -> None:
    settings = get_settings()
    products = session.query(Product).all()
    by_slug = {product.slug: product for product in products if product.slug}
    by_sku = {product.sku: product for product in products if product.sku}

    for product_data in inventory_products:
        legacy_slug = product_data.pop("legacy_slug", None)
        product_data.pop("reference", None)
        product_data["currency"] = settings.default_currency

        product = (
            by_sku.get(product_data["sku"])
            or by_slug.get(product_data["slug"])
            or by_slug.get(legacy_slug)
        )

        if product is None:
            product = Product()
            session.add(product)

        for field_name, value in product_data.items():
            setattr(product, field_name, value)

        by_slug[product.slug] = product
        by_sku[product.sku] = product

    session.commit()
