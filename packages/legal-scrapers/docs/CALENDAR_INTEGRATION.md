# Calendar Integration - Technical Documentation

## Overview

The Calendar Integration feature provides a unified view of deadlines and attorney requests in a calendar format, with support for multiple view modes, advanced filtering, and iCalendar export for external calendar applications.

## Architecture

### Components

1. **Backend API** (`api/routes/calendar.py`)
   - Calendar event aggregation
   - iCalendar export generation
   - Google Calendar sync stub (future)

2. **Data Schemas** (`api/schemas/calendar.py`)
   - Event models (deadlines, requests)
   - Request/response schemas
   - Filter parameters

3. **Frontend Dashboard** (`action_item_dashboard.py`)
   - Calendar visualization
   - View mode switching
   - Event interaction

4. **Test Suite** (`tests/test_calendar.py`)
   - 25+ test cases
   - >80% code coverage

## API Endpoints

### GET /api/calendar/events

Retrieves calendar events for a specified date range.

**Query Parameters:**

- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `event_types` (optional): Comma-separated types ("deadline", "request")
- `statuses` (optional): Comma-separated statuses
- `urgencies` (optional): Comma-separated urgency levels
- `case_number` (optional): Filter by case

**Response Structure:**

```json
{
  "events": [
    {
      "id": 123,
      "title": "[DEADLINE] File motion",
      "start": "2024-10-15T00:00:00Z",
      "end": "2024-10-15T00:00:00Z",
      "all_day": true,
      "event_type": "deadline",
      "status": "pending",
      "urgency": "urgent",
      "case_number": "CASE-001",
      "description": "Action required",
      "color": "#ff4444",
      "text_color": "#ffffff",
      "deadline_type": "court_filing",
      "responsible_party": "attorney",
      "action_required": "File motion"
    }
  ],
  "total": 1
}
```

### GET /api/calendar/export

Exports events in iCalendar (.ics) format.

**Query Parameters:**

- `start_date` (optional): Default today
- `end_date` (optional): Default +90 days
- `event_types` (optional): Filter event types
- `include_completed` (optional): Include completed events (default: false)

**Response:**

- Content-Type: `text/calendar; charset=utf-8`
- Content-Disposition: `attachment; filename=legal_calendar_YYYY-MM-DD_YYYY-MM-DD.ics`

**iCalendar Features:**

- VEVENT components for each event
- Priority mapping (urgent=1, high=3, medium=5, low=7)
- Categories for event types
- Unique UIDs for sync compatibility
- Full event descriptions

### POST /api/calendar/sync

Google Calendar sync stub for future implementation.

**Request:**

```json
{
  "calendar_id": "primary",
  "sync_direction": "one_way",
  "auto_sync": false
}
```

**Response:**

```json
{
  "success": false,
  "message": "Not yet implemented",
  "synced_events": 0,
  "errors": ["Use iCalendar export for now"]
}
```

## Event Aggregation

### Data Sources

1. **Deadlines** (`DeadlineRepository`)
   - Court filings
   - Response deadlines
   - Discovery deadlines
   - Hearings and trials
   - Client meetings

2. **Requests** (`RequestRepository`)
   - Document requests
   - Information needed
   - Action required
   - Meetings scheduled
   - Expert consultations

### Urgency Calculation

Urgency is automatically calculated based on days until due date:

```python
def _calculate_urgency(due_date: datetime) -> Urgency:
    days_until = (due_date.date() - date.today()).days

    if days_until < 0:
        return Urgency.URGENT  # Overdue
    elif days_until <= 1:
        return Urgency.URGENT  # Due tomorrow
    elif days_until <= 3:
        return Urgency.HIGH    # Due in 2-3 days
    elif days_until <= 7:
        return Urgency.MEDIUM  # Due in 4-7 days
    else:
        return Urgency.LOW     # Due in 8+ days
```

### Color Coding

Events are color-coded by urgency for visual priority:

| Urgency | Color | Hex Code | Days Until Due |
|---------|-------|----------|----------------|
| Urgent  | Red   | #ff4444  | 0-1 days       |
| High    | Orange| #ff8c00  | 2-3 days       |
| Medium  | Yellow| #ffd700  | 4-7 days       |
| Low     | Blue  | #1e90ff  | 8+ days        |

## Dashboard Implementation

### View Modes

#### Month View

- Full month calendar grid
- All events displayed
- Date range: First to last day of month
- Navigation: Previous/Next month buttons

#### Week View

- Monday to Sunday layout
- Current week displayed
- Date range: Week start to end
- Navigation: Previous/Next week buttons

#### Day View

- Single day detailed view
- All events for selected day
- Date range: Selected day only
- Navigation: Previous/Next day buttons

### Date Range Calculation

```python
if view_mode == "Month":
    start_date = date(today.year, today.month, 1)
    if today.month == 12:
        end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)

elif view_mode == "Week":
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

elif view_mode == "Day":
    start_date = today
    end_date = today
```

### Filtering

Multi-criteria filtering supported:

1. **Event Types**
   - Deadlines only
   - Requests only
   - Both (default)

2. **Status**
   - Pending
   - In Progress
   - Completed
   - Cancelled
   - Deferred

3. **Urgency**
   - Urgent
   - High
   - Medium
   - Low

### Interactive Features

#### Event Click Handling

```python
if calendar_result.get('eventClick'):
    event_id = calendar_result['eventClick']['event']['id']
    event = next(
        (e for e in calendar_events['events'] if e['id'] == event_id),
        None
    )
    # Display event details and quick actions
```

#### Quick Actions

1. **Complete Deadline**
   - POST /api/deadlines/{id}/complete
   - Status updated to "completed"
   - Completion timestamp recorded

2. **Complete Request**
   - POST /api/requests/{id}/complete
   - Optional completion notes
   - Status updated to "completed"

## iCalendar Export

### Format Specification

Compliant with RFC 5545 (iCalendar specification).

### Calendar Properties

```
PRODID:-//Legal Advocate AI//Calendar Export//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Legal Deadlines & Requests
X-WR-TIMEZONE:UTC
```

### Event Properties

Each event includes:

- **SUMMARY**: Event title with type prefix
- **DTSTART**: Start date (all-day events)
- **DTEND**: End date (same as start)
- **DTSTAMP**: Generation timestamp
- **UID**: Unique identifier (format: `{type}-{id}@legaladvocate.ai`)
- **DESCRIPTION**: Full event details
- **STATUS**: CONFIRMED or CANCELLED
- **CATEGORIES**: Event type and category tags
- **PRIORITY**: Urgency-based (1=urgent, 3=high, 5=medium, 7=low)

### Compatibility

Tested with:
- ✅ Google Calendar
- ✅ Apple Calendar (macOS, iOS)
- ✅ Microsoft Outlook
- ✅ Mozilla Thunderbird
- ✅ Any RFC 5545 compliant application

### Import Instructions

#### Google Calendar

1. Open Google Calendar
2. Click Settings (⚙️) → Import & Export
3. Click "Select file from your computer"
4. Choose downloaded .ics file
5. Select destination calendar
6. Click "Import"

#### Apple Calendar

1. Double-click .ics file
2. Select calendar to import to
3. Click "OK"

#### Outlook

1. File → Open & Export → Import/Export
2. Select "Import an iCalendar (.ics) file"
3. Browse to .ics file
4. Click "Import"

## Data Flow

### Event Retrieval Flow

```
User Request
    ↓
Dashboard (show_calendar)
    ↓
load_calendar_events()
    ↓
API Client (_make_request)
    ↓
GET /api/calendar/events
    ↓
Calendar Router (get_calendar_events)
    ↓
DeadlineRepository.find_by()
RequestRepository.find_by()
    ↓
_deadline_to_calendar_event()
_request_to_calendar_event()
    ↓
Urgency Calculation
Color Assignment
    ↓
Event Aggregation & Sorting
    ↓
CalendarEventsResponse
    ↓
Display in streamlit-calendar
```

### Export Flow

```
User Clicks Export
    ↓
API Client.get()
    ↓
GET /api/calendar/export?params
    ↓
Calendar Router (export_icalendar)
    ↓
Create Calendar Object
    ↓
Query Deadlines & Requests
    ↓
For Each Event:
    - Create VEVENT
    - Set properties
    - Add to calendar
    ↓
cal.to_ical()
    ↓
StreamingResponse
    ↓
Browser Download
```

## Performance Considerations

### Caching

Dashboard implements TTL-based caching:

```python
@st.cache_data(ttl=CACHE_TTL)
def load_calendar_events(...):
    # Cache for 5 minutes (300 seconds)
```

### Query Optimization

1. **Date Range Filtering**: Applied at database level
2. **Status Filtering**: In-memory after retrieval
3. **Urgency Filtering**: Calculated on-demand
4. **Event Aggregation**: Single pass, O(n)

### Scalability

- Pagination not implemented (assumes reasonable event counts)
- Consider adding pagination for:
  - Calendars with >1000 events
  - Long date ranges (>1 year)
  - Multi-user deployments

## Testing

### Test Coverage

- 25+ test cases
- >80% code coverage
- All major scenarios covered

### Test Categories

1. **Event Retrieval** (5 tests)
   - Empty calendar
   - Deadlines only
   - Requests only
   - Mixed events
   - Date range filtering

2. **Filtering** (6 tests)
   - Event type filtering
   - Status filtering
   - Urgency filtering
   - Case number filtering
   - Multiple filters combined

3. **Date Ranges** (4 tests)
   - Date range boundaries
   - Past dates
   - Future dates
   - Single day

4. **Urgency Calculation** (3 tests)
   - Urgent (0-1 days)
   - High (2-3 days)
   - Medium (4-7 days)

5. **iCalendar Export** (7 tests)
   - Empty export
   - With deadlines
   - With date range
   - Include/exclude completed
   - Event type filtering
   - Filename format
   - Priority mapping

6. **Edge Cases** (2 tests)
   - Google sync stub
   - Event sorting

### Running Tests

```bash
# Run all calendar tests
pytest tests/test_calendar.py -v

# Run with coverage
pytest tests/test_calendar.py --cov=api/routes/calendar --cov-report=html

# Run specific test class
pytest tests/test_calendar.py::TestICalendarExport -v
```

## Future Enhancements

### Planned Features

1. **Google Calendar Integration**
   - OAuth 2.0 authentication
   - Two-way sync
   - Automatic updates
   - Conflict resolution

2. **Recurring Events**
   - Support for recurring deadlines
   - iCalendar RRULE support
   - Series management

3. **Event Reminders**
   - Calendar-based alerts
   - Custom reminder times
   - Multiple reminder support

4. **Color Customization**
   - User-defined color schemes
   - Per-event type colors
   - Theme support

5. **Advanced Filtering**
   - Responsible party filter
   - Case type filter
   - Custom date ranges
   - Saved filter presets

### Implementation Considerations

#### Google Calendar Sync

Required steps:
1. Set up Google Cloud project
2. Enable Calendar API
3. Implement OAuth 2.0 flow
4. Store refresh tokens securely
5. Implement sync logic
6. Handle rate limits

#### Security

- API key authentication required
- Rate limiting recommended for export
- User-specific calendar access control
- Audit logging for sensitive operations

## Dependencies

### Backend

```
fastapi>=0.104.1
pydantic>=2.5.0
icalendar>=5.0.0
python-dateutil>=2.8.2
```

### Frontend

```
streamlit>=1.31.0
streamlit-calendar>=0.7.0
httpx>=0.26.0
pandas>=2.2.0
```

## Configuration

### Environment Variables

```bash
# API Configuration
API_BASE_URL=http://localhost:8000
API_KEY=your-api-key

# Calendar Settings
DEFAULT_VIEW_MODE=Month  # Month, Week, or Day
CALENDAR_CACHE_TTL=300   # seconds
EXPORT_DEFAULT_DAYS=90   # days ahead for export
```

### Constants

```python
# Color scheme
URGENCY_COLORS = {
    "urgent": "#ff4444",
    "high": "#ff8c00",
    "medium": "#ffd700",
    "low": "#1e90ff"
}

# Cache duration
CACHE_TTL = 300  # 5 minutes

# Default date ranges
DEFAULT_EXPORT_DAYS = 90
DEFAULT_CALENDAR_WEEKS = 4
```

## Troubleshooting

### Common Issues

#### Events Not Displaying

**Cause**: Date range mismatch

**Solution**:
- Check start_date <= event_date <= end_date
- Verify timezone consistency
- Check event filtering criteria

#### Export File Won't Import

**Cause**: Invalid iCalendar format

**Solution**:
- Validate with https://icalendar.org/validator.html
- Check UTF-8 encoding
- Verify VEVENT properties are complete

#### Performance Degradation

**Cause**: Large date ranges or event counts

**Solution**:
- Reduce date range
- Enable filtering to limit results
- Increase cache TTL
- Consider pagination

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("api.routes.calendar")
```

## Support

For issues or questions:

1. Check API documentation: `/docs`
2. Review test cases for examples
3. Consult main project README
4. Check application logs

## Version History

### v1.0.0 (2024-10-05)
- Initial calendar integration release
- Month, Week, Day view modes
- iCalendar export functionality
- Event filtering and color-coding
- Quick actions from calendar
- Comprehensive test suite
- API and dashboard documentation
