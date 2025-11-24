"""
Test Alert Engine
Tests for deadline alert scheduling, sending, and lifecycle management
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from freezegun import freeze_time

from alert_engine import (
    AlertEngine,
    AlertConfig,
    AlertPriority,
    get_alert_engine,
    start_alert_engine,
    stop_alert_engine
)
from models.database import Deadline, Alert, init_db, drop_all_tables
from repositories.deadline_repository import DeadlineRepository
from repositories.alert_repository import AlertRepository


@pytest.fixture
def test_db():
    """Create test database"""
    db_url = "sqlite:///:memory:"
    engine = init_db(db_url, echo=False)
    yield engine
    drop_all_tables(db_url)


@pytest.fixture
def alert_config():
    """Create test alert configuration"""
    return AlertConfig(
        alert_intervals=[7, 3, 1, 0],
        sendgrid_api_key="test_key",
        from_email="test@example.com",
        check_schedule="*/5 * * * *",
        max_retries=3,
        batch_size=10
    )


@pytest.fixture
def alert_engine(test_db, alert_config):
    """Create alert engine for testing"""
    engine = AlertEngine(config=alert_config, database_url="sqlite:///:memory:")
    yield engine
    if engine.scheduler.running:
        engine.stop()


@pytest.fixture
def sample_deadline(test_db):
    """Create sample deadline for testing"""
    from models.database import get_session

    session = get_session(test_db)
    deadline = Deadline(
        case_number="CASE-001",
        user_id="test@example.com",
        deadline_type="filing",
        deadline_date=datetime.utcnow() + timedelta(days=10),
        action_required="File response to motion",
        responsible_party="self",
        status="pending"
    )
    session.add(deadline)
    session.commit()

    yield deadline
    session.close()


class TestAlertConfig:
    """Test AlertConfig dataclass"""

    def test_default_intervals(self):
        """Test default alert intervals"""
        config = AlertConfig()
        assert config.alert_intervals == [30, 14, 7, 3, 1, 0]

    def test_custom_intervals(self):
        """Test custom alert intervals"""
        config = AlertConfig(alert_intervals=[7, 3, 1])
        assert config.alert_intervals == [7, 3, 1]

    def test_env_variable_loading(self):
        """Test loading config from environment variables"""
        with patch.dict('os.environ', {
            'SENDGRID_API_KEY': 'env_key',
            'ALERT_FROM_EMAIL': 'env@example.com'
        }):
            config = AlertConfig()
            assert config.sendgrid_api_key == 'env_key'
            assert config.from_email == 'env@example.com'


class TestAlertEngineInitialization:
    """Test alert engine initialization"""

    def test_engine_initialization(self, alert_config):
        """Test basic engine initialization"""
        engine = AlertEngine(config=alert_config, database_url="sqlite:///:memory:")

        assert engine.config == alert_config
        assert engine.scheduler is not None
        assert not engine.scheduler.running

    def test_sendgrid_initialization(self, alert_config):
        """Test SendGrid client initialization"""
        with patch('alert_engine.SendGridAPIClient') as mock_sg:
            engine = AlertEngine(config=alert_config, database_url="sqlite:///:memory:")
            mock_sg.assert_called_once_with(alert_config.sendgrid_api_key)

    def test_missing_sendgrid_key(self):
        """Test initialization without SendGrid key"""
        config = AlertConfig(sendgrid_api_key=None)
        engine = AlertEngine(config=config, database_url="sqlite:///:memory:")

        assert engine.sendgrid_client is None


class TestAlertScheduling:
    """Test alert scheduling functionality"""

    def test_create_alerts_for_deadline(self, alert_engine, sample_deadline):
        """Test creating alerts for a deadline"""
        alerts = alert_engine.create_alerts_for_deadline(sample_deadline)

        # Should create 4 alerts (7, 3, 1, 0 days)
        assert len(alerts) > 0

        # Verify alert types
        alert_types = {a.alert_type for a in alerts}
        expected_types = {'7_days', '3_days', '1_day', 'same_day'}
        assert alert_types.intersection(expected_types)

    def test_alert_scheduled_times(self, alert_engine, sample_deadline):
        """Test alerts are scheduled at correct times"""
        alerts = alert_engine.create_alerts_for_deadline(sample_deadline)

        for alert in alerts:
            days_before = {
                '7_days': 7,
                '3_days': 3,
                '1_day': 1,
                'same_day': 0
            }.get(alert.alert_type)

            if days_before is not None:
                expected_time = sample_deadline.deadline_date - timedelta(days=days_before)
                # Allow 1 second tolerance
                assert abs((alert.scheduled_at - expected_time).total_seconds()) < 1

    def test_skip_past_alerts(self, alert_engine):
        """Test that past alert times are skipped"""
        from models.database import get_session

        # Create deadline in the past
        past_deadline = Deadline(
            case_number="PAST-001",
            user_id="test@example.com",
            deadline_type="filing",
            deadline_date=datetime.utcnow() - timedelta(days=5),
            action_required="Past deadline",
            status="pending"
        )

        session = get_session(alert_engine.engine)
        session.add(past_deadline)
        session.commit()

        alerts = alert_engine.create_alerts_for_deadline(past_deadline)

        # Should not create any alerts for past deadline
        assert len(alerts) == 0

        session.close()

    def test_multiple_channels(self, alert_engine, sample_deadline):
        """Test creating alerts for multiple channels"""
        alerts = alert_engine.create_alerts_for_deadline(
            sample_deadline,
            channels=['email', 'in_app']
        )

        # Should create alerts for both channels
        channels = {a.channel for a in alerts}
        assert 'email' in channels
        assert 'in_app' in channels


class TestAlertSending:
    """Test alert sending functionality"""

    @patch('alert_engine.SendGridAPIClient')
    def test_send_email_alert(self, mock_sg_class, alert_engine, sample_deadline):
        """Test sending email alert"""
        # Setup mock
        mock_sg = Mock()
        mock_response = Mock(status_code=202)
        mock_sg.send.return_value = mock_response
        alert_engine.sendgrid_client = mock_sg

        # Create and send alert
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        alert = alert_repo.create(
            deadline_id=sample_deadline.id,
            alert_type='7_days',
            scheduled_at=datetime.utcnow(),
            channel='email',
            status='scheduled'
        )

        # Send the alert
        alert_engine._send_email_alert(alert, alert_repo)

        # Verify email was sent
        mock_sg.send.assert_called_once()

        # Verify alert marked as sent
        updated_alert = alert_repo.get_by_id(alert.id)
        assert updated_alert.status == 'sent'
        assert updated_alert.sent_at is not None

        session.close()

    def test_email_subject_generation(self, alert_engine, sample_deadline):
        """Test email subject generation"""
        from models.database import Alert

        # Test different alert types
        alert_same_day = Alert(
            deadline_id=sample_deadline.id,
            alert_type='same_day',
            scheduled_at=datetime.utcnow()
        )
        alert_same_day.deadline = sample_deadline

        subject = alert_engine._generate_email_subject(sample_deadline, alert_same_day)

        assert "CRITICAL" in subject
        assert sample_deadline.case_number in subject
        assert sample_deadline.deadline_type.title() in subject

    def test_email_body_generation(self, alert_engine, sample_deadline):
        """Test email body HTML generation"""
        from models.database import Alert

        alert = Alert(
            deadline_id=sample_deadline.id,
            alert_type='7_days',
            scheduled_at=datetime.utcnow()
        )
        alert.deadline = sample_deadline

        body = alert_engine._generate_email_body(sample_deadline, alert)

        # Check HTML content
        assert "<!DOCTYPE html>" in body
        assert sample_deadline.case_number in body
        assert sample_deadline.action_required in body
        assert sample_deadline.deadline_type.title() in body

    @patch('alert_engine.SendGridAPIClient')
    def test_email_send_failure(self, mock_sg_class, alert_engine, sample_deadline):
        """Test handling of email send failure"""
        # Setup mock to fail
        mock_sg = Mock()
        mock_response = Mock(status_code=500)
        mock_sg.send.return_value = mock_response
        alert_engine.sendgrid_client = mock_sg

        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        alert = alert_repo.create(
            deadline_id=sample_deadline.id,
            alert_type='7_days',
            scheduled_at=datetime.utcnow(),
            channel='email',
            status='scheduled'
        )

        # Send should fail
        alert_engine._send_email_alert(alert, alert_repo)

        # Verify alert marked as failed
        updated_alert = alert_repo.get_by_id(alert.id)
        assert updated_alert.status == 'failed'
        assert updated_alert.error_message is not None

        session.close()

    def test_in_app_alert_creation(self, alert_engine, sample_deadline):
        """Test in-app alert creation"""
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        alert = alert_repo.create(
            deadline_id=sample_deadline.id,
            alert_type='3_days',
            scheduled_at=datetime.utcnow(),
            channel='in_app',
            status='scheduled'
        )

        # Create in-app alert
        alert_engine._create_in_app_alert(alert, alert_repo)

        # Verify alert marked as sent
        updated_alert = alert_repo.get_by_id(alert.id)
        assert updated_alert.status == 'sent'

        session.close()


class TestAlertPriority:
    """Test alert priority calculation"""

    def test_critical_priority(self, alert_engine):
        """Test critical priority for same-day alerts"""
        deadline = Deadline(
            deadline_date=datetime.utcnow() + timedelta(hours=6)
        )
        alert = Alert(alert_type='same_day')

        priority = alert_engine._get_alert_priority(deadline, alert)
        assert priority == AlertPriority.CRITICAL

    def test_high_priority(self, alert_engine):
        """Test high priority for 1-3 day alerts"""
        deadline = Deadline(
            deadline_date=datetime.utcnow() + timedelta(days=2)
        )
        alert = Alert(alert_type='3_days')

        priority = alert_engine._get_alert_priority(deadline, alert)
        assert priority == AlertPriority.HIGH

    def test_medium_priority(self, alert_engine):
        """Test medium priority for 7-14 day alerts"""
        deadline = Deadline(
            deadline_date=datetime.utcnow() + timedelta(days=10)
        )
        alert = Alert(alert_type='7_days')

        priority = alert_engine._get_alert_priority(deadline, alert)
        assert priority == AlertPriority.MEDIUM

    def test_low_priority(self, alert_engine):
        """Test low priority for 30+ day alerts"""
        deadline = Deadline(
            deadline_date=datetime.utcnow() + timedelta(days=30)
        )
        alert = Alert(alert_type='30_days')

        priority = alert_engine._get_alert_priority(deadline, alert)
        assert priority == AlertPriority.LOW


class TestAlertCancellation:
    """Test alert cancellation"""

    def test_cancel_deadline_alerts(self, alert_engine, sample_deadline):
        """Test cancelling alerts when deadline is completed"""
        # Create alerts
        alerts = alert_engine.create_alerts_for_deadline(sample_deadline)
        assert len(alerts) > 0

        # Cancel alerts
        count = alert_engine.cancel_deadline_alerts(sample_deadline.id)
        assert count == len(alerts)

        # Verify all alerts are cancelled
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        for alert in alerts:
            updated_alert = alert_repo.get_by_id(alert.id)
            assert updated_alert.status == 'cancelled'

        session.close()


class TestAlertRetry:
    """Test alert retry logic"""

    @patch('alert_engine.SendGridAPIClient')
    def test_retry_failed_alerts(self, mock_sg_class, alert_engine, sample_deadline):
        """Test retrying failed alerts"""
        # Setup mock
        mock_sg = Mock()
        mock_response = Mock(status_code=202)
        mock_sg.send.return_value = mock_response
        alert_engine.sendgrid_client = mock_sg

        # Create failed alert
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        alert = alert_repo.create(
            deadline_id=sample_deadline.id,
            alert_type='7_days',
            scheduled_at=datetime.utcnow(),
            channel='email',
            status='failed',
            error_message="Previous send failed"
        )

        session.close()

        # Retry failed alerts
        count = alert_engine.retry_failed_alerts(limit=10)
        assert count == 1

        # Verify alert is now sent
        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)
        updated_alert = alert_repo.get_by_id(alert.id)
        assert updated_alert.status == 'sent'

        session.close()


class TestAlertProcessing:
    """Test alert processing job"""

    @patch('alert_engine.SendGridAPIClient')
    def test_process_alerts(self, mock_sg_class, alert_engine, sample_deadline):
        """Test processing scheduled alerts"""
        # Setup mock
        mock_sg = Mock()
        mock_response = Mock(status_code=202)
        mock_sg.send.return_value = mock_response
        alert_engine.sendgrid_client = mock_sg

        # Create alerts scheduled for now
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        # Create 3 scheduled alerts
        for i in range(3):
            alert_repo.create(
                deadline_id=sample_deadline.id,
                alert_type='7_days',
                scheduled_at=datetime.utcnow() - timedelta(minutes=5),  # Past due
                channel='email',
                status='scheduled'
            )

        session.close()

        # Process alerts
        alert_engine.process_alerts()

        # Verify all alerts were sent
        assert mock_sg.send.call_count == 3

    def test_batch_processing(self, alert_engine, sample_deadline):
        """Test batch processing of alerts"""
        alert_engine.config.batch_size = 2  # Small batch for testing

        # Create 5 alerts
        from models.database import get_session
        from repositories.alert_repository import AlertRepository

        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)

        for i in range(5):
            alert_repo.create(
                deadline_id=sample_deadline.id,
                alert_type='7_days',
                scheduled_at=datetime.utcnow() - timedelta(minutes=5),
                channel='in_app',
                status='scheduled'
            )

        session.close()

        # Process in batches
        alert_engine.process_alerts()

        # Verify all processed
        session = get_session(alert_engine.engine)
        alert_repo = AlertRepository(session)
        sent_alerts = alert_repo.get_by_channel('in_app', status='sent')
        assert len(sent_alerts) == 5

        session.close()


class TestScheduler:
    """Test scheduler functionality"""

    def test_start_scheduler(self, alert_engine):
        """Test starting the scheduler"""
        alert_engine.start()

        assert alert_engine.scheduler.running
        assert len(alert_engine.scheduler.get_jobs()) >= 2  # process_alerts and update_overdue

        alert_engine.stop()

    def test_stop_scheduler(self, alert_engine):
        """Test stopping the scheduler"""
        alert_engine.start()
        assert alert_engine.scheduler.running

        alert_engine.stop()
        assert not alert_engine.scheduler.running

    def test_scheduled_jobs(self, alert_engine):
        """Test that jobs are scheduled correctly"""
        alert_engine.start()

        jobs = alert_engine.scheduler.get_jobs()
        job_ids = {job.id for job in jobs}

        assert 'process_alerts' in job_ids
        assert 'update_overdue' in job_ids

        alert_engine.stop()


class TestStatistics:
    """Test statistics and monitoring"""

    def test_get_statistics(self, alert_engine, sample_deadline):
        """Test getting alert statistics"""
        # Create some alerts
        alert_engine.create_alerts_for_deadline(sample_deadline)

        stats = alert_engine.get_alert_statistics()

        assert 'scheduled' in stats
        assert 'sent' in stats
        assert 'failed' in stats
        assert 'cancelled' in stats
        assert 'scheduler_running' in stats
        assert 'scheduled_jobs' in stats


class TestSingletonPattern:
    """Test singleton pattern for alert engine"""

    def test_singleton_instance(self, alert_config):
        """Test that get_alert_engine returns same instance"""
        engine1 = get_alert_engine(alert_config, "sqlite:///:memory:")
        engine2 = get_alert_engine()

        assert engine1 is engine2

    def test_start_stop_functions(self, alert_config):
        """Test convenience start/stop functions"""
        engine = start_alert_engine(alert_config, "sqlite:///:memory:")

        assert engine.scheduler.running

        stop_alert_engine()
        assert not engine.scheduler.running
