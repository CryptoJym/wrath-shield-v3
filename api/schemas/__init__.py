"""
API Schemas Package
Pydantic models for request/response validation
"""

from api.schemas.common import (
    HealthResponse,
    MetricsResponse,
    ErrorResponse,
    PaginationParams,
    PaginatedResponse
)

from api.schemas.deadlines import (
    DeadlineListResponse,
    DeadlineDetailResponse,
    DeadlineCreateRequest,
    DeadlineUpdateRequest
)

from api.schemas.requests import (
    RequestListResponse,
    RequestDetailResponse,
    RequestCreateRequest,
    RequestUpdateRequest,
    RequestCompleteRequest
)

from api.schemas.alerts import (
    AlertListResponse,
    AlertDetailResponse,
    AlertAcknowledgeRequest
)

from api.schemas.cases import (
    CaseListResponse,
    CaseDetailResponse,
    CaseCreateRequest,
    CaseUpdateRequest
)

from api.schemas.completions import (
    CompletionCreateRequest,
    CompletionStatsResponse
)

__all__ = [
    # Common
    'HealthResponse',
    'MetricsResponse',
    'ErrorResponse',
    'PaginationParams',
    'PaginatedResponse',
    # Deadlines
    'DeadlineListResponse',
    'DeadlineDetailResponse',
    'DeadlineCreateRequest',
    'DeadlineUpdateRequest',
    # Requests
    'RequestListResponse',
    'RequestDetailResponse',
    'RequestCreateRequest',
    'RequestUpdateRequest',
    'RequestCompleteRequest',
    # Alerts
    'AlertListResponse',
    'AlertDetailResponse',
    'AlertAcknowledgeRequest',
    # Cases
    'CaseListResponse',
    'CaseDetailResponse',
    'CaseCreateRequest',
    'CaseUpdateRequest',
    # Completions
    'CompletionCreateRequest',
    'CompletionStatsResponse'
]
