from flask import current_app

try:
    from google.auth.transport import requests
    from google.oauth2 import id_token
except Exception:  # pragma: no cover
    requests = None
    id_token = None


def verify_google_token(token):
    client_id = current_app.config.get('GOOGLE_CLIENT_ID')
    if not client_id or not id_token or not requests:
        return None

    try:
        return id_token.verify_oauth2_token(token, requests.Request(), client_id)
    except Exception:
        return None
