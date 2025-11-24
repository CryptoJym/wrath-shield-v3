# Monitoring and Observability Guide

Complete guide for monitoring Legal Advocate AI in production.

## Overview

Legal Advocate AI includes built-in monitoring capabilities:
- Health checks
- Performance metrics
- Error tracking (Sentry)
- Application logs
- Database monitoring

## Health Checks

### Built-in Health Endpoint

**Endpoint:** `GET /health`

**Response (Healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-05T12:00:00.000000",
  "version": "1.0.0",
  "uptime_seconds": 3600
}
```

**Response (Unhealthy):**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Connection timeout",
  "timestamp": "2025-10-05T12:00:00.000000"
}
```

### Health Check Configuration

**Railway/Render:** Automatic (configured in deployment files)

**Docker:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"
```

**Nginx (Uptime Monitoring):**
```nginx
location /health {
    proxy_pass http://127.0.0.1:8000/health;
    access_log off;  # Don't log health checks
}
```

### External Health Monitoring

**UptimeRobot (Free):**
1. Create account at https://uptimerobot.com
2. Add HTTP(s) monitor
3. URL: `https://yourdomain.com/health`
4. Interval: 5 minutes
5. Alert via email/SMS/Slack

**Pingdom:**
1. Create account at https://www.pingdom.com
2. Add uptime check
3. URL: `https://yourdomain.com/health`
4. Interval: 1 minute
5. Custom alerts

**StatusCake:**
1. Create account at https://www.statuscake.com
2. Add uptime test
3. URL: `https://yourdomain.com/health`
4. Check frequency: 30 seconds

## Performance Metrics

### Built-in Metrics Endpoint

**Endpoint:** `GET /metrics`

**Response:**
```json
{
  "performance": {
    "api": {
      "get_deadlines": {
        "count": 1250,
        "avg_ms": 45.3,
        "min_ms": 12.1,
        "max_ms": 234.5,
        "p95_ms": 89.2,
        "p99_ms": 156.7
      },
      "create_deadline": {
        "count": 156,
        "avg_ms": 78.9,
        "min_ms": 34.2,
        "max_ms": 456.1,
        "p95_ms": 178.3,
        "p99_ms": 289.4
      }
    },
    "database": {
      "query_deadlines": {
        "count": 2340,
        "avg_ms": 23.4,
        "slow_queries": 12
      }
    }
  },
  "errors": {
    "total": 23,
    "by_type": {
      "ValidationError": 15,
      "DatabaseError": 5,
      "NotFoundError": 3
    },
    "rate_per_hour": 1.2
  },
  "counters": {
    "requests_total": 45678,
    "requests_success": 45234,
    "requests_failed": 444,
    "alerts_sent": 234,
    "deadlines_created": 567
  },
  "gauges": {
    "active_connections": 12,
    "pending_alerts": 5,
    "queue_size": 23
  },
  "system": {
    "status": "healthy",
    "uptime_seconds": 86400,
    "memory_mb": 256.7,
    "cpu_percent": 12.3
  }
}
```

### Prometheus Integration (Optional)

Export metrics in Prometheus format:

```python
# api/monitoring/prometheus.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Define metrics
request_count = Counter('api_requests_total', 'Total API requests')
request_duration = Histogram('api_request_duration_seconds', 'Request duration')
active_users = Gauge('active_users', 'Number of active users')

# Endpoint
@app.get("/metrics/prometheus")
async def prometheus_metrics():
    return Response(generate_latest(), media_type="text/plain")
```

### Grafana Dashboard (Optional)

1. Install Prometheus exporter
2. Configure Grafana
3. Import dashboard JSON:

```json
{
  "dashboard": {
    "title": "Legal Advocate AI",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{"expr": "rate(api_requests_total[5m])"}]
      },
      {
        "title": "Error Rate",
        "targets": [{"expr": "rate(api_requests_failed[5m])"}]
      }
    ]
  }
}
```

## Error Tracking with Sentry

### Setup

1. Create Sentry account
2. Create new Python/FastAPI project
3. Copy DSN
4. Add to environment:
```bash
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Automatic Error Capture

Sentry automatically captures:
- Unhandled exceptions
- HTTP errors (4xx, 5xx)
- Database errors
- Validation errors

### Custom Error Tracking

```python
import sentry_sdk

# Capture custom error
try:
    process_deadline()
except Exception as e:
    sentry_sdk.capture_exception(e)

# Add context
sentry_sdk.set_context("deadline", {
    "id": deadline_id,
    "type": deadline_type,
    "user": user_id
})

# Add tags
sentry_sdk.set_tag("case_number", case_number)

# Add breadcrumbs
sentry_sdk.add_breadcrumb(
    category="deadline",
    message="Processing deadline",
    level="info"
)
```

### Performance Monitoring

```python
import sentry_sdk

# Track transaction
with sentry_sdk.start_transaction(name="process_deadlines") as transaction:
    # Track span
    with transaction.start_child(op="database.query") as span:
        deadlines = get_deadlines()

    with transaction.start_child(op="email.send") as span:
        send_alerts(deadlines)
```

### Sentry Alerts

Configure in Sentry dashboard:
- Error spike alerts (>100 errors/hour)
- New issue alerts
- Performance degradation
- Custom metric alerts

## Application Logging

### Log Levels

```python
# utils/logging_config.py
import logging

# Production: INFO or WARNING
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Log Structure

```json
{
  "timestamp": "2025-10-05T12:00:00.000000",
  "level": "INFO",
  "logger": "api.routes.deadlines",
  "message": "Deadline created",
  "context": {
    "deadline_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "user@example.com",
    "case_number": "2025-CV-1234"
  }
}
```

### Centralized Logging

**Option 1: Cloud Provider Logs**
- Railway: Automatic log aggregation
- Render: Built-in log viewer
- AWS: CloudWatch Logs
- GCP: Cloud Logging
- Azure: Application Insights

**Option 2: ELK Stack**
```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: elasticsearch:8.11.0

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
```

**Option 3: Papertrail/Logtail**
```bash
# Install remote syslog
pip install python-logging-loki

# Configure
import logging_loki

handler = logging_loki.LokiHandler(
    url="https://logs-xxx.grafana.net/loki/api/v1/push",
    tags={"app": "legal-advocate-ai"},
    auth=("user", "password")
)
```

### Log Aggregation

```bash
# View logs from all services
docker-compose logs -f

# Filter by service
docker-compose logs -f api

# Filter by level
docker-compose logs -f | grep ERROR

# Export to file
docker-compose logs --no-color > logs.txt
```

## Database Monitoring

### Query Performance

```sql
-- Slow query log (PostgreSQL)
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();

-- View slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Connection Monitoring

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Connections by state
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;

-- Long-running queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

### Database Metrics

```bash
# Database size
SELECT pg_size_pretty(pg_database_size('legal_advocate'));

# Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

## Alert Configuration

### Alert Channels

**Email:**
```python
# Send alert email
from utils.email import send_email

send_email(
    to="admin@example.com",
    subject="[ALERT] High Error Rate",
    body="Error rate exceeded 5% threshold"
)
```

**Slack:**
```python
import requests

def send_slack_alert(message):
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    requests.post(webhook_url, json={
        "text": message,
        "username": "Legal Advocate AI",
        "icon_emoji": ":warning:"
    })
```

**PagerDuty:**
```python
import pypd

pypd.api_key = os.getenv("PAGERDUTY_API_KEY")

def create_incident(title, details):
    incident = pypd.Incident.create(
        title=title,
        service=pypd.Service.find_one(name="Legal Advocate AI"),
        body={"type": "incident_body", "details": details}
    )
```

### Alert Rules

```python
# utils/monitoring.py
class AlertRules:
    # Error rate threshold
    ERROR_RATE_THRESHOLD = 0.05  # 5%

    # Response time thresholds
    RESPONSE_TIME_P95_THRESHOLD = 1000  # 1 second
    RESPONSE_TIME_P99_THRESHOLD = 2000  # 2 seconds

    # Database thresholds
    SLOW_QUERY_THRESHOLD = 1000  # 1 second
    CONNECTION_THRESHOLD = 50  # Max connections

    # Queue thresholds
    QUEUE_SIZE_THRESHOLD = 1000
    QUEUE_AGE_THRESHOLD = 3600  # 1 hour
```

## Monitoring Dashboard

### Simple Dashboard (Streamlit)

```python
# monitoring_dashboard.py
import streamlit as st
import requests
import pandas as pd

st.title("Legal Advocate AI - Monitoring")

# Get metrics
response = requests.get("https://api.yourdomain.com/metrics")
metrics = response.json()

# Display system status
st.metric("Status", metrics["system"]["status"])
st.metric("Uptime", f"{metrics['system']['uptime_seconds'] / 3600:.1f} hours")

# Display error rate
error_rate = metrics["errors"]["rate_per_hour"]
st.metric("Error Rate", f"{error_rate:.2f}/hour", delta=error_rate - 1.0)

# Display performance
df_perf = pd.DataFrame(metrics["performance"]["api"])
st.dataframe(df_perf)
```

### Advanced Dashboard (Grafana)

See Prometheus integration above for full Grafana setup.

## Best Practices

### 1. Monitoring Strategy

**The Four Golden Signals:**
1. **Latency:** Response times (p50, p95, p99)
2. **Traffic:** Requests per second
3. **Errors:** Error rate and types
4. **Saturation:** Resource utilization

### 2. Alert Fatigue Prevention

- Set appropriate thresholds
- Use alert aggregation
- Implement alert routing
- Schedule maintenance windows
- Document alert playbooks

### 3. Incident Response

```markdown
## Alert: High Error Rate

### Investigation Steps:
1. Check /metrics endpoint
2. Review Sentry dashboard
3. Check database connections
4. Review recent deployments
5. Check external service status

### Resolution:
1. Identify root cause
2. Implement fix
3. Deploy to production
4. Monitor for 1 hour
5. Document in incident log
```

### 4. Performance Baselines

```python
# Establish baselines
BASELINE_RESPONSE_TIME_P95 = 500  # ms
BASELINE_ERROR_RATE = 0.01  # 1%
BASELINE_DATABASE_TIME = 50  # ms

# Alert on deviation
if current_p95 > BASELINE_RESPONSE_TIME_P95 * 1.5:
    send_alert("Response time degraded")
```

## Monitoring Checklist

- [ ] Health checks configured
- [ ] Metrics endpoint accessible
- [ ] Sentry integrated
- [ ] Uptime monitoring active
- [ ] Log aggregation configured
- [ ] Database monitoring enabled
- [ ] Alert channels configured
- [ ] Alert rules defined
- [ ] Dashboards created
- [ ] Incident response documented
- [ ] Monitoring tested

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/)
- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)
