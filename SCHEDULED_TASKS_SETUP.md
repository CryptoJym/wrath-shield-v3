# Life OS Scheduled Tasks Setup Report

**Date:** December 8, 2024
**Phase:** Phase 5 - Agent Orchestration Implementation
**Project:** Wrath Shield v3 - Life OS

---

## Executive Summary

The Life OS project already has a **comprehensive scheduling infrastructure** in place with multiple scheduling systems working in parallel:

1. **PM2 Ecosystem** - Production-grade process manager with cron-restart capabilities
2. **Internal Node-Cron Scheduler** - Fallback for serverless deployments (Railway/Vercel)
3. **Proactive Enablement System** - Agent-driven autonomous task execution
4. **API Cron Endpoints** - Vercel-compatible webhook-based scheduling

**Status:** ✅ Scheduling infrastructure is fully operational with 11 scheduled tasks already configured.

---

## 1. Existing Scheduling Systems

### 1.1 PM2 Ecosystem Configuration

**Location:** `/Users/jamesbrady/Projects/apps/wrath-shield-v3/ecosystem.config.js`

The PM2 configuration manages **11 scheduled processes**:

| Process Name | Schedule | Purpose | Script/Command |
|-------------|----------|---------|----------------|
| `wrath-shield-v3` | Always Running | Main Next.js application | `npm run start` |
| `wrath-scheduler` | Daily 3:00 AM | Nightly tasks (WHOOP, Limitless, psych analysis) | `scripts/nightly-tasks.ts` |
| `lifelog-hourly` | Hourly 4:00-23:00 | Sync Limitless lifelogs | `npm run sync:lifelogs` |
| `pipeline-hourly` | Hourly at :15 | Run data pipeline | `scripts/run-pipeline.sh` |
| `digest-morning` | Daily 7:05 AM | Morning briefing digest | `npm run daily:digest` |
| `shutdown-evening` | Daily 10:55 PM | Evening shutdown summary | `npm run daily:shutdown` |
| `legal-hourly` | Hourly at :20 | Legal pipeline processing | `npm run legal:run` |
| `finance-daily` | Daily 6:30 AM | Finance ingestion & rollup | `npm run finance:ingest && npm run finance:rollup` |
| `finance-auto-enrich-daily` | Daily 5:15 AM | Auto-enrich finance data | `npm run finance:auto-enrich` |
| `proactive-tick` | **Every minute** | Proactive agent tick (scheduled tasks + threshold monitoring) | `curl http://localhost:4242/api/proactive/tick` |
| `agentic-executor` | Every 10 minutes | Execute high-confidence agentic actions | `scripts/run-executors.ts` |

**Key Features:**
- Automatic restart on failure
- Memory-based restart (1GB threshold)
- Separate log files per process
- Health check monitoring for main app
- Environment-specific configurations (dev/prod)

### 1.2 Internal Node-Cron Scheduler

**Location:** `/Users/jamesbrady/Projects/apps/wrath-shield-v3/lib/cron/scheduler.ts`

**Purpose:** Provides scheduling for serverless deployments where PM2 is unavailable (Railway, Vercel).

**Status:** Active when `USE_PM2_CRON !== 'true'` and `NODE_ENV !== 'development'`

**Scheduled Jobs:**
- `proactive-tick` - Every minute
- `legal-hourly` - Hourly at :20
- `lifelog-hourly` - Hourly 4am-11pm
- `digest-morning` - 7:05am daily
- `finance-daily` - 6:30am daily

**Implementation:** Uses `node-cron` package with async handlers and error handling.

### 1.3 Proactive Enablement System

**Location:** `/Users/jamesbrady/Projects/apps/wrath-shield-v3/lib/agents/ProactiveEnablement.ts`

**Architecture:** Three-layer autonomous execution system:

```
┌─────────────────────────────────────────────────┐
│         PROACTIVE ENABLEMENT SYSTEM             │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ SCHEDULED  │  │   EVENT    │  │THRESHOLD │  │
│  │   TASKS    │  │  TRIGGERS  │  │ MONITORS │  │
│  └────────────┘  └────────────┘  └──────────┘  │
│         │               │              │        │
│         └───────────────┴──────────────┘        │
│                         │                       │
│                    ┌────▼────┐                  │
│                    │ ACTION  │                  │
│                    │ ENGINE  │                  │
│                    └─────────┘                  │
└─────────────────────────────────────────────────┘
```

**Features:**
- Scheduled tasks with cron expressions
- Event-driven triggers (email, messages, state changes)
- Threshold monitoring (deadlines, metrics, alerts)
- Three escalation levels: AUTO_EXECUTE, PROPOSE, CRITICAL
- Confidence-based execution

**API Endpoint:** `GET /api/proactive/tick?secret=<PROACTIVE_SECRET>`

**Execution:** Called every minute by PM2 `proactive-tick` process

### 1.4 API Cron Endpoints

**Locations:**
- `/app/api/cron/ingest/route.ts` - Unified inbox ingestion
- `/app/api/cron/process/route.ts` - PM task queue processing
- `/app/api/cron/status/route.ts` - Status monitoring
- `/app/api/proactive/tick/route.ts` - Proactive system tick

**Authentication:**
- CRON_SECRET environment variable
- Supports Bearer token and x-cron-secret header
- Vercel automatic cron authentication (x-vercel-cron header)

---

## 2. Agent-Specific Scheduled Tasks

Based on the Life OS agent configuration (`/config/agents.json`), here are the agent-specific scheduled tasks:

### 2.1 Executive Assistant (agent.ea)

**Current Status:**
- ✅ Morning briefing: `digest-morning` (7:05 AM daily)
- ✅ Evening shutdown: `shutdown-evening` (10:55 PM daily)

**Additional Recommended Tasks:**
- **Daily Agenda Generation** - 6:30 AM (before briefing)
  - Compile calendar events for the day
  - Surface high-priority tasks
  - Check for scheduling conflicts

- **Mid-day Check-in** - 1:00 PM
  - Review morning progress
  - Adjust afternoon priorities
  - Surface urgent items

- **Weekly Planning** - Sunday 6:00 PM
  - Prepare week-ahead view
  - Identify potential conflicts
  - Surface upcoming deadlines

### 2.2 Communications Agent (agent.comms / Inbox Steward)

**Current Status:**
- ✅ Inbox ingestion: Via API cron endpoint (can be triggered manually or via Vercel cron)
- ✅ Pipeline processing: `pipeline-hourly` (hourly at :15)

**Existing Implementation:**
- Unified ingestion of Gmail and Outlook
- Classification and routing through comms pipeline
- Event normalization to CommsEvents

### 2.3 Project Maestro (agent.pm)

**Current Status:**
- ✅ Queue processing: `agentic-executor` (every 10 minutes)
- ✅ PM task queue: Via `/api/cron/process` endpoint

**Additional Recommended Tasks:**
- **Weekly Report Generation** - Sunday 8:00 PM
  - Aggregate project progress
  - Identify blockers
  - Generate stakeholder updates

- **Daily Sync Check** - 9:00 AM
  - Verify GitHub ↔ Motion sync
  - Check for orphaned tasks
  - Validate project hierarchy

### 2.4 Finance Analyst (agent.finance)

**Current Status:**
- ✅ Daily ingestion: `finance-daily` (6:30 AM)
- ✅ Auto-enrichment: `finance-auto-enrich-daily` (5:15 AM)
- ✅ Rollup: Part of `finance-daily`

**Complete Coverage:** Finance agent has all necessary scheduled tasks.

### 2.5 Legal Advisor (agent.legal)

**Current Status:**
- ✅ Hourly pipeline: `legal-hourly` (hourly at :20)

**Complete Coverage:** Legal agent has necessary scheduled tasks.

### 2.6 Health Agent (agent.health / EEG)

**Current Status:**
- ✅ WHOOP data sync: `wrath-scheduler` (3:00 AM daily)
- ✅ Limitless lifelogs: `lifelog-hourly` (hourly 4am-11pm)
- ✅ Psych analysis: `wrath-scheduler` (3:00 AM daily)

**Complete Coverage:** Health monitoring has comprehensive scheduled tasks.

### 2.7 Hyro Education Agent (agent.hyro.education)

**Current Status:**
- ❌ No dedicated scheduled tasks

**Recommended Tasks:**
- **Daily Content Crawl** - 2:00 AM
  - Crawl education sources
  - Update recommendation store
  - Refresh content index

- **Weekly Digest** - Sunday 9:00 AM
  - Generate learning recommendations
  - Surface trending topics
  - Compile research updates

### 2.8 Orchestrator (agent.orchestrator / Conductor)

**Current Status:**
- ✅ Proactive tick: `proactive-tick` (every minute)
- ✅ Action execution: `agentic-executor` (every 10 minutes)

**Complete Coverage:** Orchestrator has real-time execution capabilities.

---

## 3. How to Manage Scheduled Tasks

### 3.1 Using PM2 (Recommended for Production)

**Start all processes:**
```bash
cd /Users/jamesbrady/Projects/apps/wrath-shield-v3
pm2 start ecosystem.config.js --env production
```

**Start specific process:**
```bash
pm2 start wrath-scheduler
pm2 start digest-morning
```

**Check status:**
```bash
pm2 status
pm2 list
```

**View logs:**
```bash
pm2 logs wrath-scheduler
pm2 logs digest-morning --lines 50
```

**Restart a process:**
```bash
pm2 restart wrath-scheduler
pm2 restart all
```

**Stop a process:**
```bash
pm2 stop wrath-scheduler
pm2 delete wrath-scheduler  # Remove from PM2
```

**Save PM2 configuration:**
```bash
pm2 save
pm2 startup  # Configure auto-start on system boot
```

### 3.2 Adding New Scheduled Tasks

**Option A: Add to PM2 Ecosystem (Recommended)**

Edit `/Users/jamesbrady/Projects/apps/wrath-shield-v3/ecosystem.config.js`:

```javascript
{
  name: 'my-new-task',
  script: 'bash',
  args: "-lc 'cd /Users/jamesbrady/Projects/apps/wrath-shield-v3 && npm run my:task'",
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  autorestart: false,
  watch: false,
  cron_restart: '0 8 * * *', // 8 AM daily
  env: { NODE_ENV: 'production' },
  error_file: './logs/my-task-error.log',
  out_file: './logs/my-task-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
}
```

Then reload PM2:
```bash
pm2 reload ecosystem.config.js
```

**Option B: Add to Internal Scheduler**

Edit `/lib/cron/scheduler.ts` and add to the `jobs` array:

```typescript
{
  name: 'my-new-task',
  schedule: '0 8 * * *', // 8 AM daily (cron format)
  handler: async () => {
    const { myTaskFunction } = await import('../path/to/module');
    await myTaskFunction();
  },
  enabled: true,
}
```

**Option C: Add to Proactive System**

Use the ProactiveEnablement API to register a scheduled task programmatically:

```typescript
import { getProactiveEnablement } from '@/lib/agents/ProactiveEnablement';

const proactive = getProactiveEnablement();

await proactive.registerScheduledTask({
  id: 'ea-weekly-report',
  name: 'EA Weekly Report',
  description: 'Generate weekly summary for EA agent',
  agentId: 'agent.ea',
  frequency: 'weekly',
  action: {
    type: 'invoke_agent',
    escalationLevel: 'AUTO_EXECUTE',
    confidence: 0.95,
    payload: {
      task: 'generate_weekly_report',
      recipients: ['james@example.com'],
    },
    description: 'Generate and send weekly EA report',
  },
  enabled: true,
});
```

### 3.3 Cron Expression Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Common Examples:**
- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 8 * * *` - 8 AM daily
- `0 8 * * 1` - 8 AM every Monday
- `*/10 * * * *` - Every 10 minutes
- `0 0 * * 0` - Midnight every Sunday
- `0 4-23 * * *` - Every hour from 4 AM to 11 PM

---

## 4. Environment Variables Required

Ensure these environment variables are set for scheduled tasks to work:

```bash
# Cron authentication
CRON_SECRET=<your-secret-key>
PROACTIVE_SECRET=<your-proactive-secret>

# PM2 scheduling control
USE_PM2_CRON=true  # Use PM2 cron, not internal scheduler

# Agent-specific
OPENROUTER_API_KEY=<your-key>
ZEP_API_KEY=<your-key>

# Finance
PLAID_CLIENT_ID=<your-client-id>
PLAID_SECRET=<your-secret>

# Legal
# (Add legal-specific env vars)

# Communications
GMAIL_CLIENT_ID=<your-client-id>
GMAIL_CLIENT_SECRET=<your-secret>
O365_CLIENT_ID=<your-client-id>
O365_CLIENT_SECRET=<your-secret>

# Health
WHOOP_CLIENT_ID=<your-client-id>
WHOOP_CLIENT_SECRET=<your-secret>
LIMITLESS_API_KEY=<your-key>
```

---

## 5. Monitoring and Debugging

### 5.1 Log Locations

All PM2 logs are stored in `/Users/jamesbrady/Projects/apps/wrath-shield-v3/logs/`:

```bash
ls -la logs/
# digest-error.log
# digest-out.log
# finance-error.log
# finance-out.log
# legal-error.log
# legal-out.log
# lifelog-hourly-error.log
# lifelog-hourly-out.log
# pipeline-error.log
# pipeline-out.log
# pm2-error.log
# pm2-out.log
# proactive-tick-error.log
# proactive-tick-out.log
# scheduler-error.log
# scheduler-out.log
# shutdown-error.log
# shutdown-out.log
```

### 5.2 Check Task Execution

**View recent executions:**
```bash
tail -f logs/digest-out.log
tail -f logs/proactive-tick-out.log
```

**Check for errors:**
```bash
tail -f logs/digest-error.log
grep -i error logs/*.log
```

**Check proactive system status:**
```bash
curl -s "http://localhost:4242/api/proactive/status" | jq
```

**Check PM queue status:**
```bash
curl -s "http://localhost:4242/api/cron/status" | jq
```

### 5.3 Manual Trigger

Test a scheduled task manually:

```bash
# Run digest
npm run daily:digest

# Run finance ingestion
npm run finance:ingest

# Run legal pipeline
npm run legal:run

# Run executors
npm run executors

# Trigger proactive tick
curl -s "http://localhost:4242/api/proactive/tick?secret=$PROACTIVE_SECRET" | jq
```

---

## 6. Recommendations for Phase 5

### 6.1 High Priority

1. **Add Hyro Education scheduled tasks**
   - Daily content crawl (2:00 AM)
   - Weekly digest (Sunday 9:00 AM)
   - Recommendation refresh

2. **Add EA enhanced scheduling**
   - Daily agenda generation (6:30 AM)
   - Mid-day check-in (1:00 PM)
   - Weekly planning session (Sunday 6:00 PM)

3. **Add PM weekly reporting**
   - Weekly report generation (Sunday 8:00 PM)
   - Daily sync validation (9:00 AM)

### 6.2 Medium Priority

1. **Enhance error handling**
   - Add retry logic for failed tasks
   - Implement exponential backoff
   - Send alerts on repeated failures

2. **Add metrics collection**
   - Track task execution time
   - Monitor success/failure rates
   - Alert on anomalies

3. **Implement task dependencies**
   - Ensure tasks run in correct order
   - Handle dependency failures gracefully

### 6.3 Low Priority

1. **Add adaptive scheduling**
   - Adjust frequency based on activity
   - Skip tasks when unnecessary
   - Optimize resource usage

2. **Implement task history**
   - Store execution history in database
   - Enable trend analysis
   - Support audit requirements

---

## 7. Scripts Reference

### Core Scheduled Scripts

| Script | Purpose | Agent |
|--------|---------|-------|
| `scripts/nightly-tasks.ts` | WHOOP, Limitless, psych analysis | Health |
| `scripts/sync-lifelogs.ts` | Sync Limitless lifelogs | Health |
| `scripts/daily-digest.ts` | Morning briefing | EA |
| `scripts/evening-shutdown.ts` | Evening summary | EA |
| `scripts/legal-runner.ts` | Legal pipeline | Legal |
| `scripts/finance-rollup.ts` | Finance rollup | Finance |
| `scripts/ingest-transactions.ts` | Plaid ingestion | Finance |
| `scripts/finance-auto-enrich.ts` | Auto-enrich finance data | Finance |
| `scripts/run-executors.ts` | Execute agentic actions | Orchestrator |
| `scripts/run-pipeline.sh` | Data pipeline | Multiple |

### Script Locations

All scripts are in `/Users/jamesbrady/Projects/apps/wrath-shield-v3/scripts/`

---

## 8. Next Steps

1. **Review existing scheduled tasks** - Verify all are running as expected
2. **Add recommended agent tasks** - Implement high-priority additions
3. **Set up monitoring** - Configure alerts for failures
4. **Document custom tasks** - Add project-specific scheduling needs
5. **Test failure scenarios** - Ensure graceful degradation

---

## Appendix A: Full PM2 Ecosystem Configuration

See `/Users/jamesbrady/Projects/apps/wrath-shield-v3/ecosystem.config.js`

## Appendix B: Proactive Enablement API

See `/Users/jamesbrady/Projects/apps/wrath-shield-v3/lib/agents/ProactiveEnablement.ts`

## Appendix C: Internal Scheduler

See `/Users/jamesbrady/Projects/apps/wrath-shield-v3/lib/cron/scheduler.ts`

---

**Report Generated:** December 8, 2024
**Last Updated:** December 8, 2024
**Version:** 1.0
