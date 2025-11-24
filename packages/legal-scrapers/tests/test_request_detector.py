"""
Unit tests for Attorney Request Detection Module
Legal Advocate AI NLP-based request extraction
"""

import unittest
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from extractors.request_detector import (
    RequestDetector,
    DetectedRequest,
    RequestType,
    UrgencyLevel,
    detect_requests_from_email
)


class TestRequestDetector(unittest.TestCase):
    """Test RequestDetector class"""

    def setUp(self):
        """Set up test fixtures"""
        self.detector = RequestDetector()

    def test_detector_initialization(self):
        """Test detector initializes properly"""
        self.assertIsNotNone(self.detector)
        self.assertIsNotNone(self.detector.deadline_extractor)
        print("✅ Detector initialization test passed")

    def test_simple_request_detection(self):
        """Test detection of simple request"""
        email_text = "Please send me the case files."

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Case Files Needed",
            sender_name="Attorney Smith",
            timestamp=datetime.now()
        )

        self.assertGreater(len(requests), 0)
        self.assertIn("case files", requests[0].what_is_needed.lower())
        self.assertEqual(requests[0].request_type, RequestType.DOCUMENT_REQUEST)
        print("✅ Simple request detection test passed")

    def test_imperative_verb_detection(self):
        """Test detection of imperative verb requests"""
        test_cases = [
            "Send the discovery documents to opposing counsel.",
            "Forward the email thread to the client.",
            "Submit the motion by end of day.",
            "Review the contract and provide feedback."
        ]

        for text in test_cases:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0, f"Failed to detect: {text}")

        print("✅ Imperative verb detection test passed")

    def test_request_phrase_patterns(self):
        """Test various request phrase patterns"""
        test_cases = [
            ("Can you send me the brief?", "brief"),
            ("Could you please forward the files?", "files"),
            ("I need you to prepare the motion.", "motion"),
            ("Would like you to review the contract.", "contract"),
            ("Please provide status update.", "status update")
        ]

        for text, expected_keyword in test_cases:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertIn(expected_keyword.lower(), requests[0].what_is_needed.lower())

        print("✅ Request phrase patterns test passed")

    def test_false_positive_filtering(self):
        """Test that questions are filtered out as false positives"""
        false_positive_texts = [
            "How do I file this motion?",
            "What is the deadline for discovery?",
            "Why did the judge deny our request?",
            "When does the hearing start?",
            "Just checking if you received my email."
        ]

        for text in false_positive_texts:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Question",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            # Should filter these out or have very low confidence
            if requests:
                self.assertLess(requests[0].confidence_score, 0.5)

        print("✅ False positive filtering test passed")

    def test_request_type_classification(self):
        """Test classification of different request types"""
        test_cases = [
            ("Send me the contract documents.", RequestType.DOCUMENT_REQUEST),
            ("File the motion with the court.", RequestType.FILING_REQUEST),
            ("Schedule a meeting with the client.", RequestType.MEETING_REQUEST),
            ("Research case law on this issue.", RequestType.RESEARCH_REQUEST),
            ("Email the opposing counsel about settlement.", RequestType.CORRESPONDENCE_REQUEST),
            ("Provide status update on the case.", RequestType.INFORMATION_REQUEST),
        ]

        for text, expected_type in test_cases:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertEqual(requests[0].request_type, expected_type)

        print("✅ Request type classification test passed")

    def test_urgency_detection_critical(self):
        """Test detection of critical urgency"""
        critical_texts = [
            "Send the brief ASAP!",
            "Urgent: need the files immediately",
            "This is critical - file the motion right away",
            "Emergency motion needed"
        ]

        for text in critical_texts:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Urgent Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertEqual(requests[0].urgency_level, UrgencyLevel.CRITICAL)

        print("✅ Critical urgency detection test passed")

    def test_urgency_detection_high(self):
        """Test detection of high urgency"""
        high_texts = [
            "Please send the documents soon.",
            "Need this by end of day.",
            "Send the files today if possible.",
            "Quickly forward the email thread."
        ]

        for text in high_texts:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertIn(requests[0].urgency_level, [UrgencyLevel.HIGH, UrgencyLevel.CRITICAL])

        print("✅ High urgency detection test passed")

    def test_urgency_detection_low(self):
        """Test detection of low urgency"""
        low_texts = [
            "Send the files when you have a chance.",
            "Please provide the documents at your convenience.",
            "Forward the email when possible."
        ]

        for text in low_texts:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertEqual(requests[0].urgency_level, UrgencyLevel.LOW)

        print("✅ Low urgency detection test passed")

    def test_deadline_extraction_integration(self):
        """Test integration with deadline extractor"""
        email_text = "Please send the case files by Friday, January 31st."

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Case Files Request",
            sender_name="Attorney Jones",
            timestamp=datetime.now()
        )

        self.assertGreater(len(requests), 0)
        # Should detect a deadline
        if requests[0].deadline:
            self.assertIsNotNone(requests[0].deadline_description)

        print("✅ Deadline extraction integration test passed")

    def test_multi_part_request_detection(self):
        """Test detection of multi-part requests (bullet lists)"""
        email_text = """
        Please send me the following documents:
        - Motion to dismiss
        - Supporting brief
        - Exhibits A-D
        - Client affidavit
        """

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Documents Needed",
            sender_name="Attorney Brown",
            timestamp=datetime.now()
        )

        # Should detect a multi-part request
        multi_part = [r for r in requests if r.sub_requests]
        self.assertGreater(len(multi_part), 0)
        self.assertGreater(len(multi_part[0].sub_requests), 2)

        print("✅ Multi-part request detection test passed")

    def test_numbered_list_detection(self):
        """Test detection of numbered list requests"""
        email_text = """
        I need you to:
        1. File the motion
        2. Send copies to opposing counsel
        3. Update the client on status
        """

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Action Items",
            sender_name="Attorney White",
            timestamp=datetime.now()
        )

        multi_part = [r for r in requests if r.sub_requests]
        self.assertGreater(len(multi_part), 0)
        self.assertEqual(len(multi_part[0].sub_requests), 3)

        print("✅ Numbered list detection test passed")

    def test_confidence_scoring(self):
        """Test confidence score calculation"""
        # High confidence request
        high_conf_text = "Please send me the contract documents by Friday."

        # Low confidence (vague)
        low_conf_text = "Send it."

        high_requests = self.detector.detect_requests(
            email_text=high_conf_text,
            email_subject="Request",
            sender_name="Attorney",
            timestamp=datetime.now()
        )

        low_requests = self.detector.detect_requests(
            email_text=low_conf_text,
            email_subject="Request",
            sender_name="Attorney",
            timestamp=datetime.now()
        )

        if high_requests:
            self.assertGreater(high_requests[0].confidence_score, 0.6)

        if low_requests:
            self.assertLess(low_requests[0].confidence_score, 0.5)

        print("✅ Confidence scoring test passed")

    def test_what_is_needed_extraction(self):
        """Test extraction of what is being requested"""
        test_cases = [
            ("Please send the discovery documents.", "discovery documents"),
            ("I need the client file.", "client file"),
            ("Forward the email chain to me.", "email chain"),
            ("Provide status update on the case.", "status update")
        ]

        for text, expected in test_cases:
            requests = self.detector.detect_requests(
                email_text=text,
                email_subject="Request",
                sender_name="Attorney",
                timestamp=datetime.now()
            )
            self.assertGreater(len(requests), 0)
            self.assertIn(expected.lower(), requests[0].what_is_needed.lower())

        print("✅ What is needed extraction test passed")

    def test_email_signature_removal(self):
        """Test that email signatures don't interfere with detection"""
        email_text = """
        Please send the case files by Friday.

        Best regards,
        Jane Attorney
        Smith & Associates
        555-1234
        jane@smithlaw.com
        """

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Files Needed",
            sender_name="Jane Attorney",
            timestamp=datetime.now()
        )

        self.assertGreater(len(requests), 0)
        # Should still detect the request despite signature
        self.assertIn("case files", requests[0].what_is_needed.lower())

        print("✅ Email signature removal test passed")

    def test_multiple_requests_in_one_email(self):
        """Test detection of multiple separate requests in one email"""
        email_text = """
        Please send me the contract. Also, can you file the motion by tomorrow?
        Additionally, forward the client's email to me.
        """

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Multiple Requests",
            sender_name="Attorney",
            timestamp=datetime.now()
        )

        # Should detect multiple requests
        self.assertGreaterEqual(len(requests), 2)

        print("✅ Multiple requests detection test passed")

    def test_detected_request_to_dict(self):
        """Test conversion of DetectedRequest to dictionary"""
        request = DetectedRequest(
            what_is_needed="case files",
            requested_by="Attorney Smith",
            requested_date=datetime(2025, 1, 31, 10, 0),
            urgency_level=UrgencyLevel.HIGH,
            request_type=RequestType.DOCUMENT_REQUEST,
            original_text="Please send case files.",
            email_subject="Files Needed",
            deadline=datetime(2025, 2, 5),
            deadline_description="by next Friday",
            confidence_score=0.85,
            sub_requests=["item1", "item2"]
        )

        data = request.to_dict()

        self.assertEqual(data['what_is_needed'], "case files")
        self.assertEqual(data['urgency_level'], "high")
        self.assertEqual(data['request_type'], "document_request")
        self.assertEqual(data['confidence_score'], 0.85)
        self.assertEqual(len(data['sub_requests']), 2)

        print("✅ DetectedRequest to_dict test passed")

    def test_convenience_function(self):
        """Test convenience function detect_requests_from_email"""
        email_text = "Please send the case files ASAP."

        results = detect_requests_from_email(
            email_text=email_text,
            email_subject="Urgent Request",
            sender_name="Attorney Green",
            timestamp=datetime.now()
        )

        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        self.assertIsInstance(results[0], dict)
        self.assertIn('what_is_needed', results[0])
        self.assertIn('urgency_level', results[0])

        print("✅ Convenience function test passed")

    def test_complex_real_world_email(self):
        """Test with realistic attorney email"""
        email_text = """
        Hi Team,

        I need you to prepare the following for the Johnson case hearing on Monday:

        1. Motion to compel discovery
        2. Supporting memorandum
        3. Exhibits showing communication timeline
        4. Client declaration

        Please have these ready by Friday EOD. This is urgent as the hearing is Monday morning.

        Also, can you send me the deposition transcript from last week?

        Thanks,
        Sarah
        """

        requests = self.detector.detect_requests(
            email_text=email_text,
            email_subject="Johnson Case - Hearing Prep",
            sender_name="Sarah Attorney",
            timestamp=datetime.now()
        )

        # Should detect requests (multi-part + separate deposition request)
        self.assertGreater(len(requests), 0)

        # Should detect high/critical urgency
        urgency_levels = [r.urgency_level for r in requests]
        self.assertTrue(any(u in [UrgencyLevel.CRITICAL, UrgencyLevel.HIGH] for u in urgency_levels))

        # Should detect multi-part request
        multi_part = [r for r in requests if r.sub_requests]
        if multi_part:
            self.assertGreater(len(multi_part[0].sub_requests), 2)

        print("✅ Complex real-world email test passed")


class TestRequestTypeEnum(unittest.TestCase):
    """Test RequestType enumeration"""

    def test_request_type_values(self):
        """Test request type enum values"""
        self.assertEqual(RequestType.DOCUMENT_REQUEST.value, "document_request")
        self.assertEqual(RequestType.FILING_REQUEST.value, "filing_request")
        self.assertEqual(RequestType.MEETING_REQUEST.value, "meeting_request")
        print("✅ RequestType enum test passed")


class TestUrgencyLevelEnum(unittest.TestCase):
    """Test UrgencyLevel enumeration"""

    def test_urgency_level_values(self):
        """Test urgency level enum values"""
        self.assertEqual(UrgencyLevel.CRITICAL.value, "critical")
        self.assertEqual(UrgencyLevel.HIGH.value, "high")
        self.assertEqual(UrgencyLevel.MEDIUM.value, "medium")
        self.assertEqual(UrgencyLevel.LOW.value, "low")
        print("✅ UrgencyLevel enum test passed")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
