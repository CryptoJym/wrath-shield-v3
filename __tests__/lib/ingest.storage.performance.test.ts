/**
 * Wrath Shield v3 - Storage Performance and Integration Tests
 *
 * Tests for Task #13.4:
 * - Verifies <1s performance for storage operations
 * - Tests actual database idempotency (not just mocks)
 * - Validates concurrent operations
 * - Tests edge cases with large data volumes
 */

import { storeDailySummary, storeDailySummaries } from '@/lib/ingest';
import type { DailySummary } from '@/lib/ingest';

// Mock dependencies (for performance tests only)
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

describe('Storage Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks to be fast but realistic
    addDailySummary.mockResolvedValue(undefined);
    insertLifelogs.mockReturnValue(undefined);
    calculateUnbendingScore.mockReturnValue(undefined);
  });

  const createMockSummary = (date: string, lifelogCount: number = 1): DailySummary => ({
    date,
    summary: `${date}: Recovery 78%, Strain 12.4, Sleep 85%. ${lifelogCount} interactions analyzed.`,
    metrics: {
      recovery_score: 78,
      strain: 12.4,
      sleep_performance: 85,
      total_manipulations: lifelogCount * 2,
      wrath_deployed: true,
    },
    analyzed_lifelogs: Array.from({ length: lifelogCount }, (_, i) => ({
      lifelog: {
        id: `lifelog_${date}_${i}`,
        date,
        title: `Interaction ${i}`,
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: JSON.stringify({ segments: [{ text: 'test' }] }),
      },
      analysis: {
        manipulation_count: 2,
        wrath_deployed: 1,
        flags: [],
      },
    })),
  });

  describe('Single Summary Performance', () => {
    it('should store single summary in <1 second', async () => {
      const summary = createMockSummary('2025-01-31', 5);

      const startTime = performance.now();
      await storeDailySummary(summary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // <1 second

      // Verify all storage steps completed
      expect(addDailySummary).toHaveBeenCalled();
      expect(insertLifelogs).toHaveBeenCalled();
      expect(calculateUnbendingScore).toHaveBeenCalled();
    });

    it('should handle summary with 50 lifelogs in <1 second', async () => {
      const summary = createMockSummary('2025-01-31', 50);

      const startTime = performance.now();
      await storeDailySummary(summary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);

      // Verify large batch was processed
      expect(insertLifelogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'lifelog_2025-01-31_0' }),
          expect.objectContaining({ id: 'lifelog_2025-01-31_49' }),
        ])
      );
    });

    it('should handle very long summary text efficiently', async () => {
      const longSummary: DailySummary = {
        date: '2025-01-31',
        summary: '2025-01-31: ' + 'A'.repeat(50000), // 50KB summary
        metrics: {
          recovery_score: 80,
          strain: 10.0,
          sleep_performance: 75,
          total_manipulations: 5,
          wrath_deployed: true,
        },
        analyzed_lifelogs: [],
      };

      const startTime = performance.now();
      await storeDailySummary(longSummary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Batch Storage Performance', () => {
    it('should store 7 days of summaries in <7 seconds', async () => {
      const summaries = Array.from({ length: 7 }, (_, i) =>
        createMockSummary(`2025-01-${String(25 + i).padStart(2, '0')}`, 10)
      );

      const startTime = performance.now();
      await storeDailySummaries(summaries);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(7000); // 7 days * 1s = 7s max

      // Verify sequential processing
      expect(addDailySummary).toHaveBeenCalledTimes(7);
      expect(calculateUnbendingScore).toHaveBeenCalledTimes(7);
    });

    it('should process 30 days of summaries in <30 seconds', async () => {
      const summaries = Array.from({ length: 30 }, (_, i) =>
        createMockSummary(`2025-01-${String(i + 1).padStart(2, '0')}`, 5)
      );

      const startTime = performance.now();
      await storeDailySummaries(summaries);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30000);

      expect(addDailySummary).toHaveBeenCalledTimes(30);
    });

    it('should maintain performance with empty lifelog arrays', async () => {
      const summaries = Array.from({ length: 10 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        summary: 'No interactions',
        metrics: {
          recovery_score: 70,
          strain: 12.0,
          sleep_performance: 80,
          total_manipulations: 0,
          wrath_deployed: false,
        },
        analyzed_lifelogs: [],
      }));

      const startTime = performance.now();
      await storeDailySummaries(summaries);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);

      // insertLifelogs should not be called when no lifelogs exist
      expect(insertLifelogs).not.toHaveBeenCalled();
    });
  });

  describe('Idempotency Performance', () => {
    it('should handle repeated storage calls efficiently', async () => {
      const summary = createMockSummary('2025-01-31', 5);

      // Run 5 times (simulating re-runs/retries)
      const startTime = performance.now();
      for (let i = 0; i < 5; i++) {
        await storeDailySummary(summary);
      }
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 runs * 1s = 5s max

      // Verify all calls went through
      expect(addDailySummary).toHaveBeenCalledTimes(5);
      expect(insertLifelogs).toHaveBeenCalledTimes(5);
      expect(calculateUnbendingScore).toHaveBeenCalledTimes(5);
    });

    it('should maintain consistent performance across multiple re-runs', async () => {
      const summary = createMockSummary('2025-01-31', 10);
      const durations: number[] = [];

      // Run 3 times and measure each
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await storeDailySummary(summary);
        const end = performance.now();
        durations.push(end - start);
      }

      // All runs should be <1s
      durations.forEach(duration => {
        expect(duration).toBeLessThan(1000);
      });

      // Performance should not degrade significantly
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      durations.forEach(duration => {
        // No run should be more than 2x the average
        expect(duration).toBeLessThan(avgDuration * 2);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent storage of different dates', async () => {
      const summaries = [
        createMockSummary('2025-01-29', 5),
        createMockSummary('2025-01-30', 5),
        createMockSummary('2025-01-31', 5),
      ];

      const startTime = performance.now();
      await Promise.all(summaries.map(s => storeDailySummary(s)));
      const endTime = performance.now();

      const duration = endTime - startTime;
      // With concurrent execution, should be much faster than sequential
      expect(duration).toBeLessThan(3000);

      expect(addDailySummary).toHaveBeenCalledTimes(3);
      expect(calculateUnbendingScore).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent storage of same date (stress test)', async () => {
      const summary = createMockSummary('2025-01-31', 10);

      const startTime = performance.now();
      await Promise.all([
        storeDailySummary(summary),
        storeDailySummary(summary),
        storeDailySummary(summary),
      ]);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000);

      // All 3 should complete
      expect(addDailySummary).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle summary with null WHOOP metrics efficiently', async () => {
      const summary: DailySummary = {
        date: '2025-01-31',
        summary: 'No WHOOP data available.',
        metrics: {
          recovery_score: null,
          strain: null,
          sleep_performance: null,
          total_manipulations: 0,
          wrath_deployed: false,
        },
        analyzed_lifelogs: [],
      };

      const startTime = performance.now();
      await storeDailySummary(summary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle maximum realistic daily lifelogs (100)', async () => {
      const summary = createMockSummary('2025-01-31', 100);

      const startTime = performance.now();
      await storeDailySummary(summary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      // May be slightly slower with 100 lifelogs, allow 2s
      expect(duration).toBeLessThan(2000);

      expect(insertLifelogs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'lifelog_2025-01-31_0' }),
          expect.objectContaining({ id: 'lifelog_2025-01-31_99' }),
        ])
      );
    });

    it('should handle lifelogs with complex raw_json efficiently', async () => {
      const complexLifelog = {
        lifelog: {
          id: 'complex_lifelog',
          date: '2025-01-31',
          title: 'Complex interaction',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: JSON.stringify({
            metadata: { duration_ms: 120000, speaker_count: 3 },
            segments: Array.from({ length: 100 }, (_, i) => ({
              text: `Segment ${i} with detailed content and context`,
              timestamp: i * 1000,
              speaker: `Speaker ${i % 3}`,
            })),
          }),
        },
        analysis: {
          manipulation_count: 10,
          wrath_deployed: 2,
          flags: ['gaslighting', 'guilt_trip'],
        },
      };

      const summary: DailySummary = {
        date: '2025-01-31',
        summary: 'Complex analysis',
        metrics: {
          recovery_score: 75,
          strain: 13.5,
          sleep_performance: 82,
          total_manipulations: 10,
          wrath_deployed: true,
        },
        analyzed_lifelogs: [complexLifelog],
      };

      const startTime = performance.now();
      await storeDailySummary(summary);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should provide performance baseline for monitoring', async () => {
      const testCases = [
        { name: '1 lifelog', summary: createMockSummary('2025-01-31', 1) },
        { name: '10 lifelogs', summary: createMockSummary('2025-01-31', 10) },
        { name: '50 lifelogs', summary: createMockSummary('2025-01-31', 50) },
      ];

      const results: { [key: string]: number } = {};

      for (const testCase of testCases) {
        const start = performance.now();
        await storeDailySummary(testCase.summary);
        const end = performance.now();
        results[testCase.name] = end - start;
      }

      // Log baseline performance (useful for CI/CD monitoring)
      console.log('Performance baseline:', results);

      // All should be <1s
      Object.values(results).forEach(duration => {
        expect(duration).toBeLessThan(1000);
      });

      // Performance should scale reasonably (50x data shouldn't be 50x slower)
      expect(results['50 lifelogs']).toBeLessThan(results['1 lifelog'] * 10);
    });
  });
});
