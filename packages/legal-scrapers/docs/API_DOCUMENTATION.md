# Legal Advocate AI - API Documentation

## Overview

The Legal Advocate AI API provides a RESTful interface for managing legal deadlines, attorney requests, alerts, cases, and completion tracking. Built with FastAPI, it features automatic OpenAPI documentation, request validation, and comprehensive error handling.

## Base URL

```
http://localhost:8000
```

## Authentication

All API endpoints (except system endpoints) require API key authentication via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/deadlines
```

Default development API key: `dev-key-change-in-production`
Set production key via environment variable: `API_KEY`

## API Endpoints

### System Endpoints

#### Health Check
```
GET /health
```

Returns system health status and metrics.

**Response:**
```json
{
  "status": "healthy",
  "uptime_seconds": 3600.0,
  "total_operations": 1000,
  "total_errors": 5,
  "success_rate": 99.5,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Metrics
```
GET /metrics
```

Returns comprehensive system metrics including performance, errors, and gauges.

### Deadlines

#### List Deadlines
```
GET /api/deadlines
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, completed, cancelled)
- `deadline_type` (optional): Filter by type (court_filing, response_deadline, etc.)
- `case_id` (optional): Filter by case ID
- `user_id` (optional): Filter by user ID
- `due_after` (optional): Filter deadlines due after this date (ISO 8601)
- `due_before` (optional): Filter deadlines due before this date (ISO 8601)
- `skip` (optional): Pagination offset (default: 0)
- `limit` (optional): Maximum results (default: 100, max: 1000)

**Example:**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:8000/api/deadlines?status=pending&limit=10"
```

#### Create Deadline
```
POST /api/deadlines
```

**Request Body:**
```json
{
  "case_id": 1,
  "deadline_type": "court_filing",
  "due_date": "2024-12-31T23:59:59Z",
  "description": "File response to motion",
  "responsible_party": "attorney",
  "notes": "Urgent - requires review"
}
```

#### Get Deadline
```
GET /api/deadlines/{deadline_id}
```

#### Update Deadline
```
PUT /api/deadlines/{deadline_id}
```

**Request Body (all fields optional):**
```json
{
  "description": "Updated description",
  "status": "completed",
  "notes": "Additional notes"
}
```

#### Delete Deadline
```
DELETE /api/deadlines/{deadline_id}
```

Returns 204 No Content on success.

#### Complete Deadline
```
POST /api/deadlines/{deadline_id}/complete
```

Marks deadline as completed and records completion timestamp.

### Requests

#### List Requests
```
GET /api/requests
```

**Query Parameters:**
- `status` (optional): Filter by status
- `request_type` (optional): Filter by type (document_request, information_needed, etc.)
- `urgency` (optional): Filter by urgency (urgent, high, medium, low)
- `case_id` (optional): Filter by case ID
- `user_id` (optional): Filter by user ID
- `skip` (optional): Pagination offset
- `limit` (optional): Maximum results

#### Create Request
```
POST /api/requests
```

**Request Body:**
```json
{
  "case_id": 1,
  "request_type": "document_request",
  "description": "Need signed declaration",
  "urgency": "high",
  "notes": "Client must sign by Friday"
}
```

#### Get Request
```
GET /api/requests/{request_id}
```

#### Update Request
```
PUT /api/requests/{request_id}
```

#### Complete Request
```
POST /api/requests/{request_id}/complete
```

**Request Body:**
```json
{
  "notes": "Request fulfilled - document received"
}
```

### Alerts

#### List Alerts
```
GET /api/alerts
```

**Query Parameters:**
- `status` (optional): Filter by status (scheduled, sent, acknowledged, cancelled)
- `alert_type` (optional): Filter by type (seven_day, three_day, one_day, same_day)
- `deadline_id` (optional): Filter by deadline ID
- `user_id` (optional): Filter by user ID
- `scheduled_after` (optional): Filter by schedule time (ISO 8601)
- `scheduled_before` (optional): Filter by schedule time (ISO 8601)
- `skip` (optional): Pagination offset
- `limit` (optional): Maximum results

#### List Upcoming Alerts
```
GET /api/alerts/upcoming
```

**Query Parameters:**
- `hours` (optional): Hours to look ahead (default: 24, max: 168)
- `skip` (optional): Pagination offset
- `limit` (optional): Maximum results

Returns alerts scheduled within the next N hours.

#### Get Alert
```
GET /api/alerts/{alert_id}
```

#### Acknowledge Alert
```
PUT /api/alerts/{alert_id}/acknowledge
```

**Request Body:**
```json
{
  "notes": "Alert acknowledged and reviewed"
}
```

#### Cancel Alert
```
POST /api/alerts/{alert_id}/cancel
```

Cancels a scheduled alert (only works for alerts with status "scheduled").

### Cases

#### List Cases
```
GET /api/cases
```

**Query Parameters:**
- `status` (optional): Filter by status (active, closed, pending)
- `user_id` (optional): Filter by user ID
- `skip` (optional): Pagination offset
- `limit` (optional): Maximum results

#### Create Case
```
POST /api/cases
```

**Request Body:**
```json
{
  "case_number": "2024-CV-12345",
  "title": "Smith v. Jones",
  "client_name": "John Smith",
  "status": "active",
  "notes": "Initial filing"
}
```

#### Get Case
```
GET /api/cases/{case_id}
```

Returns case details including counts of related deadlines, requests, and alerts.

#### Update Case
```
PUT /api/cases/{case_id}
```

**Request Body (all fields optional):**
```json
{
  "status": "closed",
  "notes": "Case settled out of court"
}
```

### Completion Tracking

#### Track Completion
```
POST /api/completions
```

**Request Body:**
```json
{
  "item_type": "deadline",
  "item_id": 123,
  "user_id": 1,
  "completion_notes": "Filed electronically via court portal"
}
```

#### Get Completion Stats
```
GET /api/completions/stats
```

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `start_date` (optional): Start of date range (ISO 8601)
- `end_date` (optional): End of date range (ISO 8601)

**Response:**
```json
{
  "user_id": 1,
  "total_completed": 150,
  "deadlines_completed": 100,
  "requests_completed": 50,
  "completion_rate": 95.5,
  "average_completion_time": 12.5,
  "period_start": "2024-01-01T00:00:00Z",
  "period_end": "2024-12-31T23:59:59Z"
}
```

#### Get Recent Completions
```
GET /api/completions/recent
```

**Query Parameters:**
- `user_id` (optional): Filter by user ID
- `limit` (optional): Number of items (default: 10, max: 100)

Returns the most recent completed items for activity feed.

### Calendar

#### Get Calendar Events
```
GET /api/calendar/events
```

Retrieves calendar events (deadlines and requests) for a specified date range with color-coding by urgency.

**Query Parameters (Required):**
- `start_date`: Start date for calendar view (YYYY-MM-DD)
- `end_date`: End date for calendar view (YYYY-MM-DD)

**Query Parameters (Optional):**
- `event_types`: Comma-separated event types (e.g., "deadline,request")
- `statuses`: Comma-separated statuses to filter by
- `urgencies`: Comma-separated urgency levels to filter by
- `case_number`: Filter by specific case number

**Example:**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:8000/api/calendar/events?start_date=2024-10-01&end_date=2024-10-31&urgencies=urgent,high"
```

**Response:**
```json
{
  "events": [
    {
      "id": 123,
      "title": "[COURT_FILING] File urgent motion",
      "start": "2024-10-15T00:00:00Z",
      "end": "2024-10-15T00:00:00Z",
      "all_day": true,
      "event_type": "deadline",
      "status": "pending",
      "urgency": "urgent",
      "case_number": "CASE-001",
      "description": "File urgent motion",
      "color": "#ff4444",
      "text_color": "#ffffff",
      "deadline_type": "court_filing",
      "responsible_party": "attorney",
      "action_required": "File urgent motion"
    }
  ],
  "total": 1
}
```

**Color Scheme:**
- Urgent: #ff4444 (Red) - Due tomorrow or overdue
- High: #ff8c00 (Orange) - Due in 2-3 days
- Medium: #ffd700 (Yellow) - Due in 4-7 days
- Low: #1e90ff (Blue) - Due in 8+ days

#### Export to iCalendar
```
GET /api/calendar/export
```

Exports calendar events in iCalendar (.ics) format compatible with Google Calendar, Apple Calendar, Outlook, and other calendar applications.

**Query Parameters (Optional):**
- `start_date`: Start date (default: today)
- `end_date`: End date (default: +90 days from start)
- `event_types`: Comma-separated event types to include
- `include_completed`: Include completed events (default: false)

**Example:**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:8000/api/calendar/export?start_date=2024-10-01&end_date=2024-12-31" \
  -o calendar.ics
```

**Response:**
- Content-Type: text/calendar
- Downloadable .ics file
- Filename format: `legal_calendar_YYYY-MM-DD_YYYY-MM-DD.ics`

**iCalendar Features:**
- All-day events for deadlines and requests
- Priority mapping (urgent=1, high=3, medium=5, low=7)
- Categories for event types
- Full event descriptions with case details
- Compatible status flags (CONFIRMED/CANCELLED)
- Unique UIDs for calendar sync

#### Sync with Google Calendar (Stub)
```
POST /api/calendar/sync
```

**Note:** This is a placeholder endpoint for future Google Calendar integration.

**Request Body:**
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
  "message": "Google Calendar sync not yet implemented. Use iCalendar export for now.",
  "synced_events": 0,
  "errors": ["Feature coming soon - use /api/calendar/export for iCalendar format"]
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "details": {
    "field": "specific_field",
    "issue": "what went wrong"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Common Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing API key
- `403 Forbidden`: Invalid API key
- `404 Not Found`: Resource not found
- `405 Method Not Allowed`: Wrong HTTP method
- `409 Conflict`: Resource conflict (e.g., duplicate case number)
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

## Pagination

List endpoints support pagination via `skip` and `limit` parameters.

**Response Format:**
```json
{
  "items": [...],
  "total": 500,
  "skip": 0,
  "limit": 100,
  "has_more": true
}
```

To get next page:
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:8000/api/deadlines?skip=100&limit=100"
```

## Data Types

### Enums

**DeadlineType:**
- `court_filing`
- `response_deadline`
- `discovery_deadline`
- `hearing_date`
- `trial_date`

**ResponsibleParty:**
- `attorney`
- `paralegal`
- `client`
- `opposing_counsel`

**ItemStatus:**
- `pending`
- `in_progress`
- `completed`
- `cancelled`
- `deferred`

**RequestType:**
- `document_request`
- `information_needed`
- `action_required`
- `meeting_scheduled`

**Urgency:**
- `urgent`
- `high`
- `medium`
- `low`

**AlertType:**
- `thirty_day`
- `fourteen_day`
- `seven_day`
- `three_day`
- `one_day`
- `same_day`

**AlertStatus:**
- `scheduled`
- `sent`
- `acknowledged`
- `failed`
- `cancelled`

**Channel:**
- `email`
- `sms`
- `push_notification`
- `in_app`

## Rate Limiting

Currently no rate limiting is implemented. This will be added in a future version.

## Interactive Documentation

### OpenAPI (Swagger) UI
Visit: `http://localhost:8000/docs`

Features:
- Interactive API explorer
- Try out endpoints directly
- View request/response schemas
- Authentication configuration

### ReDoc
Visit: `http://localhost:8000/redoc`

Features:
- Clean, professional documentation
- Easy navigation
- Printable format
- Code samples

## Development

### Starting the Server

```bash
# Using startup script
./run_api.py

# Or directly with uvicorn
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

### Environment Variables

Create `.env` file:
```bash
# API Configuration
API_KEY=your-secret-api-key
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
API_LOG_LEVEL=info

# Database
DATABASE_URL=sqlite:///~/.legal_advocate_ai/action_items.db

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Running Tests

```bash
# Run API tests
pytest tests/test_api.py -v

# Run with coverage
pytest tests/test_api.py --cov=api --cov-report=html

# Run specific test class
pytest tests/test_api.py::TestDeadlineAPI -v
```

## Monitoring

### Health Monitoring

```bash
# Check system health
curl http://localhost:8000/health

# Get detailed metrics
curl http://localhost:8000/metrics
```

### Logging

All requests are logged with:
- Request ID
- Method and path
- Query parameters
- Response status
- Duration
- Client IP

Example log:
```
INFO: Incoming request: GET /api/deadlines [request_id=1234567890]
INFO: Request completed: GET /api/deadlines [status=200, duration=45ms]
```

### Performance Tracking

All operations are tracked with:
- Call count
- Average/min/max duration
- P95 latency
- Error rate
- Success rate

Access via `/metrics` endpoint.

## Best Practices

1. **Always use pagination** for list endpoints
2. **Include error handling** for all API calls
3. **Use specific filters** to reduce payload size
4. **Check health endpoint** before operations
5. **Monitor metrics** for performance issues
6. **Use appropriate HTTP methods** (GET for reads, POST for creates, etc.)
7. **Include request IDs** in support requests (from `X-Request-ID` header)
8. **Set realistic timeouts** for long-running operations

## Support

For issues or questions:
1. Check `/docs` for interactive documentation
2. Review `/health` and `/metrics` for system status
3. Check application logs for detailed error information
4. Review this documentation for API usage examples

## Changelog

### Version 1.0.0 (2024-10-05)
- Initial API release
- Full CRUD operations for deadlines, requests, alerts, cases
- Completion tracking and statistics
- Authentication with API keys
- Comprehensive error handling
- Performance monitoring
- Interactive documentation
