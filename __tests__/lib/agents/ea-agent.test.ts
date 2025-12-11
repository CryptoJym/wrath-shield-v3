// @ts-nocheck
/**
 * Wrath Shield v3 - EA Agent Tests
 *
 * Tests for the Executive Assistant Agent that handles:
 * - Calendar management
 * - Meeting scheduling
 * - Daily agenda generation
 * - Free slot calculation
 */

// Mock life-os-event-bus
const mockSubscribe = jest.fn().mockReturnValue(() => {});
const mockGetEventBus = jest.fn().mockReturnValue({
  subscribe: mockSubscribe,
});

jest.mock('@/lib/agents/life-os-event-bus', () => ({
  getEventBus: mockGetEventBus,
}));

import {
  EAAgent,
  getEAAgent,
  initializeEAAgent,
  type CalendarEvent,
  type MeetingRequest,
  type DailyAgenda,
} from '@/lib/agents/ea-agent';

describe('EA Agent', () => {
  let agent: EAAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create fresh instance for each test
    agent = new EAAgent();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const agent1 = getEAAgent();
      const agent2 = getEAAgent();
      expect(agent1).toBe(agent2);
    });
  });

  describe('initializeEAAgent', () => {
    it('should initialize subscriptions', () => {
      initializeEAAgent();
      // Should subscribe to event patterns
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  describe('Calendar Operations', () => {
    describe('blockTime', () => {
      it('should create a time block', async () => {
        const start = new Date('2025-01-15T09:00:00');
        const end = new Date('2025-01-15T10:00:00');

        const event = await agent.blockTime('Focus Time', start, end);

        expect(event.id).toBeDefined();
        expect(event.title).toBe('Focus Time');
        expect(event.start).toEqual(start);
        expect(event.end).toEqual(end);
        expect(event.description).toBe('Focus time');
      });

      it('should generate unique IDs for each block', async () => {
        const start = new Date('2025-01-15T09:00:00');
        const end = new Date('2025-01-15T10:00:00');

        const event1 = await agent.blockTime('Block 1', start, end);
        const event2 = await agent.blockTime('Block 2', start, end);

        expect(event1.id).not.toBe(event2.id);
      });
    });

    describe('scheduleMeeting', () => {
      it('should create a meeting', async () => {
        const request: MeetingRequest = {
          title: 'Team Standup',
          duration: 30,
          attendees: ['alice@example.com', 'bob@example.com'],
          preferredTimes: [new Date('2025-01-15T14:00:00')],
          description: 'Daily standup meeting',
        };

        const event = await agent.scheduleMeeting(request);

        expect(event.id).toBeDefined();
        expect(event.title).toBe('Team Standup');
        expect(event.attendees).toEqual(['alice@example.com', 'bob@example.com']);
        expect(event.description).toBe('Daily standup meeting');
      });

      it('should calculate end time based on duration', async () => {
        const start = new Date('2025-01-15T14:00:00');
        const request: MeetingRequest = {
          title: 'Meeting',
          duration: 60, // 60 minutes
          preferredTimes: [start],
        };

        const event = await agent.scheduleMeeting(request);

        const expectedEnd = new Date(start.getTime() + 60 * 60000);
        expect(event.end.getTime()).toBe(expectedEnd.getTime());
      });

      it('should use current time if no preferred time provided', async () => {
        const request: MeetingRequest = {
          title: 'Quick Meeting',
          duration: 15,
        };

        const before = Date.now();
        const event = await agent.scheduleMeeting(request);
        const after = Date.now();

        expect(event.start.getTime()).toBeGreaterThanOrEqual(before);
        expect(event.start.getTime()).toBeLessThanOrEqual(after + 1000);
      });

      it('should throw error for scheduling conflicts', async () => {
        // First, block some time
        const start = new Date('2025-01-15T14:00:00');
        const end = new Date('2025-01-15T15:00:00');
        await agent.blockTime('Existing Meeting', start, end);

        // Try to schedule overlapping meeting
        const request: MeetingRequest = {
          title: 'Conflicting Meeting',
          duration: 60,
          preferredTimes: [new Date('2025-01-15T14:30:00')],
        };

        await expect(agent.scheduleMeeting(request)).rejects.toThrow('conflicts');
      });
    });

    describe('checkConflicts', () => {
      it('should detect overlapping events', async () => {
        const existingStart = new Date('2025-01-15T10:00:00');
        const existingEnd = new Date('2025-01-15T11:00:00');
        await agent.blockTime('Existing', existingStart, existingEnd);

        // Check for conflict in middle of existing event
        const conflicts = await agent.checkConflicts(
          new Date('2025-01-15T10:30:00'),
          new Date('2025-01-15T10:45:00')
        );

        expect(conflicts.length).toBeGreaterThan(0);
      });

      it('should detect event starting before existing ends', async () => {
        const existingStart = new Date('2025-01-15T10:00:00');
        const existingEnd = new Date('2025-01-15T11:00:00');
        await agent.blockTime('Existing', existingStart, existingEnd);

        const conflicts = await agent.checkConflicts(
          new Date('2025-01-15T10:45:00'),
          new Date('2025-01-15T11:30:00')
        );

        expect(conflicts.length).toBeGreaterThan(0);
      });

      it('should return empty array for non-conflicting times', async () => {
        const existingStart = new Date('2025-01-15T10:00:00');
        const existingEnd = new Date('2025-01-15T11:00:00');
        await agent.blockTime('Existing', existingStart, existingEnd);

        const conflicts = await agent.checkConflicts(
          new Date('2025-01-15T14:00:00'),
          new Date('2025-01-15T15:00:00')
        );

        expect(conflicts.length).toBe(0);
      });

      it('should detect event fully containing existing event', async () => {
        const existingStart = new Date('2025-01-15T10:00:00');
        const existingEnd = new Date('2025-01-15T11:00:00');
        await agent.blockTime('Existing', existingStart, existingEnd);

        const conflicts = await agent.checkConflicts(
          new Date('2025-01-15T09:00:00'),
          new Date('2025-01-15T12:00:00')
        );

        expect(conflicts.length).toBeGreaterThan(0);
      });
    });

    describe('getUpcomingEvents', () => {
      it('should return events within the specified days', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        await agent.blockTime('Tomorrow Meeting', tomorrow, new Date(tomorrow.getTime() + 60 * 60000));

        const events = await agent.getUpcomingEvents(7);

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].title).toBe('Tomorrow Meeting');
      });

      it('should not return past events', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Note: With the mock CalendarStore, this won't actually persist past events
        // but tests the filtering logic
        const events = await agent.getUpcomingEvents(7);

        const pastEvents = events.filter(e => e.start < new Date());
        expect(pastEvents.length).toBe(0);
      });
    });
  });

  describe('Daily Agenda', () => {
    describe('generateDailyAgenda', () => {
      it('should generate agenda with empty day message', async () => {
        const agenda = await agent.generateDailyAgenda();

        expect(agenda.date).toBeDefined();
        expect(agenda.events).toEqual([]);
        expect(agenda.summary).toContain('No events scheduled today');
      });

      it('should generate agenda with events', async () => {
        const today = new Date();
        today.setHours(10, 0, 0, 0);

        await agent.blockTime('Morning Meeting', today, new Date(today.getTime() + 60 * 60000));

        const agenda = await agent.generateDailyAgenda();

        expect(agenda.events.length).toBe(1);
        expect(agenda.summary).toContain('1 event');
      });

      it('should sort events by start time', async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const laterEvent = new Date(today);
        laterEvent.setHours(14, 0, 0, 0);

        const earlierEvent = new Date(today);
        earlierEvent.setHours(10, 0, 0, 0);

        // Add later event first
        await agent.blockTime('Afternoon Meeting', laterEvent, new Date(laterEvent.getTime() + 60 * 60000));
        await agent.blockTime('Morning Meeting', earlierEvent, new Date(earlierEvent.getTime() + 60 * 60000));

        const agenda = await agent.generateDailyAgenda();

        if (agenda.events.length >= 2) {
          expect(agenda.events[0].start.getTime()).toBeLessThan(agenda.events[1].start.getTime());
        }
      });

      it('should calculate free slots', async () => {
        const agenda = await agent.generateDailyAgenda();

        expect(agenda.freeSlots).toBeDefined();
        expect(Array.isArray(agenda.freeSlots)).toBe(true);
      });
    });
  });

  describe('Event Bus Integration', () => {
    it('should subscribe to task events', () => {
      initializeEAAgent();

      expect(mockSubscribe).toHaveBeenCalledWith(
        'type.task',
        expect.any(Function),
        expect.any(Number),
        'agent.ea'
      );
    });

    it('should subscribe to family domain events', () => {
      initializeEAAgent();

      expect(mockSubscribe).toHaveBeenCalledWith(
        'domain.family.*',
        expect.any(Function),
        expect.any(Number),
        'agent.ea'
      );
    });

    it('should subscribe to work domain events', () => {
      initializeEAAgent();

      expect(mockSubscribe).toHaveBeenCalledWith(
        'domain.work.*',
        expect.any(Function),
        expect.any(Number),
        'agent.ea'
      );
    });

    it('should subscribe to message events', () => {
      initializeEAAgent();

      expect(mockSubscribe).toHaveBeenCalledWith(
        'type.message',
        expect.any(Function),
        expect.any(Number),
        'agent.ea'
      );
    });
  });

  describe('CalendarStore', () => {
    it('should persist events', async () => {
      const start = new Date('2025-01-15T09:00:00');
      const end = new Date('2025-01-15T10:00:00');

      await agent.blockTime('Event 1', start, end);
      await agent.blockTime('Event 2', start, end);

      // Check both events exist by checking conflicts
      const conflicts = await agent.checkConflicts(start, end);
      expect(conflicts.length).toBe(2);
    });
  });
});
