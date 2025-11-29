import { listByDateRange, updateTransaction } from '../lib/finance/store';

const start = '2024-01-01';
const end = '2030-01-01';
const user = 'default';

function parseDate(d: string) { return new Date(d + 'T00:00:00Z'); }

const txns = listByDateRange(start, end, user);
const apples = txns.filter(t => (t.account === 'apple') || /APPLE|ITUNES/i.test(t.vendor || '') || t.source === 'apple_csv');
const cards = txns.filter(t => t.account !== 'apple' && /APPLE|ITUNES|APP STORE/i.test(t.vendor || ''));

let matched = 0;
for (const a of apples) {
  const aDate = parseDate(a.date).getTime();
  const match = cards.find(c => Math.abs(parseDate(c.date).getTime() - aDate) <= 2*24*3600*1000 && Math.abs(c.amount - a.amount) < 0.01 && !((c.meta||{}).apple_link));
  if (match) {
    matched++;
    const metaA = { ...(a.meta||{}), apple_receipt: true, linked_card: match.id };
    const metaC = { ...(match.meta||{}), apple_link: a.id };
    updateTransaction(a.id, { status: 'classified', bucket: a.bucket || 'personal_ai', reimbursable: a.reimbursable ?? false, meta: metaA }, user);
    updateTransaction(match.id, { meta: metaC }, user);
  }
}
console.log('Matched', matched, 'apple receipts to card charges');
