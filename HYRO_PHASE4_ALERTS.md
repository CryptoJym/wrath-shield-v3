# HYRO FORGE: Phase 4 - Alert & Notification System

## Overview

The HYRO Forge Alert & Notification System keeps parents engaged with their child's educational progress through timely, intelligent notifications.

## Implementation Summary

### Files Created

#### 1. Database Migration
- **File**: `migrations/016_hyro_phase4_alerts.sql`
- **Tables**:
  - `hyro_alerts` - Stores all generated alerts
  - `hyro_alert_preferences` - User preferences for each alert type
  - `hyro_streak_tracker` - Tracks learning streaks for streak-based alerts
  - `hyro_alert_generation_log` - Logs alert generation for debugging
- **Views**:
  - `hyro_alerts_unread` - Quick access to unread alerts
  - `hyro_alerts_recent` - Alerts from the last 7 days

#### 2. Core Library
- **File**: `lib/hyro/forge-alerts.ts`
- **Functions**:
  - `checkAndGenerateAlerts()` - Main entry point, checks all conditions
  - `generateSessionCompleteAlert()` - Called after sessions
  - `generateLevelUpAlert()` - Called on level up
  - `generateAchievementAlert()` - Called when achievement earned
  - `getAlerts()` - Query alerts with filters
  - `getUnreadAlerts()` - Get unread alerts
  - `markAlertRead()` - Mark alert as read
  - `dismissAlert()` - Dismiss an alert
  - `getAlertPreferences()` - Get user preferences
  - `updateAlertPreferences()` - Update preferences
  - `updateStreakTracker()` - Update after sessions
  - `getStreakInfo()` - Get current streak data

#### 3. Email Templates
- **File**: `lib/hyro/forge-email-templates.ts`
- **Features**:
  - HTML and text email templates for all alert types
  - Responsive email design
  - Digest email for batching multiple alerts
  - Ready for integration with email sender

#### 4. API Endpoints
- **File**: `app/api/hyro/alerts/route.ts`
  - `GET /api/hyro/alerts` - List alerts (with filters)
  - `POST /api/hyro/alerts` - Generate alerts or batch actions
  - `PATCH /api/hyro/alerts` - Update alert (read/dismiss)

- **File**: `app/api/hyro/alerts/preferences/route.ts`
  - `GET /api/hyro/alerts/preferences` - Get preferences
  - `PUT /api/hyro/alerts/preferences` - Update preferences

#### 5. UI Components
- **File**: `components/forge/AlertBell.tsx`
  - Notification bell icon with unread count badge
  - Auto-refreshes every 60 seconds
  - Animated when new alerts arrive

- **File**: `components/forge/AlertDropdown.tsx`
  - Dropdown showing recent alerts
  - Filter by unread/all
  - Mark all read functionality
  - Dismissable alerts

- **File**: `components/forge/AlertItem.tsx`
  - Individual alert display
  - Priority-based styling (high/medium/low)
  - Type-specific icons
  - Action buttons (read, dismiss)

## Alert Types

### 1. Streak at Risk (High Priority)
- **Trigger**: No activity in 24 hours
- **Frequency**: Once per 24h period
- **Deduplication**: One per day
- **Message**: "Streak at Risk! Xh Since Last Session"

### 2. Streak Milestone (Medium Priority)
- **Trigger**: 7, 14, 30, 60, 90 day streaks achieved
- **Frequency**: Once per milestone
- **Deduplication**: By milestone number
- **Message**: "X-Day Streak Achieved!"

### 3. Session Complete (Low Priority)
- **Trigger**: Learning session completed
- **Frequency**: After each session
- **Deduplication**: By session ID
- **Message**: "Session Complete! Earned X XP in Y minutes"

### 4. Level Up (Medium Priority)
- **Trigger**: Character level increases
- **Frequency**: Once per level
- **Deduplication**: By level number
- **Message**: "Level Up! Now Level X"

### 5. Achievement Earned (Medium Priority)
- **Trigger**: New achievement unlocked
- **Frequency**: Once per achievement
- **Deduplication**: By achievement ID
- **Message**: "Achievement Unlocked: [Name]"

### 6. Weekly Report (Low Priority)
- **Trigger**: Sunday evening (6pm-11pm)
- **Frequency**: Once per week
- **Deduplication**: One per day
- **Message**: "Weekly Progress Report Ready"

### 7. Growth Opportunity (High Priority)
- **Trigger**: Stat declines > 5 points in 7 days AND stat < 50
- **Frequency**: Once per week per stat
- **Deduplication**: By stat and week
- **Message**: "[Stat] Needs Attention - declined by X points"

### 8. Quest Reminder (Medium Priority)
- **Trigger**: Quest due within 24h and not started
- **Frequency**: Once per quest
- **Deduplication**: By quest ID
- **Message**: "Quest Due Soon: [Title]"

## Priority System

```typescript
const PRIORITY_RULES = {
  streak_at_risk: 'high',       // 🔴 Needs immediate attention
  growth_opportunity: 'high',   // 🔴 Stat declining

  streak_milestone: 'medium',   // 🟡 Celebrate achievement
  level_up: 'medium',          // 🟡 Celebrate level
  achievement_earned: 'medium', // 🟡 Celebrate unlock
  quest_reminder: 'medium',     // 🟡 Due soon

  session_complete: 'low',      // 🟢 Nice to know
  weekly_report: 'low',         // 🟢 Info only
};
```

## Deduplication Strategy

Alerts use `alert_key` to prevent duplicates:
- **Daily alerts**: `alert_type_YYYY-MM-DD`
- **Weekly alerts**: `alert_type_YYYY-WW`
- **Unique events**: `alert_type_event_id`

Example: `streak_risk_2025-12-03` ensures only one streak risk alert per day.

## Alert Generation Flow

```
1. Event Occurs (session complete, stat change, daily cron, etc.)
   ↓
2. Call checkAndGenerateAlerts() or specific generator
   ↓
3. Check alert preferences (is this type enabled?)
   ↓
4. Check for existing alert with same alert_key
   ↓
5. Generate alert if conditions met
   ↓
6. Store in hyro_alerts table
   ↓
7. UI polls /api/hyro/alerts for updates
   ↓
8. Display in AlertBell/AlertDropdown
```

## Integration Points

### After Learning Sessions
```typescript
import { generateSessionCompleteAlert, updateStreakTracker } from '@/lib/hyro/forge-alerts';

// After session ends
const sessionTimestamp = Math.floor(Date.now() / 1000);
await updateStreakTracker(sessionTimestamp);
await generateSessionCompleteAlert(sessionId, xpEarned, duration);
```

### After Level Up
```typescript
import { generateLevelUpAlert } from '@/lib/hyro/forge-alerts';

await generateLevelUpAlert(oldLevel, newLevel, totalXp);
```

### After Achievement Earned
```typescript
import { generateAchievementAlert } from '@/lib/hyro/forge-alerts';

await generateAchievementAlert(achievementId, name, description);
```

### Daily Cron Job
```typescript
import { checkAndGenerateAlerts } from '@/lib/hyro/forge-alerts';

// Run daily at 8pm
await checkAndGenerateAlerts();
```

### In React Components
```tsx
import { AlertBell, AlertDropdown } from '@/components/forge';

function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="navbar">
      <AlertBell onToggle={setDropdownOpen} />
      <AlertDropdown
        isOpen={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
      />
    </div>
  );
}
```

## API Examples

### Get Unread Alerts
```bash
curl http://localhost:4242/api/hyro/alerts?unread_only=true
```

### Get Unread Count
```bash
curl http://localhost:4242/api/hyro/alerts?count_only=true
```

### Generate New Alerts
```bash
curl -X POST http://localhost:4242/api/hyro/alerts \
  -H "Content-Type: application/json" \
  -d '{"action":"generate"}'
```

### Mark Alert as Read
```bash
curl -X PATCH http://localhost:4242/api/hyro/alerts \
  -H "Content-Type: application/json" \
  -d '{"id":"alert-id","action":"read"}'
```

### Mark All as Read
```bash
curl -X POST http://localhost:4242/api/hyro/alerts \
  -H "Content-Type: application/json" \
  -d '{"action":"mark_all_read"}'
```

### Update Preferences
```bash
curl -X PUT http://localhost:4242/api/hyro/alerts/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type":"streak_at_risk",
    "enabled":true,
    "email_enabled":false,
    "frequency":"immediate"
  }'
```

## Testing

### Run Demo Script
```bash
node scripts/demo-alerts.js
```

This script:
1. Creates sample alerts
2. Updates streak tracker
3. Shows all alerts by priority
4. Shows preferences
5. Shows unread count
6. Shows streak info

### Manual Testing Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Navigate to `/hyro/forge`
- [ ] Add `AlertBell` to navbar
- [ ] Click bell to open dropdown
- [ ] Verify alerts display with correct styling
- [ ] Test "Mark as read" functionality
- [ ] Test "Dismiss" functionality
- [ ] Test "Mark all read" button
- [ ] Test filter toggle (unread/all)
- [ ] Generate new alerts via API
- [ ] Verify bell badge updates
- [ ] Test alert preferences API

## Email Integration (Future)

Email templates are ready. To integrate:

1. Import email sender (e.g., from `lib/emailSender.ts`)
2. Import template generator:
   ```typescript
   import { generateAlertEmail } from '@/lib/hyro/forge-email-templates';
   ```
3. After creating alert, check if email enabled:
   ```typescript
   const prefs = await getAlertPreferences();
   const pref = prefs.find(p => p.alert_type === alert.type);

   if (pref?.email_enabled) {
     const email = generateAlertEmail(alert);
     await sendEmail({
       to: parentEmail,
       subject: email.subject,
       html: email.htmlBody,
       text: email.textBody,
     });
   }
   ```

## Database Schema

### hyro_alerts
```sql
CREATE TABLE hyro_alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  created_at INTEGER DEFAULT (unixepoch()),
  read_at INTEGER,
  dismissed INTEGER DEFAULT 0,
  action_url TEXT,
  metadata TEXT,
  alert_key TEXT
);
```

### hyro_alert_preferences
```sql
CREATE TABLE hyro_alert_preferences (
  alert_type TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  frequency TEXT DEFAULT 'immediate',
  last_sent_at INTEGER
);
```

### hyro_streak_tracker
```sql
CREATE TABLE hyro_streak_tracker (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  last_session_at INTEGER,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_streak_alert_at INTEGER,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

## Performance Considerations

1. **Alert Generation**: Run asynchronously, don't block session completion
2. **Polling**: AlertBell polls every 60 seconds (configurable)
3. **Deduplication**: Uses `alert_key` to prevent spam
4. **Indexes**: Created on `type`, `created_at`, `read_at`, `dismissed`, `alert_key`
5. **Limit**: AlertDropdown shows max 10 alerts by default

## Future Enhancements

1. **Push Notifications**: Add Web Push API support
2. **Email Digest**: Batch low-priority alerts into daily/weekly digests
3. **SMS Alerts**: For high-priority alerts (streak at risk)
4. **Alert Scheduling**: Respect "quiet hours" preferences
5. **Alert Analytics**: Track which alerts drive engagement
6. **Custom Alerts**: Allow parents to create custom triggers
7. **Multi-Child Support**: Alert preferences per child
8. **Alert History**: Archive dismissed alerts for analytics

## Troubleshooting

### Alerts not appearing
1. Check alert preferences: `GET /api/hyro/alerts/preferences`
2. Check for duplicate alert_key in database
3. Verify migration ran: `SELECT * FROM hyro_alerts LIMIT 1`
4. Check browser console for API errors

### Unread count not updating
1. Check AlertBell polling interval (default 60s)
2. Verify API endpoint returns correct count
3. Check for CORS issues in dev console

### Alerts firing too frequently
1. Check deduplication logic in `forge-alerts.ts`
2. Verify `alert_key` is unique per time period
3. Check `hyro_alert_generation_log` for spam

## License

Part of HYRO Forge - Wrath Shield v3

---

**Created**: December 3, 2025
**Status**: ✅ Complete and tested
**Next Phase**: Phase 5 - Advanced Analytics Dashboard
