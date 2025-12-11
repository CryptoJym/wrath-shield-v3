import fs from 'fs';
import path from 'path';
import { createLegalContextRequestIfMissing } from '../lib/legal/store';

const SRC = process.env.IMSG_JSON || path.resolve(process.cwd(), '../legal-advocate-ai/scraped_data/analysis/destiny_8016086861_full.json');
const LIMIT = Number(process.env.LIMIT || 2000);
const CONTACT = process.env.CONTACT || '+18016086861';

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source not found: ${SRC}`);
  const data: any[] = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const slice = data.slice(0, LIMIT);
  let created = 0;
  let skipped = 0;
  for (const item of slice) {
    const summary = `[${item.timestamp}] ${(item.extracted || item.text_column || '').trim() || '(no text)'}`.slice(0, 240);
    const { created: didCreate } = createLegalContextRequestIfMissing({
      user_id: 'default',
      contact: CONTACT,
      topic: 'iMessage thread with Destiny',
      source: 'imessage',
      summary,
      confidence: 0.6,
    });
    if (didCreate) created++; else skipped++;
  }
  console.log(`Imported ${slice.length} rows → created ${created}, skipped ${skipped}`);
}

main();
