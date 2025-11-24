"""
Pydantic schemas for API request/response validation
Legal Advocate AI Action Item Detector
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


# Enums for validation
class DeadlineType(str, Enum):
    FILING = "filing"
    HEARING = "hearing"
    RESPONSE = "response"
    DISCOVERY = "discovery"
    OTHER = "other"


class ResponsibleParty(str, Enum):
    SELF = "self"
    ATTORNEY = "attorney"
    OPPOSING_PARTY = "opposing_party"
    OTHER = "other"


class ItemStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class RequestType(str, Enum):
    DOCUMENT = "document"
    INFORMATION = "information"
    ACTION = "action"
    MEETING = "meeting"
    OTHER = "other"


class Urgency(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class AlertType(str, Enum):
    DAYS_30 = "30_days"
    DAYS_14 = "14_days"
    DAYS_7 = "7_days"
    DAYS_3 = "3_days"
    DAYS_1 = "1_day"
    SAME_DAY = "same_day"


class AlertStatus(str, Enum):
    SCHEDULED = "scheduled"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Channel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"


# Base schemas
class DeadlineBase(BaseModel):
    case_number: str = Field(..., max_length=50, description="Case number")
    user_id: str = Field(..., max_length=100, description="User identifier")
    deadline_type: DeadlineType = Field(..., description="Type of deadline")
    deadline_date: datetime = Field(..., description="When the deadline occurs")
    action_required: str = Field(..., description="What action must be taken")
    responsible_party: Optional[ResponsibleParty] = Field(None, description="Who is responsible")
    source_document: Optional[str] = Field(None, description="Source document reference")
    source_text: Optional[str] = Field(None, description="Extracted text")
    extraction_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")

    @validator('extraction_confidence')
    def validate_confidence(cls, v):
        if v is not None and (v < 0.0 or v > 1.0):
            raise ValueError('Confidence must be between 0.0 and 1.0')
        return v


class DeadlineCreate(DeadlineBase):
    """Schema for creating a deadline"""
    pass


class DeadlineUpdate(BaseModel):
    """Schema for updating a deadline"""
    deadline_type: Optional[DeadlineType] = None
    deadline_date: Optional[datetime] = None
    action_required: Optional[str] = None
    responsible_party: Optional[ResponsibleParty] = None
    status: Optional[ItemStatus] = None
    completed_at: Optional[datetime] = None


class DeadlineResponse(DeadlineBase):
    """Schema for deadline API response"""
    id: str
    status: ItemStatus
    created_at: datetime
    alerted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Request schemas
class RequestBase(BaseModel):
    case_number: str = Field(..., max_length=50, description="Case number")
    user_id: str = Field(..., max_length=100, description="User identifier")
    request_type: RequestType = Field(..., description="Type of request")
    what_is_needed: str = Field(..., description="What is being requested")
    requested_by: str = Field(..., max_length=200, description="Who made the request")
    requested_date: datetime = Field(..., description="When the request was made")
    deadline: Optional[datetime] = Field(None, description="Request deadline if specified")
    urgency: Urgency = Field(Urgency.NORMAL, description="Request urgency level")
    source_email_id: Optional[str] = Field(None, max_length=200, description="Source email ID")
    source_text: Optional[str] = Field(None, description="Extracted text")


class RequestCreate(RequestBase):
    """Schema for creating a request"""
    pass


class RequestUpdate(BaseModel):
    """Schema for updating a request"""
    request_type: Optional[RequestType] = None
    what_is_needed: Optional[str] = None
    deadline: Optional[datetime] = None
    urgency: Optional[Urgency] = None
    status: Optional[ItemStatus] = None
    completed_at: Optional[datetime] = None


class RequestResponse(RequestBase):
    """Schema for request API response"""
    id: str
    status: ItemStatus
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Alert schemas
class AlertBase(BaseModel):
    deadline_id: str = Field(..., description="Associated deadline ID")
    alert_type: AlertType = Field(..., description="Type of alert")
    scheduled_at: datetime = Field(..., description="When alert should be sent")
    channel: Channel = Field(Channel.EMAIL, description="Notification channel")


class AlertCreate(AlertBase):
    """Schema for creating an alert"""
    pass


class AlertUpdate(BaseModel):
    """Schema for updating an alert"""
    status: Optional[AlertStatus] = None
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None


class AlertResponse(AlertBase):
    """Schema for alert API response"""
    id: str
    status: AlertStatus
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Composite schemas for dashboard
class ActionItemSummary(BaseModel):
    """Summary of all action items for dashboard"""
    total_deadlines: int = Field(0, description="Total number of deadlines")
    pending_deadlines: int = Field(0, description="Pending deadlines")
    overdue_deadlines: int = Field(0, description="Overdue deadlines")
    total_requests: int = Field(0, description="Total number of requests")
    pending_requests: int = Field(0, description="Pending requests")
    urgent_requests: int = Field(0, description="Urgent requests")
    upcoming_alerts: int = Field(0, description="Upcoming alerts in next 7 days")


class DeadlineWithAlerts(DeadlineResponse):
    """Deadline response with associated alerts"""
    alerts: List[AlertResponse] = Field(default_factory=list, description="Associated alerts")


class DashboardResponse(BaseModel):
    """Complete dashboard data"""
    summary: ActionItemSummary
    upcoming_deadlines: List[DeadlineWithAlerts] = Field(default_factory=list)
    pending_requests: List[RequestResponse] = Field(default_factory=list)
    recent_alerts: List[AlertResponse] = Field(default_factory=list)


# Search and filter schemas
class DateRangeFilter(BaseModel):
    """Filter by date range"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class DeadlineFilter(BaseModel):
    """Filters for deadline queries"""
    case_number: Optional[str] = None
    user_id: Optional[str] = None
    deadline_type: Optional[DeadlineType] = None
    status: Optional[ItemStatus] = None
    responsible_party: Optional[ResponsibleParty] = None
    date_range: Optional[DateRangeFilter] = None


class RequestFilter(BaseModel):
    """Filters for request queries"""
    case_number: Optional[str] = None
    user_id: Optional[str] = None
    request_type: Optional[RequestType] = None
    status: Optional[ItemStatus] = None
    urgency: Optional[Urgency] = None
    date_range: Optional[DateRangeFilter] = None
