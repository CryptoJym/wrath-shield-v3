"""
Calendar API Routes
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from fastapi.responses import StreamingResponse
from datetime import datetime, date, timedelta
from io import BytesIO
from icalendar import Calendar, Event as ICalEvent, vText

from api.dependencies import get_deadline_repo, get_request_repo, get_current_user
from api.schemas.calendar import (
    CalendarEventsResponse,
    CalendarEventBase,
    DeadlineCalendarEvent,
    RequestCalendarEvent,
    ICalendarExportRequest,
    GoogleCalendarSyncRequest,
    GoogleCalendarSyncResponse
)
from repositories import DeadlineRepository, RequestRepository
from models.schemas import ItemStatus, Urgency
from utils.monitoring import track_performance

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

# Color mapping for urgency levels (matching dashboard)
URGENCY_COLORS = {
    "urgent": "#ff4444",     # Red
    "high": "#ff8c00",       # Orange
    "medium": "#ffd700",     # Yellow
    "low": "#1e90ff"         # Blue
}

# Type colors (fallback when no urgency)
TYPE_COLORS = {
    "deadline": "#dc3545",   # Red
    "request": "#007bff"     # Blue
}


def _calculate_urgency(due_date: datetime) -> Urgency:
    """Calculate urgency based on due date"""
    days_until = (due_date.date() - date.today()).days

    if days_until < 0:
        return Urgency.URGENT  # Overdue
    elif days_until <= 1:
        return Urgency.URGENT
    elif days_until <= 3:
        return Urgency.HIGH
    elif days_until <= 7:
        return Urgency.MEDIUM
    else:
        return Urgency.LOW


def _get_event_color(urgency: Optional[Urgency], event_type: str) -> str:
    """Get color for event based on urgency or type"""
    if urgency:
        return URGENCY_COLORS.get(urgency.value, TYPE_COLORS.get(event_type, "#6c757d"))
    return TYPE_COLORS.get(event_type, "#6c757d")


def _deadline_to_calendar_event(deadline) -> DeadlineCalendarEvent:
    """Convert deadline to calendar event"""
    urgency = _calculate_urgency(deadline.due_date)

    return DeadlineCalendarEvent(
        id=deadline.id,
        title=f"[{deadline.deadline_type.value.upper()}] {deadline.action_required}",
        start=deadline.due_date,
        end=deadline.due_date,
        all_day=True,
        event_type="deadline",
        status=deadline.status,
        urgency=urgency,
        case_number=deadline.case_number,
        description=deadline.action_required,
        color=_get_event_color(urgency, "deadline"),
        deadline_type=deadline.deadline_type,
        responsible_party=deadline.responsible_party.value if deadline.responsible_party else None,
        action_required=deadline.action_required
    )


def _request_to_calendar_event(request) -> RequestCalendarEvent:
    """Convert request to calendar event"""
    # Use deadline if set, otherwise use requested_date
    event_date = request.deadline if request.deadline else request.requested_date
    urgency = request.urgency if request.urgency else _calculate_urgency(event_date)

    return RequestCalendarEvent(
        id=request.id,
        title=f"[{request.request_type.value.upper()}] {request.what_is_needed[:50]}...",
        start=event_date,
        end=event_date,
        all_day=True,
        event_type="request",
        status=request.status,
        urgency=urgency,
        case_number=request.case_number,
        description=request.what_is_needed,
        color=_get_event_color(urgency, "request"),
        request_type=request.request_type,
        requested_by=request.requested_by,
        what_is_needed=request.what_is_needed
    )


@router.get("/events", response_model=CalendarEventsResponse)
@track_performance()
async def get_calendar_events(
    start_date: date = Query(..., description="Start date for calendar view"),
    end_date: date = Query(..., description="End date for calendar view"),
    event_types: Optional[str] = Query(None, description="Comma-separated event types (deadline,request)"),
    statuses: Optional[str] = Query(None, description="Comma-separated statuses"),
    urgencies: Optional[str] = Query(None, description="Comma-separated urgency levels"),
    case_number: Optional[str] = Query(None, description="Filter by case number"),
    deadline_repo: DeadlineRepository = Depends(get_deadline_repo),
    request_repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Get calendar events for a date range

    Returns deadlines and/or requests formatted as calendar events with:
    - Color coding by urgency (red/orange/yellow/blue)
    - Event type identification
    - Status tracking
    - Case association
    """
    events = []

    # Parse filters
    event_type_list = event_types.split(",") if event_types else ["deadline", "request"]
    status_list = [ItemStatus(s) for s in statuses.split(",")] if statuses else None
    urgency_list = [Urgency(u) for u in urgencies.split(",")] if urgencies else None

    # Get deadlines if requested
    if "deadline" in event_type_list:
        filters = {}
        if case_number:
            filters['case_number'] = case_number

        deadlines = deadline_repo.filter_by(**filters)

        for deadline in deadlines:
            # Filter by date range
            if start_date <= deadline.due_date.date() <= end_date:
                # Filter by status if specified
                if status_list and deadline.status not in status_list:
                    continue

                event = _deadline_to_calendar_event(deadline)

                # Filter by urgency if specified
                if urgency_list and event.urgency not in urgency_list:
                    continue

                events.append(event)

    # Get requests if requested
    if "request" in event_type_list:
        filters = {}
        if case_number:
            filters['case_number'] = case_number

        requests = request_repo.filter_by(**filters)

        for request in requests:
            # Use deadline if set, otherwise requested_date
            event_date = request.deadline if request.deadline else request.requested_date

            # Filter by date range
            if start_date <= event_date.date() <= end_date:
                # Filter by status if specified
                if status_list and request.status not in status_list:
                    continue

                event = _request_to_calendar_event(request)

                # Filter by urgency if specified
                if urgency_list and event.urgency not in urgency_list:
                    continue

                events.append(event)

    # Sort by start date
    events.sort(key=lambda e: e.start)

    return CalendarEventsResponse(
        events=events,
        total=len(events)
    )


@router.get("/export")
@track_performance()
async def export_icalendar(
    start_date: Optional[date] = Query(None, description="Start date (defaults to today)"),
    end_date: Optional[date] = Query(None, description="End date (defaults to +90 days)"),
    event_types: Optional[str] = Query(None, description="Comma-separated event types"),
    include_completed: bool = Query(False, description="Include completed events"),
    deadline_repo: DeadlineRepository = Depends(get_deadline_repo),
    request_repo: RequestRepository = Depends(get_request_repo),
    current_user: dict = Depends(get_current_user)
):
    """
    Export calendar events to iCalendar (.ics) format

    Compatible with:
    - Google Calendar
    - Apple Calendar
    - Outlook
    - Any iCalendar-compatible application
    """
    # Set default date range
    if not start_date:
        start_date = date.today()
    if not end_date:
        end_date = start_date + timedelta(days=90)

    # Create calendar
    cal = Calendar()
    cal.add('prodid', '-//Legal Advocate AI//Calendar Export//EN')
    cal.add('version', '2.0')
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', 'Legal Deadlines & Requests')
    cal.add('x-wr-timezone', 'UTC')

    # Parse event types
    event_type_list = event_types.split(",") if event_types else ["deadline", "request"]

    # Add deadlines
    if "deadline" in event_type_list:
        filters = {}
        if not include_completed:
            filters['status'] = ItemStatus.PENDING

        deadlines = deadline_repo.filter_by(**filters)

        for deadline in deadlines:
            if start_date <= deadline.due_date.date() <= end_date:
                event = ICalEvent()
                event.add('summary', f"[DEADLINE] {deadline.action_required}")
                event.add('dtstart', deadline.due_date.date())
                event.add('dtend', deadline.due_date.date())
                event.add('dtstamp', datetime.now())
                event.add('uid', f"deadline-{deadline.id}@legaladvocate.ai")
                event.add('description', f"""
Type: {deadline.deadline_type.value}
Case: {deadline.case_number}
Responsible: {deadline.responsible_party.value if deadline.responsible_party else 'N/A'}
Action Required: {deadline.action_required}
Status: {deadline.status.value}
                """.strip())
                event.add('status', 'CONFIRMED' if deadline.status == ItemStatus.PENDING else 'CANCELLED')
                event.add('categories', [deadline.deadline_type.value, 'deadline'])

                # Add urgency as priority
                urgency = _calculate_urgency(deadline.due_date)
                priority_map = {
                    Urgency.URGENT: 1,
                    Urgency.HIGH: 3,
                    Urgency.MEDIUM: 5,
                    Urgency.LOW: 7
                }
                event.add('priority', priority_map.get(urgency, 5))

                cal.add_component(event)

    # Add requests
    if "request" in event_type_list:
        filters = {}
        if not include_completed:
            filters['status'] = ItemStatus.PENDING

        requests = request_repo.filter_by(**filters)

        for request in requests:
            event_date = request.deadline if request.deadline else request.requested_date

            if start_date <= event_date.date() <= end_date:
                event = ICalEvent()
                event.add('summary', f"[REQUEST] {request.what_is_needed[:50]}...")
                event.add('dtstart', event_date.date())
                event.add('dtend', event_date.date())
                event.add('dtstamp', datetime.now())
                event.add('uid', f"request-{request.id}@legaladvocate.ai")
                event.add('description', f"""
Type: {request.request_type.value}
Case: {request.case_number}
Requested By: {request.requested_by}
What Is Needed: {request.what_is_needed}
Status: {request.status.value}
                """.strip())
                event.add('status', 'CONFIRMED' if request.status == ItemStatus.PENDING else 'CANCELLED')
                event.add('categories', [request.request_type.value, 'request'])

                # Add urgency as priority
                urgency = request.urgency if request.urgency else _calculate_urgency(event_date)
                priority_map = {
                    Urgency.URGENT: 1,
                    Urgency.HIGH: 3,
                    Urgency.MEDIUM: 5,
                    Urgency.LOW: 7
                }
                event.add('priority', priority_map.get(urgency, 5))

                cal.add_component(event)

    # Generate ICS file
    ics_content = cal.to_ical()

    # Return as downloadable file
    return StreamingResponse(
        BytesIO(ics_content),
        media_type="text/calendar",
        headers={
            "Content-Disposition": f"attachment; filename=legal_calendar_{start_date}_{end_date}.ics"
        }
    )


@router.post("/sync", response_model=GoogleCalendarSyncResponse)
@track_performance()
async def sync_google_calendar(
    sync_request: GoogleCalendarSyncRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Sync with Google Calendar (STUB - Future Feature)

    This endpoint is a placeholder for future Google Calendar integration.
    Currently returns a not implemented message.

    Future implementation will:
    - Authenticate with Google Calendar API
    - Push deadlines/requests to specified calendar
    - Optionally sync changes back (two-way sync)
    - Handle conflict resolution
    - Support automatic background syncing
    """
    return GoogleCalendarSyncResponse(
        success=False,
        message="Google Calendar sync not yet implemented. Use iCalendar export for now.",
        synced_events=0,
        errors=["Feature coming soon - use /api/calendar/export for iCalendar format"]
    )
