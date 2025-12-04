# Platform Connector System - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### 1. Check System Status

```bash
curl http://localhost:4242/api/hyro/platforms
```

You should see registered connectors:
- Zearn Math (screenshot-based, OCR pending)
- Manual Entry (fully functional)

### 2. Add Your First Entry

```bash
curl -X POST http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "manual_entry",
    "entry": {
      "platformId": "boost",
      "displayName": "Boost Reading",
      "subject": "reading",
      "title": "Chapter 3: Story Elements",
      "percentComplete": 60,
      "badges": 2,
      "badgesTotal": 4,
      "status": "in_progress"
    }
  }'
```

This will:
- ✅ Record progress in education memory
- ✅ Track assignment status
- ✅ Store observation for AI context

### 3. Add Entry with Quest Generation

```bash
curl -X POST http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "manual_entry",
    "entry": {
      "platformId": "lexia",
      "subject": "reading",
      "title": "Unit 5: Vocabulary Builder",
      "dueDate": "2025-12-20",
      "status": "in_progress",
      "difficulty": "medium",
      "estimatedMinutes": 25,
      "generateQuest": true
    }
  }'
```

This will also:
- ✅ Generate a Forge quest
- ✅ Award XP on completion
- ✅ Track in quest system

### 4. Use in TypeScript/JavaScript

```typescript
import { connectorManager } from '@/lib/hyro/connectors';

// Get all platform status
const statuses = connectorManager.getConnectorStatus();
console.log('Registered platforms:', statuses.length);

// Process a manual entry
const result = await connectorManager.processManualEntry({
  platformId: 'boost',
  subject: 'reading',
  title: 'Chapter 5',
  percentComplete: 75,
});

if (result.success) {
  console.log('✅ Synced', result.itemsSynced, 'items');
} else {
  console.error('❌ Errors:', result.errors);
}
```

## 📚 Common Use Cases

### Use Case 1: Daily Progress Update

Parent/teacher enters progress manually:

```typescript
const entry = {
  platformId: 'zearn',
  displayName: 'Zearn Math',
  subject: 'math',
  title: 'G6 M5 L3: Decimal Division',
  description: 'Completed lesson with 95% accuracy',
  percentComplete: 78,
  badges: 15,
  badgesTotal: 20,
  status: 'in_progress',
  score: 95,
  maxScore: 100,
  notes: 'Student struggled with word problems initially but improved',
};

await connectorManager.processManualEntry(entry);
```

### Use Case 2: Assignment Tracking

Track due assignments across platforms:

```typescript
const assignment = {
  platformId: 'canyon_grove',
  subject: 'study_skills',
  title: 'Weekly Reading Log',
  dueDate: '2025-12-10',
  status: 'pending',
  estimatedMinutes: 15,
  generateQuest: true,
};

await connectorManager.processManualEntry(assignment);
```

### Use Case 3: Multi-Platform Dashboard

Get overview of all platforms:

```typescript
const progressMap = await connectorManager.getAllProgress();

for (const [platformId, progress] of progressMap.entries()) {
  console.log(`${progress.displayName}: ${progress.percentComplete}%`);
}
```

## 🎯 API Endpoints Reference

### GET `/api/hyro/platforms`

Query all platforms:

```bash
# Get everything
curl http://localhost:4242/api/hyro/platforms

# Get only status (no progress)
curl http://localhost:4242/api/hyro/platforms?progress=false

# Get only progress (no status)
curl http://localhost:4242/api/hyro/platforms?status=false
```

### POST `/api/hyro/platforms`

**Action: sync_all**
```json
{ "action": "sync_all" }
```

**Action: sync_platform**
```json
{
  "action": "sync_platform",
  "platformId": "zearn"
}
```

**Action: manual_entry**
```json
{
  "action": "manual_entry",
  "entry": {
    "platformId": "boost",
    "subject": "reading",
    "title": "Progress update",
    "percentComplete": 50
  }
}
```

### PUT `/api/hyro/platforms`

**Reset errors:**
```json
{
  "platformId": "zearn",
  "action": "reset_errors"
}
```

**Enable/disable:**
```json
{
  "platformId": "zearn",
  "action": "set_enabled",
  "enabled": false
}
```

## 🔧 Configuration

### Required Fields for Manual Entry

Minimum required:
```typescript
{
  platformId: string,  // e.g., "boost", "zearn", "lexia"
  subject: string,     // e.g., "math", "reading", "science"
  title: string        // e.g., "Chapter 5: Advanced Topics"
}
```

### Optional Fields

All optional fields:
```typescript
{
  displayName?: string,
  description?: string,
  percentComplete?: number,      // 0-100
  badges?: number,
  badgesTotal?: number,
  dueDate?: string,             // ISO 8601 or readable date
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue',
  difficulty?: string,          // 'easy', 'medium', 'hard', etc.
  estimatedMinutes?: number,
  score?: number,
  maxScore?: number,
  url?: string,
  notes?: string,
  metadata?: Record<string, any>,
  generateQuest?: boolean       // Create Forge quest
}
```

## 🐛 Troubleshooting

### Entry Rejected: "Invalid platformId"

Make sure platformId is not empty:
```typescript
❌ platformId: ""
✅ platformId: "boost"
```

### Entry Rejected: "percentComplete must be between 0 and 100"

Check percentage range:
```typescript
❌ percentComplete: 150
✅ percentComplete: 75
```

### Entry Rejected: "badges cannot exceed badgesTotal"

Validate badge counts:
```typescript
❌ badges: 10, badgesTotal: 5
✅ badges: 3, badgesTotal: 5
```

### Connector Unhealthy

After 3 consecutive failures, reset:
```bash
curl -X PUT http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "platformId": "zearn",
    "action": "reset_errors"
  }'
```

## 📊 Monitoring

### Check Connector Health

```typescript
import { connectorManager } from '@/lib/hyro/connectors';

const statuses = connectorManager.getConnectorStatus();

for (const status of statuses) {
  console.log(`${status.displayName}:`);
  console.log(`  Healthy: ${status.isHealthy}`);
  console.log(`  Errors: ${status.errorCount}`);
  console.log(`  Last Sync: ${new Date(status.lastSync * 1000)}`);
}
```

### View Sync Results

```typescript
const result = await connectorManager.syncPlatform('zearn');

console.log('Success:', result.success);
console.log('Items synced:', result.itemsSynced);
console.log('Progress records:', result.progressRecords);
console.log('Assignment records:', result.assignmentRecords);
console.log('Memory records:', result.memoryRecords);
console.log('Quests generated:', result.questsGenerated);

if (result.errors.length > 0) {
  console.log('Errors:');
  result.errors.forEach(e => {
    console.log(`  [${e.category}] ${e.message}`);
  });
}
```

## 🎓 Next Steps

1. **Add more platforms**: See `README.md` for adding new connectors
2. **Implement Zearn OCR**: See `zearn.ts` for TODO items
3. **Set up automated sync**: Configure cron jobs or webhooks
4. **Build dashboard**: Create UI for progress visualization

## 📖 Further Reading

- `README.md` - Complete documentation
- `example.ts` - 7 detailed usage examples
- `IMPLEMENTATION_CHECKLIST.md` - Development roadmap
- `types.ts` - Full type reference

## 💡 Pro Tips

1. **Always validate entries**: The system validates, but client-side validation is faster
2. **Use quest generation sparingly**: Only for assignments with due dates
3. **Monitor connector health**: Check status regularly to catch issues early
4. **Leverage metadata**: Store custom data in the metadata field
5. **Test with manual connector first**: It's fully implemented and reliable

---

**Questions?** Check the full documentation in `README.md` or review the examples in `example.ts`.
