"""
Pytest configuration and shared fixtures for Legal Advocate AI tests
"""

import pytest
import os
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List
import json

# Import fixtures from subdirectories
pytest_plugins = [
    "tests.fixtures.email_fixtures",
    "tests.fixtures.pdf_fixtures",
    "tests.fixtures.case_fixtures",
]


@pytest.fixture(scope="session")
def test_data_dir():
    """Return path to test data directory"""
    return Path(__file__).parent / "data"


@pytest.fixture(scope="session")
def temp_dir():
    """Create and return temporary directory for test artifacts"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_timestamp():
    """Return a consistent timestamp for testing"""
    return datetime(2025, 1, 31, 10, 30, 0)


@pytest.fixture
def sample_attorney_info():
    """Return sample attorney information"""
    return {
        "name": "Sarah Attorney",
        "email": "sarah@smithlaw.com",
        "firm": "Smith & Associates",
        "bar_number": "CA123456",
        "phone": "555-1234"
    }


@pytest.fixture
def sample_case_info():
    """Return sample case information"""
    return {
        "case_id": "CASE-2025-001",
        "case_number": "CV-2025-12345",
        "case_title": "Johnson v. Smith Corp",
        "court": "Superior Court of California",
        "jurisdiction": "Los Angeles County",
        "filing_date": "2025-01-15",
        "case_type": "Civil - Personal Injury"
    }


@pytest.fixture
def sample_deadline():
    """Return sample deadline information"""
    return {
        "deadline_date": datetime(2025, 2, 15, 17, 0, 0),
        "description": "Response to Motion to Compel",
        "case_id": "CASE-2025-001",
        "priority": "high",
        "type": "filing"
    }


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Set up mock environment variables for testing"""
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test_anthropic_key")
    monkeypatch.setenv("GMAIL_CREDENTIALS", "credentials.json")
    monkeypatch.setenv("MYCASE_API_KEY", "test_mycase_key")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///test.db")


@pytest.fixture
def clean_test_db():
    """Provide a clean test database and clean up after test"""
    db_path = Path("test_legal_advocate.db")

    # Clean before test
    if db_path.exists():
        db_path.unlink()

    yield str(db_path)

    # Clean after test
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def sample_email_thread():
    """Return a sample email thread structure"""
    return [
        {
            "id": "msg_001",
            "subject": "Johnson Case - Motion Due Friday",
            "from": "sarah@smithlaw.com",
            "to": "paralegal@smithlaw.com",
            "date": "2025-01-29T10:00:00",
            "body": "Please prepare the response to the motion by Friday EOD.",
            "thread_id": "thread_001"
        },
        {
            "id": "msg_002",
            "subject": "Re: Johnson Case - Motion Due Friday",
            "from": "paralegal@smithlaw.com",
            "to": "sarah@smithlaw.com",
            "date": "2025-01-29T14:30:00",
            "body": "Working on it. Will have the draft ready by Thursday.",
            "thread_id": "thread_001"
        }
    ]


# Markers for categorizing tests
def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "unit: Unit tests for individual functions/classes"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests requiring multiple components"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests simulating real workflows"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take more than 1 second"
    )
    config.addinivalue_line(
        "markers", "gmail: Tests requiring Gmail API"
    )
    config.addinivalue_line(
        "markers", "mycase: Tests requiring MyCase API"
    )
    config.addinivalue_line(
        "markers", "pdf: Tests requiring PDF processing"
    )
    config.addinivalue_line(
        "markers", "database: Tests requiring database operations"
    )
    config.addinivalue_line(
        "markers", "ai: Tests requiring AI/LLM functionality"
    )


# Test collection hooks
def pytest_collection_modifyitems(config, items):
    """Modify test items during collection"""
    for item in items:
        # Auto-mark tests based on file location
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "unit" in str(item.fspath) or "test_" in str(item.fspath):
            item.add_marker(pytest.mark.unit)

        # Auto-mark based on test name patterns
        if "gmail" in item.nodeid.lower():
            item.add_marker(pytest.mark.gmail)
        if "mycase" in item.nodeid.lower():
            item.add_marker(pytest.mark.mycase)
        if "pdf" in item.nodeid.lower():
            item.add_marker(pytest.mark.pdf)
        if "database" in item.nodeid.lower() or "db" in item.nodeid.lower():
            item.add_marker(pytest.mark.database)
