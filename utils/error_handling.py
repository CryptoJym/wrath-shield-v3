"""
Error Handling Utilities for Legal Advocate AI
Provides decorators and utilities for robust error handling
"""

import functools
import time
import logging
from typing import Callable, Optional, Type, Tuple, Any
from contextlib import contextmanager

from .exceptions import LegalAdvocateException, RateLimitError, get_exception_category

logger = logging.getLogger(__name__)


def retry(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable] = None
):
    """
    Decorator to retry a function on failure with exponential backoff

    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between retries (seconds)
        backoff: Multiplier for delay after each retry
        exceptions: Tuple of exception types to catch and retry
        on_retry: Optional callback function called on each retry

    Example:
        @retry(max_attempts=3, delay=1.0, exceptions=(APIError,))
        def fetch_data():
            # Code that might fail
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            attempt = 1
            current_delay = delay

            while attempt <= max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    if attempt == max_attempts:
                        logger.error(
                            f"Function {func.__name__} failed after {max_attempts} attempts",
                            exc_info=True,
                            extra={
                                'function': func.__name__,
                                'attempts': max_attempts,
                                'error_type': type(e).__name__
                            }
                        )
                        raise

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}. "
                        f"Retrying in {current_delay}s...",
                        extra={
                            'function': func.__name__,
                            'attempt': attempt,
                            'max_attempts': max_attempts,
                            'delay': current_delay,
                            'error': str(e)
                        }
                    )

                    if on_retry:
                        on_retry(attempt, e)

                    time.sleep(current_delay)
                    current_delay *= backoff
                    attempt += 1

        return wrapper
    return decorator


def log_errors(
    logger_instance: Optional[logging.Logger] = None,
    level: int = logging.ERROR,
    reraise: bool = True,
    return_on_error: Any = None
):
    """
    Decorator to automatically log errors with full context

    Args:
        logger_instance: Logger to use (defaults to module logger)
        level: Log level for errors
        reraise: Whether to re-raise the exception after logging
        return_on_error: Value to return if error occurs and reraise=False

    Example:
        @log_errors(level=logging.WARNING, reraise=False, return_on_error=[])
        def get_items():
            # Code that might fail
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            log = logger_instance or logger
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_context = {
                    'function': func.__name__,
                    'args': str(args)[:200],  # Limit args length
                    'kwargs': str(kwargs)[:200],
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }

                # Add exception category if it's a custom exception
                if isinstance(e, LegalAdvocateException):
                    error_context['error_category'] = get_exception_category(e)
                    error_context['error_details'] = e.details

                log.log(
                    level,
                    f"Error in {func.__name__}: {str(e)}",
                    exc_info=True,
                    extra=error_context
                )

                if reraise:
                    raise
                return return_on_error

        return wrapper
    return decorator


def handle_exceptions(*exception_types: Type[Exception], handler: Optional[Callable] = None):
    """
    Decorator to handle specific exceptions with a custom handler

    Args:
        *exception_types: Exception types to handle
        handler: Optional custom handler function that receives the exception

    Example:
        def handle_pdf_error(e):
            print(f"PDF error: {e}")

        @handle_exceptions(PDFProcessingError, handler=handle_pdf_error)
        def process_pdf(path):
            # Code that might raise PDFProcessingError
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except exception_types as e:
                if handler:
                    handler(e)
                else:
                    logger.error(
                        f"Handled exception in {func.__name__}: {type(e).__name__}",
                        exc_info=True,
                        extra={
                            'function': func.__name__,
                            'exception_type': type(e).__name__
                        }
                    )
                # Re-raise after handling
                raise

        return wrapper
    return decorator


@contextmanager
def safe_operation(operation_name: str, logger_instance: Optional[logging.Logger] = None):
    """
    Context manager for safe execution with automatic logging and cleanup

    Args:
        operation_name: Name of the operation for logging
        logger_instance: Optional logger instance

    Example:
        with safe_operation("database_transaction"):
            db.begin()
            # ... operations ...
            db.commit()
    """
    log = logger_instance or logger
    log.info(f"Starting operation: {operation_name}")

    try:
        yield
        log.info(f"Completed operation: {operation_name}")
    except Exception as e:
        log.error(
            f"Error during operation '{operation_name}': {str(e)}",
            exc_info=True,
            extra={
                'operation': operation_name,
                'error_type': type(e).__name__
            }
        )
        raise
    finally:
        log.debug(f"Finished operation: {operation_name}")


@contextmanager
def graceful_degradation(
    operation_name: str,
    default_value: Any = None,
    log_level: int = logging.WARNING,
    logger_instance: Optional[logging.Logger] = None
):
    """
    Context manager for graceful degradation - continues with default value on error

    Args:
        operation_name: Name of the operation
        default_value: Value to return on error
        log_level: Log level for errors
        logger_instance: Optional logger instance

    Example:
        with graceful_degradation("fetch_user_preferences", default_value={}) as result:
            result.value = fetch_preferences()

        # If fetch fails, result.value will be {}
    """
    log = logger_instance or logger

    class Result:
        def __init__(self):
            self.value = default_value

    result = Result()

    try:
        yield result
    except Exception as e:
        log.log(
            log_level,
            f"Operation '{operation_name}' failed, using default value: {str(e)}",
            exc_info=True,
            extra={
                'operation': operation_name,
                'default_value': str(default_value)[:100],
                'error_type': type(e).__name__
            }
        )
        result.value = default_value


def rate_limit_handler(service: str, default_retry_after: int = 60):
    """
    Decorator to handle rate limit errors with automatic retry

    Args:
        service: Name of the service
        default_retry_after: Default seconds to wait if not specified in error

    Example:
        @rate_limit_handler(service="Gmail API")
        def fetch_emails():
            # Code that might hit rate limits
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except RateLimitError as e:
                retry_after = e.details.get('retry_after', default_retry_after)
                logger.warning(
                    f"Rate limit hit for {service}. Waiting {retry_after}s...",
                    extra={
                        'service': service,
                        'retry_after': retry_after,
                        'function': func.__name__
                    }
                )
                time.sleep(retry_after)
                # Retry once after waiting
                return func(*args, **kwargs)

        return wrapper
    return decorator


class ErrorReporter:
    """
    Utility class for reporting errors to various channels

    Can be extended to send errors to monitoring services, Slack, email, etc.
    """

    def __init__(self, logger_instance: Optional[logging.Logger] = None):
        self.logger = logger_instance or logger
        self.error_counts = {}

    def report(
        self,
        error: Exception,
        context: dict = None,
        severity: str = "error"
    ):
        """
        Report an error with context

        Args:
            error: The exception that occurred
            context: Additional context information
            severity: Error severity ('warning', 'error', 'critical')
        """
        error_type = type(error).__name__
        error_msg = str(error)

        # Track error counts
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1

        log_data = {
            'error_type': error_type,
            'error_message': error_msg,
            'error_count': self.error_counts[error_type],
            'severity': severity,
            **(context or {})
        }

        # Add custom exception details if available
        if isinstance(error, LegalAdvocateException):
            log_data['error_details'] = error.details
            log_data['error_category'] = get_exception_category(error)

        level_map = {
            'warning': logging.WARNING,
            'error': logging.ERROR,
            'critical': logging.CRITICAL
        }

        self.logger.log(
            level_map.get(severity, logging.ERROR),
            f"{severity.upper()}: {error_msg}",
            exc_info=True,
            extra=log_data
        )

        # Could extend to send to external services
        if severity == 'critical':
            self._send_critical_alert(error, log_data)

    def _send_critical_alert(self, error: Exception, context: dict):
        """Send critical error alerts (placeholder for future implementation)"""
        # TODO: Implement alert sending (email, Slack, PagerDuty, etc.)
        self.logger.critical(
            f"CRITICAL ERROR: {type(error).__name__}",
            extra={'alert_sent': False, **context}
        )

    def get_error_summary(self) -> dict:
        """Get summary of all errors"""
        return {
            'total_errors': sum(self.error_counts.values()),
            'error_types': self.error_counts,
            'most_common': max(self.error_counts.items(), key=lambda x: x[1]) if self.error_counts else None
        }


# Global error reporter instance
error_reporter = ErrorReporter()


# Convenience function for reporting errors
def report_error(error: Exception, **context):
    """
    Report an error with context

    Args:
        error: The exception to report
        **context: Additional context key-value pairs
    """
    error_reporter.report(error, context=context)
