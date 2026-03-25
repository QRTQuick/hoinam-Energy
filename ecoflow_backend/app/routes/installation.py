from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import Installation


installation_bp = Blueprint('installation', __name__)


def _serialize_installation(installation):
    return {
        "id": installation.id,
        "user_id": installation.user_id,
        "preferred_date": installation.preferred_date,
        "address": installation.address,
        "notes": installation.notes,
        "status": installation.status,
        "created_at": installation.created_at.isoformat() if installation.created_at else None,
    }


@installation_bp.post('')
@jwt_required()
def book_installation():
    data = request.get_json() or {}
    address = data.get('address')
    preferred_date = data.get('preferred_date')
    notes = data.get('notes')

    if not address:
        return jsonify({"error": "address is required"}), 400

    installation = Installation(
        user_id=get_jwt_identity(),
        address=address,
        preferred_date=preferred_date,
        notes=notes,
    )
    db.session.add(installation)
    db.session.commit()

    return jsonify(_serialize_installation(installation)), 201


@installation_bp.get('/mine')
@jwt_required()
def get_my_installations():
    user_id = get_jwt_identity()
    installations = (
        Installation.query.filter_by(user_id=user_id)
        .order_by(Installation.created_at.desc())
        .all()
    )
    return jsonify([_serialize_installation(installation) for installation in installations])
