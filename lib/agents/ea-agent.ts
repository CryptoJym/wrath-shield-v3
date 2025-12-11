/**
 * Executive Assistant Agent
 * Handles calendar management, meeting scheduling, and daily agenda generation
 *
 * Integration: Event bus subscriptions for proactive scheduling
 * Calendar API: Google Calendar (googleapis) - requires setup
 */

import { getEventBus, AgentEvent } from './life-os-event-bus';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
}

export interface MeetingRequest {
  title: string;
  duration: number; // minutes
  attendees?: string[];
  preferredTimes?: Date[];
  description?: string;
}

export interface DailyAgenda {
  date: Date;
  events: CalendarEvent[];
  summary: string;
  freeSlots: { start: Date; end: Date }[];
}

/**
 * Mock calendar store (replace with Google Calendar API integration)
 */
class CalendarStore {
  private events: CalendarEvent[] = [];

  addEvent(event: CalendarEvent): CalendarEvent {
    this.events.push(event);
    return event;
  }

  getEvents(startDate: Date, endDate: Date): CalendarEvent[] {
    return this.events.filter(
      (event) => event.start >= startDate && event.start <= endDate
    );
  }

  getAllEvents(): CalendarEvent[] {
    return [...this.events];
  }

  removeEvent(id: string): boolean {
    const index = this.events.findIndex((e) => e.id === id);
    if (index >= 0) {
      this.events.splice(index, 1);
      return true;
    }
    return false;
  }
}

const calendarStore = new CalendarStore();

/**
 * EA Agent - Executive Assistant
 */
export class EAAgent {
  private calendarStore: CalendarStore;
  private agentId = 'agent.ea';
  private isInitialized = false;

  constructor() {
    this.calendarStore = calendarStore;
  }

  /**
   * Initialize event bus subscriptions
   * Called automatically on first use
   */
  private initializeSubscriptions() {
    if (this.isInitialized) return;

    const eventBus = getEventBus();

    // Subscribe to task events that may require scheduling
    eventBus.subscribe(
      'type.task',
      this.handleTaskEvent.bind(this),
      40,
      this.agentId
    );

    // Subscribe to family domain for scheduling conflicts
    eventBus.subscribe(
      'domain.family.*',
      this.handleFamilyEvent.bind(this),
      50,
      this.agentId
    );

    // Subscribe to work/business scheduling
    eventBus.subscribe(
      'domain.work.*',
      this.handleWorkEvent.bind(this),
      50,
      this.agentId
    );

    // Subscribe to communication events that may need calendar follow-up
    eventBus.subscribe(
      'type.message',
      this.handleMessageEvent.bind(this),
      30,
      this.agentId
    );

    this.isInitialized = true;
    console.log('[EA Agent] Initialized with event bus subscriptions');
  }

  /**
   * Handle task events (may need calendar blocking)
   */
  private async handleTaskEvent(event: AgentEvent): Promise<void> {
    console.log(`[EA Agent] Processing task event: ${event.id}`);

    const payload = event.payload as any;

    // Check if task has a due date that needs calendar blocking
    if (payload?.dueDate) {
      const dueDate = new Date(payload.dueDate);
      console.log(`[EA Agent] Task "${payload.title}" due on ${dueDate.toISOString()}`);
      // Future: Create calendar reminder or time block
    }

    // Check if task requires meeting scheduling
    if (payload?.requiresMeeting) {
      console.log(`[EA Agent] Task "${payload.title}" requires meeting scheduling`);
      // Future: Propose meeting times
    }
  }

  /**
   * Handle family domain events (protect family time)
   */
  private async handleFamilyEvent(event: AgentEvent): Promise<void> {
    console.log(`[EA Agent] Processing family event: ${event.id}`);
    // Future: Check for scheduling conflicts with work calendar
  }

  /**
   * Handle work domain events (coordinate meetings)
   */
  private async handleWorkEvent(event: AgentEvent): Promise<void> {
    console.log(`[EA Agent] Processing work event: ${event.id}`);
    // Future: Implement meeting coordination
  }

  /**
   * Handle message events (detect scheduling requests)
   */
  private async handleMessageEvent(event: AgentEvent): Promise<void> {
    const payload = event.payload as any;

    // Check for scheduling keywords in messages
    const schedulingKeywords = ['meeting', 'schedule', 'calendar', 'appointment', 'call'];
    const messageText = (payload?.text || payload?.subject || '').toLowerCase();

    if (schedulingKeywords.some(keyword => messageText.includes(keyword))) {
      console.log(`[EA Agent] Message may require scheduling action: ${event.id}`);
      // Future: Extract scheduling intent and propose action
    }
  }

  /**
   * Get upcoming events within the next N days
   */
  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);

    return this.calendarStore.getEvents(now, endDate);
  }

  /**
   * Generate daily agenda for today
   */
  async generateDailyAgenda(): Promise<DailyAgenda> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = this.calendarStore.getEvents(today, tomorrow);
    events.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Calculate free slots
    const freeSlots = this.calculateFreeSlots(events, today, tomorrow);

    // Generate summary
    const summary = this.generateAgendaSummary(events, freeSlots);

    return {
      date: today,
      events,
      summary,
      freeSlots,
    };
  }

  /**
   * Block time on calendar
   */
  async blockTime(title: string, start: Date, end: Date): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: `block-${Date.now()}`,
      title,
      start,
      end,
      description: 'Focus time',
    };

    return this.calendarStore.addEvent(event);
  }

  /**
   * Schedule a meeting
   */
  async scheduleMeeting(request: MeetingRequest): Promise<CalendarEvent> {
    const start = request.preferredTimes?.[0] || new Date();
    const end = new Date(start.getTime() + request.duration * 60000);

    // Check for conflicts
    const conflicts = await this.checkConflicts(start, end);
    if (conflicts.length > 0) {
      throw new Error('Time slot has conflicts');
    }

    const event: CalendarEvent = {
      id: `meeting-${Date.now()}`,
      title: request.title,
      start,
      end,
      description: request.description,
      attendees: request.attendees,
    };

    return this.calendarStore.addEvent(event);
  }

  /**
   * Check for scheduling conflicts
   */
  async checkConflicts(start: Date, end: Date): Promise<CalendarEvent[]> {
    const allEvents = this.calendarStore.getAllEvents();

    return allEvents.filter((event) => {
      // Check if events overlap
      return (
        (start >= event.start && start < event.end) ||
        (end > event.start && end <= event.end) ||
        (start <= event.start && end >= event.end)
      );
    });
  }

  /**
   * Calculate free time slots in a day
   */
  private calculateFreeSlots(
    events: CalendarEvent[],
    dayStart: Date,
    dayEnd: Date
  ): { start: Date; end: Date }[] {
    const freeSlots: { start: Date; end: Date }[] = [];

    // Working hours: 9 AM - 6 PM
    const workStart = new Date(dayStart);
    workStart.setHours(9, 0, 0, 0);

    const workEnd = new Date(dayStart);
    workEnd.setHours(18, 0, 0, 0);

    if (events.length === 0) {
      return [{ start: workStart, end: workEnd }];
    }

    let currentTime = workStart;

    for (const event of events) {
      if (event.start > currentTime) {
        freeSlots.push({
          start: currentTime,
          end: event.start,
        });
      }
      currentTime = event.end > currentTime ? event.end : currentTime;
    }

    if (currentTime < workEnd) {
      freeSlots.push({
        start: currentTime,
        end: workEnd,
      });
    }

    return freeSlots;
  }

  /**
   * Generate human-readable agenda summary
   */
  private generateAgendaSummary(
    events: CalendarEvent[],
    freeSlots: { start: Date; end: Date }[]
  ): string {
    if (events.length === 0) {
      return 'No events scheduled today. You have the full day available.';
    }

    const eventSummaries = events.map((e) => {
      const timeStr = e.start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${timeStr} - ${e.title}`;
    });

    const totalFreeMinutes = freeSlots.reduce((sum, slot) => {
      return sum + (slot.end.getTime() - slot.start.getTime()) / 60000;
    }, 0);

    return `You have ${events.length} event(s) today with ${Math.round(totalFreeMinutes)} minutes of free time:\n${eventSummaries.join('\n')}`;
  }
}

// Singleton instance
let eaAgentInstance: EAAgent | null = null;

export function getEAAgent(): EAAgent {
  if (!eaAgentInstance) {
    eaAgentInstance = new EAAgent();
  }
  return eaAgentInstance;
}

/**
 * Initialize EA agent (call on server startup)
 * Connects to event bus for proactive scheduling
 */
export function initializeEAAgent(): void {
  const agent = getEAAgent();
  (agent as any).initializeSubscriptions();
  console.log('[EA Agent] Ready for calendar and scheduling operations');
}
