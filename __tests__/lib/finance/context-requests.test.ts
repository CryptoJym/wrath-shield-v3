import fs from 'fs';
import os from 'os';
import path from 'path';
import { createContextRequest, listContextRequests, listByDateRange, upsertTransactionsFromRows } from '../../../lib/finance/store';
import { applyCommsContext } from '../../../lib/finance/enrich';

describe('finance context requests + comms resolution', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finance-ctx-'));
    process.chdir(tmpDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates schema and resolves via comms payload updating transaction', () => {
    // seed txn
    upsertTransactionsFromRows([
      {
        id: 'txn-1',
        account: 'amex',
        amount: 21.48,
        date: '2025-11-20',
        vendor: 'Unknown Vendor',
        raw_desc: 'Unknown charge',
        source: 'test',
      },
    ]);

    // create context request
    const ctx = createContextRequest({
      txn_id: 'txn-1',
      vendor: 'Unknown Vendor',
      date: '2025-11-20',
      amount: 21.48,
    });
    expect(ctx.status).toBe('pending');

    // comms agent resolves with summary + bucket + reimbursable
    const updated = applyCommsContext(ctx.id, {
      id: ctx.id,
      summary: 'Receipt: OpenAI API, Nov 2025, $21.48, reimbursable',
      bucket: 'work_reimbursable',
      project: 'ai_rnd',
      reimbursable: true,
      confidence: 0.92,
      rationale: 'AI infrastructure',
    });

    expect(updated?.status).toBe('resolved');
    expect(updated?.summary).toContain('Receipt');

    // txn should be updated/confirmed
    const txns = listByDateRange('2025-01-01', '2025-12-31');
    const txn = txns.find((t) => t.id === 'txn-1');
    expect(txn).toBeTruthy();
    expect(txn?.bucket).toBe('work_reimbursable');
    expect(txn?.project).toBe('ai_rnd');
    expect(txn?.reimbursable).toBe(true);
    expect(txn?.status).toBe('confirmed');
  });

  it('adds new schema columns for context requests', () => {
    // ensure table has new columns
    const ctx = createContextRequest({
      txn_id: 'txn-2',
      vendor: 'Test Vendor',
      bucket: 'test_bucket',
      reimbursable: false,
      rationale: 'not reimbursable',
    });

    const pending = listContextRequests('all');
    const found = pending.find((p) => p.id === ctx.id);
    expect(found).toBeTruthy();
    expect(found?.bucket).toBe('test_bucket');
    // reimbursable stored as integer; presence means column exists/migrated
    expect(found?.reimbursable === false || found?.reimbursable === true || found?.reimbursable === 0).toBeTruthy();
  });
});
