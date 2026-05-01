"""
Update product prices, stock, and descriptions from STOCK INVENTORY.xlsx.
Also deactivates all Buttu and Bluetti products.

Run from the project root:
    python scripts/update_inventory_prices.py
"""
from __future__ import annotations

import sys
import os
from decimal import Decimal
from pathlib import Path

# Allow importing backend modules
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import openpyxl
from backend.database import get_engine, init_database
from backend.models import Product
from backend.utils import slugify
from sqlalchemy.orm import Session

# ── Inventory data extracted from STOCK INVENTORY.xlsx ───────────────────────
# Format: (reference, name, description, price_ngn, stock, brand, category)
# Prices are from the RATE column (already in NGN from the spreadsheet)

INVENTORY = [
    # ── EcoFlow ──────────────────────────────────────────────────────────────
    ("River600",            "River 600",                "Portable power station with a 288Wh battery and a 600W inverter (1200W surge).",                                                                                          170527,   10, "EcoFlow", "Portable Power Station"),
    ("110W SOLAR PANEL",    "110W Solar Panel Foldable","Portable foldable solar panel; 110W rated power for charging EcoFlow stations.",                                                                                           80248,    10, "EcoFlow", "Solar Panels"),
    ("River 2",             "River 2",                  "Entry-level LFP power station with a 256Wh battery and a 300W inverter (600W X-Boost).",                                                                                  274849,   10, "EcoFlow", "Portable Power Station"),
    ("River 3 UPS",         "River 3 UPS",              "UPS-focused power station with a 245Wh battery and a 300W high-speed switching inverter.",                                                                                316980,   10, "EcoFlow", "Portable Power Station"),
    ("River 3 Plus",        "River 3 Plus",             "Next-gen portable unit with a 286Wh battery and a 600W inverter output.",                                                                                                  393215,   10, "EcoFlow", "Portable Power Station"),
    ("River 2 Max",         "River 2 Max",              "Mid-range LFP station with a 512Wh battery and a 500W inverter (1000W X-Boost).",                                                                                         331023,   10, "EcoFlow", "Portable Power Station"),
    ("River 3 Max",         "River 3 Max",              "Enhanced mid-range unit with a 572Wh battery and a 600W inverter.",                                                                                                        505562,   10, "EcoFlow", "Portable Power Station"),
    ("River 2 Pro",         "River 2 Pro",              "High-capacity portable unit with a 768Wh battery and an 800W inverter (1600W X-Boost).",                                                                                  541674,   10, "EcoFlow", "Portable Power Station"),
    ("River 3 Max Plus",    "River 3 Max Plus",         "Flagship portable unit featuring an 858Wh battery and an 800W inverter.",                                                                                                  611891,   10, "EcoFlow", "Portable Power Station"),
    ("Delta 3 Classic",     "Delta 3 Classic",          "High-performance LFP station with a 1024Wh battery and an 1800W inverter.",                                                                                                601860,   10, "EcoFlow", "Home Backup"),
    ("Delta 3 1000 Air Plus","Delta 3 1000 Air Plus",   "Advanced cooling unit with a 1024Wh battery and an 1800W high-output inverter.",                                                                                           543680,   10, "EcoFlow", "Home Backup"),
    ("Delta 3",             "Delta 3",                  "Core 3rd gen model featuring a 1024Wh battery and an 1800W fast-charging inverter.",                                                                                       818530,   10, "EcoFlow", "Home Backup"),
    ("Delta 3 2000 Air",    "Delta 3 2000 Air",         "High-capacity station with a 2048Wh battery and a 2400W high-load inverter.",                                                                                              906802,   10, "EcoFlow", "Home Backup"),
    ("Delta 2 Max",         "Delta 2 Max",              "Expandable LFP powerhouse with a 2048Wh battery and a 2400W inverter (4800W surge).",                                                                                     1316067,  10, "EcoFlow", "Home Backup"),
    ("Delta 3 Max",         "Delta 3 Max",              "Flagship large-capacity unit with a 2048Wh battery and a 2400W inverter.",                                                                                                 1108380,  10, "EcoFlow", "Home Backup"),
    ("Delta Pro",           "Delta Pro",                "Professional-grade unit with a 3600Wh battery and a 3600W inverter (7200W surge).",                                                                                        2123380,  10, "EcoFlow", "Home Backup"),
    ("Delta 3 Ultra",       "Delta 3 Ultra",            "Top-tier home backup unit with a 6144Wh battery and a 6000W high-voltage inverter.",                                                                                       1766100,  10, "EcoFlow", "Home Backup"),
    ("Delta Pro 3",         "Delta Pro 3",              "Next-gen professional station with a 4096Wh battery and a 4000W inverter.",                                                                                                 3197250,  10, "EcoFlow", "Home Backup"),
    ("Delta 2 EB",          "Delta 2 Extra Battery",    "Extra Battery module providing an additional 1024Wh capacity for the Delta 2.",                                                                                             539980,   10, "EcoFlow", "Batteries & Expansion"),
    ("Delta 2 Max EB",      "Delta 2 Max Extra Battery","Expansion battery adding 2048Wh capacity to the Delta 2 Max system.",                                                                                                      978460,   10, "EcoFlow", "Batteries & Expansion"),
    ("Delta Pro EB",        "Delta Pro Extra Battery",  "Heavy-duty expansion battery providing an additional 3600Wh for the Delta Pro.",                                                                                           1770160,  10, "EcoFlow", "Batteries & Expansion"),
    ("Delta Pro 3 EB",      "Delta Pro 3 Extra Battery","Advanced expansion battery adding 4096Wh capacity to the Delta Pro 3.",                                                                                                    2172100,  10, "EcoFlow", "Batteries & Expansion"),
    ("5KW Inverter",        "EcoFlow 5KW Inverter (Single Phase)",   "A 5kW single-phase solar inverter designed for residential use, converting DC to 230V AC.",                                                                  1697080,  10, "EcoFlow", "Inverters"),
    ("6KW Inverter",        "EcoFlow 6KW Inverter (Single Phase)",   "A 6kW single-phase solar inverter for larger residential loads, offering 6000W continuous output.",                                                          1737680,  10, "EcoFlow", "Inverters"),
    ("10KW Inverter",       "EcoFlow 10KW Inverter (Three Phase)",   "A 10kW three-phase inverter for small commercial or large residential balanced loads.",                                                                       2653210,  10, "EcoFlow", "Inverters"),
    ("15KW Inverter",       "EcoFlow 15KW Inverter (Three Phase Plus)","High-performance 15kW three-phase inverter with enhanced protection and monitoring.",                                                                       3223640,  10, "EcoFlow", "Inverters"),
    ("20KW Inverter",       "EcoFlow 20KW Inverter (Three Phase Plus)","Industrial-grade 20kW three-phase inverter designed for commercial power distribution.",                                                                    3300780,  10, "EcoFlow", "Inverters"),
    ("25KW Inverter",       "EcoFlow 25KW Inverter (Three Phase Plus)","Large-scale 25kW three-phase inverter for high-demand commercial energy systems.",                                                                          3300780,  10, "EcoFlow", "Inverters"),
    ("30KW Inverter",       "EcoFlow 30KW Inverter (Three Phase Plus)","Flagship 30kW three-phase inverter for maximum commercial power throughput.",                                                                               3300780,  10, "EcoFlow", "Inverters"),
    ("5KW Battery",         "EcoFlow 5KW Battery",      "A 5kWh Lithium-ion battery storage module for residential energy backup (LFP chemistry).",                                                                                1918350,  10, "EcoFlow", "Batteries & Expansion"),
    ("Single Phase Base",   "EcoFlow Single Phase Base","A mounting base or enclosure specifically designed for single-phase inverter installations.",                                                                               215180,   10, "EcoFlow", "Accessories"),
    ("Junction Box Three Phase","EcoFlow Junction Box (Three Phase)","A three-phase electrical junction box for safe cable termination and distribution.",                                                                          696290,   10, "EcoFlow", "Accessories"),
    ("Single Phase Meter",  "EcoFlow Single Phase Meter","Digital energy meter for monitoring power consumption and generation on a single-phase circuit.",                                                                          54810,    10, "EcoFlow", "Accessories"),
    ("Three Phase Meter",   "EcoFlow Three Phase Meter","Advanced meter for tracking energy across all three phases in commercial or large home setups.",                                                                            95410,    10, "EcoFlow", "Accessories"),
    ("5KW+10KWH",           "EcoFlow 5KW + 10KWH System","Integrated solar system featuring a 5kW inverter and a 10kWh battery storage capacity.",                                                                                5958050,  10, "EcoFlow", "Complete Systems"),
    ("6KW+5KWH",            "EcoFlow 6KW + 5KWH System","Compact solar system with a 6kW inverter and 5kWh of energy storage.",                                                                                                    3926020,  10, "EcoFlow", "Complete Systems"),
    ("6KW+10KWH",           "EcoFlow 6KW + 10KWH System","Balanced solar system with a 6kW inverter and 10kWh of battery capacity.",                                                                                               5844370,  10, "EcoFlow", "Complete Systems"),
    ("6KW+15KWH",           "EcoFlow 6KW + 15KWH System","High-autonomy solar system featuring a 6kW inverter and 15kWh of energy storage.",                                                                                      7762720,  10, "EcoFlow", "Complete Systems"),
    ("25KW+30KWH",          "EcoFlow 25KW + 30KWH System","Commercial-scale system with a 25kW three-phase inverter and 30kWh battery bank.",                                                                                     15604610, 10, "EcoFlow", "Complete Systems"),
    ("30KW+30KWH",          "EcoFlow 30KW + 30KWH System","Heavy-duty commercial system with a 30kW inverter and 30kWh of energy storage.",                                                                                       16477510, 10, "EcoFlow", "Complete Systems"),
    ("Delta Pro Ultra Inverter","Delta Pro Ultra Inverter (7.2KW)","Next-gen EcoFlow Ultra inverter with 7.2kW output and high-surge capability.",                                                                                  4027520,  10, "EcoFlow", "Inverters"),
    ("Delta Pro Ultra Battery","Delta Pro Ultra Battery (6KWH)","High-capacity 6kWh LFP battery module for the Delta Pro Ultra system.",                                                                                            3997070,  10, "EcoFlow", "Batteries & Expansion"),

    # ── Deye ─────────────────────────────────────────────────────────────────
    ("SUN-6K-OG01LP1-EU-AM2",  "Deye 6KW Off-Grid Inverter",          "6kW Single-phase Off-grid inverter. Max charge/discharge 135A. Supports up to 16 pcs in parallel.",                                                       770000,   10, "Deye", "Inverters"),
    ("SUN-6K-SG04LP1-EU-SM2",  "Deye 6KW Hybrid Inverter",            "6kW Single-phase Hybrid inverter. Max charge/discharge 135A. Supports up to 16 pcs in parallel.",                                                         1820000,  10, "Deye", "Inverters"),
    ("SUN-8K-SG05LP1-EU-SM2",  "Deye 8KW Hybrid Inverter",            "8kW Single-phase Hybrid inverter. Max charge/discharge 190A. Supports up to 16 pcs in parallel.",                                                         2100000,  10, "Deye", "Inverters"),
    ("SUN-10K-SG02LP1-EU-AM3", "Deye 10KW Hybrid Inverter",           "10kW Single-phase Hybrid inverter. Colorful touch LCD, IP65, 220A max charge/discharge. Supports diesel generator.",                                      3080000,  10, "Deye", "Inverters"),
    ("SUN-12K-SG02LP1-EU-AM3", "Deye 12KW Hybrid Inverter (Single Phase)","12kW Single-phase Hybrid inverter.",                                                                                                                    3220000,  10, "Deye", "Inverters"),
    ("SUN-12K-SG04LP3-EU-AM3", "Deye 12KW Hybrid Inverter (Three Phase)","12kW Three-phase Hybrid inverter.",                                                                                                                      3220000,  10, "Deye", "Inverters"),
    ("SUN-16K-SG01LP1-EU-AM3", "Deye 16KW Hybrid Inverter (Single Phase)","16kW Single-phase Hybrid inverter.",                                                                                                                    4480000,  10, "Deye", "Inverters"),
    ("SUN-16K-SG05LP3-EU-SM2", "Deye 16KW Hybrid Inverter (Three Phase)","16kW Three-phase Hybrid inverter.",                                                                                                                      4480000,  10, "Deye", "Inverters"),
    ("SUN-20K-SG05LP3-EU-SM2", "Deye 20KW Hybrid Inverter",           "20kW Three-phase Hybrid inverter.",                                                                                                                         5460000,  10, "Deye", "Inverters"),
    ("SUN-25K-SG01HP3-EU-AM2", "Deye 25KW Hybrid Inverter",           "25kW Three-phase High-voltage Hybrid inverter.",                                                                                                            4480000,  10, "Deye", "Inverters"),
    ("SUN-30K-SG02HP3-EU-AM3", "Deye 30KW Hybrid Inverter",           "30kW Three-phase High-voltage Hybrid inverter.",                                                                                                            6440000,  10, "Deye", "Inverters"),
    ("SUN-50K-SG01HP3-EU-BM4", "Deye 50KW Hybrid Inverter",           "50kW Hybrid Inverter, Three Phase, High Voltage. Max 10 pcs parallel. Supports multiple batteries parallel.",                                              8260000,  10, "Deye", "Inverters"),
    ("SUN-80K-SG02HP3-EU-EM6", "Deye 80KW Hybrid Inverter",           "HV Hybrid 3-Phase 80KW. 100% unbalanced output each phase. Max 10 pcs parallel. 128kW PV input.",                                                         12600000, 10, "Deye", "Inverters"),
    ("SE-F5-C",             "Deye 5KWH Battery (SE-F5-C)",            "5kWh Low Voltage LFP battery module.",                                                                                                                       1190000,  10, "Deye", "Batteries & Expansion"),
    ("SE-G5.1",             "Deye 5KWH Battery (SE-G5.1)",            "5.12kWh Low Voltage LFP battery (100Ah). Scalable up to 64 units in parallel (327kWh total).",                                                             1190000,  10, "Deye", "Batteries & Expansion"),
    ("SE-G10.2",            "Deye 10KWH Battery (SE-G10.2)",          "10.24kWh Low Voltage LFP battery (200Ah). Scalable up to 64 units in parallel (655kWh total).",                                                            2380000,  10, "Deye", "Batteries & Expansion"),
    ("SE-F12-C",            "Deye 12KWH Battery (SE-F12-C)",          "11.8kWh Low Voltage LFP battery. Continuous current 230A. Cycle life >6000 cycles at 80% DoD.",                                                            2940000,  10, "Deye", "Batteries & Expansion"),
    ("SE-F16",              "Deye 16KWH Battery (SE-F16)",            "16kWh Low Voltage LFP battery (314Ah). Scalable up to 32 units in parallel (up to 512kWh).",                                                               3640000,  10, "Deye", "Batteries & Expansion"),
    ("BOS-G PRO",           "Deye BOS-G PRO (5KWH)",                  "Deye BOS-G PRO 5kWh battery system.",                                                                                                                       1540000,  10, "Deye", "Batteries & Expansion"),
    ("BOS-G-PDU-2",         "Deye BOS-G-PDU-2",                       "Deye BOS-G PDU-2 battery distribution unit.",                                                                                                               1540000,  10, "Deye", "Batteries & Expansion"),
    ("BOS-A",               "Deye BOS-A (7.6KWH)",                    "Rechargeable Lithium Ion High Voltage Battery, 7.6kWh.",                                                                                                    2240000,  10, "Deye", "Batteries & Expansion"),
    ("BOS-A-PDU-2",         "Deye BOS-A-PDU-2",                       "Deye BOS-A PDU-2 battery distribution unit.",                                                                                                               1925000,  10, "Deye", "Batteries & Expansion"),
    ("BOS-G 40KWH",         "Deye BOS-G 40KWH",                       "Deye BOS-G 40kWh large-scale battery system.",                                                                                                              14560000, 10, "Deye", "Batteries & Expansion"),
]

# Name aliases — maps common name variations to the canonical name above
# so we can match existing DB records that may have slightly different names
NAME_ALIASES: dict[str, str] = {
    "river 600": "River 600",
    "river600": "River 600",
    "110w solar panel foldable": "110W Solar Panel Foldable",
    "110w solar panel": "110W Solar Panel Foldable",
    "river 2": "River 2",
    "river 2 max": "River 2 Max",
    "river 2 pro": "River 2 Pro",
    "river 3 max": "River 3 Max",
    "river 3 ups": "River 3 UPS",
    "river 3 plus": "River 3 Plus",
    "river 3 max plus": "River 3 Max Plus",
    "delta 3": "Delta 3",
    "delta 3 classic": "Delta 3 Classic",
    "delta 3 1000 air plus": "Delta 3 1000 Air Plus",
    "delta 3 2000 air": "Delta 3 2000 Air",
    "delta 3 max": "Delta 3 Max",
    "delta 3 ultra": "Delta 3 Ultra",
    "delta 2 max": "Delta 2 Max",
    "delta pro": "Delta Pro",
    "delta pro 3": "Delta Pro 3",
    "delta 2 eb": "Delta 2 Extra Battery",
    "delta 2 extra battery": "Delta 2 Extra Battery",
    "delta 2 max eb": "Delta 2 Max Extra Battery",
    "delta 2 max extra battery": "Delta 2 Max Extra Battery",
    "delta pro eb": "Delta Pro Extra Battery",
    "delta pro extra battery": "Delta Pro Extra Battery",
    "delta pro 3 eb": "Delta Pro 3 Extra Battery",
    "delta pro 3 extra battery": "Delta Pro 3 Extra Battery",
    "delta pro ultra inverter (7.2kw)": "Delta Pro Ultra Inverter (7.2KW)",
    "delta pro ultra battery (6kwh)": "Delta Pro Ultra Battery (6KWH)",
}


def canonical_name(raw: str) -> str:
    return NAME_ALIASES.get(raw.strip().lower(), raw.strip())


def run():
    print("Connecting to database…")
    engine = get_engine()
    init_database()

    with Session(engine) as session:
        # ── 1. Deactivate ALL Buttu and Bluetti products ──────────────────────
        deactivated = (
            session.query(Product)
            .filter(
                Product.brand.ilike("buttu") |
                Product.store_slug.ilike("buttu") |
                Product.brand.ilike("bluetti") |
                Product.store_slug.ilike("bluetti")
            )
            .all()
        )
        for p in deactivated:
            p.active = False
        print(f"Deactivated {len(deactivated)} Buttu/Bluetti products.")

        # ── 2. Build lookup of existing products ─────────────────────────────
        all_products = session.query(Product).all()
        by_name: dict[str, Product] = {p.name.strip().lower(): p for p in all_products}
        by_slug: dict[str, Product] = {p.slug: p for p in all_products if p.slug}
        by_sku:  dict[str, Product] = {p.sku: p for p in all_products if p.sku}

        updated = 0
        created = 0

        for ref, name, description, price, stock, brand, category in INVENTORY:
            if price == 0:
                continue  # skip items with no price

            canon = canonical_name(name)
            slug  = slugify(canon)
            sku   = slug.upper().replace("-", "_")
            store_slug = brand.lower()

            # Try to find existing product
            product = (
                by_name.get(canon.lower())
                or by_name.get(name.strip().lower())
                or by_slug.get(slug)
                or by_sku.get(sku)
            )

            if product:
                old_price = float(product.price or 0)
                product.price    = Decimal(str(price))
                product.stock    = stock
                product.brand    = brand
                product.store_slug = store_slug
                product.category = category
                product.active   = True
                if description and not product.description:
                    product.description = description
                print(f"  UPDATED  {product.name:50s}  ₦{old_price:>12,.0f} → ₦{price:>12,.0f}")
                updated += 1
            else:
                # Create new product
                product = Product(
                    name=canon,
                    slug=slug,
                    sku=sku,
                    brand=brand,
                    store_slug=store_slug,
                    category=category,
                    summary=description[:120] if description else f"{brand} {canon}",
                    description=description or "",
                    price=Decimal(str(price)),
                    currency="NGN",
                    stock=stock,
                    active=True,
                    featured=False,
                    highlights=[],
                )
                session.add(product)
                by_name[canon.lower()] = product
                by_slug[slug] = product
                print(f"  CREATED  {canon:50s}  ₦{price:>12,.0f}")
                created += 1

        session.commit()
        print(f"\nDone. {updated} products updated, {created} new products created.")
        print(f"{len(deactivated)} Buttu/Bluetti products deactivated.")


if __name__ == "__main__":
    run()
