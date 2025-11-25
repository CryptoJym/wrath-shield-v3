# PM Agent Architecture: GitHub ↔ Motion Integration

## Overview

The PM Agent automates bi-directional synchronization between GitHub repositories and Motion projects/tasks. It runs on a scheduled cadence throughout the day to keep both systems in sync.

## Scheduled Cadence

The agent runs at the following times daily (local timezone):
- **05:00** - Morning sync before workday
- **09:00** - Start of business sync
- **12:00** - Midday sync
- **15:00** - Afternoon sync
- **17:00** - End of day sync
- **19:00** - Evening sync
- **21:00** - Night sync

### Cron Configuration

```bash
# Add to crontab -e
0 5,9,12,15,17,19,21 * * * /Users/jamesbrady/scripts/run-with-op.sh pm-agent-sync
```

## Environment Variables

Required environment variables (stored in `~/.secrets/pm-agent.env`):

```bash
# Motion API
MOTION_API_KEY=your_motion_api_key
MOTION_WORKSPACE_ID=m5rLl3mwp0fFoEgjgusHd

# GitHub API
GITHUB_TOKEN=your_github_pat
GITHUB_ORGS=CryptoJym,h3ro-dev

# Database
PM_AGENT_DB_PATH=/Users/jamesbrady/.data/pm-agent/pm-agent.db

# Sync Configuration
SYNC_INTERVAL_MINUTES=15
DRY_RUN=false
```

## File Layout

```
/Users/jamesbrady/
├── lib/
│   ├── pm-agent/
│   │   ├── index.ts           # Main entry point
│   │   ├── motion-client.ts   # Motion API client
│   │   ├── github-client.ts   # GitHub API client (re-exports from existing)
│   │   ├── sync.ts            # Bi-directional sync logic
│   │   ├── mapper.ts          # GitHub ↔ Motion mapping rules
│   │   └── store.ts           # SQLite persistence layer
│   ├── legal/
│   │   └── store.ts           # Legal domain store
│   └── finance/
│       └── store.ts           # Finance domain store
├── app/
│   └── api/
│       ├── legal/
│       │   └── context-requests/  # Legal context queue
│       └── finance/
│           └── context-requests/  # Finance context queue
├── .data/
│   ├── pm-agent/
│   │   └── pm-agent.db        # PM agent SQLite database
│   ├── legal/
│   │   └── legal.db           # Legal domain database
│   └── finance/
│       └── finance.db         # Finance domain database
├── scripts/
│   └── run-with-op.sh         # 1Password secrets injection wrapper
└── docs/
    └── architecture/
        └── pm-agent.md        # This file
```

## Mapping Rules

### GitHub Issue → Motion Task

| GitHub Field | Motion Field | Transform |
|--------------|--------------|-----------|
| `title` | `name` | Direct copy |
| `body` | `description` | Truncate to 2000 chars |
| `state: open` | `status: Todo` | - |
| `state: closed` | `status: Completed` | - |
| `labels[].name` | `labels[]` | Filter to known labels |
| `assignees[0].login` | `assigneeId` | Lookup Motion user ID |
| `milestone.title` | `project` | Match Motion project name |

### Motion Task → GitHub Issue

| Motion Field | GitHub Field | Transform |
|--------------|--------------|-----------|
| `name` | `title` | Direct copy |
| `description` | `body` | Append Motion link |
| `status: Todo` | `state: open` | - |
| `status: In Progress` | `state: open` | Add "in-progress" label |
| `status: Completed` | `state: closed` | - |
| `project.name` | `milestone` | Match or create milestone |

### Project Mapping

Existing mappings from `motion_github_mappings.json`:

| Motion Project | GitHub Repo | Owner |
|---------------|-------------|-------|
| Guardian - Amalg - Cybersecurity of One Firm | fcra-compliance-matrix | CryptoJym |
| CRO of One | cro-revenue-compass | h3ro-dev |
| Creator of One | marketing-mcp-servers | CryptoJym |

## Database Schema

### `sync_state` Table
```sql
CREATE TABLE sync_state (
  id TEXT PRIMARY KEY,
  motion_id TEXT UNIQUE,
  github_repo TEXT,
  github_issue_number INTEGER,
  last_motion_update TEXT,
  last_github_update TEXT,
  sync_direction TEXT, -- 'motion_to_github', 'github_to_motion', 'bidirectional'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `sync_log` Table
```sql
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_run_id TEXT,
  entity_type TEXT, -- 'task', 'project', 'issue'
  motion_id TEXT,
  github_ref TEXT,
  action TEXT, -- 'create', 'update', 'close', 'skip'
  status TEXT, -- 'success', 'error', 'skipped'
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Sync Algorithm

```
1. For each mapped project:
   a. Fetch Motion tasks (updated since last sync)
   b. Fetch GitHub issues (updated since last sync)

2. Conflict resolution (last-write-wins with priority):
   a. If Motion updated more recently → Push to GitHub
   b. If GitHub updated more recently → Push to Motion
   c. If both updated → Motion wins (source of truth for tasks)

3. New items:
   a. New Motion task without GitHub link → Create GitHub issue
   b. New GitHub issue without Motion link → Create Motion task

4. Closed items:
   a. Motion task completed → Close GitHub issue
   b. GitHub issue closed → Complete Motion task
```

## Usage

### Manual Sync
```bash
# Run sync manually
/Users/jamesbrady/scripts/run-with-op.sh pm-agent-sync

# Dry run (no changes)
DRY_RUN=true /Users/jamesbrady/scripts/run-with-op.sh pm-agent-sync

# Sync specific project
/Users/jamesbrady/scripts/run-with-op.sh pm-agent-sync --project="CRO of One"
```

### Check Status
```bash
# View recent sync logs
sqlite3 ~/.data/pm-agent/pm-agent.db "SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 20"

# View sync state
sqlite3 ~/.data/pm-agent/pm-agent.db "SELECT * FROM sync_state"
```

## Integration Points

### With Existing Systems

1. **autonomous-project-manager**: Can call PM agent sync as part of its workflow
2. **mem0**: Stores project mappings for AI context
3. **Legal/Finance stores**: Separate domain-specific databases

### Webhooks (Future)

- GitHub webhook endpoint: `POST /api/webhooks/github`
- Motion webhook endpoint: `POST /api/webhooks/motion` (when available)

## Error Handling

1. **Rate Limits**: Exponential backoff with jitter
2. **Network Errors**: Retry 3 times before marking sync as failed
3. **Mapping Errors**: Log and skip, continue with other items
4. **Conflict Errors**: Log conflict, apply last-write-wins

## Monitoring

Sync health is tracked via:
- `sync_log` table for per-item results
- Daily summary at 21:00 sync run
- Slack notification on consecutive failures (configurable)
