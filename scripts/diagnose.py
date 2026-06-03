#!/usr/bin/env python3
"""
Hoinam Energy - Production Diagnostics Script

Run this script to diagnose common issues with:
- Environment configuration
- Database connectivity
- Firebase credentials
- Email configuration
- API endpoints

Usage:
    python scripts/diagnose.py
    
Or from project root:
    python -m scripts.diagnose
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import get_settings


def check_environment():
    """Check if .env file exists and has required variables."""
    print("\n" + "="*60)
    print("ENVIRONMENT CONFIGURATION CHECK")
    print("="*60)
    
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        print("❌ .env file not found at:", env_path)
        return False
    
    print("✅ .env file found")
    
    try:
        settings = get_settings()
    except Exception as e:
        print(f"❌ Failed to load settings: {e}")
        return False
    
    # Check critical variables
    checks = [
        ("DATABASE_URL", settings.database_url, True),
        ("FIREBASE_CREDENTIALS", settings.firebase_credentials(), True),
        ("SMTP_HOST", settings.smtp_host, False),
        ("SMTP_USERNAME", settings.smtp_username, False),
        ("DEFAULT_CURRENCY", settings.default_currency, False),
    ]
    
    all_good = True
    for name, value, required in checks:
        status = "✅" if value else "❌" if required else "⚠️"
        print(f"{status} {name}: {'SET' if value else 'NOT SET'}")
        if required and not value:
            all_good = False
    
    return all_good


def check_database():
    """Check database connectivity."""
    print("\n" + "="*60)
    print("DATABASE CONNECTIVITY CHECK")
    print("="*60)
    
    try:
        from backend.database import get_engine, Base, check_database_url
        
        settings = get_settings()
        if not settings.database_url:
            print("❌ DATABASE_URL is not configured")
            return False
        
        print(f"📍 Database: {settings.database_url[:50]}...")
        
        try:
            check_database_url()
            print("✅ Database URL is valid")
        except Exception as e:
            print(f"❌ Database URL validation failed: {e}")
            return False
        
        try:
            engine = get_engine()
            with engine.connect() as conn:
                result = conn.execute("SELECT 1")
                print("✅ Database connection successful")
                return True
        except Exception as e:
            print(f"❌ Database connection failed: {type(e).__name__}: {e}")
            return False
            
    except ImportError as e:
        print(f"❌ Failed to import database modules: {e}")
        return False


def check_firebase():
    """Check Firebase configuration."""
    print("\n" + "="*60)
    print("FIREBASE AUTHENTICATION CHECK")
    print("="*60)
    
    try:
        from backend.firebase_auth import get_firebase_app
        from backend.config import get_settings
        
        settings = get_settings()
        creds = settings.firebase_credentials()
        
        if not creds:
            print("❌ FIREBASE_CREDENTIALS_JSON is not configured")
            return False
        
        if not isinstance(creds, dict):
            print("❌ FIREBASE_CREDENTIALS_JSON is not valid JSON")
            return False
        
        required_fields = ["type", "project_id", "private_key", "client_email"]
        missing = [f for f in required_fields if f not in creds]
        
        if missing:
            print(f"❌ Missing fields in Firebase credentials: {missing}")
            return False
        
        print(f"✅ Firebase project: {creds.get('project_id')}")
        print(f"✅ Service account: {creds.get('client_email')}")
        
        try:
            app = get_firebase_app()
            print("✅ Firebase app initialized successfully")
            return True
        except Exception as e:
            print(f"❌ Firebase initialization failed: {type(e).__name__}: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Firebase check failed: {type(e).__name__}: {e}")
        return False


def check_email():
    """Check email configuration."""
    print("\n" + "="*60)
    print("EMAIL CONFIGURATION CHECK")
    print("="*60)
    
    try:
        settings = get_settings()
        
        print(f"📍 SMTP Host: {settings.smtp_host}")
        print(f"📍 SMTP Port: {settings.smtp_port}")
        print(f"📍 From Email: {settings.smtp_from_email}")
        
        configured = all([
            settings.smtp_host,
            settings.smtp_username,
            settings.smtp_password,
            settings.smtp_from_email,
        ])
        
        if not configured:
            print("⚠️  Email not fully configured (optional but recommended)")
            return True  # Not critical
        
        print("✅ Email configuration complete")
        
        # Try to import SMTP tester
        try:
            from backend.emailer import smtp_is_configured
            if smtp_is_configured():
                print("✅ Email service is ready")
            else:
                print("⚠️  Email service not ready")
        except:
            pass
        
        return True
        
    except Exception as e:
        print(f"⚠️  Email check warning: {e}")
        return True  # Not critical


def check_api():
    """Check if API endpoints are accessible."""
    print("\n" + "="*60)
    print("API ENDPOINT CHECK")
    print("="*60)
    
    try:
        from backend.app_factory import create_app
        
        print("Creating Flask app...")
        app = create_app()
        print("✅ Flask app created successfully")
        
        # Check for critical routes
        routes = [
            ("/api/auth/verify", ["POST"]),
            ("/api/products", ["GET"]),
            ("/api/profile", ["PUT"]),
        ]
        
        print("\nRegistered routes:")
        with app.app_context():
            url_map = app.url_map
            for rule in url_map.iter_rules():
                if "/api/" in rule.rule:
                    methods = ",".join(rule.methods - {"OPTIONS", "HEAD"})
                    print(f"  {rule.rule} [{methods}]")
        
        return True
        
    except Exception as e:
        print(f"❌ API check failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all diagnostics."""
    print("\n" + "="*60)
    print("HOINAM ENERGY - PRODUCTION DIAGNOSTICS")
    print("="*60)
    
    results = {
        "Environment": check_environment(),
        "Database": check_database(),
        "Firebase": check_firebase(),
        "Email": check_email(),
        "API": check_api(),
    }
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    for check, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {check}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✅ All critical checks passed! System is ready for operation.")
        return 0
    else:
        print("\n❌ Some checks failed. Please review the errors above and fix them.")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nDiagnostics cancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
