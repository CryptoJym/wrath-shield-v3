import { parse } from 'csv-parse/sync';
import { parseCsvFiles } from '../../../lib/finance/csv';
import fs from 'fs';
import path from 'path';

// Minimal harness: write a temp CSV, parse, ensure date normalization and vendor capture.
describe('finance csv normalization', () => {
  const tmpDir = path.resolve('.data', 'finance', 'import-test');

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('normalizes dates and vendor', async () => {
    const csv = `Date,Description,Amount
9/08/2025,Test Vendor,10.50
`;
    const file = path.join(tmpDir, 'amex-test.csv');
    fs.writeFileSync(file, csv);
    const rows = await parseCsvFiles(tmpDir);
    expect(rows.length).toBe(1);
    expect(rows[0].date).toBe('2025-09-08');
    expect(rows[0].vendor).toBe('Test Vendor');
    expect(rows[0].amount).toBe(10.5);
  });
});
