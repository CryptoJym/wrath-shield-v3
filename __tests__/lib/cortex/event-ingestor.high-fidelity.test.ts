// @ts-nocheck
/**
 * Event Ingestor - High Fidelity Tests
 *
 * Tests the actual ingestEmail, ingestIMessage, ingestLimitless, and ingestCalendar
 * functions with real working memory operations.
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import { resetWorkingMemory, getWorkingMemory } from '../../../lib/cortex/working-memory';
import {
  ingestEmail,
  ingestIMessage,
  ingestLimitless,
  ingestCalendar,
  getIngestionStats,
  type EmailInput,
  type IMessageInput,
  type LimitlessInput,
  type CalendarInput,
} from '../../../lib/cortex/event-ingestor';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock entity extraction to avoid LLM calls
jest.mock('../../../lib/cortex/entity-extractor', () => ({
  extractEntities: jest.fn().mockResolvedValue({ entities: [], relations: [] }),
}));

describe('Event Ingestor - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-event-ingestor');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Reset singletons
    Database.resetInstance();
    resetWorkingMemory();

    // Initialize Database singleton with test path
    Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);
  });

  afterEach(() => {
    resetWorkingMemory();
    Database.resetInstance();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Email Ingestion', () => {
    it('should add event to working memory', async () => {
      const email: EmailInput = {
        from: 'test@example.com',
        to: 'me@example.com',
        subject: 'Test Email',
        body: 'This is a test email body.',
        timestamp: new Date().toISOString(),
        messageId: 'msg-123',
      };

      const result = await ingestEmail(email);

      expect(result.eventId).not.toBeNull();
      expect(result.duplicate).toBe(false);

      // Verify event is in working memory
      const wm = getWorkingMemory();
      const events = await wm.getByIds([result.eventId!]);
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('email');
    });

    it('should classify URGENT as critical', async () => {
      const email: EmailInput = {
        from: 'boss@company.com',
        subject: 'URGENT: Need response now',
        body: 'Please respond immediately.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.urgency).toBe('critical');
      expect(result.classification.isCritical).toBe(true);
      expect(result.fastPathed).toBe(true);
    });

    it('should classify ASAP as critical', async () => {
      const email: EmailInput = {
        from: 'manager@company.com',
        subject: 'Need this ASAP',
        body: 'Please handle this as soon as possible.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.urgency).toBe('critical');
      expect(result.classification.isCritical).toBe(true);
    });

    it('should classify "deadline today" as critical', async () => {
      const email: EmailInput = {
        from: 'pm@company.com',
        subject: 'Project Status',
        body: 'Reminder: the deadline is today for the report.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.urgency).toBe('critical');
    });

    it('should detect legal domain from content', async () => {
      const email: EmailInput = {
        from: 'lawyer@lawfirm.com',
        subject: 'Case Update',
        body: 'The court date has been scheduled. Please review the lawsuit documents.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.domain).toBe('legal');
    });

    it('should detect business domain from "Utlyze"', async () => {
      const email: EmailInput = {
        from: 'client@utlyze.com',
        subject: 'Project Discussion',
        body: 'Let\'s discuss the Utlyze project requirements.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.domain).toBe('business');
    });

    it('should detect personal domain from "family"', async () => {
      const email: EmailInput = {
        from: 'mom@gmail.com',
        subject: 'Family Dinner',
        body: 'The family reunion is next week at home.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.domain).toBe('personal');
    });

    it('should extract keywords: meeting, deadline, invoice', async () => {
      const email: EmailInput = {
        from: 'finance@company.com',
        subject: 'Meeting about Invoice',
        body: 'We need to discuss the invoice deadline in our meeting.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(email);

      expect(result.classification.keywords).toBeDefined();
      expect(result.classification.keywords).toContain('meeting');
      expect(result.classification.keywords).toContain('deadline');
      expect(result.classification.keywords).toContain('invoice');
    });

    it('should return duplicate=true for same content', async () => {
      const email: EmailInput = {
        from: 'test@example.com',
        subject: 'Duplicate Test',
        body: 'This is a duplicate test.',
        timestamp: new Date().toISOString(),
      };

      const first = await ingestEmail(email);
      const second = await ingestEmail(email);

      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
      expect(second.eventId).toBeNull();
    });

    it('should use messageId for deduplication tracking', async () => {
      const email: EmailInput = {
        from: 'test@example.com',
        subject: 'Message ID Test',
        body: 'Testing message ID.',
        timestamp: new Date().toISOString(),
        messageId: 'unique-msg-id-456',
      };

      const result = await ingestEmail(email);

      const wm = getWorkingMemory();
      const events = await wm.getByIds([result.eventId!]);
      expect(events[0].metadata?.messageId).toBe('unique-msg-id-456');
    });
  });

  describe('iMessage Ingestion', () => {
    it('should classify "911" as critical', async () => {
      const message: IMessageInput = {
        contact: 'Friend',
        content: '911 emergency!',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestIMessage(message);

      expect(result.classification.urgency).toBe('critical');
      expect(result.classification.isCritical).toBe(true);
      expect(result.fastPathed).toBe(true);
    });

    it('should classify "help!" as critical', async () => {
      const message: IMessageInput = {
        contact: 'Friend',
        content: 'Help! I need assistance now!',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestIMessage(message);

      expect(result.classification.urgency).toBe('critical');
    });

    it('should track message direction', async () => {
      const receivedMessage: IMessageInput = {
        contact: 'Friend',
        content: 'Hey there!',
        timestamp: new Date().toISOString(),
        direction: 'received',
      };

      const sentMessage: IMessageInput = {
        contact: 'Friend',
        content: 'Hi back!',
        timestamp: new Date().toISOString(),
        direction: 'sent',
      };

      const receivedResult = await ingestIMessage(receivedMessage);
      const sentResult = await ingestIMessage(sentMessage);

      const wm = getWorkingMemory();
      const receivedEvents = await wm.getByIds([receivedResult.eventId!]);
      const sentEvents = await wm.getByIds([sentResult.eventId!]);

      expect(receivedEvents[0].metadata?.direction).toBe('received');
      expect(sentEvents[0].metadata?.direction).toBe('sent');
    });

    it('should use messageId for deduplication', async () => {
      const message: IMessageInput = {
        contact: 'Friend',
        content: 'Dedup test',
        timestamp: new Date().toISOString(),
        messageId: 'imsg-unique-123',
      };

      const result = await ingestIMessage(message);

      const wm = getWorkingMemory();
      const events = await wm.getByIds([result.eventId!]);
      expect(events[0].metadata?.messageId).toBe('imsg-unique-123');
    });

    it('should extract keywords like meeting and call', async () => {
      const message: IMessageInput = {
        contact: 'Colleague',
        content: 'Can we have a meeting? I have a question and maybe do a call?',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestIMessage(message);

      expect(result.classification.keywords).toContain('meeting');
      expect(result.classification.keywords).toContain('call');
      expect(result.classification.keywords).toContain('question');
    });
  });

  describe('Limitless Ingestion', () => {
    it('should default to low urgency', async () => {
      const transcript: LimitlessInput = {
        summary: 'Casual conversation about the weather.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestLimitless(transcript);

      expect(result.classification.urgency).toBe('low');
      expect(result.classification.isCritical).toBe(false);
      expect(result.fastPathed).toBe(false);
    });

    it('should extract action items keyword', async () => {
      const transcript: LimitlessInput = {
        summary: 'Meeting notes with action items for the team.',
        transcript: 'We discussed several action items including the report deadline.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestLimitless(transcript);

      expect(result.classification.keywords).toContain('action-item');
    });

    it('should extract follow-ups keyword', async () => {
      const transcript: LimitlessInput = {
        summary: 'Need to follow up with the client.',
        transcript: 'Remember to follow up next week.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestLimitless(transcript);

      expect(result.classification.keywords).toContain('follow-up');
    });

    it('should use lifelogId for deduplication', async () => {
      const transcript: LimitlessInput = {
        summary: 'Test transcript',
        timestamp: new Date().toISOString(),
        lifelogId: 'lifelog-abc-123',
      };

      const result = await ingestLimitless(transcript);

      const wm = getWorkingMemory();
      const events = await wm.getByIds([result.eventId!]);
      expect(events[0].metadata?.lifelogId).toBe('lifelog-abc-123');
    });
  });

  describe('Calendar Ingestion', () => {
    it('should classify event in next hour as critical', async () => {
      const event: CalendarInput = {
        title: 'Important Meeting',
        time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      };

      const result = await ingestCalendar(event);

      expect(result.classification.urgency).toBe('critical');
      expect(result.classification.isCritical).toBe(true);
      expect(result.fastPathed).toBe(true);
    });

    it('should classify event 30 minutes ago as critical (just started)', async () => {
      const event: CalendarInput = {
        title: 'Ongoing Meeting',
        time: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago (within -30min window)
      };

      const result = await ingestCalendar(event);

      expect(result.classification.urgency).toBe('critical');
    });

    it('should classify event tomorrow as high', async () => {
      const event: CalendarInput = {
        title: 'Tomorrow Meeting',
        time: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), // 20 hours from now
      };

      const result = await ingestCalendar(event);

      expect(result.classification.urgency).toBe('high');
    });

    it('should classify event next week as medium/low', async () => {
      const event: CalendarInput = {
        title: 'Next Week Meeting',
        time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      };

      const result = await ingestCalendar(event);

      // Should be medium (within 72 hours) or low (beyond 72 hours)
      expect(['medium', 'low']).toContain(result.classification.urgency);
    });

    it('should extract meeting/presentation keywords', async () => {
      const event: CalendarInput = {
        title: 'Quarterly Presentation Meeting',
        time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          description: 'Important deadline presentation',
        },
      };

      const result = await ingestCalendar(event);

      expect(result.classification.keywords).toContain('meeting');
      expect(result.classification.keywords).toContain('presentation');
      expect(result.classification.keywords).toContain('deadline');
    });

    it('should use eventId for deduplication', async () => {
      const event: CalendarInput = {
        title: 'Recurring Meeting',
        time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        eventId: 'cal-event-xyz-789',
      };

      const result = await ingestCalendar(event);

      const wm = getWorkingMemory();
      const events = await wm.getByIds([result.eventId!]);
      expect(events[0].metadata?.eventId).toBe('cal-event-xyz-789');
    });
  });

  describe('Fast-Path Routing', () => {
    it('should set fastPathed=true for critical events', async () => {
      const urgentEmail: EmailInput = {
        from: 'boss@company.com',
        subject: 'URGENT: Critical issue',
        body: 'Please handle immediately.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(urgentEmail);

      expect(result.classification.isCritical).toBe(true);
      expect(result.fastPathed).toBe(true);
    });

    it('should set fastPathed=false for non-critical events', async () => {
      const normalEmail: EmailInput = {
        from: 'newsletter@company.com',
        subject: 'Weekly Newsletter',
        body: 'FYI - here are the weekly updates.',
        timestamp: new Date().toISOString(),
      };

      const result = await ingestEmail(normalEmail);

      expect(result.classification.isCritical).toBe(false);
      expect(result.fastPathed).toBe(false);
    });
  });

  describe('Ingestion Statistics', () => {
    it('should return accurate stats after ingestion', async () => {
      // Ingest various events
      await ingestEmail({
        from: 'test@example.com',
        subject: 'Email 1',
        body: 'Test',
        timestamp: new Date().toISOString(),
      });

      await ingestEmail({
        from: 'test2@example.com',
        subject: 'Email 2',
        body: 'Test 2',
        timestamp: new Date().toISOString(),
      });

      await ingestIMessage({
        contact: 'Friend',
        content: 'Hello!',
        timestamp: new Date().toISOString(),
      });

      const stats = await getIngestionStats();

      expect(stats.totalEvents).toBe(3);
      expect(stats.unprocessedEvents).toBe(3);
      expect(stats.eventsBySource.email).toBe(2);
      expect(stats.eventsBySource.imessage).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional fields gracefully', async () => {
      const minimalEmail: EmailInput = {
        from: 'sender@example.com',
        subject: 'Minimal Email',
        body: 'Body only',
        timestamp: new Date().toISOString(),
        // No messageId, metadata, or other optional fields
      };

      const result = await ingestEmail(minimalEmail);

      expect(result.eventId).not.toBeNull();
      expect(result.duplicate).toBe(false);
    });
  });
});
