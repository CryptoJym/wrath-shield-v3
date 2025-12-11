import fs from 'fs';
import path from 'path';

const BASE = process.env.LEGAL_API_BASE || 'http://localhost:4242';
const SRC = process.env.IMSG_JSON || path.resolve(process.cwd(), '../legal-advocate-ai/scraped_data/analysis/destiny_8016086861_full.json');
const LIMIT = Number(process.env.LIMIT || 2000);
const BATCH = Number(process.env.BATCH || 1); // API is one-at-a-time; keep 1 to reuse dedup logic

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source file not found: ${SRC}`);
  const data: any[] = JSON.parse(fs.readFileSync(SRC, 'utf8')).slice(0, LIMIT);
  let sent = 0;
  for (const item of data) {
    const summary = `[${item.timestamp}] ${(item.extracted || item.text_column || '').trim() || '(no text)'}`.slice(0, 240);
    try {
      await postOne({
        legal: true,
        contact: '+18016086861',
        topic: 'iMessage thread with Destiny',
        source: 'imessage',
        summary,
        confidence: 0.65,
      });
      sent++;
      if (sent % 100 === 0) console.log('sent', sent);
    } catch (e: any) {
      console.error('post failed at', sent, e?.message || e);
    }
  }
  console.log('done, sent', sent);
}

async function postOne(payload: any) {
  const res = await fetch(`${BASE}/api/legal/context-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
