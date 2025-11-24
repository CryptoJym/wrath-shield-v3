"""
Case and legal data fixtures for testing
"""

import pytest
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()


@pytest.fixture
def sample_case():
    """Generate a sample legal case"""
    return {
        "case_id": "CASE-2025-001",
        "case_number": "CV-2025-12345",
        "case_title": "Johnson v. Smith Corporation",
        "court": "Superior Court of California",
        "jurisdiction": "Los Angeles County",
        "department": "32",
        "filing_date": datetime(2025, 1, 15),
        "case_type": "Civil - Personal Injury",
        "status": "Active",
        "judge": "Hon. Jane Smith",
        "plaintiff_attorney": "John Doe, Esq.",
        "defendant_attorney": "Mary Attorney, Esq."
    }


@pytest.fixture
def sample_parties():
    """Generate sample case parties"""
    return [
        {
            "party_id": "PARTY-001",
            "name": "John Johnson",
            "party_type": "Plaintiff",
            "role": "Individual",
            "represented_by": "John Doe, Esq.",
            "address": "123 Main St, Los Angeles, CA 90001"
        },
        {
            "party_id": "PARTY-002",
            "name": "Smith Corporation",
            "party_type": "Defendant",
            "role": "Corporation",
            "represented_by": "Mary Attorney, Esq.",
            "address": "456 Corporate Blvd, Los Angeles, CA 90002"
        }
    ]


@pytest.fixture
def sample_deadlines():
    """Generate sample case deadlines"""
    base_date = datetime.now()

    return [
        {
            "deadline_id": "DL-001",
            "case_id": "CASE-2025-001",
            "deadline_date": base_date + timedelta(days=7),
            "description": "Opposition to Motion to Compel",
            "deadline_type": "filing",
            "priority": "high",
            "status": "pending",
            "responsible_attorney": "John Doe, Esq.",
            "notes": "Must respond to discovery motion"
        },
        {
            "deadline_id": "DL-002",
            "case_id": "CASE-2025-001",
            "deadline_date": base_date + timedelta(days=14),
            "description": "Reply Brief Filing",
            "deadline_type": "filing",
            "priority": "medium",
            "status": "pending",
            "responsible_attorney": "John Doe, Esq."
        },
        {
            "deadline_id": "DL-003",
            "case_id": "CASE-2025-001",
            "deadline_date": base_date + timedelta(days=30),
            "description": "Discovery Cutoff",
            "deadline_type": "discovery",
            "priority": "critical",
            "status": "pending",
            "responsible_attorney": "John Doe, Esq.",
            "notes": "All discovery must be completed"
        }
    ]


@pytest.fixture
def sample_docket_entries():
    """Generate sample docket entries"""
    return [
        {
            "entry_id": "DE-001",
            "case_id": "CASE-2025-001",
            "entry_date": datetime(2025, 1, 15),
            "entry_type": "Complaint",
            "filing_party": "Plaintiff",
            "description": "Complaint for Personal Injury",
            "document_id": "DOC-001"
        },
        {
            "entry_id": "DE-002",
            "case_id": "CASE-2025-001",
            "entry_date": datetime(2025, 1, 25),
            "entry_type": "Answer",
            "filing_party": "Defendant",
            "description": "Answer to Complaint",
            "document_id": "DOC-002"
        },
        {
            "entry_id": "DE-003",
            "case_id": "CASE-2025-001",
            "entry_date": datetime(2025, 1, 28),
            "entry_type": "Motion",
            "filing_party": "Plaintiff",
            "description": "Motion to Compel Discovery",
            "document_id": "DOC-003",
            "hearing_date": datetime(2025, 2, 15, 9, 0)
        }
    ]


@pytest.fixture
def sample_documents():
    """Generate sample case documents"""
    return [
        {
            "document_id": "DOC-001",
            "case_id": "CASE-2025-001",
            "title": "Complaint for Personal Injury",
            "document_type": "Complaint",
            "filing_date": datetime(2025, 1, 15),
            "filed_by": "John Doe, Esq.",
            "page_count": 25,
            "file_path": "/path/to/complaint.pdf"
        },
        {
            "document_id": "DOC-002",
            "case_id": "CASE-2025-001",
            "title": "Answer to Complaint",
            "document_type": "Answer",
            "filing_date": datetime(2025, 1, 25),
            "filed_by": "Mary Attorney, Esq.",
            "page_count": 18,
            "file_path": "/path/to/answer.pdf"
        },
        {
            "document_id": "DOC-003",
            "case_id": "CASE-2025-001",
            "title": "Motion to Compel Discovery",
            "document_type": "Motion",
            "filing_date": datetime(2025, 1, 28),
            "filed_by": "John Doe, Esq.",
            "page_count": 15,
            "file_path": "/path/to/motion.pdf"
        }
    ]


@pytest.fixture
def sample_discovery_items():
    """Generate sample discovery items"""
    return [
        {
            "discovery_id": "DISC-001",
            "case_id": "CASE-2025-001",
            "discovery_type": "Interrogatories",
            "set_number": 1,
            "propounding_party": "Defendant",
            "responding_party": "Plaintiff",
            "date_served": datetime(2025, 1, 20),
            "response_due": datetime(2025, 2, 19),
            "status": "pending",
            "total_requests": 35
        },
        {
            "discovery_id": "DISC-002",
            "case_id": "CASE-2025-001",
            "discovery_type": "Request for Production",
            "set_number": 1,
            "propounding_party": "Plaintiff",
            "responding_party": "Defendant",
            "date_served": datetime(2025, 1, 22),
            "response_due": datetime(2025, 2, 21),
            "status": "overdue",
            "total_requests": 50
        },
        {
            "discovery_id": "DISC-003",
            "case_id": "CASE-2025-001",
            "discovery_type": "Deposition",
            "deponent": "John Johnson",
            "noticing_party": "Defendant",
            "deposition_date": datetime(2025, 2, 10, 10, 0),
            "location": "Smith & Associates Law Office",
            "status": "scheduled"
        }
    ]


@pytest.fixture
def sample_hearings():
    """Generate sample hearing schedule"""
    return [
        {
            "hearing_id": "HEAR-001",
            "case_id": "CASE-2025-001",
            "hearing_date": datetime(2025, 2, 15, 9, 0),
            "hearing_type": "Motion Hearing",
            "department": "32",
            "judge": "Hon. Jane Smith",
            "subject": "Motion to Compel Discovery",
            "status": "scheduled",
            "estimated_duration": "30 minutes"
        },
        {
            "hearing_id": "HEAR-002",
            "case_id": "CASE-2025-001",
            "hearing_date": datetime(2025, 3, 1, 9, 0),
            "hearing_type": "Case Management Conference",
            "department": "32",
            "judge": "Hon. Jane Smith",
            "status": "scheduled",
            "estimated_duration": "15 minutes"
        },
        {
            "hearing_id": "HEAR-003",
            "case_id": "CASE-2025-001",
            "hearing_date": datetime(2025, 6, 1, 9, 0),
            "hearing_type": "Trial",
            "department": "32",
            "judge": "Hon. Jane Smith",
            "status": "scheduled",
            "estimated_duration": "5 days",
            "jury_trial": True
        }
    ]


@pytest.fixture
def sample_case_notes():
    """Generate sample case notes/updates"""
    return [
        {
            "note_id": "NOTE-001",
            "case_id": "CASE-2025-001",
            "date": datetime(2025, 1, 28, 14, 30),
            "created_by": "John Doe, Esq.",
            "note_type": "Strategy",
            "content": "Client agrees to settlement negotiations. Maximum authority: $150,000.",
            "is_confidential": True
        },
        {
            "note_id": "NOTE-002",
            "case_id": "CASE-2025-001",
            "date": datetime(2025, 1, 29, 10, 0),
            "created_by": "Paralegal",
            "note_type": "Task Completion",
            "content": "Completed draft of motion to compel. Sent to attorney for review.",
            "is_confidential": False
        }
    ]


@pytest.fixture
def complex_case_scenario():
    """Generate a complex case with multiple related items"""
    case = {
        "case_id": "CASE-COMPLEX-001",
        "case_number": "BC-2025-55555",
        "case_title": "Multi-Party Product Liability Action",
        "court": "Superior Court of California",
        "jurisdiction": "San Francisco County",
        "case_type": "Civil - Product Liability",
        "filing_date": datetime(2024, 6, 1),
        "status": "Active - Discovery",

        "parties": [
            {"name": "Jane Consumer", "type": "Plaintiff", "count": 1},
            {"name": "John Consumer", "type": "Plaintiff", "count": 2},
            {"name": "ABC Manufacturing", "type": "Defendant", "count": 1},
            {"name": "XYZ Distributors", "type": "Defendant", "count": 2},
            {"name": "123 Retailers", "type": "Cross-Defendant", "count": 1}
        ],

        "active_deadlines": [
            {"description": "Expert Witness Designation", "days_until": 30},
            {"description": "Discovery Cutoff", "days_until": 60},
            {"description": "Dispositive Motions", "days_until": 90}
        ],

        "pending_motions": [
            "Motion for Summary Judgment (Defendant ABC)",
            "Motion to Compel Further Responses (Plaintiff)",
            "Motion for Protective Order (Defendant XYZ)"
        ],

        "discovery_status": {
            "interrogatories": {"served": 3, "responded": 2, "pending": 1},
            "rfps": {"served": 5, "responded": 3, "pending": 2},
            "depositions": {"scheduled": 8, "completed": 3, "remaining": 5}
        }
    }

    return case


@pytest.fixture
def case_factory():
    """Factory for generating custom cases"""
    def _create_case(
        case_type: str = "Civil",
        num_parties: int = 2,
        num_deadlines: int = 3,
        status: str = "Active"
    ):
        case_id = f"CASE-{fake.uuid4()[:8].upper()}"

        parties = [
            {
                "name": fake.name(),
                "type": "Plaintiff" if i == 0 else "Defendant",
                "attorney": fake.name() + ", Esq."
            }
            for i in range(num_parties)
        ]

        deadlines = [
            {
                "deadline_id": f"DL-{i+1:03d}",
                "case_id": case_id,
                "deadline_date": datetime.now() + timedelta(days=fake.random_int(7, 90)),
                "description": fake.sentence(),
                "priority": fake.random_element(["low", "medium", "high", "critical"])
            }
            for i in range(num_deadlines)
        ]

        return {
            "case_id": case_id,
            "case_number": f"{fake.random_element(['CV', 'BC', 'SC'])}-{fake.year()}-{fake.random_int(10000, 99999)}",
            "case_title": f"{parties[0]['name']} v. {parties[1]['name']}",
            "case_type": case_type,
            "status": status,
            "filing_date": fake.date_between(start_date="-2y", end_date="today"),
            "parties": parties,
            "deadlines": deadlines,
            "court": f"Superior Court of {fake.state()}",
            "jurisdiction": f"{fake.city()} County"
        }

    return _create_case
