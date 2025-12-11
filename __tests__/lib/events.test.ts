// @ts-nocheck
/**
 * Wrath Shield v3 - Events Tests
 *
 * Tests for the events database layer with SQLite storage.
 * Handles event ingestion, classification, routing, and inbox actions.
 */

import {
  getDb,
  upsertEvents,
  listRecentEvents,
  listEventsNeedingReview,
  updateEventClassification,
  markEventReviewed,
  routeEvent,
  markJunk,
  dismissEvent,
  updateEventRsvp,
  flagEvent,
  snoozeEvent,
  bulkRouteEvents,
  bulkDismissEvents,
  bulkEnrichEvents,
  type EventRow,
} from '@/lib/events';

// Mock better-sqlite3
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockPragma = jest.fn();
const mockTransaction = jest.fn();
const mockClose = jest.fn();
const mockAll = jest.fn();
const mockRun = jest.fn();

let mockDbAvailable = true;

jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => {
    if (!mockDbAvailable) {
      throw new Error('Database unavailable');
    }
    return {
      prepare: mockPrepare,
      exec: mockExec,
      pragma: mockPragma,
      transaction: mockTransaction,
      close: mockClose,
    };
  });
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

describe('Events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbAvailable = true;

    // Setup mock chain
    mockPrepare.mockReturnValue({
      all: mockAll,
      run: mockRun,
    });

    mockAll.mockReturnValue([]);
    mockTransaction.mockImplementation((fn: any) => {
      return (args: any) => fn(args);
    });
  });

  describe('getDb', () => {
    it('should return database instance when available', () => {
      const db = getDb();
      expect(db).toBeDefined();
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should return null when better-sqlite3 fails', () => {
      mockDbAvailable = false;
      const db = getDb();
      // When BetterSqlite3 constructor throws, getDb returns null
      expect(db).toBeNull();
    });

    it('should run schema creation on initialization', () => {
      getDb();
      expect(mockExec).toHaveBeenCalled();
    });

    it('should run migrations to add new columns', () => {
      // Mock existing columns
      mockAll.mockReturnValueOnce([
        { name: 'id' },
        { name: 'source' },
        { name: 'channel' },
      ]);

      getDb();

      // Should have called transaction for migrations
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('upsertEvents', () => {
    it('should do nothing for empty rows', () => {
      upsertEvents([]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should insert events into database', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          subject: 'Test email',
        },
        {
          id: 'evt2',
          source: 'calendar',
          channel: 'meeting',
          ts: 1704067300,
          subject: 'Team meeting',
        },
      ];

      upsertEvents(events);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledTimes(2);
    });

    it('should use default user_id when not provided', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
        },
      ];

      upsertEvents(events);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'default',
        })
      );
    });

    it('should use provided user_id', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
        },
      ];

      upsertEvents(events, 'user-123');

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
        })
      );
    });

    it('should serialize metadata to JSON', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          metadata: { key: 'value', nested: { a: 1 } },
        },
      ];

      upsertEvents(events);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: '{"key":"value","nested":{"a":1}}',
        })
      );
    });
  });

  describe('listRecentEvents', () => {
    it('should return empty array when db unavailable', () => {
      mockDbAvailable = false;
      const events = listRecentEvents();
      expect(events).toEqual([]);
    });

    it('should return events ordered by timestamp', () => {
      const mockEvents = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          metadata: '{"key":"value"}',
        },
        {
          id: 'evt2',
          source: 'calendar',
          channel: 'meeting',
          ts: 1704067100,
          metadata: null,
        },
      ];

      mockAll.mockReturnValueOnce([]); // For migration check
      mockAll.mockReturnValueOnce(mockEvents);

      const events = listRecentEvents();

      expect(events.length).toBe(2);
      expect(events[0].id).toBe('evt1');
      expect(events[0].metadata).toEqual({ key: 'value' });
      expect(events[1].metadata).toBeNull();
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]); // For migration check
      mockAll.mockReturnValueOnce([]);

      listRecentEvents(50);

      expect(mockAll).toHaveBeenCalled();
    });

    it('should filter by user_id when provided', () => {
      mockAll.mockReturnValueOnce([]); // For migration check
      mockAll.mockReturnValueOnce([]);

      listRecentEvents(200, 'user-123');

      expect(mockAll).toHaveBeenCalledWith('user-123', 200);
    });
  });

  describe('listEventsNeedingReview', () => {
    it('should return events with needs_review = 1', () => {
      const mockEvents = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          needs_review: 1,
          confidence: 0.5,
        },
      ];

      mockAll.mockReturnValueOnce([]); // For migration check
      mockAll.mockReturnValueOnce(mockEvents);

      const events = listEventsNeedingReview();

      expect(events.length).toBe(1);
      expect(events[0].needs_review).toBe(1);
    });
  });

  describe('updateEventClassification', () => {
    it('should update classification and confidence', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      updateEventClassification('evt1', 'important', 0.85);

      expect(mockRun).toHaveBeenCalledWith(['important', 0.85, 0, 'evt1']);
    });

    it('should set needs_review when confidence < 0.7', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      updateEventClassification('evt1', 'uncertain', 0.5);

      expect(mockRun).toHaveBeenCalledWith(['uncertain', 0.5, 1, 'evt1']);
    });

    it('should not set needs_review when confidence >= 0.7', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      updateEventClassification('evt1', 'certain', 0.9);

      expect(mockRun).toHaveBeenCalledWith(['certain', 0.9, 0, 'evt1']);
    });
  });

  describe('markEventReviewed', () => {
    it('should set needs_review to 0', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      markEventReviewed('evt1');

      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('routeEvent', () => {
    it('should update routed_target and clear junk flag', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      routeEvent('evt1', 'inbox-agent');

      expect(mockRun).toHaveBeenCalledWith(['inbox-agent', 'evt1']);
    });

    it('should filter by user_id when provided', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      routeEvent('evt1', 'inbox-agent', 'user-123');

      expect(mockRun).toHaveBeenCalledWith(['inbox-agent', 'evt1', 'user-123']);
    });
  });

  describe('markJunk', () => {
    it('should set junk flag to 1 when true', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      markJunk('evt1', true);

      expect(mockRun).toHaveBeenCalledWith([1, 'evt1']);
    });

    it('should set junk flag to 0 when false', () => {
      mockAll.mockReturnValueOnce([]); // For migration check

      markJunk('evt1', false);

      expect(mockRun).toHaveBeenCalledWith([0, 'evt1']);
    });
  });

  describe('Inbox Actions', () => {
    describe('dismissEvent', () => {
      it('should set dismissed_at timestamp', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        const beforeTs = Math.floor(Date.now() / 1000);
        dismissEvent('evt1');
        const afterTs = Math.floor(Date.now() / 1000);

        expect(mockRun).toHaveBeenCalled();
        const [timestamp, id] = mockRun.mock.calls[0][0];
        expect(timestamp).toBeGreaterThanOrEqual(beforeTs);
        expect(timestamp).toBeLessThanOrEqual(afterTs);
        expect(id).toBe('evt1');
      });
    });

    describe('updateEventRsvp', () => {
      it('should update rsvp_status and dismiss event', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        updateEventRsvp('evt1', 'accepted');

        expect(mockRun).toHaveBeenCalled();
        const args = mockRun.mock.calls[0][0];
        expect(args[0]).toBe('accepted');
        expect(args[2]).toBe('evt1');
      });
    });

    describe('flagEvent', () => {
      it('should set flagged to 1 when true', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        flagEvent('evt1', true);

        expect(mockRun).toHaveBeenCalledWith([1, 'evt1']);
      });

      it('should set flagged to 0 when false', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        flagEvent('evt1', false);

        expect(mockRun).toHaveBeenCalledWith([0, 'evt1']);
      });
    });

    describe('snoozeEvent', () => {
      it('should set snoozed_until timestamp', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        const snoozeTime = Math.floor(Date.now() / 1000) + 3600;
        snoozeEvent('evt1', snoozeTime);

        expect(mockRun).toHaveBeenCalledWith([snoozeTime, 'evt1']);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulkRouteEvents', () => {
      it('should route multiple events', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        bulkRouteEvents(['evt1', 'evt2', 'evt3'], 'finance-agent');

        expect(mockRun).toHaveBeenCalledTimes(3);
      });
    });

    describe('bulkDismissEvents', () => {
      it('should dismiss multiple events', () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        bulkDismissEvents(['evt1', 'evt2']);

        expect(mockRun).toHaveBeenCalledTimes(2);
      });
    });

    describe('bulkEnrichEvents', () => {
      it('should mark events as needing review', async () => {
        mockAll.mockReturnValueOnce([]); // For migration check

        const result = await bulkEnrichEvents(['evt1', 'evt2']);

        expect(result).toEqual([
          { id: 'evt1', enriched: true },
          { id: 'evt2', enriched: true },
        ]);
        expect(mockRun).toHaveBeenCalledTimes(2);
      });

      it('should return empty array when db unavailable', async () => {
        mockDbAvailable = false;
        const result = await bulkEnrichEvents(['evt1']);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null metadata gracefully', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          metadata: null,
        },
      ];

      upsertEvents(events);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: null,
        })
      );
    });

    it('should handle invalid JSON metadata on read', () => {
      mockAll.mockReturnValueOnce([]); // For migration check
      mockAll.mockReturnValueOnce([
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          metadata: 'not valid json',
        },
      ]);

      const events = listRecentEvents();

      // Should not throw, metadata should be null
      expect(events[0].metadata).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const events: EventRow[] = [
        {
          id: 'evt1',
          source: 'gmail',
          channel: 'email',
          ts: 1704067200,
          // No subject, preview, direction, contact
        },
      ];

      upsertEvents(events);

      expect(mockRun).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: null,
          preview: null,
          direction: null,
          contact: null,
        })
      );
    });
  });
});
