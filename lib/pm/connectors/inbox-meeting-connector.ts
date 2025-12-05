/**
 * Inbox Meeting Connector
 *
 * Extracts action items from meeting notes and calendar data.
 * Generates task signals for the PM task queue.
 *
 * Features:
 * - Action item extraction from notes/transcripts
 * - Natural language deadline parsing
 * - Attendee-to-assignee mapping
 * - Meeting prep reminders
 * - Recurring meeting handling
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import { enqueueSignal } from '../task-queue';
import type { IncomingSignal } from '../task-queue';
import { getCurrentContext } from '../temporal-context';

ensureServerOnly('lib/pm/connectors/inbox-meeting-connector');

// ============================================================================
// Types
// ============================================================================

export interface Meeting {
  id: string;
  title: string;
  date: Date;
  attendees: string[];
  notes?: string;
  transcript?: string;
  agenda?: string[];
  recurring?: boolean;
  series_id?: string;
  organizer?: string;
}

export interface MeetingAction {
  type: 'action_item' | 'deadline' | 'decision' | 'follow_up';
  text: string;
  assigned_to?: string;
  due_date?: string;
  confidence: number;
  context: string; // Surrounding text for context
  line_number?: number; // For reference
}

export interface TaskSignal {
  id: string;
  source: 'inbox';
  signal_type: 'task' | 'deadline';
  payload: {
    meeting_id: string;
    meeting_title: string;
    meeting_date: string;
    attendees: string[];
    action_item: string;
    assigned_to?: string;
    due_date?: string;
    context: string;
    recurring?: boolean;
    series_id?: string;
  };
  timestamp: number;
  confidence: number;
}

export interface PrepReminder {
  meeting_id: string;
  meeting_title: string;
  meeting_date: Date;
  prep_actions: string[];
  days_until: number;
}

// ============================================================================
// Pattern Constants
// ============================================================================

const ACTION_MARKERS = [
  'action item:',
  'action:',
  'todo:',
  'to do:',
  'task:',
  '[ ]',
  '- [ ]',
  'needs to',
  'will do',
  'should',
  'must',
  'responsible:',
  'owner:',
];

const ASSIGNMENT_PATTERNS = [
  /(\w+)\s+will\s+(.+)/i,
  /(\w+)\s+to\s+(.+)/i,
  /(\w+)\s+should\s+(.+)/i,
  /assign(?:ed)?\s+to\s+(\w+)/i,
  /@(\w+)\s+(.+)/i,
  /\((\w+)\)/i, // (John) at end of line
  /\[(\w+)\]/i, // [John] at end of line
  /responsible:\s*(\w+)/i,
  /owner:\s*(\w+)/i,
];

const DEADLINE_PATTERNS = [
  /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /by\s+(tomorrow|today|next week|end of week|eow|eod|end of day)/i,
  /by\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  /due\s+(?:on|by)?\s*(.+)/i,
  /deadline[:\s]+(.+)/i,
  /before\s+(.+)/i,
  /by\s+(.+)/i,
];

const DECISION_PATTERNS = [
  /decide|decision|need to determine/i,
  /pending|waiting on|blocked by/i,
  /discuss|follow up|circle back/i,
  /tbd|to be determined|to be decided/i,
  /needs discussion|needs decision/i,
];

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Process meeting notes and generate task signals
 */
export async function processMeetingNotes(
  meeting: Meeting,
  notes: string
): Promise<TaskSignal[]> {
  console.log(`[Meeting Connector] Processing meeting: ${meeting.title} (${meeting.id})`);

  // Extract action items
  const actions = extractMeetingActions(notes, meeting.attendees);

  console.log(`[Meeting Connector] Found ${actions.length} action items`);

  // Generate signals
  const signals: TaskSignal[] = [];
  for (const action of actions) {
    const signal = createTaskSignal(meeting, action);
    signals.push(signal);

    // Enqueue the signal
    try {
      await enqueueSignal(signal as IncomingSignal);
      console.log(`[Meeting Connector] Enqueued signal for: ${action.text}`);
    } catch (error) {
      console.error(`[Meeting Connector] Failed to enqueue signal:`, error);
    }
  }

  return signals;
}

/**
 * Extract action items from text
 */
export function extractMeetingActions(
  text: string,
  attendees: string[] = []
): MeetingAction[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const actions: MeetingAction[] = [];
  const lines = text.split('\n').map((l, idx) => ({ text: l.trim(), line: idx + 1 }));

  for (let i = 0; i < lines.length; i++) {
    const { text: line, line: lineNum } = lines[i];
    if (!line) continue;

    // Check for action markers
    const hasMarker = ACTION_MARKERS.some((marker) =>
      line.toLowerCase().includes(marker.toLowerCase())
    );

    // Check for assignment patterns
    let assignedTo: string | undefined;
    for (const pattern of ASSIGNMENT_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1];
        if (name && attendees.some((a) => fuzzyMatch(a, name))) {
          assignedTo = normalizeAttendeeName(name, attendees);
          break;
        }
      }
    }

    // Check for deadline patterns
    let dueDate: string | undefined;
    for (const pattern of DEADLINE_PATTERNS) {
      const match = line.match(pattern);
      if (match && match[1]) {
        dueDate = parseRelativeDate(match[1].trim(), new Date());
        if (dueDate) break;
      }
    }

    // Check for decision patterns
    const isDecision = DECISION_PATTERNS.some((pattern) => pattern.test(line));

    // Determine if this is an action item
    let isAction = false;
    let confidence = 0;
    let type: MeetingAction['type'] = 'action_item';

    if (hasMarker) {
      isAction = true;
      confidence = 0.9;
      type = dueDate ? 'deadline' : 'action_item';
    } else if (assignedTo) {
      isAction = true;
      confidence = 0.8;
      type = 'action_item';
    } else if (isDecision) {
      isAction = true;
      confidence = 0.6;
      type = 'follow_up';
    } else if (dueDate) {
      isAction = true;
      confidence = 0.7;
      type = 'deadline';
    }

    if (isAction) {
      // Get context (surrounding lines)
      const contextLines: string[] = [];
      if (i > 0) contextLines.push(lines[i - 1].text);
      contextLines.push(line);
      if (i < lines.length - 1) contextLines.push(lines[i + 1].text);

      // Clean the action text
      let actionText = line;
      ACTION_MARKERS.forEach((marker) => {
        const idx = actionText.toLowerCase().indexOf(marker.toLowerCase());
        if (idx !== -1) {
          actionText = actionText.slice(idx + marker.length).trim();
        }
      });

      // Remove assignment notation from text
      actionText = actionText.replace(/\((\w+)\)$/, '').trim();
      actionText = actionText.replace(/\[(\w+)\]$/, '').trim();
      actionText = actionText.replace(/- \[ \]/, '').trim();
      actionText = actionText.replace(/^\[ \]/, '').trim();

      if (actionText.length > 5) {
        // Minimum viable action text
        actions.push({
          type,
          text: actionText,
          assigned_to: assignedTo,
          due_date: dueDate,
          confidence,
          context: contextLines.join(' '),
          line_number: lineNum,
        });
      }
    }
  }

  return actions;
}

/**
 * Parse relative date strings to ISO date
 */
export function parseRelativeDate(
  dateStr: string,
  referenceDate: Date = new Date()
): string | undefined {
  const lower = dateStr.toLowerCase().trim();
  const ref = new Date(referenceDate);

  // Today
  if (lower === 'today') {
    return ref.toISOString().split('T')[0];
  }

  // Tomorrow
  if (lower === 'tomorrow') {
    ref.setDate(ref.getDate() + 1);
    return ref.toISOString().split('T')[0];
  }

  // End of day (same as today)
  if (lower === 'eod' || lower === 'end of day') {
    return ref.toISOString().split('T')[0];
  }

  // End of week
  if (lower === 'eow' || lower === 'end of week') {
    const dayOfWeek = ref.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 7 - dayOfWeek + 5;
    ref.setDate(ref.getDate() + daysUntilFriday);
    return ref.toISOString().split('T')[0];
  }

  // Next week
  if (lower === 'next week') {
    ref.setDate(ref.getDate() + 7);
    return ref.toISOString().split('T')[0];
  }

  // Day of week (e.g., "Friday")
  const dayIndex = DAYS_OF_WEEK.findIndex((day) => lower.includes(day));
  if (dayIndex !== -1) {
    const currentDay = ref.getDay();
    let daysToAdd = dayIndex - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
    ref.setDate(ref.getDate() + daysToAdd);
    return ref.toISOString().split('T')[0];
  }

  // MM/DD or MM/DD/YY format
  const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : ref.getFullYear();

    // Handle 2-digit years
    if (year < 100) {
      year += 2000;
    }

    const parsed = new Date(year, month - 1, day);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  // Unable to parse
  return undefined;
}

/**
 * Sync upcoming meetings and generate prep reminders
 */
export async function syncUpcomingMeetings(
  meetings: Meeting[],
  daysAhead: number = 7
): Promise<PrepReminder[]> {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const reminders: PrepReminder[] = [];

  for (const meeting of meetings) {
    const meetingDate = new Date(meeting.date);

    // Only include future meetings within the window
    if (meetingDate > now && meetingDate <= cutoff) {
      const daysUntil = Math.ceil((meetingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Generate prep actions based on meeting type
      const prepActions: string[] = [];

      if (meeting.agenda && meeting.agenda.length > 0) {
        prepActions.push(`Review agenda: ${meeting.agenda.join(', ')}`);
      }

      if (meeting.recurring && meeting.notes) {
        prepActions.push('Review notes from previous meeting');
      }

      if (meeting.attendees.length > 2) {
        prepActions.push('Prepare talking points for group discussion');
      }

      reminders.push({
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        meeting_date: meetingDate,
        prep_actions: prepActions,
        days_until: daysUntil,
      });
    }
  }

  console.log(`[Meeting Connector] Generated ${reminders.length} prep reminders`);

  return reminders;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a task signal from a meeting action
 */
function createTaskSignal(meeting: Meeting, action: MeetingAction): TaskSignal {
  const timestamp = Date.now();

  return {
    id: `inbox-meeting-${meeting.id}-${timestamp}`,
    source: 'inbox',
    signal_type: action.type === 'deadline' ? 'deadline' : 'task',
    payload: {
      meeting_id: meeting.id,
      meeting_title: meeting.title,
      meeting_date: meeting.date.toISOString(),
      attendees: meeting.attendees,
      action_item: action.text,
      assigned_to: action.assigned_to || meeting.organizer,
      due_date: action.due_date,
      context: action.context,
      recurring: meeting.recurring,
      series_id: meeting.series_id,
    },
    timestamp,
    confidence: action.confidence,
  };
}

/**
 * Fuzzy match attendee names (case-insensitive, partial match)
 */
function fuzzyMatch(attendee: string, name: string): boolean {
  const lowerAttendee = attendee.toLowerCase();
  const lowerName = name.toLowerCase();

  // Exact match
  if (lowerAttendee === lowerName) return true;

  // First name match
  const attendeeFirst = lowerAttendee.split(/\s+/)[0];
  if (attendeeFirst === lowerName) return true;

  // Last name match
  const attendeeParts = lowerAttendee.split(/\s+/);
  if (attendeeParts.length > 1 && attendeeParts[attendeeParts.length - 1] === lowerName) {
    return true;
  }

  return false;
}

/**
 * Normalize attendee name (prefer full name from attendee list)
 */
function normalizeAttendeeName(name: string, attendees: string[]): string {
  for (const attendee of attendees) {
    if (fuzzyMatch(attendee, name)) {
      return attendee;
    }
  }
  return name;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process multiple meetings in batch
 */
export async function processMeetingsBatch(
  meetings: Array<{ meeting: Meeting; notes: string }>
): Promise<{
  processed: number;
  signals_generated: number;
  errors: Array<{ meeting_id: string; error: string }>;
}> {
  let signalsGenerated = 0;
  const errors: Array<{ meeting_id: string; error: string }> = [];

  for (const { meeting, notes } of meetings) {
    try {
      const signals = await processMeetingNotes(meeting, notes);
      signalsGenerated += signals.length;
    } catch (error) {
      console.error(`[Meeting Connector] Error processing meeting ${meeting.id}:`, error);
      errors.push({
        meeting_id: meeting.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed: meetings.length,
    signals_generated: signalsGenerated,
    errors,
  };
}

/**
 * Get meeting connector status
 */
export function getConnectorStatus(): {
  name: string;
  version: string;
  features: string[];
  supported_formats: string[];
} {
  return {
    name: 'Inbox Meeting Connector',
    version: '1.0.0',
    features: [
      'Action item extraction',
      'Natural language deadline parsing',
      'Attendee-to-assignee mapping',
      'Meeting prep reminders',
      'Recurring meeting support',
      'Batch processing',
    ],
    supported_formats: ['plain_text', 'markdown', 'transcript'],
  };
}
