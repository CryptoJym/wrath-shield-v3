"""
Integrations package for Legal Advocate AI
External service integrations for email, calendar, case management, etc.
"""

from integrations.gmail_integration import (
    GmailIntegration,
    AttorneyEmail,
    get_attorney_emails_for_processing
)

__all__ = [
    'GmailIntegration',
    'AttorneyEmail',
    'get_attorney_emails_for_processing',
]
