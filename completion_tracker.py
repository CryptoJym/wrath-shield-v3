"""
Completion Tracker for Legal Advocate AI
Comprehensive tracking of deadline and request completions
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from repositories.completion_repository import CompletionTrackingRepository
from repositories.deadline_repository import DeadlineRepository
from repositories.request_repository import RequestRepository
from repositories.alert_repository import AlertRepository
import logging

logger = logging.getLogger(__name__)


class CompletionTracker:
    """
    Comprehensive completion tracking system

    Features:
    - Manual and automatic completion recording
    - Multiple verification sources
    - Confidence scoring for automatic completions
    - Complete audit trail
    - Alert cancellation integration
    - Batch completion support
    - Undo functionality
    - Analytics and reporting
    """

    def __init__(
        self,
        completion_repo: CompletionTrackingRepository,
        deadline_repo: DeadlineRepository,
        request_repo: RequestRepository,
        alert_repo: AlertRepository
    ):
        """
        Initialize completion tracker

        Args:
            completion_repo: Repository for completion tracking records
            deadline_repo: Repository for deadline records
            request_repo: Repository for request records
            alert_repo: Repository for alert records
        """
        self.completion_repo = completion_repo
        self.deadline_repo = deadline_repo
        self.request_repo = request_repo
        self.alert_repo = alert_repo

    def complete_deadline(
        self,
        deadline_id: str,
        user_id: str,
        completion_method: str = 'manual',
        notes: Optional[str] = None,
        verification_source: Optional[str] = None,
        verified_by: Optional[str] = None,
        completed_at: Optional[datetime] = None,
        confidence_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Complete a deadline and track the completion

        Args:
            deadline_id: Deadline ID
            user_id: User completing the deadline
            completion_method: How it was completed (manual, automatic, email_confirmation, external_api)
            notes: Optional completion notes
            verification_source: Source of verification (email_id, document_id, api_response)
            verified_by: User or system that verified completion
            completed_at: Completion timestamp (defaults to now)
            confidence_score: Confidence score for automatic completions (0.0-1.0)

        Returns:
            Dict with completion record and updated deadline
        """
        try:
            # Get the deadline
            deadline = self.deadline_repo.get(deadline_id)
            if not deadline:
                raise ValueError(f"Deadline {deadline_id} not found")

            # Check if already completed
            if deadline.status == 'completed':
                logger.warning(f"Deadline {deadline_id} is already completed")
                return {
                    'success': False,
                    'message': 'Deadline is already completed',
                    'deadline': deadline
                }

            # Validate confidence score for automatic completions
            if completion_method in ['automatic', 'email_confirmation', 'external_api']:
                if confidence_score is None or confidence_score < 0.8:
                    raise ValueError(
                        f"Automatic completions require confidence score >= 0.8, got {confidence_score}"
                    )

            # Create completion record
            completion = self.completion_repo.track_completion(
                item_type='deadline',
                item_id=deadline_id,
                user_id=user_id,
                completion_method=completion_method,
                completion_notes=notes,
                verified_by=verified_by or user_id,
                verification_source=verification_source,
                completed_at=completed_at
            )

            # Update deadline status
            self.deadline_repo.update(
                deadline_id,
                status='completed',
                completed_at=completed_at or datetime.utcnow()
            )

            # Cancel all pending alerts for this deadline
            cancelled_count = self._cancel_deadline_alerts(deadline_id)

            logger.info(
                f"Completed deadline {deadline_id} via {completion_method}, "
                f"cancelled {cancelled_count} alerts"
            )

            return {
                'success': True,
                'completion': completion,
                'deadline': self.deadline_repo.get(deadline_id),
                'alerts_cancelled': cancelled_count,
                'confidence_score': confidence_score
            }

        except Exception as e:
            logger.error(f"Error completing deadline {deadline_id}: {e}")
            raise

    def complete_request(
        self,
        request_id: str,
        user_id: str,
        completion_method: str = 'manual',
        notes: Optional[str] = None,
        verification_source: Optional[str] = None,
        verified_by: Optional[str] = None,
        completed_at: Optional[datetime] = None,
        confidence_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Complete a request and track the completion

        Args:
            request_id: Request ID
            user_id: User completing the request
            completion_method: How it was completed
            notes: Optional completion notes
            verification_source: Source of verification
            verified_by: User or system that verified completion
            completed_at: Completion timestamp
            confidence_score: Confidence score for automatic completions

        Returns:
            Dict with completion record and updated request
        """
        try:
            # Get the request
            request = self.request_repo.get(request_id)
            if not request:
                raise ValueError(f"Request {request_id} not found")

            # Check if already completed
            if request.status == 'completed':
                logger.warning(f"Request {request_id} is already completed")
                return {
                    'success': False,
                    'message': 'Request is already completed',
                    'request': request
                }

            # Validate confidence score for automatic completions
            if completion_method in ['automatic', 'email_confirmation', 'external_api']:
                if confidence_score is None or confidence_score < 0.8:
                    raise ValueError(
                        f"Automatic completions require confidence score >= 0.8, got {confidence_score}"
                    )

            # Create completion record
            completion = self.completion_repo.track_completion(
                item_type='request',
                item_id=request_id,
                user_id=user_id,
                completion_method=completion_method,
                completion_notes=notes,
                verified_by=verified_by or user_id,
                verification_source=verification_source,
                completed_at=completed_at
            )

            # Update request status
            self.request_repo.update(
                request_id,
                status='completed',
                completed_at=completed_at or datetime.utcnow()
            )

            logger.info(f"Completed request {request_id} via {completion_method}")

            return {
                'success': True,
                'completion': completion,
                'request': self.request_repo.get(request_id),
                'confidence_score': confidence_score
            }

        except Exception as e:
            logger.error(f"Error completing request {request_id}: {e}")
            raise

    def batch_complete(
        self,
        items: List[Dict[str, str]],
        user_id: str,
        completion_method: str = 'manual',
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete multiple items at once

        Args:
            items: List of dicts with 'type' ('deadline' or 'request') and 'id'
            user_id: User completing the items
            completion_method: How they were completed
            notes: Optional batch completion notes

        Returns:
            Dict with results for each item
        """
        results = {
            'successful': [],
            'failed': [],
            'total': len(items),
            'timestamp': datetime.utcnow()
        }

        for item in items:
            try:
                if item['type'] == 'deadline':
                    result = self.complete_deadline(
                        deadline_id=item['id'],
                        user_id=user_id,
                        completion_method=completion_method,
                        notes=notes
                    )
                elif item['type'] == 'request':
                    result = self.complete_request(
                        request_id=item['id'],
                        user_id=user_id,
                        completion_method=completion_method,
                        notes=notes
                    )
                else:
                    raise ValueError(f"Invalid item type: {item['type']}")

                if result['success']:
                    results['successful'].append({
                        'type': item['type'],
                        'id': item['id']
                    })
                else:
                    results['failed'].append({
                        'type': item['type'],
                        'id': item['id'],
                        'reason': result.get('message', 'Unknown error')
                    })

            except Exception as e:
                logger.error(f"Error in batch completion for {item}: {e}")
                results['failed'].append({
                    'type': item['type'],
                    'id': item['id'],
                    'reason': str(e)
                })

        logger.info(
            f"Batch completion: {len(results['successful'])} successful, "
            f"{len(results['failed'])} failed"
        )

        return results

    def undo_completion(
        self,
        completion_id: str,
        user_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Undo a completion (mark item as incomplete again)

        Args:
            completion_id: Completion record ID
            user_id: User undoing the completion
            reason: Reason for undoing

        Returns:
            Dict with undo result
        """
        try:
            # Get the completion record
            completion = self.completion_repo.get(completion_id)
            if not completion:
                raise ValueError(f"Completion {completion_id} not found")

            # Store original completion data in notes
            undo_notes = (
                f"UNDO: Original completion by {completion.verified_by} at {completion.completed_at}. "
                f"Method: {completion.completion_method}. Reason for undo: {reason}"
            )

            # Update item status back to pending
            if completion.item_type == 'deadline':
                self.deadline_repo.update(
                    completion.item_id,
                    status='pending',
                    completed_at=None
                )
                item = self.deadline_repo.get(completion.item_id)

                # Recreate alerts if needed
                from alert_engine import AlertEngine
                alert_engine = AlertEngine(
                    deadline_repo=self.deadline_repo,
                    alert_repo=self.alert_repo
                )
                alert_engine.schedule_alerts_for_deadline(completion.item_id, user_id)

            elif completion.item_type == 'request':
                self.request_repo.update(
                    completion.item_id,
                    status='pending',
                    completed_at=None
                )
                item = self.request_repo.get(completion.item_id)

            # Delete the completion record (audit trail preserved in database logs)
            self.completion_repo.delete(completion_id)

            logger.info(f"Undid completion {completion_id}: {reason}")

            return {
                'success': True,
                'item_type': completion.item_type,
                'item_id': completion.item_id,
                'item': item,
                'undo_reason': reason,
                'original_completion': {
                    'completed_at': completion.completed_at,
                    'method': completion.completion_method,
                    'verified_by': completion.verified_by
                }
            }

        except Exception as e:
            logger.error(f"Error undoing completion {completion_id}: {e}")
            raise

    def get_completion_stats(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        item_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive completion statistics

        Args:
            user_id: User ID
            start_date: Start of date range (defaults to 30 days ago)
            end_date: End of date range (defaults to now)
            item_type: Optional filter by item type

        Returns:
            Dict with completion statistics and analytics
        """
        try:
            if start_date is None:
                start_date = datetime.utcnow() - timedelta(days=30)
            if end_date is None:
                end_date = datetime.utcnow()

            # Get completions in date range
            completions = self.completion_repo.get_by_date_range(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                item_type=item_type
            )

            # Calculate statistics
            total = len(completions)
            deadline_count = sum(1 for c in completions if c.item_type == 'deadline')
            request_count = sum(1 for c in completions if c.item_type == 'request')

            # Completion methods
            method_counts = {}
            for c in completions:
                method = c.completion_method or 'unknown'
                method_counts[method] = method_counts.get(method, 0) + 1

            # Verification sources
            source_counts = {}
            for c in completions:
                if c.verification_source:
                    source = c.verification_source.split(':')[0]  # Get source type
                    source_counts[source] = source_counts.get(source, 0) + 1

            # Calculate completion rate (deadlines only)
            if item_type != 'request':
                deadline_stats = self._calculate_deadline_stats(
                    user_id, start_date, end_date, completions
                )
            else:
                deadline_stats = {}

            # User activity patterns
            activity_patterns = self._analyze_activity_patterns(completions)

            return {
                'total_completions': total,
                'deadline_completions': deadline_count,
                'request_completions': request_count,
                'completions_by_method': method_counts,
                'completions_by_source': source_counts,
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat(),
                    'days': (end_date - start_date).days
                },
                'deadline_stats': deadline_stats,
                'activity_patterns': activity_patterns
            }

        except Exception as e:
            logger.error(f"Error getting completion stats: {e}")
            raise

    def _cancel_deadline_alerts(self, deadline_id: str) -> int:
        """
        Cancel all pending alerts for a deadline

        Args:
            deadline_id: Deadline ID

        Returns:
            Number of alerts cancelled
        """
        try:
            alerts = self.alert_repo.get_by_deadline(deadline_id)
            cancelled = 0

            for alert in alerts:
                if alert.status in ['scheduled', 'pending']:
                    self.alert_repo.update(alert.id, status='cancelled')
                    cancelled += 1

            return cancelled

        except Exception as e:
            logger.error(f"Error cancelling alerts for deadline {deadline_id}: {e}")
            return 0

    def _calculate_deadline_stats(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        completions: List
    ) -> Dict[str, Any]:
        """
        Calculate deadline-specific statistics

        Args:
            user_id: User ID
            start_date: Start date
            end_date: End date
            completions: List of completion records

        Returns:
            Dict with deadline statistics
        """
        try:
            # Get all deadlines in the period
            all_deadlines = self.deadline_repo.get_by_date_range(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date
            )

            total_deadlines = len(all_deadlines)
            completed_deadlines = [c for c in completions if c.item_type == 'deadline']

            # Calculate on-time vs late
            on_time = 0
            late = 0
            early = 0
            total_delay = timedelta(0)

            for completion in completed_deadlines:
                deadline = self.deadline_repo.get(completion.item_id)
                if deadline:
                    if completion.completed_at <= deadline.deadline_date:
                        on_time += 1
                        # Calculate how early
                        days_early = (deadline.deadline_date - completion.completed_at).days
                        if days_early > 0:
                            early += 1
                    else:
                        late += 1
                        delay = completion.completed_at - deadline.deadline_date
                        total_delay += delay

            avg_delay = total_delay / late if late > 0 else timedelta(0)

            return {
                'total_deadlines': total_deadlines,
                'completed_count': len(completed_deadlines),
                'completion_rate': len(completed_deadlines) / total_deadlines if total_deadlines > 0 else 0,
                'on_time_count': on_time,
                'late_count': late,
                'early_count': early,
                'on_time_rate': on_time / len(completed_deadlines) if completed_deadlines else 0,
                'average_delay_days': avg_delay.days if late > 0 else 0
            }

        except Exception as e:
            logger.error(f"Error calculating deadline stats: {e}")
            return {}

    def _analyze_activity_patterns(self, completions: List) -> Dict[str, Any]:
        """
        Analyze user activity patterns

        Args:
            completions: List of completion records

        Returns:
            Dict with activity pattern analysis
        """
        try:
            if not completions:
                return {}

            # Time of day distribution (0-23 hours)
            hour_counts = {}
            for c in completions:
                hour = c.completed_at.hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1

            # Day of week distribution (0=Monday, 6=Sunday)
            day_counts = {}
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            for c in completions:
                day = c.completed_at.weekday()
                day_name = day_names[day]
                day_counts[day_name] = day_counts.get(day_name, 0) + 1

            # Find most active time
            most_active_hour = max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else None
            most_active_day = max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None

            return {
                'completions_by_hour': hour_counts,
                'completions_by_day': day_counts,
                'most_active_hour': most_active_hour,
                'most_active_day': most_active_day,
                'weekend_completions': day_counts.get('Saturday', 0) + day_counts.get('Sunday', 0),
                'weekday_completions': sum(day_counts.get(d, 0) for d in day_names[:5])
            }

        except Exception as e:
            logger.error(f"Error analyzing activity patterns: {e}")
            return {}
