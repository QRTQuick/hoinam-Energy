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
    send_message_via_smtp,
    smtp_is_configured,
)
from email.message import EmailMessage
from .firebase_auth import verify_id_token
from .inventory import parse_stock_inventory
from .models import Installation, Order, Payment, Product, User, BlogPost
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

    _db_initialized = False

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
        nonlocal _db_initialized
        if _db_initialized:
            return
        check_database_url()
        init_database()
        seed_session = get_session()
        try:
            seed_products(seed_session)
            seed_session.commit()
        except Exception:
            seed_session.rollback()
            raise
        finally:
            close_session()
        _db_initialized = True

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
        """Send a test email (admin only)."""
        user = authenticate()
        if user.role != "admin":
            raise ApiError("Admin access required.", 403)

        if not smtp_is_configured(settings):
            raise ApiError(
                "SMTP is not configured. Check your environment variables.", 400
            )

        try:
            test_message = EmailMessage()
            test_message["Subject"] = "[TEST] Hoinam Energy SMTP Test"
            test_message["From"] = settings.smtp_from_email or settings.smtp_username
            test_message["To"] = settings.order_notification_email
            test_message.set_content(
                f"SMTP test email from Hoinam Energy.\n\n"
                f"Sent at: {datetime.now(timezone.utc).isoformat()}\n"
                f"From: {settings.smtp_from_email or settings.smtp_username}\n"
                f"To: {settings.order_notification_email}"
            )
            send_message_via_smtp(settings, test_message)
            return json_success(
                {"message": f"Test email sent to {settings.order_notification_email}"}
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
        payment.status = "confirmed"
        order.payment_status = "confirmed"
        db_session().commit()

        return json_success(payment.to_dict(), message="Receipt uploaded successfully.")

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
        """Get a single published blog post by slug (public)."""
        post = (
            db_session()
            .query(BlogPost)
            .filter(BlogPost.slug == post_slug, BlogPost.is_published.is_(True))
            .first()
        )
        if not post:
            raise ApiError("Blog post not found.", 404)
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

        # Handle publish/unpublish
        if "is_published" in payload:
            was_published = post.is_published
            post.is_published = bool(payload.get("is_published"))
            if post.is_published and not was_published:
                post.published_at = datetime.now(timezone.utc)
            elif not post.is_published:
                post.published_at = None

        db_session().commit()
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

    @app.get("/api/admin/stats")
    def admin_stats():
        authenticate(admin=True)
        revenue = (
            db_session().query(func.coalesce(func.sum(Order.total_amount), 0)).scalar()
        )
        payload = {
            "users": db_session().query(func.count(User.id)).scalar(),
            "products": db_session()
            .query(func.count(Product.id))
            .filter(Product.active.is_(True))
            .scalar(),
            "orders": db_session().query(func.count(Order.id)).scalar(),
            "installations": db_session().query(func.count(Installation.id)).scalar(),
            "revenue": float(revenue or 0),
            "currency": settings.default_currency,
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
        """Mark goods as received and approve payment (admin only)."""
        authenticate(admin=True)
        payload = request.get_json(silent=True) or {}

        order = db_session().query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ApiError("Order not found.", 404)

        # Mark order as goods received/delivered
        order.status = "delivered"
        order.payment_status = "confirmed"
        db_session().commit()

        # Update payment if it exists
        payment = (
            db_session().query(Payment).filter(Payment.order_id == order_id).first()
        )
        if payment:
            payment.status = "confirmed"
            payment.notes = f"Payment confirmed by admin on {datetime.now(timezone.utc).isoformat()}. Goods received."
            db_session().commit()

        return json_success(
            order.to_dict(),
            message=f"Order {order.order_number} marked as delivered. Payment confirmed.",
        )

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
