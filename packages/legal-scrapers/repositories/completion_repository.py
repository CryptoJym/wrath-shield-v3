"""
Completion Tracking Repository for Legal Advocate AI
Specialized repository for tracking deadline and request completions
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.database import CompletionTracking
from repositories.base_repository import BaseRepository
import logging

logger = logging.getLogger(__name__)


class CompletionTrackingRepository(BaseRepository[CompletionTracking]):
    """
    Repository for CompletionTracking model

    Features:
    - Track completion of deadlines and requests
    - Filter by item type, user, date range
    - Verification and audit trail
    """

    def __init__(self, session: Session):
        super().__init__(CompletionTracking, session)

    def track_completion(
        self,
        item_type: str,
        item_id: str,
        user_id: str,
        completion_method: str = 'manual',
        completion_notes: Optional[str] = None,
        verified_by: Optional[str] = None,
        verification_source: Optional[str] = None,
        completed_at: Optional[datetime] = None
    ) -> CompletionTracking:
        """
        Track the completion of a deadline or request

        Args:
            item_type: Type of item ('deadline' or 'request')
            item_id: Item ID
            user_id: User identifier
            completion_method: How it was completed
            completion_notes: Optional notes
            verified_by: Who verified completion
            verification_source: Source of verification (email ID, etc.)
            completed_at: Completion timestamp (defaults to now)

        Returns:
            Created completion tracking record
        """
        try:
            if completed_at is None:
                completed_at = datetime.utcnow()

            return self.create(
                item_type=item_type,
                item_id=item_id,
                user_id=user_id,
                completed_at=completed_at,
                completion_method=completion_method,
                completion_notes=completion_notes,
                verified_by=verified_by,
                verification_source=verification_source
            )
        except Exception as e:
            logger.error(f"Error tracking completion for {item_type} {item_id}: {e}")
            raise

    def get_by_item(self, item_type: str, item_id: str) -> List[CompletionTracking]:
        """
        Get all completion records for a specific item

        Args:
            item_type: Type of item ('deadline' or 'request')
            item_id: Item ID

        Returns:
            List of completion records
        """
        try:
            return self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.item_type == item_type,
                    CompletionTracking.item_id == item_id
                )
            ).order_by(CompletionTracking.completed_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting completion records for {item_type} {item_id}: {e}")
            raise

    def get_user_completions(
        self,
        user_id: str,
        item_type: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[CompletionTracking]:
        """
        Get all completion records for a user

        Args:
            user_id: User identifier
            item_type: Optional filter by item type
            limit: Maximum number of records

        Returns:
            List of completion records
        """
        try:
            query = self.session.query(CompletionTracking).filter_by(user_id=user_id)
            if item_type:
                query = query.filter_by(item_type=item_type)
            query = query.order_by(CompletionTracking.completed_at.desc())
            if limit:
                query = query.limit(limit)
            return query.all()
        except Exception as e:
            logger.error(f"Error getting completions for user {user_id}: {e}")
            raise

    def get_recent_completions(
        self,
        user_id: str,
        days: int = 7,
        item_type: Optional[str] = None
    ) -> List[CompletionTracking]:
        """
        Get recent completion records

        Args:
            user_id: User identifier
            days: Number of days to look back
            item_type: Optional filter by item type

        Returns:
            List of recent completion records
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.user_id == user_id,
                    CompletionTracking.completed_at >= cutoff_date
                )
            )
            if item_type:
                query = query.filter_by(item_type=item_type)
            return query.order_by(CompletionTracking.completed_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting recent completions: {e}")
            raise

    def get_by_method(
        self,
        user_id: str,
        completion_method: str,
        item_type: Optional[str] = None
    ) -> List[CompletionTracking]:
        """
        Get completions by completion method

        Args:
            user_id: User identifier
            completion_method: Method of completion
            item_type: Optional filter by item type

        Returns:
            List of completion records
        """
        try:
            query = self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.user_id == user_id,
                    CompletionTracking.completion_method == completion_method
                )
            )
            if item_type:
                query = query.filter_by(item_type=item_type)
            return query.order_by(CompletionTracking.completed_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting completions by method {completion_method}: {e}")
            raise

    def get_verified_completions(
        self,
        user_id: str,
        item_type: Optional[str] = None
    ) -> List[CompletionTracking]:
        """
        Get completion records that have been verified

        Args:
            user_id: User identifier
            item_type: Optional filter by item type

        Returns:
            List of verified completion records
        """
        try:
            query = self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.user_id == user_id,
                    CompletionTracking.verified_by.isnot(None)
                )
            )
            if item_type:
                query = query.filter_by(item_type=item_type)
            return query.order_by(CompletionTracking.completed_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting verified completions: {e}")
            raise

    def get_by_date_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        item_type: Optional[str] = None
    ) -> List[CompletionTracking]:
        """
        Get completion records within a date range

        Args:
            user_id: User identifier
            start_date: Range start date
            end_date: Range end date
            item_type: Optional filter by item type

        Returns:
            List of completion records in range
        """
        try:
            query = self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.user_id == user_id,
                    CompletionTracking.completed_at >= start_date,
                    CompletionTracking.completed_at <= end_date
                )
            )
            if item_type:
                query = query.filter_by(item_type=item_type)
            return query.order_by(CompletionTracking.completed_at.desc()).all()
        except Exception as e:
            logger.error(f"Error getting completions by date range: {e}")
            raise

    def get_completion_stats(
        self,
        user_id: str,
        days: int = 30
    ) -> dict:
        """
        Get completion statistics for a user

        Args:
            user_id: User identifier
            days: Number of days to analyze

        Returns:
            Dictionary with completion statistics
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            # Get all completions in period
            completions = self.session.query(CompletionTracking).filter(
                and_(
                    CompletionTracking.user_id == user_id,
                    CompletionTracking.completed_at >= cutoff_date
                )
            ).all()

            # Calculate stats
            total_completions = len(completions)
            deadline_completions = sum(1 for c in completions if c.item_type == 'deadline')
            request_completions = sum(1 for c in completions if c.item_type == 'request')
            verified_completions = sum(1 for c in completions if c.verified_by is not None)

            # Count by method
            method_counts = {}
            for completion in completions:
                method = completion.completion_method or 'unknown'
                method_counts[method] = method_counts.get(method, 0) + 1

            return {
                'total_completions': total_completions,
                'deadline_completions': deadline_completions,
                'request_completions': request_completions,
                'verified_completions': verified_completions,
                'verification_rate': verified_completions / total_completions if total_completions > 0 else 0,
                'completions_by_method': method_counts,
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error getting completion stats: {e}")
            raise

    def is_item_completed(self, item_type: str, item_id: str) -> bool:
        """
        Check if an item has been marked as completed

        Args:
            item_type: Type of item ('deadline' or 'request')
            item_id: Item ID

        Returns:
            True if completion record exists
        """
        try:
            return self.exists(item_type=item_type, item_id=item_id)
        except Exception as e:
            logger.error(f"Error checking completion status: {e}")
            raise
