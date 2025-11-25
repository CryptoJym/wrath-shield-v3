import { classify } from '../../../lib/finance/rules';
import { TxnRow } from '../../../lib/finance/store';

describe('finance classify', () => {
  it('tags AI vendors as work_reimbursable', () => {
    const row: TxnRow = {
      id: '1',
      account: 'amex',
      amount: 10,
      date: '2025-11-22',
      vendor: 'OpenAI',
      raw_desc: '',
      bucket: undefined,
      project: undefined,
      reimbursable: false,
      source: 'test',
    };
    const out = classify(row);
    expect(out.bucket).toBe('work_reimbursable');
    expect(out.project).toBe('ai_rnd');
    expect(out.reimbursable).toBe(true);
  });
});
