#!/usr/bin/env tsx
/**
 * Evening shutdown: capture quick anchor for the day and mark counts.
 */
import { listRecentEvents, EventRow } from '../lib/events';
import { addAnchor } from '../lib/MemoryWrapper';

const USER_ID = process.env.MEMORY_USER_ID || 'james';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function summarize(events: EventRow[]) {
  const latest = events.slice(0, 10).map((e) => `${e.channel}:${e.contact || 'n/a'} — ${e.preview || e.subject || ''}`.trim());
  return latest.join('\n') || 'No signals logged.';
}

async function main() {
  const rows = listRecentEvents(200);
  const anchor = summarize(rows);
  await addAnchor(anchor, 'shutdown', today(), USER_ID);
  console.log(`Shutdown anchor stored for ${today()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
