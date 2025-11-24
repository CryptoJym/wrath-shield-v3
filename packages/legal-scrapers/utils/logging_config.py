"""
Logging Configuration for Legal Advocate AI
Provides structured logging with multiple handlers, rotation, and JSON formatting
"""

import logging
import logging.handlers
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging

    Outputs logs in JSON format for easy parsing and analysis
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Add extra fields from record
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)

        # Add process/thread info for debugging
        log_data['process'] = {
            'pid': record.process,
            'process_name': record.processName,
            'thread_id': record.thread,
            'thread_name': record.threadName,
        }

        return json.dumps(log_data, default=str)


class ContextFilter(logging.Filter):
    """
    Add contextual information to log records
    """

    def __init__(self, context: Optional[Dict[str, Any]] = None):
        super().__init__()
        self.context = context or {}

    def filter(self, record: logging.LogRecord) -> bool:
        """Add context to record"""
        if not hasattr(record, 'extra_fields'):
            record.extra_fields = {}
        record.extra_fields.update(self.context)
        return True


class LoggingConfig:
    """
    Centralized logging configuration for the application

    Features:
    - Multiple handlers (console, file, error file)
    - Log rotation with size limits
    - JSON formatting for structured logs
    - Different log levels per handler
    - Context injection
    """

    # Log directory
    LOG_DIR = Path(__file__).parent.parent / 'logs'

    # Log files
    MAIN_LOG_FILE = LOG_DIR / 'app.log'
    ERROR_LOG_FILE = LOG_DIR / 'error.log'

    # Rotation settings
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    BACKUP_COUNT = 5  # Keep 5 backup files

    @classmethod
    def setup_logging(
        cls,
        level: int = logging.INFO,
        console_level: Optional[int] = None,
        json_logs: bool = False,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Configure application-wide logging

        Args:
            level: Default log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            console_level: Console-specific log level (defaults to level)
            json_logs: Use JSON formatting for file logs
            context: Additional context to include in all logs
        """
        # Create log directory
        cls.LOG_DIR.mkdir(exist_ok=True)

        # Get root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.DEBUG)  # Capture everything, filter at handler level

        # Remove existing handlers
        root_logger.handlers = []

        # Console handler - human-readable format
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(console_level or level)
        console_format = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_format)

        # Add context filter if provided
        if context:
            console_handler.addFilter(ContextFilter(context))

        root_logger.addHandler(console_handler)

        # Main log file handler - rotating file
        main_file_handler = logging.handlers.RotatingFileHandler(
            cls.MAIN_LOG_FILE,
            maxBytes=cls.MAX_BYTES,
            backupCount=cls.BACKUP_COUNT,
            encoding='utf-8'
        )
        main_file_handler.setLevel(logging.DEBUG)

        # Use JSON or standard format
        if json_logs:
            main_file_handler.setFormatter(JSONFormatter())
        else:
            file_format = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(funcName)s:%(lineno)d - %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            main_file_handler.setFormatter(file_format)

        if context:
            main_file_handler.addFilter(ContextFilter(context))

        root_logger.addHandler(main_file_handler)

        # Error log file handler - only errors and critical
        error_file_handler = logging.handlers.RotatingFileHandler(
            cls.ERROR_LOG_FILE,
            maxBytes=cls.MAX_BYTES,
            backupCount=cls.BACKUP_COUNT,
            encoding='utf-8'
        )
        error_file_handler.setLevel(logging.ERROR)

        if json_logs:
            error_file_handler.setFormatter(JSONFormatter())
        else:
            error_format = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(funcName)s:%(lineno)d - %(message)s\n'
                'Exception: %(exc_info)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            error_file_handler.setFormatter(error_format)

        if context:
            error_file_handler.addFilter(ContextFilter(context))

        root_logger.addHandler(error_file_handler)

        # Log initial setup
        root_logger.info(f"Logging initialized - Level: {logging.getLevelName(level)}")
        root_logger.info(f"Logs directory: {cls.LOG_DIR}")

    @classmethod
    def get_logger(cls, name: str, **extra_fields) -> logging.Logger:
        """
        Get a logger with optional extra fields

        Args:
            name: Logger name (typically __name__)
            **extra_fields: Additional fields to include in log records

        Returns:
            Configured logger instance
        """
        logger = logging.getLogger(name)

        if extra_fields:
            # Create adapter that adds extra fields
            return logging.LoggerAdapter(logger, extra_fields)

        return logger

    @classmethod
    def add_context(cls, logger: logging.Logger, **context) -> logging.LoggerAdapter:
        """
        Add contextual information to a logger

        Args:
            logger: Logger instance
            **context: Context key-value pairs

        Returns:
            LoggerAdapter with context
        """
        return logging.LoggerAdapter(logger, context)


# Convenience function for quick setup
def setup_logging(
    level: str = "INFO",
    json_logs: bool = False,
    **context
) -> None:
    """
    Quick setup for logging

    Args:
        level: Log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: Use JSON formatting
        **context: Additional context for all logs
    """
    level_map = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL,
    }

    log_level = level_map.get(level.upper(), logging.INFO)
    LoggingConfig.setup_logging(level=log_level, json_logs=json_logs, context=context)


def get_logger(name: str, **extra_fields) -> logging.Logger:
    """
    Get a logger instance

    Args:
        name: Logger name (use __name__ typically)
        **extra_fields: Additional fields for all log records

    Returns:
        Logger instance
    """
    return LoggingConfig.get_logger(name, **extra_fields)


# Example usage
if __name__ == "__main__":
    # Setup logging
    setup_logging(level="DEBUG", json_logs=True, app_version="1.0.0")

    # Get logger
    logger = get_logger(__name__, component="test")

    # Test different log levels
    logger.debug("This is a debug message")
    logger.info("Processing started", extra={'user_id': '123', 'action': 'test'})
    logger.warning("This is a warning")

    try:
        raise ValueError("Test error")
    except Exception as e:
        logger.error("Error occurred", exc_info=True, extra={'error_type': 'test'})

    logger.critical("Critical system error")
