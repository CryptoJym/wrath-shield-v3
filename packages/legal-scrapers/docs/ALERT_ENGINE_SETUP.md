# Alert Engine Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
# Install required packages
pip install -r requirements.txt

# Verify installation
python -c "import apscheduler; import sendgrid; print('✅ Alert engine dependencies installed')"
```

### 2. Configure SendGrid

#### Option A: Get SendGrid API Key
1. Sign up at [SendGrid](https://sendgrid.com)
2. Navigate to Settings → API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the API key

#### Option B: Use Environment Variables
```bash
# Add to .env file
SENDGRID_API_KEY=your_sendgrid_api_key_here
ALERT_FROM_EMAIL=alerts@yourdomain.com
```

#### Option C: Programmatic Configuration
```python
from alert_engine import AlertConfig, start_alert_engine

config = AlertConfig(
    sendgrid_api_key="your_key_here",
    from_email="alerts@yourdomain.com"
)

engine = start_alert_engine(config)
```

### 3. Verify Setup

```bash
# Run the demo to test everything
python examples/alert_engine_demo.py
```

## Integration with Your Application

### FastAPI Integration

```python
from fastapi import FastAPI
from alert_engine import start_alert_engine, stop_alert_engine, AlertConfig
import os

app = FastAPI()

@app.on_event("startup")
async def startup():
    """Start alert engine on application startup"""
    config = AlertConfig(
        sendgrid_api_key=os.getenv('SENDGRID_API_KEY'),
        from_email=os.getenv('ALERT_FROM_EMAIL'),
        check_schedule="0 */6 * * *"  # Every 6 hours
    )

    engine = start_alert_engine(config)
    app.state.alert_engine = engine
    print("✅ Alert engine started")

@app.on_event("shutdown")
async def shutdown():
    """Stop alert engine on application shutdown"""
    stop_alert_engine()
    print("⏹️  Alert engine stopped")

# Your application routes here...
```

### Standalone Service

```python
#!/usr/bin/env python3
"""
Alert Engine Service
Run as standalone background service
"""

import os
import signal
import sys
from alert_engine import start_alert_engine, stop_alert_engine, AlertConfig

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    print('\n⏹️  Stopping alert engine...')
    stop_alert_engine()
    sys.exit(0)

def main():
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Configure and start
    config = AlertConfig(
        sendgrid_api_key=os.getenv('SENDGRID_API_KEY'),
        from_email=os.getenv('ALERT_FROM_EMAIL'),
        check_schedule="0 */6 * * *"
    )

    engine = start_alert_engine(config)

    print("🚀 Alert engine running...")
    print("Press Ctrl+C to stop")

    # Keep running
    import time
    while True:
        time.sleep(60)

if __name__ == "__main__":
    main()
```

### Creating Alerts for New Deadlines

```python
from models.database import Deadline, get_session, get_engine
from repositories.deadline_repository import DeadlineRepository
from alert_engine import get_alert_engine
from datetime import datetime, timedelta

# Initialize database
engine = get_engine()
session = get_session(engine)

# Create deadline
deadline_repo = DeadlineRepository(session)
deadline = deadline_repo.create(
    case_number="CASE-001",
    user_id="client@example.com",
    deadline_type="filing",
    deadline_date=datetime.utcnow() + timedelta(days=30),
    action_required="File response to motion",
    responsible_party="self",
    status="pending"
)

# Create alerts
alert_engine = get_alert_engine()
alerts = alert_engine.create_alerts_for_deadline(
    deadline,
    channels=['email']
)

print(f"✅ Created {len(alerts)} alerts for {deadline.case_number}")
```

## Configuration Options

### Alert Intervals

```python
from alert_engine import AlertConfig

# Default: 30, 14, 7, 3, 1, 0 days before deadline
config = AlertConfig(
    alert_intervals=[30, 14, 7, 3, 1, 0]
)

# Minimal: Only critical alerts
config = AlertConfig(
    alert_intervals=[3, 1, 0]
)

# Extended: More warning time
config = AlertConfig(
    alert_intervals=[60, 30, 14, 7, 3, 1, 0]
)
```

### Schedule Frequency

```python
# Every 6 hours (default - recommended for production)
config = AlertConfig(check_schedule="0 */6 * * *")

# Every hour (for high-volume systems)
config = AlertConfig(check_schedule="0 * * * *")

# Daily at 9 AM
config = AlertConfig(check_schedule="0 9 * * *")

# Every 5 minutes (testing only!)
config = AlertConfig(check_schedule="*/5 * * * *")
```

### Retry Settings

```python
config = AlertConfig(
    max_retries=3,           # Number of retry attempts
    retry_delay=2.0,         # Initial delay (seconds)
    retry_backoff=2.0        # Multiplier for each retry
)
# Will retry at: 2s, 4s, 8s
```

### Batch Processing

```python
config = AlertConfig(
    batch_size=50  # Process 50 alerts at a time
)

# For high-volume systems
config = AlertConfig(
    batch_size=100
)

# For low-resource systems
config = AlertConfig(
    batch_size=10
)
```

## Monitoring

### Check Alert Statistics

```python
from alert_engine import get_alert_engine

engine = get_alert_engine()
stats = engine.get_alert_statistics()

print(f"""
Alert Statistics:
  Scheduled: {stats['scheduled']}
  Sent: {stats['sent']}
  Failed: {stats['failed']}
  Cancelled: {stats['cancelled']}
  Scheduler Running: {stats['scheduler_running']}
  Scheduled Jobs: {stats['scheduled_jobs']}
""")
```

### API Endpoint for Monitoring

```python
from fastapi import FastAPI
from alert_engine import get_alert_engine

app = FastAPI()

@app.get("/alerts/stats")
async def get_alert_stats():
    """Get alert engine statistics"""
    engine = get_alert_engine()
    return engine.get_alert_statistics()

@app.get("/alerts/health")
async def health_check():
    """Health check endpoint"""
    engine = get_alert_engine()
    return {
        "status": "healthy" if engine.scheduler.running else "stopped",
        "jobs": len(engine.scheduler.get_jobs())
    }
```

### Logging

```python
import logging
from alert_engine import start_alert_engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Start engine (will use configured logger)
engine = start_alert_engine()
```

## Testing

### Test Email Sending

```python
from alert_engine import AlertEngine, AlertConfig
from models.database import Deadline, Alert
from datetime import datetime

# Create test configuration
config = AlertConfig(
    sendgrid_api_key="your_test_key",
    from_email="test@example.com"
)

engine = AlertEngine(config, "sqlite:///test.db")

# Create test deadline and alert
deadline = Deadline(
    case_number="TEST-001",
    user_id="recipient@example.com",
    deadline_type="test",
    deadline_date=datetime.utcnow(),
    action_required="Test action",
    status="pending"
)

alert = Alert(
    deadline_id="test",
    alert_type="same_day",
    scheduled_at=datetime.utcnow(),
    channel="email",
    status="scheduled"
)
alert.deadline = deadline

# Test email generation
subject = engine._generate_email_subject(deadline, alert)
body = engine._generate_email_body(deadline, alert)

print(f"Subject: {subject}")
print(f"Body preview: {body[:200]}...")
```

### Run Unit Tests

```bash
# All tests
pytest tests/test_alert_engine.py -v

# Specific test category
pytest tests/test_alert_engine.py::TestAlertScheduling -v

# With coverage report
pytest tests/test_alert_engine.py --cov=alert_engine --cov-report=html
open htmlcov/index.html
```

### Run Interactive Demo

```bash
# Basic demo
python examples/alert_engine_demo.py

# With SendGrid configured
SENDGRID_API_KEY=your_key python examples/alert_engine_demo.py
```

## Troubleshooting

### Problem: Alerts not being sent

**Check:**
```python
from alert_engine import get_alert_engine

engine = get_alert_engine()

# 1. Is scheduler running?
print(f"Running: {engine.scheduler.running}")

# 2. Are there jobs scheduled?
jobs = engine.scheduler.get_jobs()
print(f"Jobs: {[j.id for j in jobs]}")

# 3. Are there alerts to send?
stats = engine.get_alert_statistics()
print(f"Scheduled alerts: {stats['scheduled']}")

# 4. Is SendGrid configured?
print(f"SendGrid configured: {engine.sendgrid_client is not None}")
```

**Fix:**
```python
# Start scheduler if not running
if not engine.scheduler.running:
    engine.start()

# Manually process alerts
engine.process_alerts()
```

### Problem: Failed alerts accumulating

**Check:**
```python
from models.database import get_session, get_engine
from repositories.alert_repository import AlertRepository

session = get_session(get_engine())
alert_repo = AlertRepository(session)

failed = alert_repo.get_failed_alerts()
print(f"Failed alerts: {len(failed)}")

for alert in failed[:5]:  # First 5
    print(f"  {alert.id}: {alert.error_message}")
```

**Fix:**
```python
# Retry failed alerts
engine = get_alert_engine()
retried = engine.retry_failed_alerts(limit=10)
print(f"Retried {retried} alerts")
```

### Problem: SendGrid errors

**Common errors:**
- `401 Unauthorized`: Check API key is correct
- `403 Forbidden`: Verify API key has Mail Send permission
- `429 Too Many Requests`: Hit rate limit, will auto-retry

**Debug:**
```python
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Test SendGrid directly
sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))

message = Mail(
    from_email='test@example.com',
    to_emails='recipient@example.com',
    subject='Test',
    html_content='<p>Test</p>'
)

response = sg.send(message)
print(f"Status: {response.status_code}")
```

## Production Deployment

### Environment Variables

```bash
# .env file for production
SENDGRID_API_KEY=your_production_api_key
ALERT_FROM_EMAIL=alerts@yourdomain.com

# Optional
DATABASE_URL=postgresql://user:pass@host/db
LOG_LEVEL=INFO
```

### Systemd Service (Linux)

```ini
# /etc/systemd/system/alert-engine.service
[Unit]
Description=Legal Advocate Alert Engine
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/legal-advocate
Environment="SENDGRID_API_KEY=your_key"
Environment="ALERT_FROM_EMAIL=alerts@yourdomain.com"
ExecStart=/opt/legal-advocate/venv/bin/python -m alert_engine
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable alert-engine
sudo systemctl start alert-engine

# Check status
sudo systemctl status alert-engine

# View logs
sudo journalctl -u alert-engine -f
```

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

ENV SENDGRID_API_KEY=""
ENV ALERT_FROM_EMAIL="alerts@example.com"

CMD ["python", "-m", "alert_engine"]
```

```bash
# Build and run
docker build -t alert-engine .
docker run -d \
  --name alert-engine \
  -e SENDGRID_API_KEY=your_key \
  -e ALERT_FROM_EMAIL=alerts@yourdomain.com \
  alert-engine
```

## Best Practices

### 1. Start Engine on Application Startup

Always start the alert engine when your application starts:

```python
@app.on_event("startup")
async def startup():
    start_alert_engine()
```

### 2. Create Alerts Immediately

Create alerts as soon as deadlines are added:

```python
# Bad: Delay in alert creation
deadline = deadline_repo.create(...)
# ... other code ...
engine.create_alerts_for_deadline(deadline)  # Too late!

# Good: Immediate alert creation
deadline = deadline_repo.create(...)
engine.create_alerts_for_deadline(deadline)  # Right away
```

### 3. Cancel Alerts on Completion

Always cancel alerts when deadlines are completed:

```python
deadline_repo.mark_completed(deadline.id)
engine.cancel_deadline_alerts(deadline.id)  # Don't forget!
```

### 4. Monitor Failed Alerts

Set up monitoring for failed alerts:

```python
from apscheduler.triggers.cron import CronTrigger

# Add retry job to scheduler
engine.scheduler.add_job(
    engine.retry_failed_alerts,
    trigger=CronTrigger.from_crontab("0 */2 * * *"),  # Every 2 hours
    id='retry_failed',
    kwargs={'limit': 20}
)
```

### 5. Use Production Schedule

Use appropriate schedule for production:

```python
# Development: frequent checks
config = AlertConfig(check_schedule="*/5 * * * *")  # Every 5 min

# Production: balanced approach
config = AlertConfig(check_schedule="0 */6 * * *")  # Every 6 hours

# High-volume: more frequent
config = AlertConfig(check_schedule="0 * * * *")    # Every hour
```

## Support

For issues or questions:
- Check the [Alert Engine Documentation](ALERT_ENGINE.md)
- Review [Implementation Summary](TASK_7_IMPLEMENTATION_SUMMARY.md)
- Run the demo: `python examples/alert_engine_demo.py`
- Check logs for error details
- Verify SendGrid configuration

## Next Steps

After setup:
1. ✅ Verify SendGrid deliverability
2. ✅ Test with sample deadlines
3. ✅ Monitor alert statistics
4. ✅ Configure alert preferences
5. ✅ Set up production monitoring
6. ✅ Deploy to production environment
