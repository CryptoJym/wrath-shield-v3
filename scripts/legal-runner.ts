#!/usr/bin/env tsx
/**
 * Legal orchestrator stub:
 * - Runs LegalPod on recent events
 * - Writes a legal anchor to memory
 * - Optionally pushes events to Zep collection "legal-timeline"
 */
import { listRecentEvents } from '../lib/events';
import { addAnchor } from '../lib/MemoryWrapper';
import { runLegalPod } from '../lib/pods';

const USER_ID = process.env.MEMORY_USER_ID || 'james';
const ZEP_URL = process.env.ZEP_API_URL;
const ZEP_KEY = process.env.ZEP_LEGAL_API_KEY || process.env.ZEP_API_KEY;
const ZEP_COLLECTION = process.env.ZEP_LEGAL_COLLECTION || 'legal-timeline';
const LOOKBACK_HOURS = 48;

async function pushToZep(events: any[]) {
  if (!ZEP_URL || !ZEP_KEY || !events.length) return;
  try {
    await fetch(`${ZEP_URL.replace(/\/$/, '')}/api/v1/collections/${ZEP_COLLECTION}/documents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ZEP_KEY}`,
      },
      body: JSON.stringify({
        documents: events.map((e) => ({
          content: `${e.channel} ${e.contact || ''} ${e.subject || ''} ${e.preview || ''}`,
          metadata: { id: e.id, ts: e.ts, channel: e.channel, contact: e.contact },
        })),
      }),
    });
  } catch (err) {
    console.warn('[legal-runner] zep push failed', err);
  }
}

function cutoffMs() {
  return Date.now() - LOOKBACK_HOURS * 3600 * 1000;
}

async function main() {
  const since = cutoffMs();
  const events = listRecentEvents(400).filter((e) => (e.ts || 0) * 1000 >= since);
  const podOut = await runLegalPod({ userId: USER_ID, events, memorySearch: async () => [] });

  const date = new Date().toISOString().slice(0, 10);
  const note = (podOut.notes || []).join('\n') || 'Legal pod run';
  await addAnchor(note, 'legal', date, USER_ID);

  await pushToZep(events);
  console.log(`[legal-runner] events=${events.length} notes=${podOut.notes?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
