"""
Gmail Integration Module for Legal Advocate AI
Wraps gmail_scraper.py for attorney email processing and request detection
"""

import json
import hashlib
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
from dataclasses import dataclass, field
import logging

# Import existing Gmail scraper
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from gmail_scraper import GmailScraper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class AttorneyEmail:
    """Represents a processed attorney email ready for NLP analysis"""
    email_id: str
    thread_id: str
    sender: str
    sender_name: str
    recipient: str
    subject: str
    body_text: str
    timestamp: datetime
    is_part_of_thread: bool
    thread_context: List[str] = field(default_factory=list)
    has_attachments: bool = False
    attachment_names: List[str] = field(default_factory=list)
    labels: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        """Convert to dictionary for storage/processing"""
        return {
            'email_id': self.email_id,
            'thread_id': self.thread_id,
            'sender': self.sender,
            'sender_name': self.sender_name,
            'recipient': self.recipient,
            'subject': self.subject,
            'body_text': self.body_text,
            'timestamp': self.timestamp.isoformat(),
            'is_part_of_thread': self.is_part_of_thread,
            'thread_context': self.thread_context,
            'has_attachments': self.has_attachments,
            'attachment_names': self.attachment_names,
            'labels': self.labels,
        }


class GmailIntegration:
    """
    High-level Gmail integration for attorney email processing

    Features:
    - Attorney email filtering
    - Thread context management
    - Email caching to avoid redundant processing
    - Structured output for NLP processing
    - Rate limiting protection
    """

    def __init__(
        self,
        credentials_path: str = 'credentials.json',
        cache_dir: str = '.email_cache',
        attorney_emails: Optional[List[str]] = None
    ):
        """
        Initialize Gmail integration

        Args:
            credentials_path: Path to Gmail OAuth credentials
            cache_dir: Directory for caching processed emails
            attorney_emails: List of known attorney email addresses to filter
        """
        self.scraper = GmailScraper(credentials_path=credentials_path)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)

        # Cache file for tracking processed emails
        self.cache_file = self.cache_dir / 'processed_emails.json'
        self.processed_ids = self._load_cache()

        # Attorney email filters
        self.attorney_emails = set(attorney_emails or [])
        self.attorney_domains = set()  # For domain-level filtering

    def _load_cache(self) -> Set[str]:
        """Load cache of processed email IDs"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    data = json.load(f)
                    return set(data.get('processed_ids', []))
            except Exception as e:
                logger.warning(f"Failed to load cache: {e}")
        return set()

    def _save_cache(self):
        """Save processed email IDs to cache"""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump({
                    'processed_ids': list(self.processed_ids),
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save cache: {e}")

    def add_attorney_email(self, email: str):
        """Add an attorney email address to filter list"""
        self.attorney_emails.add(email.lower())
        logger.info(f"Added attorney email: {email}")

    def add_attorney_domain(self, domain: str):
        """Add an attorney domain to filter list (e.g., 'lawfirm.com')"""
        self.attorney_domains.add(domain.lower())
        logger.info(f"Added attorney domain: {domain}")

    def _is_from_attorney(self, from_address: str) -> bool:
        """Check if email is from a known attorney"""
        # Extract email address from "Name <email@example.com>" format
        email = self._extract_email_address(from_address).lower()

        # Check exact email match
        if email in self.attorney_emails:
            return True

        # Check domain match
        for domain in self.attorney_domains:
            if f"@{domain}" in email:
                return True

        return False

    def _extract_sender_name(self, from_header: str) -> str:
        """Extract name from 'From' header (e.g., 'John Doe <john@example.com>')"""
        if '<' in from_header:
            name = from_header.split('<')[0].strip()
            return name.strip('"\'')
        return from_header

    def _extract_email_address(self, from_header: str) -> str:
        """Extract email address from 'From' header"""
        if '<' in from_header and '>' in from_header:
            return from_header.split('<')[1].split('>')[0].strip()
        return from_header.strip()

    def get_attorney_emails(
        self,
        days: int = 30,
        max_results: int = 100,
        include_threads: bool = True,
        force_refresh: bool = False
    ) -> List[AttorneyEmail]:
        """
        Retrieve and process attorney emails

        Args:
            days: Number of days to look back
            max_results: Maximum emails to retrieve
            include_threads: Whether to include thread context
            force_refresh: Force re-processing of cached emails

        Returns:
            List of processed AttorneyEmail objects
        """
        logger.info(f"Retrieving attorney emails from last {days} days...")

        # Build query for attorney emails
        if self.attorney_emails:
            # Query by specific email addresses
            email_queries = [f"from:{email}" for email in self.attorney_emails]
            query = " OR ".join(email_queries)
        elif self.attorney_domains:
            # Query by domains
            domain_queries = [f"from:*@{domain}" for domain in self.attorney_domains]
            query = " OR ".join(domain_queries)
        else:
            # Fallback: look for common legal/attorney keywords
            query = "from:attorney OR from:lawyer OR from:counsel OR subject:legal"
            logger.warning("No attorney filters set. Using keyword-based search.")

        # Add time filter
        cutoff = datetime.now() - timedelta(days=days)
        query += f" after:{cutoff.strftime('%Y/%m/%d')}"

        # Search for messages
        message_ids = self.scraper.search_messages(query, max_results=max_results)
        logger.info(f"Found {len(message_ids)} matching emails")

        # Process emails
        attorney_emails = []
        threads_cache = {}  # Cache for thread messages

        for i, msg in enumerate(message_ids, 1):
            email_id = msg['id']

            # Skip if already processed (unless force_refresh)
            if not force_refresh and email_id in self.processed_ids:
                logger.debug(f"Skipping cached email {email_id}")
                continue

            logger.info(f"Processing email {i}/{len(message_ids)}...")

            # Get full message details
            details = self.scraper.get_message_details(email_id)
            if not details:
                continue

            # Extract sender info
            from_header = details['from']
            sender_email = self._extract_email_address(from_header)
            sender_name = self._extract_sender_name(from_header)

            # Verify it's from an attorney (if filters are set)
            if self.attorney_emails or self.attorney_domains:
                if not self._is_from_attorney(from_header):
                    logger.debug(f"Skipping non-attorney email from {sender_email}")
                    continue

            # Handle thread context
            thread_context = []
            is_part_of_thread = False

            if include_threads and details['thread_id']:
                thread_id = details['thread_id']

                # Get thread messages if not cached
                if thread_id not in threads_cache:
                    thread_messages = self._get_thread_messages(thread_id)
                    threads_cache[thread_id] = thread_messages

                thread_messages = threads_cache[thread_id]
                is_part_of_thread = len(thread_messages) > 1

                # Build thread context (previous messages in thread)
                for thread_msg in thread_messages:
                    if thread_msg['id'] != email_id:
                        context_text = f"[{thread_msg['from']}] {thread_msg['subject']}: {thread_msg['snippet']}"
                        thread_context.append(context_text)

            # Create AttorneyEmail object
            attorney_email = AttorneyEmail(
                email_id=email_id,
                thread_id=details['thread_id'],
                sender=sender_email,
                sender_name=sender_name,
                recipient=details['to'],
                subject=details['subject'],
                body_text=details['body'],
                timestamp=datetime.fromisoformat(details['timestamp']),
                is_part_of_thread=is_part_of_thread,
                thread_context=thread_context,
                has_attachments=details['has_attachments'],
                labels=details.get('labels', [])
            )

            attorney_emails.append(attorney_email)

            # Mark as processed
            self.processed_ids.add(email_id)

        # Save cache
        self._save_cache()

        logger.info(f"Processed {len(attorney_emails)} new attorney emails")
        return attorney_emails

    def _get_thread_messages(self, thread_id: str) -> List[Dict]:
        """Get all messages in a thread"""
        try:
            thread = self.scraper.service.users().threads().get(
                userId='me',
                id=thread_id,
                format='metadata',
                metadataHeaders=['From', 'Subject']
            ).execute()

            messages = []
            for msg in thread.get('messages', []):
                # Extract basic info
                headers = {
                    h['name']: h['value']
                    for h in msg.get('payload', {}).get('headers', [])
                }

                messages.append({
                    'id': msg['id'],
                    'from': headers.get('From', ''),
                    'subject': headers.get('Subject', ''),
                    'snippet': msg.get('snippet', ''),
                    'timestamp': datetime.fromtimestamp(
                        int(msg['internalDate']) / 1000
                    ).isoformat()
                })

            return messages

        except Exception as e:
            logger.error(f"Failed to get thread {thread_id}: {e}")
            return []

    def prepare_for_nlp(
        self,
        attorney_emails: List[AttorneyEmail],
        include_thread_context: bool = True
    ) -> List[Dict]:
        """
        Prepare attorney emails for NLP processing

        Args:
            attorney_emails: List of AttorneyEmail objects
            include_thread_context: Whether to include thread context in text

        Returns:
            List of dictionaries with structured text for NLP
        """
        nlp_data = []

        for email in attorney_emails:
            # Build combined text for NLP
            text_parts = [
                f"Subject: {email.subject}",
                f"From: {email.sender_name} <{email.sender}>",
                f"Date: {email.timestamp.strftime('%Y-%m-%d %H:%M')}",
                "",
                email.body_text
            ]

            # Add thread context if available
            if include_thread_context and email.thread_context:
                text_parts.insert(0, "--- Thread Context ---")
                for context in email.thread_context[-3:]:  # Last 3 messages
                    text_parts.insert(1, context)
                text_parts.insert(len(email.thread_context) + 1, "--- Current Message ---")

            combined_text = "\n".join(text_parts)

            nlp_data.append({
                'email_id': email.email_id,
                'thread_id': email.thread_id,
                'sender': email.sender,
                'subject': email.subject,
                'timestamp': email.timestamp.isoformat(),
                'text': combined_text,
                'has_thread_context': bool(email.thread_context),
                'has_attachments': email.has_attachments,
                'attachment_names': email.attachment_names,
                'metadata': {
                    'sender_name': email.sender_name,
                    'recipient': email.recipient,
                    'labels': email.labels
                }
            })

        return nlp_data

    def search_by_keywords(
        self,
        keywords: List[str],
        days: int = 30,
        max_results: int = 50
    ) -> List[AttorneyEmail]:
        """
        Search attorney emails by keywords

        Args:
            keywords: List of keywords to search for
            days: Number of days to look back
            max_results: Maximum results to return

        Returns:
            List of matching AttorneyEmail objects
        """
        # Build keyword query
        keyword_query = " OR ".join([f'"{kw}"' for kw in keywords])

        # Combine with attorney filter if available
        if self.attorney_emails:
            email_queries = [f"from:{email}" for email in self.attorney_emails]
            query = f"({keyword_query}) AND ({' OR '.join(email_queries)})"
        else:
            query = keyword_query

        # Add time filter
        cutoff = datetime.now() - timedelta(days=days)
        query += f" after:{cutoff.strftime('%Y/%m/%d')}"

        logger.info(f"Searching for keywords: {keywords}")

        # Use existing get_attorney_emails with custom query
        # (We need to temporarily modify the search method)
        message_ids = self.scraper.search_messages(query, max_results=max_results)

        # Process results
        attorney_emails = []
        for msg in message_ids:
            details = self.scraper.get_message_details(msg['id'])
            if details:
                from_header = details['from']
                attorney_email = AttorneyEmail(
                    email_id=details['id'],
                    thread_id=details['thread_id'],
                    sender=self._extract_email_address(from_header),
                    sender_name=self._extract_sender_name(from_header),
                    recipient=details['to'],
                    subject=details['subject'],
                    body_text=details['body'],
                    timestamp=datetime.fromisoformat(details['timestamp']),
                    is_part_of_thread=False,
                    has_attachments=details['has_attachments'],
                    labels=details.get('labels', [])
                )
                attorney_emails.append(attorney_email)

        logger.info(f"Found {len(attorney_emails)} emails matching keywords")
        return attorney_emails


def get_attorney_emails_for_processing(
    credentials_path: str = 'credentials.json',
    attorney_emails: Optional[List[str]] = None,
    days: int = 30
) -> List[Dict]:
    """
    Convenience function to get attorney emails ready for NLP processing

    Args:
        credentials_path: Path to Gmail OAuth credentials
        attorney_emails: List of attorney email addresses to filter
        days: Number of days to look back

    Returns:
        List of dictionaries ready for NLP processing
    """
    integration = GmailIntegration(
        credentials_path=credentials_path,
        attorney_emails=attorney_emails
    )

    emails = integration.get_attorney_emails(days=days)
    return integration.prepare_for_nlp(emails)


if __name__ == "__main__":
    # Test the integration
    import sys

    if len(sys.argv) < 2:
        print("Usage: python gmail_integration.py <attorney-email>")
        print("\nExample:")
        print("  python gmail_integration.py destiny@lawfirm.com")
        sys.exit(1)

    attorney_email = sys.argv[1]

    try:
        print(f"\n{'='*70}")
        print(f"Gmail Integration Test - Attorney Email Processing")
        print(f"{'='*70}")

        # Initialize integration
        integration = GmailIntegration(attorney_emails=[attorney_email])

        # Get recent emails
        emails = integration.get_attorney_emails(days=30, max_results=10)

        if not emails:
            print(f"\n⚠️  No emails found from {attorney_email}")
        else:
            print(f"\n✅ Found {len(emails)} email(s) from attorney:\n")

            for i, email in enumerate(emails, 1):
                print(f"[{i}] {email.subject}")
                print(f"    From: {email.sender_name} <{email.sender}>")
                print(f"    Date: {email.timestamp.strftime('%Y-%m-%d %H:%M')}")
                print(f"    Thread: {'Yes' if email.is_part_of_thread else 'No'}")
                print(f"    Attachments: {'Yes' if email.has_attachments else 'No'}")
                print(f"    Body preview: {email.body_text[:100]}...")
                print()

            # Prepare for NLP
            nlp_data = integration.prepare_for_nlp(emails)
            print(f"✅ Prepared {len(nlp_data)} emails for NLP processing")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
