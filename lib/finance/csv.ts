import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { TxnRow } from './store';
import { classify } from './rules';

const ACCOUNT_DEFAULTS: Record<string, { bucket: string; project?: string; reimbursable?: boolean }> = {
  amex: { bucket: 'work_reimbursable', reimbursable: true, project: 'ai_rnd' },
  usbank: { bucket: 'work_nonreimbursable' },
  afcu: { bucket: 'family' },
  wellsfargo: { bucket: 'family' },
};

function detectAccount(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('amex')) return 'amex';
  if (lower.includes('usbank') || lower.includes('us_bank')) return 'usbank';
  if (lower.includes('afcu') || lower.includes('america_first')) return 'afcu';
  if (lower.includes('wells')) return 'wellsfargo';
  if (lower.includes('wellsfargo')) return 'wellsfargo';
  if (lower.includes('wells-fargo')) return 'wellsfargo';
  return 'unknown';
}

function normalizeDate(d: string): string {
  // Accept formats like 9/08/2025 or 09/09/2025 -> 2025-09-09
  const m = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
}

export async function parseCsvFiles(dir: string): Promise<TxnRow[]> {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  const all: TxnRow[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const content = fs.readFileSync(full, 'utf8');
    const account = detectAccount(f);
    const def = ACCOUNT_DEFAULTS[account] || {};
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    for (const r of records) {
      const raw = JSON.stringify(r);
      const dateRaw = r['Date'] || r['Transaction Date'] || r['Posted Date'] || r['Trans Date'] || '';
      const vendor = (
        r['Vendor'] ||
        r['Description'] ||
        r['Merchant'] ||
        r['Payee'] ||
        r['Transaction Description'] ||
        r['Name'] || // e.g., US Bank CSVs
        ''
      )
        .toString()
        .trim();
      const amtRaw = r['Amount'] || r['Transaction Amount'] || r['Debit'] || r['Credit'] || r['Amount ($)'] || r['Amt'] || '0';
      const amount = parseFloat(amtRaw.toString().replace(/,/g, '')) || 0;
      const date = normalizeDate((dateRaw || '').toString().trim());
      const row: TxnRow = {
        id: `${account}-${r['Transaction ID'] || r['ID'] || r['Trans ID'] || date + vendor + amount}`,
        account,
        amount,
        iso_currency_code: r['Currency'] || 'USD',
        date,
        vendor,
        raw_desc: raw,
        bucket: def.bucket,
        project: def.project,
        reimbursable: def.reimbursable || false,
        source: 'csv',
      };
      const classified = classify(row);
      all.push(classified);
    }
  }
  return all;
}
