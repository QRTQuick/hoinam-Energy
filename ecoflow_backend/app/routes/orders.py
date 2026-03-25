from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import Order
from app.services.payment_service import initialize_paystack_transaction, verify_paystack_transaction


orders_bp = Blueprint('orders', __name__)


def _serialize_order(order):
    return {
        "id": order.id,
        "user_id": order.user_id,
        "items": order.items,
        "total_amount": float(order.total_amount or 0),
        "status": order.status,
        "payment_reference": order.payment_reference,
        "payment_status": order.payment_status,
        "delivery_address": order.delivery_address,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@orders_bp.post('')
@jwt_required()
def create_order():
    data = request.get_json() or {}
    items = data.get('items') or []
    total_amount = data.get('total_amount') or 0
    delivery_address = data.get('delivery_address')

    if not items:
        return jsonify({"error": "items are required"}), 400

    order = Order(
        user_id=get_jwt_identity(),
        items=items,
        total_amount=total_amount,
        delivery_address=delivery_address,
    )
    db.session.add(order)
    db.session.commit()

    return jsonify(_serialize_order(order)), 201


@orders_bp.get('/mine')
@jwt_required()
def get_my_orders():
    user_id = get_jwt_identity()
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    return jsonify([_serialize_order(order) for order in orders])


@orders_bp.post('/paystack/initialize')
@jwt_required()
def initialize_paystack():
    data = request.get_json() or {}
    email = data.get('email')
    amount = data.get('amount')
    metadata = data.get('metadata') or {}

    if not email or not amount:
        return jsonify({"error": "email and amount are required"}), 400

    response = initialize_paystack_transaction(email, amount, metadata)
    if not response:
        return jsonify({"error": "Paystack init failed"}), 500

    return jsonify(response)


@orders_bp.post('/paystack/verify')
@jwt_required()
def verify_paystack():
    data = request.get_json() or {}
    reference = data.get('reference')

    if not reference:
        return jsonify({"error": "reference is required"}), 400

    response = verify_paystack_transaction(reference)
    if not response:
        return jsonify({"error": "Paystack verify failed"}), 500

    return jsonify(response)
