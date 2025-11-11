# Neurable Multi-Modal Integration Plan

**Date**: 2025-11-10
**Status**: 📋 Planning Complete - Ready for Phase 1 Execution
**Planning Method**: Sequential Thinking (Ultrathink) - 15 comprehensive thoughts

---

## Executive Summary

This plan integrates three independent data sources into a unified multi-modal timeline:
- **EEG Data** (Neurable → TimescaleDB): 12-channel brain activity at 256 Hz, tokenized to 1-second windows
- **Biometric Data** (WHOOP → SQLite): Recovery, strain, sleep metrics with event-based timestamps
- **Conversation Data** (Limitless → SQLite): Audio transcripts with ISO 8601 timestamps

**Key Decision**: Use a unified Python service layer (Timeline API) to bridge databases without migration, preserving existing infrastructure while enabling cross-modal analysis.

---

## Current System State

### Operational Components ✅
- **TimescaleDB**: Storing EEG tokens with novel tokenization equation
- **SQLite**: 139 records across Whoop cycles, recoveries, sleeps; 100 Limitless lifelogs synced
- **Neurable Ingest**: Two background processes running (watch mode + file mode)
- **Streamlit Dashboard**: Visualizing EEG data at http://localhost:8501/
- **Next.js API**: Running on port 8080 with WHOOP/Limitless OAuth

### Integration Gap 🔴
- **No cross-database queries**: Cannot correlate EEG with biometrics or conversations
- **No unified timeline**: Each data source displayed independently
- **No temporal synchronization**: Timestamp formats inconsistent (Unix vs ISO 8601)

---

## Architecture Decision: Unified Service Layer

### Option A: Migrate Everything to TimescaleDB ❌
- **Rejected**: Would require rewriting Next.js integration, breaking OAuth flows
- **Risk**: High complexity, potential data loss during migration

### Option B: Unified Python Service Layer ✅ **SELECTED**
- **Approach**: Create FastAPI service that queries both databases and merges results
- **Benefits**:
  - Preserves existing infrastructure
  - Single source of truth for multi-modal data
  - Flexible query patterns without schema changes
  - Clear separation of concerns

---

## Technical Challenges & Solutions

### Challenge 1: Timestamp Format Inconsistency
- **Problem**: TimescaleDB uses Unix timestamps, SQLite stores ISO 8601 strings
- **Solution**:
  - Normalize all timestamps to ISO 8601 in API responses
  - Create conversion utilities: `unix_to_iso8601()` and `iso8601_to_unix()`
  - Validate all timestamps before storage

### Challenge 2: Data Granularity Mismatch
- **Problem**: EEG at 1-second windows, Whoop events are daily/hourly, Limitless conversations are variable-length
- **Solution**:
  - API accepts flexible time ranges (1 minute to 30 days)
  - Return data at native granularity with interpolation flags
  - Client-side rendering handles density differences

### Challenge 3: Missing Data Handling
- **Problem**: EEG may have gaps, Whoop may miss recoveries, Limitless may have no conversations
- **Solution**:
  - Never fail entire request if one source unavailable
  - Return partial results with clear `data_quality` indicators
  - Cache last successful data per source

### Challenge 4: Performance at Scale
- **Problem**: Millions of EEG windows, queries could take seconds
- **Solution**:
  - Use TimescaleDB time-based partitioning (already implemented)
  - Add SQLite indexes on timestamp columns
  - Implement response streaming for large date ranges
  - 5-second timeout with cursor-based pagination

---

## Phase 1: Data Bridge Foundation (Week 1) 🔧

**Priority**: CRITICAL
**Goal**: Establish reliable data access across both databases

### Tasks
1. **Create SQLite Client Library** (`services/timeline-api/sqlite_client.py`)
   ```python
   class SQLiteClient:
       def get_whoop_cycles(self, start: str, end: str) -> List[Cycle]:
           """Query cycles by ISO 8601 timestamp range"""

       def get_limitless_lifelogs(self, start: str, end: str) -> List[Lifelog]:
           """Query lifelogs with conversation snippets"""
   ```

2. **Implement Timestamp Normalization** (`services/timeline-api/timestamp_utils.py`)
   ```python
   def unix_to_iso8601(timestamp: int) -> str:
       """Convert Unix timestamp to ISO 8601 string"""

   def iso8601_to_unix(timestamp: str) -> int:
       """Convert ISO 8601 string to Unix timestamp"""

   def validate_timestamp_range(start: str, end: str) -> bool:
       """Ensure start < end and within 2020-2030"""
   ```

3. **Create Unified Query Interface** (`services/timeline-api/data_bridge.py`)
   ```python
   class DataBridge:
       def __init__(self):
           self.eeg_client = DatabaseClient()  # Existing TimescaleDB client
           self.sqlite_client = SQLiteClient()  # New SQLite client

       def query_timeline(self, start: str, end: str) -> TimelineResponse:
           """Fetch and merge data from all sources"""
   ```

4. **Write Unit Tests** (`services/timeline-api/tests/`)
   - Test each database client independently with mock data
   - Test timestamp conversion edge cases (leap seconds, timezone changes)
   - Test data alignment with known 24-hour fixtures

5. **Validate Data Alignment**
   - Use 2025-11-09 08:00:00Z to 2025-11-10 08:00:00Z (known period with all data)
   - Verify EEG windows align with Whoop events and Limitless conversations

### Success Criteria ✅
- [ ] Can query Whoop cycles by timestamp range
- [ ] Can query Limitless lifelogs by timestamp range
- [ ] Can query EEG tokens by timestamp range
- [ ] All queries return consistent ISO 8601 timestamps
- [ ] Test coverage >90%
- [ ] No data corruption during conversion

---

## Phase 2: Timeline Service API (Week 2) 🚀

**Priority**: HIGH
**Goal**: Expose unified multi-modal data via REST API

### Tasks
1. **Create FastAPI Service** (`services/timeline-api/main.py`)
   ```python
   from fastapi import FastAPI, HTTPException
   from data_bridge import DataBridge

   app = FastAPI()
   bridge = DataBridge()

   @app.get("/api/timeline")
   async def get_timeline(start: str, end: str, api_key: str):
       """Return synchronized EEG + Whoop + Limitless data"""
   ```

2. **Implement Core Endpoints**
   - **GET /api/timeline**: Unified multi-modal timeline
     - Query params: `start`, `end`, `granularity` (1min, 1hour, 1day)
     - Response: `{eeg: [], whoop: [], limitless: [], data_quality: {}}`

   - **GET /api/brain-state**: EEG with contextual annotations
     - Returns: EEG tokens enriched with Whoop recovery and conversation context

   - **GET /api/correlations**: Statistical relationships
     - Returns: Correlation coefficients between EEG metrics and biometrics

   - **GET /api/conversation-context**: Conversations with brain state
     - Returns: Limitless transcripts with aligned EEG power spectra

3. **Add API Authentication**
   ```python
   from fastapi import Security, HTTPException
   from fastapi.security import APIKeyHeader

   api_key_header = APIKeyHeader(name="X-API-Key")

   async def verify_api_key(api_key: str = Security(api_key_header)):
       if api_key not in VALID_API_KEYS:
           raise HTTPException(status_code=403, detail="Invalid API key")
   ```

4. **Add Request Validation**
   ```python
   from pydantic import BaseModel, validator

   class TimelineRequest(BaseModel):
       start: str
       end: str

       @validator('start', 'end')
       def validate_timestamp(cls, v):
           # Ensure ISO 8601 format, within 2020-2030
   ```

5. **Deploy with Docker**
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
   ```

### Success Criteria ✅
- [ ] Timeline endpoint returns synchronized data from all 3 sources
- [ ] Response time <500ms for 1-day query
- [ ] Graceful degradation when one source unavailable
- [ ] All endpoints secured with API keys
- [ ] Health checks pass (`/health`, `/health/deep`)

---

## Phase 3: Dashboard Enhancement (Week 3) 📊

**Priority**: MEDIUM
**Goal**: Visualize multi-modal timeline in Streamlit dashboard

### Tasks
1. **Update Streamlit Dashboard** (`services/eeg-tokenizer/app.py`)
   - Add Timeline API client
   - Replace direct TimescaleDB queries with API calls

2. **Create Synchronized 3-Panel Timeline View**
   ```
   ┌─────────────────────────────────────────────────────┐
   │  Timeline: 2025-11-09 08:00 - 12:00                │
   ├─────────────────────────────────────────────────────┤
   │  Panel 1: EEG Power Spectrum (1-second windows)    │
   │  [||||||||||||||||||||||||||||||||||||||||||||||||]  │
   ├─────────────────────────────────────────────────────┤
   │  Panel 2: Biometrics (Recovery, Strain, Sleep)    │
   │  ● Recovery: 78%  ● Strain: 12.4  ● Sleep: 85%    │
   ├─────────────────────────────────────────────────────┤
   │  Panel 3: Conversations (Limitless transcripts)   │
   │  "Discussing project deadlines..." [08:15-08:43]  │
   └─────────────────────────────────────────────────────┘
   ```

3. **Add Interactive Controls**
   - Date range selector (last 24h, 7d, 30d, custom)
   - Zoom controls (minute, hour, day granularity)
   - Play/pause for real-time updates

4. **Implement Missing Data Indicators**
   - Gray out EEG gaps with "No data" tooltip
   - Show "Sync delayed" for Limitless API issues
   - Display staleness warnings if data >1 hour old

5. **Add Real-Time Update Mechanism**
   ```python
   import streamlit as st
   import time

   if st.checkbox("Auto-refresh (every 30s)"):
       while True:
           timeline_data = fetch_timeline(start, end)
           render_timeline(timeline_data)
           time.sleep(30)
           st.rerun()
   ```

### Success Criteria ✅
- [ ] Dashboard displays all 3 data sources in synchronized view
- [ ] User can zoom to 1-minute granularity
- [ ] Timeline updates automatically when new EEG data arrives
- [ ] Visual indicators show data quality and gaps
- [ ] Load time <2 seconds for 24-hour view

---

## Phase 4: Real-time Integration (Week 4) ⏰

**Priority**: LOW
**Goal**: Automate data sync and monitoring

### Tasks
1. **Add Automated Whoop Sync**
   ```python
   # services/sync-scheduler/whoop_sync.py
   import schedule
   from wrath_shield.lib.WhoopClient import getWhoopClient

   def sync_whoop_data():
       client = getWhoopClient()
       cycles = client.fetchCyclesForDb(...)
       # Insert into SQLite

   schedule.every().day.at("06:00").do(sync_whoop_data)
   ```

2. **Add Automated Limitless Sync**
   ```python
   # services/sync-scheduler/limitless_sync.py
   from wrath_shield.lib.LimitlessClient import getLimitlessClient

   def sync_limitless_data():
       client = getLimitlessClient()
       count = client.syncNewLifelogs()

   schedule.every().hour.do(sync_limitless_data)
   ```

3. **Implement Data Freshness Monitoring**
   ```python
   def check_data_freshness():
       eeg_age = get_newest_eeg_timestamp_age()
       whoop_age = get_newest_whoop_timestamp_age()
       limitless_age = get_newest_limitless_timestamp_age()

       if eeg_age > 600:  # 10 minutes
           alert("EEG ingestion may be stopped")
   ```

4. **Add Alerting for Sync Failures**
   - Send email/Slack notification if sync fails >3 times
   - Log all failures with stack traces
   - Implement exponential backoff for retries

5. **Create Admin Dashboard**
   - Show last successful sync times for each source
   - Display error counts and types
   - Provide manual sync triggers

### Success Criteria ✅
- [ ] Whoop data updates automatically every 24 hours
- [ ] Limitless data updates automatically every hour
- [ ] Alerts fire if sync fails >3 consecutive times
- [ ] Admin dashboard shows system health at a glance
- [ ] Zero manual intervention needed for daily operation

---

## Testing Strategy

### Unit Tests (per service)
- **Timeline API**: Mock database responses, test merge logic
- **SQLite queries**: Use test fixtures with known data
- **TimescaleDB queries**: Test with sample EEG windows
- **Timestamp normalization**: Edge cases (leap seconds, timezone changes)

### Integration Tests (cross-service)
- **Timeline endpoint**: Real databases with test data
- **Data alignment**: Verify EEG aligns with Whoop events
- **Missing data**: Test gaps in each source independently
- **Performance**: Benchmark 1-week, 1-month, 3-month queries

### End-to-End Tests (full stack)
- **Dashboard → Timeline API → Databases**: Complete user flow
- **User workflow**: Load timeline, zoom in, verify sync
- **Real-time updates**: Verify new EEG appears without manual refresh

### Test Data Strategy
- Use 2025-11-09 08:00:00Z to 2025-11-10 08:00:00Z (24-hour known period)
- Create fixtures with edge cases:
  - Missing Whoop recovery
  - Gaps in EEG (simulate sensor disconnection)
  - Overlapping Limitless conversations
- Mock timestamps for reproducible tests

---

## Error Handling & Resilience

### Database Connection Failures
- **TimescaleDB down**: Return EEG unavailable, show cached data
- **SQLite locked**: Retry with exponential backoff (max 3 attempts)
- **Both down**: Return last cached data with staleness indicator

### Data Quality Issues
- **Corrupted EEG tokens**: Skip malformed windows, log error, continue
- **Missing Whoop recovery**: Show gap with "No data" indicator
- **Limitless API rate limit**: Use cached lifelogs, show "sync delayed"

### Timestamp Synchronization Errors
- **Clock drift**: Use database insert timestamp as fallback
- **Malformed ISO 8601**: Try multiple parse formats, reject if all fail
- **Future timestamps**: Log warning, exclude from timeline

### Performance Degradation
- **Query timeout (>5s)**: Return partial results with continuation cursor
- **Memory limit**: Batch process large date ranges
- **Too many concurrent requests**: Queue with max 10 concurrent

### Resilience Patterns
1. **Circuit Breaker**: After 3 Limitless API failures, use cached data for 60s
2. **Graceful Degradation**: Timeline loads even if one source fails
3. **Data Validation**: Check EEG tokens within -5000 to +5000 μV range
4. **Logging**: Log all errors with context (query, timestamp range, user)

---

## Security Considerations

### Database Access Control
- **TimescaleDB**: Read-only user for Timeline API
- **SQLite**: File permissions 0600, only service user
- **Never expose credentials** to frontend (already enforced)

### API Authentication
- **Timeline API**: Require `X-API-Key` header for all endpoints
- **Generate unique keys** per service (Next.js, Streamlit separate)
- **Rate limiting**: 100 requests/minute per API key
- **Key rotation**: Every 90 days

### Data Encryption
- **At rest**: AES-256-GCM for Whoop tokens, Limitless API key (already done)
- **In transit**: HTTPS for all API calls, even localhost in production
- **EEG raw data**: Consider pgcrypto extension for TimescaleDB

### Input Validation
- **Timestamp ranges**: Reject outside 2020-2030
- **SQL injection**: Use parameterized queries (already doing)
- **API input**: Pydantic models for all request validation

### Service Isolation
- **Docker network**: Isolated bridge network for services
- **Port exposure**: Only 8080 (Next.js), 8501 (Streamlit), 8082 (Timeline API)
- **Database ports**: 5432 NOT exposed to host

### Sensitive Data Handling
- **EEG tokens**: Treat as PHI (brain state is medical information)
- **Whoop biometrics**: HIPAA considerations for medical interpretations
- **Limitless conversations**: Encrypt PII before long-term storage

### Audit Logging
- **Timeline API**: Log all requests with API key ID, query params
- **Data access tracking**: Who queried EEG for which date ranges
- **Retention**: 90 days of audit logs

---

## Monitoring & Observability

### Metrics to Track

#### Data Source Health
- **TimescaleDB**: Connection pool utilization, query latency, rows/minute
- **SQLite**: Lock contention, query time, database size
- **Limitless API**: Success rate, rate limit headroom, sync lag
- **Whoop API**: Token expiration countdown, last sync timestamp

#### Timeline API Performance
- **Request rate**: requests/minute
- **Response time**: p50, p95, p99
- **Error rate**: by endpoint
- **Data freshness**: Age of newest data returned

#### Data Quality Metrics
- **EEG gaps**: % of time windows with missing data
- **Whoop completeness**: % of days with recovery + cycle + sleep
- **Limitless coverage**: Hours of conversation per day
- **Timestamp drift**: Max delta between system clocks

#### User Experience
- **Dashboard load time**
- **Timeline rendering latency**
- **User-facing error rate**
- **Session duration** (engagement metric)

### Monitoring Implementation

#### Prometheus Metrics
```python
from prometheus_client import Counter, Histogram, Gauge

request_count = Counter('timeline_requests_total', 'Total requests')
request_duration = Histogram('timeline_request_duration_seconds', 'Request duration')
eeg_data_age = Gauge('eeg_newest_timestamp_seconds', 'Age of newest EEG data')
```

#### Structured Logging (JSON)
```python
logger.info("timeline_query", extra={
    "start_time": "2025-11-09T08:00:00Z",
    "end_time": "2025-11-09T12:00:00Z",
    "eeg_rows": 14400,
    "whoop_events": 3,
    "limitless_convos": 2,
    "query_duration_ms": 234
})
```

#### Health Check Endpoints
- **GET /health**: Quick liveness check (200 OK if running)
- **GET /health/deep**: Check database connections, last data timestamps
- **GET /metrics**: Prometheus metrics endpoint

#### Alerting Rules
- Alert if EEG data >10 minutes old (ingestion stopped)
- Alert if Whoop sync fails 3 consecutive times
- Alert if Timeline API p95 latency >2 seconds
- Alert if any database connection fails

#### Observability Tools
- **Logs**: JSON to stdout, collected by Docker
- **Metrics**: Prometheus scraping `/metrics` every 15s
- **Tracing**: OpenTelemetry for distributed request tracing
- **Dashboards**: Grafana showing metrics, logs, data quality

---

## Deployment Architecture

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD}
    volumes:
      - timescale_data:/var/lib/postgresql/data
    networks:
      - wrath-internal
    # NOT exposed to host - internal only

  timeline-api:
    build: ./services/timeline-api
    ports:
      - "8082:8082"
    environment:
      - TIMELINE_API_KEY=${TIMELINE_API_KEY}
      - TIMESCALE_HOST=timescaledb
      - SQLITE_PATH=/data/wrath-shield.db
      - ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8501
    volumes:
      - ./wrath-shield-v3/.data:/data:ro  # Read-only SQLite access
    depends_on:
      - timescaledb
    networks:
      - wrath-internal

  streamlit-dashboard:
    build: ./services/eeg-tokenizer
    ports:
      - "8501:8501"
    environment:
      - TIMELINE_API_URL=http://timeline-api:8082
      - TIMELINE_API_KEY=${STREAMLIT_API_KEY}
    depends_on:
      - timeline-api
    networks:
      - wrath-internal

  nextjs-api:
    build: ./wrath-shield-v3
    ports:
      - "8080:8080"
    environment:
      - TIMELINE_API_URL=http://timeline-api:8082
      - TIMELINE_API_KEY=${NEXTJS_API_KEY}
    volumes:
      - ./wrath-shield-v3/.data:/app/.data  # Read-write SQLite access
    depends_on:
      - timeline-api
    networks:
      - wrath-internal

  sync-scheduler:
    build: ./services/sync-scheduler
    environment:
      - WHOOP_CLIENT_ID=${WHOOP_CLIENT_ID}
      - WHOOP_CLIENT_SECRET=${WHOOP_CLIENT_SECRET}
      - LIMITLESS_API_KEY=${LIMITLESS_API_KEY}
      - SQLITE_PATH=/data/wrath-shield.db
    volumes:
      - ./wrath-shield-v3/.data:/data
    depends_on:
      - timeline-api
    networks:
      - wrath-internal

networks:
  wrath-internal:
    driver: bridge

volumes:
  timescale_data:
```

### Port Allocations
- **8080**: Next.js API (existing)
- **8082**: Timeline API (new)
- **8501**: Streamlit Dashboard (existing)
- **5432**: TimescaleDB (internal only, not exposed)

---

## Success Metrics

### Technical Metrics
- **Query Latency**: <500ms for 1-day timeline
- **Uptime**: >99% for Timeline API
- **Test Coverage**: >90% for all new code
- **Data Freshness**: <1 hour lag for automated syncs

### User Metrics
- **Dashboard Load Time**: <2 seconds for 24-hour view
- **Data Availability**: All 3 sources synced within 1 hour
- **Error Rate**: <1% of timeline requests fail

### Business Metrics
- **Integration Complete**: All 3 data sources unified
- **Correlation Analysis**: Statistical relationships computable
- **Coaching Insights**: Multi-modal context available for LLM

---

## Risk Mitigation

### Technical Risks
1. **Database Performance**
   - Mitigation: Start with Phase 1 validation before building API
   - Test queries with realistic data volumes
   - Implement caching early

2. **Data Loss During Sync**
   - Mitigation: Use transactions for all writes
   - Validate data before insertion
   - Keep audit logs of all sync operations

3. **API Security Breach**
   - Mitigation: API key authentication from day 1
   - Rate limiting prevents abuse
   - Audit logs track all access

### Operational Risks
1. **Service Downtime**
   - Mitigation: Graceful degradation patterns
   - Health checks catch issues early
   - Alerting enables fast response

2. **Data Quality Issues**
   - Mitigation: Validation at ingestion
   - Missing data indicators prevent confusion
   - Manual override for edge cases

---

## Next Steps (Immediate Actions)

### ✅ Completed
- [x] Limitless lifelog sync (100 lifelogs synced)
- [x] Comprehensive integration planning (15 sequential thoughts)

### 🔄 In Progress
- [ ] Document integration plan (this file)

### ⏭️ Up Next (Phase 1 Execution)
1. Create `services/timeline-api/` directory structure
2. Implement SQLite client library
3. Implement timestamp normalization utilities
4. Write unit tests for database clients
5. Validate data alignment with test fixtures

---

## Conclusion

This plan provides a clear, phased approach to integrating Neurable EEG data with WHOOP biometrics and Limitless conversations. By using a unified service layer architecture, we preserve existing infrastructure while enabling powerful multi-modal analysis.

**Key Strengths**:
- ✅ Thorough planning using sequential thinking (ultrathink approach)
- ✅ Addresses all technical challenges (timestamps, granularity, missing data, performance)
- ✅ Comprehensive testing, security, and monitoring strategies
- ✅ Phased implementation with clear success criteria
- ✅ Risk mitigation at every level

**Ready for Execution**: Phase 1 can begin immediately with well-defined tasks and success criteria.

---

**Planning Completed**: 2025-11-10
**Next Milestone**: Phase 1 completion (Week 1)
**Contact**: See SYSTEM_OVERVIEW.md for current system status
## Live Streaming via WebSocket (Added 2025-11-10)

- Client: `services/eeg-tokenizer/neurable_ws_client.py` (Mac friendly)
- Config:
  - `NEURABLE_WS_URL` (default `ws://localhost:8765/neurable`)
  - `TIMESCALE_URL` for DB override if needed
- Behavior:
  - Connects to Neurable WS endpoint
  - Ingests 256 Hz × 12‑channel samples
  - Uses `OnlineTokenizer` to produce tokens each 1‑second window (50% overlap)
  - Inserts tokens into TimescaleDB (1 row per channel per window)
- Streamlit controls:
  - Open the EEG dashboard → Live Streaming → Start/Stop buttons
  - Stores the client process PID in session state for safe stop on Mac
