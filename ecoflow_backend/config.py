import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))

    SQLALCHEMY_DATABASE_URI = os.getenv(
        'USERS_DATABASE_URL',
        f"sqlite:///{os.path.join(BASE_DIR, 'local_users.db')}"
    )

    SQLALCHEMY_BINDS = {
        'products': os.getenv(
            'PRODUCTS_DATABASE_URL',
            f"sqlite:///{os.path.join(BASE_DIR, 'local_products.db')}"
        ),
        'orders': os.getenv(
            'ORDERS_DATABASE_URL',
            f"sqlite:///{os.path.join(BASE_DIR, 'local_orders.db')}"
        ),
        'installations': os.getenv(
            'INSTALLATIONS_DATABASE_URL',
            f"sqlite:///{os.path.join(BASE_DIR, 'local_installations.db')}"
        ),
    }

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change-me-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', '86400'))

    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    PAYSTACK_SECRET_KEY = os.getenv('PAYSTACK_SECRET_KEY')
    PAYSTACK_BASE_URL = os.getenv('PAYSTACK_BASE_URL', 'https://api.paystack.co')

    OTP_EXPIRY_MINUTES = int(os.getenv('OTP_EXPIRY_MINUTES', '10'))
    OTP_DEBUG = os.getenv('OTP_DEBUG', 'false').lower() == 'true'

    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
