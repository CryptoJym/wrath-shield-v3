/**
 * Re-classify transactions using vendor rules
 *
 * Usage: npx tsx scripts/reclassify-transactions.ts [--dry-run] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
 */

import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), '.data', 'finance', 'finance.db');
const rulesPath = path.resolve(process.cwd(), '.data', 'vendor-rules.json');

interface VendorRule {
  vendor: string;
  bucket?: string;
  reimbursable?: boolean;
  project?: string;
  rationale?: string;
}

interface Transaction {
  id: string;
  vendor: string | null;
  raw_desc: string | null;
  date: string;
  amount: number;
  bucket: string | null;
  project: string | null;
  reimbursable: number | null;
  status: string | null;
}

function loadRules(): VendorRule[] {
  if (!fs.existsSync(rulesPath)) {
    console.error('No vendor rules file found at', rulesPath);
    return [];
  }
  return JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
}

function matchVendor(vendor: string | null, rawDesc: string | null, rules: VendorRule[]): VendorRule | null {
  if (!vendor && !rawDesc) return null;

  const searchStr = ((vendor || '') + ' ' + (rawDesc || '')).toLowerCase();

  for (const rule of rules) {
    if (searchStr.includes(rule.vendor.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  let startDate = '2020-01-01';
  let endDate = '2099-12-31';

  const startIdx = args.indexOf('--start');
  if (startIdx !== -1 && args[startIdx + 1]) {
    startDate = args[startIdx + 1];
  }

  const endIdx = args.indexOf('--end');
  if (endIdx !== -1 && args[endIdx + 1]) {
    endDate = args[endIdx + 1];
  }

  console.log(`Re-classifying transactions from ${startDate} to ${endDate}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  const rules = loadRules();
  console.log(`Loaded ${rules.length} vendor rules`);

  const db = new BetterSqlite3(dbPath);

  const transactions = db.prepare(`
    SELECT id, vendor, raw_desc, date, amount, bucket, project, reimbursable, status
    FROM finance_transactions
    WHERE date >= ? AND date < ?
    ORDER BY date DESC
  `).all(startDate, endDate) as Transaction[];

  console.log(`Found ${transactions.length} transactions in date range`);
  console.log('');

  let updated = 0;
  let unchanged = 0;
  let noMatch = 0;

  const updateStmt = db.prepare(`
    UPDATE finance_transactions
    SET bucket = ?, project = ?, reimbursable = ?, status = 'classified'
    WHERE id = ?
  `);

  const auditStmt = db.prepare(`
    INSERT INTO finance_audit (txn_id, user_id, source, prev_bucket, new_bucket, prev_project, new_project, prev_reimbursable, new_reimbursable, note)
    VALUES (?, 'system', 'reclassify-script', ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateTransaction = db.transaction((txn: Transaction, rule: VendorRule) => {
    const newBucket = rule.bucket || txn.bucket;
    const newProject = rule.project || txn.project;
    const newReimb = rule.reimbursable !== undefined ? (rule.reimbursable ? 1 : 0) : txn.reimbursable;

    if (newBucket === txn.bucket && newProject === txn.project && newReimb === txn.reimbursable) {
      return false;
    }

    if (!dryRun) {
      updateStmt.run(newBucket, newProject, newReimb, txn.id);
      auditStmt.run(
        txn.id,
        txn.bucket,
        newBucket,
        txn.project,
        newProject,
        txn.reimbursable,
        newReimb,
        `Reclassified by vendor rule: ${rule.vendor}`
      );
    }

    return true;
  });

  const changes: { vendor: string; count: number; total: number }[] = [];
  const changesByRule = new Map<string, { count: number; total: number }>();

  for (const txn of transactions) {
    const rule = matchVendor(txn.vendor, txn.raw_desc, rules);

    if (!rule) {
      noMatch++;
      continue;
    }

    const wasUpdated = updateTransaction(txn, rule);

    if (wasUpdated) {
      updated++;
      const key = rule.vendor;
      const existing = changesByRule.get(key) || { count: 0, total: 0 };
      existing.count++;
      existing.total += Math.abs(txn.amount);
      changesByRule.set(key, existing);

      if (dryRun) {
        console.log(`Would update: ${txn.date} | ${txn.vendor?.substring(0, 40) || '(unknown)'} | $${txn.amount.toFixed(2)} | ${txn.bucket || 'null'} -> ${rule.bucket} | reimb: ${txn.reimbursable} -> ${rule.reimbursable ? 1 : 0}`);
      }
    } else {
      unchanged++;
    }
  }

  db.close();

  console.log('');
  console.log('=== Summary ===');
  console.log(`Total transactions: ${transactions.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unchanged (already correct): ${unchanged}`);
  console.log(`No matching rule: ${noMatch}`);
  console.log('');

  if (changesByRule.size > 0) {
    console.log('=== Changes by Vendor Rule ===');
    for (const [vendor, { count, total }] of changesByRule) {
      console.log(`  ${vendor}: ${count} transactions, $${total.toFixed(2)}`);
    }
  }

  if (dryRun) {
    console.log('');
    console.log('This was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
