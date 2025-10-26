/**
 * Wrath Shield v3 - Daily Summary Storage Tests
 *
 * Tests for storeDailySummary() and storeDailySummaries() functions
 * Verifies Mem0 storage, SQLite updates, and unbending score calculation
 */

import { storeDailySummary, storeDailySummaries } from '@/lib/ingest';
import type { DailySummary } from '@/lib/ingest';

// Mock dependencies
jest.mock('@/lib/MemoryWrapper', () => ({
  addDailySummary: jest.fn(),
}));

jest.mock('@/lib/db/queries', () => ({
  insertLifelogs: jest.fn(),
  calculateUnbendingScore: jest.fn(),
}));

// Import mocked modules
const { addDailySummary } = require('@/lib/MemoryWrapper');
const { insertLifelogs, calculateUnbendingScore } = require('@/lib/db/queries');

describe('storeDailySummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDailySummary: DailySummary = {
    date: '2025-01-31',
    summary: '2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. 3 manipulative phrases detected. Deployed assertive boundaries in response.',
    metrics: {
      recovery_score: 78,
      strain: 12.4,
      sleep_performance: 85,
      total_manipulations: 3,
      wrath_deployed: true,
    },
    analyzed_lifelogs: [
      {
        lifelog: {
          id: 'lifelog_1',
          date: '2025-01-31',
          title: 'Morning conversation',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: '{"segments":[]}',
        },
        analysis: {
          manipulation_count: 2,
          wrath_deployed: 1,
          flags: [],
        },
      },
      {
        lifelog: {
          id: 'lifelog_2',
          date: '2025-01-31',
          title: 'Afternoon meeting',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: '{"segments":[]}',
        },
        analysis: {
          manipulation_count: 1,
          wrath_deployed: 0,
          flags: [],
        },
      },
    ],
  };

  it('should store summary in Mem0 with correct metadata', async () => {
    await storeDailySummary(mockDailySummary);

    expect(addDailySummary).toHaveBeenCalledWith(mockDailySummary.summary, 'default', {
      date: '2025-01-31',
      recovery_score: 78,
      strain: 12.4,
      sleep_performance: 85,
      total_manipulations: 3,
      wrath_deployed: true,
    });
  });

  it('should use custom userId for Mem0 storage', async () => {
    await storeDailySummary(mockDailySummary, 'custom_user_123');

    expect(addDailySummary).toHaveBeenCalledWith(
      mockDailySummary.summary,
      'custom_user_123',
      expect.any(Object)
    );
  });

  it('should update lifelogs with analyzed manipulation data', async () => {
    await storeDailySummary(mockDailySummary);

    expect(insertLifelogs).toHaveBeenCalledWith([
      {
        id: 'lifelog_1',
        date: '2025-01-31',
        title: 'Morning conversation',
        manipulation_count: 2,
        wrath_deployed: 1,
        raw_json: '{"segments":[]}',
      },
      {
        id: 'lifelog_2',
        date: '2025-01-31',
        title: 'Afternoon meeting',
        manipulation_count: 1,
        wrath_deployed: 0,
        raw_json: '{"segments":[]}',
      },
    ]);
  });

  it('should calculate and store unbending score', async () => {
    await storeDailySummary(mockDailySummary);

    expect(calculateUnbendingScore).toHaveBeenCalledWith('2025-01-31');
  });

  it('should handle summary with no lifelogs', async () => {
    const summaryNoLifelogs: DailySummary = {
      ...mockDailySummary,
      analyzed_lifelogs: [],
    };

    await storeDailySummary(summaryNoLifelogs);

    expect(addDailySummary).toHaveBeenCalled();
    expect(insertLifelogs).not.toHaveBeenCalled(); // No lifelogs to insert
    expect(calculateUnbendingScore).toHaveBeenCalled(); // Still calculate score (will be null)
  });

  it('should handle summary with null WHOOP metrics', async () => {
    const summaryNullMetrics: DailySummary = {
      date: '2025-01-31',
      summary: '2025-01-31: No WHOOP data available. No manipulative interactions detected.',
      metrics: {
        recovery_score: null,
        strain: null,
        sleep_performance: null,
        total_manipulations: 0,
        wrath_deployed: false,
      },
      analyzed_lifelogs: [],
    };

    await storeDailySummary(summaryNullMetrics);

    expect(addDailySummary).toHaveBeenCalledWith(summaryNullMetrics.summary, 'default', {
      date: '2025-01-31',
      recovery_score: null,
      strain: null,
      sleep_performance: null,
      total_manipulations: 0,
      wrath_deployed: false,
    });
  });

  it('should preserve lifelog raw_json during update', async () => {
    const summaryWithJson: DailySummary = {
      ...mockDailySummary,
      analyzed_lifelogs: [
        {
          lifelog: {
            id: 'lifelog_1',
            date: '2025-01-31',
            title: 'Test',
            manipulation_count: 0,
            wrath_deployed: 0,
            raw_json: '{"metadata":{"duration_ms":12000},"segments":[{"text":"test"}]}',
          },
          analysis: {
            manipulation_count: 1,
            wrath_deployed: 0,
            flags: [],
          },
        },
      ],
    };

    await storeDailySummary(summaryWithJson);

    expect(insertLifelogs).toHaveBeenCalledWith([
      expect.objectContaining({
        raw_json: '{"metadata":{"duration_ms":12000},"segments":[{"text":"test"}]}',
      }),
    ]);
  });

  it('should call storage functions in correct order', async () => {
    const callOrder: string[] = [];

    addDailySummary.mockImplementation(() => {
      callOrder.push('mem0');
      return Promise.resolve();
    });

    insertLifelogs.mockImplementation(() => {
      callOrder.push('lifelogs');
    });

    calculateUnbendingScore.mockImplementation(() => {
      callOrder.push('score');
    });

    await storeDailySummary(mockDailySummary);

    expect(callOrder).toEqual(['mem0', 'lifelogs', 'score']);
  });
});

describe('storeDailySummaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSummaries: DailySummary[] = [
    {
      date: '2025-01-30',
      summary: '2025-01-30: Recovery 65%, Strain 14.2, Sleep 72%. No manipulative interactions detected.',
      metrics: {
        recovery_score: 65,
        strain: 14.2,
        sleep_performance: 72,
        total_manipulations: 0,
        wrath_deployed: false,
      },
      analyzed_lifelogs: [],
    },
    {
      date: '2025-01-31',
      summary: '2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. 3 manipulative phrases detected. Deployed assertive boundaries in response.',
      metrics: {
        recovery_score: 78,
        strain: 12.4,
        sleep_performance: 85,
        total_manipulations: 3,
        wrath_deployed: true,
      },
      analyzed_lifelogs: [
        {
          lifelog: {
            id: 'lifelog_1',
            date: '2025-01-31',
            title: 'Test',
            manipulation_count: 0,
            wrath_deployed: 0,
            raw_json: null,
          },
          analysis: {
            manipulation_count: 3,
            wrath_deployed: 1,
            flags: [],
          },
        },
      ],
    },
  ];

  it('should store multiple summaries sequentially', async () => {
    await storeDailySummaries(mockSummaries);

    expect(addDailySummary).toHaveBeenCalledTimes(2);
    expect(calculateUnbendingScore).toHaveBeenCalledTimes(2);
    expect(calculateUnbendingScore).toHaveBeenNthCalledWith(1, '2025-01-30');
    expect(calculateUnbendingScore).toHaveBeenNthCalledWith(2, '2025-01-31');
  });

  it('should use custom userId for all summaries', async () => {
    await storeDailySummaries(mockSummaries, 'batch_user_456');

    expect(addDailySummary).toHaveBeenNthCalledWith(
      1,
      mockSummaries[0].summary,
      'batch_user_456',
      expect.any(Object)
    );
    expect(addDailySummary).toHaveBeenNthCalledWith(
      2,
      mockSummaries[1].summary,
      'batch_user_456',
      expect.any(Object)
    );
  });

  it('should handle empty summaries array', async () => {
    await storeDailySummaries([]);

    expect(addDailySummary).not.toHaveBeenCalled();
    expect(insertLifelogs).not.toHaveBeenCalled();
    expect(calculateUnbendingScore).not.toHaveBeenCalled();
  });

  it('should process summaries in order', async () => {
    const callDates: string[] = [];

    calculateUnbendingScore.mockImplementation((date: string) => {
      callDates.push(date);
    });

    await storeDailySummaries(mockSummaries);

    expect(callDates).toEqual(['2025-01-30', '2025-01-31']);
  });
});

describe('Idempotency Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSummary: DailySummary = {
    date: '2025-01-31',
    summary: '2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. No manipulative interactions detected.',
    metrics: {
      recovery_score: 78,
      strain: 12.4,
      sleep_performance: 85,
      total_manipulations: 0,
      wrath_deployed: false,
    },
    analyzed_lifelogs: [
      {
        lifelog: {
          id: 'lifelog_same',
          date: '2025-01-31',
          title: 'Test',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: null,
        },
        analysis: {
          manipulation_count: 1,
          wrath_deployed: 0,
          flags: [],
        },
      },
    ],
  };

  it('should support re-running storage for same date', async () => {
    // First run
    await storeDailySummary(mockSummary);

    // Second run (idempotent re-run)
    await storeDailySummary(mockSummary);

    // Should be called twice but database upserts handle duplicates
    expect(addDailySummary).toHaveBeenCalledTimes(2);
    expect(insertLifelogs).toHaveBeenCalledTimes(2);
    expect(calculateUnbendingScore).toHaveBeenCalledTimes(2);
  });

  it('should use same lifelog IDs for upsert behavior', async () => {
    await storeDailySummary(mockSummary);
    await storeDailySummary(mockSummary);

    // Both calls should use same lifelog ID (database handles upsert)
    const firstCall = (insertLifelogs as jest.Mock).mock.calls[0][0];
    const secondCall = (insertLifelogs as jest.Mock).mock.calls[1][0];

    expect(firstCall[0].id).toBe('lifelog_same');
    expect(secondCall[0].id).toBe('lifelog_same');
  });
});

describe('Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle very large manipulation counts', async () => {
    const largeCountSummary: DailySummary = {
      date: '2025-01-31',
      summary: '2025-01-31: No WHOOP data available. 100 manipulative phrases detected. Deployed assertive boundaries in response.',
      metrics: {
        recovery_score: null,
        strain: null,
        sleep_performance: null,
        total_manipulations: 100,
        wrath_deployed: true,
      },
      analyzed_lifelogs: Array.from({ length: 10 }, (_, i) => ({
        lifelog: {
          id: `lifelog_${i}`,
          date: '2025-01-31',
          title: `Interaction ${i}`,
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: null,
        },
        analysis: {
          manipulation_count: 10,
          wrath_deployed: 1,
          flags: [],
        },
      })),
    };

    await storeDailySummary(largeCountSummary);

    expect(insertLifelogs).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ manipulation_count: 10 }),
    ]));
    expect(addDailySummary).toHaveBeenCalledWith(expect.any(String), 'default', expect.objectContaining({
      total_manipulations: 100,
    }));
  });

  it('should handle very long summary text', async () => {
    const longSummary: DailySummary = {
      date: '2025-01-31',
      summary: '2025-01-31: ' + 'A'.repeat(10000),
      metrics: {
        recovery_score: 50,
        strain: 10.0,
        sleep_performance: 60,
        total_manipulations: 0,
        wrath_deployed: false,
      },
      analyzed_lifelogs: [],
    };

    await storeDailySummary(longSummary);

    expect(addDailySummary).toHaveBeenCalledWith(longSummary.summary, 'default', expect.any(Object));
  });

  it('should handle zero manipulation count', async () => {
    const zeroManipulationsSummary: DailySummary = {
      date: '2025-01-31',
      summary: '2025-01-31: Recovery 90%, Strain 8.5, Sleep 95%. No manipulative interactions detected.',
      metrics: {
        recovery_score: 90,
        strain: 8.5,
        sleep_performance: 95,
        total_manipulations: 0,
        wrath_deployed: false,
      },
      analyzed_lifelogs: [
        {
          lifelog: {
            id: 'lifelog_1',
            date: '2025-01-31',
            title: 'Clean conversation',
            manipulation_count: 0,
            wrath_deployed: 0,
            raw_json: null,
          },
          analysis: {
            manipulation_count: 0,
            wrath_deployed: 0,
            flags: [],
          },
        },
      ],
    };

    await storeDailySummary(zeroManipulationsSummary);

    expect(addDailySummary).toHaveBeenCalledWith(expect.any(String), 'default', expect.objectContaining({
      total_manipulations: 0,
      wrath_deployed: false,
    }));
  });
});
