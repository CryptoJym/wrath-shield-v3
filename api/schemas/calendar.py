"""
Calendar API Schemas
"""

from typing import List, Optional, Literal
from datetime import datetime, date
from pydantic import BaseModel, Field

from api.schemas.common import PaginatedResponse
from models.schemas import DeadlineType, RequestType, ItemStatus, Urgency


class CalendarEventBase(BaseModel):
    """Base calendar event model"""
    id: int = Field(..., description="Event ID")
    title: str = Field(..., description="Event title")
    start: datetime = Field(..., description="Event start time")
    end: Optional[datetime] = Field(None, description="Event end time")
    all_day: bool = Field(False, description="Whether event is all-day")
    event_type: Literal["deadline", "request"] = Field(..., description="Type of event")
    status: ItemStatus = Field(..., description="Event status")
    urgency: Optional[Urgency] = Field(None, description="Event urgency level")
    case_number: Optional[str] = Field(None, description="Associated case number")
    description: Optional[str] = Field(None, description="Event description")

    # Color coding based on urgency and type
    color: str = Field(..., description="Event color for calendar display")
    text_color: str = Field("#ffffff", description="Text color for calendar display")


class DeadlineCalendarEvent(CalendarEventBase):
    """Calendar event for a deadline"""
    event_type: Literal["deadline"] = "deadline"
    deadline_type: DeadlineType = Field(..., description="Type of deadline")
    responsible_party: Optional[str] = Field(None, description="Who is responsible")
    action_required: str = Field(..., description="Required action")


class RequestCalendarEvent(CalendarEventBase):
    """Calendar event for a request"""
    event_type: Literal["request"] = "request"
    request_type: RequestType = Field(..., description="Type of request")
    requested_by: str = Field(..., description="Who requested it")
    what_is_needed: str = Field(..., description="What is needed")


class CalendarEventsResponse(BaseModel):
    """Response containing calendar events"""
    events: List[CalendarEventBase] = Field(..., description="List of calendar events")
    total: int = Field(..., description="Total number of events in date range")

    class Config:
        from_attributes = True


class CalendarFilterParams(BaseModel):
    """Parameters for filtering calendar events"""
    start_date: date = Field(..., description="Start date for calendar view")
    end_date: date = Field(..., description="End date for calendar view")
    event_types: Optional[List[Literal["deadline", "request"]]] = Field(
        None,
        description="Filter by event types"
    )
    statuses: Optional[List[ItemStatus]] = Field(
        None,
        description="Filter by status"
    )
    urgencies: Optional[List[Urgency]] = Field(
        None,
        description="Filter by urgency level"
    )
    case_number: Optional[str] = Field(
        None,
        description="Filter by case number"
    )


class ICalendarExportRequest(BaseModel):
    """Request parameters for iCalendar export"""
    start_date: Optional[date] = Field(
        None,
        description="Start date for export (defaults to today)"
    )
    end_date: Optional[date] = Field(
        None,
        description="End date for export (defaults to 90 days from start)"
    )
    event_types: Optional[List[Literal["deadline", "request"]]] = Field(
        None,
        description="Filter by event types"
    )
    include_completed: bool = Field(
        False,
        description="Include completed events in export"
    )


class GoogleCalendarSyncRequest(BaseModel):
    """Request for Google Calendar sync (future feature stub)"""
    calendar_id: str = Field(..., description="Google Calendar ID to sync with")
    sync_direction: Literal["one_way", "two_way"] = Field(
        "one_way",
        description="Sync direction (one_way = push to Google, two_way = bidirectional)"
    )
    auto_sync: bool = Field(
        False,
        description="Enable automatic syncing"
    )


class GoogleCalendarSyncResponse(BaseModel):
    """Response from Google Calendar sync (future feature stub)"""
    success: bool = Field(..., description="Whether sync was successful")
    message: str = Field(..., description="Status message")
    synced_events: int = Field(0, description="Number of events synced")
    errors: List[str] = Field(default_factory=list, description="Any errors encountered")
