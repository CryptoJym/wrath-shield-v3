"""
Extractors package for Legal Advocate AI
Document parsing and information extraction modules
"""

from extractors.pdf_parser import (
    PDFParser,
    ParsedDocument,
    DocumentSection,
    parse_court_document
)

from extractors.deadline_extractor import (
    DeadlineExtractor,
    ExtractedDeadline,
    extract_deadlines_from_document
)

from extractors.request_detector import (
    RequestDetector,
    DetectedRequest,
    RequestType,
    UrgencyLevel,
    detect_requests_from_email
)

__all__ = [
    'PDFParser',
    'ParsedDocument',
    'DocumentSection',
    'parse_court_document',
    'DeadlineExtractor',
    'ExtractedDeadline',
    'extract_deadlines_from_document',
    'RequestDetector',
    'DetectedRequest',
    'RequestType',
    'UrgencyLevel',
    'detect_requests_from_email',
]
