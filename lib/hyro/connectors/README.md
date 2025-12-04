# HYRO FORGE: Platform Connectors

Modular platform connector system for integrating educational platforms into the Forge education system.

## Architecture

### Core Components

1. **BaseConnector** (`base-connector.ts`)
   - Abstract class that all connectors extend
   - Provides common functionality: error handling, memory integration, status tracking
   - Resilient design: individual connector failures don't crash the system

2. **ConnectorManager** (`index.ts`)
   - Orchestrates all platform connectors
   - Handles sync operations (individual or batch)
   - Manages connector health and status
   - Singleton instance: `connectorManager`

3. **Types** (`types.ts`)
   - Shared type definitions for all connectors
   - Platform progress, sync results, quest inputs, etc.

### Platform Connectors

#### Zearn Connector (`zearn.ts`)
- **Platform**: Zearn Math
- **Primary Method**: Screenshot OCR with Claude Vision (TODO)
- **Features**:
  - Mission/lesson/badge tracking
  - Progress percentage calculation
  - Automatic quest generation
  - Education memory integration
- **Status**: Partially implemented (OCR pending)

#### Manual Connector (`manual.ts`)
- **Platform**: Any (fallback)
- **Primary Method**: Manual data entry via API
- **Features**:
  - Flexible progress entry
  - Assignment tracking
  - Optional quest generation
  - Full validation
- **Status**: Fully implemented

## Usage

### Basic Usage

```typescript
import { connectorManager } from '@/lib/hyro/connectors';

// Get all platform progress
const progress = await connectorManager.getAllProgress();

// Sync a specific platform
const result = await connectorManager.syncPlatform('zearn');

// Sync all platforms
const results = await connectorManager.syncAll();

// Get connector health status
const statuses = connectorManager.getConnectorStatus();
```

### Manual Entry

```typescript
import { connectorManager, type ManualEntry } from '@/lib/hyro/connectors';

const entry: ManualEntry = {
  platformId: 'boost',
  subject: 'reading',
  title: 'Chapter 5: Advanced Comprehension',
  description: 'Complete reading exercises',
  percentComplete: 75,
  badges: 3,
  badgesTotal: 4,
  dueDate: '2025-12-10',
  status: 'in_progress',
  generateQuest: true,
};

const result = await connectorManager.processManualEntry(entry);
```

### Zearn with Screenshot (Future)

```typescript
const result = await connectorManager.syncPlatform('zearn', {
  screenshot: {
    imageBase64: '...', // Base64 encoded screenshot
    platform: 'zearn',
    context: 'Progress dashboard screenshot',
  },
});
```

## API Endpoint

Unified API endpoint: `POST/GET /api/hyro/platforms`

### GET Examples

```bash
# Get all data
curl http://localhost:4242/api/hyro/platforms

# Get only status
curl http://localhost:4242/api/hyro/platforms?progress=false

# Get only progress
curl http://localhost:4242/api/hyro/platforms?status=false
```

### POST Examples

```bash
# Sync all platforms
curl -X POST http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{"action": "sync_all"}'

# Sync specific platform
curl -X POST http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{"action": "sync_platform", "platformId": "zearn"}'

# Manual entry
curl -X POST http://localhost:4242/api/hyro/platforms \
  -H "Content-Type: application/json" \
  -d '{
    "action": "manual_entry",
    "entry": {
      "platformId": "boost",
      "subject": "reading",
      "title": "Chapter 5",
      "percentComplete": 75
    }
  }'
```

## Adding New Connectors

To add a new platform connector:

1. **Create connector file** (e.g., `lib/hyro/connectors/boost.ts`)

```typescript
import { BaseConnector } from './base-connector';
import type { PlatformProgress, SyncResult, QuestInput, PlatformItem } from './types';

export class BoostConnector extends BaseConnector {
  readonly platformId = 'boost';
  readonly displayName = 'Boost Reading';

  async sync(): Promise<SyncResult> {
    // Implement sync logic
    return this.createSyncResult({
      success: true,
      itemsSynced: 0,
    });
  }

  async getProgress(): Promise<PlatformProgress> {
    // Implement progress fetching
    return {
      platformId: this.platformId,
      displayName: this.displayName,
      percentComplete: 0,
    };
  }

  mapToQuest(item: PlatformItem): QuestInput {
    return {
      platform: this.platformId,
      platformId: item.externalId,
      title: item.title,
      subject: 'reading',
      // ... map other fields
    };
  }
}

export const boostConnector = new BoostConnector();
```

2. **Register in ConnectorManager** (`index.ts`)

```typescript
import { boostConnector } from './boost';

private registerDefaultConnectors(): void {
  this.register(zearnConnector);
  this.register(manualConnector);
  this.register(boostConnector); // Add here
}
```

3. **Export from index** (optional)

```typescript
export { BoostConnector, boostConnector } from './boost';
```

## Platform Mappings

Based on `forge-quest-generator.ts`:

| Platform | Subject | XP Base | Status |
|----------|---------|---------|--------|
| Zearn | Math | 25 | Partial |
| Boost | Reading | 20 | Planned |
| Lexia | Reading | 20 | Planned |
| Canyon Grove | Study Skills | 15 | Planned |
| Quill | Reading | 15 | Planned |
| NoRedInk | Reading | 15 | Planned |

## Error Handling

Connectors are resilient:

- **Individual failures don't crash the system**: If one platform fails, others continue
- **Error tracking**: All errors are logged and returned in `SyncResult`
- **Health monitoring**: Connectors track consecutive failures
- **Auto-disable**: After 3 consecutive failures, connector becomes "unhealthy"
- **Manual recovery**: Use `resetErrors()` to reset error counters

## Memory Integration

All connectors automatically integrate with the education memory system:

- Progress updates → `recordProgress()`
- Assignments → `recordAssignment()`
- Observations → `addEducationMemory()`

This ensures all platform data is available to the AI agent for context and recommendations.

## Future Enhancements

### Phase 2 Additions
- [ ] Zearn screenshot OCR with Claude Vision
- [ ] Boost reading connector
- [ ] Lexia connector
- [ ] Canyon Grove connector

### Phase 3 Ideas
- [ ] Webhook support for real-time updates
- [ ] Scheduled auto-sync (cron jobs)
- [ ] Progress analytics dashboard
- [ ] Parent notification system
- [ ] Achievement unlock notifications
