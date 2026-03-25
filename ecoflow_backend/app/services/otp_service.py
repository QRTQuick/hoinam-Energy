import random
from datetime import datetime, timedelta

from flask import current_app
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from app.models import OtpCode


def create_otp(phone):
    code = f"{random.randint(0, 999999):06d}"
    expires_in = current_app.config.get('OTP_EXPIRY_MINUTES', 10)
    expires_at = datetime.utcnow() + timedelta(minutes=expires_in)

    otp = OtpCode(
        phone=phone,
        code_hash=generate_password_hash(code),
        expires_at=expires_at,
    )
    db.session.add(otp)
    db.session.commit()

    if current_app.config.get('OTP_DEBUG'):
        return code
    return None


def verify_otp(phone, code):
    now = datetime.utcnow()
    otp = (
        OtpCode.query.filter_by(phone=phone, used=False)
        .order_by(OtpCode.created_at.desc())
        .first()
    )

    if not otp or otp.expires_at < now:
        return False

    if not check_password_hash(otp.code_hash, code):
        return False

    otp.used = True
    db.session.commit()
    return True
