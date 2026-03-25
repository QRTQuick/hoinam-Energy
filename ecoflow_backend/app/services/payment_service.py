import requests
from flask import current_app


def _headers():
    secret = current_app.config.get('PAYSTACK_SECRET_KEY')
    if not secret:
        return None
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def initialize_paystack_transaction(email, amount, metadata=None):
    headers = _headers()
    if not headers:
        return None

    payload = {
        "email": email,
        "amount": int(float(amount) * 100),
        "metadata": metadata or {},
    }

    response = requests.post(
        f"{current_app.config.get('PAYSTACK_BASE_URL')}/transaction/initialize",
        json=payload,
        headers=headers,
        timeout=30,
    )

    if response.status_code >= 400:
        return None

    return response.json()


def verify_paystack_transaction(reference):
    headers = _headers()
    if not headers:
        return None

    response = requests.get(
        f"{current_app.config.get('PAYSTACK_BASE_URL')}/transaction/verify/{reference}",
        headers=headers,
        timeout=30,
    )

    if response.status_code >= 400:
        return None

    return response.json()
