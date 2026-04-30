from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from sqlalchemy import desc, func
from sqlalchemy.orm import joinedload

from .config import get_settings
from .database import check_database_url, close_session, get_session, init_database
from .emailer import (
    build_order_notification_message,
    build_order_approved_message,
    build_subscription_confirmation_message,
    build_new_post_notification_message,
    build_feedback_notification_message,
    build_feedback_acknowledgement_message,
    send_message_via_smtp,
    smtp_is_configured,
)
from email.message import EmailMessage
from .firebase_auth import verify_id_token
from .inventory import parse_stock_inventory
from .models import Installation, Order, Payment, Product, User, BlogPost, BlogSubscriber, Feedback
from .seed import seed_products
from .services import (
    apply_product_payload,
    calculate_order_items,
    flag_duplicate_full_name_users,
    sync_user_from_claims,
)
from .stores import get_all_stores, get_store_by_slug
from .utils import (
    generate_order_number,
    generate_payment_reference,
    generate_verification_code,
    generate_unsubscribe_token,
    resolve_product_image_url,
    slugify,
    to_decimal,
)


class ApiError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def create_app() -> Flask:
    settings = get_settings()
    app = Flask(__name__)
    project_root = Path(__file__).resolve().parents[1]
    CORS(
        app,
        resources={r"/api/*": {"origins": settings.cors_origins or "*"}},
        supports_credentials=True,
    )

    # ── Database initialisation ───────────────────────────────────────────────
    # Run once at app-creation time so the first real request isn't delayed by
    # table creation, schema migrations, and product seeding.
    try:
        check_database_url()
        init_database()
        _seed_session = get_session()
        try:
            seed_products(_seed_session)
            _seed_session.commit()
        except Exception:
            _seed_session.rollback()
            raise
        finally:
            close_session()
    except Exception as _init_err:
        app.logger.warning("DB init at startup failed (%s) — will retry on first request.", _init_err)

    _db_initialized = True  # mark done so before_request skips it

    def route_needs_database(path: str) -> bool:
        if not path.startswith("/api/"):
            return False
        database_optional_paths = {
            "/api/health",
            "/api/stores",
            "/api/payment-options",
        }
        if path in database_optional_paths:
            return False
        if path.startswith("/api/stores/"):
            return False
        return True

    def ensure_db_initialized():
        # No-op — init already ran above. Kept for safety in case startup failed.
        pass

    @app.before_request
    def attach_session():
        if route_needs_database(request.path):
            ensure_db_initialized()
            g.db = get_session()

    @app.teardown_request
    def teardown_request(exc):
        if hasattr(g, "db"):
            if exc is not None:
                g.db.rollback()
            close_session()

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        return jsonify({"success": False, "message": error.message}), error.status_code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        if request.path.startswith("/api/"):
            return jsonify({"success": False, "message": str(error)}), 500
        raise error

    def db_session():
        return g.db

    def json_success(data=None, status_code: int = 200, message: str | None = None):
        payload = {"success": True}
        if message:
            payload["message"] = message
        if data is not None:
            payload["data"] = data
        return jsonify(payload), status_code

    def authenticate(*, required: bool = True, admin: bool = False):
        auth_header = request.headers.get("Authorization", "").strip()
        token = None
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        elif request.is_json:
            token = (request.get_json(silent=True) or {}).get("idToken")

        if not token:
            if required:
                raise ApiError("Authentication token is required.", 401)
            return None

        try:
            claims = verify_id_token(token)
        except Exception as exc:
            raise ApiError(f"Unable to verify Firebase token: {exc}", 401) from exc

        try:
            user = sync_user_from_claims(db_session(), claims)
        except ValueError as exc:
            raise ApiError(str(exc), 409) from exc
        g.current_user = user

        if admin and user.role != "admin":
            raise ApiError("Admin access is required.", 403)

        return user

    def serialize_installation(installation: Installation) -> dict:
        payload = installation.to_dict()
        payload["user"] = installation.user.to_dict() if installation.user else None
        payload["product"] = (
            installation.product.to_dict() if installation.product else None
        )
        return payload

    def parse_inventory_file(file_storage) -> list[dict]:
        rows = parse_stock_inventory(file_storage.stream)
        if not rows:
            raise ApiError(
                "The uploaded workbook is empty or does not match the stock inventory layout.",
                400,
            )
        return rows

    def find_existing_inventory_product(
        row: dict, product_sku: str, product_slug: str, legacy_slug: str | None
    ):
        reference_text = (row.get("reference") or "").strip()
        session = db_session()

        exact_conditions = [
            Product.sku == product_sku,
            Product.slug == product_slug,
            Product.name == row["name"],
        ]
        if legacy_slug:
            exact_conditions.append(Product.slug == legacy_slug)

        for condition in exact_conditions:
            product = session.query(Product).filter(condition).first()
            if product is not None:
                return product

        if legacy_slug:
            product = (
                session.query(Product)
                .filter(Product.slug.endswith(f"-{legacy_slug}"))
                .first()
            )
            if product is not None:
                return product

        if reference_text:
            product = (
                session.query(Product)
                .filter(Product.name.endswith(f" {reference_text}"))
                .first()
            )
            if product is not None:
                return product

        return None

    @app.get("/api/health")
    def health_check():
        return json_success({"status": "ok"})

    @app.get("/api/debug/smtp-config")
    def debug_smtp_config():
        """Check SMTP configuration (admin only)."""
        user = authenticate()
        if user.role != "admin":
            raise ApiError("Admin access required.", 403)

        return json_success(
            {
                "smtp_configured": smtp_is_configured(settings),
                "smtp_host": settings.smtp_host,
                "smtp_port": settings.smtp_port,
                "smtp_username": (
                    settings.smtp_username[:10] + "***"
                    if settings.smtp_username
                    else None
                ),
                "smtp_password": "***" if settings.smtp_password else None,
                "smtp_from_email": settings.smtp_from_email,
                "smtp_use_tls": settings.smtp_use_tls,
                "smtp_timeout_seconds": settings.smtp_timeout_seconds,
                "order_notification_email": settings.order_notification_email,
            }
        )

    @app.post("/api/debug/send-test-email")
    def send_test_email():
        """Send a test email (admin only). Pass {"to": "email@example.com"} to override recipient."""
        user = authenticate()
        if user.role != "admin":
            raise ApiError("Admin access required.", 403)

        if not smtp_is_configured(settings):
            raise ApiError(
                "SMTP is not configured. Check your environment variables.", 400
            )

        payload = request.get_json(silent=True) or {}
        recipient = (payload.get("to") or "").strip() or settings.order_notification_email

        try:
            test_message = EmailMessage()
            test_message["Subject"] = "[TEST] Hoinam Energy SMTP Test"
            test_message["From"] = settings.smtp_from_email or settings.smtp_username
            test_message["To"] = recipient
            test_message.set_content(
                f"SMTP test email from Hoinam Energy.\n\n"
                f"Sent at: {datetime.now(timezone.utc).isoformat()}\n"
                f"From: {settings.smtp_from_email or settings.smtp_username}\n"
                f"To: {recipient}\n\n"
                f"If you received this, SMTP is working correctly."
            )
            send_message_via_smtp(settings, test_message)
            return json_success(
                {"message": f"Test email sent to {recipient}"}
            )
        except Exception as e:
            app.logger.exception("Test email failed")
            raise ApiError(f"Failed to send test email: {str(e)}", 500)

    @app.post("/api/auth/verify")
    def verify_auth():
        user = authenticate()
        return json_success(user.to_dict())

    @app.put("/api/profile")
    def update_profile():
        user = authenticate()
        payload = request.get_json(silent=True) or {}

        if "phone" in payload:
            phone = (payload.get("phone") or "").strip()
            if not phone:
                raise ApiError("Phone number is required.", 400)
            user.phone = phone

        if "full_name" in payload:
            full_name = (payload.get("full_name") or "").strip()
            if full_name:
                user.full_name = full_name

        flag_duplicate_full_name_users(db_session(), user)
        db_session().commit()
        return json_success(user.to_dict())

    @app.get("/api/stores")
    def list_stores():
        stores = get_all_stores()
        return json_success([store.to_dict() for store in stores])

    @app.get("/api/stores/<store_slug>")
    def get_store(store_slug: str):
        store = get_store_by_slug(store_slug)
        if not store:
            raise ApiError("Store not found.", 404)
        return json_success(store.to_dict())

    @app.get("/api/products")
    def list_products():
        # Support filtering by store
        store_slug = request.args.get("store", "").strip()

        query = db_session().query(Product).filter(Product.active.is_(True))

        if store_slug:
            query = query.filter(Product.store_slug == store_slug)

        products = query.order_by(desc(Product.featured), Product.name.asc()).all()
        return json_success([product.to_dict() for product in products])

    @app.get("/api/products/<int:product_id>")
    def get_product(product_id: int):
        product = db_session().query(Product).filter(Product.id == product_id).first()
        if not product or not product.active:
            raise ApiError("Product not found.", 404)
        return json_success(product.to_dict())

    @app.post("/api/products")
    def create_product():
        authenticate(admin=True)
        payload = request.get_json(silent=True) or {}
        product = Product()
        apply_product_payload(product, payload)
        db_session().add(product)
        db_session().commit()
        return json_success(product.to_dict(), status_code=201)

    @app.put("/api/products")
    @app.put("/api/products/<int:product_id>")
    def update_product(product_id: int | None = None):
        authenticate(admin=True)
        payload = request.get_json(silent=True) or {}
        target_id = product_id or payload.get("id")
        if not target_id:
            raise ApiError("Product id is required.", 400)
        product = db_session().query(Product).filter(Product.id == target_id).first()
        if not product:
            raise ApiError("Product not found.", 404)
        apply_product_payload(product, payload)
        db_session().commit()
        return json_success(product.to_dict())

    @app.delete("/api/products/<int:product_id>")
    def delete_product(product_id: int):
        authenticate(admin=True)
        product = db_session().query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ApiError("Product not found.", 404)
        product.active = False
        db_session().commit()
        return json_success({"id": product_id}, message="Product archived.")

    def payment_options_payload() -> dict:
        return {
            "methods": [
                {
                    "id": "bank_transfer",
                    "kind": "transfer",
                    "label": "Transfer before delivery",
                    "description": "Place the order now, then pay by direct bank transfer to the Hoinam Energy company account. You'll receive a verification code to include in the transfer narration.",
                    "bank_name": settings.bank_transfer_bank_name,
                    "account_number": settings.bank_transfer_account_number,
                    "account_name": settings.bank_transfer_account_name,
                },
                {
                    "id": "pay_on_delivery",
                    "kind": "delivery",
                    "label": "Pay on delivery",
                    "description": "Reserve the order and pay when Hoinam Energy confirms delivery.",
                },
            ],
            "unavailable": [
                {
                    "id": "opay_transfer",
                    "label": "OPay merchant",
                    "reason": "Under maintenance — coming soon.",
                },
            ],
        }

    def payment_option_by_id(payment_method: str) -> dict | None:
        methods = payment_options_payload().get("methods") or []
        for option in methods:
            if option.get("id") == payment_method:
                return option
        return None

    def payment_details_payload(payment_method: str) -> dict:
        option = payment_option_by_id(payment_method)
        if option is None:
            return {
                "id": payment_method,
                "kind": (
                    "transfer" if payment_method != "pay_on_delivery" else "delivery"
                ),
                "label": payment_method.replace("_", " ").title(),
            }

        payload = {
            "id": option["id"],
            "kind": option.get("kind")
            or ("transfer" if option["id"] != "pay_on_delivery" else "delivery"),
            "label": option.get("label"),
            "description": option.get("description"),
        }

        if payload["kind"] == "transfer":
            payload.update(
                {
                    "bank_name": option.get("bank_name"),
                    "account_number": option.get("account_number"),
                    "account_name": option.get("account_name"),
                }
            )

        return payload

    @app.get("/api/payment-options")
    def payment_options_route():
        return json_success(payment_options_payload())

    @app.post("/api/orders")
    def create_order():
        user = authenticate()
        payload = request.get_json(silent=True) or {}
        payment_method = (payload.get("payment_method") or "bank_transfer").strip()
        allowed_payment_methods = {"bank_transfer", "pay_on_delivery"}
        if payment_method not in allowed_payment_methods:
            raise ApiError(
                "Choose transfer before delivery or pay on delivery.", 400
            )

        payment_reference = (
            payload.get("payment_reference") or ""
        ).strip() or generate_payment_reference(
            "BANK" if payment_method == "bank_transfer" else "POD"
        )
        existing_order = (
            db_session()
            .query(Order)
            .filter(Order.payment_reference == payment_reference)
            .first()
        )
        if existing_order:
            return json_success(existing_order.to_dict())

        shipping_address = payload.get("shipping_address") or {}
        required_fields = ["full_name", "phone", "address", "city", "state"]
        missing_fields = [
            field for field in required_fields if not shipping_address.get(field)
        ]
        if missing_fields:
            raise ApiError(
                f"Missing shipping fields: {', '.join(missing_fields)}.", 400
            )

        normalized_items, total, locked_products = calculate_order_items(
            db_session(), payload.get("items") or [], lock_products=True
        )

        for item in normalized_items:
            product = locked_products[item["product_id"]]
            if product.stock > 0 and product.stock < item["quantity"]:
                raise ApiError(
                    f"{product.name} is no longer available in that quantity.", 409
                )
            if product.stock > 0:
                product.stock -= item["quantity"]

        payment_status = (
            "awaiting_transfer"
            if payment_method == "bank_transfer"
            else "pay_on_delivery"
        )
        order_status = (
            "payment_pending"
            if payment_method == "bank_transfer"
            else "confirmed"
        )
        order = Order(
            order_number=generate_order_number(),
            user_id=user.id,
            status=order_status,
            payment_status=payment_status,
            payment_method=payment_method,
            payment_reference=payment_reference,
            payment_details=payment_details_payload(payment_method),
            total_amount=to_decimal(total),
            currency=settings.default_currency,
            shipping_address=shipping_address,
            notes=payload.get("notes"),
            items=normalized_items,
        )
        db_session().add(order)
        db_session().flush()

        # Generate verification code for bank transfers
        verification_code = None
        if payment_method == "bank_transfer":
            verification_code = generate_verification_code()
            payment = Payment(
                order_id=order.id,
                verification_code=verification_code,
                amount=to_decimal(total),
                currency=settings.default_currency,
                payment_method=payment_method,
                status="pending",
            )
            db_session().add(payment)
            # Store verification code in payment_details so dashboard can access it
            details = dict(order.payment_details or {})
            details["verification_code"] = verification_code
            order.payment_details = details

        db_session().commit()

        if smtp_is_configured(settings):
            try:
                message = build_order_notification_message(
                    settings=settings,
                    user=user,
                    order=order,
                    shipping_address=shipping_address,
                    verification_code=verification_code,
                )
                send_message_via_smtp(settings, message)
            except Exception:
                app.logger.exception(
                    "Order %s was created but the notification email could not be sent.",
                    order.order_number,
                )
        else:
            app.logger.warning(
                "SMTP is not configured, so no order notification email was sent for %s.",
                order.order_number,
            )

        order_payload = order.to_dict()
        order_payload["payment_options"] = payment_options_payload()
        if verification_code:
            order_payload["verification_code"] = verification_code
        return json_success(order_payload, status_code=201)

    @app.get("/api/orders/user")
    def get_user_orders():
        user = authenticate()
        orders = (
            db_session()
            .query(Order)
            .filter(Order.user_id == user.id)
            .order_by(Order.created_at.desc())
            .all()
        )
        return json_success([order.to_dict() for order in orders])

    @app.get("/api/orders")
    def get_all_orders():
        authenticate(admin=True)
        orders = (
            db_session()
            .query(Order)
            .options(joinedload(Order.user))
            .order_by(Order.created_at.desc())
            .all()
        )
        payload = []
        for order in orders:
            data = order.to_dict()
            data["user"] = order.user.to_dict() if order.user else None
            payload.append(data)
        return json_success(payload)

    @app.post("/api/payments/<verification_code>/receipt")
    def upload_payment_receipt(verification_code: str):
        user = authenticate()

        # Find the payment by verification code
        payment = (
            db_session()
            .query(Payment)
            .filter(Payment.verification_code == verification_code)
            .first()
        )
        if not payment:
            raise ApiError("Payment verification code not found.", 404)

        # Verify the order belongs to the authenticated user
        order = payment.order
        if order.user_id != user.id:
            raise ApiError(
                "You don't have permission to upload receipt for this payment.", 403
            )

        file_storage = request.files.get("receipt")
        if not file_storage:
            raise ApiError("Please attach a receipt file.", 400)

        # Handle different receipt formats (image or PDF)
        allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".gif"}
        file_extension = Path(file_storage.filename).suffix.lower()
        if file_extension not in allowed_extensions:
            raise ApiError("Allowed formats: PDF, PNG, JPG, JPEG, GIF", 400)

        # Store receipt URL or file path
        receipt_filename = f"receipt_{verification_code}_{file_storage.filename}"
        receipt_path = project_root / "receipts" / receipt_filename
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        file_storage.save(receipt_path)

        from datetime import datetime as dt

        payment.receipt_url = f"/receipts/{receipt_filename}"
        payment.receipt_uploaded_at = dt.now(timezone.utc)
        payment.status = "receipt_uploaded"
        order.payment_status = "receipt_uploaded"
        order.status = "payment_pending"
        db_session().commit()

        # Notify admin that a receipt was uploaded and needs review
        if smtp_is_configured(settings):
            try:
                from email.message import EmailMessage as _EM
                admin_msg = _EM()
                admin_msg["Subject"] = f"Receipt uploaded for order {order.order_number} — needs review"
                admin_msg["From"] = settings.smtp_from_email or settings.smtp_username
                admin_msg["To"] = settings.order_notification_email
                admin_msg.set_content(
                    f"A customer has uploaded a payment receipt for order {order.order_number}.\n\n"
                    f"Order ID: {order.id}\n"
                    f"Order number: {order.order_number}\n"
                    f"Payment reference: {order.payment_reference}\n"
                    f"Total: {float(order.total_amount):,.2f} {order.currency}\n"
                    f"Verification code: {payment.verification_code}\n\n"
                    f"Please review and approve the order in the admin panel."
                )
                send_message_via_smtp(settings, admin_msg)
            except Exception:
                app.logger.exception(
                    "Receipt uploaded for %s but admin notification email failed.",
                    order.order_number,
                )

        return json_success(payment.to_dict(), message="Receipt uploaded. Hoinam Energy will verify and approve your order within 40 minutes.")

    @app.post("/api/installations")
    def create_installation():
        user = authenticate()
        payload = request.get_json(silent=True) or {}
        address = (payload.get("address") or "").strip()
        if not address:
            raise ApiError("Installation address is required.", 400)

        preferred_date = payload.get("preferred_date")
        installation = Installation(
            user_id=user.id,
            product_id=payload.get("product_id"),
            preferred_date=(
                date.fromisoformat(preferred_date) if preferred_date else None
            ),
            service_type=payload.get("service_type") or "Solar Installation",
            address=address,
            city=payload.get("city"),
            state=payload.get("state"),
            phone=payload.get("phone") or user.phone,
            notes=payload.get("notes"),
            status="pending",
        )
        db_session().add(installation)
        db_session().commit()
        return json_success(installation.to_dict(), status_code=201)

    @app.get("/api/installations/user")
    def get_user_installations():
        user = authenticate()
        installations = (
            db_session()
            .query(Installation)
            .filter(Installation.user_id == user.id)
            .order_by(Installation.created_at.desc())
            .all()
        )
        return json_success([serialize_installation(item) for item in installations])

    @app.get("/api/installations")
    def get_all_installations():
        authenticate(admin=True)
        installations = (
            db_session()
            .query(Installation)
            .options(joinedload(Installation.user), joinedload(Installation.product))
            .order_by(Installation.created_at.desc())
            .all()
        )
        return json_success([serialize_installation(item) for item in installations])

    @app.put("/api/installations/<int:installation_id>")
    def update_installation(installation_id: int):
        authenticate(admin=True)
        installation = (
            db_session()
            .query(Installation)
            .filter(Installation.id == installation_id)
            .first()
        )
        if not installation:
            raise ApiError("Installation request not found.", 404)

        payload = request.get_json(silent=True) or {}
        if "status" in payload:
            installation.status = payload["status"]
        if "assigned_to" in payload:
            installation.assigned_to = payload["assigned_to"]
        if "preferred_date" in payload and payload["preferred_date"]:
            installation.preferred_date = date.fromisoformat(payload["preferred_date"])
        db_session().commit()
        return json_success(serialize_installation(installation))

    @app.get("/api/users")
    def list_users():
        authenticate(admin=True)
        users = db_session().query(User).order_by(User.created_at.desc()).all()
        return json_success([user.to_dict() for user in users])

    def _notify_subscribers_of_new_post(post: BlogPost) -> None:
        """Email all active subscribers about a newly published blog post."""
        if not smtp_is_configured(settings):
            app.logger.warning("SMTP not configured — skipping subscriber notifications for %s.", post.slug)
            return

        subscribers = (
            db_session()
            .query(BlogSubscriber)
            .filter(BlogSubscriber.is_active.is_(True))
            .all()
        )
        if not subscribers:
            return

        post_url = f"{settings.frontend_url}/blog-post.html?slug={post.slug}"
        sent = 0
        failed = 0
        for subscriber in subscribers:
            try:
                msg = build_new_post_notification_message(
                    settings=settings,
                    subscriber_email=subscriber.email,
                    subscriber_name=subscriber.name,
                    post_title=post.title,
                    post_excerpt=post.excerpt or "",
                    post_url=post_url,
                    unsubscribe_token=subscriber.unsubscribe_token,
                    frontend_url=settings.frontend_url,
                )
                send_message_via_smtp(settings, msg)
                sent += 1
            except Exception:
                app.logger.exception(
                    "Failed to send new-post notification to %s for post %s.",
                    subscriber.email,
                    post.slug,
                )
                failed += 1

        app.logger.info(
            "New-post notifications for '%s': %d sent, %d failed.",
            post.title,
            sent,
            failed,
        )

    @app.get("/api/blog")
    def list_blog_posts():
        """Get all published blog posts (public)."""
        posts = (
            db_session()
            .query(BlogPost)
            .filter(BlogPost.is_published.is_(True))
            .order_by(BlogPost.published_at.desc())
            .all()
        )
        return json_success([post.to_dict() for post in posts])

    @app.get("/api/blog/<post_slug>")
    def get_blog_post(post_slug: str):
        """Get a single blog post by slug.
        Published posts are public. Draft posts are visible to admins only.
        """
        post = (
            db_session()
            .query(BlogPost)
            .filter(BlogPost.slug == post_slug)
            .first()
        )
        if not post:
            raise ApiError("Blog post not found.", 404)

        if not post.is_published:
            # Allow admins to preview drafts; everyone else gets a clear message
            user = authenticate(required=False)
            if not user or user.role != "admin":
                raise ApiError(
                    "This post is not published yet. If you're the admin, log in to preview it.",
                    404,
                )

        return json_success(post.to_dict())

    @app.get("/api/admin/blog")
    def list_admin_blog_posts():
        """Get all blog posts for admin (published and drafts)."""
        authenticate(admin=True)
        posts = (
            db_session()
            .query(BlogPost)
            .order_by(BlogPost.created_at.desc())
            .all()
        )
        return json_success([post.to_dict() for post in posts])

    @app.post("/api/admin/blog")
    def create_blog_post():
        """Create a new blog post (admin only)."""
        user = authenticate(admin=True)
        payload = request.get_json(silent=True) or {}

        title = (payload.get("title") or "").strip()
        if not title:
            raise ApiError("Blog post title is required.", 400)

        slug = (payload.get("slug") or "").strip() or slugify(title)
        excerpt = (payload.get("excerpt") or "").strip()
        content = (payload.get("content") or "").strip()
        if not content:
            raise ApiError("Blog post content is required.", 400)

        # Check for duplicate slug
        existing = db_session().query(BlogPost).filter(BlogPost.slug == slug).first()
        if existing:
            raise ApiError("A blog post with this slug already exists.", 409)

        post = BlogPost(
            title=title,
            slug=slug,
            excerpt=excerpt or title,
            content=content,
            image_url=payload.get("image_url"),
            author_id=user.id,
            is_published=payload.get("is_published", False),
            published_at=datetime.now(timezone.utc) if payload.get("is_published") else None,
            category=payload.get("category", "News"),
            tags=payload.get("tags", []),
        )
        db_session().add(post)
        db_session().commit()

        if post.is_published:
            try:
                _notify_subscribers_of_new_post(post)
            except Exception:
                app.logger.exception("Subscriber notification failed for new post %s.", post.slug)

        return json_success(post.to_dict(), status_code=201, message="Blog post created.")

    @app.put("/api/admin/blog/<int:post_id>")
    def update_blog_post(post_id: int):
        """Update a blog post (admin only)."""
        user = authenticate(admin=True)
        payload = request.get_json(silent=True) or {}

        post = db_session().query(BlogPost).filter(BlogPost.id == post_id).first()
        if not post:
            raise ApiError("Blog post not found.", 404)

        if "title" in payload:
            post.title = (payload.get("title") or "").strip() or post.title
        if "slug" in payload:
            slug = (payload.get("slug") or "").strip()
            if slug and slug != post.slug:
                existing = (
                    db_session()
                    .query(BlogPost)
                    .filter(BlogPost.slug == slug, BlogPost.id != post_id)
                    .first()
                )
                if existing:
                    raise ApiError("A blog post with this slug already exists.", 409)
                post.slug = slug
        if "excerpt" in payload:
            post.excerpt = (payload.get("excerpt") or "").strip() or post.excerpt
        if "content" in payload:
            post.content = (payload.get("content") or "").strip() or post.content
        if "image_url" in payload:
            post.image_url = payload.get("image_url")
        if "category" in payload:
            post.category = payload.get("category", "News")
        if "tags" in payload:
            post.tags = payload.get("tags", [])

        # Handle publish/unpublish — track transition before mutating
        just_published = False
        if "is_published" in payload:
            was_published = post.is_published
            post.is_published = bool(payload.get("is_published"))
            if post.is_published and not was_published:
                post.published_at = datetime.now(timezone.utc)
                just_published = True
            elif not post.is_published:
                post.published_at = None

        db_session().commit()

        if just_published:
            try:
                _notify_subscribers_of_new_post(post)
            except Exception:
                app.logger.exception("Subscriber notification failed for post %s.", post.slug)

        return json_success(post.to_dict(), message="Blog post updated.")

    @app.delete("/api/admin/blog/<int:post_id>")
    def delete_blog_post(post_id: int):
        """Delete a blog post (admin only)."""
        authenticate(admin=True)
        post = db_session().query(BlogPost).filter(BlogPost.id == post_id).first()
        if not post:
            raise ApiError("Blog post not found.", 404)
        db_session().delete(post)
        db_session().commit()
        return json_success({"id": post_id}, message="Blog post deleted.")

    # ── Blog subscriptions ────────────────────────────────────────────────────

    @app.post("/api/blog/subscribe")
    def blog_subscribe():
        """Subscribe an email address to blog post notifications."""
        payload = request.get_json(silent=True) or {}
        email = (payload.get("email") or "").strip().lower()
        name = (payload.get("name") or "").strip() or None
        if not email or "@" not in email:
            raise ApiError("A valid email address is required.", 400)

        existing = (
            db_session()
            .query(BlogSubscriber)
            .filter(BlogSubscriber.email == email)
            .first()
        )
        if existing:
            if existing.is_active:
                return json_success(
                    existing.to_dict(),
                    message="You're already subscribed.",
                )
            # Re-activate a previously unsubscribed address
            existing.is_active = True
            existing.name = name or existing.name
            db_session().commit()
            subscriber = existing
        else:
            subscriber = BlogSubscriber(
                email=email,
                name=name,
                is_active=True,
                unsubscribe_token=generate_unsubscribe_token(),
            )
            db_session().add(subscriber)
            db_session().commit()

        if smtp_is_configured(settings):
            try:
                msg = build_subscription_confirmation_message(
                    settings=settings,
                    subscriber_email=subscriber.email,
                    subscriber_name=subscriber.name,
                    unsubscribe_token=subscriber.unsubscribe_token,
                    frontend_url=settings.frontend_url,
                )
                send_message_via_smtp(settings, msg)
            except Exception as email_err:
                app.logger.exception(
                    "Subscription confirmation email failed for %s.", email
                )
                # Return success for the subscription itself but flag the email issue
                return json_success(
                    subscriber.to_dict(),
                    status_code=201,
                    message=f"Subscribed! However, the confirmation email could not be sent ({email_err}). Your subscription is saved.",
                )
        else:
            app.logger.warning("SMTP not configured — no confirmation email sent for subscriber %s.", email)

        return json_success(
            subscriber.to_dict(),
            status_code=201,
            message="Subscribed! Check your inbox for a confirmation.",
        )

    @app.get("/api/blog/unsubscribe/<token>")
    def blog_unsubscribe(token: str):
        """Unsubscribe via token link."""
        subscriber = (
            db_session()
            .query(BlogSubscriber)
            .filter(BlogSubscriber.unsubscribe_token == token)
            .first()
        )
        if not subscriber:
            raise ApiError("Unsubscribe link not found or already used.", 404)
        subscriber.is_active = False
        db_session().commit()
        return json_success({"email": subscriber.email}, message="You've been unsubscribed.")

    @app.get("/api/admin/blog/subscribers")
    def list_blog_subscribers():
        """List all blog subscribers (admin only)."""
        authenticate(admin=True)
        subscribers = (
            db_session()
            .query(BlogSubscriber)
            .filter(BlogSubscriber.is_active.is_(True))
            .order_by(BlogSubscriber.created_at.desc())
            .all()
        )
        return json_success([s.to_dict() for s in subscribers])

    @app.get("/api/admin/stats")
    @app.get("/api/admin/stats")
    def admin_stats():
        authenticate(admin=True)

        # Revenue — confirmed orders only
        confirmed_revenue = db_session().query(
            func.coalesce(func.sum(Order.total_amount), 0)
        ).filter(Order.payment_status == "confirmed").scalar()

        # All-time revenue (including pending)
        total_revenue = db_session().query(
            func.coalesce(func.sum(Order.total_amount), 0)
        ).scalar()

        # Order counts by status
        orders_total = db_session().query(func.count(Order.id)).scalar()
        orders_pending = db_session().query(func.count(Order.id)).filter(
            Order.payment_status.in_(["awaiting_transfer", "receipt_uploaded"])
        ).scalar()
        orders_confirmed = db_session().query(func.count(Order.id)).filter(
            Order.payment_status == "confirmed"
        ).scalar()
        orders_pod = db_session().query(func.count(Order.id)).filter(
            Order.payment_method == "pay_on_delivery"
        ).scalar()

        # Receipts awaiting admin review
        receipts_pending = db_session().query(func.count(Payment.id)).filter(
            Payment.status == "receipt_uploaded"
        ).scalar()

        # Users
        users_total = db_session().query(func.count(User.id)).scalar()
        users_flagged = db_session().query(func.count(User.id)).filter(
            User.needs_monitoring.is_(True)
        ).scalar()

        # Products
        products_active = db_session().query(func.count(Product.id)).filter(
            Product.active.is_(True)
        ).scalar()
        products_low_stock = db_session().query(func.count(Product.id)).filter(
            Product.active.is_(True),
            Product.stock > 0,
            Product.stock <= 3,
        ).scalar()
        products_out_of_stock = db_session().query(func.count(Product.id)).filter(
            Product.active.is_(True),
            Product.stock == 0,
        ).scalar()

        # Installations
        installations_total = db_session().query(func.count(Installation.id)).scalar()
        installations_pending = db_session().query(func.count(Installation.id)).filter(
            Installation.status == "pending"
        ).scalar()

        # Blog
        blog_posts_published = db_session().query(func.count(BlogPost.id)).filter(
            BlogPost.is_published.is_(True)
        ).scalar()
        blog_subscribers = db_session().query(func.count(BlogSubscriber.id)).filter(
            BlogSubscriber.is_active.is_(True)
        ).scalar()

        # Feedback
        feedback_new = db_session().query(func.count(Feedback.id)).filter(
            Feedback.status == "new"
        ).scalar()
        feedback_total = db_session().query(func.count(Feedback.id)).scalar()

        payload = {
            # Revenue
            "revenue": float(confirmed_revenue or 0),
            "revenue_total": float(total_revenue or 0),
            "currency": settings.default_currency,
            # Orders
            "orders": orders_total,
            "orders_pending": orders_pending,
            "orders_confirmed": orders_confirmed,
            "orders_pod": orders_pod,
            "receipts_pending": receipts_pending,
            # Users
            "users": users_total,
            "users_flagged": users_flagged,
            # Products
            "products": products_active,
            "products_low_stock": products_low_stock,
            "products_out_of_stock": products_out_of_stock,
            # Installations
            "installations": installations_total,
            "installations_pending": installations_pending,
            # Blog
            "blog_posts": blog_posts_published,
            "blog_subscribers": blog_subscribers,
            # Feedback
            "feedback_new": feedback_new,
            "feedback_total": feedback_total,
        }
        return json_success(payload)

    @app.post("/api/admin/upload-inventory")
    def upload_inventory():
        authenticate(admin=True)
        file_storage = request.files.get("file")
        if not file_storage:
            raise ApiError("Please attach an Excel file.", 400)

        rows = parse_inventory_file(file_storage)
        if not rows:
            raise ApiError(
                "No inventory rows were found in the uploaded workbook.", 400
            )

        created = 0
        updated = 0
        for row in rows:
            product_slug = row.get("slug") or slugify(row["name"])
            product_sku = row.get("sku") or product_slug.upper().replace("-", "_")
            legacy_slug = row.get("legacy_slug")
            product = find_existing_inventory_product(
                row, product_sku, product_slug, legacy_slug
            )
            if product is None:
                product = Product(
                    name=row["name"],
                    slug=product_slug,
                    sku=product_sku,
                    brand=row.get("brand"),
                    store_slug=row.get("store_slug"),
                    category=row["category"],
                    summary=row["summary"],
                    description=row["description"],
                    price=to_decimal(row["price"]),
                    currency=settings.default_currency,
                    stock=row["stock"],
                    image_url=resolve_product_image_url(
                        row["name"], row["image_url"], product_slug
                    ),
                    active=True,
                )
                db_session().add(product)
                created += 1
            else:
                product.name = row["name"]
                product.slug = product_slug
                product.sku = product_sku
                product.brand = row.get("brand") or product.brand
                product.store_slug = row.get("store_slug") or product.store_slug
                product.stock = row["stock"]
                if row["price"]:
                    product.price = to_decimal(row["price"])
                product.category = row["category"] or product.category
                product.image_url = resolve_product_image_url(
                    row["name"],
                    row["image_url"] or product.image_url,
                    product.slug or product_slug,
                )
                product.summary = row["summary"] or product.summary
                product.description = row["description"] or product.description
                updated += 1

        db_session().commit()
        return json_success(
            {"created": created, "updated": updated},
            message="Inventory upload complete.",
        )

    @app.get("/api/admin/pending-deliveries")
    def get_pending_deliveries():
        """Get orders awaiting delivery confirmation (admin only)."""
        authenticate(admin=True)
        pending_orders = (
            db_session()
            .query(Order)
            .filter(Order.status.in_(["payment_pending", "confirmed"]))
            .options(joinedload(Order.user))
            .order_by(Order.created_at.asc())
            .all()
        )
        payload = []
        for order in pending_orders:
            data = order.to_dict()
            data["user"] = order.user.to_dict() if order.user else None
            payload.append(data)
        return json_success(payload)

    @app.post("/api/admin/orders/<int:order_id>/confirm-delivery")
    def confirm_delivery(order_id: int):
        """Mark order as approved/delivered and email the customer (admin only)."""
        authenticate(admin=True)

        order = (
            db_session()
            .query(Order)
            .options(joinedload(Order.user))
            .filter(Order.id == order_id)
            .first()
        )
        if not order:
            raise ApiError("Order not found.", 404)

        order.status = "delivered"
        order.payment_status = "confirmed"
        db_session().commit()

        payment = (
            db_session().query(Payment).filter(Payment.order_id == order_id).first()
        )
        if payment:
            payment.status = "confirmed"
            payment.notes = (
                f"Payment confirmed by admin on {datetime.now(timezone.utc).isoformat()}."
            )
            db_session().commit()

        # Email the customer their approval notification
        if smtp_is_configured(settings) and order.user and order.user.email:
            try:
                approval_msg = build_order_approved_message(
                    settings=settings,
                    user=order.user,
                    order=order,
                    shipping_address=order.shipping_address,
                )
                send_message_via_smtp(settings, approval_msg)
            except Exception:
                app.logger.exception(
                    "Order %s approved but approval email could not be sent.",
                    order.order_number,
                )

        return json_success(
            order.to_dict(),
            message=f"Order {order.order_number} approved. Customer notified by email.",
        )

    # ── Feedback ──────────────────────────────────────────────────────────────

    @app.post("/api/feedback")
    def submit_feedback():
        """Submit customer feedback (public — no auth required)."""
        payload = request.get_json(silent=True) or {}

        name = (payload.get("name") or "").strip()
        if not name:
            raise ApiError("Your name is required.", 400)

        message_text = (payload.get("message") or "").strip()
        if not message_text:
            raise ApiError("A feedback message is required.", 400)

        email = (payload.get("email") or "").strip() or None
        phone = (payload.get("phone") or "").strip() or None
        service_type = (payload.get("service_type") or "general").strip()
        allowed_types = {"general", "pre_service", "post_service", "product", "installation"}
        if service_type not in allowed_types:
            service_type = "general"

        raw_rating = payload.get("rating")
        rating = None
        if raw_rating is not None:
            try:
                rating = int(raw_rating)
                if not 1 <= rating <= 5:
                    rating = None
            except (ValueError, TypeError):
                rating = None

        feedback = Feedback(
            name=name,
            email=email,
            phone=phone,
            service_type=service_type,
            rating=rating,
            message=message_text,
            order_number=(payload.get("order_number") or "").strip() or None,
            status="new",
        )
        db_session().add(feedback)
        db_session().commit()

        if smtp_is_configured(settings):
            # Notify support team
            try:
                notif = build_feedback_notification_message(
                    settings=settings,
                    feedback=feedback,
                )
                send_message_via_smtp(settings, notif)
            except Exception:
                app.logger.exception("Feedback notification email failed for feedback %s.", feedback.id)

            # Send acknowledgement to customer if they gave an email
            if feedback.email:
                try:
                    ack = build_feedback_acknowledgement_message(
                        settings=settings,
                        feedback=feedback,
                    )
                    send_message_via_smtp(settings, ack)
                except Exception:
                    app.logger.exception("Feedback acknowledgement email failed for %s.", feedback.email)

        return json_success(
            feedback.to_dict(),
            status_code=201,
            message="Thank you! Your feedback has been received.",
        )

    @app.get("/api/admin/feedback")
    def list_feedback():
        """List all feedback submissions (admin only)."""
        authenticate(admin=True)
        items = (
            db_session()
            .query(Feedback)
            .order_by(Feedback.created_at.desc())
            .all()
        )
        return json_success([f.to_dict() for f in items])

    @app.put("/api/admin/feedback/<int:feedback_id>")
    def update_feedback_status(feedback_id: int):
        """Update feedback status (admin only)."""
        authenticate(admin=True)
        item = db_session().query(Feedback).filter(Feedback.id == feedback_id).first()
        if not item:
            raise ApiError("Feedback not found.", 404)
        payload = request.get_json(silent=True) or {}
        if "status" in payload:
            item.status = payload["status"]
        db_session().commit()
        return json_success(item.to_dict())

    @app.get("/")
    def serve_index():
        return send_from_directory(project_root, "index.html")

    @app.get("/<path:path>")
    def serve_frontend(path: str):
        candidate = project_root / path
        if candidate.is_file():
            return send_from_directory(project_root, path)

        if not candidate.suffix:
            html_candidate = project_root / f"{path}.html"
            if html_candidate.is_file():
                return send_from_directory(project_root, f"{path}.html")

            index_candidate = project_root / path / "index.html"
            if index_candidate.is_file():
                return send_from_directory(project_root, f"{path}/index.html")

        raise ApiError("Page not found.", 404)

    return app
