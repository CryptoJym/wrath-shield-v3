"""
Attorney Request Detection Module for Legal Advocate AI
Uses NLTK for NLP-based request identification and structured extraction
"""

import re
import nltk
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum

# Import deadline extractor for deadline detection
from extractors.deadline_extractor import DeadlineExtractor

from utils import (
    get_logger,
    RequestDetectionError,
    track_performance,
    graceful_degradation,
)

logger = get_logger(__name__)


class RequestType(Enum):
    """Categories of attorney requests"""
    DOCUMENT_REQUEST = "document_request"
    INFORMATION_REQUEST = "information_request"
    ACTION_REQUEST = "action_request"
    MEETING_REQUEST = "meeting_request"
    FILING_REQUEST = "filing_request"
    RESEARCH_REQUEST = "research_request"
    CORRESPONDENCE_REQUEST = "correspondence_request"
    OTHER = "other"


class UrgencyLevel(Enum):
    """Urgency levels for requests"""
    CRITICAL = "critical"  # ASAP, urgent, immediately
    HIGH = "high"  # Soon, this week, by [near date]
    MEDIUM = "medium"  # By [reasonable date], when possible
    LOW = "low"  # No urgency indicators


@dataclass
class DetectedRequest:
    """Represents a detected attorney request with structured data"""

    # Core request data
    what_is_needed: str
    requested_by: str
    requested_date: datetime
    urgency_level: UrgencyLevel
    request_type: RequestType

    # Context
    original_text: str
    email_subject: str

    # Deadline information (if detected)
    deadline: Optional[datetime] = None
    deadline_description: Optional[str] = None

    # Confidence scoring
    confidence_score: float = 0.0  # 0.0 to 1.0

    # Multi-part requests
    sub_requests: List[str] = field(default_factory=list)

    # Metadata
    extraction_timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        """Convert to dictionary for storage/processing"""
        return {
            'what_is_needed': self.what_is_needed,
            'requested_by': self.requested_by,
            'requested_date': self.requested_date.isoformat(),
            'urgency_level': self.urgency_level.value,
            'request_type': self.request_type.value,
            'original_text': self.original_text,
            'email_subject': self.email_subject,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'deadline_description': self.deadline_description,
            'confidence_score': self.confidence_score,
            'sub_requests': self.sub_requests,
            'extraction_timestamp': self.extraction_timestamp.isoformat()
        }


class RequestDetector:
    """
    Detects and extracts attorney requests from email text using NLP

    Features:
    - Pattern matching for imperative verbs and request phrases
    - Request type classification
    - Urgency level detection
    - Deadline extraction
    - Multi-part request handling
    - False positive filtering
    - Confidence scoring
    """

    # Imperative verbs indicating requests
    IMPERATIVE_VERBS = {
        'send', 'provide', 'forward', 'email', 'submit', 'prepare',
        'draft', 'file', 'review', 'update', 'check', 'verify',
        'confirm', 'schedule', 'arrange', 'contact', 'call',
        'research', 'investigate', 'obtain', 'get', 'find',
        'compile', 'gather', 'collect', 'organize', 'create'
    }

    # Request phrase patterns
    REQUEST_PATTERNS = [
        r'\b(?:can|could|would) you (?:please )?(\w+)',  # "Can you send..."
        r'\bplease (\w+)',  # "Please send..."
        r'\bi need (?:you to )?(\w+)',  # "I need you to send..."
        r'\bneed (?:you to )?(\w+)',  # "Need you to send..."
        r'\bwould like (?:you to )?(\w+)',  # "Would like you to send..."
        r'\basking (?:you to )?(\w+)',  # "Asking you to send..."
        r'\brequesting (?:you to )?(\w+)',  # "Requesting you to send..."
        r'\blet me know',  # "Let me know..."
        r'\bget back to me',  # "Get back to me..."
    ]

    # Urgency indicators
    URGENCY_CRITICAL = {
        'asap', 'urgent', 'immediately', 'right away', 'emergency',
        'critical', 'time-sensitive', 'top priority'
    }

    URGENCY_HIGH = {
        'soon', 'quickly', 'promptly', 'this week', 'today',
        'tomorrow', 'by end of day', 'eod'
    }

    URGENCY_MEDIUM = {
        'when you can', 'this month', 'next week'
    }

    URGENCY_LOW = {
        'when possible', 'at your convenience', 'when you have a chance',
        'no rush', 'whenever', 'at your earliest convenience'
    }

    # Document-related keywords
    DOCUMENT_KEYWORDS = {
        'document', 'file', 'report', 'brief', 'motion', 'pleading',
        'contract', 'agreement', 'form', 'letter', 'memo', 'discovery',
        'exhibit', 'attachment', 'affidavit', 'declaration'
    }

    # False positive patterns to filter out
    FALSE_POSITIVE_PATTERNS = [
        r'\?$',  # Questions (usually)
        r'\bhow (?:do|did|does|can|should)',  # How-to questions
        r'\bwhat (?:do|did|does|is|are)',  # What questions
        r'\bwhy (?:do|did|does|is|are)',  # Why questions
        r'\bwhen (?:do|did|does|is|are)',  # When questions (not deadlines)
        r'\bjust (?:checking|wondering|curious)',  # Casual inquiry
        r'\bfor your (?:information|reference)',  # FYI
    ]

    def __init__(self):
        """Initialize the request detector with NLTK and deadline extractor"""
        self.deadline_extractor = DeadlineExtractor()

        # Ensure NLTK data is available
        try:
            nltk.data.find('tokenizers/punkt')
            nltk.data.find('taggers/averaged_perceptron_tagger')
        except LookupError:
            # Download if not available
            nltk.download('punkt', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)

    @track_performance()
    def detect_requests(
        self,
        email_text: str,
        email_subject: str,
        sender_name: str,
        timestamp: datetime,
        email_id: Optional[str] = None
    ) -> List[DetectedRequest]:
        """
        Detect all attorney requests in an email

        Args:
            email_text: Email body text
            email_subject: Email subject line
            sender_name: Name of sender (attorney)
            timestamp: Email timestamp
            email_id: Optional email identifier

        Returns:
            List of detected requests with structured data

        Raises:
            RequestDetectionError: If detection completely fails
        """
        if not email_text or not email_text.strip():
            logger.warning("Empty email text provided for request detection")
            return []

        requests = []

        try:
            logger.info(
                f"Detecting requests in email from {sender_name}",
                extra={
                    'sender': sender_name,
                    'subject': email_subject,
                    'email_id': email_id,
                    'text_length': len(email_text)
                }
            )

            # Clean and prepare text
            text = self._clean_text(email_text)

            # Split into sentences for processing
            try:
                sentences = self._split_sentences(text)
            except Exception as e:
                logger.error(
                    f"Failed to split text into sentences: {str(e)}",
                    exc_info=True,
                    extra={'email_id': email_id}
                )
                raise RequestDetectionError(
                    f"Failed to tokenize email text: {str(e)}",
                    email_subject=email_subject,
                    email_id=email_id
                )

            # Process each sentence
            sentence_count = 0
            request_candidates = 0
            for sentence in sentences:
                sentence_count += 1
                # Check if this is a request
                if self._is_request(sentence):
                    request_candidates += 1
                    # Skip false positives
                    if self._is_false_positive(sentence):
                        logger.debug(
                            f"Filtered false positive: {sentence[:50]}...",
                            extra={'sentence': sentence[:100]}
                        )
                        continue

                    try:
                        # Extract request details
                        request = self._extract_request(
                            sentence=sentence,
                            full_text=email_text,
                            email_subject=email_subject,
                            sender_name=sender_name,
                            timestamp=timestamp
                        )

                        if request and request.confidence_score >= 0.3:
                            requests.append(request)
                            logger.debug(
                                f"Detected request: {request.what_is_needed[:50]}...",
                                extra={
                                    'confidence': request.confidence_score,
                                    'urgency': request.urgency_level.value,
                                    'type': request.request_type.value
                                }
                            )
                    except Exception as e:
                        logger.warning(
                            f"Failed to extract request from sentence: {str(e)}",
                            extra={'sentence': sentence[:100], 'error': str(e)}
                        )
                        continue

            # Handle multi-part requests (bullet lists)
            try:
                multi_part = self._detect_multi_part_requests(
                    email_text, email_subject, sender_name, timestamp
                )
                if multi_part:
                    requests.extend(multi_part)
                    logger.debug(f"Detected {len(multi_part)} multi-part requests")
            except Exception as e:
                logger.warning(
                    f"Failed to detect multi-part requests: {str(e)}",
                    extra={'email_id': email_id, 'error': str(e)}
                )

            logger.info(
                f"Detected {len(requests)} requests from {sentence_count} sentences "
                f"({request_candidates} candidates evaluated)",
                extra={
                    'request_count': len(requests),
                    'sentence_count': sentence_count,
                    'candidates': request_candidates,
                    'email_id': email_id
                }
            )

            return requests

        except RequestDetectionError:
            raise
        except Exception as e:
            logger.error(
                f"Unexpected error during request detection: {str(e)}",
                exc_info=True,
                extra={'email_id': email_id, 'subject': email_subject}
            )
            raise RequestDetectionError(
                f"Failed to detect requests: {str(e)}",
                email_subject=email_subject,
                email_id=email_id,
                error_type=type(e).__name__
            )

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text for processing"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove email signatures (common patterns)
        text = re.sub(r'--\s*\n.*', '', text, flags=re.DOTALL)
        text = re.sub(r'Best regards,.*', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'Sincerely,.*', '', text, flags=re.DOTALL | re.IGNORECASE)

        return text.strip()

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences using NLTK"""
        try:
            sentences = nltk.sent_tokenize(text)
        except Exception:
            # Fallback to simple splitting
            sentences = re.split(r'[.!?]+', text)

        return [s.strip() for s in sentences if s.strip()]

    def _is_request(self, sentence: str) -> bool:
        """Check if a sentence contains a request"""
        sentence_lower = sentence.lower()

        # Check for request patterns
        for pattern in self.REQUEST_PATTERNS:
            if re.search(pattern, sentence_lower):
                return True

        # Check for imperative verbs
        tokens = nltk.word_tokenize(sentence)
        pos_tags = nltk.pos_tag(tokens)

        # Look for imperative verbs at sentence start or after punctuation
        # Check first few words (POS tag might be wrong for imperatives)
        for i, (word, tag) in enumerate(pos_tags):
            if i < 3:
                # Check if it's tagged as a verb
                if tag == 'VB' and word.lower() in self.IMPERATIVE_VERBS:
                    return True
                # Also check first 3 words even if not tagged as VB (imperatives often mistagged)
                # This handles cases like "Quickly forward..." where "forward" is tagged as RB
                if word.lower() in self.IMPERATIVE_VERBS:
                    return True

        # Also check for imperative verbs after punctuation (-, :, ;)
        for i, (word, tag) in enumerate(pos_tags):
            if i > 0:
                prev_word = pos_tags[i-1][0]
                if prev_word in ['-', ':', ';']:
                    if word.lower() in self.IMPERATIVE_VERBS:
                        return True

        # Check for passive request forms ("X needed", "X required")
        if re.search(r'\b(needed|required)\b', sentence_lower):
            return True

        return False

    def _is_false_positive(self, sentence: str) -> bool:
        """Filter out false positives (questions, rhetorical requests)"""
        sentence_lower = sentence.lower()

        # Check if it's a polite request (Can you, Could you, Would you)
        # These are requests, not questions
        polite_request_patterns = [
            r'\b(?:can|could|would) you (?:please )?(?:send|provide|forward|email|submit|prepare|draft|file|review|update)',
        ]
        for pattern in polite_request_patterns:
            if re.search(pattern, sentence_lower):
                return False  # Not a false positive

        # Now check for actual false positives
        for pattern in self.FALSE_POSITIVE_PATTERNS:
            if re.search(pattern, sentence_lower):
                return True

        return False

    def _extract_request(
        self,
        sentence: str,
        full_text: str,
        email_subject: str,
        sender_name: str,
        timestamp: datetime
    ) -> Optional[DetectedRequest]:
        """Extract structured request data from a sentence"""

        # Extract what is needed
        what_is_needed = self._extract_what_is_needed(sentence)

        # Classify request type
        request_type = self._classify_request_type(sentence, what_is_needed)

        # Detect urgency level
        urgency_level = self._detect_urgency(sentence, full_text)

        # Extract deadline if present
        deadline, deadline_desc = self._extract_deadline(sentence)

        # Calculate confidence score
        confidence = self._calculate_confidence(
            sentence=sentence,
            what_is_needed=what_is_needed,
            request_type=request_type,
            urgency_level=urgency_level
        )

        return DetectedRequest(
            what_is_needed=what_is_needed,
            requested_by=sender_name,
            requested_date=timestamp,
            urgency_level=urgency_level,
            request_type=request_type,
            original_text=sentence,
            email_subject=email_subject,
            deadline=deadline,
            deadline_description=deadline_desc,
            confidence_score=confidence
        )

    def _extract_what_is_needed(self, sentence: str) -> str:
        """Extract what is being requested"""
        # Try to extract the object of the request

        # Pattern: "Please send [what]"
        match = re.search(r'(?:please |can you |could you )?(?:send|provide|forward|email|submit) (.+?)(?:\.|by|before|$)', sentence, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Pattern: "I need [what]"
        match = re.search(r'(?:i |we )?need (?:you to )?(.+?)(?:\.|by|before|$)', sentence, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Fallback: return the sentence minus common request prefixes
        cleaned = re.sub(r'^(?:please |can you |could you |i need |we need )', '', sentence, flags=re.IGNORECASE)
        return cleaned.strip()

    def _classify_request_type(self, sentence: str, what_is_needed: str) -> RequestType:
        """Classify the type of request"""
        text = (sentence + " " + what_is_needed).lower()

        # Filing request (check first - more specific)
        # Look for filing verbs with court context
        if re.search(r'\b(file|filing|submit|lodge).*\b(court|clerk|tribunal)', text) or \
           re.search(r'\b(file|filing|submit|lodge)\s+(the\s+)?(motion|petition|complaint|answer|brief)', text):
            return RequestType.FILING_REQUEST

        # Document request
        if any(keyword in text for keyword in self.DOCUMENT_KEYWORDS):
            return RequestType.DOCUMENT_REQUEST

        # Meeting/call request
        if any(word in text for word in ['meet', 'meeting', 'call', 'schedule', 'arrange']):
            return RequestType.MEETING_REQUEST

        # Research request
        if any(word in text for word in ['research', 'investigate', 'look into', 'find out']):
            return RequestType.RESEARCH_REQUEST

        # Correspondence request
        if any(word in text for word in ['email', 'letter', 'contact', 'reach out', 'respond']):
            return RequestType.CORRESPONDENCE_REQUEST

        # Information request
        if any(word in text for word in ['information', 'details', 'status', 'update', 'confirm']):
            return RequestType.INFORMATION_REQUEST

        # Action request (catch-all for actions)
        if any(word in text for word in self.IMPERATIVE_VERBS):
            return RequestType.ACTION_REQUEST

        return RequestType.OTHER

    def _detect_urgency(self, sentence: str, full_text: str) -> UrgencyLevel:
        """Detect urgency level from text"""
        text = (sentence + " " + full_text).lower()

        # Check for critical urgency
        if any(indicator in text for indicator in self.URGENCY_CRITICAL):
            return UrgencyLevel.CRITICAL

        # Check for high urgency
        if any(indicator in text for indicator in self.URGENCY_HIGH):
            return UrgencyLevel.HIGH

        # Check for medium urgency
        if any(indicator in text for indicator in self.URGENCY_MEDIUM):
            return UrgencyLevel.MEDIUM

        # Check for low urgency indicators (explicit low-urgency phrases)
        if any(indicator in text for indicator in self.URGENCY_LOW):
            return UrgencyLevel.LOW

        # Check for near-term deadlines (within 3 days)
        deadline, _ = self._extract_deadline(sentence)
        if deadline:
            days_until = (deadline - datetime.now()).days
            if days_until <= 1:
                return UrgencyLevel.CRITICAL
            elif days_until <= 3:
                return UrgencyLevel.HIGH
            elif days_until <= 7:
                return UrgencyLevel.MEDIUM

        return UrgencyLevel.LOW

    def _extract_deadline(self, sentence: str) -> Tuple[Optional[datetime], Optional[str]]:
        """Extract deadline from sentence using DeadlineExtractor"""
        deadlines = self.deadline_extractor.extract_deadlines(sentence)

        if deadlines:
            # Return the first (most likely) deadline
            first = deadlines[0]
            return first.deadline_date, first.original_text

        return None, None

    def _calculate_confidence(
        self,
        sentence: str,
        what_is_needed: str,
        request_type: RequestType,
        urgency_level: UrgencyLevel
    ) -> float:
        """Calculate confidence score for the extracted request"""
        confidence = 0.5  # Base confidence

        # Boost for clear imperative verbs
        if any(verb in sentence.lower() for verb in self.IMPERATIVE_VERBS):
            confidence += 0.2

        # Boost for explicit request phrases
        if re.search(r'\b(?:please|can you|could you|i need|need|would like)\b', sentence.lower()):
            confidence += 0.15

        # Boost for specific request type (not OTHER)
        if request_type != RequestType.OTHER:
            confidence += 0.1

        # Boost for urgency indicators
        if urgency_level in (UrgencyLevel.CRITICAL, UrgencyLevel.HIGH):
            confidence += 0.1

        # Penalty for vague what_is_needed (single word like "it")
        if len(what_is_needed.split()) == 1:
            confidence -= 0.35  # Strong penalty for single-word extractions
        elif len(what_is_needed.split()) < 2:
            confidence -= 0.15

        # Penalty for very long extractions (likely incorrect)
        if len(what_is_needed.split()) > 20:
            confidence -= 0.2

        return max(0.0, min(1.0, confidence))

    def _detect_multi_part_requests(
        self,
        email_text: str,
        email_subject: str,
        sender_name: str,
        timestamp: datetime
    ) -> List[DetectedRequest]:
        """Detect multi-part requests (bullet lists, numbered lists)"""
        requests = []

        # Pattern for bullet points or numbered lists
        # Matches: "- item", "* item", "• item", "1. item", "2) item", etc.
        list_pattern = r'(?:^|\n)\s*(?:[-•*]|\d+[.)])\s+(.+?)(?=\n|$)'

        matches = re.finditer(list_pattern, email_text, re.MULTILINE)
        items = [m.group(1).strip() for m in matches if m.group(1).strip()]

        # If we found list items, check if they're requests
        if len(items) >= 2:  # At least 2 items to be considered a multi-part request
            # Check if there's a request header
            header_pattern = r'(?:please|i need|could you|can you|would like|need you to)\s+.*(?:following|these)'
            has_request_header = bool(re.search(header_pattern, email_text.lower()))

            if has_request_header or any(self._is_request(item) for item in items):
                # Create a multi-part request
                main_request = DetectedRequest(
                    what_is_needed="Multiple items requested (see sub_requests)",
                    requested_by=sender_name,
                    requested_date=timestamp,
                    urgency_level=self._detect_urgency(email_text, email_text),
                    request_type=RequestType.DOCUMENT_REQUEST,  # Most common for lists
                    original_text=email_text[:200] + "...",  # Truncate for storage
                    email_subject=email_subject,
                    sub_requests=items,
                    confidence_score=0.7 if has_request_header else 0.5
                )

                requests.append(main_request)

        return requests


def detect_requests_from_email(
    email_text: str,
    email_subject: str,
    sender_name: str,
    timestamp: datetime
) -> List[Dict]:
    """
    Convenience function to detect requests from email and return as dictionaries

    Args:
        email_text: Email body text
        email_subject: Email subject line
        sender_name: Sender's name
        timestamp: Email timestamp

    Returns:
        List of request dictionaries
    """
    detector = RequestDetector()
    requests = detector.detect_requests(email_text, email_subject, sender_name, timestamp)
    return [req.to_dict() for req in requests]


if __name__ == "__main__":
    # Test the request detector
    import sys

    if len(sys.argv) < 2:
        print("Usage: python request_detector.py <email-text>")
        print("\nExample:")
        print('  python request_detector.py "Please send me the case files by Friday."')
        sys.exit(1)

    email_text = sys.argv[1]

    print(f"\n{'='*70}")
    print(f"Attorney Request Detection Test")
    print(f"{'='*70}")

    # Detect requests
    detector = RequestDetector()
    requests = detector.detect_requests(
        email_text=email_text,
        email_subject="Test Email",
        sender_name="Test Attorney",
        timestamp=datetime.now()
    )

    if not requests:
        print("\n⚠️  No requests detected")
    else:
        print(f"\n✅ Detected {len(requests)} request(s):\n")

        for i, req in enumerate(requests, 1):
            print(f"[{i}] Request Type: {req.request_type.value}")
            print(f"    What: {req.what_is_needed}")
            print(f"    Urgency: {req.urgency_level.value}")
            print(f"    Confidence: {req.confidence_score:.2f}")

            if req.deadline:
                print(f"    Deadline: {req.deadline.strftime('%Y-%m-%d')} ({req.deadline_description})")

            if req.sub_requests:
                print(f"    Sub-requests ({len(req.sub_requests)}):")
                for sub in req.sub_requests:
                    print(f"      - {sub}")

            print()
