from __future__ import annotations

import smtplib
from email.message import EmailMessage


def smtp_is_configured(settings) -> bool:
    return bool(
        settings.smtp_host
        and settings.smtp_port
        and settings.smtp_username
        and settings.smtp_password
        and settings.order_notification_email
    )


def _format_shipping_address(shipping_address: dict | None) -> str:
    shipping_address = shipping_address or {}
    lines = [
        shipping_address.get("full_name"),
        shipping_address.get("phone"),
        shipping_address.get("address"),
        shipping_address.get("city"),
        shipping_address.get("state"),
    ]
    return "\n".join(str(line).strip() for line in lines if str(line or "").strip()) or "Not provided"


def _format_items(items: list[dict] | None, currency: str) -> str:
    items = items or []
    if not items:
        return "- No order items received"

    lines = []
    for item in items:
        name = str(item.get("name") or "Product").strip()
        quantity = int(item.get("quantity") or 0)
        unit_price = item.get("unit_price") or 0
        line_total = item.get("line_total") or 0
        lines.append(
            f"- {name} | Qty: {quantity} | Unit: {unit_price:,.2f} {currency} | Total: {line_total:,.2f} {currency}"
        )
    return "\n".join(lines)


def build_order_notification_message(
    *,
    settings,
    user,
    order,
    shipping_address: dict | None,
    verification_code: str | None = None,
) -> EmailMessage:
    shipping_address = shipping_address or {}
    recipient = settings.order_notification_email
    sender = settings.smtp_from_email or settings.smtp_username or recipient
    subject = f"New Hoinam order: {order.order_number}"

    user_email = getattr(user, "email", None) or "Not provided"
    user_phone = getattr(user, "phone", None) or shipping_address.get("phone") or "Not provided"
    notes = order.notes or "None"
    verification_line = verification_code or "Not applicable"
    payment_details = getattr(order, "payment_details", None) or {}
    payment_label = payment_details.get("label") or order.payment_method
    selected_bank = payment_details.get("bank_name") or "Not applicable"
    selected_account_number = payment_details.get("account_number") or "Not applicable"
    selected_account_name = payment_details.get("account_name") or "Not applicable"

    body = "\n".join(
        [
            "A new order has been placed on Hoinam Energy.",
            "",
            f"Order number: {order.order_number}",
            f"Order id: {order.id}",
            f"Payment method: {payment_label}",
            f"Payment status: {order.payment_status}",
            f"Payment reference: {order.payment_reference}",
            f"Verification code: {verification_line}",
            f"Selected bank: {selected_bank}",
            f"Selected account number: {selected_account_number}",
            f"Selected account name: {selected_account_name}",
            f"Total amount: {float(order.total_amount):,.2f} {order.currency}",
            "",
            "Customer account",
            f"Name: {getattr(user, 'full_name', None) or shipping_address.get('full_name') or 'Not provided'}",
            f"Email: {user_email}",
            f"Phone: {user_phone}",
            "",
            "Shipping details",
            _format_shipping_address(shipping_address),
            "",
            "Order items",
            _format_items(order.items, order.currency),
            "",
            "Customer notes",
            notes,
        ]
    )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    if user_email and user_email != "Not provided":
        message["Reply-To"] = user_email
    message.set_content(body)
    return message


def send_message_via_smtp(settings, message: EmailMessage) -> None:
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def build_subscription_confirmation_message(
    *,
    settings,
    subscriber_email: str,
    subscriber_name: str | None,
    unsubscribe_token: str,
    frontend_url: str,
) -> EmailMessage:
    sender = settings.smtp_from_email or settings.smtp_username or settings.order_notification_email
    greeting = f"Hi {subscriber_name}," if subscriber_name else "Hi there,"
    unsubscribe_url = f"{frontend_url}/blog.html?unsubscribe={unsubscribe_token}"

    body = "\n".join([
        greeting,
        "",
        "You're now subscribed to the Hoinam Energy blog.",
        "We'll send you a quick note whenever we publish a new post — solar tips, product news, and energy guides.",
        "",
        "If you didn't sign up or want to stop receiving emails, click the link below:",
        unsubscribe_url,
        "",
        "— The Hoinam Energy team",
    ])

    message = EmailMessage()
    message["Subject"] = "You're subscribed to the Hoinam Energy blog"
    message["From"] = sender
    message["To"] = subscriber_email
    message.set_content(body)
    return message


def build_new_post_notification_message(
    *,
    settings,
    subscriber_email: str,
    subscriber_name: str | None,
    post_title: str,
    post_excerpt: str,
    post_url: str,
    unsubscribe_token: str,
    frontend_url: str,
) -> EmailMessage:
    sender = settings.smtp_from_email or settings.smtp_username or settings.order_notification_email
    greeting = f"Hi {subscriber_name}," if subscriber_name else "Hi there,"
    unsubscribe_url = f"{frontend_url}/blog.html?unsubscribe={unsubscribe_token}"

    body = "\n".join([
        greeting,
        "",
        f"A new post is live on the Hoinam Energy blog:",
        "",
        f"  {post_title}",
        f"  {post_excerpt}",
        "",
        f"Read it here: {post_url}",
        "",
        "—",
        "To unsubscribe: " + unsubscribe_url,
    ])

    message = EmailMessage()
    message["Subject"] = f"New post: {post_title}"
    message["From"] = sender
    message["To"] = subscriber_email
    message.set_content(body)
    return message


def build_order_approved_message(
    *,
    settings,
    user,
    order,
    shipping_address: dict | None = None,
) -> EmailMessage:
    shipping_address = shipping_address or order.shipping_address or {}
    sender = settings.smtp_from_email or settings.smtp_username or settings.order_notification_email
    customer_email = getattr(user, "email", None) or shipping_address.get("email") or ""
    customer_name = getattr(user, "full_name", None) or shipping_address.get("full_name") or "Customer"
    greeting = f"Hi {customer_name},"

    body = "\n".join([
        greeting,
        "",
        f"Great news — your Hoinam Energy order {order.order_number} has been approved!",
        "",
        "Your payment has been verified and your order is now being processed for dispatch.",
        "",
        f"Order number:  {order.order_number}",
        f"Total amount:  {float(order.total_amount):,.2f} {order.currency}",
        f"Payment ref:   {order.payment_reference}",
        "",
        "Delivery address:",
        _format_shipping_address(shipping_address),
        "",
        "If you have any questions, reply to this email or contact us at sales@hoinamenergy.com.",
        "",
        "Thank you for choosing Hoinam Energy.",
        "— The Hoinam Energy team",
    ])

    message = EmailMessage()
    message["Subject"] = f"Order {order.order_number} approved — Hoinam Energy"
    message["From"] = sender
    message["To"] = customer_email
    message["Reply-To"] = settings.order_notification_email
    message.set_content(body)
    return message


def build_feedback_notification_message(
    *,
    settings,
    feedback,
) -> EmailMessage:
    sender = settings.smtp_from_email or settings.smtp_username or settings.order_notification_email
    # Feedback goes to support email
    support_email = "hoinamenergy@gmail.com"
    subject = f"New feedback from {feedback.name} — Hoinam Energy"

    stars = ("★" * (feedback.rating or 0)) + ("☆" * (5 - (feedback.rating or 0)))
    rating_line = f"Rating: {stars} ({feedback.rating}/5)" if feedback.rating else "Rating: Not provided"

    service_labels = {
        "general": "General",
        "pre_service": "Before service / Pre-purchase",
        "post_service": "After service / Post-purchase",
        "product": "Product feedback",
        "installation": "Installation feedback",
    }
    service_label = service_labels.get(feedback.service_type, feedback.service_type)

    body = "\n".join([
        "A new customer feedback has been submitted on Hoinam Energy.",
        "",
        f"Name:          {feedback.name}",
        f"Email:         {feedback.email or 'Not provided'}",
        f"Phone:         {feedback.phone or 'Not provided'}",
        f"Feedback type: {service_label}",
        f"Order number:  {feedback.order_number or 'Not provided'}",
        rating_line,
        "",
        "Message:",
        feedback.message,
    ])

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = support_email
    if feedback.email:
        message["Reply-To"] = feedback.email
    message.set_content(body)
    return message


def build_feedback_acknowledgement_message(
    *,
    settings,
    feedback,
) -> EmailMessage:
    sender = settings.smtp_from_email or settings.smtp_username or settings.order_notification_email
    greeting = f"Hi {feedback.name},"

    body = "\n".join([
        greeting,
        "",
        "Thank you for sharing your feedback with Hoinam Energy.",
        "We've received your message and our team will review it shortly.",
        "",
        "If you need immediate assistance, you can reach us at:",
        "  Support:  hoinamenergy@gmail.com",
        "  Sales:    sales@hoinamenergy.com",
        "",
        "— The Hoinam Energy team",
    ])

    message = EmailMessage()
    message["Subject"] = "We received your feedback — Hoinam Energy"
    message["From"] = sender
    message["To"] = feedback.email
    message["Reply-To"] = "hoinamenergy@gmail.com"
    message.set_content(body)
    return message
