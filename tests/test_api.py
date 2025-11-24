"""
Tests for FastAPI Backend
Tests all API endpoints with various scenarios
"""

import os
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.main import app
from api.dependencies import get_db, get_api_key
from models.database import Base, Deadline, Request, Alert
from models.schemas import (
    DeadlineType, ResponsibleParty, ItemStatus,
    RequestType, Urgency, AlertType, AlertStatus, Channel
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
def sample_case(db_session):
    """Create a sample case for testing"""
    # Note: We'll need to add Case model
    # For now, just return a case_id
    return 1


@pytest.fixture
def sample_deadline(db_session, sample_case):
    """Create a sample deadline for testing"""
    deadline = Deadline(
        case_id=sample_case,
        deadline_type=DeadlineType.COURT_FILING,
        due_date=datetime.now() + timedelta(days=7),
        description="Test deadline",
        responsible_party=ResponsibleParty.ATTORNEY,
        status=ItemStatus.PENDING
    )
    db_session.add(deadline)
    db_session.commit()
    db_session.refresh(deadline)
    return deadline


@pytest.fixture
def sample_request(db_session, sample_case):
    """Create a sample request for testing"""
    request = Request(
        case_id=sample_case,
        request_type=RequestType.DOCUMENT_REQUEST,
        description="Test request",
        urgency=Urgency.MEDIUM,
        status=ItemStatus.PENDING
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)
    return request


@pytest.fixture
def sample_alert(db_session, sample_deadline):
    """Create a sample alert for testing"""
    alert = Alert(
        deadline_id=sample_deadline.id,
        alert_type=AlertType.SEVEN_DAY,
        scheduled_time=datetime.now() + timedelta(days=1),
        channel=Channel.EMAIL,
        message="Test alert message",
        status=AlertStatus.SCHEDULED
    )
    db_session.add(alert)
    db_session.commit()
    db_session.refresh(alert)
    return alert


class TestHealthAndMetrics:
    """Test system endpoints"""

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert 'status' in data
        assert 'uptime_seconds' in data

    def test_metrics_endpoint(self):
        """Test metrics endpoint"""
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert 'health' in data
        assert 'performance' in data
        assert 'errors' in data

    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == "Legal Advocate AI API"
        assert 'endpoints' in data


class TestDeadlineAPI:
    """Test deadline endpoints"""

    def test_list_deadlines_empty(self, db_session):
        """Test listing deadlines when none exist"""
        response = client.get("/api/deadlines")
        assert response.status_code == 200
        data = response.json()
        assert data['deadlines'] == []
        assert data['total'] == 0

    def test_list_deadlines_with_data(self, db_session, sample_deadline):
        """Test listing deadlines with data"""
        response = client.get("/api/deadlines")
        assert response.status_code == 200
        data = response.json()
        assert len(data['deadlines']) == 1
        assert data['total'] == 1
        assert data['deadlines'][0]['id'] == sample_deadline.id

    def test_create_deadline(self, db_session, sample_case):
        """Test creating a deadline"""
        deadline_data = {
            'case_id': sample_case,
            'deadline_type': DeadlineType.COURT_FILING.value,
            'due_date': (datetime.now() + timedelta(days=14)).isoformat(),
            'description': 'New test deadline',
            'responsible_party': ResponsibleParty.ATTORNEY.value
        }
        response = client.post("/api/deadlines", json=deadline_data)
        assert response.status_code == 201
        data = response.json()
        assert data['description'] == 'New test deadline'
        assert data['status'] == ItemStatus.PENDING.value

    def test_get_deadline(self, db_session, sample_deadline):
        """Test getting a specific deadline"""
        response = client.get(f"/api/deadlines/{sample_deadline.id}")
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == sample_deadline.id
        assert data['description'] == sample_deadline.description

    def test_get_deadline_not_found(self, db_session):
        """Test getting non-existent deadline"""
        response = client.get("/api/deadlines/999")
        assert response.status_code == 404

    def test_update_deadline(self, db_session, sample_deadline):
        """Test updating a deadline"""
        update_data = {'description': 'Updated deadline description'}
        response = client.put(f"/api/deadlines/{sample_deadline.id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data['description'] == 'Updated deadline description'

    def test_complete_deadline(self, db_session, sample_deadline):
        """Test completing a deadline"""
        response = client.post(f"/api/deadlines/{sample_deadline.id}/complete")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == ItemStatus.COMPLETED.value
        assert data['completed_date'] is not None

    def test_delete_deadline(self, db_session, sample_deadline):
        """Test deleting a deadline"""
        response = client.delete(f"/api/deadlines/{sample_deadline.id}")
        assert response.status_code == 204

        # Verify deletion
        response = client.get(f"/api/deadlines/{sample_deadline.id}")
        assert response.status_code == 404

    def test_filter_deadlines_by_status(self, db_session, sample_deadline):
        """Test filtering deadlines by status"""
        response = client.get(f"/api/deadlines?status={ItemStatus.PENDING.value}")
        assert response.status_code == 200
        data = response.json()
        assert len(data['deadlines']) == 1

    def test_pagination(self, db_session, sample_case):
        """Test deadline pagination"""
        # Create multiple deadlines
        for i in range(5):
            deadline = Deadline(
                case_id=sample_case,
                deadline_type=DeadlineType.COURT_FILING,
                due_date=datetime.now() + timedelta(days=i),
                description=f"Deadline {i}",
                responsible_party=ResponsibleParty.ATTORNEY,
                status=ItemStatus.PENDING
            )
            db_session.add(deadline)
        db_session.commit()

        # Test pagination
        response = client.get("/api/deadlines?skip=0&limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data['deadlines']) == 3
        assert data['total'] == 5
        assert data['has_more'] is True


class TestRequestAPI:
    """Test request endpoints"""

    def test_list_requests(self, db_session, sample_request):
        """Test listing requests"""
        response = client.get("/api/requests")
        assert response.status_code == 200
        data = response.json()
        assert len(data['requests']) == 1
        assert data['requests'][0]['id'] == sample_request.id

    def test_create_request(self, db_session, sample_case):
        """Test creating a request"""
        request_data = {
            'case_id': sample_case,
            'request_type': RequestType.DOCUMENT_REQUEST.value,
            'description': 'New test request',
            'urgency': Urgency.HIGH.value
        }
        response = client.post("/api/requests", json=request_data)
        assert response.status_code == 201
        data = response.json()
        assert data['description'] == 'New test request'
        assert data['urgency'] == Urgency.HIGH.value

    def test_complete_request(self, db_session, sample_request):
        """Test completing a request"""
        completion_data = {'notes': 'Request completed successfully'}
        response = client.post(
            f"/api/requests/{sample_request.id}/complete",
            json=completion_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == ItemStatus.COMPLETED.value

    def test_filter_requests_by_urgency(self, db_session, sample_request):
        """Test filtering requests by urgency"""
        response = client.get(f"/api/requests?urgency={Urgency.MEDIUM.value}")
        assert response.status_code == 200
        data = response.json()
        assert len(data['requests']) == 1


class TestAlertAPI:
    """Test alert endpoints"""

    def test_list_alerts(self, db_session, sample_alert):
        """Test listing alerts"""
        response = client.get("/api/alerts")
        assert response.status_code == 200
        data = response.json()
        assert len(data['alerts']) == 1
        assert data['alerts'][0]['id'] == sample_alert.id

    def test_get_alert(self, db_session, sample_alert):
        """Test getting a specific alert"""
        response = client.get(f"/api/alerts/{sample_alert.id}")
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == sample_alert.id

    def test_acknowledge_alert(self, db_session, sample_alert):
        """Test acknowledging an alert"""
        ack_data = {'notes': 'Alert acknowledged'}
        response = client.put(
            f"/api/alerts/{sample_alert.id}/acknowledge",
            json=ack_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == AlertStatus.ACKNOWLEDGED.value

    def test_list_upcoming_alerts(self, db_session, sample_alert):
        """Test listing upcoming alerts"""
        response = client.get("/api/alerts/upcoming?hours=48")
        assert response.status_code == 200
        data = response.json()
        assert len(data['alerts']) >= 1

    def test_cancel_alert(self, db_session, sample_alert):
        """Test canceling an alert"""
        response = client.post(f"/api/alerts/{sample_alert.id}/cancel")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == AlertStatus.CANCELLED.value


class TestValidation:
    """Test request validation"""

    def test_invalid_deadline_data(self, db_session):
        """Test creating deadline with invalid data"""
        invalid_data = {
            'case_id': 'invalid',  # Should be int
            'deadline_type': 'INVALID_TYPE',
            'due_date': 'not-a-date',
            'description': '',
            'responsible_party': 'INVALID'
        }
        response = client.post("/api/deadlines", json=invalid_data)
        assert response.status_code == 422  # Validation error

    def test_pagination_limits(self, db_session):
        """Test pagination limit validation"""
        response = client.get("/api/deadlines?limit=2000")  # Exceeds max
        assert response.status_code == 422


class TestErrorHandling:
    """Test error handling"""

    def test_404_endpoint(self):
        """Test 404 error for non-existent endpoint"""
        response = client.get("/api/nonexistent")
        assert response.status_code == 404
        data = response.json()
        assert 'error' in data
        assert data['error'] == 'NotFound'

    def test_method_not_allowed(self):
        """Test 405 error for wrong HTTP method"""
        response = client.put("/health")  # GET only endpoint
        assert response.status_code == 405


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
