"""Fix blog post slugs that have leading slashes."""
from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_zt4qUnGN7Klw@ep-old-hill-ak0neb1m.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require"
).replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    # Show current state
    rows = conn.execute(text("SELECT id, title, slug, is_published FROM blog_posts ORDER BY id")).fetchall()
    print("Current blog posts:")
    for r in rows:
        print(f"  id={r[0]}  published={r[3]}  slug=[{r[2]}]  title=[{r[1][:60]}]")

    # Strip leading slashes
    result = conn.execute(text("""
        UPDATE blog_posts
        SET slug = LTRIM(slug, '/')
        WHERE slug LIKE '/%'
        RETURNING id, slug
    """))
    fixed = result.fetchall()
    for r in fixed:
        print(f"\nFixed id={r[0]} -> new slug=[{r[1]}]")
    print(f"\nFixed {len(fixed)} slugs.")

    # Show final state
    rows = conn.execute(text("SELECT id, slug, is_published FROM blog_posts ORDER BY id")).fetchall()
    print("\nFinal state:")
    for r in rows:
        print(f"  id={r[0]}  published={r[2]}  slug=[{r[1]}]")
