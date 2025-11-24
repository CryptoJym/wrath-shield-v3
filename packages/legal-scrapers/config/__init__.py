"""
Configuration management for Legal Advocate AI
Handles environment-based configuration for development and production
"""

from .base import BaseConfig
from .development import DevelopmentConfig
from .production import ProductionConfig
from .testing import TestingConfig

import os

# Configuration mapping
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig
}

def get_config(config_name: str = None):
    """
    Get configuration object based on environment

    Args:
        config_name: Configuration name (development, production, testing)
                    If None, uses ENVIRONMENT env var or defaults to development

    Returns:
        Configuration object
    """
    if config_name is None:
        config_name = os.getenv('ENVIRONMENT', 'development')

    return config_by_name.get(config_name.lower(), DevelopmentConfig)

__all__ = ['BaseConfig', 'DevelopmentConfig', 'ProductionConfig', 'TestingConfig', 'get_config']
