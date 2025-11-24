"""
Models package for Legal Advocate AI Action Item Detector
"""

from models.database import (
    Base,
    Deadline,
    Request,
    Alert,
    Case,
    CompletionTracking,
    get_engine,
    get_session,
    init_db,
    drop_all_tables
)

from models.schemas import (
    # Enums
    DeadlineType,
    ResponsibleParty,
    ItemStatus,
    RequestType,
    Urgency,
    AlertType,
    AlertStatus,
    Channel,
    # Deadline schemas
    DeadlineBase,
    DeadlineCreate,
    DeadlineUpdate,
    DeadlineResponse,
    # Request schemas
    RequestBase,
    RequestCreate,
    RequestUpdate,
    RequestResponse,
    # Alert schemas
    AlertBase,
    AlertCreate,
    AlertUpdate,
    AlertResponse,
    # Composite schemas
    ActionItemSummary,
    DeadlineWithAlerts,
    DashboardResponse,
    # Filter schemas
    DateRangeFilter,
    DeadlineFilter,
    RequestFilter,
)

__all__ = [
    # Database models
    'Base',
    'Deadline',
    'Request',
    'Alert',
    'Case',
    'CompletionTracking',
    'get_engine',
    'get_session',
    'init_db',
    'drop_all_tables',
    # Enums
    'DeadlineType',
    'ResponsibleParty',
    'ItemStatus',
    'RequestType',
    'Urgency',
    'AlertType',
    'AlertStatus',
    'Channel',
    # Deadline schemas
    'DeadlineBase',
    'DeadlineCreate',
    'DeadlineUpdate',
    'DeadlineResponse',
    # Request schemas
    'RequestBase',
    'RequestCreate',
    'RequestUpdate',
    'RequestResponse',
    # Alert schemas
    'AlertBase',
    'AlertCreate',
    'AlertUpdate',
    'AlertResponse',
    # Composite schemas
    'ActionItemSummary',
    'DeadlineWithAlerts',
    'DashboardResponse',
    # Filter schemas
    'DateRangeFilter',
    'DeadlineFilter',
    'RequestFilter',
]
