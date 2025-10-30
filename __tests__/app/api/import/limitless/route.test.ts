/**
 * Tests for /api/import/limitless endpoint
 */
import { POST } from '@/app/api/import/limitless/route';

// Mock server-only guard for transitive server libs
jest.mock('@/lib/server-only-guard', () => ({ ensureServerOnly: jest.fn() }));

// Mock Limitless client and queries
jest.mock('@/lib/LimitlessClient', () => ({
  getLimitlessClient: () => ({
    syncNewLifelogs: jest.fn().mockResolvedValue(3),
    fetchLifelogsForDb: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('@/lib/db/queries', () => ({
  insertLifelogs: jest.fn(),
}));

jest.mock('@/lib/digestLimitless', () => ({
  startDigestForDate: jest.fn().mockResolvedValue({
    jobId: 'job-1', total: 0, processed: 0, date: '2025-01-31', startedAt: '2025-01-31T00:00:00.000Z', errors: [], done: true,
  }),
}));

describe('/api/import/limitless', () => {
  it('triggers incremental sync and starts digest job', async () => {
    const res = await POST({ json: async () => ({}) } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.imported).toBe(3);
    expect(json.digest.jobId).toBe('job-1');
  });
});
