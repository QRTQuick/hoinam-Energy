from __future__ import annotations

from .config import get_settings
from .models import Product
from .utils import slugify, to_decimal


SEED_PRODUCTS = [
    {
        "name": "River 600",
        "stock": 8,
        "price": "680000",
        "summary": "Compact backup power for homes, shops, and mobile work setups.",
        "description": "A compact EcoFlow power station suited for light backup loads, outdoor teams, and everyday emergency charging.",
        "featured": True,
        "highlights": ["Portable backup power", "Fast setup", "Ideal for light appliances"],
    },
    {
        "name": "110W Solar Panel Foldable",
        "stock": 3,
        "price": "250000",
        "summary": "Portable solar input for flexible field charging.",
        "description": "Foldable solar panel solution for mobile charging, camping, field teams, and rapid deployment energy needs.",
        "featured": True,
        "category": "Solar Panels",
        "highlights": ["Foldable design", "Portable charging", "Pairs with EcoFlow stations"],
    },
    {
        "name": "River 2",
        "stock": 1,
        "price": "420000",
        "summary": "Entry-level EcoFlow station for essential devices and short backup windows.",
        "description": "A simple portable power station for lighting, communication devices, and basic appliance support during outages.",
        "highlights": ["Everyday backup", "Easy transport", "Small-space friendly"],
    },
    {
        "name": "River 2 Max",
        "stock": 1,
        "price": "690000",
        "summary": "Balanced output and portability for homes, kiosks, and mobile operators.",
        "description": "A flexible mid-range power station for customers who need more runtime without moving into a larger Delta setup.",
        "highlights": ["Balanced capacity", "Portable form", "Reliable emergency support"],
    },
    {
        "name": "River 3 Max",
        "stock": 1,
        "price": "980000",
        "summary": "High-capacity portable backup for demanding mobile energy needs.",
        "description": "Built for larger day-to-day backup needs, field operations, and users who need stronger runtime from a transportable unit.",
        "highlights": ["Higher runtime", "Portable deployment", "Business continuity support"],
    },
    {
        "name": "River 2 Pro",
        "stock": 5,
        "price": "980000",
        "summary": "A stronger portable backup option for homes and SMEs.",
        "description": "Designed for customers who need more headroom for longer outages, essential office equipment, and hybrid solar charging.",
        "featured": True,
        "highlights": ["Extended runtime", "Home and office use", "Solar-ready"],
    },
    {
        "name": "Delta 3 2000 Air",
        "stock": 14,
        "price": "2200000",
        "summary": "Premium backup power for heavier workloads and cleaner energy resilience.",
        "description": "A premium EcoFlow system for deeper home backup, installers, and businesses that need stronger performance and longer uptime.",
        "featured": True,
        "category": "Home Backup",
        "highlights": ["Heavy-duty backup", "Solar integration", "Suitable for advanced installations"],
    },
    {
        "name": "Delta 2 Max",
        "stock": 18,
        "price": "1800000",
        "summary": "Scalable power for households and business continuity planning.",
        "description": "A versatile backup platform for homeowners and growing businesses that need dependable energy storage and solar expansion.",
        "featured": True,
        "category": "Home Backup",
        "highlights": ["High storage capacity", "Expandable setup", "Great for homes and SMEs"],
    },
]


def seed_products(session) -> None:
    settings = get_settings()
    existing_names = {name for (name,) in session.query(Product.name).all()}

    for product_data in SEED_PRODUCTS:
        if product_data["name"] in existing_names:
            continue

        product = Product(
            name=product_data["name"],
            slug=slugify(product_data["name"]),
            sku=slugify(product_data["name"]).upper().replace("-", "_"),
            category=product_data.get("category", "Portable Power"),
            summary=product_data["summary"],
            description=product_data["description"],
            price=to_decimal(product_data["price"]),
            currency=settings.default_currency,
            stock=product_data["stock"],
            featured=product_data.get("featured", False),
            highlights=product_data.get("highlights", []),
        )
        session.add(product)

    session.commit()
