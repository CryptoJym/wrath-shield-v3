/**
 * Normalize Gmail/Outlook JSONL ingests into a unified events.db.
 */
import fs from 'fs';
import path from 'path';
import { upsertEvents } from '../lib/events';

type GmailRow = {
  id: string;
  subject?: string;
  from?: string;
  to?: string[] | string;
  date?: string;
  snippet?: string;
};

type OutlookRow = {
  id: string;
  subject?: string;
  from?: string;
  to?: string[] | string;
  received?: string;
  snippet?: string;
};

type CalendarRow = {
  id: string;
  summary?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  organizer?: string;
};

type IMessageRow = {
  id: string;
  handle?: string;
  text?: string;
  ts?: number;
};

type LifelogRow = {
  id: string;
  date?: string;
  title?: string;
  raw_json?: string;
};

function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function normTs(s?: string): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}

function inferDirection(from?: string, to?: string[] | string): 'in' | 'out' | null {
  if (!from && to) return 'out';
  return 'in';
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f));
}

function normalizeGmail() {
  const files = listFiles('.data/gmail');
  const events = files.flatMap((f) => {
    const slug = path.basename(f, '.jsonl');
    const rows = readJsonl<GmailRow>(f);
    return rows.map((r) => ({
      id: `gmail:${slug}:${r.id}`,
      source: 'gmail',
      channel: 'email',
      direction: inferDirection(r.from, r.to),
      contact: r.from || (Array.isArray(r.to) ? r.to?.[0] : (r.to as string)),
      ts: normTs((r as any).date),
      subject: r.subject || '',
      preview: r.snippet || '',
      metadata: { slug, rawId: r.id },
    }));
  });
  upsertEvents(events);
  console.log(`gmail normalized: ${events.length}`);
}

function normalizeOutlook() {
  const files = listFiles('.data/outlook');
  const events = files.flatMap((f) => {
    const slug = path.basename(f, '.jsonl');
    const rows = readJsonl<OutlookRow>(f);
    return rows.map((r) => ({
      id: `outlook:${slug}:${r.id}`,
      source: 'outlook',
      channel: 'email',
      direction: inferDirection(r.from, r.to),
      contact: r.from || (Array.isArray(r.to) ? r.to?.[0] : (r.to as string)),
      ts: normTs(r.received),
      subject: r.subject || '',
      preview: r.snippet || '',
      metadata: { slug, rawId: r.id },
    }));
  });
  upsertEvents(events);
  console.log(`outlook normalized: ${events.length}`);
}

function main() {
  normalizeGmail();
  normalizeOutlook();
  normalizeCalendars('.data/gcalendar', 'gcal');
  normalizeCalendars('.data/ocal', 'ocal');
  normalizeImessages();
  normalizeLifelogs();
  console.log('Done normalizing to .data/events.db');
}

main();

function normalizeCalendars(dir: string, source: string) {
  const files = listFiles(dir);
  const events = files.flatMap((f) => {
    const slug = path.basename(f, '.jsonl');
    const rows = readJsonl<CalendarRow>(f);
    return rows.map((r) => ({
      id: `${source}:${slug}:${r.id}`,
      source,
      channel: 'calendar',
      direction: null,
      contact: r.organizer || null,
      ts: normTs(r.start),
      subject: r.summary || '',
      preview: '',
      metadata: { slug, rawId: r.id, end: r.end, attendees: r.attendees },
    }));
  });
  upsertEvents(events);
  console.log(`${source} normalized: ${events.length}`);
}

function normalizeImessages() {
  const file = '.data/imessage.jsonl';
  if (!fs.existsSync(file)) {
    console.log('imessage: skipped (no file)');
    return;
  }
  const rows = readJsonl<IMessageRow>(file);
  const events = rows.map((r) => ({
    id: `imessage:${r.id}`,
    source: 'imessage',
    channel: 'imessage',
    direction: null,
    contact: r.handle || null,
    ts: r.ts || 0,
    subject: '',
    preview: r.text || '',
    metadata: { rawId: r.id },
  }));
  upsertEvents(events);
  console.log(`imessage normalized: ${events.length}`);
}

function normalizeLifelogs() {
  const file = '.data/lifelogs.jsonl';
  if (!fs.existsSync(file)) {
    console.log('lifelog: skipped (no file)');
    return;
  }
  const rows = readJsonl<LifelogRow>(file);
  const events = rows.map((r) => ({
    id: `lifelog:${r.id}`,
    source: 'limitless',
    channel: 'lifelog',
    direction: null,
    contact: null,
    ts: normTs(r.date),
    subject: r.title || '',
    preview: '',
    metadata: r.raw_json ? safeParse(r.raw_json) : null,
  }));
  upsertEvents(events);
  console.log(`lifelog normalized: ${events.length}`);
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
