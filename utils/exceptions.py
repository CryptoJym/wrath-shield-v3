"""
Custom Exceptions for Legal Advocate AI
Provides specific exception types for different error scenarios
"""


class LegalAdvocateException(Exception):
    """Base exception for all Legal Advocate AI errors"""

    def __init__(self, message: str, details: dict = None):
        """
        Initialize exception with message and optional details

        Args:
            message: Human-readable error message
            details: Additional error context (dict)
        """
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self):
        """Convert exception to dictionary for logging"""
        return {
            'type': self.__class__.__name__,
            'message': self.message,
            'details': self.details
        }


class PDFProcessingError(LegalAdvocateException):
    """Raised when PDF extraction or parsing fails"""

    def __init__(self, message: str, pdf_path: str = None, page_number: int = None, **details):
        """
        Initialize PDF processing error

        Args:
            message: Error description
            pdf_path: Path to the problematic PDF
            page_number: Page number where error occurred
            **details: Additional error context
        """
        error_details = {
            'pdf_path': pdf_path,
            'page_number': page_number,
            **details
        }
        super().__init__(message, error_details)


class DeadlineExtractionError(LegalAdvocateException):
    """Raised when deadline parsing or extraction fails"""

    def __init__(self, message: str, text_snippet: str = None, document_id: str = None, **details):
        """
        Initialize deadline extraction error

        Args:
            message: Error description
            text_snippet: Text where extraction failed
            document_id: Document identifier
            **details: Additional error context
        """
        error_details = {
            'text_snippet': text_snippet[:200] if text_snippet else None,  # Limit snippet length
            'document_id': document_id,
            **details
        }
        super().__init__(message, error_details)


class RequestDetectionError(LegalAdvocateException):
    """Raised when request parsing or detection fails"""

    def __init__(self, message: str, email_subject: str = None, email_id: str = None, **details):
        """
        Initialize request detection error

        Args:
            message: Error description
            email_subject: Subject of the problematic email
            email_id: Email identifier
            **details: Additional error context
        """
        error_details = {
            'email_subject': email_subject,
            'email_id': email_id,
            **details
        }
        super().__init__(message, error_details)


class GmailAPIError(LegalAdvocateException):
    """Raised when Gmail API operations fail"""

    def __init__(self, message: str, operation: str = None, status_code: int = None, **details):
        """
        Initialize Gmail API error

        Args:
            message: Error description
            operation: API operation that failed (e.g., 'fetch_messages', 'send_email')
            status_code: HTTP status code if available
            **details: Additional error context
        """
        error_details = {
            'operation': operation,
            'status_code': status_code,
            **details
        }
        super().__init__(message, error_details)


class DatabaseError(LegalAdvocateException):
    """Raised when database operations fail"""

    def __init__(self, message: str, operation: str = None, table: str = None, **details):
        """
        Initialize database error

        Args:
            message: Error description
            operation: Database operation that failed (e.g., 'insert', 'update', 'query')
            table: Table/model name
            **details: Additional error context
        """
        error_details = {
            'operation': operation,
            'table': table,
            **details
        }
        super().__init__(message, error_details)


class ValidationError(LegalAdvocateException):
    """Raised when data validation fails"""

    def __init__(self, message: str, field: str = None, value: str = None, **details):
        """
        Initialize validation error

        Args:
            message: Error description
            field: Field that failed validation
            value: Invalid value
            **details: Additional error context
        """
        error_details = {
            'field': field,
            'value': value,
            **details
        }
        super().__init__(message, error_details)


class ConfigurationError(LegalAdvocateException):
    """Raised when configuration is invalid or missing"""

    def __init__(self, message: str, config_key: str = None, **details):
        """
        Initialize configuration error

        Args:
            message: Error description
            config_key: Configuration key that's problematic
            **details: Additional error context
        """
        error_details = {
            'config_key': config_key,
            **details
        }
        super().__init__(message, error_details)


class AuthenticationError(LegalAdvocateException):
    """Raised when authentication fails"""

    def __init__(self, message: str, service: str = None, **details):
        """
        Initialize authentication error

        Args:
            message: Error description
            service: Service where authentication failed
            **details: Additional error context
        """
        error_details = {
            'service': service,
            **details
        }
        super().__init__(message, error_details)


class RateLimitError(LegalAdvocateException):
    """Raised when API rate limits are exceeded"""

    def __init__(self, message: str, service: str = None, retry_after: int = None, **details):
        """
        Initialize rate limit error

        Args:
            message: Error description
            service: Service that rate limited the request
            retry_after: Seconds to wait before retrying
            **details: Additional error context
        """
        error_details = {
            'service': service,
            'retry_after': retry_after,
            **details
        }
        super().__init__(message, error_details)


class EmailProcessingError(LegalAdvocateException):
    """Raised when email processing fails"""

    def __init__(self, message: str, email_id: str = None, processing_step: str = None, **details):
        """
        Initialize email processing error

        Args:
            message: Error description
            email_id: Email identifier
            processing_step: Step where processing failed
            **details: Additional error context
        """
        error_details = {
            'email_id': email_id,
            'processing_step': processing_step,
            **details
        }
        super().__init__(message, error_details)


class ModelLoadError(LegalAdvocateException):
    """Raised when NLP models fail to load"""

    def __init__(self, message: str, model_name: str = None, **details):
        """
        Initialize model load error

        Args:
            message: Error description
            model_name: Name of the model that failed to load
            **details: Additional error context
        """
        error_details = {
            'model_name': model_name,
            **details
        }
        super().__init__(message, error_details)


# Mapping of exception types for easy error categorization
EXCEPTION_CATEGORIES = {
    'processing': [PDFProcessingError, DeadlineExtractionError, RequestDetectionError, EmailProcessingError],
    'external_api': [GmailAPIError, RateLimitError],
    'data': [DatabaseError, ValidationError],
    'system': [ConfigurationError, AuthenticationError, ModelLoadError],
}


def get_exception_category(exception: Exception) -> str:
    """
    Get the category of an exception

    Args:
        exception: Exception instance

    Returns:
        Category name ('processing', 'external_api', 'data', 'system', 'unknown')
    """
    for category, exception_types in EXCEPTION_CATEGORIES.items():
        if any(isinstance(exception, exc_type) for exc_type in exception_types):
            return category
    return 'unknown'
