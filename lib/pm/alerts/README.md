# PM Alerts Directory

This directory contains proactive alert systems for the PM Agent.

## Alerts

### Contact Follow-up Reminder System
**File**: `contact-followup-reminder.ts`

**Purpose**: Proactive reminder system that monitors contact interaction patterns and creates alerts BEFORE relationships go cold.

**Key Features**:
- Tiered contact types (VIP, active deals, regular)
- Relationship health assessment (healthy, cooling, cold, dormant)
- Severity-based alerts (info, warning, critical)
- 48-hour cooldown per contact
- VIP-first prioritization
- AI-generated outreach suggestions

**Quick Start**:
```typescript
import { generateContactReminders } from '@/lib/pm/alerts/contact-followup-reminder';

const reminders = await generateContactReminders();
console.log(`Generated ${reminders.length} reminders`);
```

**Documentation**: See `.claude_results/phase3c_complete.md` for full documentation and examples.

---

## Future Alerts

Planned alert systems:

- **Project Health Alerts**: Detect at-risk projects based on commit velocity, issue staleness
- **Deadline Proximity Alerts**: Escalate approaching deadlines (48h, 24h, 2h warnings)
- **Task Staleness Alerts**: Flag tasks with no activity in 7+ days
- **Team Availability Alerts**: Notify when key team members become available
- **Budget Alerts**: Warn when project budgets are near limits
- **SLA Violation Alerts**: Alert on service level agreement breaches

---

## Alert System Patterns

All alerts in this directory should follow these patterns:

### 1. Main Function
```typescript
export async function generateAlerts(): Promise<Alert[]>
```

### 2. Background Job Definition
```typescript
export const ALERT_JOB: BackgroundJob = {
  id: 'alert-name',
  name: 'Alert Name',
  description: '...',
  schedule: 'interval',
  interval_minutes: 720,
  cooldown_minutes: 720,
  enabled: true,
  handler: async () => { ... }
};
```

### 3. Severity Levels
- `info`: Informational, no action required
- `warning`: Attention needed, not urgent
- `critical`: Immediate action required

### 4. Cooldown Enforcement
- Per-item cooldown (prevent spam)
- Global rate limiting (prevent overload)

### 5. Database Tracking
- Track alert history
- Record when alerts were sent
- Support alert completion/dismissal

---

## Integration with PM Queue

Alerts can create signals in the PM queue:

```typescript
import { enqueueSignal } from '@/lib/pm/task-queue';

await enqueueSignal({
  id: `alert-${Date.now()}`,
  source: 'pm',
  signal_type: 'alert',
  payload: { ... },
  timestamp: Date.now(),
  confidence: 0.95,
});
```

**Escalation Levels**:
- Critical alerts → `CRITICAL` escalation
- Warning alerts → `PROPOSE` escalation
- Info alerts → `AUTO` escalation

---

## Best Practices

1. **Always use `ensureServerOnly()` guard** at top of file
2. **Implement cooldown logic** to prevent alert fatigue
3. **Provide clear, actionable suggestions** in alerts
4. **Log all alert generation** for debugging
5. **Handle missing data gracefully** (don't crash on null contacts)
6. **Type everything strictly** - no `any` types
7. **Document configuration options** clearly
8. **Provide example outputs** in completion docs

---

## Testing

All alerts should be type-checked:

```bash
npx tsc --noEmit 2>&1 | grep "alerts/"
```

Should return no errors.
