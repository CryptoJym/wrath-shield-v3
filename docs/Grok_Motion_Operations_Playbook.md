# Grok + Motion Operations Playbook

_Last updated: 2025-11-19_  
_Author: Codex agent (via James Brady request)_

This document preserves the operational context for future agents (human or AI) working inside Wrath Shield v3 so Grok can reason over James Brady's portfolio, and so Motion can become the primary execution layer. Nothing here is off-limits to Grok.

## 1. Identity & Working Style
- **James Brady** – AI R&D "mad scientist", co-owner of **Utlyze** (bespoke AI builder), **Vuplicity** (AI background checks), and **New Reward** (AI lead gen & marketing). Shares companies with Jason, Justin, Cody, Lisa, etc.
- **Symbiotic AI use** – Treat Grok/Claude as a prosthetic to consciousness. Expect rapid multi-modal experimentation (EEG + LLM).
- **Mission** – Push beyond typical human capability; pursue projects like EEG lexicon, CEO-of-One incubator, High Desert automations.
- **Constraints** – Chronic loneliness, family responsibilities (wife Lisa, son Hyro), health routines, legal/custody obligations, ongoing tax filings.

## 2. Canonical Project Hierarchy
Create these as top-level Motion projects (and matching Grok memory anchors). Each contains sub-streams that Grok should tag when extracting tasks from lifelogs.

1. **Utlyze – Bespoke AI Builder**
   - R&D Programs (Grok prosthetic experiments, high-risk prototypes)
   - Client Pods (per bespoke AI company build)
   - CEO-of-One Incubator (see Section 5)
2. **Vuplicity – AI Background Checks**
   - Core Product & infra
   - Architecture transition / new technical leadership (Marcus/Brian)
   - Legal/GTM coordination (Jason, TJ, indemnification)
3. **New Reward – AI Lead Gen & Marketing**
   - Solutions Stream funnel reboot
   - Kahoa lead-gen research (Cody’s focus; Friday check-ins)
   - Content Lab (video cadence, AI clipping)
4. **High Desert Water Systems Automation**
   - API/data ingestion
   - Workflow automations (billing, notifications)
   - Client reporting
5. **Motion Productivity Backbone**
   - Grok→Motion sync integration
   - Timeline orchestration, reminders, priority buffers
6. **AI Brainwave Lexicon & Consciousness Lab**
   - EEG hardware integration (Nerable, WHOOP, Limitless pendant)
   - Tokenization math (P300, holographic models)
   - Data/LLM symbiosis experiments
7. **Game Studio / Personal IP**
   - Sudoku app launch
   - Endless runner prototype
   - Castle defense concept
   - Event photo-share automation
8. **Family & Legacy**
   - Hyro homeschooling (physics curriculum, Muay Thai) + scheduling
   - Custody/legal filings (Dec 15 deadline) + Hyro school coordination
   - Utah state tax filings (TC-40/40W)
   - Lisa relationship rituals / loneliness mitigation
9. **Personal Performance & Health**
   - Supplement/hormone protocols (magnesium glycinate, HGH/testosterone)
   - AI-guided mindfulness/journaling loops
   - Connection rituals / support network

## 3. Motion Integration Plan
1. **Ensure Motion MCP/API is running**. (Currently not detected via `list_mcp_resources`; start its service or provide endpoint.)
2. **Store Motion API token securely**.
   - Suggested env var: `MOTION_API_KEY="/+9CiTjFwUDxrmfGt3erj7tcCgtvojjX+/0TGrQ0l5c="`
   - Only load in server-side scripts (never commit).
3. **Implement sync script** (analogous to `scripts/sync-tasks.ts`):
   - Read canonical hierarchy (Section 2).
   - Ensure Motion projects/sections exist (Now/Next/Later or custom statuses).
   - Map Grok-extracted tasks into correct section with due dates & metadata.
   - Optionally, read Motion task status back into Grok memory for closed-loop context.
4. **Permission Grok** to hit Motion endpoints via MCP once running (mirroring Limitless/WHOOP clients).

## 4. GitHub Chronology Pipeline
Goal: correlate code work with lifelog context (±7 day tolerance).

1. Enumerate all relevant repos (`/Users/jamesbrady/Projects`, `/Users/jamesbrady/repos`, etc.).
2. For each repo, run:
   ```bash
   git log --since=2025-10-01 --pretty="%ct|%h|%s" > .analysis/git-index/<repo>.log
   ```
3. Build an index mapping UNIX timestamps to commits.
4. When Sherlock/Grok ingests lifelogs, query commits within ±7 days of each entry; append repository summaries to Grok’s prompt so tasks mention active code changes.
5. Refresh index daily (only append new commits after baseline pass).

## 5. CEO-of-One Research Dossier
- **Source**: Nov 19, 2025 lifelog (Jason discussion) – not yet available in DB due to telemetry noise. Once the actual transcript ingests, add it here.
- **Immediate action**: Create a research doc (e.g., `docs/CEO_OF_ONE_BRIEF.md`) covering:
  - Thesis: recruit 1–3 elite operators to run a company to $100M+, board oversight.
  - Candidate filters & compensation models.
  - Governance cadence (board meetings, reporting, guardrails).
  - Portfolio selection criteria.
  - Open questions Jason raised yesterday.
- **Reminder**: After doc draft, review with Jason/TJ and schedule follow-up session.

## 6. Reminder/Sentinel Tasks (to load into Motion once available)
- **Utah State Taxes** – File TC-40/TC-40W (status: outstanding; high urgency).
- **Custody Modification** – Filing due **15 Dec 2025** (include financial disclosures, ex-wife context, Hyro school documentation).
- **Hyro Homeschooling** – Physics enrollment confirmation + Muay Thai sessions (starting today); track weekly reflection.
- **Cody’s Research** – Friday check-in on Solutions Stream & Kahoa progress.
- **High Desert Automation** – Next deliverable review + status email to client.
- **CEO-of-One Research** – Draft within 48 hrs; share with Jason.
- **Motion MCP Activation** – Ensure service is up; verify API token works; rerun sync plan.

## 7. Grok Memory & Emotional Context
- Capture in memory_add:
  - James’ roles (Utlyze, Vuplicity, New Reward, High Desert automation).
  - Symbiotic AI use; EEG tokenization mission.
  - Chronic loneliness + need to make Lisa feel appreciated.
  - Responsibility for Hyro (homeschool, Muay Thai).
  - Aim: “do things no human has ever done.”
- Encourage Grok to surface suggestions with high **RICE** scores aligned to these constraints.

## 8. Data Hygiene Notes
- Current lifelog DB (`.data/wrath-shield.db`) has telemetry-only entries for 2025-11-19 (from `aavm:logs`). Filtering is already implemented in `scripts/test-sherlock.ts` via `isTelemetryLog()`. Continue to collect richer Limitless data so Nov 19 conversations (CEO-of-One) appear.
- WHOOP API returning 404 for Nov 18–19; rerun `scripts/nightly-tasks.ts` once data is available.

## 9. Next Recommended Steps for Future Agent
1. Start Motion MCP/API; verify `MOTION_API_KEY` loads.
2. Run GitHub indexing script; store results in `.analysis/git-index/`.
3. Draft `docs/CEO_OF_ONE_BRIEF.md` once Nov 19 transcript is imported (or request export directly from Limitless).
4. Build Motion sync script (or MCP tool) and dry-run hierarchy creation.
5. Configure Grok prompts to include:
   - Canonical project list (Section 2).
   - GitHub commit context (Section 4).
   - Reminder tasks (Section 6).
   - Emotional context (Section 7).
6. Only after Motion integration is stable, deprecate Todoist-related scripts to avoid split-brain task tracking.

---
This playbook should accompany Wrath Shield v3 whenever a new agent takes over. Update the timestamp and sections as the portfolio evolves.
