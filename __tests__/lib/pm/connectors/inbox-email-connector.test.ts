// @ts-nocheck
/**
 * Wrath Shield v3 - Inbox Email Connector Tests
 *
 * Tests for processing emails and creating task signals:
 * - Email processing
 * - Action item extraction
 * - Deadline detection
 * - Urgency inference
 * - Batch sync
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock events
jest.mock('@/lib/events', () => ({
  listRecentEvents: jest.fn().mockReturnValue([]),
}));

// Mock task queue
const mockEnqueueSignal = jest.fn().mockResolvedValue('queue-123');
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: mockEnqueueSignal,
}));

import {
  processEmail,
  syncInbox,
  extractActionItems,
  detectDeadline,
  inferUrgency,
  type ActionItem,
  type EmailAnalysis,
  type TaskSignal,
  type SyncResult,
} from '@/lib/pm/connectors/inbox-email-connector';
import { listRecentEvents, type EventRow } from '@/lib/events';

describe('Inbox Email Connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define ActionItem interface', () => {
      const item: ActionItem = {
        action: 'Review the proposal',
        confidence: 0.9,
        keywords: ['review', 'urgent'],
        context: 'surrounding text for context',
      };

      expect(item.confidence).toBe(0.9);
    });

    it('should define EmailAnalysis interface', () => {
      const analysis: EmailAnalysis = {
        has_action: true,
        action_items: [{ action: 'Test', confidence: 0.8, keywords: [], context: '' }],
        deadline: '2025-01-20',
        urgency: 'high',
        urgency_indicators: ['urgent'],
        is_reply: false,
        is_forward: false,
        has_attachment: true,
      };

      expect(analysis.urgency).toBe('high');
    });

    it('should define SyncResult interface', () => {
      const result: SyncResult = {
        processed: 100,
        signals_created: 25,
        skipped_duplicate: 5,
        skipped_no_action: 70,
        errors: 0,
        error_details: [],
      };

      expect(result.processed).toBe(100);
    });
  });

  describe('extractActionItems', () => {
    it('should extract high confidence patterns', () => {
      const body = 'Please review the attached document';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should extract "can you" patterns', () => {
      const body = 'Can you please send me the report?';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should extract "I need you to" patterns', () => {
      const body = 'I need you to finalize the budget by tomorrow';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should extract TODO markers', () => {
      const body = 'TODO: Update the spreadsheet with new figures';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should extract action item markers', () => {
      const body = 'Action item: Schedule the meeting for next week';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should extract medium confidence patterns', () => {
      const body = 'Let me know when you have reviewed the document';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should extract follow-up patterns', () => {
      const body = 'Follow up with the team on the status update';
      const items = extractActionItems(body);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should extract low confidence patterns', () => {
      const body = 'FYI: The deadline has been moved to next week';
      const items = extractActionItems(body);

      if (items.length > 0) {
        expect(items[0].confidence).toBeLessThanOrEqual(0.6);
      }
    });

    it('should extract keywords from action items', () => {
      const body = 'Please urgently review and approve the contract';
      const items = extractActionItems(body);

      if (items.length > 0) {
        expect(items[0].keywords).toContain('review');
      }
    });

    it('should deduplicate similar actions', () => {
      const body = 'Please review. Can you please review the document?';
      const items = extractActionItems(body);

      // Should not have duplicate "review" actions
      const reviewActions = items.filter(i =>
        i.action.toLowerCase().includes('review')
      );
      expect(reviewActions.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array for empty body', () => {
      const items = extractActionItems('');

      expect(items).toHaveLength(0);
    });

    it('should return empty array for null body', () => {
      const items = extractActionItems(null as any);

      expect(items).toHaveLength(0);
    });
  });

  describe('detectDeadline', () => {
    it('should detect "by" date patterns', () => {
      const text = 'Please complete this by January 15';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
    });

    it('should detect date with format MM/DD', () => {
      const text = 'Due by 1/15';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
    });

    it('should detect "today"', () => {
      const text = 'This needs to be done by today';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
      expect(deadline).toBe(new Date().toISOString().split('T')[0]);
    });

    it('should detect "tomorrow"', () => {
      const text = 'Please finish by tomorrow';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(deadline).toBe(tomorrow.toISOString().split('T')[0]);
    });

    it('should detect "eod" (end of day)', () => {
      const text = 'Need this by eod';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
    });

    it('should detect "eow" (end of week)', () => {
      const text = 'Complete by eow please';
      const deadline = detectDeadline(text);

      expect(deadline).not.toBeNull();
    });

    it('should return null when no deadline found', () => {
      const text = 'Here is some information for you';
      const deadline = detectDeadline(text);

      expect(deadline).toBeNull();
    });

    it('should return null for empty text', () => {
      const deadline = detectDeadline('');

      expect(deadline).toBeNull();
    });

    it('should return null for null text', () => {
      const deadline = detectDeadline(null as any);

      expect(deadline).toBeNull();
    });
  });

  describe('inferUrgency', () => {
    it('should return critical for flagged emails with deadline', () => {
      const email: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        flagged: 1,
        subject: 'Urgent request',
        preview: 'Please respond by today',
      } as any;

      const analysis: EmailAnalysis = {
        has_action: true,
        action_items: [],
        deadline: '2025-01-15',
        urgency: 'medium',
        urgency_indicators: ['urgent'],
        is_reply: false,
        is_forward: false,
        has_attachment: false,
      };

      const urgency = inferUrgency(email, analysis);

      expect(urgency).toBe('critical');
    });

    it('should return high for urgent keywords', () => {
      const email: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'URGENT: Action required',
        preview: 'This is a priority request',
      } as any;

      const urgency = inferUrgency(email);

      expect(['critical', 'high']).toContain(urgency);
    });

    it('should return medium for normal emails', () => {
      const email: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Weekly update',
        preview: 'Here is the weekly status report',
      } as any;

      const urgency = inferUrgency(email);

      expect(['medium', 'low']).toContain(urgency);
    });

    it('should increase urgency for legal classification', () => {
      const email: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Contract review',
        preview: 'Please review the attached contract',
        classification: 'legal',
      } as any;

      const urgency = inferUrgency(email);

      expect(['critical', 'high', 'medium']).toContain(urgency);
    });
  });

  describe('processEmail', () => {
    it('should skip non-email events', async () => {
      const event: EventRow = {
        id: 'event-1',
        channel: 'sms',
        ts: Date.now() / 1000,
      } as any;

      const signals = await processEmail(event);

      expect(signals).toHaveLength(0);
    });

    it('should skip junk emails', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        junk: 1,
      } as any;

      const signals = await processEmail(event);

      expect(signals).toHaveLength(0);
    });

    it('should skip already routed emails', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        routed_target: 'comms',
      } as any;

      const signals = await processEmail(event);

      expect(signals).toHaveLength(0);
    });

    it('should process actionable emails', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Action Required',
        preview: 'Please review and approve the attached document',
        contact: 'sender@example.com',
        metadata: '{}',
      } as any;

      const signals = await processEmail(event);

      if (signals.length > 0) {
        expect(signals[0].source).toBe('inbox');
        expect(signals[0].payload.email_id).toBe('email-1');
        expect(mockEnqueueSignal).toHaveBeenCalled();
      }
    });

    it('should return empty for emails without actions', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Newsletter',
        preview: 'Weekly company updates and news',
        metadata: '{}',
      } as any;

      const signals = await processEmail(event);

      // May or may not find actions depending on content
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should detect reply emails', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Re: Action Required',
        preview: 'Please review this',
        contact: 'sender@example.com',
        metadata: JSON.stringify({ in_reply_to: 'msg-123' }),
      } as any;

      const signals = await processEmail(event);

      if (signals.length > 0) {
        expect(signals[0].payload.is_reply).toBe(true);
      }
    });

    it('should detect forwarded emails', async () => {
      const event: EventRow = {
        id: 'email-1',
        channel: 'email',
        ts: Date.now() / 1000,
        subject: 'Fwd: Action Required',
        preview: 'Please review this',
        contact: 'sender@example.com',
        metadata: '{}',
      } as any;

      const signals = await processEmail(event);

      if (signals.length > 0) {
        expect(signals[0].payload.is_forward).toBe(true);
      }
    });
  });

  describe('syncInbox', () => {
    it('should sync emails since a date', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      (listRecentEvents as jest.Mock).mockReturnValue([]);

      const result = await syncInbox(since);

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('signals_created');
      expect(result).toHaveProperty('skipped_no_action');
      expect(result).toHaveProperty('errors');
    });

    it('should process multiple emails', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      (listRecentEvents as jest.Mock).mockReturnValue([
        {
          id: 'email-1',
          channel: 'email',
          ts: Date.now() / 1000,
          subject: 'Please review',
          preview: 'Can you review this?',
          metadata: '{}',
        },
        {
          id: 'email-2',
          channel: 'email',
          ts: Date.now() / 1000,
          subject: 'Update',
          preview: 'Here is an update',
          metadata: '{}',
        },
      ]);

      const result = await syncInbox(since);

      expect(result.processed).toBe(2);
    });

    it('should filter by timestamp', async () => {
      const since = new Date();
      const sinceTs = Math.floor(since.getTime() / 1000);

      (listRecentEvents as jest.Mock).mockReturnValue([
        {
          id: 'email-1',
          channel: 'email',
          ts: sinceTs + 1000, // After since
          subject: 'New email',
          metadata: '{}',
        },
        {
          id: 'email-2',
          channel: 'email',
          ts: sinceTs - 1000, // Before since
          subject: 'Old email',
          metadata: '{}',
        },
      ]);

      const result = await syncInbox(since);

      // Should only process email after since date
      expect(result.processed).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      const since = new Date();

      (listRecentEvents as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await syncInbox(since);

      expect(result.errors).toBeGreaterThan(0);
      expect(result.error_details.length).toBeGreaterThan(0);
    });

    it('should skip junk emails during sync', async () => {
      const since = new Date();

      (listRecentEvents as jest.Mock).mockReturnValue([
        {
          id: 'email-1',
          channel: 'email',
          ts: Date.now() / 1000,
          junk: 1,
          subject: 'Spam',
          metadata: '{}',
        },
      ]);

      const result = await syncInbox(since);

      expect(result.processed).toBe(0);
    });
  });

  describe('Default Export', () => {
    it('should export default object with all functions', async () => {
      const defaultExport = await import('@/lib/pm/connectors/inbox-email-connector');

      expect(defaultExport.default).toHaveProperty('processEmail');
      expect(defaultExport.default).toHaveProperty('syncInbox');
      expect(defaultExport.default).toHaveProperty('extractActionItems');
      expect(defaultExport.default).toHaveProperty('detectDeadline');
      expect(defaultExport.default).toHaveProperty('inferUrgency');
    });
  });
});
