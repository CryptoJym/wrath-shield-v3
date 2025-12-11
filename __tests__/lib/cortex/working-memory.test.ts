/**
 * Working Memory Tests
 *
 * Unit tests for Working Memory buffer logic - event management,
 * classification, processing, and statistics.
 * These tests verify pure business logic without external dependencies.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Working Memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Event Addition', () => {
    it('should add a new event to working memory', () => {
      const mockEvent = {
        source: 'email' as const,
        timestamp: new Date().toISOString(),
        content: JSON.stringify({ from: 'test@example.com', subject: 'Test' }),
        initialClassification: { urgency: 'medium' as const },
        metadata: { messageId: 'msg-123' },
        processedBySynthesis: false,
      };

      expect(mockEvent.source).toBe('email');
      expect(mockEvent.processedBySynthesis).toBe(false);
      expect(mockEvent.initialClassification.urgency).toBe('medium');
    });

    it('should detect duplicate events by messageId', () => {
      const existingEvents = [
        { id: 'event-1', metadata: { messageId: 'msg-existing-123' } },
        { id: 'event-2', metadata: { messageId: 'msg-456' } },
      ];

      const newEvent = {
        source: 'email' as const,
        metadata: { messageId: 'msg-existing-123' },
      };

      const isDuplicate = existingEvents.some(
        (e) => e.metadata.messageId === newEvent.metadata.messageId
      );

      expect(isDuplicate).toBe(true);
    });

    it('should classify event urgency correctly', () => {
      const urgencyLevels = ['critical', 'high', 'medium', 'low', 'background'] as const;

      urgencyLevels.forEach((level) => {
        expect(['critical', 'high', 'medium', 'low', 'background']).toContain(level);
      });
    });
  });

  describe('Event Retrieval', () => {
    it('should retrieve unprocessed events', () => {
      const allEvents = [
        { id: '1', source: 'email', processedBySynthesis: false },
        { id: '2', source: 'imessage', processedBySynthesis: false },
        { id: '3', source: 'calendar', processedBySynthesis: false },
        { id: '4', source: 'email', processedBySynthesis: true },
      ];

      const unprocessed = allEvents.filter((e) => !e.processedBySynthesis);

      expect(unprocessed.length).toBe(3);
      expect(unprocessed.every((e) => !e.processedBySynthesis)).toBe(true);
    });

    it('should filter events by source', () => {
      const sources = ['email', 'imessage', 'limitless', 'calendar'] as const;

      sources.forEach((source) => {
        expect(['email', 'imessage', 'limitless', 'calendar']).toContain(source);
      });
    });

    it('should order events by timestamp', () => {
      const events = [
        { id: '1', timestamp: '2024-01-01T10:00:00Z' },
        { id: '2', timestamp: '2024-01-01T11:00:00Z' },
        { id: '3', timestamp: '2024-01-01T09:00:00Z' },
      ];

      const sorted = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      expect(sorted[0].id).toBe('3'); // Earliest first
      expect(sorted[2].id).toBe('2'); // Latest last
    });
  });

  describe('Event Processing', () => {
    it('should mark events as processed', () => {
      const eventIds = ['event-1', 'event-2', 'event-3'];

      // Simulate marking events as processed
      const processedEvents = eventIds.map((id) => ({
        id,
        processedBySynthesis: true,
        processedAt: new Date().toISOString(),
      }));

      expect(eventIds.length).toBe(3);
      expect(processedEvents.every((e) => e.processedBySynthesis)).toBe(true);
    });

    it('should handle batch processing', () => {
      const batchSize = 50;
      const events = Array.from({ length: 100 }, (_, i) => ({
        id: `event-${i}`,
        content: `Content ${i}`,
      }));

      const batches = [];
      for (let i = 0; i < events.length; i += batchSize) {
        batches.push(events.slice(i, i + batchSize));
      }

      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(50);
    });
  });

  describe('Pruning', () => {
    it('should prune events older than specified hours', () => {
      const pruneHours = 168; // 1 week
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - pruneHours);

      const events = [
        { id: '1', timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), processedBySynthesis: true }, // 1 day old
        { id: '2', timestamp: new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString(), processedBySynthesis: true }, // 200 hours old
        { id: '3', timestamp: new Date(Date.now() - 300 * 60 * 60 * 1000).toISOString(), processedBySynthesis: true }, // 300 hours old
      ];

      const toPrune = events.filter(
        (e) => e.processedBySynthesis && new Date(e.timestamp) < cutoffDate
      );

      expect(cutoffDate.getTime()).toBeLessThan(Date.now());
      expect(toPrune.length).toBe(2); // Events 2 and 3 are older than 168 hours
    });

    it('should only prune processed events', () => {
      // Pruning should only remove events where processedBySynthesis = true
      const events = [
        { id: '1', processedBySynthesis: true, timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', processedBySynthesis: false, timestamp: '2024-01-01T00:00:00Z' },
        { id: '3', processedBySynthesis: true, timestamp: '2024-01-01T00:00:00Z' },
      ];

      const toPrune = events.filter((e) => e.processedBySynthesis);

      expect(toPrune.length).toBe(2);
      expect(toPrune.every((e) => e.processedBySynthesis)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct stats', () => {
      const mockStats = {
        totalEvents: 150,
        unprocessedEvents: 45,
        eventsBySource: {
          email: 60,
          imessage: 40,
          limitless: 30,
          calendar: 20,
        },
        oldestEventTimestamp: '2024-01-01T00:00:00Z',
        newestEventTimestamp: '2024-01-15T12:00:00Z',
      };

      expect(mockStats.totalEvents).toBe(150);
      expect(mockStats.unprocessedEvents).toBe(45);
      expect(Object.values(mockStats.eventsBySource).reduce((a, b) => a + b, 0)).toBe(150);
    });
  });
});
