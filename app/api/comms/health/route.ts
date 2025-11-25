import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { decryptData } from '@/lib/crypto';
import { getSetting } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SourceHealth = {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'not_configured';
  lastSync?: string | null;
  recordCount?: number;
  error?: string;
  fileAge?: number; // hours since last update
};

type IngestHealth = {
  ok: boolean;
  timestamp: string;
  sources: SourceHealth[];
  summary: {
    total: number;
    healthy: number;
    warnings: number;
    errors: number;
    not_configured: number;
  };
  events: {
    total: number;
    by_channel: Record<string, number>;
    needs_review: number;
  };
};

function getFileAge(filePath: string): number | null {
  try {
    const stats = fs.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return Math.round(ageMs / (1000 * 60 * 60)); // hours
  } catch {
    return null;
  }
}

function countJsonlLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function checkGmailHealth(dataDir: string): SourceHealth {
  const gmailDir = path.join(dataDir, 'gmail');
  if (!fs.existsSync(gmailDir)) {
    return { name: 'Gmail', status: 'not_configured' };
  }

  const files = fs.readdirSync(gmailDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) {
    return { name: 'Gmail', status: 'not_configured' };
  }

  let totalRecords = 0;
  let oldestAge = 0;

  for (const file of files) {
    const filePath = path.join(gmailDir, file);
    totalRecords += countJsonlLines(filePath);
    const age = getFileAge(filePath);
    if (age !== null && age > oldestAge) oldestAge = age;
  }

  const status = oldestAge > 48 ? 'warning' : 'ok';

  return {
    name: 'Gmail',
    status,
    recordCount: totalRecords,
    fileAge: oldestAge,
    lastSync: oldestAge > 0 ? `${oldestAge} hours ago` : 'recent',
  };
}

function checkOutlookHealth(dataDir: string): SourceHealth {
  const outlookDir = path.join(dataDir, 'outlook');
  if (!fs.existsSync(outlookDir)) {
    return { name: 'Outlook', status: 'not_configured' };
  }

  const files = fs.readdirSync(outlookDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) {
    return { name: 'Outlook', status: 'not_configured' };
  }

  let totalRecords = 0;
  let oldestAge = 0;

  for (const file of files) {
    const filePath = path.join(outlookDir, file);
    totalRecords += countJsonlLines(filePath);
    const age = getFileAge(filePath);
    if (age !== null && age > oldestAge) oldestAge = age;
  }

  const status = oldestAge > 48 ? 'warning' : 'ok';

  return {
    name: 'Outlook',
    status,
    recordCount: totalRecords,
    fileAge: oldestAge,
    lastSync: oldestAge > 0 ? `${oldestAge} hours ago` : 'recent',
  };
}

function checkIMessageHealth(dataDir: string): SourceHealth {
  const imessagePath = path.join(dataDir, 'imessage.jsonl');
  if (!fs.existsSync(imessagePath)) {
    return { name: 'iMessage', status: 'not_configured' };
  }

  const recordCount = countJsonlLines(imessagePath);
  const fileAge = getFileAge(imessagePath);
  const status = (fileAge !== null && fileAge > 48) ? 'warning' : 'ok';

  return {
    name: 'iMessage',
    status,
    recordCount,
    fileAge: fileAge ?? undefined,
    lastSync: fileAge ? `${fileAge} hours ago` : 'recent',
  };
}

function checkLifelogsHealth(dataDir: string): SourceHealth {
  const lifelogsPath = path.join(dataDir, 'lifelogs.jsonl');

  // Check last pull from settings
  let lastPull: string | null = null;
  try {
    const setting = getSetting('limitless_last_pull');
    if (setting?.value_enc) {
      lastPull = decryptData(setting.value_enc);
    }
  } catch {}

  if (!fs.existsSync(lifelogsPath)) {
    return {
      name: 'Lifelogs (Limitless)',
      status: lastPull ? 'warning' : 'not_configured',
      lastSync: lastPull,
      error: 'lifelogs.jsonl not found'
    };
  }

  const recordCount = countJsonlLines(lifelogsPath);
  const fileAge = getFileAge(lifelogsPath);

  // Calculate days since last API pull
  let daysSincePull: number | null = null;
  if (lastPull) {
    const pullDate = new Date(lastPull);
    daysSincePull = Math.floor((Date.now() - pullDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const status = (daysSincePull !== null && daysSincePull > 1) ? 'warning' :
                 (fileAge !== null && fileAge > 48) ? 'warning' : 'ok';

  return {
    name: 'Lifelogs (Limitless)',
    status,
    recordCount,
    fileAge: fileAge ?? undefined,
    lastSync: lastPull || (fileAge ? `file: ${fileAge}h ago` : 'unknown'),
  };
}

function checkCalendarHealth(dataDir: string, source: 'gcal' | 'ocal'): SourceHealth {
  const name = source === 'gcal' ? 'Google Calendar' : 'Outlook Calendar';
  const calDir = path.join(dataDir, source === 'gcal' ? 'gcalendar' : 'ocal');

  if (!fs.existsSync(calDir)) {
    return { name, status: 'not_configured' };
  }

  const files = fs.readdirSync(calDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) {
    return { name, status: 'not_configured' };
  }

  let totalRecords = 0;
  let oldestAge = 0;

  for (const file of files) {
    const filePath = path.join(calDir, file);
    totalRecords += countJsonlLines(filePath);
    const age = getFileAge(filePath);
    if (age !== null && age > oldestAge) oldestAge = age;
  }

  const status = oldestAge > 48 ? 'warning' : 'ok';

  return {
    name,
    status,
    recordCount: totalRecords,
    fileAge: oldestAge,
    lastSync: oldestAge > 0 ? `${oldestAge} hours ago` : 'recent',
  };
}

async function getEventsStats(dataDir: string): Promise<{
  total: number;
  by_channel: Record<string, number>;
  needs_review: number;
}> {
  const eventsDbPath = path.join(dataDir, 'events.db');
  if (!fs.existsSync(eventsDbPath)) {
    return { total: 0, by_channel: {}, needs_review: 0 };
  }

  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(eventsDbPath, { readonly: true });

    const total = (db.prepare('SELECT COUNT(*) as c FROM events').get() as any).c;

    const byChannel: Record<string, number> = {};
    const channelRows = db.prepare('SELECT channel, COUNT(*) as c FROM events GROUP BY channel').all() as any[];
    for (const row of channelRows) {
      byChannel[row.channel || 'unknown'] = row.c;
    }

    // Count events that might need review (low confidence or no classification)
    let needsReview = 0;
    try {
      needsReview = (db.prepare(
        "SELECT COUNT(*) as c FROM events WHERE confidence IS NOT NULL AND confidence < 0.7"
      ).get() as any).c;
    } catch {
      // confidence column may not exist yet
    }

    db.close();

    return { total, by_channel: byChannel, needs_review: needsReview };
  } catch (e) {
    return { total: 0, by_channel: {}, needs_review: 0 };
  }
}

export async function GET() {
  const dataDir = path.resolve(process.cwd(), '.data');

  const sources: SourceHealth[] = [
    checkGmailHealth(dataDir),
    checkOutlookHealth(dataDir),
    checkIMessageHealth(dataDir),
    checkLifelogsHealth(dataDir),
    checkCalendarHealth(dataDir, 'gcal'),
    checkCalendarHealth(dataDir, 'ocal'),
  ];

  const summary = {
    total: sources.length,
    healthy: sources.filter(s => s.status === 'ok').length,
    warnings: sources.filter(s => s.status === 'warning').length,
    errors: sources.filter(s => s.status === 'error').length,
    not_configured: sources.filter(s => s.status === 'not_configured').length,
  };

  const events = await getEventsStats(dataDir);

  const health: IngestHealth = {
    ok: summary.errors === 0 && summary.warnings === 0,
    timestamp: new Date().toISOString(),
    sources,
    summary,
    events,
  };

  return NextResponse.json(health);
}
