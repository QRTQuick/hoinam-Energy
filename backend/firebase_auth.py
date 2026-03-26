from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials

from .config import get_settings


def get_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    settings = get_settings()
    creds = settings.firebase_credentials()
    if not creds:
        raise RuntimeError("Firebase admin credentials are not configured.")

    return firebase_admin.initialize_app(credentials.Certificate(creds))


def verify_id_token(id_token: str) -> dict:
    get_firebase_app()
    return auth.verify_id_token(id_token, check_revoked=False)
