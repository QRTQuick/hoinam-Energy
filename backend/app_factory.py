from __future__ import annotations

from datetime import date
from pathlib import Path

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from openpyxl import load_workbook
from sqlalchemy import desc, func

from .config import get_settings
from .database import close_session, get_session, init_database
from .firebase_auth import verify_id_token
from .models import Installation, Order, Product, User
from .payments import initialize_transaction, verify_transaction
from .seed import seed_products
from .services import apply_product_payload, calculate_order_items, sync_user_from_claims
from .utils import generate_order_number, generate_payment_reference, slugify, to_decimal, to_minor_units


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

    init_database()
    db = get_session()
    try:
        seed_products(db)
    finally:
        db.close()
        close_session()

    @app.before_request
    def attach_session():
        if request.path.startswith("/api/"):
            g.db = get_session()

    @app.teardown_request
    def teardown_request(_exc):
        if hasattr(g, "db"):
            g.db.close()
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

        user = sync_user_from_claims(db_session(), claims)
        g.current_user = user

        if admin and user.role != "admin":
            raise ApiError("Admin access is required.", 403)

        return user

    def serialize_installation(installation: Installation) -> dict:
        payload = installation.to_dict()
        payload["user"] = installation.user.to_dict() if installation.user else None
        payload["product"] = installation.product.to_dict() if installation.product else None
        return payload

    def parse_inventory_file(file_storage) -> list[dict]:
        workbook = load_workbook(file_storage.stream, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            raise ApiError("The uploaded workbook is empty.", 400)

        first_row = [str(cell).strip().lower() if cell is not None else "" for cell in rows[0]]
        has_header = any(cell in {"name", "product", "stock", "quantity"} for cell in first_row)
        data_rows = rows[1:] if has_header else rows

        header_map = {}
        if has_header:
            for index, header in enumerate(first_row):
                header_map[header] = index

        parsed = []
        for row in data_rows:
            if not row or not row[0]:
                continue

            if has_header:
                name = row[header_map.get("name", header_map.get("product", 0))]
                stock = row[header_map.get("stock", header_map.get("quantity", 1))]
                price = row[header_map.get("price")] if "price" in header_map else None
                category = row[header_map.get("category")] if "category" in header_map else None
                image_url = row[header_map.get("image_url")] if "image_url" in header_map else None
                summary = row[header_map.get("summary")] if "summary" in header_map else None
                description = row[header_map.get("description")] if "description" in header_map else None
            else:
                name = row[0]
                stock = row[1] if len(row) > 1 else 0
                price = row[2] if len(row) > 2 else None
                category = row[3] if len(row) > 3 else None
                image_url = row[4] if len(row) > 4 else None
                summary = row[5] if len(row) > 5 else None
                description = row[6] if len(row) > 6 else None

            if not name:
                continue

            parsed.append(
                {
                    "name": str(name).strip(),
                    "stock": int(stock or 0),
                    "price": str(price or 0),
                    "category": str(category).strip() if category else "Portable Power",
                    "image_url": str(image_url).strip() if image_url else None,
                    "summary": str(summary).strip() if summary else f"{name} ready for storefront publication.",
                    "description": str(description).strip() if description else f"{name} inventory imported from the latest admin upload.",
                }
            )

        return parsed

    @app.get("/api/health")
    def health_check():
        return json_success({"status": "ok"})

    @app.post("/api/auth/verify")
    def verify_auth():
        user = authenticate()
        return json_success(user.to_dict())

    @app.get("/api/products")
    def list_products():
        products = (
            db_session()
            .query(Product)
            .filter(Product.active.is_(True))
            .order_by(desc(Product.featured), Product.name.asc())
            .all()
        )
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

    @app.post("/api/payments/initialize")
    def initialize_payment_route():
        user = authenticate()
        payload = request.get_json(silent=True) or {}
        items = payload.get("items") or []
        normalized_items, total = calculate_order_items(db_session(), items)
        reference = generate_payment_reference()
        payment = initialize_transaction(
            email=user.email or payload.get("email") or "orders@hoinamenergy.com",
            amount_minor=to_minor_units(total),
            reference=reference,
            metadata={
                "user_id": user.id,
                "items": normalized_items,
                "customer": user.full_name or user.email or user.firebase_uid,
            },
        )
        return json_success(
            {
                "reference": reference,
                "authorization_url": payment["authorization_url"],
                "access_code": payment.get("access_code"),
                "amount": float(total),
                "currency": settings.default_currency,
            }
        )

    @app.post("/api/orders")
    def create_order():
        user = authenticate()
        payload = request.get_json(silent=True) or {}
        payment_reference = (payload.get("payment_reference") or "").strip()
        if not payment_reference:
            raise ApiError("payment_reference is required.", 400)

        existing_order = db_session().query(Order).filter(Order.payment_reference == payment_reference).first()
        if existing_order:
            return json_success(existing_order.to_dict())

        shipping_address = payload.get("shipping_address") or {}
        required_fields = ["full_name", "phone", "address", "city", "state"]
        missing_fields = [field for field in required_fields if not shipping_address.get(field)]
        if missing_fields:
            raise ApiError(f"Missing shipping fields: {', '.join(missing_fields)}.", 400)

        normalized_items, total = calculate_order_items(
            db_session(), payload.get("items") or [], lock_products=True
        )
        verification = verify_transaction(payment_reference)
        if verification.get("status") != "success":
            raise ApiError("Payment has not been completed.", 402)
        if verification.get("amount") not in (None, to_minor_units(total)):
            raise ApiError("Payment amount does not match the order total.", 400)

        product_quantities = {item["product_id"]: item["quantity"] for item in normalized_items}
        products = (
            db_session()
            .query(Product)
            .filter(Product.id.in_(product_quantities.keys()))
            .with_for_update()
            .all()
        )
        for product in products:
            requested_quantity = product_quantities[product.id]
            if product.stock < requested_quantity:
                raise ApiError(f"{product.name} is no longer available in that quantity.", 409)
            product.stock -= requested_quantity

        order = Order(
            order_number=generate_order_number(),
            user_id=user.id,
            status="confirmed",
            payment_status="paid",
            payment_reference=payment_reference,
            total_amount=to_decimal(total),
            currency=settings.default_currency,
            shipping_address=shipping_address,
            notes=payload.get("notes"),
            items=normalized_items,
        )
        db_session().add(order)
        db_session().commit()
        return json_success(order.to_dict(), status_code=201)

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
        orders = db_session().query(Order).order_by(Order.created_at.desc()).all()
        payload = []
        for order in orders:
            data = order.to_dict()
            data["user"] = order.user.to_dict() if order.user else None
            payload.append(data)
        return json_success(payload)

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
            preferred_date=date.fromisoformat(preferred_date) if preferred_date else None,
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
        installations = db_session().query(Installation).order_by(Installation.created_at.desc()).all()
        return json_success([serialize_installation(item) for item in installations])

    @app.put("/api/installations/<int:installation_id>")
    def update_installation(installation_id: int):
        authenticate(admin=True)
        installation = db_session().query(Installation).filter(Installation.id == installation_id).first()
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

    @app.get("/api/admin/stats")
    def admin_stats():
        authenticate(admin=True)
        revenue = db_session().query(func.coalesce(func.sum(Order.total_amount), 0)).scalar()
        payload = {
            "users": db_session().query(func.count(User.id)).scalar(),
            "products": db_session().query(func.count(Product.id)).filter(Product.active.is_(True)).scalar(),
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
            raise ApiError("No inventory rows were found in the uploaded workbook.", 400)

        created = 0
        updated = 0
        for row in rows:
            product = db_session().query(Product).filter(Product.name == row["name"]).first()
            if product is None:
                product = Product(
                    name=row["name"],
                    slug=slugify(row["name"]),
                    sku=slugify(row["name"]).upper().replace("-", "_"),
                    category=row["category"],
                    summary=row["summary"],
                    description=row["description"],
                    price=to_decimal(row["price"]),
                    currency=settings.default_currency,
                    stock=row["stock"],
                    image_url=row["image_url"],
                    active=True,
                )
                db_session().add(product)
                created += 1
            else:
                product.stock = row["stock"]
                if row["price"]:
                    product.price = to_decimal(row["price"])
                product.category = row["category"] or product.category
                product.image_url = row["image_url"] or product.image_url
                product.summary = row["summary"] or product.summary
                product.description = row["description"] or product.description
                updated += 1

        db_session().commit()
        return json_success({"created": created, "updated": updated}, message="Inventory upload complete.")

    @app.get("/")
    def serve_index():
        return send_from_directory(project_root, "index.html")

    @app.get("/<path:path>")
    def serve_frontend(path: str):
        candidate = project_root / path
        if candidate.is_file():
            return send_from_directory(project_root, path)
        raise ApiError("Page not found.", 404)

    return app
