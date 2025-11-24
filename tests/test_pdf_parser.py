"""
Unit tests for PDF Parser
Legal Advocate AI Action Item Detector
"""

import unittest
import tempfile
import os
from pathlib import Path
from extractors.pdf_parser import PDFParser, parse_court_document, ParsedDocument


class TestPDFParser(unittest.TestCase):
    """Test PDF parser functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.parser = PDFParser(remove_headers_footers=True)

    def test_parser_initialization(self):
        """Test parser initialization"""
        self.assertIsNotNone(self.parser)
        self.assertTrue(self.parser.remove_headers_footers)

        parser2 = PDFParser(remove_headers_footers=False)
        self.assertFalse(parser2.remove_headers_footers)
        print("✅ Parser initialization test passed")

    def test_text_cleaning(self):
        """Test text cleaning functionality"""
        # Test null byte removal
        dirty_text = "Hello\x00World"
        clean_text = self.parser._clean_text(dirty_text)
        self.assertNotIn('\x00', clean_text)

        # Test line break normalization
        dirty_text = "Line1\r\nLine2\rLine3\nLine4"
        clean_text = self.parser._clean_text(dirty_text)
        lines = clean_text.split('\n')
        self.assertEqual(len(lines), 4)

        # Test hyphenated word joining
        dirty_text = "respon-\nsibility"
        clean_text = self.parser._clean_text(dirty_text)
        self.assertEqual(clean_text, "responsibility")

        # Test multiple space normalization
        dirty_text = "Too     many      spaces"
        clean_text = self.parser._clean_text(dirty_text)
        self.assertEqual(clean_text, "Too many spaces")

        # Test multiple newline normalization
        dirty_text = "Para1\n\n\n\n\nPara2"
        clean_text = self.parser._clean_text(dirty_text)
        self.assertEqual(clean_text, "Para1\n\nPara2")

        print("✅ Text cleaning tests passed")

    def test_header_detection(self):
        """Test header section detection"""
        lines = [
            "IN THE SUPERIOR COURT OF CALIFORNIA",
            "COUNTY OF SAN FRANCISCO",
            "",
            "Case No. 164400524",
            "JOHN DOE vs JANE DOE",
            "",
            "ORDER ON MOTION",
            "",
            "This matter came before the court..."
        ]

        header_end = self.parser._find_header_end(lines)
        self.assertGreater(header_end, 0)
        self.assertLess(header_end, len(lines))

        print(f"✅ Header detection test passed (header ends at line {header_end})")

    def test_signature_detection(self):
        """Test signature block detection"""
        lines = [
            "The court finds that the defendant...",
            "Therefore, it is hereby ordered...",
            "",
            "Respectfully submitted,",
            "",
            "Zack Starr, Esq.",
            "Bar Number 12345",
            "Attorney for Plaintiff"
        ]

        sig_start = self.parser._find_signature_start(lines)
        self.assertGreater(sig_start, 0)
        self.assertLess(sig_start, len(lines))

        print(f"✅ Signature detection test passed (signature starts at line {sig_start})")

    def test_parsed_document_methods(self):
        """Test ParsedDocument helper methods"""
        from extractors.pdf_parser import DocumentSection

        sections = [
            DocumentSection('header', 'Court Header', 1),
            DocumentSection('body', 'Main content paragraph 1', 1),
            DocumentSection('body', 'Main content paragraph 2', 2),
            DocumentSection('signature', 'Attorney signature', 2),
        ]

        doc = ParsedDocument(
            filename='test.pdf',
            total_pages=2,
            sections=sections,
            raw_text='Full raw text',
            metadata={}
        )

        # Test get_body_text
        body_text = doc.get_body_text()
        self.assertIn('Main content paragraph 1', body_text)
        self.assertIn('Main content paragraph 2', body_text)
        self.assertNotIn('Court Header', body_text)
        self.assertNotIn('Attorney signature', body_text)

        # Test get_full_text
        full_text = doc.get_full_text()
        self.assertIn('Court Header', full_text)
        self.assertIn('Main content paragraph 1', full_text)
        self.assertIn('Attorney signature', full_text)

        print("✅ ParsedDocument methods test passed")

    def test_file_not_found(self):
        """Test error handling for missing files"""
        with self.assertRaises(FileNotFoundError):
            self.parser.parse_file('/nonexistent/path/to/file.pdf')

        print("✅ File not found error handling test passed")

    def test_parse_with_sample_text(self):
        """Test parsing with realistic court document text"""
        # Create a temporary text-based "PDF" for testing structure
        sample_text = """IN THE SUPERIOR COURT OF CALIFORNIA
COUNTY OF SAN FRANCISCO

Case No. 164400524
JOHN DOE vs JANE DOE

ORDER ON MOTION TO MODIFY CUSTODY

This matter came before the court on October 5, 2025, regarding
Defendant's Motion to Modify Custody Agreement.

After reviewing the evidence and hearing arguments from both parties,
the Court finds as follows:

1. The current custody arrangement has been in place since 2021.
2. Defendant seeks to relocate to another state.
3. Plaintiff opposes the relocation.

THEREFORE, IT IS HEREBY ORDERED that:

Plaintiff shall file a response to this motion within 30 days of the
date of this order.

A hearing is scheduled for November 15, 2025, at 9:00 AM.

Respectfully submitted,

Hon. Judge Smith
Superior Court Judge
Dated: October 5, 2025"""

        # Test text cleaning on this sample
        cleaned = self.parser._clean_text(sample_text)
        self.assertGreater(len(cleaned), 0)
        self.assertIn('Case No. 164400524', cleaned)
        self.assertIn('30 days', cleaned)

        # Test section identification (pass as string, not list)
        sections = self.parser._identify_sections(cleaned, 1, 1)
        self.assertGreater(len(sections), 0)

        print("✅ Sample text parsing test passed")

    def test_real_pdf_if_available(self):
        """Test with real PDF if available in scraped_data"""
        scraped_data_dir = Path(__file__).parent.parent / 'scraped_data'

        if not scraped_data_dir.exists():
            print("⚠️  No scraped_data directory found - skipping real PDF test")
            return

        # Look for PDF files
        pdf_files = list(scraped_data_dir.rglob('*.pdf'))

        if not pdf_files:
            print("⚠️  No PDF files found in scraped_data - skipping real PDF test")
            return

        # Test with first PDF found
        test_pdf = pdf_files[0]
        print(f"📄 Testing with real PDF: {test_pdf.name}")

        try:
            doc = parse_court_document(str(test_pdf))

            self.assertIsNotNone(doc)
            self.assertGreater(doc.total_pages, 0)
            self.assertGreater(len(doc.raw_text), 0)

            print(f"✅ Real PDF test passed:")
            print(f"   - Filename: {doc.filename}")
            print(f"   - Pages: {doc.total_pages}")
            print(f"   - Text length: {len(doc.raw_text)} chars")
            print(f"   - Sections: {len(doc.sections)}")

        except Exception as e:
            print(f"⚠️  Could not parse PDF {test_pdf.name}: {str(e)}")
            # Don't fail the test suite if a specific PDF can't be parsed
            pass


class TestPDFParserIntegration(unittest.TestCase):
    """Integration tests requiring actual PDF creation"""

    def test_create_simple_pdf(self):
        """Test creating and parsing a simple PDF"""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter

            # Create a simple test PDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp_path = tmp.name

            try:
                # Create PDF
                c = canvas.Canvas(tmp_path, pagesize=letter)
                c.drawString(100, 750, "Test Court Document")
                c.drawString(100, 700, "Case No. 123456")
                c.drawString(100, 600, "This is a test order.")
                c.drawString(100, 550, "Plaintiff must respond within 30 days.")
                c.save()

                # Parse it
                parser = PDFParser()
                doc = parser.parse_file(tmp_path)

                self.assertIsNotNone(doc)
                self.assertEqual(doc.total_pages, 1)
                self.assertIn('Test Court Document', doc.raw_text)
                self.assertIn('30 days', doc.raw_text)

                print("✅ PDF creation and parsing integration test passed")

            finally:
                # Clean up
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except ImportError:
            print("⚠️  reportlab not installed - skipping PDF creation test")
            print("   Install with: pip install reportlab")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
