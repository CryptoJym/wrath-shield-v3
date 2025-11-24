"""
Tests for Document Processing Pipeline
"""

import pytest
import time
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch, call
from freezegun import freeze_time

from document_processor import (
    DocumentProcessor,
    ProcessingJob,
    JobType,
    JobStatus,
    ProcessingResult
)
from extractors.pdf_parser import ParsedDocument, DocumentSection
from extractors.deadline_extractor import ExtractedDeadline
from extractors.request_detector import DetectedRequest, RequestType, UrgencyLevel


@pytest.fixture
def mock_deadline_repo():
    """Mock deadline repository"""
    repo = Mock()
    repo.create = Mock(return_value=Mock(
        to_dict=lambda: {
            'id': '1',
            'deadline_date': datetime.now(),
            'action_required': 'Test action'
        }
    ))
    repo.find_by_case_and_date = Mock(return_value=[])
    return repo


@pytest.fixture
def mock_request_repo():
    """Mock request repository"""
    repo = Mock()
    repo.create = Mock(return_value=Mock(
        to_dict=lambda: {
            'id': '1',
            'what_is_needed': 'Test request'
        }
    ))
    repo.find_by_case = Mock(return_value=[])
    return repo


@pytest.fixture
def mock_case_repo():
    """Mock case repository"""
    return Mock()


@pytest.fixture
def mock_alert_engine():
    """Mock alert engine"""
    engine = Mock()
    engine.create_alerts_for_deadline = Mock()
    return engine


@pytest.fixture
def processor(mock_deadline_repo, mock_request_repo, mock_case_repo, mock_alert_engine):
    """Create document processor with mocked dependencies"""
    return DocumentProcessor(
        deadline_repo=mock_deadline_repo,
        request_repo=mock_request_repo,
        case_repo=mock_case_repo,
        alert_engine=mock_alert_engine,
        num_workers=1,
        max_retries=3,
        retry_base_delay=0.1,  # Fast retries for testing
        batch_size=10
    )


class TestDocumentProcessor:
    """Test DocumentProcessor class"""

    def test_initialization(self, processor):
        """Test processor initialization"""
        assert processor.num_workers == 1
        assert processor.max_retries == 3
        assert processor.retry_base_delay == 0.1
        assert processor.batch_size == 10
        assert len(processor.workers) == 0  # Not started yet
        assert processor.job_queue.qsize() == 0

    def test_worker_lifecycle(self, processor):
        """Test starting and stopping workers"""
        # Start workers
        processor.start_workers()
        assert len(processor.workers) == 1
        assert all(w.is_alive() for w in processor.workers)

        # Stop workers
        processor.stop_workers(timeout=2.0)
        assert len(processor.workers) == 0

    def test_process_pdf_queuing(self, processor):
        """Test queuing a PDF for processing"""
        job = processor.process_pdf(
            file_path='/path/to/test.pdf',
            case_id='case123',
            user_id='user456',
            priority=3
        )

        assert job.job_type == JobType.PDF
        assert job.status == JobStatus.PENDING
        assert job.data['file_path'] == '/path/to/test.pdf'
        assert job.case_id == 'case123'
        assert job.user_id == 'user456'
        assert job.priority == 3
        assert processor.job_queue.qsize() == 1
        assert processor.stats['total_jobs'] == 1

    def test_process_email_queuing(self, processor):
        """Test queuing an email for processing"""
        job = processor.process_email(
            email_text='Please send the documents ASAP',
            email_subject='Document Request',
            sender_name='Attorney Smith',
            case_id='case123',
            user_id='user456',
            priority=1
        )

        assert job.job_type == JobType.EMAIL
        assert job.status == JobStatus.PENDING
        assert job.data['email_text'] == 'Please send the documents ASAP'
        assert job.data['email_subject'] == 'Document Request'
        assert job.data['sender_name'] == 'Attorney Smith'
        assert job.case_id == 'case123'
        assert job.priority == 1
        assert processor.job_queue.qsize() == 1

    def test_pdf_processing_success(self, processor):
        """Test successful PDF processing"""
        # Mock PDF parser, deadline extractor, and file hash
        with patch.object(processor, '_calculate_file_hash') as mock_hash:
            mock_hash.return_value = 'mock_hash_123'

            with patch.object(processor.pdf_parser, 'parse_file') as mock_parse:
                parsed_doc = ParsedDocument(
                    filename='test.pdf',
                    total_pages=1,
                    sections=[
                        DocumentSection(
                            section_type='body',
                            content='You must file a response by January 15, 2024.',
                            page_number=1
                        )
                    ],
                    raw_text='You must file a response by January 15, 2024.',
                    metadata={}
                )
                mock_parse.return_value = parsed_doc

                with patch.object(processor.deadline_extractor, 'extract_deadlines') as mock_extract:
                    mock_extract.return_value = [
                        ExtractedDeadline(
                            deadline_date=datetime(2024, 1, 15),
                            action_required='File response',
                            responsible_party='self',
                            deadline_type='filing',
                            source_text='You must file a response by January 15, 2024.',
                            confidence=0.9
                        )
                    ]

                    # Create and process job
                    job = ProcessingJob(
                        job_id='test123',
                        job_type=JobType.PDF,
                        data={'file_path': '/path/to/test.pdf'},
                        case_id='case123',
                        user_id='user456'
                    )

                    result = processor._process_pdf_job(job)

                    assert result.success
                    assert result.job_type == JobType.PDF
                    assert len(result.deadlines) == 1
                    assert result.duplicate_deadlines == 0
                    assert processor.deadline_repo.create.called
                    assert processor.alert_engine.create_alerts_for_deadline.called

    def test_email_processing_success(self, processor):
        """Test successful email processing"""
        # Mock request detector
        with patch.object(processor.request_detector, 'detect_requests') as mock_detect:
            mock_detect.return_value = [
                DetectedRequest(
                    what_is_needed='Send case files',
                    requested_by='Attorney Smith',
                    requested_date=datetime.now(),
                    urgency_level=UrgencyLevel.HIGH,
                    request_type=RequestType.DOCUMENT_REQUEST,
                    original_text='Please send the case files ASAP',
                    email_subject='Urgent Request',
                    confidence_score=0.85
                )
            ]

            # Create and process job
            job = ProcessingJob(
                job_id='test456',
                job_type=JobType.EMAIL,
                data={
                    'email_text': 'Please send the case files ASAP',
                    'email_subject': 'Urgent Request',
                    'sender_name': 'Attorney Smith',
                    'timestamp': datetime.now()
                },
                case_id='case123',
                user_id='user456'
            )

            result = processor._process_email_job(job)

            assert result.success
            assert result.job_type == JobType.EMAIL
            assert len(result.requests) == 1
            assert result.duplicate_requests == 0
            assert processor.request_repo.create.called

    def test_duplicate_deadline_detection(self, processor, mock_deadline_repo):
        """Test duplicate deadline detection"""
        # Setup existing deadline
        existing_deadline = Mock()
        existing_deadline.deadline_type = 'filing'
        mock_deadline_repo.find_by_case_and_date = Mock(return_value=[existing_deadline])

        deadline = ExtractedDeadline(
            deadline_date=datetime(2024, 1, 15),
            action_required='File response',
            responsible_party='self',
            deadline_type='filing',
            source_text='Test',
            confidence=0.9
        )

        is_duplicate = processor._is_duplicate_deadline(
            deadline,
            case_id='case123',
            user_id='user456'
        )

        assert is_duplicate

    def test_duplicate_request_detection(self, processor, mock_request_repo):
        """Test duplicate request detection"""
        # Setup existing request with same timestamp (within 24 hour window)
        now = datetime.now()
        existing_request = Mock()
        existing_request.what_is_needed = 'Send case files'
        existing_request.requested_date = now
        mock_request_repo.find_by_case = Mock(return_value=[existing_request])

        request = DetectedRequest(
            what_is_needed='Send case files',  # More similar to trigger duplicate
            requested_by='Attorney',
            requested_date=now,
            urgency_level=UrgencyLevel.HIGH,
            request_type=RequestType.DOCUMENT_REQUEST,
            original_text='Test',
            email_subject='Test',
            confidence_score=0.8
        )

        is_duplicate = processor._is_duplicate_request(
            request,
            case_id='case123',
            user_id='user456'
        )

        assert is_duplicate

    def test_text_similarity(self, processor):
        """Test text similarity detection"""
        # Similar texts
        assert processor._are_similar(
            'Send case files',
            'Send the case files',
            threshold=0.6
        )

        # Different texts
        assert not processor._are_similar(
            'Send case files',
            'Call the client',
            threshold=0.8
        )

    def test_batch_processing(self, processor):
        """Test batch processing of multiple documents"""
        jobs_data = [
            {
                'type': 'pdf',
                'path': '/path/to/doc1.pdf',
                'case_id': 'case1',
                'user_id': 'user1',
                'priority': 1
            },
            {
                'type': 'email',
                'text': 'Please send documents',
                'subject': 'Request',
                'sender': 'Attorney',
                'case_id': 'case2',
                'user_id': 'user2',
                'priority': 2
            },
            {
                'type': 'pdf',
                'path': '/path/to/doc2.pdf',
                'case_id': 'case3',
                'user_id': 'user3',
                'priority': 3
            }
        ]

        jobs = processor.process_batch(jobs_data)

        assert len(jobs) == 3
        assert jobs[0].job_type == JobType.PDF
        assert jobs[1].job_type == JobType.EMAIL
        assert jobs[2].job_type == JobType.PDF
        assert processor.job_queue.qsize() == 3

    def test_retry_logic(self, processor):
        """Test retry logic for failed jobs"""
        job = ProcessingJob(
            job_id='test789',
            job_type=JobType.PDF,
            data={'file_path': '/nonexistent/file.pdf'},
            case_id='case123',
            user_id='user456',
            max_retries=3
        )

        # Mock PDF parser to fail
        with patch.object(processor.pdf_parser, 'parse_file', side_effect=Exception('File not found')):
            # Process the job (should fail and retry)
            processor._process_job(job)

            # Job should be marked for retry
            assert job.status == JobStatus.RETRYING
            assert job.attempts == 1
            # The error message includes both the original error and context
            assert job.last_error is not None
            assert len(job.last_error) > 0

    def test_job_status_tracking(self, processor):
        """Test job status retrieval"""
        job = processor.process_pdf(
            file_path='/path/to/test.pdf',
            case_id='case123',
            user_id='user456'
        )

        status = processor.get_job_status(job.job_id)

        assert status is not None
        assert status['job_id'] == job.job_id
        assert status['status'] == JobStatus.PENDING.value
        assert status['job_type'] == JobType.PDF.value

    def test_statistics_tracking(self, processor):
        """Test statistics gathering"""
        # Queue some jobs
        processor.process_pdf('/path/to/doc1.pdf', 'case1', 'user1')
        processor.process_email('Test email', 'Subject', 'Sender', 'case2', 'user2')

        stats = processor.get_stats()

        assert stats['total_jobs'] == 2
        assert stats['queue_size'] == 2
        assert 'successful_jobs' in stats
        assert 'failed_jobs' in stats
        assert 'total_deadlines' in stats
        assert 'total_requests' in stats

    def test_file_hash_calculation(self, processor, tmp_path):
        """Test file hash calculation for deduplication"""
        # Create a temporary test file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Test content")

        hash1 = processor._calculate_file_hash(str(test_file))
        hash2 = processor._calculate_file_hash(str(test_file))

        # Same file should produce same hash
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 produces 64 hex characters

    def test_wait_for_completion(self, processor):
        """Test waiting for queue completion"""
        # Start workers
        processor.start_workers()

        # Queue a job that completes quickly
        with patch.object(processor, '_process_pdf_job') as mock_process:
            mock_process.return_value = ProcessingResult(
                success=True,
                job_id='test',
                job_type=JobType.PDF
            )

            processor.process_pdf('/path/to/test.pdf', 'case1', 'user1')

            # Wait for completion
            processor.wait_for_completion()

            # Queue should be empty
            assert processor.job_queue.qsize() == 0

        # Cleanup
        processor.stop_workers()

    def test_graceful_shutdown(self, processor):
        """Test graceful shutdown with pending jobs"""
        processor.start_workers()

        # Queue some jobs
        processor.process_pdf('/path/to/doc1.pdf', 'case1', 'user1')
        processor.process_pdf('/path/to/doc2.pdf', 'case2', 'user2')

        # Stop workers
        processor.stop_workers(timeout=5.0)

        # All workers should be stopped
        assert len(processor.workers) == 0

    def test_error_handling_invalid_job_type(self, processor):
        """Test error handling for invalid job type"""
        # Create a mock enum value that's not PDF or EMAIL
        invalid_type = Mock(spec=JobType)
        invalid_type.value = 'invalid'

        job = ProcessingJob(
            job_id='invalid',
            job_type=invalid_type,
            data={},
            case_id='case123',
            user_id='user456'
        )

        # This will trigger retry logic instead of raising immediately
        processor._process_job(job)

        # Job should be marked for retry due to the ValueError
        assert job.status == JobStatus.RETRYING
        assert 'Unknown job type' in job.last_error

    def test_pdf_job_missing_file_path(self, processor):
        """Test PDF job with missing file path"""
        job = ProcessingJob(
            job_id='test',
            job_type=JobType.PDF,
            data={},  # Missing file_path
            case_id='case123',
            user_id='user456'
        )

        with pytest.raises(ValueError, match='PDF job missing file_path'):
            processor._process_pdf_job(job)

    def test_email_job_missing_text(self, processor):
        """Test email job with missing text"""
        job = ProcessingJob(
            job_id='test',
            job_type=JobType.EMAIL,
            data={},  # Missing email_text
            case_id='case123',
            user_id='user456'
        )

        with pytest.raises(ValueError, match='Email job missing email_text'):
            processor._process_email_job(job)


class TestProcessingJob:
    """Test ProcessingJob dataclass"""

    def test_job_creation(self):
        """Test job creation with defaults"""
        job = ProcessingJob(
            job_id='test123',
            job_type=JobType.PDF
        )

        assert job.job_id == 'test123'
        assert job.job_type == JobType.PDF
        assert job.status == JobStatus.PENDING
        assert job.attempts == 0
        assert job.max_retries == 3
        assert job.data == {}

    def test_job_to_dict(self):
        """Test job serialization to dict"""
        job = ProcessingJob(
            job_id='test123',
            job_type=JobType.EMAIL,
            case_id='case456',
            user_id='user789',
            priority=2
        )

        job_dict = job.to_dict()

        assert job_dict['job_id'] == 'test123'
        assert job_dict['job_type'] == 'email'
        assert job_dict['status'] == 'pending'
        assert job_dict['case_id'] == 'case456'
        assert job_dict['user_id'] == 'user789'
        assert job_dict['priority'] == 2


class TestProcessingResult:
    """Test ProcessingResult dataclass"""

    def test_result_creation(self):
        """Test result creation"""
        result = ProcessingResult(
            success=True,
            job_id='test123',
            job_type=JobType.PDF,
            deadlines=[{'id': '1'}],
            processing_time=1.5
        )

        assert result.success
        assert result.job_id == 'test123'
        assert result.job_type == JobType.PDF
        assert len(result.deadlines) == 1
        assert result.processing_time == 1.5

    def test_result_to_dict(self):
        """Test result serialization"""
        result = ProcessingResult(
            success=True,
            job_id='test456',
            job_type=JobType.EMAIL,
            requests=[{'id': '1'}],
            duplicate_requests=2
        )

        result_dict = result.to_dict()

        assert result_dict['success']
        assert result_dict['job_id'] == 'test456'
        assert result_dict['job_type'] == 'email'
        assert len(result_dict['requests']) == 1
        assert result_dict['duplicate_requests'] == 2
