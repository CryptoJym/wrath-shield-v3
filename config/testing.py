"""
Testing configuration for Legal Advocate AI
Settings optimized for running tests
"""

from .base import BaseConfig

class TestingConfig(BaseConfig):
    """Testing configuration"""

    DEBUG = True
    TESTING = True

    # Database - In-memory SQLite for tests
    DATABASE_URL = "sqlite:///:memory:"

    # Logging - Minimal in tests
    LOG_LEVEL = "ERROR"

    # Disable background jobs in tests
    SCHEDULER_ENABLED = False

    # No rate limiting in tests
    RATE_LIMIT_ENABLED = False

    # Fast alert intervals for testing
    ALERT_INTERVALS = [1, 2, 3]

    @classmethod
    def validate(cls):
        """No validation needed for testing"""
        return True
