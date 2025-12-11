import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source JSON exported from legal-advocate imessage scraper
const SRC = process.env.IMSG_JSON || path.resolve(process.cwd(), '../legal-advocate-ai/scraped_data/analysis/destiny_8016086861_full.json');
const API_BASE = process.env.LEGAL_API_BASE || 'http://localhost:4242';
const LIMIT = Number(process.env.LIMIT || 200);

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source file not found: ${SRC}`);
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8')) as any[];
  const items = data.slice(0, LIMIT).map((m) => ({
    timestamp: m.timestamp,
    from_me: m.is_from_me,
    text: m.extracted || m.text_column || '',
    raw: m.ascii,
  }));
  for (const chunk of chunked(items, 50)) {
    await postChunk(chunk);
  }
  console.log(`Posted ${Math.min(items.length, LIMIT)} iMessage entries to legal queue`);
}

async function postChunk(chunk: any[]) {
  const payload = chunk.map((m) => ({
    legal: true,
    contact: '+18016086861',
    topic: 'iMessage thread with Destiny',
    source: 'imessage',
    summary: `[${m.timestamp}] ${m.text || '(no text)'}`.slice(0, 240),
    confidence: 0.65,
    attachments: [],
  }));
  const res = await fetch(`${API_BASE}/api/legal/context-requests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload[0]), // send one-at-a-time to leverage dedup on summary
  });
  if (!res.ok) {
    throw new Error(`POST failed ${res.status}: ${await res.text()}`);
  }
}

function* chunked<T>(arr: T[], size: number) {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
