# Enable Enhanced Agent Scheduling - Quick Start Guide

This guide will help you enable the new agent-based scheduled tasks for Phase 5.

---

## What's New?

Three new scheduled tasks have been added to enhance agent automation:

1. **EA Daily Agenda** (6:30 AM) - Prepares daily agenda before morning briefing
2. **EA Weekly Report** (Sunday 6:00 PM) - Week-ahead planning and review
3. **PM Weekly Report** (Sunday 8:00 PM) - Project status and stakeholder updates

---

## Quick Enable (Recommended)

### Step 1: Backup Current Config

```bash
cd /Users/jamesbrady/Projects/apps/wrath-shield-v3
cp ecosystem.config.js ecosystem.config.BACKUP.js
```

### Step 2: Enable Enhanced Config

```bash
cp ecosystem.config.ENHANCED.js ecosystem.config.js
```

### Step 3: Reload PM2

```bash
pm2 reload ecosystem.config.js --env production
```

### Step 4: Verify

```bash
pm2 list
```

You should see 3 new processes:
- `ea-daily-agenda`
- `ea-weekly-report`
- `pm-weekly-report`

---

## Manual Enable (Alternative)

If you prefer to manually add the tasks to your existing config:

### Edit ecosystem.config.js

Add these entries to the `apps` array:

```javascript
{
  name: 'ea-daily-agenda',
  script: 'bash',
  args: "-lc 'cd " + __dirname + " && npx tsx scripts/ea-daily-agenda.ts'",
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  autorestart: false,
  watch: false,
  cron_restart: '30 6 * * *', // 06:30 daily
  env: { NODE_ENV: 'production' },
  error_file: './logs/ea-daily-agenda-error.log',
  out_file: './logs/ea-daily-agenda-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
},
{
  name: 'ea-weekly-report',
  script: 'bash',
  args: "-lc 'cd " + __dirname + " && npx tsx scripts/ea-weekly-report.ts'",
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  autorestart: false,
  watch: false,
  cron_restart: '0 18 * * 0', // 18:00 Sunday
  env: { NODE_ENV: 'production' },
  error_file: './logs/ea-weekly-report-error.log',
  out_file: './logs/ea-weekly-report-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
},
{
  name: 'pm-weekly-report',
  script: 'bash',
  args: "-lc 'cd " + __dirname + " && npx tsx scripts/pm-weekly-report.ts'",
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  autorestart: false,
  watch: false,
  cron_restart: '0 20 * * 0', // 20:00 Sunday
  env: { NODE_ENV: 'production' },
  error_file: './logs/pm-weekly-report-error.log',
  out_file: './logs/pm-weekly-report-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
},
```

Then reload PM2:

```bash
pm2 reload ecosystem.config.js
```

---

## Test the New Tasks

### Test EA Daily Agenda

```bash
npm run ea:daily-agenda
```

Expected output:
```
[EA Agenda] Starting daily agenda generation...
[EA Agenda] Generating agenda for 2024-12-08...
[EA Agenda] Stored agenda in memory
[EA Agenda] Published agenda notification
[EA Agenda] Successfully generated agenda with X items
```

### Test EA Weekly Report

```bash
npm run ea:weekly-report
```

Expected output:
```
[EA Weekly] Starting weekly report generation...
[EA Weekly] Generating report for week of 2024-12-09...
[EA Weekly] Stored weekly report in memory
[EA Weekly] Published weekly report notification
[EA Weekly] Successfully generated weekly report
```

### Test PM Weekly Report

```bash
npm run pm:weekly-report
```

Expected output:
```
[PM Weekly] Starting PM weekly report generation...
[PM Weekly] Generating report for 2024-12-01 to 2024-12-08...
[PM Weekly] Stored weekly report in memory
[PM Weekly] Published weekly report notification
[PM Weekly] Successfully generated PM weekly report
```

---

## Monitoring

### View Logs

```bash
# EA Daily Agenda
tail -f logs/ea-daily-agenda-out.log

# EA Weekly Report
tail -f logs/ea-weekly-report-out.log

# PM Weekly Report
tail -f logs/pm-weekly-report-out.log
```

### Check Errors

```bash
tail -f logs/ea-daily-agenda-error.log
tail -f logs/ea-weekly-report-error.log
tail -f logs/pm-weekly-report-error.log
```

### PM2 Status

```bash
pm2 status
pm2 logs ea-daily-agenda --lines 20
pm2 logs ea-weekly-report --lines 20
pm2 logs pm-weekly-report --lines 20
```

---

## Schedule Summary

| Task | Schedule | Time | Purpose |
|------|----------|------|---------|
| ea-daily-agenda | Daily | 6:30 AM | Prepare daily agenda |
| digest-morning | Daily | 7:05 AM | Morning briefing (existing) |
| shutdown-evening | Daily | 10:55 PM | Evening summary (existing) |
| ea-weekly-report | Sunday | 6:00 PM | Week-ahead planning |
| pm-weekly-report | Sunday | 8:00 PM | Project status report |

---

## Troubleshooting

### Task Not Running

```bash
# Check if process exists
pm2 list | grep ea-daily-agenda

# Check logs for errors
pm2 logs ea-daily-agenda --err --lines 50

# Restart the task
pm2 restart ea-daily-agenda
```

### Script Errors

```bash
# Test script directly
npx tsx scripts/ea-daily-agenda.ts

# Check for TypeScript errors
npx tsc --noEmit
```

### Missing Dependencies

```bash
# Ensure all dependencies are installed
npm install

# Check for node-cron if using internal scheduler
npm list node-cron
```

---

## Rollback

If you need to rollback to the previous configuration:

```bash
cd /Users/jamesbrady/Projects/apps/wrath-shield-v3
cp ecosystem.config.BACKUP.js ecosystem.config.js
pm2 reload ecosystem.config.js
```

---

## Next Steps

1. **Monitor first runs** - Watch logs for the first execution of each task
2. **Customize scripts** - Update TODO sections in the scripts with actual implementation
3. **Add notifications** - Configure where reports should be sent (email, Slack, etc.)
4. **Extend functionality** - Add more scheduled tasks as needed for other agents

---

## Related Documentation

- `SCHEDULED_TASKS_SETUP.md` - Complete scheduling infrastructure documentation
- `ecosystem.config.js` - Current PM2 configuration
- `ecosystem.config.ENHANCED.js` - Enhanced configuration with new tasks
- `lib/cron/scheduler.ts` - Internal scheduler fallback
- `lib/agents/ProactiveEnablement.ts` - Proactive system architecture

---

**Questions?** Check the main documentation in `SCHEDULED_TASKS_SETUP.md`
