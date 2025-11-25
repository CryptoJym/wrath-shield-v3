#!/usr/bin/env tsx
/**
 * Morning digest: summarise last 24h signals and store a daily summary memory.
 */
import { listRecentEvents, EventRow } from '../lib/events';
import { addDailySummary } from '../lib/MemoryWrapper';

const USER_ID = process.env.MEMORY_USER_ID || 'james';
const HOURS = 24;

function sinceMs(hours: number) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function summarize(events: EventRow[]) {
  const byChannel: Record<string, number> = {};
  const byContact: Record<string, number> = {};
  for (const e of events) {
    byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
    if (e.contact) byContact[e.contact] = (byContact[e.contact] || 0) + 1;
  }
  const topContacts = Object.entries(byContact)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c, n]) => `${c} (${n})`)
    .join(', ') || '—';

  const channelLine = Object.entries(byChannel)
    .map(([ch, n]) => `${ch}: ${n}`)
    .join(', ') || 'none';

  return { channelLine, topContacts };
}

async function main() {
  const cutoff = sinceMs(HOURS);
  const rows = listRecentEvents(500).filter((e) => (e.ts || 0) * 1000 >= cutoff);
  const { channelLine, topContacts } = summarize(rows);
  const date = new Date().toISOString().slice(0, 10);
  const summary = [
    `Daily digest for ${date}`,
    `Window: last ${HOURS}h`,
    `Signals: ${rows.length}`,
    `By channel: ${channelLine}`,
    `Top contacts: ${topContacts}`,
  ].join('\n');

  await addDailySummary(summary, USER_ID, { date, count: rows.length, window_hours: HOURS });
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
