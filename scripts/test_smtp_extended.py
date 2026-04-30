#!/usr/bin/env python3
"""
Extended SMTP test with multiple port options
"""
import smtplib
from email.message import EmailMessage
from pathlib import Path
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.config import get_settings

def test_smtp_with_ports():
    settings = get_settings()
    
    print("=" * 70)
    print("EXTENDED SMTP CONFIGURATION TEST")
    print("=" * 70)
    print(f"\n📧 Testing Brevo SMTP")
    print(f"   Username: {settings.smtp_username}")
    print(f"   From: {settings.smtp_from_email}")
    print(f"   To: {settings.order_notification_email}")
    
    # Try multiple ports that Brevo supports
    ports_to_try = [
        (587, True, "TLS"),   # Standard TLS
        (25, True, "TLS"),    # Port 25 with TLS
        (465, False, "SSL"),  # SSL port (no STARTTLS)
    ]
    
    for port, use_tls, method in ports_to_try:
        print(f"\n{'─' * 70}")
        print(f"Attempt: Port {port} ({method})")
        print(f"{'─' * 70}")
        
        try:
            if use_tls and port == 465:
                # SSL connection
                print(f"→ Connecting with SSL...")
                smtp = smtplib.SMTP_SSL(settings.smtp_host, port, timeout=30)
            else:
                # TLS connection
                print(f"→ Connecting to {settings.smtp_host}:{port}...")
                smtp = smtplib.SMTP(settings.smtp_host, port, timeout=30)
                if use_tls:
                    print(f"→ Starting TLS...")
                    smtp.starttls()
            
            print("✓ Connected!")
            
            print(f"→ Logging in({settings.smtp_username})...")
            smtp.login(settings.smtp_username, settings.smtp_password)
            print("✓ Login successful!")
            
            # Build test message
            test_message = EmailMessage()
            test_message["Subject"] = "[TEST] Hoinam Energy SMTP"
            test_message["From"] = settings.smtp_from_email or settings.smtp_username
            test_message["To"] = settings.order_notification_email
            test_message.set_content(
                f"✅ SMTP Connection Test Successful!\n\n"
                f"Port: {port}\n"
                f"Method: {method}\n"
                f"This email confirms your SMTP is working.\n"
            )
            
            print(f"→ Sending test email...")
            smtp.send_message(test_message)
            print(f"✓ Email sent!")
            smtp.quit()
            
            print(f"\n{'=' * 70}")
            print(f"✅ SUCCESS on Port {port} ({method})")
            print(f"{'=' * 70}")
            print(f"\nUpdate your .env if using different port:")
            print(f"   SMTP_PORT={port}")
            print(f"   SMTP_USE_TLS={'true' if use_tls and port != 465 else 'false'}")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            print(f"❌ Authentication failed: {str(e)[:60]}")
        except smtplib.SMTPException as e:
            print(f"❌ SMTP error: {str(e)[:60]}")
        except TimeoutError as e:
            print(f"❌ Connection timeout")
        except ConnectionRefusedError as e:
            print(f"❌ Connection refused on port {port}")
        except Exception as e:
            print(f"❌ Error: {str(e)[:60]}")
    
    print(f"\n{'=' * 70}")
    print("❌ FAILED - No ports worked")
    print(f"{'=' * 70}")
    print("\n⚠️  Possible issues:")
    print("   1. Firewall/Network blocking all SMTP ports")
    print("   2. Invalid Brevo credentials")
    print("   3. Brevo account restrictions or API key issues")
    print("\n💡 Next steps:")
    print("   - Check Brevo dashboard for credential validity")
    print("   - Verify the API key hasn't expired")
    print("   - Check if 'honimaenergy@gmail.com' is a verified sender")
    return False

if __name__ == "__main__":
    success = test_smtp_with_ports()
    sys.exit(0 if success else 1)
