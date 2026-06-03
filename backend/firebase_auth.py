from __future__ import annotations

import firebase_admin
from firebase_admin import auth, credentials
import logging

from .config import get_settings

logger = logging.getLogger(__name__)


def get_firebase_app():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    settings = get_settings()
    creds_dict = settings.firebase_credentials()
    
    if not creds_dict:
        logger.error("Firebase admin credentials are not configured in FIREBASE_CREDENTIALS_JSON")
        raise RuntimeError(
            "Firebase admin credentials are not configured. "
            "Please set FIREBASE_CREDENTIALS_JSON in your .env file with a valid Firebase service account."
        )

    try:
        creds = credentials.Certificate(creds_dict)
        logger.info("Firebase admin credentials initialized")
        return firebase_admin.initialize_app(creds)
    except ValueError as e:
        logger.error(f"Failed to initialize Firebase with provided credentials: {str(e)}")
        raise RuntimeError(
            f"Invalid Firebase credentials: {str(e)}. "
            "Ensure FIREBASE_CREDENTIALS_JSON contains a valid Firebase service account JSON."
        )


def verify_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the token claims.
    
    Args:
        id_token: The Firebase ID token to verify
        
    Returns:
        dict: The decoded token claims
        
    Raises:
        ValueError: If the token is invalid or verification fails
    """
    try:
        get_firebase_app()
        claims = auth.verify_id_token(id_token, check_revoked=False)
        logger.debug(f"Token verified for user: {claims.get('email')}")
        return claims
    except ValueError as e:
        # JWT validation errors (expired, malformed, etc.)
        logger.warning(f"Token validation failed: {str(e)}")
        raise ValueError(f"Invalid authentication token: {str(e)}") from e
    except Exception as e:
        # Firebase admin SDK errors
        logger.error(f"Firebase token verification error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise ValueError(
            f"Authentication service error: {type(e).__name__}. Please try signing in again."
        ) from e

