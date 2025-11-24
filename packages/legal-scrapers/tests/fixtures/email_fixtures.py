"""
Email-related test fixtures for Legal Advocate AI
"""

import pytest
from datetime import datetime, timedelta
from typing import List, Dict
from faker import Faker

fake = Faker()


@pytest.fixture
def sample_attorney_email():
    """Generate a sample attorney email"""
    return {
        "id": "email_001",
        "thread_id": "thread_001",
        "subject": "Case Files Needed - Johnson v. Smith",
        "from": "sarah.attorney@smithlaw.com",
        "from_name": "Sarah Attorney",
        "to": ["paralegal@smithlaw.com"],
        "cc": [],
        "bcc": [],
        "date": datetime.now(),
        "body": """Hi Team,

I need you to prepare the following for the Johnson case hearing on Monday:

1. Motion to compel discovery
2. Supporting memorandum
3. Exhibits showing communication timeline
4. Client declaration

Please have these ready by Friday EOD. This is urgent as the hearing is Monday morning.

Also, can you send me the deposition transcript from last week?

Thanks,
Sarah
""",
        "attachments": [],
        "labels": ["IMPORTANT", "CLIENT"],
        "is_read": False,
        "is_starred": True
    }


@pytest.fixture
def urgent_request_email():
    """Email with urgent deadline request"""
    return {
        "id": "email_urgent_001",
        "subject": "URGENT: Motion Due Tomorrow",
        "from": "john.attorney@lawfirm.com",
        "from_name": "John Attorney",
        "to": ["paralegal@lawfirm.com"],
        "date": datetime.now() - timedelta(hours=2),
        "body": """Need the motion to dismiss filed by tomorrow 5pm ASAP!

This is critical - opposing counsel deadline is Friday and we need to respond.

Please expedite.
""",
        "attachments": [
            {"filename": "draft_motion.pdf", "size": 245000}
        ]
    }


@pytest.fixture
def routine_request_email():
    """Email with routine, non-urgent request"""
    return {
        "id": "email_routine_001",
        "subject": "Case File Review",
        "from": "mary.attorney@legal.com",
        "from_name": "Mary Attorney",
        "to": ["assistant@legal.com"],
        "date": datetime.now() - timedelta(days=1),
        "body": """When you have a chance, please review the Smith case file and provide a summary.

No rush on this - next week is fine.

Thanks!
""",
        "attachments": []
    }


@pytest.fixture
def multi_request_email():
    """Email containing multiple different requests"""
    return {
        "id": "email_multi_001",
        "subject": "Multiple Action Items",
        "from": "partner@biglaw.com",
        "from_name": "Senior Partner",
        "to": ["paralegal@biglaw.com"],
        "date": datetime.now(),
        "body": """Please handle the following:

1. File the amended complaint by Wednesday
2. Send discovery responses to opposing counsel
3. Schedule deposition of key witness for next month
4. Research case law on hearsay exceptions
5. Draft memo on settlement options

Let me know if you have questions.
"""
    }


@pytest.fixture
def email_with_deadlines():
    """Email containing specific deadline dates"""
    tomorrow = datetime.now() + timedelta(days=1)
    next_week = datetime.now() + timedelta(days=7)

    return {
        "id": "email_deadline_001",
        "subject": "Upcoming Deadlines",
        "from": "attorney@law.com",
        "from_name": "Attorney",
        "date": datetime.now(),
        "body": f"""Important deadlines:

- Motion to compel due {tomorrow.strftime('%B %d, %Y')}
- Discovery responses due {next_week.strftime('%B %d, %Y')}
- Pre-trial conference on February 15, 2025

Please calendar these and send reminders.
"""
    }


@pytest.fixture
def email_thread_conversation():
    """Generate an email thread with multiple messages"""
    base_time = datetime.now() - timedelta(days=2)

    return [
        {
            "id": "thread_msg_001",
            "thread_id": "conversation_001",
            "subject": "Discovery Issues",
            "from": "attorney1@law.com",
            "from_name": "Attorney One",
            "to": ["attorney2@law.com"],
            "date": base_time,
            "body": "We need to address the discovery deficiencies. Can you prepare a motion to compel?"
        },
        {
            "id": "thread_msg_002",
            "thread_id": "conversation_001",
            "subject": "Re: Discovery Issues",
            "from": "attorney2@law.com",
            "from_name": "Attorney Two",
            "to": ["attorney1@law.com"],
            "date": base_time + timedelta(hours=3),
            "body": "Yes, I'll draft it today. When do you need it filed?"
        },
        {
            "id": "thread_msg_003",
            "thread_id": "conversation_001",
            "subject": "Re: Discovery Issues",
            "from": "attorney1@law.com",
            "from_name": "Attorney One",
            "to": ["attorney2@law.com"],
            "date": base_time + timedelta(hours=5),
            "body": "Please file by end of week. Also attach the exhibits showing non-compliance."
        }
    ]


@pytest.fixture
def email_with_attachments():
    """Email with various attachment types"""
    return {
        "id": "email_attach_001",
        "subject": "Case Documents",
        "from": "lawyer@firm.com",
        "from_name": "Lawyer",
        "date": datetime.now(),
        "body": "Attached are the case documents we discussed.",
        "attachments": [
            {"filename": "complaint.pdf", "size": 350000, "mime_type": "application/pdf"},
            {"filename": "evidence_photo.jpg", "size": 1200000, "mime_type": "image/jpeg"},
            {"filename": "witness_list.docx", "size": 45000, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            {"filename": "timeline.xlsx", "size": 78000, "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
        ]
    }


@pytest.fixture
def spam_or_irrelevant_email():
    """Email that should be filtered out (not a request)"""
    return {
        "id": "email_spam_001",
        "subject": "Office Party Next Week!",
        "from": "admin@firm.com",
        "from_name": "Office Manager",
        "date": datetime.now(),
        "body": """Hi everyone!

Join us for the annual office party next Friday at 5pm.

There will be food, drinks, and door prizes!

RSVP by Wednesday.

Cheers!
"""
    }


@pytest.fixture
def email_with_signature():
    """Email with typical attorney signature block"""
    return {
        "id": "email_sig_001",
        "subject": "Document Request",
        "from": "attorney@lawoffice.com",
        "from_name": "Attorney Name",
        "date": datetime.now(),
        "body": """Please send me the case files.

Best regards,

Jane Attorney, Esq.
Smith & Associates
123 Legal Street
Los Angeles, CA 90001
Phone: (555) 123-4567
Fax: (555) 123-4568
Email: jane@smithlaw.com
Bar No. CA123456

CONFIDENTIALITY NOTICE: This email may contain privileged and confidential information.
"""
    }


@pytest.fixture
def gmail_api_response():
    """Mock Gmail API response structure"""
    return {
        "messages": [
            {
                "id": "msg_12345",
                "threadId": "thread_12345"
            },
            {
                "id": "msg_12346",
                "threadId": "thread_12345"
            }
        ],
        "nextPageToken": "next_page_token_xyz",
        "resultSizeEstimate": 42
    }


@pytest.fixture
def gmail_message_detail():
    """Mock detailed Gmail message response"""
    return {
        "id": "msg_12345",
        "threadId": "thread_12345",
        "labelIds": ["INBOX", "IMPORTANT"],
        "snippet": "Please send the case files by Friday...",
        "internalDate": "1706745600000",
        "payload": {
            "headers": [
                {"name": "From", "value": "Sarah Attorney <sarah@smithlaw.com>"},
                {"name": "To", "value": "paralegal@smithlaw.com"},
                {"name": "Subject", "value": "Case Files Needed"},
                {"name": "Date", "value": "Wed, 31 Jan 2025 10:00:00 -0800"}
            ],
            "body": {
                "data": "UGxlYXNlIHNlbmQgdGhlIGNhc2UgZmlsZXMgYnkgRnJpZGF5Lg=="  # Base64 encoded
            }
        }
    }


@pytest.fixture
def batch_attorney_emails():
    """Generate a batch of varied attorney emails for testing"""
    emails = []

    # Urgent request
    emails.append({
        "subject": "URGENT: File Motion Today",
        "from_name": "Partner Attorney",
        "body": "Need the motion filed by 5pm today - critical deadline!",
        "urgency": "critical"
    })

    # Document request
    emails.append({
        "subject": "Discovery Documents",
        "from_name": "Associate Attorney",
        "body": "Please send all discovery documents from the Johnson case.",
        "urgency": "medium"
    })

    # Meeting request
    emails.append({
        "subject": "Client Meeting Tomorrow",
        "from_name": "Senior Partner",
        "body": "Schedule client meeting for tomorrow 2pm to discuss settlement.",
        "urgency": "high"
    })

    # Research request
    emails.append({
        "subject": "Legal Research Needed",
        "from_name": "Junior Attorney",
        "body": "Research case law on qualified immunity in Section 1983 cases.",
        "urgency": "low"
    })

    # Status update request
    emails.append({
        "subject": "Case Status",
        "from_name": "Managing Partner",
        "body": "Provide status update on all active cases by end of week.",
        "urgency": "medium"
    })

    return emails


@pytest.fixture
def email_generator():
    """Factory fixture for generating custom emails"""
    def _generate_email(
        subject: str = None,
        from_name: str = None,
        body: str = None,
        urgency: str = "medium",
        has_deadline: bool = False,
        attachment_count: int = 0
    ):
        email = {
            "id": fake.uuid4(),
            "thread_id": fake.uuid4(),
            "subject": subject or fake.sentence(),
            "from": fake.email(),
            "from_name": from_name or fake.name(),
            "to": [fake.email()],
            "date": datetime.now() - timedelta(hours=fake.random_int(0, 48)),
            "body": body or fake.paragraph(nb_sentences=5)
        }

        if has_deadline:
            deadline_date = datetime.now() + timedelta(days=fake.random_int(1, 14))
            email["body"] += f"\n\nDeadline: {deadline_date.strftime('%B %d, %Y')}"

        if attachment_count > 0:
            email["attachments"] = [
                {
                    "filename": f"{fake.word()}.pdf",
                    "size": fake.random_int(10000, 500000)
                }
                for _ in range(attachment_count)
            ]

        return email

    return _generate_email
