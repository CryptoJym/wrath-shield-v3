import Database from 'better-sqlite3';
import path from 'path';
import { parse } from 'date-fns';

const db = new Database(path.resolve('.data','finance','finance.db'));
const rows = db.prepare("SELECT id, vendor, raw_desc, date, meta, user_id, amount, iso_currency_code FROM finance_transactions").all();
const upd = db.prepare(`UPDATE finance_transactions SET vendor=@vendor, raw_desc=@raw_desc, date=@date, user_id=@user_id, amount=@amount, iso_currency_code=@iso_currency_code WHERE id=@id`);
let patched = 0;

function normDate(d: string | null): string | null {
  if (!d) return null;
  const s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = parse(s, 'M/d/yyyy', new Date());
  if (!isNaN(parsed.getTime())) return fmt(parsed);
  const parsed2 = parse(s, 'M/d/yy', new Date());
  if (!isNaN(parsed2.getTime())) return fmt(parsed2);
  return s;
}
function fmt(d: Date) {
  const m = d.getMonth()+1, day = d.getDate(), y = d.getFullYear();
  return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function toNumber(x: any): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return isNaN(n) ? null : n;
}

const tx = db.transaction(() => {
  for (const r of rows) {
    let meta: any = {};
    if (r.meta) {
      try { meta = JSON.parse(r.meta); } catch {}
    }
    let rawJson: any = {};
    if (r.raw_desc) {
      const trimmed = String(r.raw_desc).trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try { rawJson = JSON.parse(trimmed); } catch {}
      }
    }
    const merged = { ...rawJson, ...meta };
    const vendor = (merged.Vendor || merged.Description || merged.Merchant || r.vendor || '').trim() || 'Unknown';
    const raw_desc = (merged.Description || merged.Vendor || merged.Merchant || r.raw_desc || '').trim() || vendor;
    const date = normDate(r.date || merged.Date || null) || r.date;
    const user_id = r.user_id || 'default';
    const amount = toNumber(r.amount) ?? toNumber(merged.Amount) ?? 0;
    const iso_currency_code = r.iso_currency_code || merged.IsoCurrencyCode || merged.Currency || null;
    upd.run({ id: r.id, vendor, raw_desc, date, user_id, amount, iso_currency_code });
    patched++;
  }
});

tx();
console.log(`Patched ${patched} finance rows`);
db.close();
