/**
 * Wrath Shield v3 - Coaching Cache Tests
 *
 * Tests for Task #14.4: Caching and Deduplication Logic for AM/PM Results
 */

import {
  CoachingCache,
  getCoachingCache,
  getTimePeriod,
  hashContext,
} from '@/lib/CoachingCache';
import type { CoachingContext } from '@/lib/CoachingEngine';
import type { CoachingResponse } from '@/lib/OpenRouterClient';

describe('CoachingCache', () => {
  let cache: CoachingCache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new CoachingCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockContext: CoachingContext = {
    dailyContext: {
      date: '2025-01-31',
      recovery: {
        id: '1',
        date: '2025-01-31',
        score: 78,
        hrv: 50,
        rhr: 60,
        spo2: 98,
        skin_temp: 36.5,
      },
      cycle: {
        id: '1',
        date: '2025-01-31',
        strain: 12.4,
        kilojoule: 1000,
        avg_hr: 120,
        max_hr: 160,
      },
      sleep: {
        id: '1',
        date: '2025-01-31',
        performance: 85,
        rem_min: 90,
        sws_min: 60,
        light_min: 120,
        awake_min: 10,
        respiration: 14,
        sleep_debt_min: 0,
      },
      lifelogs: [],
      totalManipulations: 0,
      wrathDeployed: false,
    },
    relevantMemories: [
      {
        id: 'mem1',
        text: 'Test memory',
      },
    ],
    anchors: [
      {
        id: 'anchor1',
        text: 'Core principle',
        category: 'boundaries',
        date: '2025-01-30',
      },
    ],
    query: 'high recovery',
  };

  const mockResponse: CoachingResponse = {
    content: 'Excellent recovery at 78% puts you in prime position for growth.',
    model: 'anthropic/claude-3.5-sonnet:beta',
    finish_reason: 'stop',
    metadata: {
      request_id: 'chatcmpl-123',
      timestamp: '2025-01-31T10:00:00.000Z',
    },
  };

  describe('getTimePeriod', () => {
    it('should return AM for hours before noon', () => {
      // Mock time to 9 AM
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      expect(getTimePeriod()).toBe('AM');
    });

    it('should return AM for midnight (hour 0)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(0);
      expect(getTimePeriod()).toBe('AM');
    });

    it('should return AM for 11:59 AM', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(11);
      expect(getTimePeriod()).toBe('AM');
    });

    it('should return PM for noon (hour 12)', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(12);
      expect(getTimePeriod()).toBe('PM');
    });

    it('should return PM for hours after noon', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15);
      expect(getTimePeriod()).toBe('PM');
    });

    it('should return PM for 11:59 PM', () => {
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
      expect(getTimePeriod()).toBe('PM');
    });
  });

  describe('hashContext', () => {
    it('should generate stable hash for same context', () => {
      const hash1 = hashContext(mockContext);
      const hash2 = hashContext(mockContext);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    it('should generate different hash when WHOOP metrics change', () => {
      const hash1 = hashContext(mockContext);

      const modifiedContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: {
            ...mockContext.dailyContext.recovery!,
            score: 50, // Changed from 78
          },
        },
      };

      const hash2 = hashContext(modifiedContext);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash when manipulation stats change', () => {
      const hash1 = hashContext(mockContext);

      const modifiedContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          totalManipulations: 5, // Changed from 0
          wrathDeployed: true, // Changed from false
        },
      };

      const hash2 = hashContext(modifiedContext);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash when memory IDs change', () => {
      const hash1 = hashContext(mockContext);

      const modifiedContext = {
        ...mockContext,
        relevantMemories: [
          {
            id: 'mem2', // Different memory
            text: 'Different memory',
          },
        ],
      };

      const hash2 = hashContext(modifiedContext);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate same hash when memory order changes (sorted)', () => {
      const context1 = {
        ...mockContext,
        relevantMemories: [
          { id: 'mem1', text: 'First' },
          { id: 'mem2', text: 'Second' },
        ],
      };

      const context2 = {
        ...mockContext,
        relevantMemories: [
          { id: 'mem2', text: 'Second' },
          { id: 'mem1', text: 'First' },
        ],
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);
      expect(hash1).toBe(hash2); // Should be same because IDs are sorted
    });

    it('should handle null WHOOP metrics', () => {
      const contextWithNulls = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: null,
          cycle: null,
          sleep: null,
        },
      };

      const hash = hashContext(contextWithNulls);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should round recovery to reduce hash churn from minor fluctuations', () => {
      const context1 = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockContext.dailyContext.recovery!, score: 78.3 },
        },
      };

      const context2 = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockContext.dailyContext.recovery!, score: 78.4 },
        },
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);
      expect(hash1).toBe(hash2); // Both round to 78
    });

    it('should round strain to 1 decimal to reduce hash churn', () => {
      const context1 = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: { ...mockContext.dailyContext.cycle!, strain: 12.43 },
        },
      };

      const context2 = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: { ...mockContext.dailyContext.cycle!, strain: 12.44 },
        },
      };

      const hash1 = hashContext(context1);
      const hash2 = hashContext(context2);
      expect(hash1).toBe(hash2); // Both round to 12.4
    });
  });

  describe('Cache Operations', () => {
    it('should return null for cache miss', () => {
      const result = cache.get('2025-01-31', 'AM', 'test-hash');
      expect(result).toBeNull();
    });

    it('should store and retrieve cached response', () => {
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      const result = cache.get('2025-01-31', 'AM', 'test-hash');
      expect(result).toEqual(mockResponse);
    });

    it('should return null for different date', () => {
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      const result = cache.get('2025-02-01', 'AM', 'test-hash');
      expect(result).toBeNull();
    });

    it('should return null for different time period', () => {
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      const result = cache.get('2025-01-31', 'PM', 'test-hash');
      expect(result).toBeNull();
    });

    it('should return null for different context hash', () => {
      cache.set('2025-01-31', 'AM', 'test-hash-1', mockResponse);

      const result = cache.get('2025-01-31', 'AM', 'test-hash-2');
      expect(result).toBeNull();
    });

    it('should support multiple cached responses', () => {
      const response1 = { ...mockResponse, content: 'Response 1' };
      const response2 = { ...mockResponse, content: 'Response 2' };
      const response3 = { ...mockResponse, content: 'Response 3' };

      cache.set('2025-01-31', 'AM', 'hash1', response1);
      cache.set('2025-01-31', 'PM', 'hash1', response2);
      cache.set('2025-02-01', 'AM', 'hash2', response3);

      expect(cache.get('2025-01-31', 'AM', 'hash1')).toEqual(response1);
      expect(cache.get('2025-01-31', 'PM', 'hash1')).toEqual(response2);
      expect(cache.get('2025-02-01', 'AM', 'hash2')).toEqual(response3);
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire cache after TTL', () => {
      const shortTtlCache = new CoachingCache(100); // 100ms TTL
      shortTtlCache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      // Should be cached immediately
      expect(shortTtlCache.get('2025-01-31', 'AM', 'test-hash')).toEqual(mockResponse);

      // Wait for expiration
      jest.advanceTimersByTime(150);

      // Should be expired
      expect(shortTtlCache.get('2025-01-31', 'AM', 'test-hash')).toBeNull();
    });

    it('should not expire before TTL', () => {
      const cache = new CoachingCache(1000); // 1 second TTL
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      // Wait less than TTL
      jest.advanceTimersByTime(500);

      // Should still be cached
      expect(cache.get('2025-01-31', 'AM', 'test-hash')).toEqual(mockResponse);
    });

    it('should use default TTL of 24 hours', () => {
      const cache = new CoachingCache();
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      // Wait 23 hours
      jest.advanceTimersByTime(23 * 60 * 60 * 1000);
      expect(cache.get('2025-01-31', 'AM', 'test-hash')).toEqual(mockResponse);

      // Wait 2 more hours (total 25 hours)
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      expect(cache.get('2025-01-31', 'AM', 'test-hash')).toBeNull();
    });
  });

  describe('Context Convenience Methods', () => {
    beforeEach(() => {
      // Mock time to 9 AM for consistent time period
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
    });

    it('should store response using context', () => {
      cache.setForContext(mockContext, mockResponse);

      const result = cache.getForContext(mockContext);
      expect(result).toEqual(mockResponse);
    });

    it('should return null for different context', () => {
      cache.setForContext(mockContext, mockResponse);

      const differentContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockContext.dailyContext.recovery!, score: 50 },
        },
      };

      const result = cache.getForContext(differentContext);
      expect(result).toBeNull();
    });

    it('should return null when time period changes', () => {
      // Store during AM
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
      cache.setForContext(mockContext, mockResponse);

      // Try to retrieve during PM
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(15);
      const result = cache.getForContext(mockContext);
      expect(result).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should clear all cached entries', () => {
      cache.set('2025-01-31', 'AM', 'hash1', mockResponse);
      cache.set('2025-01-31', 'PM', 'hash2', mockResponse);
      cache.set('2025-02-01', 'AM', 'hash3', mockResponse);

      cache.clear();

      expect(cache.get('2025-01-31', 'AM', 'hash1')).toBeNull();
      expect(cache.get('2025-01-31', 'PM', 'hash2')).toBeNull();
      expect(cache.get('2025-02-01', 'AM', 'hash3')).toBeNull();
    });

    it('should prune expired entries', () => {
      const cache = new CoachingCache(100); // 100ms TTL

      cache.set('2025-01-31', 'AM', 'hash1', mockResponse);
      cache.set('2025-01-31', 'PM', 'hash2', mockResponse);
      cache.set('2025-02-01', 'AM', 'hash3', mockResponse);

      // Advance time to expire first two entries
      jest.advanceTimersByTime(50);
      cache.set('2025-02-02', 'AM', 'hash4', mockResponse); // Fresh entry

      jest.advanceTimersByTime(60); // Total 110ms - first 3 expired, last one fresh

      const removed = cache.prune();
      expect(removed).toBe(3); // First 3 entries expired

      // Only the last entry should remain
      expect(cache.get('2025-01-31', 'AM', 'hash1')).toBeNull();
      expect(cache.get('2025-01-31', 'PM', 'hash2')).toBeNull();
      expect(cache.get('2025-02-01', 'AM', 'hash3')).toBeNull();
      expect(cache.get('2025-02-02', 'AM', 'hash4')).toEqual(mockResponse);
    });

    it('should return 0 when pruning with no expired entries', () => {
      cache.set('2025-01-31', 'AM', 'hash1', mockResponse);
      cache.set('2025-01-31', 'PM', 'hash2', mockResponse);

      const removed = cache.prune();
      expect(removed).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should return stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats).toEqual({
        size: 0,
        oldestEntryAge: null,
        newestEntryAge: null,
      });
    });

    it('should return stats for single entry', () => {
      cache.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      jest.advanceTimersByTime(1000); // 1 second

      const stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.oldestEntryAge).toBe(1000);
      expect(stats.newestEntryAge).toBe(1000);
    });

    it('should return stats for multiple entries', () => {
      cache.set('2025-01-31', 'AM', 'hash1', mockResponse);

      jest.advanceTimersByTime(500);
      cache.set('2025-01-31', 'PM', 'hash2', mockResponse);

      jest.advanceTimersByTime(500);
      cache.set('2025-02-01', 'AM', 'hash3', mockResponse);

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.oldestEntryAge).toBe(1000); // First entry
      expect(stats.newestEntryAge).toBe(0); // Last entry just added
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getCoachingCache();
      const instance2 = getCoachingCache();

      expect(instance1).toBe(instance2);
    });

    it('should preserve state across singleton calls', () => {
      const instance1 = getCoachingCache();
      instance1.set('2025-01-31', 'AM', 'test-hash', mockResponse);

      const instance2 = getCoachingCache();
      const result = instance2.get('2025-01-31', 'AM', 'test-hash');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content in cached response', () => {
      const longResponse = {
        ...mockResponse,
        content: 'A'.repeat(10000), // 10KB response
      };

      cache.set('2025-01-31', 'AM', 'test-hash', longResponse);
      const result = cache.get('2025-01-31', 'AM', 'test-hash');

      expect(result).toEqual(longResponse);
    });

    it('should handle context with many memories', () => {
      const contextWithManyMemories = {
        ...mockContext,
        relevantMemories: Array.from({ length: 100 }, (_, i) => ({
          id: `mem${i}`,
          text: `Memory ${i}`,
        })),
      };

      const hash = hashContext(contextWithManyMemories);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle context with many lifelogs', () => {
      const contextWithManyLifelogs = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          lifelogs: Array.from({ length: 50 }, (_, i) => ({
            id: `lifelog${i}`,
            date: '2025-01-31',
            title: `Interaction ${i}`,
            manipulation_count: i % 3,
            wrath_deployed: i % 5 === 0 ? 1 : 0,
            raw_json: JSON.stringify({ segments: [] }),
          })),
          totalManipulations: 50,
        },
      };

      const hash = hashContext(contextWithManyLifelogs);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle special characters in context', () => {
      const contextWithSpecialChars = {
        ...mockContext,
        relevantMemories: [
          {
            id: 'mem-special',
            text: 'Memory with émojis 🔥 and "quotes" and newlines\n\nhere',
          },
        ],
      };

      const hash = hashContext(contextWithSpecialChars);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
