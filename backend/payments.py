from __future__ import annotations

from typing import Any

import requests

from .config import get_settings

PAYSTACK_BASE_URL = "https://api.paystack.co"


def initialize_transaction(
    *,
    email: str,
    amount_minor: int,
    reference: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()

    if settings.paystack_secret_key:
        response = requests.post(
            f"{PAYSTACK_BASE_URL}/transaction/initialize",
            timeout=20,
            headers={
                "Authorization": f"Bearer {settings.paystack_secret_key}",
                "Content-Type": "application/json",
            },
            json={
                "email": email,
                "amount": amount_minor,
                "currency": settings.default_currency,
                "reference": reference,
                "callback_url": settings.paystack_callback_url,
                "metadata": metadata or {},
            },
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("status"):
            raise ValueError(payload.get("message", "Paystack initialization failed."))
        return payload["data"]

    if settings.allow_demo_payments:
        return {
            "authorization_url": f"{settings.paystack_callback_url}&reference={reference}&demo=1",
            "access_code": reference,
            "reference": reference,
        }

    raise RuntimeError("PAYSTACK_SECRET_KEY is required to initialize payments.")


def verify_transaction(reference: str) -> dict[str, Any]:
    settings = get_settings()

    if settings.paystack_secret_key:
        response = requests.get(
            f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
            timeout=20,
            headers={"Authorization": f"Bearer {settings.paystack_secret_key}"},
        )
        response.raise_for_status()
        payload = response.json()
        if not payload.get("status"):
            raise ValueError(payload.get("message", "Payment verification failed."))
        return payload["data"]

    if settings.allow_demo_payments and reference.startswith("HOINAM-"):
        return {
            "status": "success",
            "reference": reference,
            "currency": settings.default_currency,
            "amount": None,
            "gateway_response": "Demo payment accepted",
        }

    raise RuntimeError("PAYSTACK_SECRET_KEY is required to verify payments.")
