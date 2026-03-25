from flask import Blueprint, jsonify, request
from app import db
from app.models import Product
from app.routes.helpers import admin_required


products_bp = Blueprint('products', __name__)


def _serialize_product(product):
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": float(product.price or 0),
        "quantity": product.quantity,
        "image_url": product.image_url,
        "category": product.category,
    }


@products_bp.get('')
def list_products():
    query = Product.query
    search = request.args.get('q')
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    products = query.order_by(Product.created_at.desc()).all()
    return jsonify([_serialize_product(p) for p in products])


@products_bp.get('/<int:product_id>')
def get_product(product_id):
    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(_serialize_product(product))


@products_bp.post('')
@admin_required
def create_product():
    data = request.get_json() or {}

    product = Product(
        name=data.get('name'),
        description=data.get('description'),
        price=data.get('price') or 0,
        quantity=data.get('quantity') or 0,
        image_url=data.get('image_url'),
        category=data.get('category'),
    )

    if not product.name:
        return jsonify({"error": "name is required"}), 400

    db.session.add(product)
    db.session.commit()

    return jsonify(_serialize_product(product)), 201


@products_bp.put('/<int:product_id>')
@admin_required
def update_product(product_id):
    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}

    for field in ['name', 'description', 'price', 'quantity', 'image_url', 'category']:
        if field in data:
            setattr(product, field, data[field])

    db.session.commit()
    return jsonify(_serialize_product(product))


@products_bp.delete('/<int:product_id>')
@admin_required
def delete_product(product_id):
    product = db.session.get(Product, product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Deleted"})
