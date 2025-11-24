"""
Development configuration for Legal Advocate AI
Settings optimized for local development
"""

from .base import BaseConfig
import os

class DevelopmentConfig(BaseConfig):
    """Development configuration"""

    DEBUG = True
    TESTING = False

    # Database - SQLite for development
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "sqlite:///~/.legal_advocate_ai/action_items.db"
    )

    # Logging - Verbose in development
    LOG_LEVEL = "DEBUG"

    # CORS - Allow local development
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:8501",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8501"
    ]

    # No rate limiting in development
    RATE_LIMIT_ENABLED = False

    # Enable auto-reload
    RELOAD = True

    @classmethod
    def validate(cls):
        """Development config validation - less strict"""
        # Don't require API keys in development
        return True
