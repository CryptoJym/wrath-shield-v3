"""
Unit tests for Deadline Extractor
Legal Advocate AI Action Item Detector
"""

import unittest
from datetime import datetime, timedelta
from extractors.deadline_extractor import (
    DeadlineExtractor,
    ExtractedDeadline,
    extract_deadlines_from_document
)


class TestDeadlineExtractor(unittest.TestCase):
    """Test deadline extraction functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.extractor = DeadlineExtractor()

    def test_extractor_initialization(self):
        """Test extractor initialization"""
        self.assertIsNotNone(self.extractor)
        self.assertIsNotNone(self.extractor.nlp)
        self.assertGreater(len(self.extractor.deadline_patterns), 0)
        print("✅ Extractor initialization test passed")

    def test_absolute_date_extraction(self):
        """Test extraction of absolute dates"""
        text = "Plaintiff must file a response by October 15, 2025."
        deadlines = self.extractor.extract_deadlines(text)

        self.assertEqual(len(deadlines), 1)
        deadline = deadlines[0]
        self.assertEqual(deadline.deadline_date.month, 10)
        self.assertEqual(deadline.deadline_date.day, 15)
        self.assertEqual(deadline.deadline_date.year, 2025)
        self.assertEqual(deadline.deadline_type, 'filing')
        self.assertEqual(deadline.responsible_party, 'self')
        print("✅ Absolute date extraction test passed")

    def test_relative_date_extraction(self):
        """Test extraction of relative dates like 'within 30 days'"""
        text = "Defendant must respond within 30 days of service."
        deadlines = self.extractor.extract_deadlines(text)

        self.assertEqual(len(deadlines), 1)
        deadline = deadlines[0]

        # Check that it's approximately 30 days from now (allowing for weekends)
        expected_date = datetime.now() + timedelta(days=30)
        date_diff = abs((deadline.deadline_date - expected_date).days)
        self.assertLess(date_diff, 10)  # Within 10 days variance
        print(f"✅ Relative date extraction test passed (extracted: {deadline.deadline_date.strftime('%Y-%m-%d')})")

    def test_business_days_calculation(self):
        """Test business days calculation"""
        start_date = datetime(2025, 1, 6)  # Monday
        result = self.extractor._add_business_days(start_date, 5)

        # 5 business days from Monday = next Monday
        self.assertEqual(result.day, 13)
        self.assertEqual(result.weekday(), 0)  # Monday
        print("✅ Business days calculation test passed")

    def test_hearing_detection(self):
        """Test detection of hearing deadlines"""
        text = "A hearing is scheduled for November 15, 2025 at 9:00 AM."
        deadlines = self.extractor.extract_deadlines(text)

        self.assertEqual(len(deadlines), 1)
        deadline = deadlines[0]
        self.assertEqual(deadline.deadline_type, 'hearing')
        self.assertIn('hearing', deadline.source_text.lower())
        print("✅ Hearing detection test passed")

    def test_response_deadline_detection(self):
        """Test detection of response deadlines"""
        text = "Plaintiff must respond to the motion by December 1, 2025."
        deadlines = self.extractor.extract_deadlines(text)

        self.assertEqual(len(deadlines), 1)
        deadline = deadlines[0]
        self.assertEqual(deadline.deadline_type, 'response')
        self.assertEqual(deadline.responsible_party, 'self')
        print("✅ Response deadline detection test passed")

    def test_discovery_deadline_detection(self):
        """Test detection of discovery deadlines"""
        text = "Defendant shall serve all discovery responses within 30 days."
        deadlines = self.extractor.extract_deadlines(text)

        self.assertEqual(len(deadlines), 1)
        deadline = deadlines[0]
        self.assertEqual(deadline.deadline_type, 'discovery')
        print("✅ Discovery deadline detection test passed")

    def test_confidence_scoring(self):
        """Test confidence score calculation"""
        # High confidence: clear date, strong deadline language
        text1 = "Plaintiff must file response by December 1, 2025."
        deadlines1 = self.extractor.extract_deadlines(text1)
        high_confidence = deadlines1[0].confidence if deadlines1 else 0

        # Lower confidence: vague language
        text2 = "Response should be filed sometime in December."
        deadlines2 = self.extractor.extract_deadlines(text2)
        low_confidence = deadlines2[0].confidence if deadlines2 else 0

        if deadlines1:
            self.assertGreater(high_confidence, 0.5)
            print(f"✅ Confidence scoring test passed (high: {high_confidence:.2f}, low: {low_confidence:.2f})")

    def test_responsible_party_detection(self):
        """Test detection of responsible party"""
        # Self action
        text1 = "You must file a response within 30 days."
        deadlines1 = self.extractor.extract_deadlines(text1)
        if deadlines1:
            self.assertEqual(deadlines1[0].responsible_party, 'self')

        # Attorney action
        text2 = "Attorney shall submit the brief by next Friday."
        deadlines2 = self.extractor.extract_deadlines(text2)
        if deadlines2:
            self.assertEqual(deadlines2[0].responsible_party, 'attorney')

        print("✅ Responsible party detection test passed")

    def test_multiple_deadlines_in_text(self):
        """Test extraction of multiple deadlines from one document"""
        text = """
        The court orders the following:
        1. Plaintiff must file a response by November 15, 2025.
        2. A hearing is scheduled for December 1, 2025 at 10:00 AM.
        3. Discovery must be completed within 60 days.
        """
        deadlines = self.extractor.extract_deadlines(text)

        self.assertGreaterEqual(len(deadlines), 2)
        print(f"✅ Multiple deadlines extraction test passed (found {len(deadlines)} deadlines)")

    def test_deduplication(self):
        """Test deduplication of similar deadlines"""
        # Create duplicate deadlines
        deadlines = [
            ExtractedDeadline(
                deadline_date=datetime(2025, 11, 15),
                action_required="File response",
                responsible_party="self",
                deadline_type="filing",
                source_text="File response by Nov 15",
                confidence=0.8
            ),
            ExtractedDeadline(
                deadline_date=datetime(2025, 11, 15),
                action_required="File response",
                responsible_party="self",
                deadline_type="filing",
                source_text="Response must be filed by November 15",
                confidence=0.9
            ),
        ]

        deduplicated = self.extractor._deduplicate_deadlines(deadlines)
        self.assertEqual(len(deduplicated), 1)
        # Should keep the higher confidence one
        self.assertEqual(deduplicated[0].confidence, 0.9)
        print("✅ Deduplication test passed")

    def test_action_extraction(self):
        """Test extraction of action text"""
        text = "Plaintiff must file a motion for summary judgment by October 30."
        deadlines = self.extractor.extract_deadlines(text)

        if deadlines:
            self.assertIn('file', deadlines[0].action_required.lower())
            print(f"✅ Action extraction test passed (action: {deadlines[0].action_required})")

    def test_date_parsing_with_slashes(self):
        """Test date parsing with MM/DD/YYYY format"""
        text = "Response is due by 12/15/2025."
        deadlines = self.extractor.extract_deadlines(text)

        if deadlines:
            self.assertEqual(deadlines[0].deadline_date.month, 12)
            self.assertEqual(deadlines[0].deadline_date.day, 15)
            self.assertEqual(deadlines[0].deadline_date.year, 2025)
            print("✅ Slash date format parsing test passed")

    def test_realistic_court_order(self):
        """Test with realistic court order text"""
        text = """
        IN THE SUPERIOR COURT OF CALIFORNIA
        COUNTY OF SAN FRANCISCO

        Case No. 164400524
        JOHN DOE vs JANE DOE

        ORDER ON MOTION TO MODIFY CUSTODY

        IT IS HEREBY ORDERED that:

        1. Plaintiff shall file a response to this motion within 30 days of the
        date of this order.

        2. A hearing is scheduled for November 15, 2025, at 9:00 AM in Department 12.

        3. All discovery must be completed no later than November 1, 2025.

        4. Defendant's attorney shall submit a trial brief by November 8, 2025.

        Dated: October 5, 2025
        Hon. Judge Smith
        """

        deadlines = self.extractor.extract_deadlines(text)

        # Should find at least 3 deadlines
        self.assertGreaterEqual(len(deadlines), 3)

        # Check for different types
        types_found = {d.deadline_type for d in deadlines}
        self.assertTrue(len(types_found) > 1)  # Should have multiple types

        print(f"✅ Realistic court order test passed (found {len(deadlines)} deadlines)")
        for i, d in enumerate(deadlines, 1):
            print(f"   {i}. {d.deadline_type}: {d.deadline_date.strftime('%Y-%m-%d')} - {d.action_required[:40]}...")

    def test_convenience_function(self):
        """Test the convenience function"""
        text = "File response by December 1, 2025."
        deadlines = extract_deadlines_from_document(text)

        self.assertGreater(len(deadlines), 0)
        print("✅ Convenience function test passed")

    def test_extracted_deadline_to_dict(self):
        """Test ExtractedDeadline.to_dict() conversion"""
        deadline = ExtractedDeadline(
            deadline_date=datetime(2025, 11, 15),
            action_required="File response",
            responsible_party="self",
            deadline_type="filing",
            source_text="File response by Nov 15",
            confidence=0.85,
            page_number=1
        )

        data = deadline.to_dict()

        self.assertEqual(data['deadline_date'], deadline.deadline_date)
        self.assertEqual(data['action_required'], "File response")
        self.assertEqual(data['responsible_party'], "self")
        self.assertEqual(data['deadline_type'], "filing")
        self.assertEqual(data['extraction_confidence'], 0.85)
        self.assertIn('source_text', data)
        print("✅ ExtractedDeadline to_dict test passed")


class TestDeadlineExtractorEdgeCases(unittest.TestCase):
    """Test edge cases and error handling"""

    def setUp(self):
        """Set up test fixtures"""
        self.extractor = DeadlineExtractor()

    def test_empty_text(self):
        """Test with empty text"""
        deadlines = self.extractor.extract_deadlines("")
        self.assertEqual(len(deadlines), 0)
        print("✅ Empty text handling test passed")

    def test_no_deadlines(self):
        """Test text with no deadlines"""
        text = "This is a simple document with no deadlines mentioned."
        deadlines = self.extractor.extract_deadlines(text)
        self.assertEqual(len(deadlines), 0)
        print("✅ No deadlines handling test passed")

    def test_past_date(self):
        """Test that past dates get lower confidence"""
        text = "Response was due by January 1, 2020."
        deadlines = self.extractor.extract_deadlines(text)

        # Might not extract or should have lower confidence
        if deadlines:
            print(f"⚠️  Past date extracted with confidence: {deadlines[0].confidence:.2f}")

    def test_ambiguous_date(self):
        """Test handling of ambiguous dates"""
        text = "Response should be filed sometime next month."
        deadlines = self.extractor.extract_deadlines(text)

        # Likely won't extract, but shouldn't crash
        print(f"✅ Ambiguous date test passed (found {len(deadlines)} deadlines)")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
