# Phase 5: Scheduled Agent Tasks - README

Quick reference guide for Phase 5 scheduled agent tasks implementation.

---

## Quick Start

### 1. Verify Setup

```bash
npm run verify:phase5-scheduling
```

This will check:
- ✅ All required files exist
- ✅ Scripts are configured in package.json
- ✅ Ecosystem config is valid
- ✅ Dependencies are installed
- ✅ PM2 is available (if used)

### 2. Enable Enhanced Scheduling

```bash
# Backup current config
cp ecosystem.config.js ecosystem.config.BACKUP.js

# Enable enhanced config
cp ecosystem.config.ENHANCED.js ecosystem.config.js

# Reload PM2
pm2 reload ecosystem.config.js --env production
```

### 3. Test New Tasks

```bash
# Test EA daily agenda
npm run ea:daily-agenda

# Test EA weekly report
npm run ea:weekly-report

# Test PM weekly report
npm run pm:weekly-report
```

### 4. Monitor

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs ea-daily-agenda
pm2 logs ea-weekly-report
pm2 logs pm-weekly-report

# Check all logs
tail -f logs/*.log
```

---

## What Was Added

### New Scripts (3)

1. **EA Daily Agenda** (`scripts/ea-daily-agenda.ts`)
   - Schedule: Daily at 6:30 AM
   - Purpose: Generates daily agenda before morning briefing
   - Command: `npm run ea:daily-agenda`

2. **EA Weekly Report** (`scripts/ea-weekly-report.ts`)
   - Schedule: Sunday at 6:00 PM
   - Purpose: Week-ahead planning and review
   - Command: `npm run ea:weekly-report`

3. **PM Weekly Report** (`scripts/pm-weekly-report.ts`)
   - Schedule: Sunday at 8:00 PM
   - Purpose: Project status and stakeholder updates
   - Command: `npm run pm:weekly-report`

### New Configuration

- `ecosystem.config.ENHANCED.js` - PM2 config with new tasks
- Updated `package.json` with new npm scripts
- Verification script: `scripts/verify-phase5-scheduling.ts`

### Documentation (4 files)

1. **`SCHEDULED_TASKS_SETUP.md`** (500+ lines)
   - Complete reference for all scheduling systems
   - How-to guides and troubleshooting
   - Agent-specific task breakdown

2. **`ENABLE_ENHANCED_SCHEDULING.md`**
   - Quick start guide
   - Step-by-step activation
   - Testing and troubleshooting

3. **`PHASE_5_SCHEDULING_COMPLETE.md`**
   - Executive summary
   - Implementation overview
   - Success criteria

4. **`PHASE_5_README.md`** (this file)
   - Quick reference
   - Essential commands
   - Common tasks

---

## Essential Commands

### Verification

```bash
# Verify Phase 5 setup
npm run verify:phase5-scheduling
```

### PM2 Management

```bash
# Start all processes
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

# Restart a task
pm2 restart ea-daily-agenda

# Stop a task
pm2 stop ea-daily-agenda

# View logs
pm2 logs ea-daily-agenda --lines 50

# Save PM2 configuration
pm2 save
```

### Manual Testing

```bash
# Test all new scripts
npm run ea:daily-agenda
npm run ea:weekly-report
npm run pm:weekly-report

# Test specific functionality
npx tsx scripts/ea-daily-agenda.ts
npx tsx scripts/ea-weekly-report.ts
npx tsx scripts/pm-weekly-report.ts
```

### Monitoring

```bash
# Watch all logs
tail -f logs/*.log

# Watch specific task
tail -f logs/ea-daily-agenda-out.log

# Check for errors
grep -i error logs/*.log

# Check proactive system
curl -s "http://localhost:4242/api/proactive/status" | jq
```

---

## File Locations

### Scripts
- `/scripts/ea-daily-agenda.ts`
- `/scripts/ea-weekly-report.ts`
- `/scripts/pm-weekly-report.ts`
- `/scripts/verify-phase5-scheduling.ts`

### Configuration
- `/ecosystem.config.js` - Current PM2 config
- `/ecosystem.config.ENHANCED.js` - Enhanced PM2 config
- `/package.json` - npm scripts

### Documentation
- `/SCHEDULED_TASKS_SETUP.md` - Complete reference
- `/ENABLE_ENHANCED_SCHEDULING.md` - Quick start
- `/PHASE_5_SCHEDULING_COMPLETE.md` - Summary
- `/PHASE_5_README.md` - This file

### Logs
- `/logs/ea-daily-agenda-error.log`
- `/logs/ea-daily-agenda-out.log`
- `/logs/ea-weekly-report-error.log`
- `/logs/ea-weekly-report-out.log`
- `/logs/pm-weekly-report-error.log`
- `/logs/pm-weekly-report-out.log`

---

## Schedule Overview

### Daily Tasks

| Time | Task | Agent |
|------|------|-------|
| 3:00 AM | wrath-scheduler | Multiple |
| 5:15 AM | finance-auto-enrich | Finance |
| **6:30 AM** | **ea-daily-agenda** ⭐ | **EA** |
| 6:30 AM | finance-daily | Finance |
| 7:05 AM | digest-morning | EA |
| 10:55 PM | shutdown-evening | EA |

### Hourly Tasks

| Schedule | Task | Agent |
|----------|------|-------|
| Every minute | proactive-tick | Orchestrator |
| Every 10 min | agentic-executor | Orchestrator |
| Hourly at :15 | pipeline-hourly | Multiple |
| Hourly at :20 | legal-hourly | Legal |
| 4am-11pm | lifelog-hourly | Health |

### Weekly Tasks

| Time | Task | Agent |
|------|------|-------|
| **Sunday 6:00 PM** | **ea-weekly-report** ⭐ | **EA** |
| **Sunday 8:00 PM** | **pm-weekly-report** ⭐ | **PM** |

⭐ = New in Phase 5

---

## Troubleshooting

### Task Not Running

```bash
# Check if process exists
pm2 list | grep ea-daily-agenda

# Restart the task
pm2 restart ea-daily-agenda

# Check logs for errors
pm2 logs ea-daily-agenda --err --lines 50
```

### Script Errors

```bash
# Test script directly
npm run ea:daily-agenda

# Check for TypeScript errors
npx tsc --noEmit

# Verify dependencies
npm install
```

### Logs Not Appearing

```bash
# Create logs directory if missing
mkdir -p logs

# Restart PM2
pm2 restart all

# Check PM2 is writing to correct location
pm2 info ea-daily-agenda
```

---

## Next Steps

1. **Enable enhanced scheduling** - Copy enhanced config and reload PM2
2. **Test new tasks** - Run manual tests for all 3 scripts
3. **Monitor first runs** - Watch logs for successful execution
4. **Implement TODOs** - Add actual data fetching logic to scripts
5. **Add notifications** - Configure email/Slack delivery

---

## Environment Variables

Required for scheduled tasks:

```bash
CRON_SECRET=<your-secret>
PROACTIVE_SECRET=<your-secret>
OPENROUTER_API_KEY=<your-key>
ZEP_API_KEY=<your-key>
USE_PM2_CRON=true
```

---

## Support

- **Full Documentation**: `SCHEDULED_TASKS_SETUP.md`
- **Quick Start**: `ENABLE_ENHANCED_SCHEDULING.md`
- **Summary**: `PHASE_5_SCHEDULING_COMPLETE.md`
- **Verification**: `npm run verify:phase5-scheduling`

---

**Last Updated:** December 8, 2024
**Phase:** Phase 5 - Life OS Architecture Improvements
**Status:** ✅ Complete
