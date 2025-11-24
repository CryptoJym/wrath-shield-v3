"""
Alert Engine for Legal Advocate AI
Background service to schedule and send deadline alerts using APScheduler
"""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from sqlalchemy.orm import Session

from models.database import Deadline, Alert, get_engine, get_session
from repositories.deadline_repository import DeadlineRepository
from repositories.alert_repository import AlertRepository
from utils.error_handling import retry, log_errors, safe_operation, report_error
from utils.logging_config import get_logger
from utils.monitoring import track_performance, log_metric

logger = get_logger(__name__)


class AlertPriority(Enum):
    """Alert priority levels based on deadline urgency"""
    CRITICAL = "CRITICAL"  # Same day or past due
    HIGH = "HIGH"  # 1-3 days
    MEDIUM = "MEDIUM"  # 7-14 days
    LOW = "LOW"  # 30+ days


@dataclass
class AlertConfig:
    """Configuration for alert engine"""
    # Alert intervals in days before deadline
    alert_intervals: List[int] = None  # [30, 14, 7, 3, 1, 0]

    # SendGrid configuration
    sendgrid_api_key: str = None
    from_email: str = None
    from_name: str = "Legal Advocate AI"

    # Scheduler configuration
    check_schedule: str = "0 */6 * * *"  # Every 6 hours

    # Retry configuration
    max_retries: int = 3
    retry_delay: float = 2.0
    retry_backoff: float = 2.0

    # Batch processing
    batch_size: int = 50

    def __post_init__(self):
        if self.alert_intervals is None:
            self.alert_intervals = [30, 14, 7, 3, 1, 0]  # same_day = 0

        if self.sendgrid_api_key is None:
            self.sendgrid_api_key = os.getenv('SENDGRID_API_KEY')

        if self.from_email is None:
            self.from_email = os.getenv('ALERT_FROM_EMAIL', 'alerts@legaladvocate.ai')


class AlertEngine:
    """
    Background service to schedule and send deadline alerts

    Features:
    - Scheduled checks for upcoming deadlines
    - Email notifications via SendGrid
    - Retry logic for failed sends
    - Alert cancellation on deadline completion
    - Performance tracking and logging
    """

    def __init__(self, config: AlertConfig = None, database_url: str = None):
        """
        Initialize alert engine

        Args:
            config: Alert configuration
            database_url: Database connection string
        """
        self.config = config or AlertConfig()
        self.database_url = database_url
        self.engine = get_engine(database_url)
        self.scheduler = BackgroundScheduler()
        self.sendgrid_client = None

        # Initialize SendGrid if API key available
        if self.config.sendgrid_api_key:
            try:
                self.sendgrid_client = SendGridAPIClient(self.config.sendgrid_api_key)
                logger.info("✅ SendGrid client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize SendGrid: {e}")
                report_error(e, service="SendGrid", action="initialization")
        else:
            logger.warning("⚠️  No SendGrid API key - email alerts disabled")

        logger.info(f"Alert engine initialized with intervals: {self.config.alert_intervals}")

    def start(self):
        """Start the alert engine scheduler"""
        try:
            # Schedule periodic alert checks
            self.scheduler.add_job(
                self.process_alerts,
                trigger=CronTrigger.from_crontab(self.config.check_schedule),
                id='process_alerts',
                name='Process scheduled alerts',
                replace_existing=True
            )

            # Schedule deadline status updates
            self.scheduler.add_job(
                self.update_overdue_deadlines,
                trigger=CronTrigger.from_crontab('0 1 * * *'),  # Daily at 1 AM
                id='update_overdue',
                name='Update overdue deadline status',
                replace_existing=True
            )

            self.scheduler.start()
            logger.info(f"🚀 Alert engine started - checking every: {self.config.check_schedule}")
        except Exception as e:
            logger.error(f"Failed to start alert engine: {e}")
            report_error(e, service="AlertEngine", action="start")
            raise

    def stop(self):
        """Stop the alert engine scheduler"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown(wait=True)
                logger.info("⏹️  Alert engine stopped")
        except Exception as e:
            logger.error(f"Error stopping alert engine: {e}")
            report_error(e, service="AlertEngine", action="stop")

    @track_performance("process_alerts")
    @log_errors(reraise=False)
    def process_alerts(self):
        """
        Process all scheduled alerts that are due
        Main job that runs on schedule to send alerts
        """
        logger.info("🔔 Processing scheduled alerts...")

        session = get_session(self.engine)
        alert_repo = AlertRepository(session)

        try:
            # Get alerts scheduled up to now
            due_alerts = alert_repo.get_scheduled_alerts(before_date=datetime.utcnow())

            if not due_alerts:
                logger.info("No alerts to process")
                return

            logger.info(f"Found {len(due_alerts)} alerts to process")

            # Process alerts in batches
            for i in range(0, len(due_alerts), self.config.batch_size):
                batch = due_alerts[i:i + self.config.batch_size]
                self._process_alert_batch(batch, alert_repo)

            log_metric("alerts_processed", len(due_alerts))
            logger.info(f"✅ Processed {len(due_alerts)} alerts")

        except Exception as e:
            logger.error(f"Error processing alerts: {e}")
            report_error(e, service="AlertEngine", action="process_alerts")
        finally:
            session.close()

    def _process_alert_batch(self, alerts: List[Alert], alert_repo: AlertRepository):
        """Process a batch of alerts"""
        for alert in alerts:
            try:
                if alert.channel == 'email':
                    self._send_email_alert(alert, alert_repo)
                elif alert.channel == 'in_app':
                    self._create_in_app_alert(alert, alert_repo)
                else:
                    logger.warning(f"Unsupported channel: {alert.channel}")
                    alert_repo.mark_failed(alert.id, f"Unsupported channel: {alert.channel}")
            except Exception as e:
                logger.error(f"Error processing alert {alert.id}: {e}")
                report_error(e, alert_id=alert.id, service="AlertEngine")

    @retry(max_attempts=3, delay=2.0, backoff=2.0, exceptions=(Exception,))
    def _send_email_alert(self, alert: Alert, alert_repo: AlertRepository):
        """
        Send email alert with retry logic

        Args:
            alert: Alert to send
            alert_repo: Alert repository for status updates
        """
        if not self.sendgrid_client:
            logger.warning(f"Cannot send email alert {alert.id} - SendGrid not configured")
            alert_repo.mark_failed(alert.id, "SendGrid not configured")
            return

        try:
            deadline = alert.deadline

            # Generate email content
            subject = self._generate_email_subject(deadline, alert)
            body = self._generate_email_body(deadline, alert)

            # Get recipient from deadline user_id (assuming it's an email)
            to_email = deadline.user_id

            # Create SendGrid email
            message = Mail(
                from_email=Email(self.config.from_email, self.config.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", body)
            )

            # Send email
            response = self.sendgrid_client.send(message)

            if response.status_code in [200, 201, 202]:
                alert_repo.mark_sent(alert.id)
                logger.info(f"✅ Email alert sent: {alert.id} to {to_email}")
                log_metric("email_alert_sent", 1)
            else:
                error_msg = f"SendGrid returned status {response.status_code}"
                alert_repo.mark_failed(alert.id, error_msg)
                logger.error(f"Failed to send alert {alert.id}: {error_msg}")
                log_metric("email_alert_failed", 1)

        except Exception as e:
            error_msg = f"Email send error: {str(e)}"
            alert_repo.mark_failed(alert.id, error_msg)
            logger.error(f"Failed to send email alert {alert.id}: {e}")
            report_error(e, alert_id=alert.id, service="SendGrid")
            raise

    def _create_in_app_alert(self, alert: Alert, alert_repo: AlertRepository):
        """
        Create in-app notification

        Args:
            alert: Alert to create
            alert_repo: Alert repository for status updates
        """
        try:
            # For now, just mark as sent
            # In a real app, this would create a notification in the UI
            alert_repo.mark_sent(alert.id)
            logger.info(f"✅ In-app alert created: {alert.id}")
            log_metric("in_app_alert_created", 1)
        except Exception as e:
            alert_repo.mark_failed(alert.id, str(e))
            logger.error(f"Failed to create in-app alert {alert.id}: {e}")
            report_error(e, alert_id=alert.id, service="InAppAlerts")

    def _generate_email_subject(self, deadline: Deadline, alert: Alert) -> str:
        """
        Generate email subject based on deadline urgency

        Args:
            deadline: Deadline information
            alert: Alert being sent

        Returns:
            Email subject line
        """
        priority = self._get_alert_priority(deadline, alert)
        urgency_tag = f"[{priority.value}]" if priority != AlertPriority.LOW else ""

        return f"{urgency_tag} Deadline Alert: {deadline.case_number} - {deadline.deadline_type.title()}"

    def _generate_email_body(self, deadline: Deadline, alert: Alert) -> str:
        """
        Generate email body from template

        Args:
            deadline: Deadline information
            alert: Alert being sent

        Returns:
            HTML email body
        """
        days_remaining = (deadline.deadline_date - datetime.utcnow()).days

        # Determine urgency styling
        priority = self._get_alert_priority(deadline, alert)
        urgency_color = {
            AlertPriority.CRITICAL: "#dc3545",
            AlertPriority.HIGH: "#fd7e14",
            AlertPriority.MEDIUM: "#ffc107",
            AlertPriority.LOW: "#28a745"
        }.get(priority, "#6c757d")

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: {urgency_color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }}
                .deadline-info {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid {urgency_color}; }}
                .deadline-date {{ font-size: 24px; font-weight: bold; color: {urgency_color}; }}
                .action-needed {{ background-color: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 3px; }}
                .footer {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>⚖️ Legal Deadline Alert</h1>
                    <p>{priority.value} PRIORITY</p>
                </div>
                <div class="content">
                    <div class="deadline-info">
                        <h2>Case: {deadline.case_number}</h2>
                        <p><strong>Deadline Type:</strong> {deadline.deadline_type.title()}</p>
                        <p class="deadline-date">📅 {deadline.deadline_date.strftime('%B %d, %Y at %I:%M %p')}</p>
                        <p><strong>Days Remaining:</strong> {days_remaining if days_remaining >= 0 else 'OVERDUE'}</p>
                    </div>

                    <div class="action-needed">
                        <h3>⚡ Action Required</h3>
                        <p>{deadline.action_required}</p>
                    </div>

                    <div>
                        <p><strong>Responsible Party:</strong> {deadline.responsible_party or 'Not specified'}</p>
                        {f'<p><strong>Source:</strong> {deadline.source_document}</p>' if deadline.source_document else ''}
                    </div>

                    <div class="footer">
                        <p>This is an automated alert from Legal Advocate AI.</p>
                        <p>Alert Type: {alert.alert_type.replace('_', ' ').title()}</p>
                        <p>If you have completed this deadline, please update the status in your dashboard.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        return html

    def _get_alert_priority(self, deadline: Deadline, alert: Alert) -> AlertPriority:
        """
        Determine alert priority based on deadline urgency

        Args:
            deadline: Deadline information
            alert: Alert being sent

        Returns:
            AlertPriority enum value
        """
        days_until = (deadline.deadline_date - datetime.utcnow()).days

        if days_until < 0 or alert.alert_type == 'same_day':
            return AlertPriority.CRITICAL
        elif days_until <= 3:
            return AlertPriority.HIGH
        elif days_until <= 14:
            return AlertPriority.MEDIUM
        else:
            return AlertPriority.LOW

    @log_errors(reraise=False)
    def create_alerts_for_deadline(
        self,
        deadline: Deadline,
        channels: List[str] = None
    ) -> List[Alert]:
        """
        Create alert schedule for a new deadline

        Args:
            deadline: Deadline to create alerts for
            channels: Notification channels (defaults to ['email'])

        Returns:
            List of created alerts
        """
        if channels is None:
            channels = ['email']

        session = get_session(self.engine)
        alert_repo = AlertRepository(session)

        try:
            all_alerts = []

            for channel in channels:
                # Map intervals to alert types
                alert_types = []
                for days in self.config.alert_intervals:
                    if days == 0:
                        alert_types.append('same_day')
                    else:
                        alert_types.append(f'{days}_days')

                alerts = alert_repo.create_deadline_alerts(
                    deadline_id=deadline.id,
                    deadline_date=deadline.deadline_date,
                    alert_types=alert_types,
                    channel=channel
                )
                all_alerts.extend(alerts)

            logger.info(f"Created {len(all_alerts)} alerts for deadline {deadline.id}")
            log_metric("alerts_created", len(all_alerts))
            return all_alerts

        except Exception as e:
            logger.error(f"Error creating alerts for deadline {deadline.id}: {e}")
            report_error(e, deadline_id=deadline.id, service="AlertEngine")
            return []
        finally:
            session.close()

    @log_errors(reraise=False)
    def cancel_deadline_alerts(self, deadline_id: str) -> int:
        """
        Cancel all scheduled alerts for a completed/cancelled deadline

        Args:
            deadline_id: Deadline ID

        Returns:
            Number of alerts cancelled
        """
        session = get_session(self.engine)
        alert_repo = AlertRepository(session)

        try:
            count = alert_repo.cancel_deadline_alerts(deadline_id)
            logger.info(f"Cancelled {count} alerts for deadline {deadline_id}")
            log_metric("alerts_cancelled", count)
            return count
        except Exception as e:
            logger.error(f"Error cancelling alerts for deadline {deadline_id}: {e}")
            report_error(e, deadline_id=deadline_id, service="AlertEngine")
            return 0
        finally:
            session.close()

    @log_errors(reraise=False)
    def retry_failed_alerts(self, limit: int = 10) -> int:
        """
        Retry failed alerts

        Args:
            limit: Maximum number of alerts to retry

        Returns:
            Number of alerts retried
        """
        session = get_session(self.engine)
        alert_repo = AlertRepository(session)

        try:
            failed_alerts = alert_repo.get_failed_alerts(limit=limit)

            if not failed_alerts:
                logger.info("No failed alerts to retry")
                return 0

            logger.info(f"Retrying {len(failed_alerts)} failed alerts")

            for alert in failed_alerts:
                try:
                    # Reset status to scheduled for retry
                    alert_repo.update(alert.id, status='scheduled')

                    # Process immediately
                    if alert.channel == 'email':
                        self._send_email_alert(alert, alert_repo)
                    elif alert.channel == 'in_app':
                        self._create_in_app_alert(alert, alert_repo)

                except Exception as e:
                    logger.error(f"Retry failed for alert {alert.id}: {e}")
                    report_error(e, alert_id=alert.id, service="AlertEngine", action="retry")

            log_metric("alerts_retried", len(failed_alerts))
            return len(failed_alerts)

        except Exception as e:
            logger.error(f"Error retrying failed alerts: {e}")
            report_error(e, service="AlertEngine", action="retry_failed")
            return 0
        finally:
            session.close()

    @log_errors(reraise=False)
    def update_overdue_deadlines(self):
        """Update status of past-due deadlines to 'overdue'"""
        logger.info("Updating overdue deadline statuses...")

        session = get_session(self.engine)
        deadline_repo = DeadlineRepository(session)

        try:
            # Get all users with deadlines (simplified - in production would query distinct users)
            # For now, we'll update all pending deadlines that are overdue
            count = deadline_repo.update_overdue_status(user_id='%')  # Wildcard for all users

            if count > 0:
                logger.info(f"Updated {count} deadlines to overdue status")
                log_metric("deadlines_overdue", count)

        except Exception as e:
            logger.error(f"Error updating overdue deadlines: {e}")
            report_error(e, service="AlertEngine", action="update_overdue")
        finally:
            session.close()

    def get_alert_statistics(self) -> Dict[str, Any]:
        """
        Get alert engine statistics

        Returns:
            Dictionary with alert statistics
        """
        session = get_session(self.engine)
        alert_repo = AlertRepository(session)

        try:
            stats = {
                'scheduled': len(alert_repo.get_by_channel('email', status='scheduled')),
                'sent': len(alert_repo.get_by_channel('email', status='sent')),
                'failed': len(alert_repo.get_by_channel('email', status='failed')),
                'cancelled': len(alert_repo.get_by_channel('email', status='cancelled')),
                'scheduler_running': self.scheduler.running if self.scheduler else False,
                'scheduled_jobs': len(self.scheduler.get_jobs()) if self.scheduler else 0
            }

            return stats
        except Exception as e:
            logger.error(f"Error getting alert statistics: {e}")
            return {}
        finally:
            session.close()


# Singleton instance
_alert_engine_instance: Optional[AlertEngine] = None


def get_alert_engine(config: AlertConfig = None, database_url: str = None) -> AlertEngine:
    """
    Get or create alert engine singleton instance

    Args:
        config: Alert configuration (only used on first call)
        database_url: Database URL (only used on first call)

    Returns:
        AlertEngine instance
    """
    global _alert_engine_instance

    if _alert_engine_instance is None:
        _alert_engine_instance = AlertEngine(config, database_url)

    return _alert_engine_instance


# Convenience functions for common operations
def start_alert_engine(config: AlertConfig = None, database_url: str = None):
    """Start the alert engine"""
    engine = get_alert_engine(config, database_url)
    engine.start()
    return engine


def stop_alert_engine():
    """Stop the alert engine"""
    if _alert_engine_instance:
        _alert_engine_instance.stop()


if __name__ == "__main__":
    # Test/demo mode
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Create test configuration
    config = AlertConfig(
        sendgrid_api_key=os.getenv('SENDGRID_API_KEY'),
        from_email=os.getenv('ALERT_FROM_EMAIL', 'alerts@legaladvocate.ai'),
        check_schedule="*/5 * * * *"  # Every 5 minutes for testing
    )

    # Start engine
    engine = start_alert_engine(config)

    try:
        # Print statistics
        stats = engine.get_alert_statistics()
        print("\n📊 Alert Engine Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")

        print("\n🚀 Alert engine running... Press Ctrl+C to stop")

        # Keep running
        import time
        while True:
            time.sleep(60)

    except KeyboardInterrupt:
        print("\n⏹️  Stopping alert engine...")
        stop_alert_engine()
        print("✅ Alert engine stopped")
        sys.exit(0)
