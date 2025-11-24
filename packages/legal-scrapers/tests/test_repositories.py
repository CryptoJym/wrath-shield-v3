"""
Unit tests for repository layer
Legal Advocate AI Action Item Detector
"""

import unittest
from datetime import datetime, timedelta
import os
import tempfile
from models.database import (
    Base, Deadline, Request, Alert, Case, CompletionTracking,
    get_engine, get_session
)
from repositories import (
    DeadlineRepository,
    RequestRepository,
    AlertRepository,
    CaseRepository,
    CompletionTrackingRepository
)


class TestRepositories(unittest.TestCase):
    """Test all repository operations"""

    @classmethod
    def setUpClass(cls):
        """Set up test database"""
        cls.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        cls.db_url = f"sqlite:///{cls.temp_db.name}"
        cls.engine = get_engine(cls.db_url, echo=False)
        Base.metadata.create_all(cls.engine)
        print(f"\n✅ Test database created at {cls.db_url}")

    @classmethod
    def tearDownClass(cls):
        """Clean up test database"""
        cls.engine.dispose()
        os.unlink(cls.temp_db.name)
        print(f"\n✅ Test database cleaned up")

    def setUp(self):
        """Set up each test with a fresh session"""
        self.session = get_session(self.engine)
        self.deadline_repo = DeadlineRepository(self.session)
        self.request_repo = RequestRepository(self.session)
        self.alert_repo = AlertRepository(self.session)
        self.case_repo = CaseRepository(self.session)
        self.completion_repo = CompletionTrackingRepository(self.session)

    def tearDown(self):
        """Clean up after each test"""
        self.session.rollback()
        # Delete all data
        self.session.query(Alert).delete()
        self.session.query(CompletionTracking).delete()
        self.session.query(Deadline).delete()
        self.session.query(Request).delete()
        self.session.query(Case).delete()
        self.session.commit()
        self.session.close()

    # ==================== DEADLINE REPOSITORY TESTS ====================

    def test_deadline_create(self):
        """Test creating a deadline"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="File response to motion",
            responsible_party="self",
            status="pending"
        )
        self.assertIsNotNone(deadline.id)
        self.assertEqual(deadline.case_number, "164400524")
        print("✅ Deadline creation test passed")

    def test_deadline_get_pending(self):
        """Test getting pending deadlines"""
        # Create test deadlines
        self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Action 1",
            status="pending"
        )
        self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="hearing",
            deadline_date=datetime.now() + timedelta(days=20),
            action_required="Action 2",
            status="pending"
        )
        self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="response",
            deadline_date=datetime.now() + timedelta(days=15),
            action_required="Action 3",
            status="completed"  # Not pending
        )

        pending = self.deadline_repo.get_pending_deadlines("test_user")
        self.assertEqual(len(pending), 2)
        print("✅ Get pending deadlines test passed")

    def test_deadline_get_upcoming(self):
        """Test getting upcoming deadlines"""
        # Create test deadlines
        self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=5),
            action_required="Soon",
            status="pending"
        )
        self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="hearing",
            deadline_date=datetime.now() + timedelta(days=60),
            action_required="Far away",
            status="pending"
        )

        upcoming = self.deadline_repo.get_upcoming_deadlines("test_user", days=30)
        self.assertEqual(len(upcoming), 1)
        self.assertEqual(upcoming[0].action_required, "Soon")
        print("✅ Get upcoming deadlines test passed")

    def test_deadline_mark_completed(self):
        """Test marking deadline as completed"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        updated = self.deadline_repo.mark_completed(deadline.id)
        self.assertEqual(updated.status, "completed")
        self.assertIsNotNone(updated.completed_at)
        print("✅ Mark deadline completed test passed")

    # ==================== REQUEST REPOSITORY TESTS ====================

    def test_request_create(self):
        """Test creating a request"""
        request = self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="document",
            what_is_needed="Send custody agreement",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            urgency="high",
            status="pending"
        )
        self.assertIsNotNone(request.id)
        self.assertEqual(request.request_type, "document")
        print("✅ Request creation test passed")

    def test_request_get_urgent(self):
        """Test getting urgent requests"""
        self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="document",
            what_is_needed="Urgent item",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            urgency="urgent",
            status="pending"
        )
        self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="information",
            what_is_needed="Normal item",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            urgency="normal",
            status="pending"
        )

        urgent = self.request_repo.get_urgent_requests("test_user")
        self.assertEqual(len(urgent), 1)
        self.assertEqual(urgent[0].urgency, "urgent")
        print("✅ Get urgent requests test passed")

    def test_request_get_by_type(self):
        """Test getting requests by type"""
        self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="document",
            what_is_needed="Doc 1",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            status="pending"
        )
        self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="document",
            what_is_needed="Doc 2",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            status="pending"
        )
        self.request_repo.create(
            case_number="164400524",
            user_id="test_user",
            request_type="meeting",
            what_is_needed="Meeting",
            requested_by="attorney@example.com",
            requested_date=datetime.now(),
            status="pending"
        )

        doc_requests = self.request_repo.get_by_type("test_user", "document")
        self.assertEqual(len(doc_requests), 2)
        print("✅ Get requests by type test passed")

    # ==================== ALERT REPOSITORY TESTS ====================

    def test_alert_create_for_deadline(self):
        """Test creating alerts for a deadline"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="Test",
            status="pending"
        )

        alerts = self.alert_repo.create_deadline_alerts(
            deadline_id=deadline.id,
            deadline_date=deadline.deadline_date,
            alert_types=['30_days', '7_days', '1_day']
        )

        # Only 7_days and 1_day should be created (30_days is now or past)
        self.assertGreater(len(alerts), 0)
        print("✅ Create deadline alerts test passed")

    def test_alert_get_scheduled(self):
        """Test getting scheduled alerts"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        self.alert_repo.create(
            deadline_id=deadline.id,
            alert_type="7_days",
            scheduled_at=datetime.now() - timedelta(hours=1),  # Past due
            status="scheduled"
        )

        scheduled = self.alert_repo.get_scheduled_alerts()
        self.assertEqual(len(scheduled), 1)
        print("✅ Get scheduled alerts test passed")

    def test_alert_mark_sent(self):
        """Test marking alert as sent"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        alert = self.alert_repo.create(
            deadline_id=deadline.id,
            alert_type="7_days",
            scheduled_at=datetime.now(),
            status="scheduled"
        )

        updated = self.alert_repo.mark_sent(alert.id)
        self.assertEqual(updated.status, "sent")
        self.assertIsNotNone(updated.sent_at)
        print("✅ Mark alert sent test passed")

    # ==================== CASE REPOSITORY TESTS ====================

    def test_case_create_or_update(self):
        """Test case create or update"""
        # Create
        case1 = self.case_repo.create_or_update(
            case_number="164400524",
            user_id="test_user",
            case_title="Test vs Test",
            case_type="family"
        )
        self.assertEqual(case1.case_number, "164400524")

        # Update
        case2 = self.case_repo.create_or_update(
            case_number="164400524",
            user_id="test_user",
            case_title="Updated Title"
        )
        self.assertEqual(case2.id, case1.id)
        self.assertEqual(case2.case_title, "Updated Title")
        print("✅ Case create/update test passed")

    def test_case_get_active(self):
        """Test getting active cases"""
        self.case_repo.create_or_update(
            case_number="164400524",
            user_id="test_user",
            case_title="Active Case",
            status="active"
        )
        self.case_repo.create_or_update(
            case_number="999999",
            user_id="test_user",
            case_title="Closed Case",
            status="closed"
        )

        active = self.case_repo.get_active_cases("test_user")
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].case_number, "164400524")
        print("✅ Get active cases test passed")

    # ==================== COMPLETION TRACKING TESTS ====================

    def test_completion_tracking(self):
        """Test completion tracking"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        completion = self.completion_repo.track_completion(
            item_type="deadline",
            item_id=deadline.id,
            user_id="test_user",
            completion_method="manual",
            completion_notes="Completed via portal"
        )

        self.assertIsNotNone(completion.id)
        self.assertEqual(completion.item_type, "deadline")
        print("✅ Completion tracking test passed")

    def test_completion_stats(self):
        """Test completion statistics"""
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        self.completion_repo.track_completion(
            item_type="deadline",
            item_id=deadline.id,
            user_id="test_user",
            completion_method="manual"
        )

        stats = self.completion_repo.get_completion_stats("test_user", days=30)
        self.assertEqual(stats['total_completions'], 1)
        self.assertEqual(stats['deadline_completions'], 1)
        print("✅ Completion stats test passed")

    # ==================== TRANSACTION AND ERROR TESTS ====================

    def test_transaction_rollback(self):
        """Test that transactions rollback on error"""
        # Create a valid deadline first
        deadline = self.deadline_repo.create(
            case_number="164400524",
            user_id="test_user",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=10),
            action_required="Test",
            status="pending"
        )

        # Verify it was created
        initial_count = len(self.deadline_repo.get_all())
        self.assertEqual(initial_count, 1)

        # Try to create an invalid deadline (missing required field)
        # This should fail and rollback
        try:
            # Missing required action_required field - should cause integrity error
            bad_deadline = Deadline(
                case_number="999999",
                user_id="test_user",
                deadline_type="filing",
                deadline_date=datetime.now() + timedelta(days=5),
                # action_required is missing - violates NOT NULL
                status="pending"
            )
            self.session.add(bad_deadline)
            self.session.commit()
        except Exception as e:
            # Expected to fail - rollback should happen automatically
            self.session.rollback()

        # Count should still be 1 (rollback prevented the bad insert)
        final_count = len(self.deadline_repo.get_all())
        self.assertEqual(final_count, 1)

        # Original deadline should be unchanged
        original = self.deadline_repo.get_by_id(deadline.id)
        self.assertEqual(original.action_required, "Test")
        print("✅ Transaction rollback test passed")


if __name__ == '__main__':
    unittest.main(verbosity=2)
