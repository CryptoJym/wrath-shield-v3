"""
Repository Layer for Legal Advocate AI
Provides data access layer with CRUD operations and business logic
"""

from repositories.base_repository import BaseRepository
from repositories.deadline_repository import DeadlineRepository
from repositories.request_repository import RequestRepository
from repositories.alert_repository import AlertRepository
from repositories.case_repository import CaseRepository
from repositories.completion_repository import CompletionTrackingRepository

# Alias for backward compatibility
CompletionRepository = CompletionTrackingRepository

__all__ = [
    'BaseRepository',
    'DeadlineRepository',
    'RequestRepository',
    'AlertRepository',
    'CaseRepository',
    'CompletionTrackingRepository',
    'CompletionRepository',
]
