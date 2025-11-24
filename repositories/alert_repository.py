"""
Alert Repository for Legal Advocate AI
Specialized repository for alert/notification operations
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from models.database import Alert, Deadline
from repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class AlertRepository(BaseRepository[Alert]):
    """
    Repository for Alert model with specialized query methods

    Features:
    - Get scheduled/sent/failed alerts
    - Filter by deadline, date range, channel
    - Alert lifecycle management
    - Batch operations for alert processing
    """

    def __init__(self, session: Session):
        super().__init__(Alert, session)

    def get_by_deadline(self, deadline_id: str) -> List[Alert]:
        """
        Get all alerts for a specific deadline

        Args:
            deadline_id: Deadline ID

        Returns:
            List of alerts for the deadline
        """
        try:
            return self.session.query(Alert).filter_by(
                deadline_id=deadline_id
            ).order_by(Alert.scheduled_at).all()
        except Exception as e:
            logger.error(f"Error getting alerts for deadline {deadline_id}: {e}")
            raise

    def get_scheduled_alerts(
        self,
        before_date: Optional[datetime] = None
    ) -> List[Alert]:
        """
        Get all scheduled alerts, optionally before a certain date

        Args:
            before_date: Optional cutoff date (defaults to now)

        Returns:
            List of scheduled alerts
        """
        try:
            if before_date is None:
                before_date = datetime.utcnow()

            return self.session.query(Alert).filter(
                and_(
                    Alert.status == 'scheduled',
                    Alert.scheduled_at <= before_date
                )
            ).order_by(Alert.scheduled_at).all()
        except Exception as e:
            logger.error(f"Error getting scheduled alerts: {e}")
            raise

    def get_upcoming_alerts(self, hours: int = 24) -> List[Alert]:
        """
        Get alerts scheduled within the next N hours

        Args:
            hours: Number of hours to look ahead (default 24)

        Returns:
            List of upcoming alerts with deadline info
        """
        try:
            cutoff_time = datetime.utcnow() + timedelta(hours=hours)
            return self.session.query(Alert).options(
                joinedload(Alert.deadline)
            ).filter(
                and_(
                    Alert.status == 'scheduled',
                    Alert.scheduled_at >= datetime.utcnow(),
                    Alert.scheduled_at <= cutoff_time
                )
            ).order_by(Alert.scheduled_at).all()
        except Exception as e:
            logger.error(f"Error getting upcoming alerts: {e}")
            raise

    def get_failed_alerts(self, limit: Optional[int] = None) -> List[Alert]:
        """
        Get all failed alerts for retry processing

        Args:
            limit: Maximum number of alerts to return

        Returns:
            List of failed alerts
        """
        try:
            query = self.session.query(Alert).filter_by(status='failed')
            if limit:
                query = query.limit(limit)
            return query.order_by(Alert.scheduled_at).all()
        except Exception as e:
            logger.error(f"Error getting failed alerts: {e}")
            raise

    def get_by_channel(self, channel: str, status: Optional[str] = None) -> List[Alert]:
        """
        Get alerts by notification channel

        Args:
            channel: Notification channel (email, sms, push, in_app)
            status: Optional status filter

        Returns:
            List of alerts for the channel
        """
        try:
            query = self.session.query(Alert).filter_by(channel=channel)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Alert.scheduled_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting alerts by channel {channel}: {e}")
            raise

    def mark_sent(
        self,
        alert_id: str,
        sent_at: Optional[datetime] = None
    ) -> Optional[Alert]:
        """
        Mark an alert as sent

        Args:
            alert_id: Alert ID
            sent_at: Timestamp when sent (defaults to now)

        Returns:
            Updated alert or None if not found
        """
        try:
            if sent_at is None:
                sent_at = datetime.utcnow()

            return self.update(
                alert_id,
                status='sent',
                sent_at=sent_at
            )
        except Exception as e:
            logger.error(f"Error marking alert {alert_id} as sent: {e}")
            raise

    def mark_failed(
        self,
        alert_id: str,
        error_message: str
    ) -> Optional[Alert]:
        """
        Mark an alert as failed with error message

        Args:
            alert_id: Alert ID
            error_message: Failure reason

        Returns:
            Updated alert or None if not found
        """
        try:
            return self.update(
                alert_id,
                status='failed',
                error_message=error_message
            )
        except Exception as e:
            logger.error(f"Error marking alert {alert_id} as failed: {e}")
            raise

    def cancel_alert(self, alert_id: str) -> Optional[Alert]:
        """
        Cancel a scheduled alert

        Args:
            alert_id: Alert ID

        Returns:
            Updated alert or None if not found
        """
        try:
            return self.update(alert_id, status='cancelled')
        except Exception as e:
            logger.error(f"Error cancelling alert {alert_id}: {e}")
            raise

    def cancel_deadline_alerts(self, deadline_id: str) -> int:
        """
        Cancel all scheduled alerts for a deadline

        Args:
            deadline_id: Deadline ID

        Returns:
            Number of alerts cancelled
        """
        try:
            alerts = self.session.query(Alert).filter(
                and_(
                    Alert.deadline_id == deadline_id,
                    Alert.status == 'scheduled'
                )
            ).all()

            for alert in alerts:
                alert.status = 'cancelled'

            self.session.commit()
            logger.info(f"Cancelled {len(alerts)} alerts for deadline {deadline_id}")
            return len(alerts)
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error cancelling alerts for deadline {deadline_id}: {e}")
            raise

    def create_deadline_alerts(
        self,
        deadline_id: str,
        deadline_date: datetime,
        alert_types: List[str],
        channel: str = 'email'
    ) -> List[Alert]:
        """
        Create multiple alerts for a deadline

        Args:
            deadline_id: Deadline ID
            deadline_date: Deadline date
            alert_types: List of alert types (e.g., ['30_days', '7_days', '1_day'])
            channel: Notification channel

        Returns:
            List of created alerts
        """
        try:
            # Map alert types to days before deadline
            alert_day_map = {
                '30_days': 30,
                '14_days': 14,
                '7_days': 7,
                '3_days': 3,
                '1_day': 1,
                'same_day': 0
            }

            alerts = []
            for alert_type in alert_types:
                days_before = alert_day_map.get(alert_type)
                if days_before is None:
                    logger.warning(f"Unknown alert type: {alert_type}")
                    continue

                scheduled_at = deadline_date - timedelta(days=days_before)

                # Only create alert if scheduled time is in the future
                if scheduled_at > datetime.utcnow():
                    alert = self.create(
                        deadline_id=deadline_id,
                        alert_type=alert_type,
                        scheduled_at=scheduled_at,
                        channel=channel,
                        status='scheduled'
                    )
                    alerts.append(alert)

            logger.info(f"Created {len(alerts)} alerts for deadline {deadline_id}")
            return alerts
        except Exception as e:
            logger.error(f"Error creating alerts for deadline {deadline_id}: {e}")
            raise

    def get_alerts_with_deadlines(
        self,
        user_id: str,
        status: Optional[str] = None
    ) -> List[Alert]:
        """
        Get alerts with their associated deadline information

        Args:
            user_id: User identifier
            status: Optional status filter

        Returns:
            List of alerts with eager-loaded deadline data
        """
        try:
            query = self.session.query(Alert).join(
                Deadline, Alert.deadline_id == Deadline.id
            ).filter(
                Deadline.user_id == user_id
            ).options(joinedload(Alert.deadline))

            if status:
                query = query.filter(Alert.status == status)

            return query.order_by(Alert.scheduled_at).all()
        except Exception as e:
            logger.error(f"Error getting alerts with deadlines: {e}")
            raise

    def get_recent_alerts(
        self,
        user_id: str,
        days: int = 7,
        limit: Optional[int] = None
    ) -> List[Alert]:
        """
        Get recently sent/failed alerts

        Args:
            user_id: User identifier
            days: Number of days to look back
            limit: Maximum number of alerts

        Returns:
            List of recent alerts
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = self.session.query(Alert).join(
                Deadline, Alert.deadline_id == Deadline.id
            ).filter(
                and_(
                    Deadline.user_id == user_id,
                    or_(
                        Alert.status == 'sent',
                        Alert.status == 'failed'
                    ),
                    Alert.sent_at >= cutoff_date
                )
            ).options(joinedload(Alert.deadline)).order_by(Alert.sent_at.desc())

            if limit:
                query = query.limit(limit)

            return query.all()
        except Exception as e:
            logger.error(f"Error getting recent alerts: {e}")
            raise
