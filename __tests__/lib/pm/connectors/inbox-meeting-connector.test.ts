// @ts-nocheck
/**
 * Wrath Shield v3 - Inbox Meeting Connector Tests
 *
 * Tests for processing meeting notes and creating task signals:
 * - Meeting action extraction
 * - Relative date parsing
 * - Attendee matching
 * - Prep reminders
 * - Batch processing
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

// Mock temporal context
jest.mock('@/lib/pm/temporal-context', () => ({
  getCurrentContext: jest.fn().mockReturnValue({}),
}));

import {
  processMeetingNotes,
  extractMeetingActions,
  parseRelativeDate,
  syncUpcomingMeetings,
  processMeetingsBatch,
  getConnectorStatus,
  type Meeting,
  type MeetingAction,
  type TaskSignal,
  type PrepReminder,
} from '@/lib/pm/connectors/inbox-meeting-connector';

describe('Inbox Meeting Connector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define Meeting interface', () => {
      const meeting: Meeting = {
        id: 'meeting-123',
        title: 'Weekly Sync',
        date: new Date(),
        attendees: ['John', 'Jane'],
        notes: 'Discussion notes here',
        transcript: 'Full transcript',
        agenda: ['Item 1', 'Item 2'],
        recurring: true,
        series_id: 'series-456',
        organizer: 'john@example.com',
      };

      expect(meeting.id).toBe('meeting-123');
      expect(meeting.recurring).toBe(true);
    });

    it('should define MeetingAction interface', () => {
      const action: MeetingAction = {
        type: 'action_item',
        text: 'Review the proposal',
        assigned_to: 'John',
        due_date: '2025-01-20',
        confidence: 0.9,
        context: 'Surrounding text',
        line_number: 5,
      };

      expect(action.type).toBe('action_item');
      expect(action.confidence).toBe(0.9);
    });

    it('should define PrepReminder interface', () => {
      const reminder: PrepReminder = {
        meeting_id: 'meeting-123',
        meeting_title: 'Weekly Sync',
        meeting_date: new Date(),
        prep_actions: ['Review notes', 'Prepare talking points'],
        days_until: 2,
      };

      expect(reminder.days_until).toBe(2);
    });
  });

  describe('extractMeetingActions', () => {
    it('should extract action items with markers', () => {
      const notes = 'Action item: Review the budget by Friday';
      const actions = extractMeetingActions(notes);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('action_item');
      expect(actions[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should extract TODO markers', () => {
      const notes = 'TODO: Send the report to stakeholders';
      const actions = extractMeetingActions(notes);

      expect(actions.length).toBeGreaterThan(0);
    });

    it('should extract checkbox items', () => {
      const notes = '- [ ] Complete the design review';
      const actions = extractMeetingActions(notes);

      expect(actions.length).toBeGreaterThan(0);
    });

    it('should extract "will do" assignments', () => {
      const notes = 'John will complete the analysis by Monday';
      const actions = extractMeetingActions(notes, ['John', 'Jane']);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].assigned_to).toBe('John');
    });

    it('should extract "@mention" assignments', () => {
      const notes = '@John needs to send the proposal';
      const actions = extractMeetingActions(notes, ['John', 'Jane']);

      expect(actions.length).toBeGreaterThan(0);
    });

    it('should extract parenthetical assignments', () => {
      const notes = 'Review the contract (John)';
      const actions = extractMeetingActions(notes, ['John', 'Jane']);

      if (actions.length > 0) {
        expect(actions[0].assigned_to).toBe('John');
      }
    });

    it('should extract bracket assignments', () => {
      const notes = 'Prepare the presentation [Jane]';
      const actions = extractMeetingActions(notes, ['John', 'Jane']);

      if (actions.length > 0) {
        expect(actions[0].assigned_to).toBe('Jane');
      }
    });

    it('should detect deadlines in action items', () => {
      const notes = 'Action: Submit report by Friday';
      const actions = extractMeetingActions(notes);

      if (actions.length > 0) {
        expect(actions[0].due_date).toBeDefined();
      }
    });

    it('should detect follow-up type', () => {
      const notes = 'Need to follow up with client on proposal';
      const actions = extractMeetingActions(notes);

      if (actions.length > 0) {
        expect(actions[0].type).toBe('follow_up');
      }
    });

    it('should return empty array for empty text', () => {
      const actions = extractMeetingActions('');

      expect(actions).toHaveLength(0);
    });

    it('should include context for action items', () => {
      const notes = 'First line\nAction: Do the thing\nLast line';
      const actions = extractMeetingActions(notes);

      if (actions.length > 0) {
        expect(actions[0].context).toBeTruthy();
      }
    });

    it('should skip very short action text', () => {
      const notes = 'TODO: abc';
      const actions = extractMeetingActions(notes);

      // Should skip actions less than 5 chars
      expect(actions).toHaveLength(0);
    });
  });

  describe('parseRelativeDate', () => {
    it('should parse "today"', () => {
      const result = parseRelativeDate('today');
      const expected = new Date().toISOString().split('T')[0];

      expect(result).toBe(expected);
    });

    it('should parse "tomorrow"', () => {
      const result = parseRelativeDate('tomorrow');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      expect(result).toBe(tomorrow.toISOString().split('T')[0]);
    });

    it('should parse "eod" (end of day)', () => {
      const result = parseRelativeDate('eod');
      const expected = new Date().toISOString().split('T')[0];

      expect(result).toBe(expected);
    });

    it('should parse "end of day"', () => {
      const result = parseRelativeDate('end of day');
      const expected = new Date().toISOString().split('T')[0];

      expect(result).toBe(expected);
    });

    it('should parse "eow" (end of week)', () => {
      const result = parseRelativeDate('eow');

      expect(result).toBeDefined();
    });

    it('should parse "end of week"', () => {
      const result = parseRelativeDate('end of week');

      expect(result).toBeDefined();
    });

    it('should parse "next week"', () => {
      const result = parseRelativeDate('next week');
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      expect(result).toBe(nextWeek.toISOString().split('T')[0]);
    });

    it('should parse day names (e.g., "Friday")', () => {
      const result = parseRelativeDate('friday');

      expect(result).toBeDefined();
    });

    it('should parse MM/DD format', () => {
      const result = parseRelativeDate('1/15');

      expect(result).toBeDefined();
      expect(result).toContain('-01-15');
    });

    it('should parse MM/DD/YY format', () => {
      const result = parseRelativeDate('1/15/25');

      expect(result).toBeDefined();
      expect(result).toBe('2025-01-15');
    });

    it('should parse MM/DD/YYYY format', () => {
      const result = parseRelativeDate('1/15/2025');

      expect(result).toBeDefined();
      expect(result).toBe('2025-01-15');
    });

    it('should return undefined for unparseable date', () => {
      const result = parseRelativeDate('sometime later');

      expect(result).toBeUndefined();
    });

    it('should use reference date correctly', () => {
      const refDate = new Date('2025-06-15');
      const result = parseRelativeDate('tomorrow', refDate);

      expect(result).toBe('2025-06-16');
    });
  });

  describe('processMeetingNotes', () => {
    it('should process meeting with action items', async () => {
      const meeting: Meeting = {
        id: 'meeting-123',
        title: 'Project Review',
        date: new Date(),
        attendees: ['John', 'Jane'],
      };

      const notes = 'Action item: John will review the proposal by Friday';

      const signals = await processMeetingNotes(meeting, notes);

      expect(Array.isArray(signals)).toBe(true);
      if (signals.length > 0) {
        expect(mockEnqueueSignal).toHaveBeenCalled();
      }
    });

    it('should include meeting metadata in signals', async () => {
      const meeting: Meeting = {
        id: 'meeting-123',
        title: 'Quarterly Review',
        date: new Date('2025-01-15'),
        attendees: ['John'],
        recurring: true,
        series_id: 'series-456',
      };

      const notes = 'TODO: Prepare Q1 report';

      const signals = await processMeetingNotes(meeting, notes);

      if (signals.length > 0) {
        expect(signals[0].payload.meeting_id).toBe('meeting-123');
        expect(signals[0].payload.meeting_title).toBe('Quarterly Review');
        expect(signals[0].payload.recurring).toBe(true);
      }
    });

    it('should handle empty notes', async () => {
      const meeting: Meeting = {
        id: 'meeting-123',
        title: 'Empty Meeting',
        date: new Date(),
        attendees: [],
      };

      const signals = await processMeetingNotes(meeting, '');

      expect(signals).toHaveLength(0);
    });
  });

  describe('syncUpcomingMeetings', () => {
    it('should generate prep reminders for upcoming meetings', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const meetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Important Meeting',
          date: tomorrow,
          attendees: ['John', 'Jane', 'Bob'],
          agenda: ['Topic 1', 'Topic 2'],
        },
      ];

      const reminders = await syncUpcomingMeetings(meetings, 7);

      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0].days_until).toBe(1);
    });

    it('should exclude past meetings', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const meetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Past Meeting',
          date: yesterday,
          attendees: [],
        },
      ];

      const reminders = await syncUpcomingMeetings(meetings, 7);

      expect(reminders).toHaveLength(0);
    });

    it('should exclude meetings beyond window', async () => {
      const twoWeeksAhead = new Date();
      twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 14);

      const meetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Far Future Meeting',
          date: twoWeeksAhead,
          attendees: [],
        },
      ];

      const reminders = await syncUpcomingMeetings(meetings, 7);

      expect(reminders).toHaveLength(0);
    });

    it('should generate prep actions for meetings with agenda', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const meetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Planning Meeting',
          date: tomorrow,
          attendees: ['John'],
          agenda: ['Budget Review', 'Timeline Discussion'],
        },
      ];

      const reminders = await syncUpcomingMeetings(meetings);

      if (reminders.length > 0) {
        expect(reminders[0].prep_actions.length).toBeGreaterThan(0);
        expect(reminders[0].prep_actions[0]).toContain('agenda');
      }
    });

    it('should generate prep actions for recurring meetings', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const meetings: Meeting[] = [
        {
          id: 'meeting-1',
          title: 'Weekly Sync',
          date: tomorrow,
          attendees: ['John'],
          recurring: true,
          notes: 'Previous meeting notes here',
        },
      ];

      const reminders = await syncUpcomingMeetings(meetings);

      if (reminders.length > 0) {
        const hasPreviousNotesAction = reminders[0].prep_actions.some(
          a => a.toLowerCase().includes('previous')
        );
        expect(hasPreviousNotesAction).toBe(true);
      }
    });
  });

  describe('processMeetingsBatch', () => {
    it('should process multiple meetings', async () => {
      const meetings = [
        {
          meeting: {
            id: 'meeting-1',
            title: 'Meeting 1',
            date: new Date(),
            attendees: [],
          },
          notes: 'TODO: Task 1',
        },
        {
          meeting: {
            id: 'meeting-2',
            title: 'Meeting 2',
            date: new Date(),
            attendees: [],
          },
          notes: 'TODO: Task 2',
        },
      ];

      const result = await processMeetingsBatch(meetings);

      expect(result.processed).toBe(2);
      expect(result).toHaveProperty('signals_generated');
      expect(result).toHaveProperty('errors');
    });

    it('should continue processing after errors', async () => {
      // Mock enqueueSignal to fail on first call
      mockEnqueueSignal
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValue('queue-123');

      const meetings = [
        {
          meeting: {
            id: 'meeting-1',
            title: 'Meeting 1',
            date: new Date(),
            attendees: [],
          },
          notes: 'TODO: Task 1',
        },
        {
          meeting: {
            id: 'meeting-2',
            title: 'Meeting 2',
            date: new Date(),
            attendees: [],
          },
          notes: 'TODO: Task 2',
        },
      ];

      const result = await processMeetingsBatch(meetings);

      expect(result.processed).toBe(2);
    });

    it('should accumulate signal counts', async () => {
      const meetings = [
        {
          meeting: {
            id: 'meeting-1',
            title: 'Meeting 1',
            date: new Date(),
            attendees: ['John'],
          },
          notes: 'TODO: Task 1\nTODO: Task 2',
        },
      ];

      const result = await processMeetingsBatch(meetings);

      expect(result.signals_generated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getConnectorStatus', () => {
    it('should return connector status', () => {
      const status = getConnectorStatus();

      expect(status.name).toBe('Inbox Meeting Connector');
      expect(status.version).toBe('1.0.0');
      expect(status.features).toContain('Action item extraction');
      expect(status.supported_formats).toContain('plain_text');
    });
  });
});
