"""
Deadline Repository for Legal Advocate AI
Specialized repository for deadline operations
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models.database import Deadline
from repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class DeadlineRepository(BaseRepository[Deadline]):
    """
    Repository for Deadline model with specialized query methods

    Features:
    - Get pending/overdue/upcoming deadlines
    - Filter by case, user, date range
    - Deadline status management
    """

    def __init__(self, session: Session):
        super().__init__(Deadline, session)

    def get_by_case(self, case_number: str, status: Optional[str] = None) -> List[Deadline]:
        """
        Get all deadlines for a specific case

        Args:
            case_number: Case number
            status: Optional status filter

        Returns:
            List of deadlines for the case
        """
        try:
            query = self.session.query(Deadline).filter_by(case_number=case_number)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting deadlines for case {case_number}: {e}")
            raise

    def get_by_user(self, user_id: str, status: Optional[str] = None) -> List[Deadline]:
        """
        Get all deadlines for a specific user

        Args:
            user_id: User identifier
            status: Optional status filter

        Returns:
            List of deadlines for the user
        """
        try:
            query = self.session.query(Deadline).filter_by(user_id=user_id)
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting deadlines for user {user_id}: {e}")
            raise

    def get_pending_deadlines(self, user_id: str) -> List[Deadline]:
        """
        Get all pending (not completed/cancelled) deadlines for a user

        Args:
            user_id: User identifier

        Returns:
            List of pending deadlines ordered by date
        """
        try:
            return self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.status == 'pending'
                )
            ).order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting pending deadlines for user {user_id}: {e}")
            raise

    def get_upcoming_deadlines(self, user_id: str, days: int = 30) -> List[Deadline]:
        """
        Get upcoming deadlines within specified days

        Args:
            user_id: User identifier
            days: Number of days to look ahead (default 30)

        Returns:
            List of upcoming deadlines
        """
        try:
            cutoff_date = datetime.utcnow() + timedelta(days=days)
            return self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.status == 'pending',
                    Deadline.deadline_date <= cutoff_date,
                    Deadline.deadline_date >= datetime.utcnow()
                )
            ).order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting upcoming deadlines for user {user_id}: {e}")
            raise

    def get_overdue_deadlines(self, user_id: str) -> List[Deadline]:
        """
        Get overdue deadlines (past deadline date and still pending)

        Args:
            user_id: User identifier

        Returns:
            List of overdue deadlines
        """
        try:
            return self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.status == 'pending',
                    Deadline.deadline_date < datetime.utcnow()
                )
            ).order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting overdue deadlines for user {user_id}: {e}")
            raise

    def get_by_date_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        status: Optional[str] = None
    ) -> List[Deadline]:
        """
        Get deadlines within a date range

        Args:
            user_id: User identifier
            start_date: Range start date
            end_date: Range end date
            status: Optional status filter

        Returns:
            List of deadlines in range
        """
        try:
            query = self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.deadline_date >= start_date,
                    Deadline.deadline_date <= end_date
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting deadlines by date range: {e}")
            raise

    def mark_completed(self, deadline_id: str, completed_at: Optional[datetime] = None) -> Optional[Deadline]:
        """
        Mark a deadline as completed

        Args:
            deadline_id: Deadline ID
            completed_at: Completion timestamp (defaults to now)

        Returns:
            Updated deadline or None if not found
        """
        try:
            if completed_at is None:
                completed_at = datetime.utcnow()

            return self.update(
                deadline_id,
                status='completed',
                completed_at=completed_at
            )
        except Exception as e:
            logger.error(f"Error marking deadline {deadline_id} as completed: {e}")
            raise

    def mark_overdue(self, deadline_id: str) -> Optional[Deadline]:
        """
        Mark a deadline as overdue

        Args:
            deadline_id: Deadline ID

        Returns:
            Updated deadline or None if not found
        """
        try:
            return self.update(deadline_id, status='overdue')
        except Exception as e:
            logger.error(f"Error marking deadline {deadline_id} as overdue: {e}")
            raise

    def get_by_type(self, user_id: str, deadline_type: str, status: Optional[str] = None) -> List[Deadline]:
        """
        Get deadlines by type (filing, hearing, response, discovery)

        Args:
            user_id: User identifier
            deadline_type: Type of deadline
            status: Optional status filter

        Returns:
            List of matching deadlines
        """
        try:
            query = self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.deadline_type == deadline_type
                )
            )
            if status:
                query = query.filter_by(status=status)
            return query.order_by(Deadline.deadline_date).all()
        except Exception as e:
            logger.error(f"Error getting deadlines by type {deadline_type}: {e}")
            raise

    def update_overdue_status(self, user_id: str) -> int:
        """
        Batch update all pending deadlines that are past due to 'overdue' status

        Args:
            user_id: User identifier

        Returns:
            Number of deadlines updated
        """
        try:
            overdue_deadlines = self.session.query(Deadline).filter(
                and_(
                    Deadline.user_id == user_id,
                    Deadline.status == 'pending',
                    Deadline.deadline_date < datetime.utcnow()
                )
            ).all()

            for deadline in overdue_deadlines:
                deadline.status = 'overdue'

            self.session.commit()
            logger.info(f"Updated {len(overdue_deadlines)} deadlines to overdue status")
            return len(overdue_deadlines)
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error updating overdue status: {e}")
            raise
