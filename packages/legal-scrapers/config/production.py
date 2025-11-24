"""
Production configuration for Legal Advocate AI
Settings optimized for production deployment
"""

from .base import BaseConfig
import os

class ProductionConfig(BaseConfig):
    """Production configuration"""

    DEBUG = False
    TESTING = False

    # Database - PostgreSQL in production
    DATABASE_URL = os.getenv("DATABASE_URL")

    # Handle Heroku/Railway postgres:// -> postgresql:// conversion
    if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    # Security
    SECRET_KEY = os.getenv("SECRET_KEY")  # Must be set in production
    API_KEY = os.getenv("API_KEY")  # Must be set in production

    # Error Tracking - Sentry
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "production")
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    # CORS - Production origins
    cors_origins_str = os.getenv("CORS_ORIGINS", "")
    CORS_ORIGINS = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

    # Rate Limiting
    RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # Email
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")  # Must be set
    SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL")  # Must be set
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

    # Background Jobs
    SCHEDULER_ENABLED = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    ALERT_CHECK_INTERVAL_MINUTES = int(os.getenv("ALERT_CHECK_INTERVAL_MINUTES", "15"))

    # Performance
    WORKERS = int(os.getenv("WEB_CONCURRENCY", "4"))
    WORKER_CLASS = os.getenv("WORKER_CLASS", "uvicorn.workers.UvicornWorker")
    WORKER_TIMEOUT = int(os.getenv("WORKER_TIMEOUT", "120"))

    # No auto-reload in production
    RELOAD = False

    @classmethod
    def init_app(cls, app=None):
        """Initialize production app with Sentry"""
        if cls.SENTRY_DSN:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

            sentry_sdk.init(
                dsn=cls.SENTRY_DSN,
                environment=cls.SENTRY_ENVIRONMENT,
                traces_sample_rate=cls.SENTRY_TRACES_SAMPLE_RATE,
                integrations=[
                    FastApiIntegration(),
                    SqlalchemyIntegration()
                ]
            )

    @classmethod
    def validate(cls):
        """Strict validation for production"""
        errors = []

        if not cls.DATABASE_URL:
            errors.append("DATABASE_URL is required in production")

        if not cls.SECRET_KEY or cls.SECRET_KEY == "dev-secret-key-change-in-production":
            errors.append("SECRET_KEY must be set to a secure value in production")

        if not cls.API_KEY:
            errors.append("API_KEY is required in production")

        if not cls.SENDGRID_API_KEY:
            errors.append("SENDGRID_API_KEY is required in production")

        if not cls.SENDGRID_FROM_EMAIL:
            errors.append("SENDGRID_FROM_EMAIL is required in production")

        if not cls.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must be configured in production")

        if errors:
            raise ValueError(f"Production configuration errors: {', '.join(errors)}")

        return True
