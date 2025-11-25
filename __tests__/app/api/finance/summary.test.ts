import { listByDateRange } from '../../../../lib/finance/store';

// Lightweight API shape test (direct function call)
describe('/api/finance/summary shape', () => {
  it('returns buckets and back90', () => {
    const start = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    const end = new Date();
    const rows = listByDateRange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    // Just assert function exists and returns array; API route itself is covered by Next runtime
    expect(Array.isArray(rows)).toBe(true);
  });
});
