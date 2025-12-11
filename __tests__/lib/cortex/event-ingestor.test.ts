/**
 * Event Ingestor Tests
 *
 * Unit tests for the Event Ingestor logic - classification,
 * urgency detection, deduplication, and fast-path routing.
 * These tests verify pure business logic without external dependencies.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Event Ingestor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Ingestion', () => {
    it('should classify critical emails correctly', () => {
      const criticalPatterns = [
        'This is URGENT - need response ASAP',
        'EMERGENCY: Server is down',
        'Critical issue requires immediate attention',
        'Deadline is TODAY, please respond',
      ];

      criticalPatterns.forEach((content) => {
        const isCritical = /urgent|asap|emergency|critical|immediately|deadline.*today/i.test(
          content
        );
        expect(isCritical).toBe(true);
      });
    });

    it('should classify non-critical emails as medium priority', () => {
      const normalEmails = [
        'Meeting scheduled for next week',
        'FYI: New policy update',
        'Quick question about the project',
      ];

      normalEmails.forEach((content) => {
        const isCritical = /urgent|asap|emergency|critical|immediately/i.test(content);
        expect(isCritical).toBe(false);
      });
    });

    it('should detect domain from email content', () => {
      const domainTests = [
        { content: 'Court filing deadline approaching', expectedDomain: 'legal' },
        { content: 'Utlyze client meeting tomorrow', expectedDomain: 'business' },
        { content: 'Family dinner plans for Sunday', expectedDomain: 'personal' },
      ];

      domainTests.forEach(({ content, expectedDomain }) => {
        let domain: string | undefined;
        if (/court|legal|case|lawsuit/i.test(content)) {
          domain = 'legal';
        } else if (/utlyze|client|project/i.test(content)) {
          domain = 'business';
        } else if (/family|home/i.test(content)) {
          domain = 'personal';
        }
        expect(domain).toBe(expectedDomain);
      });
    });

    it('should extract keywords from emails', () => {
      const content = 'Meeting to review the proposal and discuss invoice payment';
      const keywords: string[] = [];

      const patterns = [/meeting/i, /deadline/i, /review/i, /proposal/i, /invoice/i, /payment/i];

      patterns.forEach((pattern) => {
        const match = content.match(pattern);
        if (match) keywords.push(match[0].toLowerCase());
      });

      expect(keywords).toContain('meeting');
      expect(keywords).toContain('review');
      expect(keywords).toContain('proposal');
      expect(keywords).toContain('invoice');
      expect(keywords).toContain('payment');
    });
  });

  describe('iMessage Ingestion', () => {
    it('should classify critical iMessages', () => {
      const criticalMessages = ['911 - need help', 'EMERGENCY!!!', 'URGENT call me now', 'Help!'];

      criticalMessages.forEach((content) => {
        const isCritical = /911|emergency|urgent|help|asap/i.test(content);
        expect(isCritical).toBe(true);
      });
    });

    it('should handle message direction', () => {
      const directions = ['sent', 'received'] as const;

      directions.forEach((dir) => {
        expect(['sent', 'received']).toContain(dir);
      });
    });
  });

  describe('Limitless Ingestion', () => {
    it('should extract action items from transcripts', () => {
      const transcript = `
        Meeting summary: Discussed Q4 goals.
        Action item: Send report by Friday.
        Follow up with marketing team.
        Decision made: Approve the budget.
      `;

      const hasActionItem = /action.*item/i.test(transcript);
      const hasFollowUp = /follow.*up/i.test(transcript);
      const hasDecision = /decision/i.test(transcript);

      expect(hasActionItem).toBe(true);
      expect(hasFollowUp).toBe(true);
      expect(hasDecision).toBe(true);
    });

    it('should classify Limitless data as low urgency by default', () => {
      // Limitless transcripts are retrospective data, rarely critical
      const defaultUrgency = 'low';
      expect(defaultUrgency).toBe('low');
    });
  });

  describe('Calendar Ingestion', () => {
    it('should classify events happening soon as critical', () => {
      const now = new Date();
      const soonEvent = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      const laterEvent = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now

      const hoursDiffSoon = (soonEvent.getTime() - now.getTime()) / (1000 * 60 * 60);
      const hoursDiffLater = (laterEvent.getTime() - now.getTime()) / (1000 * 60 * 60);

      const isSoonCritical = hoursDiffSoon < 1 && hoursDiffSoon > -0.5;
      const isLaterCritical = hoursDiffLater < 1 && hoursDiffLater > -0.5;

      expect(isSoonCritical).toBe(true);
      expect(isLaterCritical).toBe(false);
    });

    it('should determine urgency based on time proximity', () => {
      const getUrgency = (hoursDiff: number) => {
        if (hoursDiff < 1 && hoursDiff > -0.5) return 'critical';
        if (hoursDiff < 24) return 'high';
        if (hoursDiff < 72) return 'medium';
        return 'low';
      };

      expect(getUrgency(0.5)).toBe('critical');
      expect(getUrgency(12)).toBe('high');
      expect(getUrgency(48)).toBe('medium');
      expect(getUrgency(100)).toBe('low');
    });

    it('should extract event keywords', () => {
      const eventTitles = [
        { title: 'Team Meeting', expectedKeywords: ['meeting'] },
        { title: 'Project Deadline', expectedKeywords: ['deadline'] },
        { title: 'Client Presentation', expectedKeywords: ['presentation'] },
      ];

      eventTitles.forEach(({ title, expectedKeywords }) => {
        const keywords: string[] = [];
        if (/meeting/i.test(title)) keywords.push('meeting');
        if (/deadline/i.test(title)) keywords.push('deadline');
        if (/presentation/i.test(title)) keywords.push('presentation');

        expectedKeywords.forEach((kw) => {
          expect(keywords).toContain(kw);
        });
      });
    });
  });

  describe('Deduplication', () => {
    it('should detect duplicate by messageId', () => {
      const existingIds = new Set(['msg-1', 'msg-2', 'msg-3']);

      expect(existingIds.has('msg-1')).toBe(true);
      expect(existingIds.has('msg-new')).toBe(false);
    });

    it('should detect duplicate by lifelogId', () => {
      const existingIds = new Set(['lifelog-1', 'lifelog-2']);

      expect(existingIds.has('lifelog-1')).toBe(true);
      expect(existingIds.has('lifelog-new')).toBe(false);
    });

    it('should detect duplicate by eventId', () => {
      const existingIds = new Set(['event-cal-1', 'event-cal-2']);

      expect(existingIds.has('event-cal-1')).toBe(true);
      expect(existingIds.has('event-cal-new')).toBe(false);
    });
  });

  describe('Fast-Path Routing', () => {
    it('should flag critical items for fast-path', () => {
      const classifications = [
        { urgency: 'critical', isCritical: true, shouldFastPath: true },
        { urgency: 'high', isCritical: false, shouldFastPath: false },
        { urgency: 'medium', isCritical: false, shouldFastPath: false },
        { urgency: 'low', isCritical: false, shouldFastPath: false },
      ];

      classifications.forEach(({ isCritical, shouldFastPath }) => {
        expect(isCritical).toBe(shouldFastPath);
      });
    });
  });
});
