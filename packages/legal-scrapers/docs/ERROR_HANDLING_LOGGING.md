# Error Handling and Logging System

## Overview

The Legal Advocate AI system includes a comprehensive error handling and logging infrastructure designed for production reliability, debugging efficiency, and operational monitoring.

## Architecture

### Core Components

1. **Logging Configuration** (`utils/logging_config.py`)
   - Structured logging with JSON support
   - Multiple handlers (console, file, error file)
   - Log rotation (10MB max, 5 backups)
   - Context injection for request tracking

2. **Custom Exceptions** (`utils/exceptions.py`)
   - Domain-specific exception hierarchy
   - Contextual error details
   - Serialization support for API responses

3. **Error Handling Utilities** (`utils/error_handling.py`)
   - Retry decorators with exponential backoff
   - Error logging decorators
   - Graceful degradation patterns
   - Safe operation context managers

4. **Monitoring** (`utils/monitoring.py`)
   - Performance metrics tracking
   - Health check utilities
   - Success/failure rate monitoring
   - P95 latency calculations

## Usage Guide

### Setting Up Logging

```python
from utils import setup_logging, get_logger

# Initialize logging (do this once at application startup)
setup_logging(level="INFO", json_logs=True)

# Get logger for your module
logger = get_logger(__name__)

# Use logger
logger.info("Processing document", extra={'doc_id': '123'})
logger.warning("Unexpected condition", extra={'value': value})
logger.error("Operation failed", exc_info=True)
```

### Using Custom Exceptions

```python
from utils import PDFProcessingError, DeadlineExtractionError

# Raise with context
raise PDFProcessingError(
    "Failed to parse PDF",
    pdf_path="/path/to/doc.pdf",
    page_number=5
)

# Catch and handle
try:
    process_pdf(pdf_path)
except PDFProcessingError as e:
    logger.error(f"PDF processing failed: {e.message}")
    # Access contextual details
    print(e.details['pdf_path'])
    print(e.details['page_number'])
    # Convert to dict for API responses
    return {"error": e.to_dict()}
```

### Retry Logic

```python
from utils import retry

# Retry on connection errors
@retry(max_attempts=3, delay=1.0, backoff=2.0, exceptions=(ConnectionError,))
def fetch_data_from_api():
    response = requests.get("https://api.example.com/data")
    return response.json()

# Retry with callback
def on_retry_callback(attempt, error):
    logger.warning(f"Retry attempt {attempt}: {error}")

@retry(max_attempts=5, on_retry=on_retry_callback)
def flaky_operation():
    # Operation that might fail
    pass
```

### Performance Tracking

```python
from utils import track_performance

@track_performance()
def process_document(doc_id: str):
    # Your processing logic
    return result

# Metrics are automatically tracked:
# - Call count
# - Duration (avg, min, max, p95)
# - Success/error rates
```

### Graceful Degradation

```python
from utils import graceful_degradation

def get_user_preferences(user_id: str):
    with graceful_degradation("fetch_preferences", default_value={}) as result:
        # Try to fetch preferences
        prefs = db.get_preferences(user_id)
        result.value = prefs

    # If operation fails, result.value will be the default ({})
    return result.value
```

### Safe Operations

```python
from utils import safe_operation

def database_transaction():
    with safe_operation("database_update", logger):
        # Automatic error handling and logging
        db.begin_transaction()
        db.update_records()
        db.commit()
    # Cleanup and error reporting handled automatically
```

### Error Reporting

```python
from utils import error_reporter

try:
    risky_operation()
except Exception as e:
    error_reporter.report(
        e,
        context={'user_id': user_id, 'action': 'process_document'},
        severity='error'
    )

# Get error summary
summary = error_reporter.get_error_summary()
print(f"Total errors: {summary['total_errors']}")
print(f"Error types: {summary['error_types']}")
```

## Exception Types

### Base Exception
- `LegalAdvocateException` - Base class for all custom exceptions

### Processing Exceptions
- `PDFProcessingError` - PDF extraction/parsing failures
- `DeadlineExtractionError` - Deadline detection failures
- `RequestDetectionError` - Request detection failures
- `ModelLoadError` - ML model loading failures

### Integration Exceptions
- `GmailAPIError` - Gmail API failures
- `SendGridAPIError` - SendGrid API failures

### Data Exceptions
- `DatabaseError` - Database operation failures
- `ValidationError` - Data validation failures
- `ConfigurationError` - Configuration errors

### Business Logic Exceptions
- `DuplicateDeadlineError` - Duplicate deadline detection

## Monitoring and Health Checks

### Metrics Collection

```python
from utils import metrics

# Increment counters
metrics.increment_counter("documents_processed", status="success")
metrics.increment_counter("api_calls", endpoint="/deadlines")

# Set gauges
metrics.set_gauge("active_connections", 42)
metrics.set_gauge("queue_depth", len(queue))

# Get metrics
counters = metrics.get_counters()
gauges = metrics.get_gauges()
performance = metrics.get_performance_metrics()
```

### Health Checks

```python
from utils import HealthCheck

# Check system health
health = HealthCheck.check_system_health()
print(f"Status: {health['status']}")
print(f"Uptime: {health['metrics']['uptime_seconds']}")
print(f"Success rate: {health['metrics']['success_rate']}")

# Get comprehensive report
report = HealthCheck.get_metrics_report()
print(report['health'])
print(report['performance'])
print(report['errors'])
```

## Log Configuration

### Log Files

- `logs/app.log` - All application logs (INFO and above)
- `logs/error.log` - Error logs only (ERROR and above)
- Console output - Colorized logs for development

### Log Format

#### Standard Format (Development)
```
2025-01-31 10:30:45,123 - INFO - pdf_parser - Parsing PDF: document.pdf
2025-01-31 10:30:45,456 - ERROR - deadline_extractor - Failed to extract deadline
```

#### JSON Format (Production)
```json
{
  "timestamp": "2025-01-31T10:30:45.123Z",
  "level": "INFO",
  "logger": "pdf_parser",
  "message": "Parsing PDF: document.pdf",
  "module": "pdf_parser",
  "function": "parse_file",
  "line": 45,
  "extra": {
    "pdf_path": "/path/to/document.pdf",
    "page_count": 5
  }
}
```

### Log Levels

- **DEBUG** - Detailed diagnostic information
- **INFO** - General informational messages
- **WARNING** - Warning messages for unexpected conditions
- **ERROR** - Error messages for failures
- **CRITICAL** - Critical errors requiring immediate attention

## Best Practices

### 1. Always Use Custom Exceptions

```python
# BAD
raise Exception("PDF parsing failed")

# GOOD
raise PDFProcessingError(
    "Failed to parse PDF",
    pdf_path=pdf_path,
    error_details=str(e)
)
```

### 2. Include Context in Logs

```python
# BAD
logger.info("Processing document")

# GOOD
logger.info(
    "Processing document",
    extra={
        'doc_id': doc_id,
        'user_id': user_id,
        'processing_stage': 'extraction'
    }
)
```

### 3. Use Appropriate Decorators

```python
# For external API calls - use retry
@retry(max_attempts=3, exceptions=(ConnectionError, Timeout))
def call_external_api():
    pass

# For performance-critical operations - track performance
@track_performance()
def expensive_operation():
    pass

# For operations that can fail gracefully
def get_optional_data():
    with graceful_degradation("fetch_data", default_value=[]):
        return fetch_from_cache()
```

### 4. Handle Errors at Appropriate Levels

```python
# Low-level: Raise specific exceptions
def parse_pdf(pdf_path):
    if not pdf_path.exists():
        raise PDFProcessingError("File not found", pdf_path=str(pdf_path))

# Mid-level: Add context and re-raise
def process_document(doc_id):
    try:
        pdf_data = parse_pdf(pdf_path)
    except PDFProcessingError as e:
        logger.error(f"Failed to process document {doc_id}", exc_info=True)
        raise

# High-level: Catch and return user-friendly errors
def api_process_document(doc_id):
    try:
        result = process_document(doc_id)
        return {"success": True, "result": result}
    except PDFProcessingError as e:
        return {"success": False, "error": e.to_dict()}
```

### 5. Monitor Critical Operations

```python
from utils import track_performance, error_reporter

@track_performance()
def critical_operation():
    try:
        # Critical business logic
        result = perform_operation()
        metrics.increment_counter("critical_ops", status="success")
        return result
    except Exception as e:
        metrics.increment_counter("critical_ops", status="failure")
        error_reporter.report(e, severity='critical')
        raise
```

## Testing

### Running Tests

```bash
# Run error handling tests
python -m pytest tests/test_error_handling.py -v

# Run with coverage
python -m pytest tests/test_error_handling.py --cov=utils --cov-report=html
```

### Demo Script

```bash
# Run the demo to see all features in action
python demo_error_handling.py
```

## Integration with Other Modules

### PDF Parser Integration

The PDF parser uses:
- `PDFProcessingError` for file and parsing errors
- `@track_performance()` for processing metrics
- `@retry()` for handling temporary I/O errors
- `safe_operation()` context manager for cleanup

### Deadline Extractor Integration

The deadline extractor uses:
- `DeadlineExtractionError` for extraction failures
- `ModelLoadError` for spaCy model issues
- `@track_performance()` for performance monitoring
- `graceful_degradation()` for handling individual failures

### Request Detector Integration

The request detector uses:
- `RequestDetectionError` for detection failures
- `@track_performance()` for processing metrics
- Comprehensive logging at each processing step

## Production Deployment

### Environment Configuration

```bash
# .env
LOG_LEVEL=INFO
LOG_JSON=true
LOG_DIR=/var/log/legal-advocate
METRICS_ENABLED=true
ERROR_REPORTING_ENABLED=true
```

### Monitoring Setup

1. **Log Aggregation**: Configure log shipping to ELK/Datadog/CloudWatch
2. **Metrics**: Export metrics to Prometheus/Grafana
3. **Alerts**: Set up alerts for:
   - Error rate > 5%
   - P95 latency > threshold
   - Critical errors
   - Health check failures

### Health Check Endpoint

```python
from fastapi import FastAPI
from utils import HealthCheck

app = FastAPI()

@app.get("/health")
async def health_check():
    return HealthCheck.check_system_health()

@app.get("/metrics")
async def metrics():
    return HealthCheck.get_metrics_report()
```

## Troubleshooting

### Issue: Logs not appearing

**Solution**: Check log level configuration and ensure logging is initialized:
```python
setup_logging(level="DEBUG")  # Lower level for troubleshooting
```

### Issue: Performance degradation

**Solution**: Review performance metrics:
```python
metrics = metrics.get_performance_metrics()
# Look for operations with high error_count or avg_duration
```

### Issue: Too many retries

**Solution**: Adjust retry parameters or fix underlying issue:
```python
@retry(max_attempts=2, delay=0.5)  # Reduce retries
def operation():
    pass
```

## Appendix

### Complete Example

```python
from utils import (
    setup_logging,
    get_logger,
    PDFProcessingError,
    retry,
    track_performance,
    graceful_degradation,
    safe_operation,
    metrics,
    error_reporter,
)

# Initialize logging
setup_logging(level="INFO", json_logs=True)
logger = get_logger(__name__)

@track_performance()
@retry(max_attempts=3, delay=1.0, exceptions=(ConnectionError,))
def process_legal_document(doc_id: str) -> dict:
    """Complete example of error handling patterns"""
    logger.info("Starting document processing", extra={'doc_id': doc_id})

    try:
        # Use safe operation for cleanup
        with safe_operation(f"process_{doc_id}", logger):
            # Parse PDF with custom error handling
            try:
                pdf_data = parse_pdf(doc_id)
            except PDFProcessingError as e:
                error_reporter.report(e, severity='error')
                raise

            # Extract deadlines with graceful degradation
            with graceful_degradation("extract_deadlines", default_value=[]) as result:
                result.value = extract_deadlines(pdf_data)

            # Detect requests
            requests = detect_requests(pdf_data)

            # Track success
            metrics.increment_counter("documents_processed", status="success")

            return {
                "deadlines": result.value,
                "requests": requests,
                "status": "success"
            }

    except Exception as e:
        logger.error(f"Document processing failed for {doc_id}", exc_info=True)
        metrics.increment_counter("documents_processed", status="failure")
        error_reporter.report(e, context={'doc_id': doc_id}, severity='error')
        raise
```

## Future Enhancements

1. **Distributed Tracing**: Integrate OpenTelemetry for request tracing
2. **Advanced Metrics**: Add custom metrics dashboards
3. **Alert Rules**: Implement sophisticated alerting rules
4. **Log Analysis**: Add automated log analysis and anomaly detection
5. **Error Budgets**: Implement SLO-based error budgets
