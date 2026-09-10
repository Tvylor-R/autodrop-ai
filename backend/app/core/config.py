import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

SHOPIFY_CLIENT_ID = os.getenv("SHOPIFY_CLIENT_ID")
SHOPIFY_CLIENT_SECRET = os.getenv("SHOPIFY_CLIENT_SECRET")
SHOPIFY_REDIRECT_URI = os.getenv("SHOPIFY_REDIRECT_URI")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/0"
)

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "AutoDrop AI <no-reply@autodrop.ai>")