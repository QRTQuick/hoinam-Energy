from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from app.models import User
from app.services.google_auth import verify_google_token
from app.services.otp_service import create_otp, verify_otp


auth_bp = Blueprint('auth', __name__)


def _serialize_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "name": user.name,
        "role": user.role,
        "profile_image": user.profile_image,
    }


def _token_for(user):
    return create_access_token(identity=user.id, additional_claims={"role": user.role})


@auth_bp.post('/register')
def register():
    data = request.get_json() or {}
    name = data.get('name')
    username = data.get('username')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')

    if not name or not username or not password or not email:
        return jsonify({"error": "name, username, email and password are required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already registered"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    if phone and User.query.filter_by(phone=phone).first():
        return jsonify({"error": "Phone already registered"}), 409

    user = User(
        name=name,
        username=username,
        email=email,
        phone=phone,
        password_hash=generate_password_hash(password),
        created_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({"token": _token_for(user), "user": _serialize_user(user)}), 201


@auth_bp.post('/login')
def login():
    data = request.get_json() or {}
    identifier = data.get('identifier') or data.get('email') or data.get('username')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({"error": "username/email and password are required"}), 400

    user = User.query.filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"token": _token_for(user), "user": _serialize_user(user)})


@auth_bp.post('/otp/request')
def request_otp():
    data = request.get_json() or {}
    phone = data.get('phone')

    if not phone:
        return jsonify({"error": "phone is required"}), 400

    otp_value = create_otp(phone)

    response = {"message": "OTP sent"}
    if otp_value:
        response["debug_otp"] = otp_value

    return jsonify(response)


@auth_bp.post('/otp/verify')
def verify_otp_route():
    data = request.get_json() or {}
    phone = data.get('phone')
    code = data.get('code')
    name = data.get('name')
    username = data.get('username')

    if not phone or not code:
        return jsonify({"error": "phone and code are required"}), 400

    valid = verify_otp(phone, code)
    if not valid:
        return jsonify({"error": "Invalid or expired OTP"}), 401

    user = User.query.filter_by(phone=phone).first()
    if not user:
        if username and User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already registered"}), 409
        safe_username = username or phone
        if User.query.filter_by(username=safe_username).first():
            safe_username = f"user_{phone[-4:]}"
        user = User(name=name or "Hoinam User", phone=phone, username=safe_username)
        db.session.add(user)
        db.session.commit()

    return jsonify({"token": _token_for(user), "user": _serialize_user(user)})


@auth_bp.post('/google')
def google_login():
    data = request.get_json() or {}
    token = data.get('id_token')

    if not token:
        return jsonify({"error": "id_token is required"}), 400

    payload = verify_google_token(token)
    if not payload:
        return jsonify({"error": "Invalid Google token"}), 401

    email = payload.get('email')
    google_id = payload.get('sub')
    name = payload.get('name') or payload.get('given_name') or "Hoinam User"
    picture = payload.get('picture')
    base_username = (email.split('@')[0] if email else f"user_{google_id[-6:]}").lower()

    user = User.query.filter_by(email=email).first()
    if not user:
        candidate = base_username
        if User.query.filter_by(username=candidate).first():
            candidate = f"{base_username}_{google_id[-4:]}"
        user = User(
            name=name,
            email=email,
            google_id=google_id,
            profile_image=picture,
            username=candidate,
        )
        db.session.add(user)
    else:
        user.google_id = google_id
        user.profile_image = picture or user.profile_image

    db.session.commit()

    return jsonify({"token": _token_for(user), "user": _serialize_user(user)})
