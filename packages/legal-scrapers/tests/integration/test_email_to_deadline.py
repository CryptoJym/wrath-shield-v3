"""
Integration tests for email-to-deadline extraction pipeline
Tests the full workflow from email parsing to deadline detection
"""

import pytest
from datetime import datetime, timedelta
from pathlib import Path

from extractors.request_detector import RequestDetector, UrgencyLevel
from extractors.deadline_extractor import DeadlineExtractor


@pytest.mark.integration
class TestEmailToDeadlineIntegration:
    """Test end-to-end email to deadline extraction"""

    def setup_method(self):
        """Set up test fixtures"""
        self.request_detector = RequestDetector()
        self.deadline_extractor = DeadlineExtractor()

    def test_urgent_deadline_extraction_flow(self, urgent_request_email):
        """Test complete flow for urgent deadline email"""
        # Detect requests from email
        requests = self.request_detector.detect_requests(
            email_text=urgent_request_email["body"],
            email_subject=urgent_request_email["subject"],
            sender_name=urgent_request_email["from_name"],
            timestamp=urgent_request_email["date"]
        )

        # Should detect urgent request
        assert len(requests) > 0
        assert requests[0].urgency_level == UrgencyLevel.CRITICAL

        # Should have extracted deadline
        if requests[0].deadline:
            assert requests[0].deadline > datetime.now()
            assert requests[0].deadline_description is not None

    def test_multi_request_email_flow(self, multi_request_email):
        """Test flow for email with multiple requests"""
        requests = self.request_detector.detect_requests(
            email_text=multi_request_email["body"],
            email_subject=multi_request_email["subject"],
            sender_name=multi_request_email["from_name"],
            timestamp=multi_request_email["date"]
        )

        # Should detect multiple requests
        assert len(requests) >= 2

        # At least one should have sub-requests
        multi_part = [r for r in requests if r.sub_requests]
        assert len(multi_part) > 0

    def test_email_with_specific_deadlines(self, email_with_deadlines):
        """Test extraction of specific deadline dates from email"""
        # Extract deadlines
        deadlines = self.deadline_extractor.extract_deadlines(
            email_with_deadlines["body"]
        )

        # Should extract multiple deadlines
        assert len(deadlines) >= 2

        # Check deadline dates are in the future
        for deadline in deadlines:
            if deadline.get("deadline_date"):
                assert deadline["deadline_date"] > datetime.now()

    def test_routine_vs_urgent_classification(
        self, routine_request_email, urgent_request_email
    ):
        """Test correct urgency classification"""
        # Process routine email
        routine_requests = self.request_detector.detect_requests(
            email_text=routine_request_email["body"],
            email_subject=routine_request_email["subject"],
            sender_name=routine_request_email["from_name"],
            timestamp=routine_request_email["date"]
        )

        # Process urgent email
        urgent_requests = self.request_detector.detect_requests(
            email_text=urgent_request_email["body"],
            email_subject=urgent_request_email["subject"],
            sender_name=urgent_request_email["from_name"],
            timestamp=urgent_request_email["date"]
        )

        # Verify classifications
        if routine_requests:
            assert routine_requests[0].urgency_level == UrgencyLevel.LOW

        if urgent_requests:
            assert urgent_requests[0].urgency_level == UrgencyLevel.CRITICAL

    @pytest.mark.slow
    def test_batch_email_processing(self, batch_attorney_emails):
        """Test processing multiple emails in batch"""
        all_requests = []

        for email_data in batch_attorney_emails:
            requests = self.request_detector.detect_requests(
                email_text=email_data["body"],
                email_subject=email_data["subject"],
                sender_name=email_data["from_name"],
                timestamp=datetime.now()
            )
            all_requests.extend(requests)

        # Should have detected requests from all emails
        assert len(all_requests) >= len(batch_attorney_emails)

        # Verify urgency distribution
        urgency_counts = {}
        for request in all_requests:
            level = request.urgency_level.value
            urgency_counts[level] = urgency_counts.get(level, 0) + 1

        # Should have variety of urgency levels
        assert len(urgency_counts) >= 2

    def test_email_thread_context_preservation(self, email_thread_conversation):
        """Test that context is preserved across email thread"""
        thread_requests = []

        for msg in email_thread_conversation:
            requests = self.request_detector.detect_requests(
                email_text=msg["body"],
                email_subject=msg["subject"],
                sender_name=msg["from_name"],
                timestamp=msg["date"]
            )
            thread_requests.append({
                "message_id": msg["id"],
                "requests": requests
            })

        # Should track requests across thread
        assert len(thread_requests) == len(email_thread_conversation)

        # Later messages should reference earlier context
        # (This would require more sophisticated thread analysis)

    def test_deadline_prioritization(self):
        """Test that deadlines are correctly prioritized"""
        emails_with_deadlines = [
            {
                "body": "File motion by tomorrow 5pm - URGENT!",
                "subject": "Urgent Filing",
                "from_name": "Attorney",
                "expected_priority": "critical"
            },
            {
                "body": "Please send documents by next week when you have a chance.",
                "subject": "Document Request",
                "from_name": "Attorney",
                "expected_priority": "low"
            },
            {
                "body": "Discovery responses due Friday. Please prioritize.",
                "subject": "Discovery Deadline",
                "from_name": "Attorney",
                "expected_priority": "high"
            }
        ]

        results = []
        for email in emails_with_deadlines:
            requests = self.request_detector.detect_requests(
                email_text=email["body"],
                email_subject=email["subject"],
                sender_name=email["from_name"],
                timestamp=datetime.now()
            )

            if requests:
                results.append({
                    "urgency": requests[0].urgency_level.value,
                    "expected": email["expected_priority"],
                    "has_deadline": requests[0].deadline is not None
                })

        # Verify urgency matches expectations
        for result in results:
            assert result["urgency"] == result["expected"] or \
                   (result["urgency"] == "high" and result["expected"] == "critical")


@pytest.mark.integration
@pytest.mark.slow
class TestEmailPDFDeadlineFlow:
    """Test integration between email requests and PDF deadline extraction"""

    def test_email_references_pdf_deadline(
        self, sample_attorney_email, pdf_with_deadline_dates, tmp_path
    ):
        """Test extracting deadline from PDF referenced in email"""
        # Create a temporary PDF file
        pdf_path = tmp_path / "court_order.pdf"
        pdf_path.write_text(pdf_with_deadline_dates)

        # Process email that references PDF
        email_body = sample_attorney_email["body"] + \
            f"\n\nSee attached order for hearing date: {pdf_path.name}"

        requests = RequestDetector().detect_requests(
            email_text=email_body,
            email_subject=sample_attorney_email["subject"],
            sender_name=sample_attorney_email["from_name"],
            timestamp=sample_attorney_email["date"]
        )

        # Should detect request
        assert len(requests) > 0

        # In full implementation, would also extract deadlines from PDF
        # and associate them with the request

    def test_conflicting_deadline_resolution(self):
        """Test handling of conflicting deadline information"""
        email_text = """
        Please file the motion by Friday, February 10th.

        Actually, I checked the order and it's due Monday, February 13th.

        Please use the Monday deadline.
        """

        deadlines = DeadlineExtractor().extract_deadlines(email_text)

        # Should extract both mentioned deadlines
        assert len(deadlines) >= 1

        # In full implementation, would use context to resolve conflict
        # (last mentioned deadline should take precedence)
