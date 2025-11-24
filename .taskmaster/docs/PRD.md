# Legal Advocate AI – Strategic Case Guardian
## Product Requirements Document (PRD)

### Core Mission
"Act as an experienced family‑law attorney's analytical brain—continuously ingesting the full case history, spotting risks, and surfacing the right document, fact, or next action at the moment you and your attorney need it—while keeping everything private on your Mac."

**Primary success metric (MVP)**: From a clean install, the system builds an auditable Case Timeline (events + sources + citations) from (a) user‑provided PDFs and (b) iMessage/Gmail/Outlook threads with designated legal contacts, and generates a daily briefing with three categories—Urgent, Opportunities, Warnings—each linking back to evidence snippets and Utah Title 81 references where applicable.

### Important Constraints & Compliance

- This system provides legal information and workflow assistance; it does not replace an attorney and should never present itself as legal counsel
- Utah UPL rules define "practice of law" broadly (informing/advising/assisting through application of law to particular facts)
- Build guardrails and disclaimers accordingly
- For Utah family matters, statutes were recodified into Title 81 (Utah Domestic Relations Code), effective 2024
- Custody & parent‑time standards now live in § 81‑9‑2xx
- Court portals: MyCase, Xchange, PACER - For MVP, ingest docket emails and user‑downloaded PDFs rather than automated logins

## 1) MVP Scope

### In (MVP)

#### Strategic Memory & Timeline (foundational)
- Ingest user PDFs (orders, motions, emails saved as PDF), text messages (iMessage), and legal emails (Gmail/Outlook)
- Normalize into Events with time, actors, issues, document citations
- Local vector index + graph (Memgraph) for people, orders, deadlines, incidents, and relationships

#### Daily Strategic Briefing (local generation)
- "Urgent/Opportunities/Warnings" with links to timeline evidence
- Utah Title 81 snippets appended when relevant

#### Communication Monitoring (read‑only + pre‑send check)
- **iMessage**: read ~/Library/Messages/chat.db (with user‑granted Full Disk Access) for defined legal contacts; periodic delta scans
- **Gmail**: monitor case labels/threads via Gmail API watch or IMAP IDLE
- **Microsoft 365/Outlook**: via Microsoft Graph change notifications (MVP may poll, but include watch/subscribe code stubs)
- **Pre‑send review (opt‑in)**: user invokes a Quick Action / Compose‑via‑AI flow before sending to flag tone risk/absolute language/admissions and propose neutral rewrites

#### Utah Family‑Law grounding
- Bundle Title 81 sections most used in custody/parent‑time (§ 81‑9‑202, § 81‑9‑206, § 81‑9‑302/304)
- Pinpoint citations in outputs
- Seed case library with In re K.M., 2025 UT App 17

#### Calendar outputs (non‑destructive)
- Export .ics files (deadlines, hearings, follow‑ups)
- User imports to Calendar/Google (safer than writing directly)

### Out (defer to v1/v2)
- Auto‑login scraping of MyCase/Xchange/PACER
- Automated filings or drafting pleadings for filing (UPL risk)
- Predictive judge win‑rates beyond descriptive profiles
- Always‑on interception of outbound messages

## 2) Architecture (MVP, local‑first)

**Runtime**: macOS (Mac Studio), Python + Swift (MailKit extension, optional), local LLM (Ollama/LM Studio) or Sonnet runtime

### Core Services (local daemons/jobs)

#### Ingestion Service
- **Docs**: unstructured → text blocks + metadata; pdfminer.six fallback; OCR via pytesseract when needed
- **iMessage**: SQLite read of ~/Library/Messages/chat.db (copy‑then‑read to avoid locks)
- **Email**: Gmail users.watch→ Pub/Sub webhook (configurable) or polling; Outlook via Microsoft Graph change notifications

#### Event Builder & Normalizer
- Converts raw items into Events: {when, type, actors, text, source_doc, tags, Utah_refs, attachments, confidence}
- Extracts entities (people/orgs/places/dates/statutes) via spaCy + rules
- PII masking utilities via Presidio for logs/export

#### Case Memory Layer
- **Graph memory (Memgraph; Cypher)**: relationships
  - (:Person)-[:MESSAGED|REPRESENTS|JUDGE_OF]->(:Person|:Role)
  - (:Order)-[:AMENDS|SUPERSEDES]->(:Order)
  - (:Event)-[:DERIVED_FROM]->(:Document)
  - Store Title 81 nodes with section metadata
- **Vector index**: semantic retrieval (local: FAISS/Chroma) of snippets, orders, emails

#### Analysis & Guidance
- **Risk checks**: toxicity/hostility (Detoxify), absolutes ("never/always"), admissions keywords, order‑violation heuristics
- Produce rewrite suggestions w/ LLM
- **Briefing generator**: assembles Urgent/Opportunities/Warnings from graph queries + recent deltas; attaches Utah Title 81 snippets + links

#### Output & UX
- Daily Brief (Markdown/HTML) + .ics export for deadlines/tasks
- **Pre‑send Check UI**:
  - Mail: MailKit compose extension
  - System‑wide: Quick Action / Share Sheet
- **Local LLM options**: Ollama/LM Studio (Llama 3.1 8B/70B quantized) on Apple Silicon
- **Encryption & privacy**: All case data stored locally; app DB encrypted with SQLCipher; logs redacted by Presidio policies

## 3) Data Design (MVP)

### Relational (SQLCipher)
```sql
documents(doc_id, type, title, path, sha256, created_at, source, verified)
snippets(snippet_id, doc_id, text, page, offset, embedding, utah_section_ref)
messages(msg_id, channel, counterpart, dir, sent_at, text, doc_link)
events(event_id, occurred_at, event_type, summary, severity, primary_doc_id)
event_links(event_id, graph_node_id)
people(person_id, name, role, firm, email, phone)
orders(order_id, date, title, status, supersedes_order_id)
```

### Graph (Memgraph)
- Nodes: (:Person {role}), (:Event {type, occurred_at}), (:Order {status}), (:Statute {title:"UT §81-9-206", url})
- Edges: [:PARTY_TO], [:REPRESENTS], [:REFERENCES], [:AMENDS], [:VIOLATES], [:SUPPORTS]

### Vector store
- Embeddings for snippets/messages to power semantic recall

## 5) Prioritized Milestones (6 weeks total, conservative)

### M0 (Days 1–3): Secure skeleton & local LLM
- Create ~/LegalAdvocateAI (permissions 700)
- Init SQLCipher DB
- Set up Ollama or LM Studio with local model
- Wire configuration for Sonnet optional remote
- Add Presidio redaction for logs
- **Exit**: CLI "hello brief" works on placeholder data

### M1 (Week 1): Document ingestion → Timeline
- Integrate unstructured + pdfminer.six
- Create Event Builder
- Minimal graph schema (Memgraph)
- **Exit**: 10 PDFs → ≥ 10 events, navigable timeline

### M2 (Week 2): iMessage + Email monitors
- iMessage read (copy‑then‑query, Full Disk Access instructions UI)
- Gmail watch (or polling) and basic Outlook Graph polling
- Label filter config
- **Exit**: New email/iMessage appear in timeline within SLA

### M3 (Week 3): Daily Brief + .ics
- Ranker + generator
- Title 81 citation attachments
- .ics export
- **Exit**: Daily Brief shows three categories, each item links back to evidence

### M4 (Week 4): Pre‑send risk check (user‑invoked)
- MailKit compose extension for Apple Mail
- Quick Action workflow for any app selection
- Detoxify tone risk + rewrite suggestions
- **Exit**: Click‑to‑analyze draft → risk panel + neutral rewrite

### M5 (Week 5): Utah domain pack
- Bundle § 81‑9‑202/206/302/304 content
- Create Utah‑aware prompts
- Seed In re K.M.
- **Exit**: Brief and guidance include correct sections & links

### M6 (Week 6): Hardening & usability
- Privacy toggles, on/off monitors
- Audit log
- Performance tests on 5k messages + 500 docs
- Add import from MyCase downloads helper
- Optional Xchange/PACER pointers
- **Exit**: Beta ready

## 6) Acceptance Criteria (MVP)
- **Timeline fidelity**: Every Daily Brief item opens a view with exact snippet and document page ref
- **Utah citations**: When an item concerns custody/parent‑time, the UI displays the specific Title 81 section(s) and text used
- **Risk rewrites**: For drafted hot messages, rewrites remove absolutes, cite order/date, and propose a neutral ask
- **No cloud dependency**: Air‑gap mode functional (LLM local, no external calls)
- **Security**: DB stored via SQLCipher; logs redacted by Presidio policies

## 11) Taskmaster.ai Backlog

### EPIC 1 — Case Memory & Timeline (M1)
- T1.1: Install Memgraph; define nodes/edges; seed schema migration
- T1.2: Add SQLCipher DB; tables for documents/snippets/messages/events
- T1.3: Integrate unstructured + pdfminer.six; parse PDFs → snippets + metadata
- T1.4: NER (spaCy) + rule extractors (case #, judge, orders)
- T1.5: Event Builder service (idempotent); link to graph

### EPIC 2 — Communication Monitors (M2, M4)
- T2.1: iMessage reader: copy chat.db, run SQL query for whitelisted contacts; convert to messages
- T2.2: Gmail watcher/poller + label config UI
- T2.3: Outlook Graph change notifications or poller
- T2.4: Build Detoxify‑based tone check; admissions regex; absolute language detector
- T2.5: MailKit compose extension; System Quick Action for generic apps

### EPIC 3 — Briefings & Calendars (M3)
- T3.1: Ranker for Urgent/Opportunities/Warnings
- T3.2: Brief generator (md/html) with evidence back‑links
- T3.3: .ics export module

### EPIC 4 — Utah Domain (M5)
- T4.1: Bundle Title 81 sections (§ 81‑9‑202/206/302/304) as local HTML; map to triggers
- T4.2: Seed case library with In re K.M. summary

### EPIC 5 — Security & UX (M6)
- T5.1: SQLCipher key mgmt via Keychain
- T5.2: Presidio log redaction
- T5.3: Audit log UI; privacy toggles
- T5.4: Performance tests on synthetic corpora
