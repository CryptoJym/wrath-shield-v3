"""
Tests for Completion Tracker
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock, patch
from completion_tracker import CompletionTracker
from email_completion_detector import EmailCompletionDetector, CompletionDetection


class TestCompletionTracker:
    """Test suite for CompletionTracker"""

    @pytest.fixture
    def mock_repositories(self):
        """Create mock repositories"""
        return {
            'completion_repo': Mock(),
            'deadline_repo': Mock(),
            'request_repo': Mock(),
            'alert_repo': Mock()
        }

    @pytest.fixture
    def tracker(self, mock_repositories):
        """Create CompletionTracker instance"""
        return CompletionTracker(
            completion_repo=mock_repositories['completion_repo'],
            deadline_repo=mock_repositories['deadline_repo'],
            request_repo=mock_repositories['request_repo'],
            alert_repo=mock_repositories['alert_repo']
        )

    def test_complete_deadline_success(self, tracker, mock_repositories):
        """Test successful deadline completion"""
        # Setup
        deadline_id = 'deadline-123'
        user_id = 'user@example.com'
        mock_deadline = Mock()
        mock_deadline.id = deadline_id
        mock_deadline.status = 'pending'
        mock_deadline.deadline_date = datetime.utcnow() + timedelta(days=1)

        mock_repositories['deadline_repo'].get.return_value = mock_deadline
        mock_repositories['completion_repo'].track_completion.return_value = Mock(id='completion-123')
        mock_repositories['alert_repo'].get_by_deadline.return_value = [
            Mock(id='alert-1', status='scheduled'),
            Mock(id='alert-2', status='sent')
        ]

        # Execute
        result = tracker.complete_deadline(
            deadline_id=deadline_id,
            user_id=user_id,
            completion_method='manual',
            notes='Filed on time'
        )

        # Verify
        assert result['success'] is True
        assert result['alerts_cancelled'] == 1
        mock_repositories['completion_repo'].track_completion.assert_called_once()
        mock_repositories['deadline_repo'].update.assert_called_once()
        assert mock_repositories['alert_repo'].update.call_count == 1

    def test_complete_deadline_already_completed(self, tracker, mock_repositories):
        """Test completing already completed deadline"""
        # Setup
        deadline_id = 'deadline-123'
        mock_deadline = Mock()
        mock_deadline.id = deadline_id
        mock_deadline.status = 'completed'

        mock_repositories['deadline_repo'].get.return_value = mock_deadline

        # Execute
        result = tracker.complete_deadline(
            deadline_id=deadline_id,
            user_id='user@example.com'
        )

        # Verify
        assert result['success'] is False
        assert 'already completed' in result['message']
        mock_repositories['completion_repo'].track_completion.assert_not_called()

    def test_complete_deadline_automatic_low_confidence(self, tracker, mock_repositories):
        """Test automatic completion with low confidence fails"""
        # Setup
        deadline_id = 'deadline-123'
        mock_deadline = Mock()
        mock_deadline.status = 'pending'
        mock_repositories['deadline_repo'].get.return_value = mock_deadline

        # Execute & Verify
        with pytest.raises(ValueError, match='confidence score'):
            tracker.complete_deadline(
                deadline_id=deadline_id,
                user_id='user@example.com',
                completion_method='automatic',
                confidence_score=0.7
            )

    def test_complete_request_success(self, tracker, mock_repositories):
        """Test successful request completion"""
        # Setup
        request_id = 'request-123'
        user_id = 'user@example.com'
        mock_request = Mock()
        mock_request.id = request_id
        mock_request.status = 'pending'

        mock_repositories['request_repo'].get.return_value = mock_request
        mock_repositories['completion_repo'].track_completion.return_value = Mock(id='completion-456')

        # Execute
        result = tracker.complete_request(
            request_id=request_id,
            user_id=user_id,
            completion_method='manual',
            notes='Completed attorney request'
        )

        # Verify
        assert result['success'] is True
        mock_repositories['completion_repo'].track_completion.assert_called_once()
        mock_repositories['request_repo'].update.assert_called_once()

    def test_batch_complete_mixed_results(self, tracker, mock_repositories):
        """Test batch completion with some successes and failures"""
        # Setup
        items = [
            {'type': 'deadline', 'id': 'deadline-1'},
            {'type': 'request', 'id': 'request-1'},
            {'type': 'deadline', 'id': 'deadline-2'}
        ]

        # First deadline succeeds
        deadline1 = Mock(status='pending', deadline_date=datetime.utcnow())
        # Second deadline already completed
        deadline2 = Mock(status='completed')
        request1 = Mock(status='pending')

        mock_repositories['deadline_repo'].get.side_effect = [deadline1, deadline2]
        mock_repositories['request_repo'].get.return_value = request1
        mock_repositories['completion_repo'].track_completion.return_value = Mock()
        mock_repositories['alert_repo'].get_by_deadline.return_value = []

        # Execute
        result = tracker.batch_complete(
            items=items,
            user_id='user@example.com',
            completion_method='manual'
        )

        # Verify
        assert result['total'] == 3
        assert len(result['successful']) == 2
        assert len(result['failed']) == 1

    def test_undo_completion_deadline(self, tracker, mock_repositories):
        """Test undoing a deadline completion"""
        # Setup
        completion_id = 'completion-123'
        mock_completion = Mock()
        mock_completion.id = completion_id
        mock_completion.item_type = 'deadline'
        mock_completion.item_id = 'deadline-123'
        mock_completion.verified_by = 'user@example.com'
        mock_completion.completed_at = datetime.utcnow()
        mock_completion.completion_method = 'manual'

        mock_deadline = Mock(id='deadline-123', status='pending')

        mock_repositories['completion_repo'].get.return_value = mock_completion
        mock_repositories['deadline_repo'].get.return_value = mock_deadline

        # Execute
        with patch('completion_tracker.AlertEngine') as mock_alert_engine:
            result = tracker.undo_completion(
                completion_id=completion_id,
                user_id='admin@example.com',
                reason='Marked by mistake'
            )

        # Verify
        assert result['success'] is True
        assert result['item_type'] == 'deadline'
        mock_repositories['deadline_repo'].update.assert_called_once()
        mock_repositories['completion_repo'].delete.assert_called_once_with(completion_id)

    def test_get_completion_stats(self, tracker, mock_repositories):
        """Test completion statistics calculation"""
        # Setup
        user_id = 'user@example.com'
        now = datetime.utcnow()
        completions = [
            Mock(
                item_type='deadline',
                completion_method='manual',
                verification_source='user_confirmed',
                completed_at=now - timedelta(days=1)
            ),
            Mock(
                item_type='deadline',
                completion_method='automatic',
                verification_source='email:123',
                completed_at=now - timedelta(days=2)
            ),
            Mock(
                item_type='request',
                completion_method='manual',
                verification_source='user_confirmed',
                completed_at=now - timedelta(days=3)
            )
        ]

        mock_repositories['completion_repo'].get_by_date_range.return_value = completions
        mock_repositories['deadline_repo'].get_by_date_range.return_value = []

        # Execute
        stats = tracker.get_completion_stats(
            user_id=user_id,
            start_date=now - timedelta(days=7),
            end_date=now
        )

        # Verify
        assert stats['total_completions'] == 3
        assert stats['deadline_completions'] == 2
        assert stats['request_completions'] == 1
        assert 'manual' in stats['completions_by_method']
        assert stats['completions_by_method']['manual'] == 2

    def test_cancel_deadline_alerts(self, tracker, mock_repositories):
        """Test alert cancellation for completed deadline"""
        # Setup
        deadline_id = 'deadline-123'
        alerts = [
            Mock(id='alert-1', status='scheduled'),
            Mock(id='alert-2', status='pending'),
            Mock(id='alert-3', status='sent')
        ]

        mock_repositories['alert_repo'].get_by_deadline.return_value = alerts

        # Execute
        cancelled_count = tracker._cancel_deadline_alerts(deadline_id)

        # Verify
        assert cancelled_count == 2
        assert mock_repositories['alert_repo'].update.call_count == 2

    def test_calculate_deadline_stats(self, tracker, mock_repositories):
        """Test deadline-specific statistics"""
        # Setup
        user_id = 'user@example.com'
        now = datetime.utcnow()
        deadline_date = now + timedelta(days=1)

        completions = [
            Mock(
                item_type='deadline',
                item_id='deadline-1',
                completed_at=deadline_date - timedelta(hours=12)  # On time
            ),
            Mock(
                item_type='deadline',
                item_id='deadline-2',
                completed_at=deadline_date + timedelta(days=1)  # Late
            )
        ]

        deadlines = [
            Mock(id='deadline-1', deadline_date=deadline_date),
            Mock(id='deadline-2', deadline_date=deadline_date),
            Mock(id='deadline-3', deadline_date=deadline_date)  # Not completed
        ]

        mock_repositories['deadline_repo'].get_by_date_range.return_value = deadlines
        mock_repositories['deadline_repo'].get.side_effect = deadlines[:2]

        # Execute
        stats = tracker._calculate_deadline_stats(
            user_id=user_id,
            start_date=now - timedelta(days=7),
            end_date=now + timedelta(days=7),
            completions=completions
        )

        # Verify
        assert stats['total_deadlines'] == 3
        assert stats['completed_count'] == 2
        assert stats['on_time_count'] == 1
        assert stats['late_count'] == 1

    def test_analyze_activity_patterns(self, tracker):
        """Test activity pattern analysis"""
        # Setup
        completions = [
            Mock(completed_at=datetime(2024, 1, 1, 9, 0)),   # Monday, 9 AM
            Mock(completed_at=datetime(2024, 1, 1, 14, 0)),  # Monday, 2 PM
            Mock(completed_at=datetime(2024, 1, 2, 9, 0)),   # Tuesday, 9 AM
            Mock(completed_at=datetime(2024, 1, 6, 10, 0))   # Saturday, 10 AM
        ]

        # Execute
        patterns = tracker._analyze_activity_patterns(completions)

        # Verify
        assert patterns['most_active_hour'] == 9
        assert patterns['most_active_day'] == 'Monday'
        assert patterns['weekend_completions'] == 1
        assert patterns['weekday_completions'] == 3


class TestEmailCompletionDetector:
    """Test suite for EmailCompletionDetector"""

    @pytest.fixture
    def detector(self):
        """Create EmailCompletionDetector instance"""
        return EmailCompletionDetector()

    def test_detect_completion_high_confidence(self, detector):
        """Test detection with high confidence"""
        # Setup
        email_text = """
        Your motion has been successfully filed with the court.

        Case Number: CV-2024-12345
        Filing Date: 10/05/2024
        Confirmation Number: CONF-987654

        The court has confirmed receipt of your filing.
        """
        email_subject = "Court Filing Confirmation - Motion Filed"

        # Execute
        result = detector.detect_completion(
            email_text=email_text,
            email_subject=email_subject,
            email_id='email-123',
            sender='clerk@uscourts.gov'
        )

        # Verify
        assert result.detected is True
        assert result.confidence_score >= 0.8
        assert 'filed' in result.completion_keywords
        assert len(result.evidence) > 0
        assert 'case_number' in result.extracted_data

    def test_detect_completion_low_confidence(self, detector):
        """Test detection with low confidence (negative indicators)"""
        # Setup
        email_text = """
        Your filing is pending review.

        The document is incomplete and requires additional information.
        Please submit the missing materials.
        """
        email_subject = "Filing Status - Action Required"

        # Execute
        result = detector.detect_completion(
            email_text=email_text,
            email_subject=email_subject,
            email_id='email-456',
            sender='clerk@court.gov'
        )

        # Verify
        assert result.detected is False
        assert result.confidence_score < 0.8

    def test_extract_structured_data(self, detector):
        """Test extraction of structured data"""
        # Setup
        email_text = """
        Filing Details:
        Case #: CV-2024-12345
        Filed on: 10/05/2024
        Document Type: Motion to Dismiss
        """

        # Execute
        data = detector._extract_structured_data(email_text)

        # Verify
        assert 'case_number' in data
        assert data['case_number'] == 'CV-2024-12345'
        assert 'filing_date' in data
        assert 'document_type' in data

    def test_determine_item_type_deadline(self, detector):
        """Test determining item type as deadline"""
        # Setup
        email_text = "Your court filing deadline has been met."
        email_subject = "Filing Deadline Completed"

        # Execute
        item_type = detector._determine_item_type(email_text, email_subject)

        # Verify
        assert item_type == 'deadline'

    def test_determine_item_type_request(self, detector):
        """Test determining item type as request"""
        # Setup
        email_text = "The attorney request has been fulfilled."
        email_subject = "Client Request Completed"

        # Execute
        item_type = detector._determine_item_type(email_text, email_subject)

        # Verify
        assert item_type == 'request'

    def test_calculate_confidence_with_evidence(self, detector):
        """Test confidence calculation with evidence"""
        # Setup
        found_keywords = ['filed', 'completed', 'confirmed']
        negative_indicators = []
        evidence = ['Case: CV-2024-12345', 'Confirmation: CONF-123']
        extracted_data = {'case_number': 'CV-2024-12345', 'filing_date': '10/05/2024'}
        sender = 'clerk@uscourts.gov'

        # Execute
        score = detector._calculate_confidence(
            found_keywords=found_keywords,
            negative_indicators=negative_indicators,
            evidence=evidence,
            extracted_data=extracted_data,
            sender=sender
        )

        # Verify
        assert score >= 0.8
        assert score <= 1.0

    def test_calculate_confidence_with_negatives(self, detector):
        """Test confidence calculation with negative indicators"""
        # Setup
        found_keywords = ['submitted']
        negative_indicators = ['pending', 'incomplete', 'required']
        evidence = []
        extracted_data = {}
        sender = 'admin@example.com'

        # Execute
        score = detector._calculate_confidence(
            found_keywords=found_keywords,
            negative_indicators=negative_indicators,
            evidence=evidence,
            extracted_data=extracted_data,
            sender=sender
        )

        # Verify
        assert score < 0.5

    def test_match_to_items(self, detector):
        """Test matching detection to pending items"""
        # Setup
        detection = CompletionDetection(
            detected=True,
            confidence_score=0.9,
            item_type='deadline',
            item_id=None,
            evidence=['Case: CV-2024-12345'],
            completion_keywords=['filed', 'completed'],
            extracted_data={'case_number': 'CV-2024-12345'},
            verification_source='email:123'
        )

        pending_deadlines = [
            Mock(
                id='deadline-1',
                case_number='CV-2024-12345',
                action_required='File motion'
            ),
            Mock(
                id='deadline-2',
                case_number='CV-2024-99999',
                action_required='Submit brief'
            )
        ]

        pending_requests = []

        # Execute
        matches = detector.match_to_items(
            detection=detection,
            pending_deadlines=pending_deadlines,
            pending_requests=pending_requests
        )

        # Verify
        assert len(matches) > 0
        assert matches[0][0] == 'deadline'
        assert matches[0][1] == 'deadline-1'
        assert matches[0][2] > 0.5

    def test_is_trusted_sender(self, detector):
        """Test trusted sender detection"""
        # Test trusted senders
        assert detector._is_trusted_sender('clerk@uscourts.gov') is True
        assert detector._is_trusted_sender('admin@courts.state.ny.us') is True
        assert detector._is_trusted_sender('support@mycase.com') is True

        # Test untrusted senders
        assert detector._is_trusted_sender('user@gmail.com') is False
        assert detector._is_trusted_sender('admin@example.com') is False


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
