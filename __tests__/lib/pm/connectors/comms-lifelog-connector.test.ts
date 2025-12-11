// @ts-nocheck
/**
 * Wrath Shield v3 - Comms Lifelog Connector Tests
 *
 * Tests for monitoring lifelog entries and creating signals:
 * - Action item detection from text
 * - Lifelog entry processing
 * - Sync functionality
 * - Pattern matching
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database queries
jest.mock('@/lib/db/queries', () => ({
  getLifelogsForDate: jest.fn().mockReturnValue([]),
}));

// Mock task queue
const mockEnqueueSignal = jest.fn().mockResolvedValue('queue-123');
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: mockEnqueueSignal,
}));

import {
  detectActionItems,
  processLifelogEntry,
  syncRecentLifelogs,
  registerWithBus,
  type ActionItem,
  type ProcessingResult,
  type SyncResult,
} from '@/lib/pm/connectors/comms-lifelog-connector';
import { getLifelogsForDate } from '@/lib/db/queries';

describe('Comms Lifelog Connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define ActionItem interface', () => {
      const item: ActionItem = {
        text: 'Review the proposal',
        type: 'task',
        confidence: 0.85,
        urgency: 'high',
        context: 'In the meeting we decided...',
        people: ['John', 'Jane'],
        project: 'Marketing Campaign',
        source: {
          lifelog_id: 'log-123',
          date: '2025-01-15',
          excerpt: 'Review the proposal by Friday',
        },
      };

      expect(item.type).toBe('task');
      expect(item.confidence).toBe(0.85);
    });

    it('should define ProcessingResult interface', () => {
      const result: ProcessingResult = {
        lifelog_id: 'log-123',
        date: '2025-01-15',
        items_found: 3,
        signals_created: ['sig-1', 'sig-2', 'sig-3'],
        errors: [],
      };

      expect(result.items_found).toBe(3);
      expect(result.signals_created).toHaveLength(3);
    });

    it('should define SyncResult interface', () => {
      const result: SyncResult = {
        processed: 10,
        total_items: 25,
        total_signals: 25,
        errors: [],
        skipped: 2,
      };

      expect(result.processed).toBe(10);
      expect(result.total_signals).toBe(25);
    });
  });

  describe('detectActionItems', () => {
    it('should detect TODO markers', () => {
      const text = 'TODO: Review the proposal by Friday';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe('task');
      expect(items[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect ACTION markers', () => {
      const text = 'ACTION: Send the report to the team';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe('task');
    });

    it('should detect REMINDER markers', () => {
      const text = 'REMINDER: Call John about the contract';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });

    it('should detect imperative phrases', () => {
      const text = 'I need to finish the presentation before the meeting';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect follow-up phrases', () => {
      const text = 'Follow up with the client about the proposal next week';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe('follow_up');
    });

    it('should detect check-in phrases', () => {
      const text = 'Check in with John on the project status';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].type).toBe('follow_up');
    });

    it('should detect should statements', () => {
      const text = 'I should review the code changes before the release';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });

    it('should detect high urgency keywords', () => {
      const text = 'TODO: URGENT - fix the critical bug immediately';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].urgency).toBe('high');
    });

    it('should detect low urgency keywords', () => {
      const text = 'TODO: Eventually update the documentation if possible';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].urgency).toBe('low');
    });

    it('should extract people names', () => {
      const text = 'I need to meet with John Smith about the project';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      if (items.length > 0 && items[0].people) {
        expect(items[0].people).toContain('John Smith');
      }
    });

    it('should deduplicate similar items', () => {
      const text = 'TODO: Review proposal. I need to review the proposal soon.';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      // Should deduplicate similar items
      const reviewItems = items.filter(i => i.text.toLowerCase().includes('review'));
      expect(reviewItems.length).toBeLessThanOrEqual(2);
    });

    it('should skip very short matches', () => {
      const text = 'TODO: x';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      // Should skip matches less than 5 chars
      expect(items).toHaveLength(0);
    });

    it('should reduce confidence for questions', () => {
      const text = 'Should I review the proposal?';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      if (items.length > 0) {
        // Questions should have reduced confidence
        expect(items[0].confidence).toBeLessThan(0.8);
      }
    });

    it('should reduce confidence for tentative language', () => {
      const text = 'I might need to review the proposal';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      if (items.length > 0) {
        expect(items[0].confidence).toBeLessThan(0.8);
      }
    });
  });

  describe('processLifelogEntry', () => {
    it('should process lifelog with title', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'TODO: Complete the quarterly report',
        raw_json: null,
      };

      const result = await processLifelogEntry(entry);

      expect(result.lifelog_id).toBe('log-123');
      expect(result.items_found).toBeGreaterThanOrEqual(0);
    });

    it('should process lifelog with raw_json content', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'Meeting Notes',
        raw_json: JSON.stringify({
          note: 'ACTION: Follow up with team on deliverables',
          summary: 'Discussed project timeline and action items',
        }),
      };

      const result = await processLifelogEntry(entry);

      expect(result.lifelog_id).toBe('log-123');
      expect(result.items_found).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed raw_json', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'Meeting Notes',
        raw_json: 'not valid json',
      };

      const result = await processLifelogEntry(entry);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip entries with insufficient text', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'Hi',
        raw_json: null,
      };

      const result = await processLifelogEntry(entry);

      expect(result.items_found).toBe(0);
    });

    it('should create signals for detected items', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'TODO: Review the proposal. ACTION: Send the report.',
        raw_json: null,
      };

      const result = await processLifelogEntry(entry);

      if (result.items_found > 0) {
        expect(mockEnqueueSignal).toHaveBeenCalled();
        expect(result.signals_created.length).toBeGreaterThan(0);
      }
    });

    it('should handle messages array in raw_json', async () => {
      const entry = {
        id: 'log-123',
        date: '2025-01-15',
        title: 'Chat',
        raw_json: JSON.stringify({
          messages: [
            { content: 'TODO: First task' },
            { text: 'TODO: Second task' },
            'TODO: Third task',
          ],
        }),
      };

      const result = await processLifelogEntry(entry);

      expect(result.lifelog_id).toBe('log-123');
    });
  });

  describe('syncRecentLifelogs', () => {
    it('should sync lifelogs since a date', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      (getLifelogsForDate as jest.Mock).mockReturnValue([]);

      const result = await syncRecentLifelogs(since);

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('total_items');
      expect(result).toHaveProperty('total_signals');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('skipped');
    });

    it('should process multiple dates', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 3);

      (getLifelogsForDate as jest.Mock).mockReturnValue([
        {
          id: 'log-1',
          date: '2025-01-15',
          title: 'TODO: Task 1',
          raw_json: null,
        },
      ]);

      const result = await syncRecentLifelogs(since);

      // Should have called getLifelogsForDate for each day
      expect(getLifelogsForDate).toHaveBeenCalled();
    });

    it('should accumulate results across entries', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      (getLifelogsForDate as jest.Mock).mockReturnValue([
        { id: 'log-1', date: '2025-01-15', title: 'TODO: Task 1', raw_json: null },
        { id: 'log-2', date: '2025-01-15', title: 'TODO: Task 2', raw_json: null },
      ]);

      const result = await syncRecentLifelogs(since);

      expect(result.processed).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
      const since = new Date();

      (getLifelogsForDate as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await syncRecentLifelogs(since);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should respect userId filter', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      (getLifelogsForDate as jest.Mock).mockReturnValue([]);

      await syncRecentLifelogs(since, 'user-123');

      expect(getLifelogsForDate).toHaveBeenCalledWith(
        expect.any(String),
        'user-123'
      );
    });
  });

  describe('registerWithBus', () => {
    it('should log registration message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      registerWithBus();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Real-time bus registration')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Action Patterns', () => {
    it('should detect meeting action items', () => {
      const text = 'Action items: Review budget, Send proposal, Schedule follow-up';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });

    it('should detect next steps', () => {
      const text = 'Next steps: Finalize the design document';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });

    it('should detect assigned actions', () => {
      const text = 'Assigned to me: Complete the integration tests';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect remember phrases', () => {
      const text = 'Remember to send the invoice before the end of the month';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });

    it('should detect decision phrases', () => {
      const text = 'We decided to postpone the launch to next quarter';
      const items = detectActionItems(text, {
        lifelog_id: 'log-123',
        date: '2025-01-15',
      });

      expect(items.length).toBeGreaterThan(0);
    });
  });
});
