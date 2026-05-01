"""Fix misassigned brand names and fetch missing EcoFlow images."""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL",
    "postgresql://neondb_owner:npg_zt4qUnGN7Klw@ep-old-hill-ak0neb1m.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require")

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text
from backend.database import get_engine

engine = get_engine()

with engine.begin() as conn:
    # 1. Fix Bluetti products that got "EcoFlow " prefix in their name
    conn.execute(text("""
        UPDATE products
        SET name = REGEXP_REPLACE(name, '^EcoFlow ', ''),
            brand = 'Bluetti',
            store_slug = 'bluetti'
        WHERE brand = 'Bluetti' AND name LIKE 'EcoFlow %'
    """))

    # 2. Fix Deye BOS/SE/SUN products that got "EcoFlow " prefix
    conn.execute(text("""
        UPDATE products
        SET name = REGEXP_REPLACE(name, '^EcoFlow ', ''),
            brand = 'Deye',
            store_slug = 'deye'
        WHERE (slug LIKE '%bos%' OR slug LIKE '%se-%' OR slug LIKE '%-sun-%')
          AND name LIKE 'EcoFlow %'
    """))

    # 3. Deactivate duplicate old-name products that are now superseded
    #    (products with brand still EcoFlow but slug contains bluetti model names)
    conn.execute(text("""
        UPDATE products SET active = false
        WHERE brand = 'EcoFlow'
        AND (
            slug LIKE 'ecoflow-ac%' OR slug LIKE 'ecoflow-b2%' OR
            slug LIKE 'ecoflow-b3%' OR slug LIKE 'ecoflow-b7%' OR
            slug LIKE 'ecoflow-eb3a' OR slug LIKE 'ecoflow-ep%' OR
            slug LIKE 'ecoflow-p80' OR slug LIKE 'ecoflow-elite%' OR
            slug LIKE 'ecoflow-bos%' OR slug LIKE 'ecoflow-se-%' OR
            slug LIKE 'ecoflow-sun-%'
        )
    """))

    r_bluetti = conn.execute(text("SELECT COUNT(*) FROM products WHERE brand='Bluetti' AND active=true")).scalar()
    r_deye    = conn.execute(text("SELECT COUNT(*) FROM products WHERE brand='Deye' AND active=true")).scalar()
    r_eco     = conn.execute(text("SELECT COUNT(*) FROM products WHERE brand='EcoFlow' AND active=true")).scalar()
    print(f"Active EcoFlow: {r_eco}  Bluetti: {r_bluetti}  Deye: {r_deye}")

print("Brand fix done.")
