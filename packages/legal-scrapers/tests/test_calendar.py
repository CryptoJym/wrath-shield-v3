"""
Tests for Calendar API
Tests calendar event aggregation, filtering, iCalendar export, and date range queries
"""

import os
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, date, timedelta
from io import BytesIO
from icalendar import Calendar
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.main import app
from api.dependencies import get_db, get_api_key
from models.database import Base, Deadline, Request
from models.schemas import (
    DeadlineType, ResponsibleParty, ItemStatus,
    RequestType, Urgency
)


# Test database setup
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    """Override database dependency for testing"""
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_api_key():
    """Override API key dependency for testing"""
    return "test-api-key"


# Override dependencies
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_api_key] = override_get_api_key

# Create test client
client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    """Create test database session"""
    Base.metadata.create_all(bind=test_engine)
    db = TestSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def urgent_deadline(db_session):
    """Create urgent deadline (due tomorrow)"""
    deadline = Deadline(
        case_number="CASE-001",
        deadline_type=DeadlineType.COURT_FILING,
        due_date=datetime.now() + timedelta(days=1),
        action_required="File urgent motion",
        responsible_party=ResponsibleParty.ATTORNEY,
        status=ItemStatus.PENDING
    )
    db_session.add(deadline)
    db_session.commit()
    db_session.refresh(deadline)
    return deadline


@pytest.fixture
def high_priority_deadline(db_session):
    """Create high priority deadline (due in 3 days)"""
    deadline = Deadline(
        case_number="CASE-002",
        deadline_type=DeadlineType.DISCOVERY,
        due_date=datetime.now() + timedelta(days=3),
        action_required="Submit discovery responses",
        responsible_party=ResponsibleParty.PARALEGAL,
        status=ItemStatus.PENDING
    )
    db_session.add(deadline)
    db_session.commit()
    db_session.refresh(deadline)
    return deadline


@pytest.fixture
def medium_priority_deadline(db_session):
    """Create medium priority deadline (due in 5 days)"""
    deadline = Deadline(
        case_number="CASE-003",
        deadline_type=DeadlineType.CLIENT_MEETING,
        due_date=datetime.now() + timedelta(days=5),
        action_required="Prepare client meeting",
        responsible_party=ResponsibleParty.ATTORNEY,
        status=ItemStatus.PENDING
    )
    db_session.add(deadline)
    db_session.commit()
    db_session.refresh(deadline)
    return deadline


@pytest.fixture
def completed_deadline(db_session):
    """Create completed deadline"""
    deadline = Deadline(
        case_number="CASE-004",
        deadline_type=DeadlineType.COURT_FILING,
        due_date=datetime.now() - timedelta(days=1),
        action_required="File completed motion",
        responsible_party=ResponsibleParty.ATTORNEY,
        status=ItemStatus.COMPLETED,
        completed_date=datetime.now()
    )
    db_session.add(deadline)
    db_session.commit()
    db_session.refresh(deadline)
    return deadline


@pytest.fixture
def urgent_request(db_session):
    """Create urgent request"""
    request = Request(
        case_number="CASE-001",
        request_type=RequestType.DOCUMENT_REQUEST,
        what_is_needed="Urgent medical records",
        requested_by="Attorney",
        requested_date=datetime.now(),
        deadline=datetime.now() + timedelta(days=1),
        urgency=Urgency.URGENT,
        status=ItemStatus.PENDING
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)
    return request


@pytest.fixture
def medium_request(db_session):
    """Create medium priority request"""
    request = Request(
        case_number="CASE-002",
        request_type=RequestType.EXPERT_CONSULTATION,
        what_is_needed="Expert witness review",
        requested_by="Attorney",
        requested_date=datetime.now(),
        deadline=datetime.now() + timedelta(days=7),
        urgency=Urgency.MEDIUM,
        status=ItemStatus.PENDING
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)
    return request


class TestCalendarEventRetrieval:
    """Test calendar event retrieval and aggregation"""

    def test_get_events_empty(self, db_session):
        """Test getting events when none exist"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['events'] == []
        assert data['total'] == 0

    def test_get_events_with_deadlines(self, db_session, urgent_deadline, high_priority_deadline):
        """Test getting events with deadlines only"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 2
        assert len(data['events']) == 2

        # Check event structure
        event = data['events'][0]
        assert 'id' in event
        assert 'title' in event
        assert 'start' in event
        assert 'event_type' in event
        assert event['event_type'] == 'deadline'
        assert 'urgency' in event
        assert 'color' in event

    def test_get_events_with_requests(self, db_session, urgent_request, medium_request):
        """Test getting events with requests only"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 2

        # Check request events
        request_events = [e for e in data['events'] if e['event_type'] == 'request']
        assert len(request_events) == 2

    def test_get_mixed_events(self, db_session, urgent_deadline, urgent_request):
        """Test getting mixed deadlines and requests"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 2

        event_types = set(e['event_type'] for e in data['events'])
        assert 'deadline' in event_types
        assert 'request' in event_types


class TestCalendarFiltering:
    """Test calendar event filtering"""

    def test_filter_by_event_type_deadlines_only(
        self, db_session, urgent_deadline, urgent_request
    ):
        """Test filtering by event type - deadlines only"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&event_types=deadline"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['event_type'] == 'deadline'

    def test_filter_by_event_type_requests_only(
        self, db_session, urgent_deadline, urgent_request
    ):
        """Test filtering by event type - requests only"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&event_types=request"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['event_type'] == 'request'

    def test_filter_by_status(
        self, db_session, urgent_deadline, completed_deadline
    ):
        """Test filtering by status"""
        start_date = date.today() - timedelta(days=7)
        end_date = start_date + timedelta(days=30)

        # Get only pending
        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&statuses={ItemStatus.PENDING.value}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['status'] == ItemStatus.PENDING.value

    def test_filter_by_urgency(
        self, db_session, urgent_deadline, high_priority_deadline, medium_priority_deadline
    ):
        """Test filtering by urgency"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        # Get only urgent
        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&urgencies={Urgency.URGENT.value}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['urgency'] == Urgency.URGENT.value

    def test_filter_by_case_number(
        self, db_session, urgent_deadline, high_priority_deadline
    ):
        """Test filtering by case number"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&case_number=CASE-001"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['case_number'] == "CASE-001"

    def test_multiple_filters(
        self, db_session, urgent_deadline, high_priority_deadline, urgent_request
    ):
        """Test combining multiple filters"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
            f"&event_types=deadline&urgencies={Urgency.URGENT.value}"
            f"&statuses={ItemStatus.PENDING.value}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['events'][0]['event_type'] == 'deadline'
        assert data['events'][0]['urgency'] == Urgency.URGENT.value


class TestDateRangeQueries:
    """Test date range query functionality"""

    def test_date_range_filtering(self, db_session, urgent_deadline, medium_priority_deadline):
        """Test events are filtered by date range"""
        start_date = date.today()
        end_date = start_date + timedelta(days=2)  # Only includes urgent (tomorrow)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1  # Only urgent deadline in range

    def test_past_date_range(self, db_session, completed_deadline):
        """Test getting events in past date range"""
        start_date = date.today() - timedelta(days=7)
        end_date = date.today()

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1

    def test_future_date_range(self, db_session, medium_priority_deadline):
        """Test getting events in future date range"""
        start_date = date.today() + timedelta(days=4)
        end_date = start_date + timedelta(days=3)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1

    def test_single_day_range(self, db_session, urgent_deadline):
        """Test getting events for single day"""
        event_date = (datetime.now() + timedelta(days=1)).date()

        response = client.get(
            f"/api/calendar/events?start_date={event_date}&end_date={event_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1


class TestUrgencyCalculation:
    """Test urgency level calculation"""

    def test_urgent_urgency(self, db_session, urgent_deadline):
        """Test urgent urgency for events due tomorrow or overdue"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['events'][0]['urgency'] == Urgency.URGENT.value
        assert data['events'][0]['color'] == '#ff4444'  # Red

    def test_high_urgency(self, db_session, high_priority_deadline):
        """Test high urgency for events due in 2-3 days"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['events'][0]['urgency'] == Urgency.HIGH.value
        assert data['events'][0]['color'] == '#ff8c00'  # Orange

    def test_medium_urgency(self, db_session, medium_priority_deadline):
        """Test medium urgency for events due in 4-7 days"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['events'][0]['urgency'] == Urgency.MEDIUM.value
        assert data['events'][0]['color'] == '#ffd700'  # Yellow


class TestICalendarExport:
    """Test iCalendar export functionality"""

    def test_export_empty_calendar(self, db_session):
        """Test exporting when no events exist"""
        response = client.get("/api/calendar/export")
        assert response.status_code == 200
        assert response.headers['content-type'] == 'text/calendar; charset=utf-8'

        # Parse iCalendar
        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 0

    def test_export_with_deadlines(self, db_session, urgent_deadline, high_priority_deadline):
        """Test exporting deadlines to iCalendar"""
        response = client.get("/api/calendar/export")
        assert response.status_code == 200

        # Parse iCalendar
        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 2

        # Check event properties
        event = events[0]
        assert 'SUMMARY' in event
        assert '[DEADLINE]' in str(event.get('SUMMARY'))
        assert 'DTSTART' in event
        assert 'UID' in event
        assert 'deadline-' in str(event.get('UID'))

    def test_export_with_date_range(self, db_session, urgent_deadline, medium_priority_deadline):
        """Test exporting with date range"""
        start_date = date.today()
        end_date = start_date + timedelta(days=2)

        response = client.get(
            f"/api/calendar/export?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200

        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 1  # Only urgent in range

    def test_export_include_completed(self, db_session, urgent_deadline, completed_deadline):
        """Test exporting with completed events included"""
        start_date = date.today() - timedelta(days=7)
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/export?start_date={start_date}&end_date={end_date}"
            f"&include_completed=true"
        )
        assert response.status_code == 200

        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 2

    def test_export_exclude_completed(self, db_session, urgent_deadline, completed_deadline):
        """Test exporting without completed events"""
        start_date = date.today() - timedelta(days=7)
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/export?start_date={start_date}&end_date={end_date}"
            f"&include_completed=false"
        )
        assert response.status_code == 200

        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 1  # Only pending

    def test_export_event_types_filter(self, db_session, urgent_deadline, urgent_request):
        """Test exporting specific event types"""
        response = client.get("/api/calendar/export?event_types=deadline")
        assert response.status_code == 200

        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        assert len(events) == 1
        assert '[DEADLINE]' in str(events[0].get('SUMMARY'))

    def test_export_filename(self, db_session):
        """Test export filename format"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/export?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200

        content_disposition = response.headers['content-disposition']
        assert 'attachment' in content_disposition
        assert 'legal_calendar_' in content_disposition
        assert f'{start_date}_{end_date}.ics' in content_disposition

    def test_export_priority_mapping(self, db_session, urgent_deadline):
        """Test urgency to priority mapping in iCalendar"""
        response = client.get("/api/calendar/export")
        assert response.status_code == 200

        cal = Calendar.from_ical(response.content)
        events = [component for component in cal.walk() if component.name == "VEVENT"]
        event = events[0]

        # Urgent should map to priority 1
        assert event.get('PRIORITY') == 1


class TestGoogleCalendarSync:
    """Test Google Calendar sync stub"""

    def test_sync_not_implemented(self, db_session):
        """Test Google Calendar sync returns not implemented message"""
        sync_data = {
            'calendar_id': 'primary',
            'sync_direction': 'one_way',
            'auto_sync': False
        }
        response = client.post("/api/calendar/sync", json=sync_data)
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is False
        assert 'not yet implemented' in data['message'].lower()
        assert data['synced_events'] == 0
        assert len(data['errors']) > 0


class TestEventSorting:
    """Test event sorting"""

    def test_events_sorted_by_start_date(
        self, db_session, urgent_deadline, high_priority_deadline, medium_priority_deadline
    ):
        """Test events are sorted by start date"""
        start_date = date.today()
        end_date = start_date + timedelta(days=30)

        response = client.get(
            f"/api/calendar/events?start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200
        data = response.json()

        # Verify sorted order
        events = data['events']
        for i in range(len(events) - 1):
            curr_start = datetime.fromisoformat(events[i]['start'])
            next_start = datetime.fromisoformat(events[i + 1]['start'])
            assert curr_start <= next_start


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
