/**
 * Summarize relationships using Relationship Grok (Grok 4.1 fast via OpenRouter client).
 *
 * Usage:
 *   npx tsx scripts/summarize-relationships.ts
 */
import { topContacts, upsertRelationshipSummary } from '../lib/relationshipDb';
import { PromptBuilder } from '../lib/PromptBuilder';
import { DirectLLMClients } from '../lib/DirectLLMClients';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseDelayMs * Math.pow(2, i);
      console.warn(`${label} attempt ${i + 1} failed; retrying in ${delay}ms`, err?.message || err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function main() {
  const limitEnv = parseInt(process.env.REL_CONTACT_LIMIT || '0', 10);
  const contacts = topContacts(limitEnv > 0 ? limitEnv : 1_000_000);
  if (!contacts.length) {
    console.log('No contacts found. Run ingest first.');
    process.exit(0);
  }

  const primaryModel = 'gpt-5.1'; // direct OpenAI
  const fallbackModel = 'grok-4-1-fast'; // direct xAI (best agentic Grok)
  const systemPrompt = `
You are Relationship Grok. For each contact, output strict JSON only. No prose.
Schema:
{
  "contacts": [
    { "id": "contact_id", "summary": "1-2 sentence summary", "follow_up": "one concrete next step" }
  ]
}
Rules:
- Output valid JSON object only (no trailing commas, no comments, no Markdown).
- If insufficient data, omit that contact.
- Keep summary <=160 chars and follow_up <=120 chars.
- Do NOT use ellipses (...) or unfinished sentences; close every quote.
- Single JSON object; no extra text before or after.
  `.trim();

  const batchSize = 1;
  let wrote = 0;
  let lastModelUsed = 'none';
  const ids = new Set(contacts.map((c) => c.id));

  for (let i = 0; i < contacts.length; i += batchSize) {
    const chunk = contacts.slice(i, i + batchSize);
    const rows = chunk
      .map(
        (c) =>
          `id=${c.id}; name=${c.display_name || c.handle}; handle=${c.handle}; last_ts=${c.last_ts}; sent=${c.sent_count}; recv=${c.recv_count}; last_text=${(c.last_text || '').slice(0, 160)}`
      )
      .join('\n');

    const builder = new PromptBuilder();
    builder.addSystem(systemPrompt);
    builder.addUser(rows);
    builder.setMaxTokens(500).setTemperature(0.1);

    const prompt = builder.build();
    let rawContent = '';
    // Primary: direct OpenAI
    if (process.env.OPENAI_API_KEY_DIRECT) {
      try {
        const directResp = await withRetry(
          () => DirectLLMClients.openaiChat(prompt, primaryModel),
          'OpenAI direct',
          3,
          500
        );
        rawContent = directResp.content || '';
        lastModelUsed = directResp.model || primaryModel;
      } catch (e) {
        console.error('Direct OpenAI failed:', e);
      }
    }
    // Fallback: direct xAI
    if (!rawContent && process.env.XAI_API_KEY_DIRECT) {
      try {
        const xaiResp = await withRetry(
          () => DirectLLMClients.xaiChat(prompt, fallbackModel),
          'xAI direct',
          3,
          500
        );
        rawContent = xaiResp.content || '';
        lastModelUsed = xaiResp.model || fallbackModel;
      } catch (e) {
        console.error('Direct xAI failed:', e);
      }
    }
    if (!rawContent) {
      console.error('No content from both primary and fallback; skipping chunk.');
      continue;
    }
    let parsed = parseJson(rawContent);
    for (const c of parsed) {
      if (!ids.has(c.id)) continue;
      upsertRelationshipSummary({
        contact_id: c.id,
        summary: c.summary,
        suggested_follow_up: c.follow_up,
        last_updated: Math.floor(Date.now() / 1000),
      });
      wrote++;
    }
  }

  console.log(`Wrote ${wrote} summaries (last model used: ${lastModelUsed}).`);
}

function parseJson(raw: string): { id: string; summary: string; follow_up: string }[] {
  const match = raw.match(/```json\\s*([\\s\\S]+?)```/);
  let body = match ? match[1] : raw;
  // normalize smart quotes and stray newlines that break JSON
  body = body.replace(/[“”]/g, '"').replace(/\r?\n/g, ' ');
  // heuristic: ensure we close any trailing objects
  if (!body.trim().endsWith('}')) {
    body = body.trim().replace(/,\s*$/, '');
  }
  try {
    const obj = JSON.parse(body);
    if (Array.isArray(obj?.contacts)) return obj.contacts;
  } catch (e) {
    // Attempt to salvage contacts array substring
    const arrMatch = body.match(/\"contacts\"\\s*:\\s*\\[(.*)\\]/s);
    if (arrMatch) {
      try {
        const arrJson = `[${arrMatch[1]}]`;
        const arr = JSON.parse(arrJson);
        if (Array.isArray(arr)) return arr;
      } catch {}
    }
    // Bare list salvage
    const listMatch = body.match(/\\[(.*)\\]/s);
    if (listMatch) {
      try {
        const arr = JSON.parse(`[${listMatch[1]}]`);
        if (Array.isArray(arr)) return arr;
      } catch {}
    }
    // Last resort: split by newlines and braces, sanitize dangling quotes
    const sanitized = body
      .replace(/[\r\n]/g, ' ')
      .replace(/,“/g, ',"')
      .replace(/”/g, '"')
      .replace(/“/g, '"');
    const parts = sanitized.split('},{').map((p) => p.replace(/^[\\s,\\[]+|[\\s,\\]]+$/g, ''));
    const merged = `[${parts.join('},{')}]`;
    try {
      const arr = JSON.parse(merged);
      if (Array.isArray(arr)) return arr;
    } catch {}
    // Regex salvage: extract id + summary (+ optional follow_up) and synthesize array
    const contactRegex = /"id"\\s*:\\s*"([^"]+)"[\\s\\S]*?"summary"\\s*:\\s*"([^"]+?)"(?:[\\s\\S]*?"follow_up"\\s*:\\s*"([^"]*?)")?/g;
    const recovered: { id: string; summary: string; follow_up: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = contactRegex.exec(body)) !== null) {
      recovered.push({
        id: m[1],
        summary: m[2],
        follow_up: m[3] ?? 'Review later',
      });
    }
    if (recovered.length) return recovered;
    console.error('Parse failed', e, raw.slice(0, 200));
  }
  return [];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
