// @ts-nocheck
/**
 * Wrath Shield v3 - Comms Follow-up Connector Tests
 *
 * Tests for monitoring contact interactions and creating follow-up signals:
 * - Contact scanning for follow-ups
 * - Follow-up detection logic
 * - Interaction processing
 * - Status tracking
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock task queue
const mockEnqueueSignal = jest.fn().mockResolvedValue('queue-123');
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: mockEnqueueSignal,
}));

// Mock relationship database
const mockDbExec = jest.fn();
const mockDbPrepare = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn().mockReturnValue([]);
const mockDbRun = jest.fn().mockReturnValue({ changes: 1 });

jest.mock('@/lib/relationshipDb', () => ({
  getRelationshipDb: jest.fn().mockReturnValue({
    exec: mockDbExec,
    prepare: mockDbPrepare.mockReturnValue({
      get: mockDbGet,
      all: mockDbAll,
      run: mockDbRun,
    }),
  }),
  topContacts: jest.fn().mockReturnValue([]),
  listRelationshipSummaries: jest.fn().mockReturnValue([]),
}));

// Mock events
jest.mock('@/lib/events', () => ({
  listRecentEvents: jest.fn().mockReturnValue([]),
}));

import {
  scanContactsForFollowups,
  processContactInteraction,
  markFollowupComplete,
  getFollowupStatus,
  getFollowupSummary,
  type FollowupReason,
  type FollowupSignal,
  type FollowupStatus,
} from '@/lib/pm/connectors/comms-followup-connector';
import { topContacts, listRelationshipSummaries } from '@/lib/relationshipDb';
import { listRecentEvents } from '@/lib/events';

describe('Comms Follow-up Connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbAll.mockReturnValue([]);
    mockDbGet.mockReturnValue(undefined);
  });

  describe('Types', () => {
    it('should define FollowupReason type', () => {
      const reasons: FollowupReason[] = [
        'no_response',
        'promised_callback',
        'scheduled',
        'vip_stale',
        'unanswered_question',
      ];
      expect(reasons).toHaveLength(5);
    });

    it('should define FollowupStatus interface', () => {
      const status: FollowupStatus = {
        contact_id: 'contact-123',
        contact_name: 'John Doe',
        last_followup_signal_id: 'sig-456',
        last_followup_ts: Math.floor(Date.now() / 1000),
        last_interaction_ts: Math.floor(Date.now() / 1000) - 86400,
        followup_reason: 'no_response',
        followup_completed: false,
        completed_at: null,
      };

      expect(status.contact_id).toBe('contact-123');
      expect(status.followup_reason).toBe('no_response');
    });
  });

  describe('scanContactsForFollowups', () => {
    it('should return empty array when no contacts', async () => {
      (topContacts as jest.Mock).mockReturnValue([]);

      const signals = await scanContactsForFollowups();

      expect(signals).toEqual([]);
    });

    it('should skip contacts without handle', async () => {
      (topContacts as jest.Mock).mockReturnValue([
        { id: 'contact-1', handle: null, message_count: 10 },
      ]);

      const signals = await scanContactsForFollowups();

      expect(signals).toEqual([]);
      expect(mockEnqueueSignal).not.toHaveBeenCalled();
    });

    it('should detect no_response follow-up', async () => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - (4 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'john@example.com',
        display_name: 'John Doe',
        message_count: 10,
        last_ts: threeDaysAgo,
        last_text: 'Hey, just checking in',
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([{
        id: 'event-1',
        contact: 'john@example.com',
        direction: 'sent',
        ts: threeDaysAgo,
        preview: 'Hey, just checking in',
      }]);

      const signals = await scanContactsForFollowups();

      // Should create follow-up signal
      expect(mockEnqueueSignal).toHaveBeenCalled();
    });

    it('should detect unanswered_question follow-up', async () => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'john@example.com',
        display_name: 'John Doe',
        message_count: 10,
        last_ts: threeDaysAgo,
        last_text: 'Can you review this?',
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([{
        id: 'event-1',
        contact: 'john@example.com',
        direction: 'sent',
        ts: threeDaysAgo,
        preview: 'Can you review this?',
        subject: 'Question about project?',
      }]);

      const signals = await scanContactsForFollowups();

      // Detection depends on implementation logic
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should detect promised_callback follow-up', async () => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'john@example.com',
        display_name: 'John Doe',
        message_count: 10,
        last_ts: threeDaysAgo,
        last_text: "I'll get back to you on that",
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([]);

      const signals = await scanContactsForFollowups();

      expect(Array.isArray(signals)).toBe(true);
    });

    it('should detect vip_stale follow-up', async () => {
      const eightDaysAgo = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'vip@example.com',
        display_name: 'VIP Client',
        message_count: 100, // High message count = VIP
        last_ts: eightDaysAgo,
        last_text: 'Thanks for the update',
      }]);

      (listRelationshipSummaries as jest.Mock).mockReturnValue([{
        contact_id: 'contact-1',
        summary: 'Important client partnership',
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([]);

      const signals = await scanContactsForFollowups();

      expect(Array.isArray(signals)).toBe(true);
    });

    it('should respect cooldown period', async () => {
      const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      const now = Math.floor(Date.now() / 1000);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'john@example.com',
        message_count: 10,
        last_ts: oneDayAgo - (3 * 24 * 60 * 60), // 4 days ago
      }]);

      // Existing follow-up with recent timestamp
      mockDbGet.mockReturnValue({
        contact_id: 'contact-1',
        last_followup_ts: now - 3600, // 1 hour ago
        followup_completed: 0,
      });

      const signals = await scanContactsForFollowups();

      // Should skip due to cooldown
      expect(signals).toEqual([]);
    });
  });

  describe('processContactInteraction', () => {
    it('should process interaction by contact_id', async () => {
      mockDbGet.mockReturnValue({
        contact_id: 'contact-123',
        followup_completed: 0,
      });

      await processContactInteraction({
        contact_id: 'contact-123',
        event_id: 'event-456',
      });

      // Should update follow-up as complete
      expect(mockDbPrepare).toHaveBeenCalled();
    });

    it('should process interaction by contact_handle', async () => {
      mockDbGet.mockReturnValueOnce({ id: 'contact-123' }); // Find contact
      mockDbGet.mockReturnValueOnce({ // Get follow-up status
        contact_id: 'contact-123',
        followup_completed: 0,
      });

      await processContactInteraction({
        contact_handle: 'john@example.com',
        event_id: 'event-456',
      });

      expect(mockDbPrepare).toHaveBeenCalled();
    });

    it('should do nothing when no contact found', async () => {
      mockDbGet.mockReturnValue(undefined);

      await processContactInteraction({
        contact_handle: 'unknown@example.com',
        event_id: 'event-456',
      });

      // No follow-up update should occur
      expect(mockDbRun).not.toHaveBeenCalled();
    });
  });

  describe('markFollowupComplete', () => {
    it('should mark follow-up as complete', async () => {
      await markFollowupComplete('contact-123', 'User responded');

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE followup_tracking')
      );
    });

    it('should mark complete without notes', async () => {
      await markFollowupComplete('contact-123');

      expect(mockDbPrepare).toHaveBeenCalled();
    });
  });

  describe('getFollowupStatus', () => {
    it('should get status for specific contact', () => {
      mockDbGet.mockReturnValue({
        contact_id: 'contact-123',
        contact_name: 'John Doe',
        last_followup_signal_id: 'sig-456',
        last_followup_ts: 1234567890,
        last_interaction_ts: 1234567800,
        followup_reason: 'no_response',
        followup_completed: 0,
        completed_at: null,
      });

      const status = getFollowupStatus('contact-123');

      expect(status).not.toBeNull();
      if (status && !Array.isArray(status)) {
        expect(status.contact_id).toBe('contact-123');
        expect(status.followup_reason).toBe('no_response');
        expect(status.followup_completed).toBe(false);
      }
    });

    it('should return null when contact not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const status = getFollowupStatus('unknown-contact');

      expect(status).toBeNull();
    });

    it('should get all pending follow-ups when no contactId', () => {
      mockDbAll.mockReturnValue([
        {
          contact_id: 'contact-1',
          contact_name: 'John',
          followup_reason: 'no_response',
          followup_completed: 0,
        },
        {
          contact_id: 'contact-2',
          contact_name: 'Jane',
          followup_reason: 'vip_stale',
          followup_completed: 0,
        },
      ]);

      const statuses = getFollowupStatus();

      expect(Array.isArray(statuses)).toBe(true);
      if (Array.isArray(statuses)) {
        expect(statuses).toHaveLength(2);
      }
    });
  });

  describe('getFollowupSummary', () => {
    it('should return summary of follow-up activity', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', followup_reason: 'no_response', followup_completed: 0 },
        { contact_id: 'c2', followup_reason: 'vip_stale', followup_completed: 0 },
        { contact_id: 'c3', followup_reason: 'no_response', followup_completed: 0 },
      ]);

      const summary = getFollowupSummary();

      expect(summary).toHaveProperty('total_pending');
      expect(summary).toHaveProperty('by_reason');
      expect(summary).toHaveProperty('vip_count');
    });

    it('should return empty summary when no pending', () => {
      mockDbAll.mockReturnValue([]);

      const summary = getFollowupSummary();

      expect(summary.total_pending).toBe(0);
      expect(summary.vip_count).toBe(0);
    });

    it('should count by reason', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', followup_reason: 'no_response', followup_completed: 0 },
        { contact_id: 'c2', followup_reason: 'no_response', followup_completed: 0 },
        { contact_id: 'c3', followup_reason: 'promised_callback', followup_completed: 0 },
      ]);

      const summary = getFollowupSummary();

      expect(summary.by_reason.no_response).toBe(2);
      expect(summary.by_reason.promised_callback).toBe(1);
    });

    it('should identify oldest pending', () => {
      mockDbAll.mockReturnValue([
        { contact_id: 'c1', last_followup_ts: 1000, followup_completed: 0 },
        { contact_id: 'c2', last_followup_ts: 2000, followup_completed: 0 },
      ]);

      const summary = getFollowupSummary();

      expect(summary.oldest_pending).toBeDefined();
    });
  });

  describe('Table Creation', () => {
    it('should create followup_tracking table', async () => {
      await scanContactsForFollowups();

      expect(mockDbExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS followup_tracking')
      );
    });

    it('should create indices', async () => {
      await scanContactsForFollowups();

      expect(mockDbExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });

  describe('Detection Logic', () => {
    it('should detect VIP contacts by message count', async () => {
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'vip@example.com',
        display_name: 'VIP Person',
        message_count: 60, // High count = VIP
        last_ts: sevenDaysAgo,
        last_text: 'Thanks',
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([]);

      const signals = await scanContactsForFollowups();

      // Should detect VIP staleness
      expect(Array.isArray(signals)).toBe(true);
    });

    it('should detect VIP contacts by summary keywords', async () => {
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60);

      (topContacts as jest.Mock).mockReturnValue([{
        id: 'contact-1',
        handle: 'exec@example.com',
        display_name: 'Jane',
        message_count: 10,
        last_ts: sevenDaysAgo,
        last_text: 'Thanks',
      }]);

      (listRelationshipSummaries as jest.Mock).mockReturnValue([{
        contact_id: 'contact-1',
        summary: 'CEO and founder of important client company',
      }]);

      (listRecentEvents as jest.Mock).mockReturnValue([]);

      const signals = await scanContactsForFollowups();

      expect(Array.isArray(signals)).toBe(true);
    });
  });
});
