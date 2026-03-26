# Hoinam Energy

Static HTML storefront plus a serverless Flask API for EcoFlow sales, Paystack-backed checkout, Firebase authentication, and Neon PostgreSQL storage.

## Stack

- Frontend: pure HTML, CSS, and vanilla JavaScript
- Backend: Flask deployed from `api/index.py`
- Auth: Firebase Authentication
- Database: Neon PostgreSQL via SQLAlchemy
- Payments: Paystack transaction initialization + verification
- Inventory: Excel upload with `openpyxl`

## Project Structure

- `api/index.py`: serverless entrypoint
- `backend/`: Flask app factory, models, services, and integrations
- `assets/`: shared CSS and JavaScript
- `*.html`: static pages for the storefront, checkout, dashboard, booking, and admin

## Required Backend Environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `FIREBASE_CREDENTIALS_JSON`
- `PAYSTACK_SECRET_KEY`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `ADMIN_EMAILS`

Optional:

- `ALLOW_DEMO_PAYMENTS=true` for local demo checkout without a live Paystack secret

## Required Frontend Config

Edit [`assets/js/site-config.js`](/e:/ben%20files/hoinam-Energy/assets/js/site-config.js) and add your Firebase web app config:

- `apiKey`
- `authDomain`
- `projectId`
- `appId`
- `messagingSenderId`
- `storageBucket`

If you want phone OTP login, set:

- `enablePhoneAuth: true`

## Local Run

1. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Set the backend environment variables.
3. Update `assets/js/site-config.js` with Firebase client config.
4. Run Flask locally:

   ```bash
   python app.py
   ```

5. Open `http://127.0.0.1:5000/index.html` if you are serving the static files through Flask-compatible hosting, or serve the root directory with your preferred static server while keeping the API available at `/api`.

## Existing Neon Migration

If your Neon database already contains the older mixed-case shop tables, run:

```bash
python scripts/migrate_neon_schema.py
```

This migration:

- Backs up the old lowercase `users`, `products`, `orders`, and `installations` tables
- Recreates the lowercase schema expected by the current Flask app
- Imports the legacy `Products` catalog into the new `products` table

## Notes

- The initial EcoFlow inventory is seeded from the prompt and can be replaced with the admin Excel upload.
- Seed prices are starter catalog placeholders so checkout works end to end; replace them with your live commercial pricing before production launch.
- Admin access can come from a Firebase custom claim named `admin` or from matching an email in `ADMIN_EMAILS`.
