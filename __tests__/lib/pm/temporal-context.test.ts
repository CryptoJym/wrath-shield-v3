// @ts-nocheck
/**
 * Wrath Shield v3 - Temporal Context Tests
 *
 * Tests for time-aware grounding:
 * - TemporalContext interface
 * - Current context generation
 * - Time elapsed calculations
 * - Temporal event tracking
 * - Staleness detection
 * - Agent temporal summary
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

import {
  getCurrentContext,
  getTimeElapsed,
  recordEvent,
  getEvent,
  getTimeSinceEvent,
  getEventsByType,
  getStaleEvents,
  getAgentTemporalSummary,
  formatRelativeDate,
  type TemporalContext,
  type RelativeMarkers,
  type TimeElapsed,
  type TemporalEvent,
} from '@/lib/pm/temporal-context';

describe('Temporal Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  describe('Types', () => {
    it('should define TemporalContext interface', () => {
      const context: TemporalContext = {
        current_timestamp: Math.floor(Date.now() / 1000),
        current_date: '2024-12-10',
        current_time: '14:30',
        day_of_week: 'Tuesday',
        week_of_year: 50,
        quarter: 4,
        fiscal_year: 2024,
        time_zone: 'America/New_York',
        business_hours: true,
        relative_markers: {
          start_of_day: Math.floor(Date.now() / 1000) - 3600,
          start_of_week: Math.floor(Date.now() / 1000) - 86400,
          start_of_month: Math.floor(Date.now() / 1000) - 864000,
          start_of_quarter: Math.floor(Date.now() / 1000) - 7776000,
          start_of_year: Math.floor(Date.now() / 1000) - 31536000,
          one_hour_ago: Math.floor(Date.now() / 1000) - 3600,
          one_day_ago: Math.floor(Date.now() / 1000) - 86400,
          one_week_ago: Math.floor(Date.now() / 1000) - 604800,
          one_month_ago: Math.floor(Date.now() / 1000) - 2592000,
        },
      };

      expect(context.time_zone).toBe('America/New_York');
      expect(context.business_hours).toBe(true);
    });

    it('should define RelativeMarkers interface', () => {
      const markers: RelativeMarkers = {
        start_of_day: Math.floor(Date.now() / 1000),
        start_of_week: Math.floor(Date.now() / 1000) - 86400,
        start_of_month: Math.floor(Date.now() / 1000) - 864000,
        start_of_quarter: Math.floor(Date.now() / 1000) - 7776000,
        start_of_year: Math.floor(Date.now() / 1000) - 31536000,
        one_hour_ago: Math.floor(Date.now() / 1000) - 3600,
        one_day_ago: Math.floor(Date.now() / 1000) - 86400,
        one_week_ago: Math.floor(Date.now() / 1000) - 604800,
        one_month_ago: Math.floor(Date.now() / 1000) - 2592000,
      };

      expect(markers.one_hour_ago).toBeLessThan(markers.start_of_day);
    });

    it('should define TimeElapsed interface', () => {
      const elapsed: TimeElapsed = {
        seconds: 3661,
        minutes: 61,
        hours: 1,
        days: 0,
        weeks: 0,
        months: 0,
        human_readable: '1 hour ago',
        is_stale: false,
        staleness_level: 'fresh',
      };

      expect(elapsed.staleness_level).toBe('fresh');
    });

    it('should support all staleness levels', () => {
      const levels: TimeElapsed['staleness_level'][] = [
        'fresh',
        'aging',
        'stale',
        'very_stale',
        'ancient',
      ];

      levels.forEach(level => {
        const elapsed: TimeElapsed = {
          seconds: 0,
          minutes: 0,
          hours: 0,
          days: 0,
          weeks: 0,
          months: 0,
          human_readable: 'just now',
          is_stale: false,
          staleness_level: level,
        };
        expect(elapsed.staleness_level).toBe(level);
      });
    });

    it('should define TemporalEvent interface', () => {
      const event: TemporalEvent = {
        id: 'evt_sync_github_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: { repos_synced: 5 },
        created_at: Math.floor(Date.now() / 1000),
      };

      expect(event.event_type).toBe('sync');
      expect(event.event_key).toBe('github_refresh');
    });
  });

  describe('getCurrentContext', () => {
    it('should return valid temporal context', () => {
      const context = getCurrentContext();

      expect(context).toHaveProperty('current_timestamp');
      expect(context).toHaveProperty('current_date');
      expect(context).toHaveProperty('current_time');
      expect(context).toHaveProperty('day_of_week');
      expect(context).toHaveProperty('week_of_year');
      expect(context).toHaveProperty('quarter');
      expect(context).toHaveProperty('fiscal_year');
      expect(context).toHaveProperty('time_zone');
      expect(context).toHaveProperty('business_hours');
      expect(context).toHaveProperty('relative_markers');
    });

    it('should use default timezone', () => {
      const context = getCurrentContext();

      expect(context.time_zone).toBe('America/New_York');
    });

    it('should accept custom timezone', () => {
      const context = getCurrentContext('Europe/London');

      expect(context.time_zone).toBe('Europe/London');
    });

    it('should calculate correct quarter', () => {
      const context = getCurrentContext();

      expect(context.quarter).toBeGreaterThanOrEqual(1);
      expect(context.quarter).toBeLessThanOrEqual(4);
    });

    it('should calculate week of year', () => {
      const context = getCurrentContext();

      expect(context.week_of_year).toBeGreaterThanOrEqual(1);
      expect(context.week_of_year).toBeLessThanOrEqual(53);
    });

    it('should include relative markers', () => {
      const context = getCurrentContext();
      const markers = context.relative_markers;

      expect(markers.one_hour_ago).toBeLessThan(context.current_timestamp);
      expect(markers.one_day_ago).toBeLessThan(markers.one_hour_ago);
      expect(markers.one_week_ago).toBeLessThan(markers.one_day_ago);
      expect(markers.one_month_ago).toBeLessThan(markers.one_week_ago);
    });

    it('should calculate business hours correctly', () => {
      const context = getCurrentContext();

      // business_hours is a boolean based on weekday and 9-17
      expect(typeof context.business_hours).toBe('boolean');
    });
  });

  describe('getTimeElapsed', () => {
    it('should calculate elapsed time from timestamp', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

      const elapsed = getTimeElapsed(oneHourAgo);

      expect(elapsed.hours).toBe(1);
      expect(elapsed.minutes).toBe(60);
      expect(elapsed.seconds).toBeGreaterThanOrEqual(3600);
    });

    it('should return "just now" for recent timestamps', () => {
      const now = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago

      const elapsed = getTimeElapsed(now);

      expect(elapsed.human_readable).toBe('just now');
    });

    it('should format minutes correctly', () => {
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;

      const elapsed = getTimeElapsed(fiveMinutesAgo);

      expect(elapsed.human_readable).toBe('5 minutes ago');
    });

    it('should format hours correctly', () => {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;

      const elapsed = getTimeElapsed(twoHoursAgo);

      expect(elapsed.human_readable).toBe('2 hours ago');
    });

    it('should format days correctly', () => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - 259200;

      const elapsed = getTimeElapsed(threeDaysAgo);

      expect(elapsed.human_readable).toBe('3 days ago');
    });

    it('should format weeks correctly', () => {
      const twoWeeksAgo = Math.floor(Date.now() / 1000) - 1209600;

      const elapsed = getTimeElapsed(twoWeeksAgo);

      expect(elapsed.human_readable).toBe('2 weeks ago');
    });

    it('should format months correctly', () => {
      const twoMonthsAgo = Math.floor(Date.now() / 1000) - 5184000;

      const elapsed = getTimeElapsed(twoMonthsAgo);

      expect(elapsed.human_readable).toBe('2 months ago');
    });

    it('should determine staleness level fresh', () => {
      const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - 1800;

      const elapsed = getTimeElapsed(thirtyMinutesAgo);

      expect(elapsed.staleness_level).toBe('fresh');
    });

    it('should determine staleness level aging', () => {
      const sixHoursAgo = Math.floor(Date.now() / 1000) - 21600;

      const elapsed = getTimeElapsed(sixHoursAgo);

      expect(elapsed.staleness_level).toBe('aging');
    });

    it('should determine staleness level stale', () => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - 259200;

      const elapsed = getTimeElapsed(threeDaysAgo);

      expect(elapsed.staleness_level).toBe('stale');
    });

    it('should determine staleness level very_stale', () => {
      const twoWeeksAgo = Math.floor(Date.now() / 1000) - 1209600;

      const elapsed = getTimeElapsed(twoWeeksAgo);

      expect(elapsed.staleness_level).toBe('very_stale');
    });

    it('should determine staleness level ancient', () => {
      const sixMonthsAgo = Math.floor(Date.now() / 1000) - 15552000;

      const elapsed = getTimeElapsed(sixMonthsAgo);

      expect(elapsed.staleness_level).toBe('ancient');
    });

    it('should use sync staleness context', () => {
      const twentyMinutesAgo = Math.floor(Date.now() / 1000) - 1200;

      const elapsed = getTimeElapsed(twentyMinutesAgo, 'sync');

      expect(elapsed.is_stale).toBe(true); // 15 min threshold for sync
    });

    it('should use commit staleness context', () => {
      const twoDaysAgo = Math.floor(Date.now() / 1000) - 172800;

      const elapsed = getTimeElapsed(twoDaysAgo, 'commit');

      expect(elapsed.is_stale).toBe(true); // 1 day threshold for commit
    });
  });

  describe('recordEvent', () => {
    it('should record a temporal event', () => {
      mockGet.mockReturnValueOnce({
        id: 'evt_sync_github_refresh_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: '{}',
        created_at: Math.floor(Date.now() / 1000),
      });

      const event = recordEvent({
        event_type: 'sync',
        event_key: 'github_refresh',
        metadata: { repos_synced: 5 },
      });

      expect(event.event_type).toBe('sync');
      expect(event.event_key).toBe('github_refresh');
      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should use custom timestamp if provided', () => {
      const customTimestamp = Math.floor(Date.now() / 1000) - 3600;

      mockGet.mockReturnValueOnce({
        id: 'evt_sync_github_refresh_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: customTimestamp,
        metadata: '{}',
        created_at: Math.floor(Date.now() / 1000),
      });

      const event = recordEvent({
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: customTimestamp,
      });

      expect(event.timestamp).toBe(customTimestamp);
    });

    it('should create unique event ID', () => {
      mockGet.mockReturnValue({
        id: 'evt_sync_test_event_1234567890',
        event_type: 'sync',
        event_key: 'test_event',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: '{}',
        created_at: Math.floor(Date.now() / 1000),
      });

      const event = recordEvent({
        event_type: 'sync',
        event_key: 'test_event',
      });

      expect(event.id).toMatch(/^evt_/);
    });
  });

  describe('getEvent', () => {
    it('should return event by type and key', () => {
      mockGet.mockReturnValueOnce({
        id: 'evt_sync_github_refresh_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: '{"repos_synced": 5}',
        created_at: Math.floor(Date.now() / 1000),
      });

      const event = getEvent('sync', 'github_refresh');

      expect(event).not.toBeNull();
      expect(event?.event_type).toBe('sync');
      expect(event?.metadata.repos_synced).toBe(5);
    });

    it('should return null when event not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const event = getEvent('sync', 'nonexistent');

      expect(event).toBeNull();
    });

    it('should parse metadata JSON', () => {
      mockGet.mockReturnValueOnce({
        id: 'evt_analysis_batch_1234567890',
        event_type: 'analysis',
        event_key: 'batch',
        timestamp: Math.floor(Date.now() / 1000),
        metadata: '{"tasks_analyzed": 10, "patterns_found": 3}',
        created_at: Math.floor(Date.now() / 1000),
      });

      const event = getEvent('analysis', 'batch');

      expect(event?.metadata.tasks_analyzed).toBe(10);
      expect(event?.metadata.patterns_found).toBe(3);
    });
  });

  describe('getTimeSinceEvent', () => {
    it('should return time elapsed since event', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      mockGet.mockReturnValueOnce({
        id: 'evt_sync_github_refresh_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: oneHourAgo,
        metadata: '{}',
        created_at: oneHourAgo,
      });

      const elapsed = getTimeSinceEvent('sync', 'github_refresh');

      expect(elapsed).not.toBeNull();
      expect(elapsed?.hours).toBe(1);
    });

    it('should return null when event not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const elapsed = getTimeSinceEvent('sync', 'nonexistent');

      expect(elapsed).toBeNull();
    });

    it('should pass staleness context', () => {
      const twentyMinutesAgo = Math.floor(Date.now() / 1000) - 1200;
      mockGet.mockReturnValueOnce({
        id: 'evt_sync_github_refresh_1234567890',
        event_type: 'sync',
        event_key: 'github_refresh',
        timestamp: twentyMinutesAgo,
        metadata: '{}',
        created_at: twentyMinutesAgo,
      });

      const elapsed = getTimeSinceEvent('sync', 'github_refresh', 'sync');

      expect(elapsed?.is_stale).toBe(true);
    });
  });

  describe('getEventsByType', () => {
    it('should return events of a given type', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'evt_sync_repo1_1234567890',
          event_type: 'sync',
          event_key: 'repo1',
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          metadata: '{}',
          created_at: Math.floor(Date.now() / 1000) - 3600,
        },
        {
          id: 'evt_sync_repo2_1234567891',
          event_type: 'sync',
          event_key: 'repo2',
          timestamp: Math.floor(Date.now() / 1000),
          metadata: '{}',
          created_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const events = getEventsByType('sync');

      expect(events).toHaveLength(2);
      expect(events[0].event_type).toBe('sync');
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]);

      getEventsByType('sync', 10);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });

    it('should parse metadata for each event', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'evt_sync_repo1_1234567890',
          event_type: 'sync',
          event_key: 'repo1',
          timestamp: Math.floor(Date.now() / 1000),
          metadata: '{"tasks": 5}',
          created_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const events = getEventsByType('sync');

      expect(events[0].metadata.tasks).toBe(5);
    });
  });

  describe('getStaleEvents', () => {
    it('should return stale events', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'evt_sync_old_1234567890',
          event_type: 'sync',
          event_key: 'old_sync',
          timestamp: Math.floor(Date.now() / 1000) - 864000, // 10 days ago
          metadata: '{}',
          created_at: Math.floor(Date.now() / 1000) - 864000,
        },
      ]);

      const staleEvents = getStaleEvents();

      expect(staleEvents).toHaveLength(1);
    });

    it('should filter by event type', () => {
      mockAll.mockReturnValueOnce([]);

      getStaleEvents('sync');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('event_type')
      );
    });

    it('should use custom max age', () => {
      mockAll.mockReturnValueOnce([]);

      getStaleEvents(undefined, 3600); // 1 hour

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('getAgentTemporalSummary', () => {
    it('should return complete temporal summary', () => {
      mockGet.mockReturnValue(undefined);
      mockAll.mockReturnValue([]);

      const summary = getAgentTemporalSummary();

      expect(summary).toHaveProperty('context');
      expect(summary).toHaveProperty('last_sync');
      expect(summary).toHaveProperty('last_commit_analysis');
      expect(summary).toHaveProperty('stale_items');
      expect(summary).toHaveProperty('grounding_statement');
    });

    it('should include context with timezone', () => {
      mockGet.mockReturnValue(undefined);
      mockAll.mockReturnValue([]);

      const summary = getAgentTemporalSummary('Europe/London');

      expect(summary.context.time_zone).toBe('Europe/London');
    });

    it('should generate grounding statement', () => {
      mockGet.mockReturnValue(undefined);
      mockAll.mockReturnValue([]);

      const summary = getAgentTemporalSummary();

      expect(summary.grounding_statement).toContain('Today is');
      expect(summary.grounding_statement).toContain('Current time');
    });

    it('should include last sync info in grounding', () => {
      mockGet
        .mockReturnValueOnce({
          id: 'evt_sync_github_refresh_1234567890',
          event_type: 'sync',
          event_key: 'github_refresh',
          timestamp: Math.floor(Date.now() / 1000) - 600,
          metadata: '{}',
          created_at: Math.floor(Date.now() / 1000) - 600,
        })
        .mockReturnValueOnce(undefined);
      mockAll.mockReturnValue([]);

      const summary = getAgentTemporalSummary();

      expect(summary.grounding_statement).toContain('Last GitHub sync');
    });

    it('should count stale items', () => {
      mockGet.mockReturnValue(undefined);
      mockAll.mockReturnValue([
        {
          id: 'evt_sync_old_1234567890',
          event_type: 'sync',
          event_key: 'old',
          timestamp: Math.floor(Date.now() / 1000) - 1800,
          metadata: '{}',
          created_at: Math.floor(Date.now() / 1000) - 1800,
        },
      ]);

      const summary = getAgentTemporalSummary();

      expect(summary.stale_items.syncs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatRelativeDate', () => {
    it('should format timestamp as relative date', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;

      const formatted = formatRelativeDate(oneHourAgo);

      expect(formatted).toBe('1 hour ago');
    });

    it('should support verbose option', () => {
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

      const formatted = formatRelativeDate(oneDayAgo, { verbose: true });

      expect(formatted).toContain('ago');
      expect(formatted.length).toBeGreaterThan(10); // Verbose is longer
    });

    it('should include time when requested', () => {
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

      const formatted = formatRelativeDate(oneDayAgo, { verbose: true, includeTime: true });

      expect(formatted).toContain('at');
    });

    it('should handle recent timestamps', () => {
      const now = Math.floor(Date.now() / 1000) - 10;

      const formatted = formatRelativeDate(now);

      expect(formatted).toBe('just now');
    });
  });

  describe('Table Creation', () => {
    it('should create temporal_events table', () => {
      mockGet.mockReturnValue(undefined);

      getEvent('test', 'test');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS temporal_events')
      );
    });

    it('should create indices for performance', () => {
      mockGet.mockReturnValue(undefined);

      getEvent('test', 'test');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });
});
