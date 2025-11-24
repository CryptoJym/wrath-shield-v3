"""
Utils Package for Legal Advocate AI
Provides logging, error handling, and monitoring utilities
"""

from .logging_config import (
    setup_logging,
    get_logger,
    LoggingConfig,
    JSONFormatter,
    ContextFilter
)

from .exceptions import (
    LegalAdvocateException,
    PDFProcessingError,
    DeadlineExtractionError,
    RequestDetectionError,
    GmailAPIError,
    DatabaseError,
    ValidationError,
    ConfigurationError,
    AuthenticationError,
    RateLimitError,
    EmailProcessingError,
    ModelLoadError,
    get_exception_category,
)

from .error_handling import (
    retry,
    log_errors,
    handle_exceptions,
    safe_operation,
    graceful_degradation,
    rate_limit_handler,
    ErrorReporter,
    error_reporter,
    report_error,
)

from .monitoring import (
    metrics,
    track_performance,
    count_calls,
    HealthCheck,
    MetricsCollector,
    PerformanceMetric,
)

__all__ = [
    # Logging
    'setup_logging',
    'get_logger',
    'LoggingConfig',
    'JSONFormatter',
    'ContextFilter',

    # Exceptions
    'LegalAdvocateException',
    'PDFProcessingError',
    'DeadlineExtractionError',
    'RequestDetectionError',
    'GmailAPIError',
    'DatabaseError',
    'ValidationError',
    'ConfigurationError',
    'AuthenticationError',
    'RateLimitError',
    'EmailProcessingError',
    'ModelLoadError',
    'get_exception_category',

    # Error Handling
    'retry',
    'log_errors',
    'handle_exceptions',
    'safe_operation',
    'graceful_degradation',
    'rate_limit_handler',
    'ErrorReporter',
    'error_reporter',
    'report_error',

    # Monitoring
    'metrics',
    'track_performance',
    'count_calls',
    'HealthCheck',
    'MetricsCollector',
    'PerformanceMetric',
]
