/**
 * Limitless Digestion Pipeline
 *
 * Processes imported lifelogs into a Personal Phrase Bank and updates
 * lifelog manipulation counts. Uses SpeechMiner for detection and the
 * Assured Word Engine (AWE) for confident alternatives.
 */

import { analyzeText } from './speechMiner';
import { redactPII } from './redact';
import { getAssuredWordEngine, type PhraseMapping } from './assuredWordEngine';
import { getLifelogsForDate, insertLifelogs } from './db/queries';
import type { Lifelog, LifelogInput } from './db/types';

export type DigestJobStatus = {
  jobId: string;
  startedAt: string; // ISO
  date: string; // YYYY-MM-DD
  total: number;
  processed: number;
  errors: string[];
  done: boolean;
};

let currentJob: DigestJobStatus | null = null;

function newJobId() {
  try {
    // Prefer crypto if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomUUID } = require('crypto');
    return randomUUID();
  } catch {
    return `job_${Date.now()}`;
  }
}

function extractTranscript(lifelog: Lifelog): string {
  if (lifelog.raw_json) {
    try {
      const raw = JSON.parse(lifelog.raw_json);
      // If diarized segments exist, prefer user speaker segments
      if (Array.isArray(raw.segments)) {
        const userParts = raw.segments
          .filter((s: any) => (s.speaker || '').toLowerCase() === 'user')
          .map((s: any) => s.text)
          .filter(Boolean);
        if (userParts.length > 0) return userParts.join(' ');
      }
      if (typeof raw.transcript === 'string') return raw.transcript;
    } catch {
      // fallthrough to empty
    }
  }
  return '';
}

function buildMappingsFromFlags(text: string): PhraseMapping[] {
  const mappings: Map<string, PhraseMapping> = new Map();
  const analysis = analyzeText(text);
  const awe = getAssuredWordEngine();

  for (const flag of analysis.flags) {
    const phrase = flag.phrase.trim();
    if (!phrase) continue;
    if (mappings.has(phrase.toLowerCase())) continue;

    // Try AWE suggestion first
    const suggestion = awe.getSuggestion(phrase);
    if (suggestion) {
      mappings.set(phrase.toLowerCase(), {
        phrase,
        canonical: `${flag.category}_${phrase.toLowerCase().replace(/\s+/g, '_')}`,
        category: suggestion.category,
        context_tags: suggestion.context_tags,
        assured_alt: suggestion.assured_alt,
        options: suggestion.options,
        lift_score: suggestion.lift_score,
        enabled: true,
      });
      continue;
    }

    // Fallback generic mapping by category
    const defaults = {
      'hedges': ['I will', 'I can', 'I decide'],
      'apologies': ['Thank you for your time', 'I appreciate the clarity', 'Let’s proceed'],
      'permission-seek': ['I will', "I’ve decided", 'I’m proceeding'],
      'self-undervalue': ['I value my time', 'My standards apply', 'I hold my line'],
      'assured-markers': ['I will', 'I can', 'I’ve decided'],
      'personalization': ['That’s their story; I hold my line', 'I honor my path', 'I respect my boundaries'],
    } as Record<string, string[]>;
    const opts = defaults[flag.category] || ['I will', 'I can', 'Proceeding'];
    mappings.set(phrase.toLowerCase(), {
      phrase,
      canonical: `${flag.category}_${phrase.toLowerCase().replace(/\s+/g, '_')}`,
      category: (flag.category as any) || 'hedges',
      context_tags: ['digest'],
      assured_alt: opts[0],
      options: opts,
      lift_score: Math.min(1, 0.1 * flag.severity),
      enabled: true,
    });
  }

  return Array.from(mappings.values());
}

/**
 * Start a digestion job for a date. Non-blocking; updates currentJob.
 */
export async function startDigestForDate(date: string): Promise<DigestJobStatus> {
  const lifelogs = getLifelogsForDate(date);
  currentJob = {
    jobId: newJobId(),
    startedAt: new Date().toISOString(),
    date,
    total: lifelogs.length,
    processed: 0,
    errors: [],
    done: false,
  };

  // Process asynchronously but don’t detach in tests
  await processLifelogs(lifelogs, currentJob);
  return currentJob;
}

async function processLifelogs(lifelogs: Lifelog[], job: DigestJobStatus) {
  const awe = getAssuredWordEngine();
  const merged: PhraseMapping[] = [];

  for (const lifelog of lifelogs) {
    try {
      const transcript = extractTranscript(lifelog);
      if (!transcript) {
        job.processed++;
        continue;
      }

      // Redact PII then analyze
      const { redactedText } = redactPII(transcript);
      const analysis = analyzeText(redactedText);

      // Update lifelog manipulation_count; leave title/raw_json as-is
      const dbRecord: LifelogInput = {
        id: lifelog.id,
        date: lifelog.date,
        title: lifelog.title,
        manipulation_count: analysis.flagCount,
        wrath_deployed: analysis.hasHighSeverityFlags ? 1 : 0,
        raw_json: lifelog.raw_json,
      };
      insertLifelogs([dbRecord]);

      // Build mappings
      merged.push(...buildMappingsFromFlags(redactedText));
    } catch (e: any) {
      job.errors.push(e?.message || String(e));
    } finally {
      job.processed++;
    }
  }

  if (merged.length > 0) {
    // Merge distinct by canonical (latest wins)
    const byCanonical = new Map<string, PhraseMapping>();
    for (const m of merged) byCanonical.set(m.canonical, m);
    awe.mergePersonalPhraseBank(Array.from(byCanonical.values()));
  }

  job.done = true;
}

export function getCurrentDigestStatus(): DigestJobStatus | { status: 'idle' } {
  if (!currentJob) return { status: 'idle' } as const;
  return currentJob;
}

