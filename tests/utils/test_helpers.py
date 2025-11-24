"""
Test utility functions and helpers
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path
import json
import tempfile


def create_temp_json_file(data: Dict, filename: str = "test_data.json") -> Path:
    """
    Create a temporary JSON file for testing

    Args:
        data: Dictionary to save as JSON
        filename: Name for the temp file

    Returns:
        Path to created temp file
    """
    temp_dir = Path(tempfile.mkdtemp())
    file_path = temp_dir / filename

    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

    return file_path


def assert_datetime_close(
    dt1: datetime,
    dt2: datetime,
    delta_seconds: int = 60
) -> bool:
    """
    Assert that two datetime objects are close to each other

    Args:
        dt1: First datetime
        dt2: Second datetime
        delta_seconds: Maximum allowed difference in seconds

    Returns:
        True if datetimes are within delta, False otherwise
    """
    diff = abs((dt1 - dt2).total_seconds())
    return diff <= delta_seconds


def assert_dict_contains(subset: Dict, superset: Dict) -> bool:
    """
    Assert that all keys/values in subset are in superset

    Args:
        subset: Expected subset of data
        superset: Larger dictionary to check

    Returns:
        True if all subset items are in superset
    """
    for key, value in subset.items():
        if key not in superset:
            return False
        if superset[key] != value:
            return False
    return True


def assert_request_valid(request: Dict) -> bool:
    """
    Assert that a detected request has all required fields

    Args:
        request: Request dictionary to validate

    Returns:
        True if request is valid
    """
    required_fields = [
        'what_is_needed',
        'requested_by',
        'requested_date',
        'urgency_level',
        'request_type',
        'confidence_score'
    ]

    for field in required_fields:
        if field not in request:
            return False

    # Validate types
    if not isinstance(request['confidence_score'], (int, float)):
        return False
    if not 0 <= request['confidence_score'] <= 1:
        return False

    return True


def assert_deadline_valid(deadline: Dict) -> bool:
    """
    Assert that a deadline has all required fields

    Args:
        deadline: Deadline dictionary to validate

    Returns:
        True if deadline is valid
    """
    required_fields = ['deadline_date', 'description']

    for field in required_fields:
        if field not in deadline:
            return False

    # Validate deadline date is in the future (or recent past for testing)
    if isinstance(deadline['deadline_date'], datetime):
        # Allow deadlines up to 1 year in the past for testing historical data
        min_date = datetime.now() - timedelta(days=365)
        if deadline['deadline_date'] < min_date:
            return False

    return True


def create_mock_email_batch(
    count: int,
    urgency_distribution: Dict[str, float] = None
) -> List[Dict]:
    """
    Create a batch of mock emails for testing

    Args:
        count: Number of emails to create
        urgency_distribution: Distribution of urgency levels
            e.g., {'critical': 0.2, 'high': 0.3, 'medium': 0.3, 'low': 0.2}

    Returns:
        List of mock email dictionaries
    """
    if urgency_distribution is None:
        urgency_distribution = {
            'critical': 0.1,
            'high': 0.3,
            'medium': 0.4,
            'low': 0.2
        }

    emails = []
    urgency_levels = list(urgency_distribution.keys())
    weights = list(urgency_distribution.values())

    import random

    for i in range(count):
        urgency = random.choices(urgency_levels, weights=weights)[0]

        email = {
            'id': f'email_{i+1:04d}',
            'subject': f'Test Email {i+1}',
            'from': f'attorney{i+1}@lawfirm.com',
            'from_name': f'Attorney {i+1}',
            'date': datetime.now() - timedelta(hours=random.randint(0, 48)),
            'body': _generate_email_body(urgency),
            'urgency': urgency
        }
        emails.append(email)

    return emails


def _generate_email_body(urgency: str) -> str:
    """Generate email body based on urgency level"""
    bodies = {
        'critical': "URGENT: Please file the motion by end of day today!",
        'high': "Please send the documents by Friday. This is important.",
        'medium': "When you get a chance, please prepare the brief.",
        'low': "No rush, but please send me the case files when convenient."
    }
    return bodies.get(urgency, bodies['medium'])


def extract_dates_from_text(text: str) -> List[datetime]:
    """
    Extract all date references from text (helper for testing)

    Args:
        text: Text to extract dates from

    Returns:
        List of extracted datetime objects
    """
    # Simple implementation for testing
    # In production, would use deadline_extractor
    import re
    from dateutil import parser

    dates = []
    date_patterns = [
        r'\d{1,2}/\d{1,2}/\d{4}',  # MM/DD/YYYY
        r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
    ]

    for pattern in date_patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            try:
                date = parser.parse(match.group())
                dates.append(date)
            except:
                continue

    return dates


def compare_requests(req1: Dict, req2: Dict, ignore_fields: List[str] = None) -> bool:
    """
    Compare two request dictionaries, optionally ignoring certain fields

    Args:
        req1: First request
        req2: Second request
        ignore_fields: Fields to ignore in comparison

    Returns:
        True if requests are equivalent
    """
    ignore_fields = ignore_fields or ['confidence_score', 'requested_date']

    for key in req1:
        if key in ignore_fields:
            continue
        if key not in req2:
            return False
        if req1[key] != req2[key]:
            return False

    return True


def create_test_database(db_path: str = ":memory:") -> Any:
    """
    Create a test database with schema

    Args:
        db_path: Path to database (":memory:" for in-memory)

    Returns:
        Database connection
    """
    import sqlite3

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create test schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY,
            case_id TEXT,
            what_is_needed TEXT,
            requested_by TEXT,
            requested_date TEXT,
            urgency_level TEXT,
            deadline_date TEXT,
            status TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS deadlines (
            id INTEGER PRIMARY KEY,
            case_id TEXT,
            deadline_date TEXT,
            description TEXT,
            priority TEXT,
            status TEXT
        )
    """)

    conn.commit()
    return conn


def load_test_data(filename: str, test_data_dir: Optional[Path] = None) -> Dict:
    """
    Load test data from JSON file

    Args:
        filename: Name of test data file
        test_data_dir: Directory containing test data

    Returns:
        Loaded test data as dictionary
    """
    if test_data_dir is None:
        test_data_dir = Path(__file__).parent.parent / "data"

    file_path = test_data_dir / filename

    if not file_path.exists():
        raise FileNotFoundError(f"Test data file not found: {file_path}")

    with open(file_path, 'r') as f:
        return json.load(f)


def mock_api_response(
    data: Any,
    status_code: int = 200,
    headers: Dict = None
) -> Dict:
    """
    Create a mock API response structure

    Args:
        data: Response data
        status_code: HTTP status code
        headers: Response headers

    Returns:
        Mock response dictionary
    """
    return {
        'status_code': status_code,
        'headers': headers or {'Content-Type': 'application/json'},
        'data': data,
        'ok': 200 <= status_code < 300
    }


class EmailBatchProcessor:
    """Helper class for processing batches of emails in tests"""

    def __init__(self, detector=None):
        from extractors.request_detector import RequestDetector
        self.detector = detector or RequestDetector()
        self.results = []

    def process_batch(self, emails: List[Dict]) -> List[Dict]:
        """Process a batch of emails and return all requests"""
        all_requests = []

        for email in emails:
            requests = self.detector.detect_requests(
                email_text=email['body'],
                email_subject=email.get('subject', ''),
                sender_name=email.get('from_name', ''),
                timestamp=email.get('date', datetime.now())
            )

            for request in requests:
                request_dict = request.to_dict() if hasattr(request, 'to_dict') else request
                request_dict['email_id'] = email.get('id', '')
                all_requests.append(request_dict)

        self.results = all_requests
        return all_requests

    def get_by_urgency(self, urgency: str) -> List[Dict]:
        """Get all requests of a specific urgency level"""
        return [r for r in self.results if r.get('urgency_level') == urgency]

    def get_with_deadlines(self) -> List[Dict]:
        """Get all requests that have deadlines"""
        return [r for r in self.results if r.get('deadline')]

    def get_stats(self) -> Dict:
        """Get statistics about processed requests"""
        urgency_counts = {}
        type_counts = {}
        deadline_count = 0

        for request in self.results:
            # Count urgency levels
            urgency = request.get('urgency_level', 'unknown')
            urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1

            # Count request types
            req_type = request.get('request_type', 'unknown')
            type_counts[req_type] = type_counts.get(req_type, 0) + 1

            # Count deadlines
            if request.get('deadline'):
                deadline_count += 1

        return {
            'total_requests': len(self.results),
            'urgency_distribution': urgency_counts,
            'type_distribution': type_counts,
            'requests_with_deadlines': deadline_count,
            'deadline_percentage': (deadline_count / len(self.results) * 100)
                if self.results else 0
        }
