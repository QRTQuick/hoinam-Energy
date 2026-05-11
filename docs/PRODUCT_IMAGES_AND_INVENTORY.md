# Product Database & Image Linking Guide

## Overview

This document describes how the Hoinam Energy product database works, how images are linked to products, and how to sync the inventory from the Excel spreadsheet to the database.

## Architecture

### Image Linking System

Product images are automatically linked through a slug-matching system:

1. **Product Slug Generation**: When a product is added to the database, a `slug` is generated from the product name
   - Example: "EcoFlow River 600" → `ecoflow-river-600`

2. **Image Matching**: The system looks for images in `/assets/images/products/` with the same slug
   - Example: `/assets/images/products/ecoflow-river-600.png`

3. **Image URL Storage**: When found, the image URL is stored in the `Product.image_url` field
   - This happens automatically during inventory parsing

4. **Fallback Handling**: If multiple image formats exist (.png, .jpg, .webp, etc.), the system tries each one automatically

### Frontend Image Resolution

The frontend uses `resolveProductImageUrls()` function (in `assets/js/ui.js`) to:
- Use the stored `image_url` from the database first
- Fall back to trying multiple slug-based filenames
- Display a text fallback (colored initials) if no image is found

## Database Schema

### Product Table

```
products (table)
├── id (int, primary key)
├── name (string, unique) - Product name
├── slug (string, unique) - URL-friendly name (auto-generated)
├── sku (string, unique) - Stock keeping unit
├── brand (string) - Product brand (EcoFlow, Bluetti, Deye)
├── store_slug (string) - Store identifier
├── category (string) - Product category
├── summary (string) - Short description
├── description (text) - Full description
├── price (decimal) - Product price
├── currency (string) - Currency code (NGN)
├── stock (int) - Available units
├── image_url (text) - URL to product image ← KEY FIELD
├── highlights (json) - Feature list
├── featured (bool) - Featured product flag
├── active (bool) - Product visibility flag
├── created_at (timestamp)
└── updated_at (timestamp)
```

## Inventory Sync Process

### Sources

Products come from: `STOCK INVENTORY.xlsx`

This Excel file contains:
- Column A: Serial number (or brand name for header rows)
- Column B: Category/Product name
- Column C: Product reference
- Column D: Description
- Column E: Quantity (stock)
- Column F: Price

### Parsing Process (backend/inventory.py)

1. **Read Excel Sheet**: Parses the active sheet row by row
2. **Brand Detection**: Looks for brand header rows (SN field filled, others empty)
3. **Product Extraction**: Extracts product data for each row under a brand
4. **Auto-Categorization**: Determines product category based on keywords
5. **Slug Generation**: Creates URL-friendly slug from product name
6. **Image Linking**: Attempts to find matching image file
7. **Featured Detection**: Checks if product is in FEATURED_REFERENCES set

### Sync Command

Run this to sync inventory to database:

```bash
python scripts/sync_inventory_to_db.py
```

This script will:
1. Initialize database connection
2. Parse the Excel file
3. Connect products to images
4. Sync all products to database
5. Report on success

## Image Linking Details

### How Image URLs are Resolved

File: `backend/utils.py` - `resolve_product_image_url()`

**Priority order:**
1. **Explicit image_url parameter** - If an explicit URL was provided, use it (supports http/https/data URLs)
2. **Slug-based matching** - Try to find `/assets/images/products/{slug}.{ext}` where ext is png, jpg, jpeg, webp, or svg
3. **Legacy name-based matching** - Fall back to product reference name

**Example:**
```python
# For product "EcoFlow River 3 Plus"
# Slug: "ecoflow-river-3-plus"
# Tries to find:
# - /assets/images/products/ecoflow-river-3-plus.png
# - /assets/images/products/ecoflow-river-3-plus.jpg
# - /assets/images/products/ecoflow-river-3-plus.jpeg
# - /assets/images/products/ecoflow-river-3-plus.webp
# - /assets/images/products/ecoflow-river-3-plus.svg
```

### Current Image Coverage

As of the last inventory parse:
- **Total products**: 100
- **Products with images**: 100 (100%)
- **Products without images**: 0

All 100 products in the inventory file have matching images!

## Product Display on Frontend

### How Products are Rendered

1. **API Call**: Frontend calls `/api/products` to fetch product list
2. **Product Data**: API returns products with `image_url` field
3. **Image Resolution**: Frontend's `resolveProductImageUrls()` resolves the image path
4. **HTML Generation**: Product cards are generated with proper image tags
5. **Fallback Handling**: If image fails to load, system tries alternative URLs

### Product Display Components

| Page | Component | File |
|------|-----------|------|
| Home | Featured products | `assets/js/pages/home.js` |
| Products Catalog | Product grid | `assets/js/pages/products.js` |
| Shop | Store product grid | `assets/js/pages/shop.js` |
| Product Detail | Product detail view | `assets/js/pages/product-detail.js` |

All use `productMedia()` or `resolveProductImageUrls()` from `assets/js/ui.js`

## Adding New Products

### Via Excel Inventory

1. Edit `STOCK INVENTORY.xlsx`
2. Add product rows under appropriate brand section
3. Ensure:
   - Quantity (Column E) and Price (Column F) are filled
   - Product reference (Column C) is descriptive
4. Save the file
5. Run sync: `python scripts/sync_inventory_to_db.py`

### Via API (Admin only)

```bash
POST /api/products
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "New Product",
  "brand": "EcoFlow",
  "price": "500000",
  "stock": 10,
  "category": "Portable Power",
  "summary": "Product summary",
  "description": "Full description",
  "features": ["Feature 1", "Feature 2"]
}
```

The API will automatically:
- Generate slug from name
- Look for matching image
- Store product in database

## Adding/Updating Product Images

### Adding a New Image

1. Create/obtain product image
2. Name it with the product slug: `{product-slug}.{ext}`
   - Example: `ecoflow-river-3-plus.png`
3. Place in: `/assets/images/products/`
4. Re-sync inventory or manually update product: `image_url should now auto-resolve`

### Supported Image Formats

- `.png` - PNG images
- `.jpg` - JPEG images
- `.jpeg` - Alternative JPEG extension
- `.webp` - WebP format (recommended for web)
- `.svg` - SVG vector graphics

### Image Best Practices

- **Size**: 400x400px or larger (square format)
- **Format**: WebP for better compression, PNG for transparency
- **Quality**: High quality, clear product images
- **Naming**: Use lowercase hyphens, match product slug exactly

## Troubleshooting

### Products not showing images

1. **Check database sync**: Ensure inventory was synced
   ```bash
   python scripts/sync_inventory_to_db.py
   ```

2. **Verify image exists**: Check `/assets/images/products/` for the image file
   - Expected filename: `{product-slug}.{ext}`
   - Compare with `Product.slug` in database

3. **Check browser console**: Look for image loading errors

4. **Manually update product image_url**:
   ```bash
   PUT /api/products/{product_id}
   {
     "image_url": "/assets/images/products/correct-filename.png"
   }
   ```

### Missing products

1. **Check Excel file**: Verify `STOCK INVENTORY.xlsx` exists and has data
2. **Run sync command**: `python scripts/sync_inventory_to_db.py`
3. **Check database**: Query `products` table to verify data

### Image loading fails on mobile

- Check image URLs in network inspector
- Ensure images are properly deployed to `/assets/images/products/`
- Verify image permissions on server

## API Endpoints

### Products

```
GET /api/products              # List all active products
GET /api/products?store=slug   # Filter by store
GET /api/products/{id}         # Get single product
POST /api/products             # Create product (admin)
PUT /api/products/{id}         # Update product (admin)
DELETE /api/products/{id}      # Archive product (admin)
```

### Response Format

```json
{
  "id": 1,
  "name": "EcoFlow River 3 Plus",
  "slug": "ecoflow-river-3-plus",
  "sku": "ECOFLOW-RIVER-3-PLUS",
  "brand": "EcoFlow",
  "category": "Portable Power",
  "summary": "High-capacity portable backup",
  "description": "Full product description",
  "price": "980000",
  "currency": "NGN",
  "stock": 15,
  "image_url": "/assets/images/products/ecoflow-river-3-plus.png",
  "highlights": ["Portable", "High capacity"],
  "featured": true,
  "active": true
}
```

## References

- **Inventory Parser**: `backend/inventory.py`
- **Image Resolution**: `backend/utils.py` - `resolve_product_image_url()`
- **Database Models**: `backend/models.py` - `Product` class
- **Sync Script**: `scripts/sync_inventory_to_db.py`
- **Frontend Image Display**: `assets/js/ui.js` - `productMedia()`, `resolveProductImageUrls()`
- **Product Pages**: `assets/js/pages/products.js`, `assets/js/pages/shop.js`, `assets/js/pages/home.js`
