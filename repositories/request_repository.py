"""
Request Repository for Legal Advocate AI
Specialized repository for attorney request operations
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.database import Request
from repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class RequestRepository(BaseRepository[Request]):
    """
    Repository for Request model with specialized query methods

    Features:
    - Get pending/urgent requests
    - Filter by case, user, urgency, type
    - Request status management
    - Deadline tracking
    """

    def __init__(self, session: Session):
        super().__init__(Request, session)

    def get_by_case(self, case_number: str, status: Optional[str] = None) -> List[Request]:
        """
        Get all requests for a specific case

        Args:
            case_number: Case number
            status: Optional status filter

        Returns:
            List of requests for the case
        """
        try:
            query = self.session.query(Request).filter_by(case_number=case_number)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests for case {case_number}: {e}")
            raise

    def get_by_user(self, user_id: str, status: Optional[str] = None) -> List[Request]:
        """
        Get all requests for a specific user

        Args:
            user_id: User identifier
            status: Optional status filter

        Returns:
            List of requests for the user
        """
        try:
            query = self.session.query(Request).filter_by(user_id=user_id)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests for user {user_id}: {e}")
            raise

    def get_pending_requests(self, user_id: str) -> List[Request]:
        """
        Get all pending requests for a user

        Args:
            user_id: User identifier

        Returns:
            List of pending requests ordered by urgency and date
        """
        try:
            # Order by urgency priority: urgent > high > normal > low
            urgency_order = {
                'urgent': 1,
                'high': 2,
                'normal': 3,
                'low': 4
            }

            requests = self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.status == 'pending'
                )
            ).all()

            # Sort by urgency then by requested date
            return sorted(
                requests,
                key=lambda r: (urgency_order.get(r.urgency, 5), r.requested_date)
            )
        except Exception as e:
            logger.error(f"Error getting pending requests for user {user_id}: {e}")
            raise

    def get_urgent_requests(self, user_id: str) -> List[Request]:
        """
        Get urgent and high priority requests

        Args:
            user_id: User identifier

        Returns:
            List of urgent/high priority pending requests
        """
        try:
            return self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.status == 'pending',
                    or_(
                        Request.urgency == 'urgent',
                        Request.urgency == 'high'
                    )
                )
            ).order_by(Request.requested_date).all()
        except Exception as e:
            logger.error(f"Error getting urgent requests for user {user_id}: {e}")
            raise

    def get_requests_with_deadline(self, user_id: str) -> List[Request]:
        """
        Get requests that have a specified deadline

        Args:
            user_id: User identifier

        Returns:
            List of requests with deadlines
        """
        try:
            return self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.status == 'pending',
                    Request.deadline.isnot(None)
                )
            ).order_by(Request.deadline).all()
        except Exception as e:
            logger.error(f"Error getting requests with deadlines: {e}")
            raise

    def get_overdue_requests(self, user_id: str) -> List[Request]:
        """
        Get requests with deadlines that have passed

        Args:
            user_id: User identifier

        Returns:
            List of overdue requests
        """
        try:
            return self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.status == 'pending',
                    Request.deadline.isnot(None),
                    Request.deadline < datetime.utcnow()
                )
            ).order_by(Request.deadline).all()
        except Exception as e:
            logger.error(f"Error getting overdue requests: {e}")
            raise

    def get_by_type(
        self,
        user_id: str,
        request_type: str,
        status: Optional[str] = None
    ) -> List[Request]:
        """
        Get requests by type (document, information, action, meeting)

        Args:
            user_id: User identifier
            request_type: Type of request
            status: Optional status filter

        Returns:
            List of matching requests
        """
        try:
            query = self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.request_type == request_type
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests by type {request_type}: {e}")
            raise

    def get_by_requestor(
        self,
        user_id: str,
        requested_by: str,
        status: Optional[str] = None
    ) -> List[Request]:
        """
        Get requests from a specific attorney/requestor

        Args:
            user_id: User identifier
            requested_by: Email or name of requestor
            status: Optional status filter

        Returns:
            List of requests from the requestor
        """
        try:
            query = self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.requested_by == requested_by
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests by requestor {requested_by}: {e}")
            raise

    def mark_completed(
        self,
        request_id: str,
        completed_at: Optional[datetime] = None
    ) -> Optional[Request]:
        """
        Mark a request as completed

        Args:
            request_id: Request ID
            completed_at: Completion timestamp (defaults to now)

        Returns:
            Updated request or None if not found
        """
        try:
            if completed_at is None:
                completed_at = datetime.utcnow()

            return self.update(
                request_id,
                status='completed',
                completed_at=completed_at
            )
        except Exception as e:
            logger.error(f"Error marking request {request_id} as completed: {e}")
            raise

    def get_requests_by_date_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        status: Optional[str] = None
    ) -> List[Request]:
        """
        Get requests within a date range

        Args:
            user_id: User identifier
            start_date: Range start date
            end_date: Range end date
            status: Optional status filter

        Returns:
            List of requests in range
        """
        try:
            query = self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.requested_date >= start_date,
                    Request.requested_date <= end_date
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests by date range: {e}")
            raise

    def get_by_urgency(
        self,
        user_id: str,
        urgency: str,
        status: Optional[str] = None
    ) -> List[Request]:
        """
        Get requests by urgency level

        Args:
            user_id: User identifier
            urgency: Urgency level (low, normal, high, urgent)
            status: Optional status filter

        Returns:
            List of requests with specified urgency
        """
        try:
            query = self.session.query(Request).filter(
                and_(
                    Request.user_id == user_id,
                    Request.urgency == urgency
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Request.requested_date.desc()).all()
        except Exception as e:
            logger.error(f"Error getting requests by urgency {urgency}: {e}")
            raise
