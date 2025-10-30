import { startDigestForDate, getCurrentDigestStatus } from '@/lib/digestLimitless';
import { getAssuredWordEngine } from '@/lib/assuredWordEngine';

// Mock server-only guard globally for server libs used by AWE
jest.mock('@/lib/server-only-guard', () => ({ ensureServerOnly: jest.fn() }));

// Minimal DB query mocks for lifelogs
jest.mock('@/lib/db/queries', () => {
  const real = jest.requireActual('@/lib/db/queries');
  return {
    ...real,
    getLifelogsForDate: jest.fn().mockReturnValue([
      {
        id: 'lifelog-1',
        date: '2025-01-31',
        title: 'Sample',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: JSON.stringify({ transcript: 'I guess maybe we should wait. If it\'s okay, I\'ll do it later.' }),
      },
    ]),
    insertLifelogs: jest.fn(),
  };
});

describe('digestLimitless', () => {
  it('processes lifelogs, updates counts, and merges phrase mappings', async () => {
    const awe = getAssuredWordEngine();
    awe.clearPersonalPhraseBank();

    const job = await startDigestForDate('2025-01-31');

    expect(job.total).toBe(1);
    expect(job.processed).toBe(1);
    expect(job.done).toBe(true);
    expect(Array.isArray(job.errors)).toBe(true);

    const mappings = awe.getAllMappings();
    // Expect at least hedges/permission-seek mappings added
    const hedges = mappings.filter((m) => m.category === 'hedges');
    expect(hedges.length).toBeGreaterThan(0);

    const status = getCurrentDigestStatus();
    // @ts-expect-error type narrowing for test-only shape
    expect(status.done).toBe(true);
  });
});

