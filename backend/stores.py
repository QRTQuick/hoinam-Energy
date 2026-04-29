from __future__ import annotations

from dataclasses import dataclass

STORES = {
    "ecoflow": {
        "id": "ecoflow",
        "name": "EcoFlow Store",
        "slug": "ecoflow",
        "description": "Premium portable power stations from EcoFlow",
        "image_url": "https://ecoflow.com/logo.png",
        "website": "https://www.ecoflow.com/",
        "featured": True,
    },
    "deye": {
        "id": "deye",
        "name": "Deye Store",
        "slug": "deye",
        "description": "High-performance solar inverters and hybrid systems",
        "image_url": "https://www.deye.com/logo.png",
        "website": "https://www.deye.com/",
        "featured": True,
    },
    "buttu": {
        "id": "buttu",
        "name": "Buttu Store",
        "slug": "buttu",
        "description": "Premium solar components and installation solutions",
        "image_url": "https://buttu.com/logo.png",
        "website": "https://buttu.com/",
        "featured": True,
    },
}


@dataclass
class Store:
    id: str
    name: str
    slug: str
    description: str
    image_url: str
    website: str
    featured: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> Store:
        return cls(**data)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "image_url": self.image_url,
            "website": self.website,
            "featured": self.featured,
        }


def get_all_stores() -> list[Store]:
    """Get all available stores"""
    return [Store.from_dict(store_data) for store_data in STORES.values()]


def get_store_by_slug(slug: str) -> Store | None:
    """Get a store by its slug"""
    if slug in STORES:
        return Store.from_dict(STORES[slug])
    return None
