"""
Base configuration for Legal Advocate AI
Common settings shared across all environments
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class BaseConfig:
    """Base configuration with common settings"""

    # Application
    APP_NAME = "Legal Advocate AI"
    APP_VERSION = "1.0.0"

    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    API_KEY = os.getenv("API_KEY")

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///~/.legal_advocate_ai/action_items.db")

    # Email/SendGrid
    SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
    SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "noreply@legaladvocate.ai")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@legaladvocate.ai")

    # Gmail API
    GMAIL_CREDENTIALS_FILE = os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json")
    GMAIL_TOKEN_FILE = os.getenv("GMAIL_TOKEN_FILE", "token.json")

    # AI/LLM
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")

    # ChromaDB
    CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", str(Path.home() / ".legal_advocate_ai" / "chroma"))

    # Alert Schedule (in days before deadline)
    ALERT_INTERVALS = [30, 14, 7, 3, 1]

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # CORS
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8501"]

    # Rate Limiting
    RATE_LIMIT_ENABLED = False
    RATE_LIMIT_PER_MINUTE = 60

    # File Upload
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt'}

    # Background Jobs
    SCHEDULER_ENABLED = True
    ALERT_CHECK_INTERVAL_MINUTES = 15

    @classmethod
    def init_app(cls, app=None):
        """Initialize application with this config"""
        pass

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []

        if not cls.API_KEY:
            errors.append("API_KEY is not set")

        if not cls.SENDGRID_API_KEY:
            errors.append("SENDGRID_API_KEY is not set")

        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")

        return True
