"""
Tests for Error Handling and Logging Infrastructure
"""

import pytest
import logging
import tempfile
from pathlib import Path
from datetime import datetime

from utils import (
    # Exceptions
    PDFProcessingError,
    DeadlineExtractionError,
    RequestDetectionError,
    get_exception_category,

    # Error handling
    retry,
    log_errors,
    graceful_degradation,
    error_reporter,

    # Monitoring
    metrics,
    track_performance,
    HealthCheck,

    # Logging
    setup_logging,
    get_logger,
)


class TestExceptions:
    """Test custom exception classes"""

    def test_pdf_processing_error(self):
        """Test PDFProcessingError with details"""
        error = PDFProcessingError(
            "Failed to parse PDF",
            pdf_path="/path/to/doc.pdf",
            page_number=5
        )

        assert error.message == "Failed to parse PDF"
        assert error.details['pdf_path'] == "/path/to/doc.pdf"
        assert error.details['page_number'] == 5

        error_dict = error.to_dict()
        assert error_dict['type'] == 'PDFProcessingError'
        assert 'pdf_path' in error_dict['details']

    def test_deadline_extraction_error(self):
        """Test DeadlineExtractionError"""
        error = DeadlineExtractionError(
            "Failed to extract deadline",
            text_snippet="The deadline is...",
            document_id="doc123"
        )

        assert error.details['document_id'] == "doc123"
        assert len(error.details['text_snippet']) <= 200

    def test_exception_category(self):
        """Test exception categorization"""
        pdf_error = PDFProcessingError("test")
        assert get_exception_category(pdf_error) == 'processing'

        db_error = RequestDetectionError("test")
        assert get_exception_category(db_error) == 'processing'


class TestRetryDecorator:
    """Test retry decorator"""

    def test_retry_success_on_second_attempt(self):
        """Test retry succeeds on second attempt"""
        call_count = 0

        @retry(max_attempts=3, delay=0.1, exceptions=(ValueError,))
        def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Temporary error")
            return "success"

        result = flaky_function()
        assert result == "success"
        assert call_count == 2

    def test_retry_exhausts_attempts(self):
        """Test retry raises after max attempts"""
        @retry(max_attempts=2, delay=0.1, exceptions=(ValueError,))
        def always_fails():
            raise ValueError("Always fails")

        with pytest.raises(ValueError, match="Always fails"):
            always_fails()

    def test_retry_with_callback(self):
        """Test retry with on_retry callback"""
        retry_attempts = []

        def on_retry_callback(attempt, error):
            retry_attempts.append(attempt)

        @retry(max_attempts=3, delay=0.1, on_retry=on_retry_callback)
        def flaky_function():
            if len(retry_attempts) < 2:
                raise ValueError("Retry me")
            return "success"

        result = flaky_function()
        assert result == "success"
        assert retry_attempts == [1, 2]


class TestLogErrors:
    """Test log_errors decorator"""

    def test_log_errors_with_reraise(self):
        """Test log_errors logs and re-raises"""
        logger = get_logger(__name__)

        @log_errors(logger_instance=logger, reraise=True)
        def failing_function():
            raise ValueError("Test error")

        with pytest.raises(ValueError, match="Test error"):
            failing_function()

    def test_log_errors_with_default_return(self):
        """Test log_errors returns default on error"""
        @log_errors(reraise=False, return_on_error=[])
        def failing_function():
            raise ValueError("Test error")

        result = failing_function()
        assert result == []


class TestGracefulDegradation:
    """Test graceful degradation context manager"""

    def test_graceful_degradation_on_success(self):
        """Test graceful degradation when operation succeeds"""
        with graceful_degradation("test_op", default_value="default") as result:
            result.value = "success"

        assert result.value == "success"

    def test_graceful_degradation_on_error(self):
        """Test graceful degradation when operation fails"""
        with graceful_degradation("test_op", default_value="default") as result:
            raise ValueError("Operation failed")

        assert result.value == "default"


class TestPerformanceTracking:
    """Test performance tracking"""

    def test_track_performance_decorator(self):
        """Test performance tracking decorator"""
        metrics.reset_metrics()

        @track_performance()
        def slow_operation():
            import time
            time.sleep(0.1)
            return "done"

        result = slow_operation()
        assert result == "done"

        perf_metrics = metrics.get_performance_metrics()
        assert 'slow_operation' in perf_metrics
        assert perf_metrics['slow_operation']['call_count'] == 1

    def test_track_performance_with_error(self):
        """Test performance tracking captures errors"""
        metrics.reset_metrics()

        @track_performance()
        def failing_operation():
            raise ValueError("Test error")

        with pytest.raises(ValueError):
            failing_operation()

        perf_metrics = metrics.get_performance_metrics()
        assert perf_metrics['failing_operation']['error_count'] == 1


class TestMetrics:
    """Test metrics collection"""

    def test_increment_counter(self):
        """Test counter increment"""
        metrics.reset_metrics()

        metrics.increment_counter("test_counter")
        metrics.increment_counter("test_counter", value=5)

        counters = metrics.get_counters()
        assert counters['test_counter'] == 6

    def test_set_gauge(self):
        """Test gauge setting"""
        metrics.reset_metrics()

        metrics.set_gauge("cpu_usage", 75.5)

        gauges = metrics.get_gauges()
        assert gauges['cpu_usage'] == 75.5

    def test_health_status(self):
        """Test health status calculation"""
        metrics.reset_metrics()

        health = metrics.get_health_status()
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']
        assert 'uptime_seconds' in health


class TestErrorReporter:
    """Test error reporter"""

    def test_error_reporting(self):
        """Test error reporting functionality"""
        error_reporter.error_counts = {}  # Reset

        error = PDFProcessingError("Test error", pdf_path="test.pdf")
        error_reporter.report(error, context={'user': 'test'}, severity='error')

        summary = error_reporter.get_error_summary()
        assert summary['total_errors'] == 1
        assert 'PDFProcessingError' in summary['error_types']


class TestLogging:
    """Test logging configuration"""

    def test_logging_setup(self):
        """Test logging setup"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Override log directory for testing
            from utils.logging_config import LoggingConfig
            LoggingConfig.LOG_DIR = Path(tmpdir)

            setup_logging(level="DEBUG", json_logs=False)

            logger = get_logger(__name__)
            logger.info("Test message")

            # Check log files were created
            assert (Path(tmpdir) / "app.log").exists()

    def test_json_logging(self):
        """Test JSON log formatting"""
        import json

        with tempfile.TemporaryDirectory() as tmpdir:
            from utils.logging_config import LoggingConfig
            LoggingConfig.LOG_DIR = Path(tmpdir)

            setup_logging(level="INFO", json_logs=True)

            logger = get_logger(__name__)
            logger.info("Test JSON log", extra={'custom_field': 'value'})

            # Read and validate JSON log
            log_file = Path(tmpdir) / "app.log"
            if log_file.exists():
                with open(log_file) as f:
                    log_line = f.readline()
                    if log_line.strip():
                        log_data = json.loads(log_line)
                        assert log_data['level'] == 'INFO'
                        assert 'timestamp' in log_data


class TestHealthCheck:
    """Test health check utilities"""

    def test_system_health_check(self):
        """Test system health check"""
        health = HealthCheck.check_system_health()

        assert 'status' in health
        assert 'checks' in health
        assert 'metrics' in health

    def test_metrics_report(self):
        """Test comprehensive metrics report"""
        report = HealthCheck.get_metrics_report()

        assert 'health' in report
        assert 'performance' in report
        assert 'errors' in report


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
