# HOINAM ENERGY - PRODUCTION DEBUGGING & DEPLOYMENT GUIDE

## ✅ Issues Fixed

### 1. **Authentication API Failure (500 Error)**
**Root Cause:** DATABASE_URL typo (`ppostgresql://`) prevented database connection

**Fixes Applied:**
- ✅ Fixed typo in `.env`: `postgresql+psycopg://` (correct format)
- ✅ Enhanced backend error logging with detailed exception tracking
- ✅ Improved `authenticate()` function with proper error context
- ✅ Added structured logging to Firebase credential validation
- ✅ Implemented comprehensive error messages in `firebase_auth.py`

**Files Modified:**
- `.env` - Fixed DATABASE_URL
- `backend/app_factory.py` - Enhanced error handling, added logging
- `backend/firebase_auth.py` - Added detailed error messages and logging

---

### 2. **Session Verification Failure**
**Root Cause:** Missing error boundaries and weak retry logic in API layer

**Fixes Applied:**
- ✅ Added retry logic with exponential backoff to `apiFetch()`
- ✅ Implemented graceful fallback in session sync error handling
- ✅ Distinguished between permanent errors (401, 400, 409) and transient errors
- ✅ Added intelligent cache usage when API fails
- ✅ Implemented detailed API logging for debugging

**Files Modified:**
- `assets/js/api.js` - Enhanced error handling, added retries
- `assets/js/app-shell.js` - Better error boundaries and recovery logic

---

### 3. **Missing Background Video**
**Root Cause:** Video file exists but may fail loading in production; no graceful fallback

**Fixes Applied:**
- ✅ Created `video-fallback.js` to handle video load failures gracefully
- ✅ Automatic fallback to poster image if video fails
- ✅ Added error event handlers for video and source elements
- ✅ Enhanced CSS fallback styling in `styles.css`

**Files Modified:**
- `assets/js/video-fallback.js` - NEW: Video error handling
- `products.html` - Added video-fallback script
- `login.html` - Added video-fallback script
- `assets/css/styles.css` - Added fallback styling

---

### 4. **Frontend Asset & CDN Issues**
**Root Cause:** Third-party CDN tracking prevention warnings

**Fixes Applied:**
- ✅ Font Awesome CDN warning is non-critical (assets still load via fallback)
- ✅ No functional impact - CSS loading continues despite warning
- ✅ Future improvement: Self-host Font Awesome for full independence

---

## 📋 ENVIRONMENT CONFIGURATION CHECKLIST

### Critical Variables Required
```env
# DATABASE (REQUIRED)
DATABASE_URL=postgresql+psycopg://user:password@host:port/dbname

# FIREBASE (REQUIRED for authentication)
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}

# EMAIL (Recommended)
SMTP_HOST=smtp-relay.brevo.com
SMTP_USERNAME=your_email@example.com
SMTP_PASSWORD=your_api_key
SMTP_FROM_EMAIL=marketing@hoinamenergy.com

# PAYMENT GATEWAY (Optional)
OPAY_ACCOUNT_NUMBER=...
BANK_TRANSFER_ACCOUNT_NUMBER=...

# APPLICATION
DEFAULT_CURRENCY=NGN
CORS_ORIGINS=*
ENV=development|production
```

### Getting Firebase Service Account Credentials
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `hoinam-energy-workspace`
3. ⚙️ Settings → Service Accounts tab
4. Click "Generate New Private Key"
5. Download JSON file and copy entire content to `FIREBASE_CREDENTIALS_JSON`

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Verify `.env` file exists with all required variables
- [ ] Test Firebase credentials by running backend
- [ ] Verify database connectivity: `psql $DATABASE_URL -c "SELECT 1"`
- [ ] Check API logs for errors: `tail -f flask.log`
- [ ] Test authentication: POST `/api/auth/verify` with valid token
- [ ] Test session sync in browser DevTools
- [ ] Verify video loads or falls back to poster image

### Deployment Commands
```bash
# Install dependencies
pip install -r requirements.txt

# Run database migrations
python -m flask db upgrade

# Start backend server
python app.py

# Or with gunicorn (production)
gunicorn -w 4 -b 0.0.0.0:5000 api.index:app
```

### Post-Deployment Verification
```bash
# Test API endpoint
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Check logs
tail -100 /var/log/hoinam-energy/backend.log

# Monitor database
psql $DATABASE_URL -c "SELECT COUNT(*) as users FROM user_account"
```

---

## 🐛 DEBUGGING GUIDE

### 1. Authentication 500 Error
**Symptoms:**  `api/auth/verify` returns 500

**Debug Steps:**
```bash
# Check backend logs
tail -f flask.log | grep "auth"

# Verify Firebase credentials
python -c "from backend.config import get_settings; print(get_settings().firebase_credentials())"

# Test token verification
python -c "from backend.firebase_auth import verify_id_token; verify_id_token('YOUR_TOKEN')"
```

**Common Issues:**
| Issue | Fix |
|-------|-----|
| `Firebase credentials are not configured` | Add valid JSON to `FIREBASE_CREDENTIALS_JSON` |
| `DATABASE_URL is required` | Check DATABASE_URL in `.env` |
| `connection refused` | Database server not running, check host/port |
| `invalid token` | Token expired or malformed, user must re-login |

---

### 2. Session Sync Fails
**Symptoms:** Session won't load, blank page or redirect to login

**Debug Steps:**
1. Open DevTools → Console tab
2. Check for error messages
3. Look for API Error logs: `[API Error]`
4. Check Network tab → `/api/auth/verify` request
5. Review response status and payload

**Expected Behavior:**
- If 401: User needs to sign in
- If 500: Backend error (check logs)
- If network error: Retry logic kicks in, uses cached profile
- If success: Profile loads, session established

---

### 3. Video Not Loading
**Symptoms:** No background video on login/products page

**Debug Steps:**
1. Open DevTools → Network tab
2. Filter: `solar-bg.webm`
3. Check if file is requested: YES → Server issue, NO → Path issue
4. Check poster image loads (fallback)
5. Console should show: `[Video failed to load]` or `Loading video: ...`

**Expected Behavior:**
- Video loads and plays
- If video fails: Poster image shows as background
- Page remains fully functional either way

---

### 4. API Error Logging
**Where to Find Errors:**

**Backend Logs:**
```bash
# Application logs
tail -f app.log

# Search for authentication errors
grep "Unable to verify" app.log

# Search for database errors
grep "DATABASE" app.log

# All API errors
grep "\[API Error\]" app.log
```

**Browser Console:**
```bash
# Open DevTools → Console
# Filter: API Debug, API Warning, API Error
# Shows: method, path, status, payload
```

---

## 📊 MONITORING & PERFORMANCE

### Recommended Monitoring
```python
# Enable detailed logging in production
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('hoinam-energy.log'),
        logging.StreamHandler()
    ]
)
```

### Key Metrics to Monitor
- `api/auth/verify` response time (target: <100ms)
- Database connection pool health
- Failed authentication attempts
- Video load failures
- API error rate (target: <0.1%)

---

## 🔒 SECURITY BEST PRACTICES

1. **Never commit `.env` file** to version control
2. **Rotate Firebase credentials regularly** (quarterly)
3. **Use strong database passwords** (20+ characters)
4. **Enable HTTPS** on all production URLs
5. **Set `ENV=production`** in deployment
6. **Review error logs regularly** for suspicious patterns
7. **Monitor failed auth attempts** for brute force attacks
8. **Use environment-specific credentials** (dev != prod)

---

## 📝 TESTING CHECKLIST

### Manual Testing
- [ ] Sign up with new account
- [ ] Sign in with existing account
- [ ] Session persists after page refresh
- [ ] Sign out clears session
- [ ] Admin pages require admin role
- [ ] Videos load or fallback gracefully
- [ ] All API endpoints respond properly
- [ ] Error messages are user-friendly
- [ ] Mobile responsive design works
- [ ] Cross-browser compatibility verified

### API Testing
```bash
# Test authentication flow
TOKEN=$(curl -s https://www.hoinamenergy.com/api/auth/verify | jq -r .data.token)
curl -X POST https://www.hoinamenergy.com/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"

# Test products endpoint
curl https://www.hoinamenergy.com/api/products

# Test profile endpoint (requires auth)
curl -X PUT https://www.hoinamenergy.com/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone":"08140103819"}'
```

---

## 🆘 SUPPORT & CONTACT

For production issues:
1. Check logs: `tail -f app.log`
2. Verify .env configuration
3. Run diagnostics script (if available)
4. Contact: marketing@hoinamenergy.com

---

## 📌 VERSION INFO

- **Last Updated:** June 3, 2026
- **Backend:** Python/Flask
- **Frontend:** JavaScript/ES Modules
- **Database:** PostgreSQL via Neon
- **Authentication:** Firebase Admin SDK

