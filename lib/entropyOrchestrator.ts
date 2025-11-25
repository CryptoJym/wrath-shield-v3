/**
 * Entropy / Coherence Orchestrator
 * --------------------------------
 * Runs an hourly pass that:
 * 1) Pulls fresh lifelogs (Limitless)
 * 2) Sends the delta to Grok (agentic chat) with a structured JSON contract
 * 3) Persists proposed actions (tasks, drafts, reminders, calendar events) with confidence scores
 *
 * This is intentionally side-effect lite: it only logs actions. Downstream
 * executors can read agentic_actions rows and decide whether to auto-execute
 * (confidence gate) or present for review.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { insertAgenticActions, insertSettings } from './db/queries';
import { getDatabase } from './db/Database';
import { getLimitlessClient } from './LimitlessClient';
import type { Lifelog } from './db/types';
import { PromptBuilder } from './PromptBuilder';
import { DirectLLMClients } from './DirectLLMClients';
import { initializeMemory, getAllMemories, addMemory } from './MemoryWrapper';

type RunOptions = {
  userId?: string;
  minConfidence?: number;
  dryRun?: boolean;
  maxLogs?: number;
};

type ParsedAction = {
  action_type: 'task' | 'email_draft' | 'text_message' | 'reminder' | 'calendar_event' | 'note';
  title?: string;
  content: string;
  target?: string;
  due_iso?: string | null;
  confidence?: number;
  metadata?: Record<string, any>;
};

const DEFAULT_MIN_CONFIDENCE = 0.85;
const DEFAULT_MAX_LOGS = 24; // last ~day of hourly deltas
// Direct models (primary + fallback); NO GPT-4.1
const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-5.1';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'grok-4-1-fast';
const SECONDARY_MEMORY_PATH = path.resolve(process.cwd(), '.data', 'context_enricher_mem.jsonl');

export async function runEntropyCoherencePass(opts: RunOptions = {}): Promise<{
  processed: number;
  kept: number;
  dismissed: number;
  contextRequests?: number;
  noData?: boolean;
  error?: string;
}> {
  const userId = opts.userId || 'default';
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const maxLogs = opts.maxLogs ?? DEFAULT_MAX_LOGS;

  await initializeMemory();

  const db = getDatabase();

  // 1) Sync new lifelogs from Limitless
  try {
    const limitless = getLimitlessClient();
    await limitless.syncNewLifelogs();
  } catch (e) {
    console.warn('[entropy] Limitless sync failed, continuing with existing logs', e);
  }

  // 2) Determine window since last run
  const lastRunIso = getLastRunIso(db);
  const lastRunTs = lastRunIso ? Date.parse(lastRunIso) : Date.now() - 6 * 3600 * 1000; // fallback: 6h

  // 3) Fetch new lifelogs
  const lifelogs = db
    .prepare<Lifelog & { created_at?: number }>(
      `SELECT * FROM lifelogs WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?`
    )
    .all(Math.floor(lastRunTs / 1000), maxLogs) as (Lifelog & { created_at?: number })[];

  const meaningfulLogs = lifelogs.filter((log) => !isTelemetryLog(log));
  if (meaningfulLogs.length === 0) {
    return { processed: 0, kept: 0, dismissed: 0, noData: true };
  }

  // 4) Build prompt for Grok
  const systemPrompt = buildSystemPrompt();
  const memoryContext = await getMemoryContext(userId, 6);
  const userPrompt = buildUserPrompt(meaningfulLogs, memoryContext);

  const raw = await callModelsWithBackoff(systemPrompt, userPrompt);
  const parsed = parseActions(raw);

  if (!parsed || parsed.length === 0) {
    // No actions → escalate to context enricher to fetch missing info
    const ctx = await runContextEnricher(meaningfulLogs, []);
    const ctxCount = await persistContextRequests(ctx.requests, userId, opts.dryRun);
    return { processed: meaningfulLogs.length, kept: 0, dismissed: 0, contextRequests: ctxCount };
  }

  // 6) Confidence gate + persist
  const actionsToStore = parsed.map((a) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    type: a.action_type,
    target: a.target ?? null,
    title: a.title ?? null,
    content: decorateContent(a),
    confidence: typeof a.confidence === 'number' ? a.confidence : null,
    status: a.confidence && a.confidence >= minConfidence ? 'proposed' : 'dismissed',
    source: 'hourly-scan',
    metadata: JSON.stringify({
      due_iso: a.due_iso ?? null,
      ...((a.metadata as any) || {}),
    }),
  }));

  if (!opts.dryRun) {
    insertAgenticActions(actionsToStore);
    setLastRunIso(db, new Date().toISOString());
    const memo = `Entropy pass: kept=${kept}, dismissed=${dismissed}, total=${actionsToStore.length}`;
    await addMemory(memo, userId, { type: 'entropy_pass', kept, dismissed, total: actionsToStore.length });
  }

  const kept = actionsToStore.filter((a) => a.status === 'proposed').length;
  const dismissed = actionsToStore.length - kept;

  const lowConfidence = actionsToStore.filter((a) => a.status === 'dismissed');
  let ctxCount = 0;
  if (kept === 0 || lowConfidence.length > 0) {
    const ctx = await runContextEnricher(meaningfulLogs, actionsToStore);
    ctxCount = await persistContextRequests(ctx.requests, userId, opts.dryRun);
  }

  return { processed: meaningfulLogs.length, kept, dismissed, contextRequests: ctxCount };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLastRunIso(db: ReturnType<typeof getDatabase>): string | null {
  try {
    const row = db
      .prepare<{ value_enc: string }>(`SELECT value_enc FROM settings WHERE key = 'ea_last_run_iso' LIMIT 1`)
      .get();
    const v = row?.value_enc?.trim();
    return v || null;
  } catch {
    return null;
  }
}

function setLastRunIso(db: ReturnType<typeof getDatabase>, iso: string) {
  try {
    insertSettings([{ key: 'ea_last_run_iso', value_enc: iso }]);
  } catch (e) {
    console.warn('[entropy] failed to persist last_run_iso', e);
  }
}

function isTelemetryLog(log: Lifelog): boolean {
  if (!log) return false;
  try {
    const raw = log.raw_json ? JSON.parse(log.raw_json) : null;
    const source = (raw?.source || '').toLowerCase();
    if (source.startsWith('aavm:logs')) return true;
    const text = (raw?.text || log.title || '').toLowerCase();
    const meta = raw?.metadata || {};
    const hasHttp = meta.method || meta.path || meta.reqId;
    if (text === 'request' && hasHttp) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function getMemoryContext(userId: string, limit: number): Promise<string[]> {
  try {
    const memories = await getAllMemories(userId);
    return memories
      .slice(0, limit)
      .map((m: any) => `- ${m.text}${m.metadata?.type ? ` [${m.metadata.type}]` : ''}`);
  } catch (e) {
    console.warn('[entropy] memory fetch failed', e);
    return [];
  }
}

function buildUserPrompt(logs: (Lifelog & { created_at?: number })[], memoryLines: string[]): string {
  const lines: string[] = [];
  lines.push('You get the last batch of lifelogs. Produce only JSON as specified.');
  lines.push('');
  if (memoryLines.length) {
    lines.push('Recent memory notes:');
    lines.push(...memoryLines);
    lines.push('');
  }
  lines.push('Recent lifelogs (newest last):');
  for (const log of logs) {
    const ts = log.created_at ? new Date(log.created_at * 1000).toISOString() : log.date;
    const text = extractText(log);
    lines.push(`- [${ts}] ${text}`);
  }
  return lines.join('\n');
}

function extractText(log: Lifelog): string {
  if (!log.raw_json) return log.title || '';
  try {
    const raw = JSON.parse(log.raw_json);
    return raw.markdown || raw.transcript || raw.text || log.title || '';
  } catch {
    return log.title || '';
  }
}

function buildSystemPrompt(): string {
  return `
You are WRATH-SHIELD EA, an always-on executive agent for James Brady.
Goal: reduce entropy and increase coherence. On each pass, you:
- Ingest new lifelogs and infer goals/obligations.
- Propose concrete actions with confidence scores.
- Prefer high-leverage, low-regret moves; respect privacy and avoid sending without consent if confidence is low.

Output FORMAT (strict JSON only):
{
  "actions": [
    {
      "action_type": "task | email_draft | text_message | reminder | calendar_event | note",
      "title": "short title",
      "content": "precise draft / task body",
      "target": "todoist|motion|gmail|outlook|calendar|sms|github|other",
      "due_iso": "2025-11-20T18:00:00Z or null",
      "confidence": 0.0-1.0,
      "metadata": { "assignees": [], "project": "...", "time_block_minutes": 30 }
    }
  ]
}

Canonical priorities to consider (summary):
- Taxes (TC-40/TC-40W), Custody filing due 2025-12-15, Hyro homeschooling + Muay Thai.
- Cody’s research check-ins, High Desert automation deliverables.
- CEO-of-One brief draft (pending transcript), Motion MCP bring-up, GitHub timeline indexing.
- Portfolio pillars: Utlyze, Vuplicity, New Reward, High Desert, Motion backbone, Brainwave Lab.

If insufficient signal, return an empty actions array.
  `.trim();
}

function parseActions(raw: string): ParsedAction[] {
  if (!raw) return [];
  const match = raw.match(/```json\\s*([\\s\\S]+?)```/);
  const payload = match ? match[1] : raw;
  try {
    const obj = JSON.parse(payload);
    if (Array.isArray(obj)) {
      return obj as ParsedAction[];
    }
    if (Array.isArray((obj as any).actions)) {
      return (obj as any).actions as ParsedAction[];
    }
  } catch (e) {
    console.warn('[entropy] failed to parse JSON response', e, raw.slice(0, 200));
  }
  return [];
}

function decorateContent(a: ParsedAction): string {
  const base = a.content || '';
  const due = a.due_iso ? `\n\nDue: ${a.due_iso}` : '';
  return `${base}${due}`;
}

// ---------------------------------------------------------------------------
// Model calling with retry + fallback
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function callModelsWithBackoff(systemPrompt: string, userPrompt: string): Promise<string> {
  const promptMessages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];
  const prompt = { messages: promptMessages, temperature: 0.2, max_tokens: 900 };

  // try primary first (3 attempts, exponential backoff), then fallback (3 attempts)
  const primaryErr = await tryModelWithRetries(PRIMARY_MODEL, prompt, 3, 500);
  if (typeof primaryErr === 'string') return primaryErr; // got content

  const fallbackErr = await tryModelWithRetries(FALLBACK_MODEL, prompt, 3, 500, true);
  if (typeof fallbackErr === 'string') return fallbackErr;

  throw primaryErr || fallbackErr || new Error('Both primary and fallback models failed');
}

type ChatPrompt = { messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; temperature: number; max_tokens: number };

async function tryModelWithRetries(
  model: string,
  prompt: ChatPrompt,
  attempts: number,
  baseDelayMs: number,
  isFallback = false
): Promise<string | Error> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await callSingleModel(model, prompt);
      return resp;
    } catch (e: any) {
      lastErr = e;
      if (i === attempts - 1) break;
      const delay = baseDelayMs * Math.pow(2, i);
      console.warn(`[entropy] ${isFallback ? 'fallback' : 'primary'} ${model} attempt ${i + 1} failed; retry in ${delay}ms`, e?.message || e);
      await sleep(delay);
    }
  }
  return lastErr;
}

async function callSingleModel(model: string, prompt: ChatPrompt): Promise<string> {
  const isGrok = model.toLowerCase().includes('grok');
  const clientCall = isGrok ? DirectLLMClients.xaiChat : DirectLLMClients.openaiChat;
  const resp = await clientCall(
    {
      messages: prompt.messages,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
    },
    model
  );
  if (!resp?.content) throw new Error(`empty content from ${model}`);
  return resp.content;
}

// ---------------------------------------------------------------------------
// Secondary layer: context enricher
// ---------------------------------------------------------------------------

type ContextEnricherResult = {
  requests: {
    channel: 'sms' | 'email' | 'chat';
    message: string;
    priority: 'high' | 'medium' | 'low';
    confidence?: number;
  }[];
  memoryNotes: { topic: string; content: string }[];
};

async function runContextEnricher(
  logs: (Lifelog & { created_at?: number })[],
  priorActions: ReturnType<typeof buildStoredActions> = []
): Promise<ContextEnricherResult> {
  if (logs.length === 0) return { requests: [], memoryNotes: [] };

  const b = new PromptBuilder();
  b.addSystem(`
You are the Context Enricher (Layer 2) for WRATH-SHIELD.
- Objective: find missing context that blocks high-confidence actioning.
- If data is missing, generate concrete outreach prompts to James.
- Also write salient context notes for your private memory log (not user-facing).
Output strict JSON only.
{
  "context_requests": [
    {"channel": "sms|email|chat", "message": "...", "priority": "high|medium|low", "confidence": 0.0-1.0}
  ],
  "memory_notes": [
    {"topic": "short slug", "content": "concise note to retain for you"}
  ]
}
  `.trim());

  const logLines = logs.map((l) => {
    const ts = l.created_at ? new Date(l.created_at * 1000).toISOString() : l.date;
    const txt = extractText(l).slice(0, 500);
    return `- [${ts}] ${txt}`;
  });

  const prior = Array.isArray(priorActions)
    ? priorActions.map((a: any) => `${a.type}:${a.content.slice(0, 140)} (conf=${a.confidence ?? 'n/a'})`).join('\n')
    : '';

  b.addUser(
    [
      'Recent lifelogs:',
      ...logLines,
      '',
      prior ? 'Proposed actions with low confidence:' : 'No proposed actions yet.',
      prior || 'none',
      '',
      'Return JSON only.',
    ].join('\n')
  );

  const resp = await callModelsWithBackoff(
    b.build().messages[0].content,
    b.build().messages.slice(1).map((m) => m.content).join('\n')
  );
  const parsed = parseContextJson(resp);

  if (parsed.memoryNotes.length) {
    persistEnricherMemory(parsed.memoryNotes);
  }

  return parsed;
}

function parseContextJson(raw: string): ContextEnricherResult {
  const safeEmpty: ContextEnricherResult = { requests: [], memoryNotes: [] };
  if (!raw) return safeEmpty;
  const match = raw.match(/```json\\s*([\\s\\S]+?)```/);
  const body = match ? match[1] : raw;
  try {
    const obj = JSON.parse(body);
    const reqs = Array.isArray(obj?.context_requests) ? obj.context_requests : [];
    const notes = Array.isArray(obj?.memory_notes) ? obj.memory_notes : [];
    return {
      requests: reqs
        .filter((r: any) => r?.message)
        .map((r: any) => ({
          channel: (r.channel || 'chat') as 'sms' | 'email' | 'chat',
          message: r.message,
          priority: (r.priority || 'medium') as 'high' | 'medium' | 'low',
          confidence: typeof r.confidence === 'number' ? r.confidence : undefined,
        })),
      memoryNotes: notes
        .filter((n: any) => n?.content)
        .map((n: any) => ({ topic: n.topic || 'note', content: n.content })),
    };
  } catch (e) {
    console.warn('[context-enricher] parse failed', e, raw.slice(0, 200));
    return safeEmpty;
  }
}

async function persistContextRequests(
  requests: ContextEnricherResult['requests'],
  userId: string,
  dryRun?: boolean
): Promise<number> {
  if (!requests.length) return 0;
  const actions = requests.map((r) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    type: 'text_message' as const,
    target: r.channel,
    title: `Need context (${r.priority})`,
    content: r.message,
    confidence: r.confidence ?? null,
    status: 'proposed' as const,
    source: 'context-enricher',
    metadata: JSON.stringify({ channel: r.channel, priority: r.priority }),
  }));
  if (!dryRun) insertAgenticActions(actions);
  return actions.length;
}

function persistEnricherMemory(notes: { topic: string; content: string }[]) {
  if (!notes.length) return;
  try {
    const dir = path.dirname(SECONDARY_MEMORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = notes.map((n) =>
      JSON.stringify({ ...n, created_at: new Date().toISOString() })
    );
    fs.appendFileSync(SECONDARY_MEMORY_PATH, lines.join('\n') + '\n', 'utf8');
  } catch (e) {
    console.warn('[context-enricher] failed to persist memory', e);
  }
}

function buildStoredActions(actions: any[]): any[] {
  return Array.isArray(actions) ? actions : [];
}
