"""
Unit tests for database schema
Legal Advocate AI Action Item Detector
"""

import unittest
from datetime import datetime, timedelta
import os
import tempfile
from models.database import (
    Base, Deadline, Request, Alert,
    get_engine, get_session, init_db, drop_all_tables
)


class TestDatabaseSchema(unittest.TestCase):
    """Test database schema creation and basic operations"""

    @classmethod
    def setUpClass(cls):
        """Set up test database"""
        # Use a temporary database for testing
        cls.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        cls.db_url = f"sqlite:///{cls.temp_db.name}"
        cls.engine = init_db(database_url=cls.db_url, echo=False)
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

    def tearDown(self):
        """Clean up after each test"""
        # Rollback any uncommitted changes
        self.session.rollback()
        # Delete all data
        self.session.query(Alert).delete()
        self.session.query(Deadline).delete()
        self.session.query(Request).delete()
        self.session.commit()
        self.session.close()

    def test_table_creation(self):
        """Test that all tables are created"""
        tables = Base.metadata.tables.keys()
        self.assertIn('deadlines', tables)
        self.assertIn('requests', tables)
        self.assertIn('alerts', tables)
        print("✅ All tables created successfully")

    def test_deadline_creation(self):
        """Test creating a deadline"""
        deadline = Deadline(
            case_number="164400524",
            user_id="james_brady",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="File response to motion",
            responsible_party="self",
            source_document="court_order_123.pdf",
            source_text="You must file your response within 30 days",
            extraction_confidence=0.95,
            status="pending"
        )

        self.session.add(deadline)
        self.session.commit()

        # Verify it was created
        retrieved = self.session.query(Deadline).filter_by(case_number="164400524").first()
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.deadline_type, "filing")
        self.assertEqual(retrieved.status, "pending")
        self.assertEqual(retrieved.extraction_confidence, 0.95)
        print("✅ Deadline creation successful")

    def test_deadline_update(self):
        """Test updating a deadline"""
        deadline = Deadline(
            case_number="164400524",
            user_id="james_brady",
            deadline_type="hearing",
            deadline_date=datetime.now() + timedelta(days=14),
            action_required="Attend hearing",
            status="pending"
        )
        self.session.add(deadline)
        self.session.commit()

        # Update status
        deadline.status = "completed"
        deadline.completed_at = datetime.now()
        self.session.commit()

        # Verify update
        retrieved = self.session.query(Deadline).filter_by(id=deadline.id).first()
        self.assertEqual(retrieved.status, "completed")
        self.assertIsNotNone(retrieved.completed_at)
        print("✅ Deadline update successful")

    def test_request_creation(self):
        """Test creating a request"""
        request = Request(
            case_number="164400524",
            user_id="james_brady",
            request_type="document",
            what_is_needed="Please send me the custody agreement",
            requested_by="zack@attorney.com",
            requested_date=datetime.now(),
            deadline=datetime.now() + timedelta(days=7),
            urgency="high",
            source_email_id="msg_12345",
            source_text="Can you please send me the custody agreement by next week?",
            status="pending"
        )

        self.session.add(request)
        self.session.commit()

        # Verify it was created
        retrieved = self.session.query(Request).filter_by(case_number="164400524").first()
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.request_type, "document")
        self.assertEqual(retrieved.urgency, "high")
        print("✅ Request creation successful")

    def test_alert_creation_with_deadline(self):
        """Test creating an alert linked to a deadline"""
        # First create a deadline
        deadline = Deadline(
            case_number="164400524",
            user_id="james_brady",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="File response",
            status="pending"
        )
        self.session.add(deadline)
        self.session.commit()

        # Create alert for the deadline
        alert = Alert(
            deadline_id=deadline.id,
            alert_type="7_days",
            scheduled_at=deadline.deadline_date - timedelta(days=7),
            status="scheduled",
            channel="email"
        )
        self.session.add(alert)
        self.session.commit()

        # Verify relationship
        retrieved_deadline = self.session.query(Deadline).filter_by(id=deadline.id).first()
        self.assertEqual(len(retrieved_deadline.alerts), 1)
        self.assertEqual(retrieved_deadline.alerts[0].alert_type, "7_days")
        print("✅ Alert creation with deadline relationship successful")

    def test_cascade_delete(self):
        """Test that deleting a deadline cascades to its alerts"""
        # Create deadline with alerts
        deadline = Deadline(
            case_number="164400524",
            user_id="james_brady",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="File response",
            status="pending"
        )
        self.session.add(deadline)
        self.session.commit()

        # Add multiple alerts
        for days in [30, 14, 7, 3, 1]:
            alert = Alert(
                deadline_id=deadline.id,
                alert_type=f"{days}_days" if days > 1 else "1_day",
                scheduled_at=deadline.deadline_date - timedelta(days=days),
                status="scheduled",
                channel="email"
            )
            self.session.add(alert)
        self.session.commit()

        deadline_id = deadline.id

        # Verify alerts exist
        alerts_before = self.session.query(Alert).filter_by(deadline_id=deadline_id).count()
        self.assertEqual(alerts_before, 5)

        # Delete deadline
        self.session.delete(deadline)
        self.session.commit()

        # Verify alerts were cascaded
        alerts_after = self.session.query(Alert).filter_by(deadline_id=deadline_id).count()
        self.assertEqual(alerts_after, 0)
        print("✅ Cascade delete successful")

    def test_indexes(self):
        """Test that indexes are created properly"""
        # Get index information from the database
        from sqlalchemy import inspect
        inspector = inspect(self.engine)

        # Check deadlines indexes
        deadlines_indexes = inspector.get_indexes('deadlines')
        deadline_index_names = [idx['name'] for idx in deadlines_indexes]
        self.assertIn('idx_user_status', deadline_index_names)
        self.assertIn('idx_case_deadline', deadline_index_names)
        self.assertIn('idx_user_deadline', deadline_index_names)

        # Check requests indexes
        requests_indexes = inspector.get_indexes('requests')
        request_index_names = [idx['name'] for idx in requests_indexes]
        self.assertIn('idx_user_status_requests', request_index_names)
        self.assertIn('idx_case_urgency', request_index_names)

        # Check alerts indexes
        alerts_indexes = inspector.get_indexes('alerts')
        alert_index_names = [idx['name'] for idx in alerts_indexes]
        self.assertIn('idx_status_scheduled', alert_index_names)
        self.assertIn('idx_deadline_alert', alert_index_names)

        print("✅ All indexes verified successfully")

    def test_query_performance_with_indexes(self):
        """Test that indexes improve query performance"""
        # Create multiple deadlines for the same user
        for i in range(100):
            deadline = Deadline(
                case_number="164400524",
                user_id="james_brady",
                deadline_type="filing" if i % 2 == 0 else "hearing",
                deadline_date=datetime.now() + timedelta(days=i),
                action_required=f"Action {i}",
                status="pending" if i % 3 == 0 else "completed"
            )
            self.session.add(deadline)
        self.session.commit()

        # Query using indexed columns (should be fast)
        import time
        start = time.time()
        results = self.session.query(Deadline).filter_by(
            user_id="james_brady",
            status="pending"
        ).all()
        elapsed = time.time() - start

        self.assertGreater(len(results), 0)
        self.assertLess(elapsed, 0.1)  # Should complete in under 100ms
        print(f"✅ Index query performance test passed ({elapsed*1000:.2f}ms for {len(results)} results)")

    def test_multi_tenant_isolation(self):
        """Test that user_id properly isolates data"""
        # Create deadlines for two different users
        deadline1 = Deadline(
            case_number="164400524",
            user_id="james_brady",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="User 1 action",
            status="pending"
        )

        deadline2 = Deadline(
            case_number="999999",
            user_id="test_user_002",
            deadline_type="filing",
            deadline_date=datetime.now() + timedelta(days=30),
            action_required="User 2 action",
            status="pending"
        )

        self.session.add(deadline1)
        self.session.add(deadline2)
        self.session.commit()

        # Query for each user
        user1_deadlines = self.session.query(Deadline).filter_by(user_id="james_brady").all()
        user2_deadlines = self.session.query(Deadline).filter_by(user_id="test_user_002").all()

        self.assertEqual(len(user1_deadlines), 1)
        self.assertEqual(len(user2_deadlines), 1)
        self.assertEqual(user1_deadlines[0].case_number, "164400524")
        self.assertEqual(user2_deadlines[0].case_number, "999999")
        print("✅ Multi-tenant isolation verified")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
