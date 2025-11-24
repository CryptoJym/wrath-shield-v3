# Alert Engine Documentation

## Overview

The Alert Engine is a background service that schedules and sends deadline notifications to users. It uses APScheduler for job scheduling and SendGrid for email delivery, with comprehensive retry logic and error handling.

## Features

- **Automated Scheduling**: Creates alerts at configurable intervals before deadlines (30, 14, 7, 3, 1, same-day)
- **Multi-Channel Support**: Email and in-app notifications
- **Priority-Based Alerts**: Critical, High, Medium, Low priority based on deadline urgency
- **Retry Logic**: Automatic retry with exponential backoff for failed notifications
- **Alert Cancellation**: Cancels scheduled alerts when deadlines are completed
- **Performance Tracking**: Comprehensive logging and metrics
- **Batch Processing**: Efficient processing of large alert volumes

## Architecture

### Components

```
alert_engine.py
├── AlertEngine          # Main service class
├── AlertConfig          # Configuration dataclass
├── AlertPriority        # Priority enum
└── Helper Functions     # Email generation, priority calculation
```

### Dependencies

- **APScheduler**: Background job scheduling
- **SendGrid**: Email delivery API
- **SQLAlchemy**: Database ORM
- **Repositories**: Alert and Deadline repositories

## Configuration

### AlertConfig

```python
from alert_engine import AlertConfig

config = AlertConfig(
    # Alert intervals (days before deadline)
    alert_intervals=[30, 14, 7, 3, 1, 0],  # 0 = same day

    # SendGrid settings
    sendgrid_api_key="your_sendgrid_key",
    from_email="alerts@yourdomain.com",
    from_name="Legal Advocate AI",

    # Scheduler settings
    check_schedule="0 */6 * * *",  # Cron expression (every 6 hours)

    # Retry settings
    max_retries=3,
    retry_delay=2.0,
    retry_backoff=2.0,

    # Batch processing
    batch_size=50
)
```

### Environment Variables

```bash
# Required
SENDGRID_API_KEY=your_sendgrid_api_key

# Optional
ALERT_FROM_EMAIL=alerts@yourdomain.com
```

## Usage

### Starting the Alert Engine

```python
from alert_engine import start_alert_engine, AlertConfig

# Create configuration
config = AlertConfig(
    sendgrid_api_key="your_key",
    from_email="alerts@example.com"
)

# Start the engine
engine = start_alert_engine(config)

# Engine now runs in background
# Processes alerts every 6 hours (configurable)
```

### Creating Alerts for a Deadline

```python
from models.database import Deadline
from alert_engine import get_alert_engine

# Create a deadline
deadline = Deadline(
    case_number="CASE-001",
    user_id="user@example.com",
    deadline_type="filing",
    deadline_date=datetime.utcnow() + timedelta(days=30),
    action_required="File response to motion",
    status="pending"
)

# Create alerts
engine = get_alert_engine()
alerts = engine.create_alerts_for_deadline(
    deadline,
    channels=['email', 'in_app']
)

# Creates alerts at: 30, 14, 7, 3, 1, and 0 days before deadline
```

### Cancelling Alerts

```python
# When a deadline is completed
deadline_repo.mark_completed(deadline.id)

# Cancel all scheduled alerts
engine.cancel_deadline_alerts(deadline.id)
```

### Manual Alert Processing

```python
# Manually trigger alert processing
engine.process_alerts()

# Retry failed alerts
retry_count = engine.retry_failed_alerts(limit=10)
```

### Stopping the Engine

```python
from alert_engine import stop_alert_engine

# Stop the scheduler gracefully
stop_alert_engine()
```

## Alert Scheduling

### Alert Types and Timing

| Alert Type | Days Before | Priority | Use Case |
|------------|-------------|----------|----------|
| `30_days` | 30 | Low | Early warning |
| `14_days` | 14 | Medium | Preparation time |
| `7_days` | 7 | Medium | Action reminder |
| `3_days` | 3 | High | Urgent reminder |
| `1_day` | 1 | High | Final notice |
| `same_day` | 0 | Critical | Immediate action |

### Priority Calculation

```python
def _get_alert_priority(deadline, alert):
    days_until = (deadline.deadline_date - datetime.utcnow()).days

    if days_until < 0 or alert.alert_type == 'same_day':
        return AlertPriority.CRITICAL
    elif days_until <= 3:
        return AlertPriority.HIGH
    elif days_until <= 14:
        return AlertPriority.MEDIUM
    else:
        return AlertPriority.LOW
```

## Email Templates

### Subject Line Format

```
[PRIORITY] Deadline Alert: CASE-NUMBER - Deadline Type
```

Examples:
- `[CRITICAL] Deadline Alert: CASE-001 - Filing`
- `[HIGH] Deadline Alert: CASE-002 - Response`
- `Deadline Alert: CASE-003 - Discovery`

### Email Body

HTML email template includes:
- **Header**: Priority level with color coding
- **Case Information**: Case number, deadline type
- **Deadline Date**: Formatted date/time with days remaining
- **Action Required**: What needs to be done
- **Additional Details**: Responsible party, source document
- **Footer**: Alert type and instructions

Color Coding:
- **Critical**: Red (#dc3545)
- **High**: Orange (#fd7e14)
- **Medium**: Yellow (#ffc107)
- **Low**: Green (#28a745)

## Scheduler Jobs

### Process Alerts Job

- **ID**: `process_alerts`
- **Trigger**: Cron (default: every 6 hours)
- **Function**: Processes all scheduled alerts that are due
- **Features**: Batch processing, retry logic, error handling

### Update Overdue Job

- **ID**: `update_overdue`
- **Trigger**: Cron (daily at 1 AM)
- **Function**: Updates deadline status to 'overdue' for past-due items
- **Features**: Automatic status management

## Error Handling

### Retry Logic

All email sends include automatic retry with exponential backoff:

```python
@retry(max_attempts=3, delay=2.0, backoff=2.0)
def _send_email_alert(alert, alert_repo):
    # Send email
    # Retries 3 times: 2s, 4s, 8s delays
```

### Error States

| Status | Description | Action |
|--------|-------------|--------|
| `scheduled` | Alert waiting to be sent | Normal state |
| `sent` | Alert successfully delivered | Terminal state |
| `failed` | Alert send failed | Available for retry |
| `cancelled` | Alert cancelled | Terminal state |

### Failed Alert Recovery

```python
# Automatic retry of failed alerts
engine.retry_failed_alerts(limit=10)

# Manual retry
from repositories.alert_repository import AlertRepository

alert_repo = AlertRepository(session)
alert_repo.update(alert_id, status='scheduled')
engine.process_alerts()
```

## Monitoring and Logging

### Metrics

The engine logs the following metrics:
- `alerts_created`: Number of alerts created
- `alerts_processed`: Number of alerts processed
- `email_alert_sent`: Email alerts successfully sent
- `email_alert_failed`: Email alerts that failed
- `in_app_alert_created`: In-app alerts created
- `alerts_cancelled`: Alerts cancelled
- `alerts_retried`: Alerts retried
- `deadlines_overdue`: Deadlines marked overdue

### Statistics

```python
# Get current statistics
stats = engine.get_alert_statistics()

# Returns:
{
    'scheduled': 45,        # Alerts waiting to send
    'sent': 120,           # Successfully sent
    'failed': 5,           # Failed sends
    'cancelled': 10,       # Cancelled alerts
    'scheduler_running': True,
    'scheduled_jobs': 2
}
```

### Logging

```python
# Alert engine uses structured logging
logger.info(f"✅ Email alert sent: {alert.id} to {to_email}")
logger.warning(f"⚠️  No SendGrid API key - email alerts disabled")
logger.error(f"Failed to send alert {alert.id}: {error}")

# All logs include context
extra={
    'alert_id': alert.id,
    'deadline_id': deadline.id,
    'service': 'AlertEngine'
}
```

## Testing

### Running Tests

```bash
# Run all alert engine tests
pytest tests/test_alert_engine.py -v

# Run specific test class
pytest tests/test_alert_engine.py::TestAlertScheduling -v

# Run with coverage
pytest tests/test_alert_engine.py --cov=alert_engine --cov-report=html
```

### Test Coverage

The test suite covers:
- Configuration and initialization
- Alert scheduling logic
- Email sending and retry
- Priority calculation
- Alert cancellation
- Batch processing
- Scheduler jobs
- Error handling
- Statistics and monitoring

### Mocking SendGrid

```python
@patch('alert_engine.SendGridAPIClient')
def test_send_email(mock_sg_class):
    mock_sg = Mock()
    mock_response = Mock(status_code=202)
    mock_sg.send.return_value = mock_response

    # Test email sending
```

## Integration

### With Deadline Creation

```python
from models.database import Deadline
from repositories.deadline_repository import DeadlineRepository
from alert_engine import get_alert_engine

# Create deadline
deadline_repo = DeadlineRepository(session)
deadline = deadline_repo.create(
    case_number="CASE-001",
    user_id="user@example.com",
    deadline_type="filing",
    deadline_date=future_date,
    action_required="File response",
    status="pending"
)

# Automatically create alerts
engine = get_alert_engine()
engine.create_alerts_for_deadline(deadline)
```

### With Deadline Completion

```python
# Mark deadline complete
deadline_repo.mark_completed(deadline.id)

# Cancel pending alerts
engine.cancel_deadline_alerts(deadline.id)
```

### With FastAPI

```python
from fastapi import FastAPI
from alert_engine import start_alert_engine, stop_alert_engine

app = FastAPI()

@app.on_event("startup")
async def startup_event():
    # Start alert engine
    start_alert_engine()

@app.on_event("shutdown")
async def shutdown_event():
    # Stop alert engine gracefully
    stop_alert_engine()
```

## Best Practices

### 1. Configuration

- Store SendGrid API key in environment variables
- Use production-appropriate cron schedules
- Adjust batch size based on load
- Configure appropriate retry settings

### 2. Alert Management

- Create alerts immediately when deadlines are added
- Cancel alerts when deadlines are completed
- Monitor failed alerts and investigate patterns
- Regularly retry failed alerts

### 3. Performance

- Use batch processing for large volumes
- Monitor scheduler job execution times
- Track metrics and set up alerts on anomalies
- Consider rate limits for email service

### 4. Error Handling

- Always check for SendGrid configuration
- Log all errors with context
- Set up monitoring for critical failures
- Implement alerting for repeated failures

### 5. Testing

- Mock external services (SendGrid)
- Test all alert types and priorities
- Verify retry logic
- Test edge cases (past deadlines, etc.)

## Troubleshooting

### Common Issues

**Alerts not being sent**
- Check SendGrid API key is configured
- Verify scheduler is running: `engine.scheduler.running`
- Check alert status in database
- Review logs for errors

**Failed alerts accumulating**
- Run manual retry: `engine.retry_failed_alerts()`
- Check SendGrid account status
- Verify email addresses are valid
- Review error messages in failed alerts

**Scheduler not starting**
- Check for port conflicts
- Verify cron expression is valid
- Check database connectivity
- Review initialization logs

**Missing alerts for deadlines**
- Verify deadline date is in future
- Check alert intervals configuration
- Ensure `create_alerts_for_deadline` was called
- Check alert repository queries

## API Reference

### AlertEngine

```python
class AlertEngine:
    def __init__(config: AlertConfig, database_url: str)
    def start()  # Start scheduler
    def stop()  # Stop scheduler
    def process_alerts()  # Process due alerts
    def create_alerts_for_deadline(deadline, channels)
    def cancel_deadline_alerts(deadline_id)
    def retry_failed_alerts(limit)
    def update_overdue_deadlines()
    def get_alert_statistics()
```

### AlertConfig

```python
@dataclass
class AlertConfig:
    alert_intervals: List[int]
    sendgrid_api_key: str
    from_email: str
    from_name: str
    check_schedule: str
    max_retries: int
    retry_delay: float
    retry_backoff: float
    batch_size: int
```

### AlertPriority

```python
class AlertPriority(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
```

## Future Enhancements

- [ ] SMS notifications via Twilio
- [ ] Push notifications for mobile apps
- [ ] Webhook support for custom integrations
- [ ] Alert preferences per user
- [ ] Custom email templates per case type
- [ ] Alert escalation rules
- [ ] Multi-language support
- [ ] Alert scheduling based on business hours
- [ ] Integration with calendar systems
- [ ] Alert digest mode (daily summary)
