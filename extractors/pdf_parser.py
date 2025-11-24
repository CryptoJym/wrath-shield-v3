"""
PDF Document Parser for Legal Advocate AI
Extracts and structures text from court documents
"""

import pdfplumber
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from utils import (
    get_logger,
    PDFProcessingError,
    track_performance,
    retry,
    safe_operation,
)

# Configure logging
logger = get_logger(__name__)


@dataclass
class DocumentSection:
    """Represents a logical section of a legal document"""
    section_type: str  # 'header', 'body', 'signature', 'footer'
    content: str
    page_number: int
    confidence: float = 1.0


@dataclass
class ParsedDocument:
    """Structured representation of a parsed PDF document"""
    filename: str
    total_pages: int
    sections: List[DocumentSection]
    raw_text: str
    metadata: Dict

    def get_body_text(self) -> str:
        """Get all body text concatenated"""
        return '\n\n'.join(
            section.content
            for section in self.sections
            if section.section_type == 'body'
        )

    def get_full_text(self) -> str:
        """Get all text concatenated"""
        return '\n\n'.join(section.content for section in self.sections)


class PDFParser:
    """
    Parse PDF court documents and extract structured text

    Features:
    - Extract text from digital PDFs
    - Clean and normalize text
    - Identify document sections (header, body, signature)
    - Handle common PDF issues (encoding, spacing)
    """

    def __init__(self, remove_headers_footers: bool = True):
        """
        Initialize PDF parser

        Args:
            remove_headers_footers: Whether to attempt removing headers/footers
        """
        self.remove_headers_footers = remove_headers_footers

    @track_performance()
    @retry(max_attempts=2, delay=0.5, exceptions=(IOError,))
    def parse_file(self, pdf_path: str) -> ParsedDocument:
        """
        Parse a PDF file and extract structured text

        Args:
            pdf_path: Path to PDF file

        Returns:
            ParsedDocument with extracted sections

        Raises:
            PDFProcessingError: If PDF parsing fails
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise PDFProcessingError(
                f"PDF file not found: {pdf_path}",
                pdf_path=str(pdf_path)
            )

        logger.info(f"Parsing PDF: {pdf_path.name}", extra={'pdf_path': str(pdf_path)})

        try:
            with safe_operation(f"parse_pdf_{pdf_path.name}", logger):
                with pdfplumber.open(pdf_path) as pdf:
                    metadata = self._extract_metadata(pdf)
                    total_pages = len(pdf.pages)

                    if total_pages == 0:
                        raise PDFProcessingError(
                            "PDF contains no pages",
                            pdf_path=str(pdf_path),
                            total_pages=0
                        )

                    # Extract text from each page
                    all_text = []
                    sections = []

                    for page_num, page in enumerate(pdf.pages, start=1):
                        logger.debug(
                            f"Processing page {page_num}/{total_pages}",
                            extra={'page': page_num, 'total_pages': total_pages}
                        )

                        try:
                            # Extract text
                            page_text = page.extract_text()

                            if page_text:
                                # Clean the text
                                cleaned_text = self._clean_text(page_text)
                                all_text.append(cleaned_text)

                                # Identify sections
                                page_sections = self._identify_sections(
                                    cleaned_text,
                                    page_num,
                                    total_pages
                                )
                                sections.extend(page_sections)
                            else:
                                logger.warning(
                                    f"No text extracted from page {page_num}",
                                    extra={'page': page_num, 'pdf_path': str(pdf_path)}
                                )

                        except Exception as e:
                            logger.error(
                                f"Error processing page {page_num}: {str(e)}",
                                exc_info=True,
                                extra={'page': page_num, 'pdf_path': str(pdf_path)}
                            )
                            # Continue with other pages
                            continue

                    if not all_text:
                        raise PDFProcessingError(
                            "No text could be extracted from PDF",
                            pdf_path=str(pdf_path),
                            total_pages=total_pages
                        )

                    raw_text = '\n\n'.join(all_text)

                    logger.info(
                        f"Successfully parsed PDF with {total_pages} pages, {len(sections)} sections",
                        extra={
                            'pdf_path': str(pdf_path),
                            'total_pages': total_pages,
                            'sections_count': len(sections),
                            'text_length': len(raw_text)
                        }
                    )

                    return ParsedDocument(
                        filename=pdf_path.name,
                        total_pages=total_pages,
                        sections=sections,
                        raw_text=raw_text,
                        metadata=metadata
                    )

        except PDFProcessingError:
            raise
        except Exception as e:
            logger.error(
                f"Unexpected error parsing PDF {pdf_path.name}: {str(e)}",
                exc_info=True,
                extra={'pdf_path': str(pdf_path)}
            )
            raise PDFProcessingError(
                f"Failed to parse PDF: {str(e)}",
                pdf_path=str(pdf_path),
                error_type=type(e).__name__
            )

    def _extract_metadata(self, pdf) -> Dict:
        """Extract PDF metadata"""
        metadata = {}
        if pdf.metadata:
            metadata = {
                'title': pdf.metadata.get('Title', ''),
                'author': pdf.metadata.get('Author', ''),
                'subject': pdf.metadata.get('Subject', ''),
                'creator': pdf.metadata.get('Creator', ''),
                'producer': pdf.metadata.get('Producer', ''),
                'creation_date': pdf.metadata.get('CreationDate', ''),
            }
        return metadata

    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize extracted text

        Args:
            text: Raw extracted text

        Returns:
            Cleaned text
        """
        if not text:
            return ""

        # Fix common OCR/extraction issues
        text = text.replace('\x00', '')  # Remove null bytes
        text = text.replace('\r\n', '\n')  # Normalize line breaks
        text = text.replace('\r', '\n')

        # Fix broken words (word-wrapping artifacts)
        # Example: "respon-\nsibility" -> "responsibility"
        text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)

        # Normalize multiple spaces
        text = re.sub(r'[ \t]+', ' ', text)

        # Normalize multiple newlines (but keep paragraph breaks)
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Remove leading/trailing whitespace from each line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)

        return text.strip()

    def _identify_sections(
        self,
        text: str,
        page_num: int,
        total_pages: int
    ) -> List[DocumentSection]:
        """
        Identify logical sections in the text

        Args:
            text: Page text
            page_num: Current page number
            total_pages: Total pages in document

        Returns:
            List of identified sections
        """
        sections = []
        lines = text.split('\n')

        # First page might have header
        if page_num == 1:
            header_end = self._find_header_end(lines)
            if header_end > 0:
                header_text = '\n'.join(lines[:header_end])
                sections.append(DocumentSection(
                    section_type='header',
                    content=header_text,
                    page_number=page_num
                ))
                lines = lines[header_end:]

        # Last page might have signature block
        if page_num == total_pages:
            signature_start = self._find_signature_start(lines)
            if signature_start < len(lines):
                body_text = '\n'.join(lines[:signature_start])
                signature_text = '\n'.join(lines[signature_start:])

                if body_text.strip():
                    sections.append(DocumentSection(
                        section_type='body',
                        content=body_text,
                        page_number=page_num
                    ))

                if signature_text.strip():
                    sections.append(DocumentSection(
                        section_type='signature',
                        content=signature_text,
                        page_number=page_num
                    ))

                return sections

        # Default: entire page is body
        if lines:
            body_text = '\n'.join(lines)
            if body_text.strip():
                sections.append(DocumentSection(
                    section_type='body',
                    content=body_text,
                    page_number=page_num
                ))

        return sections

    def _find_header_end(self, lines: List[str]) -> int:
        """
        Find where document header ends

        Header typically includes:
        - Court name
        - Case number
        - Case title
        - Document type

        Args:
            lines: Document lines

        Returns:
            Index where header ends
        """
        # Common header patterns
        header_patterns = [
            r'(?i)in the .+ court',
            r'(?i)case (no|number)',
            r'(?i)plaintiff|defendant',
            r'(?i)vs?\.?\s+',
        ]

        header_end = 0
        for i, line in enumerate(lines[:30]):  # Check first 30 lines
            if any(re.search(pattern, line) for pattern in header_patterns):
                header_end = i + 1

        # Look for blank lines after header
        for i in range(header_end, min(header_end + 10, len(lines))):
            if not lines[i].strip():
                return i + 1

        return header_end

    def _find_signature_start(self, lines: List[str]) -> int:
        """
        Find where signature block starts

        Signature block typically includes:
        - "Respectfully submitted"
        - Attorney name
        - Bar number
        - Date

        Args:
            lines: Document lines

        Returns:
            Index where signature block starts
        """
        signature_patterns = [
            r'(?i)respectfully submitted',
            r'(?i)dated:?\s+\w+',
            r'(?i)by:\s*$',
            r'(?i)attorney for',
            r'bar number|bar no\.',
        ]

        # Search from bottom up (last 50 lines)
        start_search = max(0, len(lines) - 50)
        for i in range(start_search, len(lines)):
            if any(re.search(pattern, lines[i]) for pattern in signature_patterns):
                return i

        return len(lines)

    @track_performance("extract_tables")
    def extract_tables(self, pdf_path: str) -> List[List[List[str]]]:
        """
        Extract tables from PDF (useful for certain court documents)

        Args:
            pdf_path: Path to PDF file

        Returns:
            List of tables, where each table is a list of rows,
            and each row is a list of cell values
        """
        pdf_path = Path(pdf_path)
        all_tables = []

        if not pdf_path.exists():
            logger.error(f"PDF file not found for table extraction: {pdf_path}")
            return all_tables

        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, start=1):
                    try:
                        tables = page.extract_tables()
                        if tables:
                            all_tables.extend(tables)
                            logger.debug(
                                f"Extracted {len(tables)} tables from page {page_num}",
                                extra={'page': page_num, 'table_count': len(tables)}
                            )
                    except Exception as e:
                        logger.warning(
                            f"Error extracting tables from page {page_num}: {str(e)}",
                            extra={'page': page_num, 'pdf_path': str(pdf_path)}
                        )
                        continue

            logger.info(
                f"Extracted {len(all_tables)} total tables from PDF",
                extra={'pdf_path': str(pdf_path), 'total_tables': len(all_tables)}
            )

        except Exception as e:
            logger.error(
                f"Error extracting tables from PDF: {str(e)}",
                exc_info=True,
                extra={'pdf_path': str(pdf_path)}
            )

        return all_tables


def parse_court_document(pdf_path: str) -> ParsedDocument:
    """
    Convenience function to parse a court document

    Args:
        pdf_path: Path to PDF file

    Returns:
        ParsedDocument with extracted content
    """
    parser = PDFParser(remove_headers_footers=True)
    return parser.parse_file(pdf_path)


if __name__ == "__main__":
    # Test the parser
    import sys

    if len(sys.argv) < 2:
        print("Usage: python pdf_parser.py <path-to-pdf>")
        print("\nExample:")
        print("  python pdf_parser.py ~/Downloads/court_order.pdf")
        sys.exit(1)

    pdf_file = sys.argv[1]

    try:
        doc = parse_court_document(pdf_file)

        print(f"\n{'='*70}")
        print(f"PDF Parsing Results: {doc.filename}")
        print(f"{'='*70}")
        print(f"Total Pages: {doc.total_pages}")
        print(f"Sections Found: {len(doc.sections)}")
        print(f"\nMetadata:")
        for key, value in doc.metadata.items():
            if value:
                print(f"  {key}: {value}")

        print(f"\n{'='*70}")
        print("Sections:")
        print(f"{'='*70}")
        for i, section in enumerate(doc.sections, 1):
            print(f"\n[Section {i}] Type: {section.section_type} | Page: {section.page_number}")
            print("-" * 70)
            preview = section.content[:300] + "..." if len(section.content) > 300 else section.content
            print(preview)

        print(f"\n{'='*70}")
        print(f"Raw Text Length: {len(doc.raw_text)} characters")
        print(f"{'='*70}")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
