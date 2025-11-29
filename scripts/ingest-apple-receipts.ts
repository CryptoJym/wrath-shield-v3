import fs from 'fs';
import path from 'path';
import { upsertTransactionsFromRows, TxnRow } from '../lib/finance/store';

// Quick-and-dirty Apple receipt CSV ingest.
// Usage: tsx scripts/ingest-apple-receipts.ts /path/to/apple_receipts.csv
// Expected columns: Date, Description, Amount
// You can export from Apple account > Media & Purchases > Purchase History (CSV).

const file = process.argv[2] || path.resolve(process.env.HOME || '.', 'Downloads', 'apple_receipts.csv');
if (!fs.existsSync(file)) {
  console.error('File not found', file);
  process.exit(1);
}

const text = fs.readFileSync(file, 'utf-8');
const lines = text.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) {
  console.error('No data rows');
  process.exit(1);
}

const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
const dateIdx = header.findIndex((h) => h.includes('date'));
const descIdx = header.findIndex((h) => h.includes('description'));
const amtIdx = header.findIndex((h) => h.includes('amount'));
if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) {
  console.error('CSV must have Date, Description, Amount columns');
  process.exit(1);
}

const rows: TxnRow[] = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  if (cols.length < 3) continue;
  const date = cols[dateIdx].trim();
  const desc = cols[descIdx].trim();
  const amtRaw = cols[amtIdx].trim();
  const amount = parseFloat(amtRaw.replace(/[$]/g, ''));
  if (isNaN(amount)) continue;
  const id = `apple-${date}-${desc.replace(/\W+/g, '').slice(0, 32)}-${i}`;
  rows.push({
    id,
    account: 'apple',
    amount,
    date,
    vendor: desc || 'Apple Purchase',
    raw_desc: desc,
    source: 'apple_csv',
    bucket: 'personal_ai',
    project: null,
    reimbursable: false,
  });
}

if (!rows.length) {
  console.error('No rows parsed');
  process.exit(1);
}

upsertTransactionsFromRows(rows, 'default');
console.log(`Imported ${rows.length} apple receipt rows from ${file}`);
