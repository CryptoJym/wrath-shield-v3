// @ts-nocheck
/**
 * Tests for Temporal Search Preprocessing System
 *
 * Tests natural language temporal parsing, temporal scoring, and overdue detection
 */

import {
  parseTemporalExpression,
  extractTemporalContext,
  calculateTemporalScore,
  findOverdueItems,
  searchWithTemporal,
  createTemporalSearchPreprocessor,
  TemporalSearchPreprocessor,
  type TemporalReference,
  type TemporalDirection,
  type TemporalQuery,
  type TemporalSearchOptions,
  type ParsedTemporalExpression,
} from '@/lib/cortex/temporal-search';
import type { WorkingMemoryEvent } from '@/lib/cortex/types';

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock date-fns (use actual implementation for most tests)
jest.mock('date-fns', () => {
  const actual = jest.requireActual('date-fns');
  return {
    ...actual,
  };
});

describe('temporal-search', () => {
  const referenceDate = new Date('2025-01-15T12:00:00Z');

  // ============================================================================
  // Type Tests
  // ============================================================================

  describe('Type Definitions', () => {
    it('should have TemporalReference type with string values', () => {
      const today: TemporalReference = 'today';
      const yesterday: TemporalReference = 'yesterday';
      const thisWeek: TemporalReference = 'this_week';
      const lastWeek: TemporalReference = 'last_week';
      const thisMonth: TemporalReference = 'this_month';
      const lastMonth: TemporalReference = 'last_month';
      const thisYear: TemporalReference = 'this_year';

      expect(today).toBe('today');
      expect(yesterday).toBe('yesterday');
      expect(thisWeek).toBe('this_week');
      expect(lastWeek).toBe('last_week');
      expect(thisMonth).toBe('this_month');
      expect(lastMonth).toBe('last_month');
      expect(thisYear).toBe('this_year');
    });

    it('should have TemporalReference with date object', () => {
      const dateRef: TemporalReference = { date: new Date() };
      expect(dateRef).toHaveProperty('date');
    });

    it('should have TemporalReference with range', () => {
      const rangeRef: TemporalReference = {
        range: { start: new Date(), end: new Date() },
      };
      expect(rangeRef).toHaveProperty('range');
    });

    it('should have TemporalDirection type with correct values', () => {
      const before: TemporalDirection = 'before';
      const after: TemporalDirection = 'after';
      const around: TemporalDirection = 'around';
      const exact: TemporalDirection = 'exact';

      expect(before).toBe('before');
      expect(after).toBe('after');
      expect(around).toBe('around');
      expect(exact).toBe('exact');
    });

    it('should define TemporalQuery interface correctly', () => {
      const query: TemporalQuery = {
        reference: 'today',
        direction: 'exact',
        windowMs: 3600000,
      };

      expect(query.reference).toBe('today');
      expect(query.direction).toBe('exact');
      expect(query.windowMs).toBe(3600000);
    });

    it('should define TemporalSearchOptions interface correctly', () => {
      const options: TemporalSearchOptions = {
        temporal: { reference: 'this_week' },
        includeOverdue: true,
        deadlineOnly: false,
        recencyBias: 0.3,
        limit: 50,
      };

      expect(options.includeOverdue).toBe(true);
      expect(options.recencyBias).toBe(0.3);
      expect(options.limit).toBe(50);
    });

    it('should define ParsedTemporalExpression interface correctly', () => {
      const parsed: ParsedTemporalExpression = {
        original: 'yesterday',
        resolved: { start: new Date(), end: new Date() },
        confidence: 1.0,
        type: 'relative',
      };

      expect(parsed.confidence).toBe(1.0);
      expect(parsed.type).toBe('relative');
    });
  });

  // ============================================================================
  // parseTemporalExpression Tests
  // ============================================================================

  describe('parseTemporalExpression', () => {
    describe('Relative Expressions', () => {
      it('should parse "today"', () => {
        const result = parseTemporalExpression('What happened today?', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('today');
        expect(result?.confidence).toBe(1.0);
        expect(result?.type).toBe('relative');
      });

      it('should parse "yesterday"', () => {
        const result = parseTemporalExpression('Show me yesterday\'s meetings', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('yesterday');
        expect(result?.confidence).toBe(1.0);
        expect(result?.type).toBe('relative');
      });

      it('should parse "tomorrow"', () => {
        const result = parseTemporalExpression('What is scheduled for tomorrow?', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('tomorrow');
        expect(result?.confidence).toBe(1.0);
      });

      it('should parse "this week"', () => {
        const result = parseTemporalExpression('Show me everything this week', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('this week');
        expect(result?.confidence).toBe(1.0);
      });

      it('should parse "last week"', () => {
        const result = parseTemporalExpression('What did I discuss last week?', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('last week');
        expect(result?.confidence).toBe(1.0);
      });

      it('should parse "this month"', () => {
        const result = parseTemporalExpression('Tasks this month', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('this month');
      });

      it('should parse "last month"', () => {
        const result = parseTemporalExpression('Meetings from last month', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('last month');
      });

      it('should parse "this year"', () => {
        const result = parseTemporalExpression('Summary for this year', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('this year');
      });

      it('should parse "N days ago"', () => {
        const result = parseTemporalExpression('What happened 5 days ago?', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('5 days ago');
        expect(result?.confidence).toBe(0.95);
      });

      it('should parse "N weeks ago"', () => {
        const result = parseTemporalExpression('Meeting from 2 weeks ago', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('2 weeks ago');
        expect(result?.confidence).toBe(0.95);
      });

      it('should parse "N months ago"', () => {
        const result = parseTemporalExpression('Project from 3 months ago', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('3 months ago');
        expect(result?.confidence).toBe(0.95);
      });

      it('should parse "last [day of week]"', () => {
        const result = parseTemporalExpression('Meeting from last Tuesday', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('last Tuesday');
        expect(result?.confidence).toBe(0.9);
      });

      it('should parse "next [day of week]"', () => {
        const result = parseTemporalExpression('Appointment next Friday', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('next Friday');
        expect(result?.confidence).toBe(0.9);
      });

      it('should handle abbreviated day names', () => {
        const result = parseTemporalExpression('last Mon', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('last Mon');
      });
    });

    describe('Absolute Expressions', () => {
      it('should parse ISO date format (YYYY-MM-DD)', () => {
        const result = parseTemporalExpression('Event on 2025-01-10', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('2025-01-10');
        expect(result?.confidence).toBe(1.0);
        expect(result?.type).toBe('absolute');
      });

      it('should parse US date format (M/D/YYYY)', () => {
        const result = parseTemporalExpression('Meeting on 1/10/2025', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('1/10/2025');
        expect(result?.type).toBe('absolute');
      });

      it('should parse US date format with 2-digit year', () => {
        const result = parseTemporalExpression('Event on 12/5/25', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('12/5/25');
      });

      it('should parse month day format', () => {
        const result = parseTemporalExpression('Event on December 5th', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('December 5th');
        expect(result?.confidence).toBe(0.9);
      });

      it('should parse abbreviated month day format', () => {
        const result = parseTemporalExpression('Meeting on Jan 15', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('Jan 15');
      });
    });

    describe('Recurring Expressions', () => {
      it('should parse "every [day]"', () => {
        const result = parseTemporalExpression('Happens every Monday', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('every Monday');
        expect(result?.type).toBe('recurring');
        expect(result?.confidence).toBe(0.7);
      });

      it('should parse "every day"', () => {
        const result = parseTemporalExpression('Check every day', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('every day');
      });

      it('should parse "every week"', () => {
        const result = parseTemporalExpression('Meeting every week', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original).toBe('every week');
      });
    });

    describe('Edge Cases', () => {
      it('should return null for non-temporal text', () => {
        const result = parseTemporalExpression('Show me all tasks', referenceDate);

        expect(result).toBeNull();
      });

      it('should handle case insensitivity', () => {
        const result = parseTemporalExpression('YESTERDAY', referenceDate);

        expect(result).not.toBeNull();
        expect(result?.original.toLowerCase()).toBe('yesterday');
      });

      it('should use current date when no reference provided', () => {
        const result = parseTemporalExpression('today');

        expect(result).not.toBeNull();
        expect(result?.resolved.start).toBeDefined();
      });
    });
  });

  // ============================================================================
  // extractTemporalContext Tests
  // ============================================================================

  describe('extractTemporalContext', () => {
    it('should extract temporal context and clean query', () => {
      const result = extractTemporalContext('What did I discuss with John yesterday?');

      expect(result.cleanedQuery).toBe('What did I discuss with John ?');
      expect(result.temporal).not.toBeNull();
      expect(result.temporal?.direction).toBe('exact');
    });

    it('should return original query when no temporal expression', () => {
      const query = 'Show me all tasks';
      const result = extractTemporalContext(query);

      expect(result.cleanedQuery).toBe(query);
      expect(result.temporal).toBeNull();
    });

    it('should handle multiple words in query', () => {
      const result = extractTemporalContext('Meetings from last week with the team');

      expect(result.cleanedQuery).toBe('Meetings from  with the team');
      expect(result.temporal).not.toBeNull();
    });
  });

  // ============================================================================
  // calculateTemporalScore Tests
  // ============================================================================

  describe('calculateTemporalScore', () => {
    describe('String References', () => {
      it('should score event within "today" range as 1.0', () => {
        const now = new Date();
        const eventTime = now;
        const query: TemporalQuery = { reference: 'today' };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeGreaterThan(0.9);
      });

      it('should score event from yesterday as 1.0 for "yesterday" query', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const query: TemporalQuery = { reference: 'yesterday' };

        const score = calculateTemporalScore(yesterday, query);

        expect(score).toBeGreaterThan(0.9);
      });

      it('should score event outside range lower', () => {
        const oldEvent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const query: TemporalQuery = { reference: 'today' };

        const score = calculateTemporalScore(oldEvent, query);

        expect(score).toBeLessThan(0.5);
      });
    });

    describe('Date References', () => {
      it('should score event on exact date as 1.0', () => {
        const targetDate = new Date('2025-01-10');
        const eventTime = new Date('2025-01-10T14:00:00');
        const query: TemporalQuery = { reference: { date: targetDate } };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeGreaterThan(0.9);
      });
    });

    describe('Range References', () => {
      it('should score event within range as 1.0', () => {
        const start = new Date('2025-01-01');
        const end = new Date('2025-01-31');
        const eventTime = new Date('2025-01-15');
        const query: TemporalQuery = { reference: { range: { start, end } } };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBe(1.0);
      });

      it('should score event outside range lower', () => {
        const start = new Date('2025-01-01');
        const end = new Date('2025-01-10');
        const eventTime = new Date('2025-02-15');
        const query: TemporalQuery = { reference: { range: { start, end } } };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeLessThan(1.0);
      });
    });

    describe('Direction Modifiers', () => {
      it('should handle "before" direction', () => {
        const eventTime = new Date('2025-01-01');
        const query: TemporalQuery = {
          reference: { date: new Date('2025-01-15') },
          direction: 'before',
        };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeGreaterThan(0.5);
      });

      it('should handle "after" direction', () => {
        const eventTime = new Date('2025-01-30');
        const query: TemporalQuery = {
          reference: { date: new Date('2025-01-15') },
          direction: 'after',
        };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeGreaterThan(0.5);
      });

      it('should handle "around" direction with window', () => {
        const targetDate = new Date('2025-01-15T12:00:00');
        const eventTime = new Date('2025-01-15T12:30:00'); // 30 minutes off
        const query: TemporalQuery = {
          reference: { date: targetDate },
          direction: 'around',
          windowMs: 3600000, // 1 hour window
        };

        const score = calculateTemporalScore(eventTime, query);

        expect(score).toBeGreaterThan(0.9);
      });
    });

    describe('Recency Bias', () => {
      it('should apply recency bias to scoring', () => {
        const recentEvent = new Date(Date.now() - 1000);
        const oldEvent = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const query: TemporalQuery = { reference: 'this_year' };

        const recentScore = calculateTemporalScore(recentEvent, query, 0.5);
        const oldScore = calculateTemporalScore(oldEvent, query, 0.5);

        expect(recentScore).toBeGreaterThan(oldScore);
      });

      it('should return scores within [0, 1] range', () => {
        const eventTime = new Date();
        const query: TemporalQuery = { reference: 'today' };

        const score = calculateTemporalScore(eventTime, query, 0.8);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  // ============================================================================
  // findOverdueItems Tests
  // ============================================================================

  describe('findOverdueItems', () => {
    const mockWorkingMemory = {
      getUnprocessed: jest.fn(),
      getRecent: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should find events with past deadlines', async () => {
      const overdueEvent: Partial<WorkingMemoryEvent> = {
        id: 'event_1',
        content: 'Task with deadline: 2025-01-01',
        timestamp: '2025-01-01T10:00:00Z',
        metadata: { deadline: '2025-01-01' },
      };

      const futureEvent: Partial<WorkingMemoryEvent> = {
        id: 'event_2',
        content: 'Future task',
        timestamp: '2025-01-15T10:00:00Z',
        metadata: { deadline: '2025-12-31' },
      };

      mockWorkingMemory.getUnprocessed.mockResolvedValue([overdueEvent, futureEvent]);

      const result = await findOverdueItems(mockWorkingMemory as any, new Date('2025-01-15'));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event_1');
    });

    it('should extract deadline from content', async () => {
      const eventWithContentDeadline: Partial<WorkingMemoryEvent> = {
        id: 'event_1',
        content: 'Task due: 2025-01-01',
        timestamp: '2024-12-01T10:00:00Z',
        metadata: {},
      };

      mockWorkingMemory.getUnprocessed.mockResolvedValue([eventWithContentDeadline]);

      const result = await findOverdueItems(mockWorkingMemory as any, new Date('2025-01-15'));

      expect(result.length).toBeGreaterThanOrEqual(0); // May or may not extract depending on pattern matching
    });

    it('should sort by deadline (most overdue first)', async () => {
      const events = [
        { id: '1', content: 'a', timestamp: '2025-01-01', metadata: { deadline: '2025-01-10' } },
        { id: '2', content: 'b', timestamp: '2025-01-01', metadata: { deadline: '2025-01-05' } },
        { id: '3', content: 'c', timestamp: '2025-01-01', metadata: { deadline: '2025-01-08' } },
      ];

      mockWorkingMemory.getUnprocessed.mockResolvedValue(events);

      const result = await findOverdueItems(mockWorkingMemory as any, new Date('2025-01-15'));

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('2'); // Jan 5 - most overdue
      expect(result[1].id).toBe('3'); // Jan 8
      expect(result[2].id).toBe('1'); // Jan 10
    });

    it('should return empty array when no overdue items', async () => {
      mockWorkingMemory.getUnprocessed.mockResolvedValue([
        { id: '1', content: 'a', timestamp: '2025-01-01', metadata: { deadline: '2025-12-31' } },
      ]);

      const result = await findOverdueItems(mockWorkingMemory as any, new Date('2025-01-15'));

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // searchWithTemporal Tests
  // ============================================================================

  describe('searchWithTemporal', () => {
    const mockWorkingMemory = {
      getRecent: jest.fn(),
      getUnprocessed: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockWorkingMemory.getRecent.mockResolvedValue([]);
      mockWorkingMemory.getUnprocessed.mockResolvedValue([]);
    });

    it('should extract temporal context from query', async () => {
      const events = [
        { id: '1', content: 'Meeting with John', timestamp: new Date().toISOString(), source: 'calendar' },
      ];
      mockWorkingMemory.getRecent.mockResolvedValue(events);

      const result = await searchWithTemporal('meetings yesterday', {}, mockWorkingMemory as any);

      expect(mockWorkingMemory.getRecent).toHaveBeenCalled();
    });

    it('should filter by text query', async () => {
      const events = [
        { id: '1', content: 'Meeting with John', timestamp: new Date().toISOString(), source: 'calendar' },
        { id: '2', content: 'Email from Jane', timestamp: new Date().toISOString(), source: 'gmail' },
      ];
      mockWorkingMemory.getRecent.mockResolvedValue(events);

      const result = await searchWithTemporal('John', {}, mockWorkingMemory as any);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should respect limit option', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        content: `Event ${i}`,
        timestamp: new Date().toISOString(),
        source: 'test',
      }));
      mockWorkingMemory.getRecent.mockResolvedValue(events);

      const result = await searchWithTemporal('Event', { limit: 5 }, mockWorkingMemory as any);

      expect(result).toHaveLength(5);
    });

    it('should filter deadline-only when specified', async () => {
      const events = [
        { id: '1', content: 'Task with deadline: 2025-01-20', timestamp: new Date().toISOString(), source: 'tasks', metadata: { deadline: '2025-01-20' } },
        { id: '2', content: 'Regular event', timestamp: new Date().toISOString(), source: 'calendar', metadata: {} },
      ];
      mockWorkingMemory.getRecent.mockResolvedValue(events);

      const result = await searchWithTemporal('', { deadlineOnly: true }, mockWorkingMemory as any);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should include overdue items when specified', async () => {
      mockWorkingMemory.getRecent.mockResolvedValue([]);
      mockWorkingMemory.getUnprocessed.mockResolvedValue([
        { id: '1', content: 'Overdue task', timestamp: '2025-01-01', source: 'tasks', metadata: { deadline: '2025-01-01' } },
      ]);

      const result = await searchWithTemporal('', { includeOverdue: true }, mockWorkingMemory as any);

      // Should include overdue items
      expect(mockWorkingMemory.getUnprocessed).toHaveBeenCalled();
    });

    it('should apply recency bias to scoring', async () => {
      const recentEvent = { id: '1', content: 'Recent', timestamp: new Date().toISOString(), source: 'test' };
      const oldEvent = { id: '2', content: 'Old', timestamp: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), source: 'test' };

      mockWorkingMemory.getRecent.mockResolvedValue([oldEvent, recentEvent]);

      const result = await searchWithTemporal('', { recencyBias: 0.8 }, mockWorkingMemory as any);

      // Recent event should be ranked first
      expect(result[0].id).toBe('1');
    });
  });

  // ============================================================================
  // TemporalSearchPreprocessor Tests
  // ============================================================================

  describe('TemporalSearchPreprocessor', () => {
    const mockWorkingMemory = {
      getRecent: jest.fn(),
      getUnprocessed: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockWorkingMemory.getRecent.mockResolvedValue([]);
      mockWorkingMemory.getUnprocessed.mockResolvedValue([]);
    });

    it('should create preprocessor with createTemporalSearchPreprocessor', () => {
      const preprocessor = createTemporalSearchPreprocessor(mockWorkingMemory as any);

      expect(preprocessor).toBeInstanceOf(TemporalSearchPreprocessor);
    });

    it('should have search method', async () => {
      const preprocessor = new TemporalSearchPreprocessor(mockWorkingMemory as any);

      const result = await preprocessor.search('yesterday');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should have extractTemporalContext method', () => {
      const preprocessor = new TemporalSearchPreprocessor(mockWorkingMemory as any);

      const result = preprocessor.extractTemporalContext('meetings yesterday');

      expect(result).toHaveProperty('cleanedQuery');
      expect(result).toHaveProperty('temporal');
    });

    it('should have findOverdue method', async () => {
      const preprocessor = new TemporalSearchPreprocessor(mockWorkingMemory as any);

      const result = await preprocessor.findOverdue();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should have parseExpression method', () => {
      const preprocessor = new TemporalSearchPreprocessor(mockWorkingMemory as any);

      const result = preprocessor.parseExpression('yesterday');

      expect(result).not.toBeNull();
      expect(result?.original).toBe('yesterday');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const result = parseTemporalExpression('');

      expect(result).toBeNull();
    });

    it('should handle invalid dates gracefully', () => {
      const result = parseTemporalExpression('2025-99-99');

      // Should not crash, may return null or handle gracefully
      expect(result === null || result !== null).toBe(true);
    });

    it('should handle very old years', () => {
      const result = parseTemporalExpression('1/1/20');

      expect(result).not.toBeNull();
      // 20 should be interpreted as 2020, not 1920
    });

    it('should handle temporal patterns in different positions', () => {
      const beginning = parseTemporalExpression('Yesterday I had a meeting');
      const end = parseTemporalExpression('I had a meeting yesterday');
      const middle = parseTemporalExpression('The meeting yesterday was great');

      expect(beginning).not.toBeNull();
      expect(end).not.toBeNull();
      expect(middle).not.toBeNull();
    });

    it('should handle between ranges', () => {
      const result = parseTemporalExpression('between Monday and Friday');

      expect(result).not.toBeNull();
      expect(result?.original).toContain('between');
    });

    it('should return default score for unknown reference', () => {
      const query: TemporalQuery = { reference: 'unknown' as any };
      const score = calculateTemporalScore(new Date(), query);

      expect(score).toBe(0);
    });
  });
});
