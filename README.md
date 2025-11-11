# Wrath Shield v3

A comprehensive Next.js 14 backend for manipulation detection with WHOOP and Limitless integration, semantic memory (Mem0 + Qdrant), and an AI coaching engine.

📊 **[View Detailed System Overview](SYSTEM_OVERVIEW.md)** - Complete status, active services, and recent updates

## 🔧 Recent Updates

**2025-11-10**: Fixed Whoop OAuth callback encryption error
- Modified callback route to handle missing refresh tokens (stores `null` instead of empty string)
- Added comprehensive test suite (`test-whoop-callback-fix.ts`)
- Full details: [WHOOP_OAUTH_FIX_SUMMARY.md](WHOOP_OAUTH_FIX_SUMMARY.md)

## ⚠️ Current Status

**Backend: 100% Complete (525 tests passing)**
**Frontend: Not Yet Implemented**

This repository contains a fully functional backend SDK with zero UI implementation. The system can detect manipulative conversation patterns, track WHOOP biometrics, integrate with Limitless pendant transcripts, and provide coaching insights - but currently has no user interface for interaction.

## What Exists

### Backend Infrastructure ✅
- **Database**: SQLite with 7 tables (cycles, recoveries, sleeps, lifelogs, tokens, scores, settings)
- **Security**: AES-256-GCM encryption with HKDF key derivation, server/client boundary enforcement
- **Configuration**: All API keys configured in `.env.local` (not committed)

### WHOOP Integration ✅
- OAuth2 flow with CSRF protection
- Automatic token refresh (60-second buffer)
- Paginated data fetchers for cycles, recoveries, and sleeps
- Classification logic (strain levels, recovery levels)
- Database normalization for all WHOOP data types
- **Fixed (2025-11-10)**: Handles missing refresh tokens correctly

### Limitless Integration ✅
- Settings API with encrypted key storage
- Token bucket rate limiter (180 req/min)
- Cursor-based pagination
- Incremental sync with `last_successful_pull` tracking

### Manipulation Detection ✅
- 6 manipulation categories: gaslighting, guilt, obligation, conditional affection, minimization, blame shifting
- Pattern matching with natural language variations
- Response classification (wrath, compliance, silence)
- Severity scoring with intensifier detection

### Semantic Memory (Mem0 + Qdrant) ✅
- Primary/fallback architecture
- OpenAI and local embeddings support
- App-specific helpers: `addDailySummary()`, `addAnchor()`, `getAnchors()`

### Daily Summary Pipeline ✅
- Analyze lifelogs for manipulations
- Compose rich summaries with WHOOP metrics
- Three-step storage: Mem0 → lifelogs → unbending score
- Batch processing with idempotent operations

### APIs (JSON Endpoints) ✅
- `GET /api/metrics` - Today + 7-day + 30-day aggregates (5-min cache)
- OAuth endpoints for WHOOP
- Settings endpoint for Limitless

### Test Coverage ✅
- **525 passing tests** across all modules
- Unit tests for all components
- Integration tests for complete workflows
- Performance benchmarks (batch inserts <500ms, queries <100ms)
- Resilience tests for edge cases and errors
- Security audits (no secret leakage)

## What Doesn't Exist (Yet)

### Missing UI Components ❌
- No morning routine interface
- No evening routine interface
- No chat interface for coaching
- No lifelog browser
- No interactive dashboard (only data charts exist)
- No settings page

### Missing Automation ❌
- No cron jobs for automatic data sync
- No background workers
- No scheduled coaching sessions
- No push notifications

### Missing OpenRouter Integration ❌
- Coaching engine infrastructure exists
- LLM client implemented and tested
- But no endpoints to trigger coaching responses
- No UI to display coaching insights

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User (You)                           │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   MISSING: Frontend UI  │  ← Needs Implementation
         └─────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   Next.js API Routes                     │
│  ✅ /api/metrics (dashboard data)                        │
│  ✅ /api/whoop/oauth/* (WHOOP auth)                      │
│  ✅ /api/settings (Limitless key)                        │
│  ❌ /api/coaching (coaching responses - not implemented) │
│  ❌ /api/sync (data sync - not implemented)              │
└──────────────────────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  WHOOP Client    │       │ Limitless Client │
│  ✅ OAuth2        │       │ ✅ Rate Limiting  │
│  ✅ Auto Refresh  │       │ ✅ Pagination     │
│  ✅ Data Fetching │       │ ✅ Incremental    │
└──────────────────┘       └──────────────────┘
         │                           │
         └─────────────┬─────────────┘
                       ▼
         ┌─────────────────────────┐
         │  Manipulation Detector  │
         │  ✅ 6 Categories         │
         │  ✅ Response Detection   │
         └─────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Daily Summary Engine  │
         │   ✅ Compose Summaries   │
         │   ✅ Calculate Scores    │
         └─────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│   SQLite DB      │       │   Mem0 + Qdrant  │
│   ✅ 7 Tables     │       │   ✅ Semantic     │
│   ✅ Encrypted    │       │   ✅ Embeddings   │
└──────────────────┘       └──────────────────┘
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- API keys for:
  - WHOOP (OAuth2 credentials)
  - OpenRouter (for coaching)
  - Limitless (optional)
  - OpenAI (optional, for better embeddings)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CryptoJym/wrath-shield-v3.git
cd wrath-shield-v3
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

4. Run the development server:
```bash
npm run dev
```

5. Visit `http://localhost:3002` to see the (very basic) dashboard.

### Testing

Run the full test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Current Capabilities (via Code)

Since there's no UI, you can interact with the system programmatically:

### 1. Fetch WHOOP Data
```typescript
import { getWhoopClient } from '@/lib/WhoopClient';
import { insertCycles } from '@/lib/db/queries';

const client = getWhoopClient();
const cycles = await client.fetchCyclesForDb('2025-01-01', '2025-01-31');
await insertCycles(cycles);
```

### 2. Sync Limitless Lifelogs
```typescript
import { getLimitlessClient } from '@/lib/LimitlessClient';

const client = getLimitlessClient();
const newCount = await client.syncNewLifelogs();
console.log(`Synced ${newCount} new lifelogs`);
```

### 3. Analyze Manipulations
```typescript
import { ManipulationDetector } from '@/lib/ManipulationDetector';

const detector = new ManipulationDetector();
const lifelog = { /* lifelog data */ };
const analysis = detector.analyzeLifelog(lifelog);
console.log(analysis.manipulations); // Array of detected patterns
```

### 4. Generate Daily Summaries
```typescript
import { composeDailySummary } from '@/lib/ingest';

const summary = await composeDailySummary({
  date: '2025-01-31',
  recovery: { score: 78 },
  cycle: { strain: 12.4 },
  sleep: { performance: 85 },
  lifelogs: [/* lifelogs */]
});
console.log(summary.summary); // "2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. ..."
```

## Next Steps

To make this usable, you'll need to build:

### Phase 1: Basic UI (2-4 hours)
1. **Dashboard Page** (`app/dashboard/page.tsx`)
   - Display `/api/metrics` data
   - Show today's recovery, strain, sleep
   - Display 7-day and 30-day trends

2. **Settings Page** (`app/settings/page.tsx`)
   - WHOOP OAuth button
   - Limitless API key input
   - Current configuration status

### Phase 2: Interactive Features (4-8 hours)
3. **Lifelog Viewer** (`app/lifelogs/page.tsx`)
   - Browse daily lifelogs
   - View manipulation detection results
   - See wrath deployment status

4. **Coaching Interface** (`app/coaching/page.tsx`)
   - Display coaching insights
   - Interactive Q&A with coaching engine
   - Context-aware responses

### Phase 3: Automation (2-4 hours)
5. **Background Sync** (`app/api/sync/route.ts`)
   - Cron job to fetch WHOOP data daily
   - Sync Limitless lifelogs hourly
   - Generate daily summaries automatically

6. **Morning/Evening Routines**
   - Scheduled coaching sessions
   - Proactive insights based on data
   - Interactive check-ins

## Performance

Current benchmarks (from test suite):
- Database batch inserts: <500ms for 100+ rows
- Database queries with indexes: <100ms
- Manipulation detection: <200ms for 1-hour transcript
- Daily summary storage: <1s
- Concurrent operations: Fully supported

## Security

- **Encryption**: AES-256-GCM for all sensitive data
- **Key Derivation**: HKDF for per-record keys
- **Server-Only Enforcement**: Webpack aliases + runtime guards prevent client-side secret access
- **OAuth2**: CSRF protection with cryptographic state tokens
- **No Secret Leakage**: Verified via test audits

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: SQLite with better-sqlite3
- **Vector DB**: Qdrant (local or cloud)
- **Memory**: Mem0 (semantic memory wrapper)
- **Encryption**: Node.js crypto (AES-256-GCM)
- **Testing**: Jest + @testing-library/react
- **APIs**: WHOOP, Limitless, OpenRouter

## Contributing

This is a personal project, but suggestions and contributions are welcome:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For questions or issues, open a GitHub issue or contact the maintainer.

---

**Remember**: This is a backend SDK. The system is fully functional from a code perspective, but needs UI work to become user-friendly. All infrastructure, data pipelines, and intelligence features are production-ready.
### 2025-11-10: Live EEG + Unified Dashboard

- Added Neurable WebSocket live stream client (`services/eeg-tokenizer/neurable_ws_client.py`).
- Streamlit EEG dashboard now includes controls to start/stop the WS client and shows accurate DB/brain-state panels.
- Next.js unified nav (Home, Agentic Grok Chat, EEG Dashboard). EEG page embeds Streamlit (`/eeg`).
- Agentic Grok chat UI (`/chat`) proxies to the local Agentic Grok FastAPI service so server-side tools are enabled, using your `XAI_API_KEY`.
