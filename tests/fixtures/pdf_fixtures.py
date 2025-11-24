"""
PDF-related test fixtures for Legal Advocate AI
"""

import pytest
from pathlib import Path
from datetime import datetime
from io import BytesIO
import base64


@pytest.fixture
def sample_court_order_text():
    """Sample court order text for testing"""
    return """
SUPERIOR COURT OF CALIFORNIA
COUNTY OF LOS ANGELES

JOHN JOHNSON,                    Case No. CV-2025-12345
    Plaintiff,
                                 ORDER GRANTING MOTION
v.                               TO COMPEL DISCOVERY

SMITH CORPORATION,
    Defendant.

The Court, having considered the Motion to Compel Discovery filed by Plaintiff,
and the opposition thereto, hereby ORDERS as follows:

1. Plaintiff's Motion to Compel Discovery is GRANTED.

2. Defendant shall provide complete responses to Plaintiff's Request for
   Production of Documents, Set One, within thirty (30) days of the date
   of this Order.

3. Defendant shall pay Plaintiff's reasonable attorney fees in the amount
   of $2,500.00 within thirty (30) days.

4. The deadline for completion of discovery is extended to March 15, 2025.

IT IS SO ORDERED.

Dated: January 31, 2025


                              _________________________
                              HON. JANE SMITH
                              Judge of the Superior Court
"""


@pytest.fixture
def sample_motion_text():
    """Sample motion document text"""
    return """
JOHN DOE, ESQ. (Bar No. CA123456)
DOE & ASSOCIATES
123 Legal Street
Los Angeles, CA 90001
Telephone: (555) 123-4567
Email: john@doelaw.com

Attorney for Plaintiff

SUPERIOR COURT OF CALIFORNIA
COUNTY OF LOS ANGELES


MARY PLAINTIFF,              Case No. BC-2025-67890

    Plaintiff,               MOTION TO DISMISS
                            FOR FAILURE TO STATE A CLAIM
v.
                            Date: February 15, 2025
BOB DEFENDANT,              Time: 9:00 a.m.
                            Dept: 32
    Defendant.


NOTICE OF MOTION AND MOTION

TO ALL PARTIES AND THEIR ATTORNEYS OF RECORD:

PLEASE TAKE NOTICE that on February 15, 2025, at 9:00 a.m., or as soon
thereafter as the matter may be heard, in Department 32 of the above-entitled
court, Plaintiff will move to dismiss this action for failure to state a claim
upon which relief can be granted.

This motion is made pursuant to Code of Civil Procedure section 430.10(e) and
is based on this Notice of Motion, the accompanying Memorandum of Points and
Authorities, and the entire record in this case.

Dated: January 20, 2025

                                    DOE & ASSOCIATES


                                    By: _________________________
                                        JOHN DOE
                                        Attorney for Plaintiff
"""


@pytest.fixture
def sample_discovery_response_text():
    """Sample discovery response document"""
    return """
DISCOVERY RESPONSES

Case: Johnson v. Smith Corp (Case No. CV-2025-12345)

PLAINTIFF'S RESPONSES TO DEFENDANT'S
FORM INTERROGATORIES, SET ONE

Responding Party: John Johnson (Plaintiff)
Propounding Party: Smith Corporation (Defendant)
Response Date: February 1, 2025

INTERROGATORY NO. 1:
State your full name, current address, and all addresses where you have
lived for the past five years.

RESPONSE TO INTERROGATORY NO. 1:
Name: John Johnson
Current Address: 456 Main Street, Los Angeles, CA 90002

Previous addresses:
- 789 Oak Avenue, Pasadena, CA 91101 (2021-2023)
- 321 Pine Street, Glendale, CA 91201 (2020-2021)

INTERROGATORY NO. 2:
Describe in detail all injuries you claim to have suffered as a result
of the INCIDENT.

RESPONSE TO INTERROGATORY NO. 2:
Plaintiff objects to this interrogatory on the grounds that it is vague
and ambiguous as to the term "INCIDENT." Without waiving said objection,
Plaintiff responds as follows:

As a result of the workplace accident on March 15, 2024, Plaintiff
suffered the following injuries:
- Fractured left wrist
- Torn rotator cuff in right shoulder
- Soft tissue injuries to neck and back
- Psychological trauma including anxiety and PTSD

Plaintiff reserves the right to supplement this response as additional
information becomes available.

Dated: February 1, 2025

                                    _________________________
                                    John Johnson, Plaintiff
"""


@pytest.fixture
def sample_settlement_agreement_text():
    """Sample settlement agreement"""
    return """
SETTLEMENT AGREEMENT AND MUTUAL RELEASE

This Settlement Agreement and Mutual Release ("Agreement") is entered into
as of February 10, 2025, by and between:

JOHN JOHNSON ("Plaintiff"), and
SMITH CORPORATION ("Defendant")

RECITALS

WHEREAS, Plaintiff filed a lawsuit against Defendant in Case No. CV-2025-12345
in the Superior Court of California, County of Los Angeles;

WHEREAS, the parties wish to settle all claims and controversies between them
without admission of liability;

NOW, THEREFORE, in consideration of the mutual covenants and agreements
contained herein, the parties agree as follows:

1. SETTLEMENT PAYMENT

   Defendant agrees to pay Plaintiff the total sum of ONE HUNDRED FIFTY
   THOUSAND DOLLARS ($150,000.00) in full settlement of all claims.

2. PAYMENT TERMS

   Payment shall be made within thirty (30) days of the execution of this
   Agreement by certified check payable to John Johnson and his attorney
   of record.

3. DISMISSAL OF ACTION

   Within five (5) days of receipt of the settlement payment, Plaintiff
   shall file a Request for Dismissal with Prejudice of the entire action.

4. MUTUAL RELEASE

   Each party hereby releases and forever discharges the other party from
   any and all claims, demands, and causes of action arising from the
   incident that occurred on March 15, 2024.

5. CONFIDENTIALITY

   The terms of this Settlement Agreement shall remain confidential and
   shall not be disclosed to any third party except as required by law.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date
first written above.


_________________________          _________________________
John Johnson, Plaintiff           Smith Corporation
                                  By: CEO Name, CEO
"""


@pytest.fixture
def pdf_with_deadline_dates():
    """Mock PDF content with various deadline formats"""
    return """
NOTICE OF HEARING

The hearing on this matter is scheduled for:

Date: March 15, 2025
Time: 9:00 a.m.
Location: Department 32

DEADLINES:

- Opposition papers must be filed and served no later than March 1, 2025
- Reply papers due by March 8, 2025
- Witness list due February 20, 2025
- Expert witness designations due by 2/28/2025
- Exhibit list must be filed by March 10th
"""


@pytest.fixture
def corrupted_pdf_scenario():
    """Simulate corrupted PDF for error handling tests"""
    return {
        "filename": "corrupted.pdf",
        "error_type": "PDFSyntaxError",
        "error_message": "EOF marker not found"
    }


@pytest.fixture
def scanned_pdf_scenario():
    """Simulate scanned PDF requiring OCR"""
    return {
        "filename": "scanned_document.pdf",
        "has_text": False,
        "has_images": True,
        "ocr_required": True
    }


@pytest.fixture
def multi_page_pdf_structure():
    """Structure for multi-page PDF testing"""
    return {
        "total_pages": 15,
        "pages": [
            {
                "page_num": 1,
                "type": "cover_page",
                "has_header": True,
                "text_preview": "SUPERIOR COURT OF CALIFORNIA..."
            },
            {
                "page_num": 2,
                "type": "table_of_contents",
                "has_header": True,
                "text_preview": "TABLE OF CONTENTS..."
            },
            {
                "page_num": 3,
                "type": "body",
                "has_header": True,
                "has_footer": True,
                "text_preview": "I. INTRODUCTION\n\nPlaintiff moves..."
            },
            # ... pages 4-14 would be similar body pages
            {
                "page_num": 15,
                "type": "signature_page",
                "has_signature": True,
                "text_preview": "Respectfully submitted,\n\nJOHN DOE..."
            }
        ]
    }


@pytest.fixture
def pdf_table_data():
    """Sample table data that might be extracted from PDF"""
    return [
        # Exhibit list table
        [
            ["Exhibit", "Description", "Date"],
            ["A", "Employment Contract", "January 1, 2024"],
            ["B", "Termination Letter", "March 15, 2024"],
            ["C", "Email Correspondence", "March 10-14, 2024"],
            ["D", "Medical Records", "March 20, 2024"]
        ],
        # Damages calculation table
        [
            ["Category", "Amount", "Notes"],
            ["Lost Wages", "$50,000", "6 months unemployment"],
            ["Medical Expenses", "$15,000", "Treatment and therapy"],
            ["Emotional Distress", "$25,000", "Pain and suffering"],
            ["Total", "$90,000", ""]
        ]
    ]


@pytest.fixture
def pdf_metadata_sample():
    """Sample PDF metadata"""
    return {
        "title": "Motion to Compel Discovery",
        "author": "John Doe, Esq.",
        "subject": "Johnson v. Smith Corp - Discovery Motion",
        "creator": "Microsoft Word",
        "producer": "Adobe PDF Library 15.0",
        "creation_date": "D:20250131100000-08'00'",
        "mod_date": "D:20250131103000-08'00'"
    }


@pytest.fixture
def sample_pdf_bytes():
    """Generate minimal valid PDF bytes for testing"""
    # Minimal PDF structure
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
/MediaBox [0 0 612 792]
/Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
410
%%EOF"""
    return pdf_content


@pytest.fixture
def temp_pdf_file(tmp_path, sample_pdf_bytes):
    """Create a temporary PDF file for testing"""
    pdf_path = tmp_path / "test_document.pdf"
    pdf_path.write_bytes(sample_pdf_bytes)
    return pdf_path


@pytest.fixture
def court_document_samples():
    """Collection of different court document types"""
    return {
        "complaint": {
            "type": "complaint",
            "has_caption": True,
            "has_prayer": True,
            "has_verification": True,
            "typical_sections": ["PARTIES", "JURISDICTION", "FACTS", "CAUSES OF ACTION", "PRAYER"]
        },
        "motion": {
            "type": "motion",
            "has_notice": True,
            "has_memorandum": True,
            "has_declaration": True,
            "typical_sections": ["NOTICE", "MEMORANDUM", "DECLARATION", "CONCLUSION"]
        },
        "order": {
            "type": "order",
            "has_findings": True,
            "has_conclusions": True,
            "has_signature": True,
            "typical_sections": ["FINDINGS", "CONCLUSIONS", "ORDER"]
        },
        "brief": {
            "type": "brief",
            "has_toc": True,
            "has_authorities": True,
            "has_argument": True,
            "typical_sections": ["TABLE OF CONTENTS", "TABLE OF AUTHORITIES", "INTRODUCTION", "ARGUMENT", "CONCLUSION"]
        }
    }


@pytest.fixture
def pdf_parser_factory(tmp_path):
    """Factory for creating test PDFs with specific content"""
    def _create_pdf(content: str, filename: str = "test.pdf"):
        """Create a test PDF with given content"""
        pdf_path = tmp_path / filename

        # Create minimal PDF with content
        # This is a simplified version - in reality would use reportlab or similar
        pdf_bytes = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R
   /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
   /MediaBox [0 0 612 792]
   /Contents 4 0 R >>
endobj
4 0 obj
<< /Length {len(content) + 30} >>
stream
BT
/F1 10 Tf
50 750 Td
({content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000340 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
{400 + len(content)}
%%EOF""".encode()

        pdf_path.write_bytes(pdf_bytes)
        return pdf_path

    return _create_pdf
