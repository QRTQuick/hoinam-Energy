# QUICK START - AFTER FIXES

## ⚡ 30-Second Setup

### 1. Verify `.env` File
```bash
# Check DATABASE_URL is correct (NOT typo)
grep "DATABASE_URL" .env

# Should show: postgresql+psycopg://... (NOT ppostgresql://)
```

### 2. Install & Run
```bash
# Install dependencies
pip install -r requirements.txt

# Run backend
python app.py

# You should see:
# * Running on http://localhost:5000
```

### 3. Test in Browser
```
http://localhost:5000/login.html
```

---

## 🔍 What's Fixed?

| Issue | Status | How to Verify |
|-------|--------|---------------|
| API 500 on auth | ✅ Fixed | Sign in works without 500 errors |
| Session won't sync | ✅ Fixed | Session persists after refresh |
| Missing videos | ✅ Fixed | Videos load or show poster image |
| Weird errors | ✅ Fixed | Console shows helpful error messages |

---

## 🚨 If Something Still Fails

### Option 1: Run Diagnostics
```bash
python scripts/diagnose.py
```

This will tell you exactly what's wrong.

### Option 2: Check the Logs
```bash
# Watch for errors
tail -f app.log

# Search for specific errors
grep "ERROR" app.log
```

### Option 3: Manual Check
```bash
# Test database
psql $DATABASE_URL -c "SELECT 1"

# Test auth
curl -X POST http://localhost:5000/api/auth/verify

# Check Firebase credentials are valid
python -c "from backend.firebase_auth import get_firebase_app; get_firebase_app()"
```

---

## 📋 One-Time Configuration

### Firebase Credentials (CRITICAL)
1. Go to Firebase Console → Your Project
2. Settings (⚙️) → Service Accounts
3. Generate New Private Key → Download JSON
4. Copy the JSON into `.env` as `FIREBASE_CREDENTIALS_JSON`

### Email Service (Optional but Recommended)
1. Get SMTP credentials from your email provider
2. Add to `.env`:
   ```
   SMTP_USERNAME=your_email@example.com
   SMTP_PASSWORD=your_app_password
   ```

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ No "Failed to load resource: 500" errors
- ✅ Log in works without errors  
- ✅ Session persists after page refresh
- ✅ Video page loads (video or poster)
- ✅ Console shows helpful API logs, not cryptic errors

---

## 🆘 Common Issues

### "Database connection refused"
```bash
# Fix: Check DATABASE_URL
grep DATABASE_URL .env

# Looks like: postgresql+psycopg://user:pass@host:5432/db
# NOT:         ppostgresql://... (typo)
```

### "Firebase credentials not configured"
```bash
# Fix: Add valid credentials to .env
# Get from Firebase Console → Service Accounts
```

### "api/auth/verify still 500"
```bash
# Check what the real error is:
tail -20 app.log

# Common causes:
# - DATABASE_URL is wrong
# - Firebase credentials are invalid
# - Database is not running
```

---

## 📞 Still Need Help?

1. **Check**: `python scripts/diagnose.py`
2. **Read**: `PRODUCTION_DEBUG_GUIDE.md`
3. **Review**: `IMPLEMENTATION_SUMMARY.md`
4. **Contact**: marketing@hoinamenergy.com

---

**Ready to go!** 🚀
