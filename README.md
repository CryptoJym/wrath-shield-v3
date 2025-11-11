# Wrath Shield v3 (Unified)

Unified local stack for Grok‑assisted coaching, WHOOP + Limitless integrations, Neurable EEG via Streamlit, and Grok‑backed memory.

- Next.js 14 app (4242)
- Agentic Grok FastAPI service (8001)
- Streamlit EEG dashboard (8501)

All Node/Jest tests: 63 suites, 999 tests — passing.

## Services & Ports
- Next (UI + APIs): http://localhost:4242
  - Chat: /chat (proxies to Agentic Grok)
  - EEG: /eeg (embeds Streamlit)
  - Feed: /feed (metrics + anchors)
  - Users: /users/default (set default user)
- Agentic Grok: http://localhost:8001
  - POST /api/agentic/chat, /chat/stream
  - GET /api/agentic/health
  - Memory: /api/agentic/memory/{add,search,list}
- Streamlit EEG: http://localhost:8501

## Environment
Copy and edit:
```
cp .env.local.example .env.local
```
Key vars:
- XAI_API_KEY, AGENTIC_GROK_URL (defaults to http://localhost:8001)
- WHOOP_CLIENT_ID/SECRET (OAuth2)
- OPENROUTER_API_KEY (for coaching via OpenRouter)
- LIMITLESS_API_KEY (optional)
- OPENAI_API_KEY (optional embeddings)
- DATABASE_ENCRYPTION_KEY (base64 32‑byte)
- NEXT_PUBLIC_STREAMLIT_URL (default http://localhost:8501)

## Start locally
Option A (individual):
```
# 1) Agentic Grok
cd services/agentic-grok && source venv/bin/activate && python agentic_service.py

# 2) Streamlit EEG
cd ../eeg-tokenizer && source venv/bin/activate && streamlit run app.py

# 3) Next
cd ../../ && npm run dev
```

Option B (script):
```
./scripts/start-all.sh
```

## Memory model & policy
- Grok has two memory tools:
  - memory_search (read) → calls Next /api/memory/search
  - memory_add (write) → writes to Agentic Grok’s mem_store.db
- Built‑in policy in Grok orchestrator enforces:
  - Save only durable facts (preferences, goals, anchors with date)
  - Avoid secrets/ephemeral info; cap N writes per chat (default 3)
- Next’s MemoryWrapper prefers Grok → Qdrant → local SQLite.

## Key API routes (Next)
- GET /api/metrics — aggregates (today, last 7/30 days)
- POST /api/memory/search — HTTP facade for Grok tool
- GET /api/feed — dashboard feed (metrics + anchors)
- WHOOP OAuth: /api/whoop/oauth/{initiate,callback}
- Settings: /api/settings (Limitless key)
- Users: /api/users, /api/users/default

## Data & migrations
- SQLite primary app DB: .data/wrath-shield.db
- Migrations under /migrations
  - Test runs: only baseline migration applied for stability
- Grok memory: services/agentic-grok/mem_store.db

## Testing
```
npm test
```
Outputs: 63/63 suites passing, 999/999 tests passing.

## Handoff for engineers
See docs/HANDOFF.md for detailed architecture, code map, troubleshooting, and next steps.

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
