# Alert Engine Quick Reference

## 🚀 Quick Start

```python
from alert_engine import start_alert_engine, AlertConfig

config = AlertConfig(
    sendgrid_api_key="your_key",
    from_email="alerts@example.com"
)

engine = start_alert_engine(config)
```

## 📋 Common Operations

### Create Alerts for Deadline
```python
from alert_engine import get_alert_engine

engine = get_alert_engine()
alerts = engine.create_alerts_for_deadline(
    deadline,
    channels=['email', 'in_app']
)
```

### Cancel Alerts
```python
# When deadline completed
engine.cancel_deadline_alerts(deadline_id)
```

### Get Statistics
```python
stats = engine.get_alert_statistics()
# Returns: scheduled, sent, failed, cancelled counts
```

### Retry Failed
```python
count = engine.retry_failed_alerts(limit=10)
```

## 🎯 Alert Intervals

| Interval | Days Before | Alert Type |
|----------|-------------|------------|
| 30 days  | 30          | `30_days`  |
| 14 days  | 14          | `14_days`  |
| 7 days   | 7           | `7_days`   |
| 3 days   | 3           | `3_days`   |
| 1 day    | 1           | `1_day`    |
| Same day | 0           | `same_day` |

## 🎨 Priority Levels

| Priority | Days Until | Color  | Icon |
|----------|-----------|--------|------|
| CRITICAL | 0 or past | Red    | 🔴   |
| HIGH     | 1-3       | Orange | 🟠   |
| MEDIUM   | 7-14      | Yellow | 🟡   |
| LOW      | 30+       | Green  | 🟢   |

## ⚙️ Configuration

### Basic Config
```python
config = AlertConfig(
    alert_intervals=[30, 14, 7, 3, 1, 0],
    sendgrid_api_key="key",
    from_email="alerts@example.com",
    check_schedule="0 */6 * * *",  # Every 6 hours
    max_retries=3,
    batch_size=50
)
```

### Environment Variables
```bash
SENDGRID_API_KEY=your_key
ALERT_FROM_EMAIL=alerts@example.com
```

## 📅 Cron Schedules

| Schedule | Cron Expression | Use Case |
|----------|-----------------|----------|
| Every 6 hours | `0 */6 * * *` | Production (default) |
| Every hour | `0 * * * *` | High-volume |
| Daily 9 AM | `0 9 * * *` | Low-volume |
| Every 5 min | `*/5 * * * *` | Testing only |

## 🔄 Alert Lifecycle

```
1. Create:  create_alerts_for_deadline()
           ↓
2. Schedule: Status = 'scheduled'
           ↓
3. Process: process_alerts() (runs on schedule)
           ↓
4. Send:   Email/In-app notification
           ↓
5. Update: Status = 'sent' or 'failed'
           ↓
6. Retry:  retry_failed_alerts() (if failed)
```

## 📊 Status Values

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `scheduled` | Waiting to send | Processed by scheduler |
| `sent` | Successfully delivered | Terminal state |
| `failed` | Send failed | Available for retry |
| `cancelled` | Cancelled | Terminal state |

## 🧪 Testing

```bash
# Run tests
pytest tests/test_alert_engine.py -v

# With coverage
pytest tests/test_alert_engine.py --cov=alert_engine

# Run demo
python examples/alert_engine_demo.py
```

## 🔍 Monitoring

### Check Status
```python
engine = get_alert_engine()
print(f"Running: {engine.scheduler.running}")
print(f"Jobs: {len(engine.scheduler.get_jobs())}")
```

### Get Statistics
```python
stats = engine.get_alert_statistics()
print(f"""
Scheduled: {stats['scheduled']}
Sent: {stats['sent']}
Failed: {stats['failed']}
Cancelled: {stats['cancelled']}
""")
```

## 🐛 Troubleshooting

### Alerts Not Sending
```python
# Check scheduler
if not engine.scheduler.running:
    engine.start()

# Manual process
engine.process_alerts()
```

### Failed Alerts
```python
# Retry failed
engine.retry_failed_alerts(limit=10)

# Check errors
from repositories.alert_repository import AlertRepository
repo = AlertRepository(session)
failed = repo.get_failed_alerts()
for alert in failed:
    print(alert.error_message)
```

### SendGrid Issues
```python
# Test connection
from sendgrid import SendGridAPIClient
sg = SendGridAPIClient(api_key)
# Check: 401 = bad key, 403 = no permission
```

## 🔌 Integration Examples

### FastAPI
```python
@app.on_event("startup")
async def startup():
    start_alert_engine(config)

@app.on_event("shutdown")
async def shutdown():
    stop_alert_engine()
```

### Create Deadline with Alerts
```python
# Create deadline
deadline = deadline_repo.create(
    case_number="CASE-001",
    deadline_date=future_date,
    ...
)

# Create alerts immediately
engine.create_alerts_for_deadline(deadline)
```

### Complete Deadline
```python
# Mark complete
deadline_repo.mark_completed(deadline.id)

# Cancel alerts
engine.cancel_deadline_alerts(deadline.id)
```

## 📧 Email Template

### Subject Format
```
[PRIORITY] Deadline Alert: CASE-NUMBER - Type
```

### Body Includes
- Case details
- Deadline date & time
- Days remaining
- Action required
- Responsible party
- Source document

### Color Coding
- Critical: #dc3545 (red)
- High: #fd7e14 (orange)
- Medium: #ffc107 (yellow)
- Low: #28a745 (green)

## 🎯 Best Practices

### ✅ Do
- Create alerts immediately when deadline added
- Cancel alerts when deadline completed
- Monitor failed alerts regularly
- Use production schedule (every 6 hours)
- Configure SendGrid API key in environment
- Track metrics and statistics
- Test email deliverability

### ❌ Don't
- Don't delay alert creation
- Don't forget to cancel alerts
- Don't use test schedule in production
- Don't hardcode API keys
- Don't ignore failed alerts
- Don't skip error handling

## 📚 Documentation

- **Full Docs**: [ALERT_ENGINE.md](ALERT_ENGINE.md)
- **Setup Guide**: [ALERT_ENGINE_SETUP.md](ALERT_ENGINE_SETUP.md)
- **Implementation**: [TASK_7_IMPLEMENTATION_SUMMARY.md](TASK_7_IMPLEMENTATION_SUMMARY.md)
- **Demo**: `examples/alert_engine_demo.py`
- **Tests**: `tests/test_alert_engine.py`

## 🔗 Key Files

```
alert_engine.py                    # Main implementation
tests/test_alert_engine.py         # Test suite
examples/alert_engine_demo.py      # Interactive demo
docs/ALERT_ENGINE.md              # Full documentation
docs/ALERT_ENGINE_SETUP.md        # Setup guide
docs/ALERT_ENGINE_QUICK_REFERENCE.md  # This file
```

## 💡 Tips

1. **Start Simple**: Use default config first
2. **Test Locally**: Run demo before production
3. **Monitor Closely**: Check stats regularly
4. **Retry Failed**: Set up automatic retry job
5. **Log Everything**: Enable INFO level logging
6. **Scale Gradually**: Increase batch size as needed

## 🚨 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Bad SendGrid key | Check API key |
| `403 Forbidden` | No mail permission | Update API key permissions |
| `429 Rate Limit` | Too many requests | Will auto-retry |
| `No scheduler` | Engine not started | Call `engine.start()` |
| `No SendGrid client` | Missing API key | Set SENDGRID_API_KEY |

## 📞 Support

1. Check this quick reference
2. Review full documentation
3. Run the demo script
4. Check test suite for examples
5. Review error logs

---

**Version**: 1.0.0
**Last Updated**: Task #7 Implementation
**Status**: ✅ Production Ready
