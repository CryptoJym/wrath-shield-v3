#!/usr/bin/env python3
"""Load James Brady's CURRENT case data (October 2025)"""
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from models.database import init_db, get_session
from repositories.case_repository import CaseRepository
from repositories.deadline_repository import DeadlineRepository
from repositories.request_repository import RequestRepository

# Initialize database
init_db()
session = get_session()

# Create repositories
case_repo = CaseRepository(session)
deadline_repo = DeadlineRepository(session)
request_repo = RequestRepository(session)

try:
    print("=" * 60)
    print("LOADING JAMES BRADY CASE - OCTOBER 2025")
    print("=" * 60)

    # Get or create case
    print("\n1. Getting or creating James Brady custody case...")
    case = case_repo.create_or_update(
        case_number="Brady-v-Hyte-2025",
        user_id="james_brady",
        case_title="Brady v. Hyte - Custody Dispute",
        case_type="Family Law",
        notes="Custody dispute with Destiny Hyte. Opposing potential relocation.",
        status="active"
    )
    print(f"   ✓ Case: {case.id}")
    print(f"   ✓ Case number: {case.case_number}")

    # Load Zack's current email
    print("\n2. Loading Zack Starr's current email (Oct 3, 2025)...")
    zack_email = json.load(open('zack_emails_current.json'))[0]

    # Create request from Zack's email
    print("\n3. Creating attorney request...")
    what_is_needed = """Detailed school schedule and program information for Hyro to oppose relocation.

SPECIFIC INFORMATION NEEDED:
1. Hyro's complete weekly schedule (all 7 days)
2. Confirm campus vs remote (which days on campus?)
3. List all current classes and programs
4. Confirm semester system dates (start/end)

PURPOSE: Build case that relocation would be disruptive and not in best interests.

ALREADY PROVIDED:
- School: Canyon Grove South Jordan (Epic Program hybrid)
- Frequency: Twice weekly on campus
- STEM class Tuesdays at 8:30 AM
- James drives him

STILL NEEDED:
- Complete weekly schedule
- Full class/program list
- Semester start/end dates
- Evidence of stability/routine
"""

    source_text = f"""From: {zack_email['from']}
Date: {zack_email['timestamp']}
Subject: {zack_email['subject']}

{zack_email['snippet']}

Full email: {zack_email['body'][:500]}..."""

    request = request_repo.create(
        user_id="james_brady",
        case_number=case.case_number,
        request_type="information",
        what_is_needed=what_is_needed,
        requested_by=zack_email['from'],
        requested_date=datetime.fromisoformat(zack_email['timestamp']),
        source_email_id=zack_email['id'],
        source_text=source_text,
        urgency="high"
    )
    print(f"   ✓ Request created: {request.id}")
    print(f"   ✓ Type: {request.request_type}")
    print(f"   ✓ Urgency: {request.urgency}")

    # Create deadline
    print("\n4. Creating response deadline...")
    email_date = datetime.fromisoformat(zack_email['timestamp'])

    # Deadline is October 7 (4 days from Oct 3 email) - this Monday
    deadline_datetime = email_date + timedelta(days=4)

    deadline = deadline_repo.create(
        user_id="james_brady",
        case_number=case.case_number,
        deadline_type="response",
        deadline_date=deadline_datetime,
        action_required="Provide Hyro's complete school schedule, classes/programs list, and semester dates to Zack Starr",
        responsible_party="self",
        source_document=f"Email from {zack_email['from']}",
        source_text=zack_email['snippet'],
        extraction_confidence=1.0,
        status="pending"
    )
    print(f"   ✓ Deadline created: {deadline_datetime.date()}")
    print(f"   ✓ Action: {deadline.action_required[:60]}...")

    # Commit all changes
    session.commit()

    print("\n" + "=" * 60)
    print("✅ CASE LOADED SUCCESSFULLY")
    print("=" * 60)
    print(f"\nZack's Request (Oct 3, 2025):")
    print(f"  Subject: {zack_email['subject']}")
    print(f"  Snippet: {zack_email['snippet']}")
    print(f"\nDeadline: {deadline_datetime.date()}")
    print(f"Status: James needs to respond with school schedule details")
    print(f"\nAccess dashboard at: http://localhost:8501")
    print("=" * 60)

except Exception as e:
    session.rollback()
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

finally:
    session.close()
