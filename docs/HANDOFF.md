Wrath Shield v3 — Engineer Handoff
==================================

Overview
- Unified local stack with three services:
  - Next.js app (4242): UI + APIs (chat proxy, memory, feed, users, metrics)
  - Agentic Grok FastAPI (8001): xAI Grok agent with server-side tools and memory store
  - Streamlit EEG (8501): Neurable-friendly EEG tokenization dashboard
- Memory is Grok-first: model chooses what to save via memory_add; reading via memory_search uses Next facade.

Ports & URLs
- Next: http://localhost:4242
  - /chat, /eeg, /feed, /users/default, /api/*
- Grok: http://localhost:8001
  - /api/agentic/chat, /api/agentic/health, /api/agentic/memory/{add,search,list}
- Streamlit: http://localhost:8501 (embedded in /eeg)

Environment
- Copy .env.local.example → .env.local
- Required:
  - XAI_API_KEY (for Grok)
  - DATABASE_ENCRYPTION_KEY (base64, 32 bytes)
  - OPENROUTER_API_KEY (for OpenRouter client, optional in local flows)
  - WHOOP_CLIENT_ID/SECRET (OAuth), LIMITLESS_API_KEY (optional)
  - AGENTIC_GROK_URL (default http://localhost:8001)
  - NEXT_PUBLIC_STREAMLIT_URL (default http://localhost:8501)

Start flows
1) Agentic Grok
   - cd services/agentic-grok && source venv/bin/activate && python agentic_service.py
   - Health: GET /api/agentic/health
2) Streamlit EEG
   - cd services/eeg-tokenizer && source venv/bin/activate && streamlit run app.py
3) Next app
   - npm run dev (port 4242)
   - Home: http://localhost:4242/

Memory design
- Grok tools:
  - memory_search: calls Next /api/memory/search → delegates to MemoryWrapper
  - memory_add: stores text (+ optional metadata type/category/date) into mem_store.db
- Policy:
  - Durable-only saves (preferences, goals, anchors) with a hard cap of 3 writes per chat (AGENTIC_MEMORY_MAX_PER_CHAT)
- MemoryWrapper (Next):
  - Grok (preferred) → Qdrant (if available) → SQLite fallback
  - App helpers: addDailySummary, addAnchor, getAnchors

User & feed
- Users API: /api/users, /api/users/default (stores default_user_id in settings)
- Feed API: /api/feed (metrics via DB + anchors via memory)
- UI pages: /chat, /eeg, /feed, /users/default

WHOOP & Limitless
- WHOOP OAuth: /api/whoop/oauth/{initiate,callback}
- Token refresh handled in lib/WhoopClient
- Limitless key via /api/settings (encrypted at rest)

Database & migrations
- App DB: .data/wrath-shield.db (better-sqlite3)
- Migrations: /migrations; test-mode only applies baseline to keep suites stable
- Grok memory DB: services/agentic-grok/mem_store.db (SQLite)

Testing
- Run: npm test (63 suites, 999 tests)
- Jest covers: config, DB, WHOOP, Limitless, metrics route, memory helpers, integration paths

Code map (key files)
- Next
  - app/api/agentic/chat/route.ts (proxy to Grok)
  - app/api/memory/search/route.ts (Grok memory facade)
  - app/api/feed/route.ts (metrics + anchors)
  - app/api/users/* (basic user management)
  - app/{chat,eeg,feed,users/default}/page.tsx (UI)
  - lib/MemoryWrapper.ts (Grok→Qdrant→SQLite)
  - lib/db/{Database,queries,types}.ts (SQLite + migrations)
- Grok service
  - services/agentic-grok/agentic_service.py
    - create_custom_tools(): whoop_data_query, limitless_query, memory_search, memory_add
    - AgenticOrchestrator: model=“grok-4-fast”, policy for memory, streaming
    - Memory endpoints
- Streamlit
  - services/eeg-tokenizer/app.py + neurable_ws_client.py

Operational notes
- Dev ports are pinned (Next 4242, Grok 8001, Streamlit 8501)
- start-all.sh launches all three after a Qdrant health preflight (optional)
- If Qdrant is down, MemoryWrapper falls back to SQLite but warns

Security
- At-rest encryption: AES‑256‑GCM with HKDF; encrypted JSON wrappers (encryptToJSON/decryptFromJSON)
- Server-only guards prevent leaking secrets to client bundles
- No automatic client-side autosave; saving is model-driven and capped server-side

Troubleshooting
- Grok health 500: check XAI_API_KEY; ensure venv deps installed (xai_sdk)
- Next 500 on /chat: verify AGENTIC_GROK_URL and Grok health
- EEG blank: ensure Streamlit running on 8501; update NEXT_PUBLIC_STREAMLIT_URL if needed
- Memory not persisting: check services/agentic-grok/mem_store.db write permissions

Next steps (suggested)
1) Productize memory UX
   - Add “Save to memory” button per message, show last 5 saves in /chat
   - Add anchors form to /feed (category/date)
2) WHOOP/Limitless data sync
   - Add /api/sync to orchestrate pulls; cron/timers for scheduled syncs
3) Observability
   - Structured logs for memory_add calls (user_id, type, hash of text)
   - Health dashboard at /api/system/status (already exists)
4) Persistence
   - Move memory DB to Qdrant by default; add docker-compose for Qdrant
5) Security
   - Secret scanning CI; ensure no secrets leak via logs/tests
6) Packaging
   - PM2 or systemd units; single start-all with health gates; .env templates per environment

Contacts
- Handoff prepared by: Engineering
- Date: 2025‑11‑11

