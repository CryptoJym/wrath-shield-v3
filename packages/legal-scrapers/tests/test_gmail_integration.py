"""
Unit tests for Gmail Integration
Legal Advocate AI Attorney Email Processing
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
from pathlib import Path
import json
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from integrations.gmail_integration import (
    GmailIntegration,
    AttorneyEmail,
    get_attorney_emails_for_processing
)


class TestAttorneyEmail(unittest.TestCase):
    """Test AttorneyEmail dataclass"""

    def test_attorney_email_creation(self):
        """Test creating AttorneyEmail object"""
        email = AttorneyEmail(
            email_id="12345",
            thread_id="thread_67890",
            sender="attorney@lawfirm.com",
            sender_name="Jane Attorney",
            recipient="client@example.com",
            subject="Case Update",
            body_text="Your case is progressing well.",
            timestamp=datetime.now(),
            is_part_of_thread=False,
            has_attachments=False
        )

        self.assertEqual(email.email_id, "12345")
        self.assertEqual(email.sender, "attorney@lawfirm.com")
        self.assertEqual(email.sender_name, "Jane Attorney")
        self.assertFalse(email.has_attachments)
        print("✅ AttorneyEmail creation test passed")

    def test_attorney_email_to_dict(self):
        """Test conversion to dictionary"""
        email = AttorneyEmail(
            email_id="12345",
            thread_id="thread_67890",
            sender="attorney@lawfirm.com",
            sender_name="Jane Attorney",
            recipient="client@example.com",
            subject="Case Update",
            body_text="Your case is progressing well.",
            timestamp=datetime(2025, 1, 15, 10, 30),
            is_part_of_thread=True,
            thread_context=["Previous message"],
            has_attachments=True,
            attachment_names=["document.pdf"],
            labels=["INBOX", "IMPORTANT"]
        )

        data = email.to_dict()

        self.assertEqual(data['email_id'], "12345")
        self.assertEqual(data['sender'], "attorney@lawfirm.com")
        self.assertTrue(data['is_part_of_thread'])
        self.assertEqual(len(data['thread_context']), 1)
        self.assertTrue(data['has_attachments'])
        self.assertEqual(data['attachment_names'], ["document.pdf"])
        print("✅ AttorneyEmail to_dict test passed")


class TestGmailIntegration(unittest.TestCase):
    """Test GmailIntegration class"""

    def setUp(self):
        """Set up test fixtures"""
        # Mock the GmailScraper to avoid real API calls
        with patch('integrations.gmail_integration.GmailScraper'):
            self.integration = GmailIntegration(
                credentials_path='fake_credentials.json',
                cache_dir='.test_cache',
                attorney_emails=['attorney@lawfirm.com', 'counsel@firm.com']
            )

    def tearDown(self):
        """Clean up test cache"""
        cache_dir = Path('.test_cache')
        if cache_dir.exists():
            for file in cache_dir.iterdir():
                file.unlink()
            cache_dir.rmdir()

    def test_integration_initialization(self):
        """Test integration initialization"""
        self.assertIsNotNone(self.integration)
        self.assertEqual(len(self.integration.attorney_emails), 2)
        self.assertIn('attorney@lawfirm.com', self.integration.attorney_emails)
        print("✅ Integration initialization test passed")

    def test_add_attorney_email(self):
        """Test adding attorney email"""
        self.integration.add_attorney_email('newattorney@example.com')
        self.assertIn('newattorney@example.com', self.integration.attorney_emails)
        print("✅ Add attorney email test passed")

    def test_add_attorney_domain(self):
        """Test adding attorney domain"""
        self.integration.add_attorney_domain('biglaw.com')
        self.assertIn('biglaw.com', self.integration.attorney_domains)
        print("✅ Add attorney domain test passed")

    def test_is_from_attorney_exact_match(self):
        """Test exact email match detection"""
        result = self.integration._is_from_attorney('attorney@lawfirm.com')
        self.assertTrue(result)

        result = self.integration._is_from_attorney('Attorney@LawFirm.com')  # Case insensitive
        self.assertTrue(result)

        result = self.integration._is_from_attorney('random@example.com')
        self.assertFalse(result)
        print("✅ Exact attorney email match test passed")

    def test_is_from_attorney_domain_match(self):
        """Test domain-based attorney detection"""
        self.integration.add_attorney_domain('biglaw.com')

        result = self.integration._is_from_attorney('partner@biglaw.com')
        self.assertTrue(result)

        result = self.integration._is_from_attorney('anyone@biglaw.com')
        self.assertTrue(result)

        result = self.integration._is_from_attorney('someone@otherfirm.com')
        self.assertFalse(result)
        print("✅ Domain-based attorney match test passed")

    def test_extract_sender_name(self):
        """Test sender name extraction"""
        # Name with email
        result = self.integration._extract_sender_name('John Doe <john@example.com>')
        self.assertEqual(result, 'John Doe')

        # Email only
        result = self.integration._extract_sender_name('john@example.com')
        self.assertEqual(result, 'john@example.com')

        # Name with quotes
        result = self.integration._extract_sender_name('"Jane Smith" <jane@example.com>')
        self.assertEqual(result, 'Jane Smith')
        print("✅ Sender name extraction test passed")

    def test_extract_email_address(self):
        """Test email address extraction"""
        # With name
        result = self.integration._extract_email_address('John Doe <john@example.com>')
        self.assertEqual(result, 'john@example.com')

        # Without name
        result = self.integration._extract_email_address('john@example.com')
        self.assertEqual(result, 'john@example.com')

        # With quotes
        result = self.integration._extract_email_address('"Jane" <jane@example.com>')
        self.assertEqual(result, 'jane@example.com')
        print("✅ Email address extraction test passed")

    def test_cache_management(self):
        """Test email cache functionality"""
        # Add some processed IDs
        self.integration.processed_ids.add('email_123')
        self.integration.processed_ids.add('email_456')

        # Save cache
        self.integration._save_cache()

        # Create new instance and verify cache loaded
        with patch('integrations.gmail_integration.GmailScraper'):
            new_integration = GmailIntegration(
                credentials_path='fake_credentials.json',
                cache_dir='.test_cache'
            )

        self.assertIn('email_123', new_integration.processed_ids)
        self.assertIn('email_456', new_integration.processed_ids)
        print("✅ Cache management test passed")

    def test_prepare_for_nlp(self):
        """Test NLP data preparation"""
        emails = [
            AttorneyEmail(
                email_id="123",
                thread_id="thread_1",
                sender="attorney@lawfirm.com",
                sender_name="Jane Attorney",
                recipient="client@example.com",
                subject="Case Update",
                body_text="Your case is progressing well. We have a hearing next week.",
                timestamp=datetime(2025, 1, 15, 10, 30),
                is_part_of_thread=False,
                has_attachments=True,
                attachment_names=["brief.pdf"]
            ),
            AttorneyEmail(
                email_id="124",
                thread_id="thread_2",
                sender="counsel@firm.com",
                sender_name="John Counsel",
                recipient="client@example.com",
                subject="Discovery Response",
                body_text="Please review the attached discovery documents.",
                timestamp=datetime(2025, 1, 16, 14, 0),
                is_part_of_thread=True,
                thread_context=["[Previous] Discovery request sent"]
            )
        ]

        nlp_data = self.integration.prepare_for_nlp(emails, include_thread_context=True)

        self.assertEqual(len(nlp_data), 2)

        # Check first email
        self.assertEqual(nlp_data[0]['email_id'], "123")
        self.assertIn('Subject: Case Update', nlp_data[0]['text'])
        self.assertIn('Jane Attorney', nlp_data[0]['text'])
        self.assertFalse(nlp_data[0]['has_thread_context'])

        # Check second email (with thread context)
        self.assertEqual(nlp_data[1]['email_id'], "124")
        self.assertTrue(nlp_data[1]['has_thread_context'])
        self.assertIn('Thread Context', nlp_data[1]['text'])

        print("✅ NLP data preparation test passed")

    def test_prepare_for_nlp_without_thread_context(self):
        """Test NLP prep without thread context"""
        emails = [
            AttorneyEmail(
                email_id="125",
                thread_id="thread_3",
                sender="attorney@lawfirm.com",
                sender_name="Jane Attorney",
                recipient="client@example.com",
                subject="Quick Question",
                body_text="Can you send me the documents?",
                timestamp=datetime.now(),
                is_part_of_thread=True,
                thread_context=["Previous message about documents"]
            )
        ]

        nlp_data = self.integration.prepare_for_nlp(emails, include_thread_context=False)

        self.assertEqual(len(nlp_data), 1)
        self.assertNotIn('Thread Context', nlp_data[0]['text'])
        print("✅ NLP prep without thread context test passed")


class TestGmailIntegrationWithMockAPI(unittest.TestCase):
    """Test Gmail integration with mocked API responses"""

    @patch('integrations.gmail_integration.GmailScraper')
    def test_get_attorney_emails_basic(self, mock_scraper_class):
        """Test basic attorney email retrieval"""
        # Setup mock scraper
        mock_scraper = MagicMock()
        mock_scraper_class.return_value = mock_scraper

        # Mock search results
        mock_scraper.search_messages.return_value = [
            {'id': 'email_1'},
            {'id': 'email_2'}
        ]

        # Mock message details
        def get_message_details(email_id):
            if email_id == 'email_1':
                return {
                    'id': 'email_1',
                    'thread_id': 'thread_1',
                    'from': 'Jane Attorney <attorney@lawfirm.com>',
                    'to': 'client@example.com',
                    'subject': 'Case Update',
                    'body': 'Your case is progressing.',
                    'timestamp': datetime.now().isoformat(),
                    'has_attachments': False,
                    'labels': ['INBOX']
                }
            elif email_id == 'email_2':
                return {
                    'id': 'email_2',
                    'thread_id': 'thread_2',
                    'from': 'John Counsel <counsel@firm.com>',
                    'to': 'client@example.com',
                    'subject': 'Discovery Request',
                    'body': 'Please provide documents.',
                    'timestamp': datetime.now().isoformat(),
                    'has_attachments': True,
                    'labels': ['INBOX', 'IMPORTANT']
                }
            return None

        mock_scraper.get_message_details.side_effect = get_message_details

        # Create integration
        integration = GmailIntegration(
            credentials_path='fake.json',
            cache_dir='.test_cache',
            attorney_emails=['attorney@lawfirm.com', 'counsel@firm.com']
        )

        # Get emails
        emails = integration.get_attorney_emails(days=30, max_results=10, include_threads=False)

        self.assertEqual(len(emails), 2)
        self.assertEqual(emails[0].sender, 'attorney@lawfirm.com')
        self.assertEqual(emails[1].sender, 'counsel@firm.com')
        self.assertFalse(emails[0].has_attachments)
        self.assertTrue(emails[1].has_attachments)

        # Cleanup
        cache_dir = Path('.test_cache')
        if cache_dir.exists():
            for file in cache_dir.iterdir():
                file.unlink()
            cache_dir.rmdir()

        print("✅ Basic attorney email retrieval test passed")

    @patch('integrations.gmail_integration.GmailScraper')
    def test_caching_prevents_reprocessing(self, mock_scraper_class):
        """Test that caching prevents redundant processing"""
        mock_scraper = MagicMock()
        mock_scraper_class.return_value = mock_scraper

        mock_scraper.search_messages.return_value = [{'id': 'email_1'}]
        mock_scraper.get_message_details.return_value = {
            'id': 'email_1',
            'thread_id': 'thread_1',
            'from': 'Attorney <attorney@lawfirm.com>',
            'to': 'client@example.com',
            'subject': 'Test',
            'body': 'Test body',
            'timestamp': datetime.now().isoformat(),
            'has_attachments': False,
            'labels': []
        }

        integration = GmailIntegration(
            credentials_path='fake.json',
            cache_dir='.test_cache',
            attorney_emails=['attorney@lawfirm.com']
        )

        # First call should process
        emails = integration.get_attorney_emails(days=30, max_results=10, include_threads=False)
        self.assertEqual(len(emails), 1)

        # Second call should skip cached email
        emails = integration.get_attorney_emails(days=30, max_results=10, include_threads=False)
        self.assertEqual(len(emails), 0)  # Already cached

        # Force refresh should reprocess
        emails = integration.get_attorney_emails(days=30, max_results=10, force_refresh=True, include_threads=False)
        self.assertEqual(len(emails), 1)

        # Cleanup
        cache_dir = Path('.test_cache')
        if cache_dir.exists():
            for file in cache_dir.iterdir():
                file.unlink()
            cache_dir.rmdir()

        print("✅ Caching prevents reprocessing test passed")


class TestConvenienceFunction(unittest.TestCase):
    """Test convenience functions"""

    @patch('integrations.gmail_integration.GmailScraper')
    def test_get_attorney_emails_for_processing(self, mock_scraper_class):
        """Test convenience function"""
        mock_scraper = MagicMock()
        mock_scraper_class.return_value = mock_scraper

        mock_scraper.search_messages.return_value = [{'id': 'email_1'}]
        mock_scraper.get_message_details.return_value = {
            'id': 'email_1',
            'thread_id': 'thread_1',
            'from': 'Jane Attorney <attorney@lawfirm.com>',
            'to': 'client@example.com',
            'subject': 'Case Update',
            'body': 'Your case is progressing.',
            'timestamp': datetime.now().isoformat(),
            'has_attachments': False,
            'labels': []
        }

        # Use convenience function
        nlp_data = get_attorney_emails_for_processing(
            credentials_path='fake.json',
            attorney_emails=['attorney@lawfirm.com'],
            days=30
        )

        self.assertGreater(len(nlp_data), 0)
        self.assertIn('text', nlp_data[0])
        self.assertIn('email_id', nlp_data[0])

        # Cleanup
        cache_dir = Path('.email_cache')
        if cache_dir.exists():
            for file in cache_dir.iterdir():
                file.unlink()
            cache_dir.rmdir()

        print("✅ Convenience function test passed")


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
