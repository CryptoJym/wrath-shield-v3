# HYRO Forge v4 API Documentation

The unified API layer for the HYRO Forge multi-agent assessment system.

## Base URL

```
/api/hyro/forge/v4
```

## Main Route (`/api/hyro/forge/v4`)

### GET Endpoints

| Action | Description | Parameters |
|--------|-------------|------------|
| `session` | Get current session state | `session_id` |
| `next-item` | Get next assessment item | `session_id` |
| `progress` | Get real-time progress | `session_id` |
| `available-stats` | List stats available for assessment | - |

### POST Endpoints

| Action | Description | Required Body |
|--------|-------------|---------------|
| `start-diagnostic` | Start single-stat diagnostic | `stat_name`, optional: `target_items`, `convergence_threshold` |
| `start-multi-stat` | Start multi-stat battery | `stats[]`, optional: `items_per_stat` |
| `submit-response` | Submit student response | `session_id`, `response`, optional: `response_time_ms` |
| `pause-session` | Pause for later resumption | `session_id` |
| `resume-session` | Resume a paused session | `session_id`, `resume_token` |
| `complete-session` | End and finalize results | `session_id`, optional: `force` |

### Example: Start Diagnostic

```bash
curl -X POST /api/hyro/forge/v4 \
  -H "Content-Type: application/json" \
  -d '{"action": "start-diagnostic", "stat_name": "math", "target_items": 15}'
```

### Example: Submit Response

```bash
curl -X POST /api/hyro/forge/v4 \
  -H "Content-Type: application/json" \
  -d '{"action": "submit-response", "session_id": "diag_xxx", "response": "b", "response_time_ms": 5000}'
```

---

## Reports Route (`/api/hyro/forge/v4/reports`)

### GET Endpoints

| Action | Description | Parameters |
|--------|-------------|------------|
| `diagnostic-report` | Full diagnostic results | `session_id` OR `result_id` OR `stat_name` |
| `strand-breakdown` | Detailed strand analysis | `stat_name` |
| `recommendations` | AI-generated learning path | `stat_name`, optional: `target_level` |
| `history` | Assessment history | optional: `stat_name`, `limit`, `offset` |

### Example: Get Diagnostic Report

```bash
curl "/api/hyro/forge/v4/reports?action=diagnostic-report&stat_name=math"
```

### Example: Get Learning Recommendations

```bash
curl "/api/hyro/forge/v4/reports?action=recommendations&stat_name=math&target_level=80"
```

---

## Memory Route (`/api/hyro/forge/v4/memory`)

### GET Endpoints

| Action | Description | Parameters |
|--------|-------------|------------|
| `student-context` | Comprehensive learning context | - |
| `misconceptions` | Tracked misconceptions | optional: `stat_name`, `status` |
| `learning-events` | Recorded learning events | optional: `event_type`, `stat_name`, `limit` |

### POST Endpoints

| Action | Description | Required Body |
|--------|-------------|---------------|
| `record-event` | Record significant learning event | `event_type`, optional: `stat_name`, `strand`, `event_data` |
| `update-misconception` | Update misconception status | `stat_name`, `misconception`, `status` |
| `record-context` | Record contextual information | `context_type`, `context_data` |

### Event Types

- `breakthrough` - Major understanding gain
- `struggle` - Persistent difficulty
- `misconception` - New misconception identified
- `mastery` - Strand/skill mastery achieved
- `engagement_peak` - High engagement moment
- `learning_style` - Learning preference observed
- `goal_set` / `goal_achieved` - Goal tracking
- `feedback_given` - Explicit feedback provided
- `custom` - Custom event

### Example: Record Event

```bash
curl -X POST /api/hyro/forge/v4/memory \
  -H "Content-Type: application/json" \
  -d '{"action": "record-event", "event_type": "breakthrough", "stat_name": "math", "event_data": {"strand": "Algebra I"}}'
```

---

## Admin Route (`/api/hyro/forge/v4/admin`)

### GET Endpoints

| Action | Description | Parameters |
|--------|-------------|------------|
| `item-log` | Generated items audit log | optional: `session_id`, `stat_name`, `limit`, `include_content` |
| `session-stats` | Session and usage statistics | optional: `stat_name`, `period_days` |
| `system-health` | System health and performance | - |
| `difficulty-analysis` | Analyze item calibration | `stat_name` |

### POST Endpoints

| Action | Description | Required Body |
|--------|-------------|---------------|
| `calibrate` | Recalibrate difficulty parameters | `stat_name`, optional: `strand`, `apply_changes` |
| `cleanup-sessions` | Clean up stuck sessions | optional: `max_age_hours`, `dry_run` |
| `export-data` | Export assessment data | optional: `format`, `include_items` |

### Example: Get Session Stats

```bash
curl "/api/hyro/forge/v4/admin?action=session-stats&period_days=30"
```

### Example: Calibrate Difficulty

```bash
curl -X POST /api/hyro/forge/v4/admin \
  -H "Content-Type: application/json" \
  -d '{"action": "calibrate", "stat_name": "math", "apply_changes": false}'
```

---

## Available Stats

The following stats are supported across all endpoints:

- `math`
- `reading`
- `writing`
- `science`
- `social_studies`
- `financial_literacy`
- `coding`
- `study_skills`
- `critical_thinking`
- `technology`
- `problem_solving`

---

## Response Format

All endpoints return JSON with the following structure:

```json
{
  "success": true,
  "data": { ... },
  "timing_ms": 150
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Session Lifecycle

1. **Start** → `POST /v4 action=start-diagnostic`
2. **Get Item** → `GET /v4 action=next-item&session_id=xxx`
3. **Submit** → `POST /v4 action=submit-response`
4. **Repeat** steps 2-3 until `complete: true` in response
5. **Complete** → `POST /v4 action=complete-session`
6. **Report** → `GET /v4/reports action=diagnostic-report`

## Multi-Stat Assessment

1. **Start** → `POST /v4 action=start-multi-stat` with `stats: ["math", "reading", "science"]`
2. **Assess** → Same item/submit cycle, auto-advances through stats
3. **Complete** → Returns results for all stats assessed
