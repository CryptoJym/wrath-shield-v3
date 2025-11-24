"""
Deadline Extraction Module for Legal Advocate AI
Extracts court deadlines and action items from legal document text
"""

import spacy
import re
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from utils import (
    get_logger,
    DeadlineExtractionError,
    ModelLoadError,
    track_performance,
    retry,
    graceful_degradation,
)

# Configure logging
logger = get_logger(__name__)


@dataclass
class ExtractedDeadline:
    """Represents an extracted deadline from a document"""
    deadline_date: datetime
    action_required: str
    responsible_party: str  # 'self', 'attorney', 'opposing_party', 'unknown'
    deadline_type: str  # 'filing', 'hearing', 'response', 'discovery'
    source_text: str
    confidence: float  # 0.0-1.0
    page_number: Optional[int] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for database storage"""
        return {
            'deadline_date': self.deadline_date,
            'action_required': self.action_required,
            'responsible_party': self.responsible_party,
            'deadline_type': self.deadline_type,
            'source_text': self.source_text,
            'extraction_confidence': self.confidence,
        }


class DeadlineExtractor:
    """
    Extract deadlines from legal document text using NLP

    Features:
    - Pattern matching for common deadline phrases
    - Date entity recognition with spaCy
    - Business day calculation
    - Confidence scoring
    - Multiple date format support
    """

    def __init__(self, model_name: str = "en_core_web_sm"):
        """
        Initialize deadline extractor

        Args:
            model_name: spaCy model to use for NLP

        Raises:
            ModelLoadError: If spaCy model cannot be loaded
        """
        try:
            logger.info(f"Loading spaCy model: {model_name}")
            self.nlp = spacy.load(model_name)
            logger.info(f"Successfully loaded spaCy model: {model_name}")
        except OSError as e:
            error_msg = f"spaCy model '{model_name}' not found. Run: python -m spacy download {model_name}"
            logger.error(error_msg, exc_info=True)
            raise ModelLoadError(error_msg, model_name=model_name, original_error=str(e))

        # Deadline patterns - regex patterns for identifying deadline text
        self.deadline_patterns = [
            # Filing deadlines
            r'(?i)(?:must|shall|required to)\s+(?:file|submit)\s+(?:.*?)\s+(?:within|by|no later than|on or before)\s+([^.]+)',
            r'(?i)(?:file|submit)\s+(?:.*?)\s+(?:within|by|no later than|on or before)\s+([^.]+)',

            # Response deadlines
            r'(?i)(?:must|shall)\s+respond\s+(?:to\s+)?(?:.*?)\s+(?:within|by|no later than|on or before)\s+([^.]+)',
            r'(?i)(?:respond|reply|answer)\s+(?:within|by|no later than|on or before)\s+([^.]+)',
            r'(?i)(?:response|reply|answer)\s+(?:is\s+)?due\s+(?:within|by|no later than|on or before)?\s*([^.]+)',

            # Hearing dates
            r'(?i)hearing\s+(?:is\s+)?(?:set|scheduled)\s+(?:for|on)\s+([^.]+)',
            r'(?i)(?:appear|attend)\s+(?:at\s+)?(?:a\s+)?hearing\s+on\s+([^.]+)',

            # Discovery deadlines
            r'(?i)(?:shall\s+)?(?:serve|provide|produce)\s+(?:all\s+)?(?:discovery|documents|interrogatories)\s+(?:responses?\s+)?(?:within|by|no later than)\s+([^.]+)',
            r'(?i)discovery\s+(?:must\s+)?(?:be\s+)?(?:completed|served|provided)\s+(?:within|by|no later than)\s+([^.]+)',

            # Generic deadline patterns
            r'(?i)deadline\s+(?:is|of)\s+([^.]+)',
            r'(?i)due\s+(?:date|by|on)\s+([^.]+)',
        ]

        # Action verb patterns to identify responsible party
        self.self_action_verbs = [
            'file', 'submit', 'respond', 'reply', 'answer', 'appear', 'attend',
            'serve', 'provide', 'produce', 'complete', 'pay'
        ]

        self.attorney_action_verbs = [
            'attorney shall', 'counsel shall', 'lawyer shall'
        ]

        # Deadline type keywords
        self.type_keywords = {
            'filing': ['file', 'submit', 'filing'],
            'hearing': ['hearing', 'appear', 'attend', 'trial', 'conference'],
            'response': ['respond', 'reply', 'answer', 'opposition'],
            'discovery': ['discovery', 'interrogatories', 'documents', 'produce', 'serve'],
        }

    @track_performance()
    def extract_deadlines(self, text: str, page_number: Optional[int] = None) -> List[ExtractedDeadline]:
        """
        Extract all deadlines from text

        Args:
            text: Document text to analyze
            page_number: Optional page number for context

        Returns:
            List of extracted deadlines

        Raises:
            DeadlineExtractionError: If extraction completely fails
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for deadline extraction")
            return []

        deadlines = []

        try:
            logger.info(f"Extracting deadlines from {len(text)} characters", extra={'text_length': len(text)})

            # Process text with spaCy for NER
            try:
                doc = self.nlp(text)
            except Exception as e:
                raise DeadlineExtractionError(
                    f"Failed to process text with spaCy: {str(e)}",
                    text_snippet=text[:200]
                )

            # Find all sentences that match deadline patterns
            sentence_count = 0
            for sent in doc.sents:
                sentence_count += 1
                sent_text = sent.text

                for pattern in self.deadline_patterns:
                    matches = re.finditer(pattern, sent_text)

                    for match in matches:
                        try:
                            # Extract the date portion
                            date_text = match.group(1).strip()

                            # Try to parse the date
                            deadline_date = self._parse_date(date_text, sent_text)

                            if deadline_date:
                                # Extract action required
                                action = self._extract_action(sent_text)

                                # Determine responsible party
                                responsible_party = self._determine_responsible_party(sent_text)

                                # Determine deadline type
                                deadline_type = self._determine_deadline_type(sent_text)

                                # Calculate confidence score
                                confidence = self._calculate_confidence(
                                    sent_text, date_text, deadline_date
                                )

                                deadline = ExtractedDeadline(
                                    deadline_date=deadline_date,
                                    action_required=action,
                                    responsible_party=responsible_party,
                                    deadline_type=deadline_type,
                                    source_text=sent_text.strip(),
                                    confidence=confidence,
                                    page_number=page_number
                                )

                                deadlines.append(deadline)
                                logger.debug(
                                    f"Extracted deadline: {deadline.deadline_date.date()} - {deadline.action_required}",
                                    extra={
                                        'deadline_date': deadline.deadline_date.isoformat(),
                                        'confidence': deadline.confidence,
                                        'page_number': page_number
                                    }
                                )

                        except Exception as e:
                            logger.warning(
                                f"Failed to parse deadline from sentence: {str(e)}",
                                extra={'sentence': sent_text[:100], 'error': str(e)}
                            )
                            continue

            # Deduplicate similar deadlines
            original_count = len(deadlines)
            deadlines = self._deduplicate_deadlines(deadlines)

            logger.info(
                f"Extracted {len(deadlines)} deadlines from {sentence_count} sentences "
                f"({original_count - len(deadlines)} duplicates removed)",
                extra={
                    'deadline_count': len(deadlines),
                    'sentence_count': sentence_count,
                    'duplicates_removed': original_count - len(deadlines)
                }
            )

            return deadlines

        except DeadlineExtractionError:
            raise
        except Exception as e:
            logger.error(
                f"Unexpected error during deadline extraction: {str(e)}",
                exc_info=True,
                extra={'text_length': len(text)}
            )
            raise DeadlineExtractionError(
                f"Failed to extract deadlines: {str(e)}",
                text_snippet=text[:200],
                error_type=type(e).__name__
            )

    def _parse_date(self, date_text: str, context: str) -> Optional[datetime]:
        """
        Parse date from text, handling various formats and relative dates

        Args:
            date_text: Text containing the date
            context: Full sentence context

        Returns:
            Parsed datetime or None
        """
        # Clean the date text
        date_text = date_text.strip('.,;:')

        # Try to parse absolute dates first
        try:
            parsed_date = date_parser.parse(date_text, fuzzy=True)
            return parsed_date
        except (ValueError, TypeError):
            pass

        # Handle relative dates like "within 30 days", "14 days from"
        relative_patterns = [
            r'within\s+(\d+)\s+(day|week|month|year)s?',
            r'(\d+)\s+(day|week|month|year)s?\s+(?:from|after)',
        ]

        for pattern in relative_patterns:
            match = re.search(pattern, date_text, re.IGNORECASE)
            if match:
                quantity = int(match.group(1))
                unit = match.group(2).lower()

                # Calculate from today
                base_date = datetime.now()

                if unit == 'day':
                    return self._add_business_days(base_date, quantity)
                elif unit == 'week':
                    return base_date + timedelta(weeks=quantity)
                elif unit == 'month':
                    return base_date + relativedelta(months=quantity)
                elif unit == 'year':
                    return base_date + relativedelta(years=quantity)

        # Handle "next [day of week]"
        next_day_match = re.search(r'next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)',
                                   date_text, re.IGNORECASE)
        if next_day_match:
            target_day = next_day_match.group(1).lower()
            return self._get_next_weekday(target_day)

        return None

    def _add_business_days(self, start_date: datetime, days: int) -> datetime:
        """
        Add business days to a date (excluding weekends)

        Args:
            start_date: Starting date
            days: Number of business days to add

        Returns:
            New date after adding business days
        """
        current_date = start_date
        days_added = 0

        while days_added < days:
            current_date += timedelta(days=1)
            # Skip weekends (Saturday=5, Sunday=6)
            if current_date.weekday() < 5:
                days_added += 1

        return current_date

    def _get_next_weekday(self, day_name: str) -> datetime:
        """
        Get the next occurrence of a specific weekday

        Args:
            day_name: Name of the day (e.g., 'monday')

        Returns:
            Datetime of next occurrence
        """
        days_of_week = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }

        target_day = days_of_week.get(day_name.lower())
        if target_day is None:
            return datetime.now()

        today = datetime.now()
        current_day = today.weekday()

        days_ahead = target_day - current_day
        if days_ahead <= 0:
            days_ahead += 7

        return today + timedelta(days=days_ahead)

    def _extract_action(self, text: str) -> str:
        """
        Extract the action required from deadline text

        Args:
            text: Sentence containing deadline

        Returns:
            Action description
        """
        # Clean and truncate text
        text = text.strip()

        # Look for action verbs
        doc = self.nlp(text)

        # Try to find verb phrases
        action_phrases = []
        for token in doc:
            if token.pos_ == 'VERB':
                # Get the verb and its direct objects
                phrase = token.text
                for child in token.children:
                    if child.dep_ in ('dobj', 'prep', 'pobj'):
                        phrase += ' ' + child.text
                action_phrases.append(phrase)

        if action_phrases:
            return action_phrases[0].capitalize()

        # Fallback: return first 100 chars
        return text[:100]

    def _determine_responsible_party(self, text: str) -> str:
        """
        Determine who is responsible for the action

        Args:
            text: Sentence text

        Returns:
            'self', 'attorney', 'opposing_party', or 'unknown'
        """
        text_lower = text.lower()

        # Check for attorney mentions
        if any(phrase in text_lower for phrase in ['attorney shall', 'counsel shall', 'lawyer shall']):
            return 'attorney'

        # Check for opposing party mentions
        if any(phrase in text_lower for phrase in ['defendant shall', 'plaintiff shall', 'opposing']):
            return 'opposing_party'

        # Check for self action verbs
        if any(verb in text_lower for verb in self.self_action_verbs):
            # If no other party mentioned, assume self
            return 'self'

        return 'unknown'

    def _determine_deadline_type(self, text: str) -> str:
        """
        Determine the type of deadline

        Args:
            text: Sentence text

        Returns:
            'filing', 'hearing', 'response', or 'discovery'
        """
        text_lower = text.lower()

        # Check each type's keywords
        for deadline_type, keywords in self.type_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                return deadline_type

        return 'filing'  # Default

    def _calculate_confidence(self, text: str, date_text: str, parsed_date: datetime) -> float:
        """
        Calculate confidence score for extracted deadline

        Args:
            text: Full sentence
            date_text: Extracted date text
            parsed_date: Parsed date object

        Returns:
            Confidence score 0.0-1.0
        """
        score = 0.0

        # Base confidence from pattern match
        score += 0.3

        # Boost if date is in future
        if parsed_date > datetime.now():
            score += 0.2
        else:
            score -= 0.1

        # Boost if date text is clear (not too long)
        if len(date_text) < 50:
            score += 0.2

        # Boost if deadline keywords present
        deadline_keywords = ['must', 'shall', 'required', 'deadline', 'due']
        if any(keyword in text.lower() for keyword in deadline_keywords):
            score += 0.2

        # Boost if specific date format (MM/DD/YYYY or Month DD, YYYY)
        if re.search(r'\d{1,2}/\d{1,2}/\d{4}', date_text) or \
           re.search(r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}',
                    date_text, re.IGNORECASE):
            score += 0.1

        # Cap at 1.0
        return min(score, 1.0)

    def _deduplicate_deadlines(self, deadlines: List[ExtractedDeadline]) -> List[ExtractedDeadline]:
        """
        Remove duplicate or very similar deadlines

        Args:
            deadlines: List of extracted deadlines

        Returns:
            Deduplicated list
        """
        if not deadlines:
            return []

        unique = []
        for deadline in deadlines:
            # Check if very similar deadline already exists
            is_duplicate = False
            for existing in unique:
                # Same date and similar action
                if (deadline.deadline_date.date() == existing.deadline_date.date() and
                    deadline.deadline_type == existing.deadline_type):
                    # Keep the one with higher confidence
                    if deadline.confidence > existing.confidence:
                        unique.remove(existing)
                        unique.append(deadline)
                    is_duplicate = True
                    break

            if not is_duplicate:
                unique.append(deadline)

        # Sort by date
        unique.sort(key=lambda d: d.deadline_date)

        return unique


def extract_deadlines_from_document(text: str) -> List[ExtractedDeadline]:
    """
    Convenience function to extract deadlines from document text

    Args:
        text: Document text

    Returns:
        List of extracted deadlines
    """
    extractor = DeadlineExtractor()
    return extractor.extract_deadlines(text)


if __name__ == "__main__":
    # Test the extractor
    import sys

    if len(sys.argv) < 2:
        print("Usage: python deadline_extractor.py <path-to-text-file>")
        print("\nExample:")
        print("  python deadline_extractor.py ~/Documents/court_order.txt")
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        with open(file_path, 'r') as f:
            text = f.read()

        print(f"\n{'='*70}")
        print(f"Deadline Extraction Results")
        print(f"{'='*70}")

        deadlines = extract_deadlines_from_document(text)

        if not deadlines:
            print("\n⚠️  No deadlines found in document")
        else:
            print(f"\n✅ Found {len(deadlines)} deadline(s):\n")
            for i, deadline in enumerate(deadlines, 1):
                print(f"[{i}] {deadline.deadline_type.upper()} - {deadline.deadline_date.strftime('%B %d, %Y')}")
                print(f"    Action: {deadline.action_required}")
                print(f"    Responsible: {deadline.responsible_party}")
                print(f"    Confidence: {deadline.confidence:.2f}")
                print(f"    Source: {deadline.source_text[:80]}...")
                print()

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
