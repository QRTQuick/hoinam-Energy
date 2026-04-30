#!/usr/bin/env python3
"""
Direct SMTP test script - bypasses Flask to test raw SMTP connection
"""

import smtplib
from email.message import EmailMessage
from pathlib import Path
import os
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import get_settings


def test_smtp():
    settings = get_settings()

    print("=" * 60)
    print("SMTP Configuration Test")
    print("=" * 60)

    # Check if configured
    print(f"\n✓ SMTP Host: {settings.smtp_host}")
    print(f"✓ SMTP Port: {settings.smtp_port}")
    print(f"✓ SMTP Username: {settings.smtp_username}")
    print(
        f"✓ SMTP Password: {'*' * 20}...{settings.smtp_password[-10:] if settings.smtp_password else 'MISSING'}"
    )
    print(f"✓ SMTP From Email: {settings.smtp_from_email}")
    print(f"✓ SMTP Use TLS: {settings.smtp_use_tls}")
    print(f"✓ Order Notification Email: {settings.order_notification_email}")

    if not settings.smtp_host or not settings.smtp_port:
        print("\n❌ SMTP Host or Port not configured!")
        return False

    if not settings.smtp_username or not settings.smtp_password:
        print("\n❌ SMTP Username or Password not configured!")
        return False

    print("\n" + "=" * 60)
    print("Attempting SMTP Connection...")
    print("=" * 60)

    try:
        print(f"\n→ Connecting to {settings.smtp_host}:{settings.smtp_port}...")
        with smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
        ) as smtp:
            print("✓ Connection successful!")

            if settings.smtp_use_tls:
                print(f"→ Starting TLS...")
                smtp.starttls()
                print("✓ TLS enabled!")

            print(f"→ Logging in as {settings.smtp_username}...")
            smtp.login(settings.smtp_username, settings.smtp_password)
            print("✓ Login successful!")

            print("\n" + "=" * 60)
            print("Sending Test Email...")
            print("=" * 60)

            test_message = EmailMessage()
            test_message["Subject"] = "[TEST] Hoinam Energy SMTP Test"
            test_message["From"] = settings.smtp_from_email or settings.smtp_username
            test_message["To"] = settings.order_notification_email
            test_message.set_content(
                f"✓ SMTP connection test successful!\n\n"
                f"This email was sent from your Hoinam Energy application.\n"
                f"If you received this, your SMTP setup is working correctly.\n\n"
                f"Test Details:\n"
                f"- From: {test_message['From']}\n"
                f"- To: {test_message['To']}\n"
                f"- Server: {settings.smtp_host}:{settings.smtp_port}\n"
                f"- TLS: {settings.smtp_use_tls}\n"
            )

            smtp.send_message(test_message)
            print(f"✓ Test email sent to {settings.order_notification_email}!")

            print("\n" + "=" * 60)
            print("✅ ALL TESTS PASSED - SMTP IS WORKING!")
            print("=" * 60)
            return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ Authentication Failed: {e}")
        print("   Check your SMTP_USERNAME and SMTP_PASSWORD in .env")
        return False
    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP Error: {e}")
        return False
    except TimeoutError as e:
        print(f"\n❌ Connection Timeout: {e}")
        print(f"   Could not connect to {settings.smtp_host}:{settings.smtp_port}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_smtp()
    sys.exit(0 if success else 1)
