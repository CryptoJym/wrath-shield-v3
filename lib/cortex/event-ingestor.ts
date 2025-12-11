/**
 * Wrath Shield v3 - Cognitive Synthesis Event Ingestor
 *
 * Converts incoming data from various sources (email, iMessage, Limitless, calendar)
 * into WorkingMemoryEvent format and feeds them into the Cognitive Synthesis Engine.
 *
 * Features:
 * - Source-specific ingestion functions
 * - Automatic urgency classification
 * - Fast-path routing for critical items
 * - Deduplication via WorkingMemory
 * - Server-only enforcement
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getWorkingMemory } from './working-memory';
import type { EventSource, WorkingMemoryEvent } from './types';
import type { Domain } from '../ea/preference-model';
import { getEventBus, createMessageEvent, DOMAINS, type Domain as EventBusDomain } from '../agents/life-os-event-bus';

// Prevent client-side imports
ensureServerOnly('lib/cortex/event-ingestor');

/**
 * Email input data
 */
export interface EmailInput {
  from: string;
  to?: string;
  subject: string;
  body: string;
  timestamp: string; // ISO 8601
  messageId?: string; // For deduplication
  metadata?: {
    cc?: string[];
    attachments?: string[];
    labels?: string[];
    [key: string]: unknown;
  };
}

/**
 * iMessage input data
 */
export interface IMessageInput {
  contact: string;
  content: string;
  timestamp: string; // ISO 8601
  messageId?: string; // For deduplication
  direction?: 'sent' | 'received';
  metadata?: {
    handle?: string;
    service?: string;
    has_attachments?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Limitless transcript input data
 */
export interface LimitlessInput {
  summary: string;
  transcript?: string;
  timestamp: string; // ISO 8601
  lifelogId?: string; // For deduplication
  context?: {
    startTime?: string;
    endTime?: string;
    isStarred?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Calendar event input data
 */
export interface CalendarInput {
  title: string;
  time: string; // ISO 8601 start time
  endTime?: string; // ISO 8601 end time
  attendees?: string[];
  eventId?: string; // For deduplication
  metadata?: {
    location?: string;
    description?: string;
    organizer?: string;
    [key: string]: unknown;
  };
}

/**
 * Initial classification result
 */
export interface InitialClassification {
  domain?: Domain;
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'background';
  keywords?: string[];
  isCritical: boolean; // Fast-path flag
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  eventId: string | null;
  classification: InitialClassification;
  fastPathed: boolean;
  duplicate: boolean;
}

/**
 * Classify email urgency based on keywords and patterns
 */
function classifyEmailUrgency(email: EmailInput): InitialClassification {
  const combinedText = `${email.subject} ${email.body}`.toLowerCase();
  const keywords: string[] = [];

  // Critical patterns
  const criticalPatterns = [
    /urgent/i,
    /asap/i,
    /emergency/i,
    /critical/i,
    /immediately/i,
    /deadline.*today/i,
    /requires.*immediate/i,
  ];

  const isCritical = criticalPatterns.some((pattern) => pattern.test(combinedText));

  // Domain detection (basic heuristic - can be enhanced with LLM)
  let domain: Domain | undefined;
  if (/court|legal|case|lawsuit/i.test(combinedText)) {
    domain = 'legal';
  } else if (/utlyze|client|project/i.test(combinedText)) {
    domain = 'business'; // Map utlyze/project to business domain
  } else if (/family|home/i.test(combinedText)) {
    domain = 'personal'; // Map family/home to personal domain
  }

  // Extract keywords
  const keywordPatterns = [
    /meeting/i,
    /deadline/i,
    /review/i,
    /proposal/i,
    /invoice/i,
    /payment/i,
  ];

  keywordPatterns.forEach((pattern) => {
    const match = combinedText.match(pattern);
    if (match) keywords.push(match[0].toLowerCase());
  });

  // Determine urgency level
  let urgency: InitialClassification['urgency'] = 'medium';

  if (isCritical) {
    urgency = 'critical';
  } else if (/today|this week/i.test(combinedText)) {
    urgency = 'high';
  } else if (/fyi|newsletter|digest/i.test(combinedText)) {
    urgency = 'low';
  }

  return {
    domain,
    urgency,
    keywords: keywords.length > 0 ? keywords : undefined,
    isCritical,
  };
}

/**
 * Classify iMessage urgency
 */
function classifyIMessageUrgency(message: IMessageInput): InitialClassification {
  const text = message.content.toLowerCase();
  const keywords: string[] = [];

  // Critical patterns
  const criticalPatterns = [
    /911/,
    /emergency/i,
    /urgent/i,
    /help/i,
    /asap/i,
  ];

  const isCritical = criticalPatterns.some((pattern) => pattern.test(text));

  // Most iMessages are medium priority unless critical
  const urgency: InitialClassification['urgency'] = isCritical ? 'critical' : 'medium';

  // Extract basic keywords
  if (/meeting/i.test(text)) keywords.push('meeting');
  if (/call/i.test(text)) keywords.push('call');
  if (/question/i.test(text)) keywords.push('question');

  return {
    urgency,
    keywords: keywords.length > 0 ? keywords : undefined,
    isCritical,
  };
}

/**
 * Classify Limitless transcript urgency
 */
function classifyLimitlessUrgency(transcript: LimitlessInput): InitialClassification {
  const text = `${transcript.summary} ${transcript.transcript || ''}`.toLowerCase();
  const keywords: string[] = [];

  // Limitless transcripts are rarely critical (retrospective data)
  const isCritical = false;

  // Check for important topics
  if (/decision/i.test(text)) keywords.push('decision');
  if (/action.*item/i.test(text)) keywords.push('action-item');
  if (/follow.*up/i.test(text)) keywords.push('follow-up');

  // Most Limitless data is background/low priority for synthesis
  const urgency: InitialClassification['urgency'] = 'low';

  return {
    urgency,
    keywords: keywords.length > 0 ? keywords : undefined,
    isCritical,
  };
}

/**
 * Classify calendar event urgency
 */
function classifyCalendarUrgency(event: CalendarInput): InitialClassification {
  const text = `${event.title} ${event.metadata?.description || ''}`.toLowerCase();
  const keywords: string[] = [];

  // Check if event is happening soon
  const eventTime = new Date(event.time);
  const now = new Date();
  const hoursDiff = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isCritical = hoursDiff < 1 && hoursDiff > -0.5; // Within next hour or just started

  // Extract keywords
  if (/meeting/i.test(text)) keywords.push('meeting');
  if (/deadline/i.test(text)) keywords.push('deadline');
  if (/presentation/i.test(text)) keywords.push('presentation');

  // Determine urgency based on time proximity
  let urgency: InitialClassification['urgency'] = 'medium';

  if (isCritical) {
    urgency = 'critical';
  } else if (hoursDiff < 24) {
    urgency = 'high';
  } else if (hoursDiff < 72) {
    urgency = 'medium';
  } else {
    urgency = 'low';
  }

  return {
    urgency,
    keywords: keywords.length > 0 ? keywords : undefined,
    isCritical,
  };
}

/**
 * Ingest email into Working Memory
 *
 * @param email - Email data
 * @returns Promise<IngestionResult>
 */
export async function ingestEmail(email: EmailInput): Promise<IngestionResult> {
  try {
    console.log(`[EventIngestor] Ingesting email from: ${email.from}, subject: ${email.subject}`);

    const classification = classifyEmailUrgency(email);

    // Build content string for WorkingMemory
    const content = JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      timestamp: email.timestamp,
    });

    // Add to Working Memory
    const workingMemory = getWorkingMemory();
    const eventId = await workingMemory.addEvent({
      source: 'email',
      timestamp: email.timestamp,
      content,
      initialClassification: {
        domain: classification.domain as Domain | undefined,
        urgency: classification.urgency,
        keywords: classification.keywords,
      },
      metadata: {
        messageId: email.messageId,
        from: email.from,
        subject: email.subject,
        ...email.metadata,
      },
      processedBySynthesis: false,
    });

    // If duplicate, return early
    if (!eventId) {
      console.log('[EventIngestor] Email is duplicate, skipping');
      return {
        eventId: null,
        classification,
        fastPathed: false,
        duplicate: true,
      };
    }

    console.log(`[EventIngestor] Email ingested with ID: ${eventId}, urgency: ${classification.urgency}`);

    // Fast-path critical items - route directly to appropriate agent via event bus
    if (classification.isCritical) {
      console.warn(`[EventIngestor] CRITICAL email detected! Event ID: ${eventId}`);
      await routeCriticalToAgent(eventId, 'email', email, classification);
    }

    return {
      eventId,
      classification,
      fastPathed: classification.isCritical,
      duplicate: false,
    };
  } catch (error) {
    console.error('[EventIngestor] Error ingesting email:', error);
    throw error;
  }
}

/**
 * Ingest iMessage into Working Memory
 *
 * @param message - iMessage data
 * @returns Promise<IngestionResult>
 */
export async function ingestIMessage(message: IMessageInput): Promise<IngestionResult> {
  try {
    console.log(`[EventIngestor] Ingesting iMessage from: ${message.contact}`);

    const classification = classifyIMessageUrgency(message);

    // Build content string for WorkingMemory
    const content = JSON.stringify({
      contact: message.contact,
      content: message.content,
      timestamp: message.timestamp,
      direction: message.direction,
    });

    // Add to Working Memory
    const workingMemory = getWorkingMemory();
    const eventId = await workingMemory.addEvent({
      source: 'imessage',
      timestamp: message.timestamp,
      content,
      initialClassification: {
        urgency: classification.urgency,
        keywords: classification.keywords,
      },
      metadata: {
        messageId: message.messageId,
        contact: message.contact,
        direction: message.direction,
        ...message.metadata,
      },
      processedBySynthesis: false,
    });

    // If duplicate, return early
    if (!eventId) {
      console.log('[EventIngestor] iMessage is duplicate, skipping');
      return {
        eventId: null,
        classification,
        fastPathed: false,
        duplicate: true,
      };
    }

    console.log(`[EventIngestor] iMessage ingested with ID: ${eventId}, urgency: ${classification.urgency}`);

    // Fast-path critical items - route directly to comms agent via event bus
    if (classification.isCritical) {
      console.warn(`[EventIngestor] CRITICAL iMessage detected! Event ID: ${eventId}`);
      await routeCriticalToAgent(eventId, 'imessage', message, classification);
    }

    return {
      eventId,
      classification,
      fastPathed: classification.isCritical,
      duplicate: false,
    };
  } catch (error) {
    console.error('[EventIngestor] Error ingesting iMessage:', error);
    throw error;
  }
}

/**
 * Ingest Limitless transcript into Working Memory
 *
 * @param transcript - Limitless lifelog data
 * @returns Promise<IngestionResult>
 */
export async function ingestLimitless(transcript: LimitlessInput): Promise<IngestionResult> {
  try {
    console.log(`[EventIngestor] Ingesting Limitless transcript: ${transcript.summary}`);

    const classification = classifyLimitlessUrgency(transcript);

    // Build content string for WorkingMemory
    const content = JSON.stringify({
      summary: transcript.summary,
      transcript: transcript.transcript,
      timestamp: transcript.timestamp,
      context: transcript.context,
    });

    // Add to Working Memory
    const workingMemory = getWorkingMemory();
    const eventId = await workingMemory.addEvent({
      source: 'limitless',
      timestamp: transcript.timestamp,
      content,
      initialClassification: {
        urgency: classification.urgency,
        keywords: classification.keywords,
      },
      metadata: {
        lifelogId: transcript.lifelogId,
        summary: transcript.summary,
        ...transcript.context,
      },
      processedBySynthesis: false,
    });

    // If duplicate, return early
    if (!eventId) {
      console.log('[EventIngestor] Limitless transcript is duplicate, skipping');
      return {
        eventId: null,
        classification,
        fastPathed: false,
        duplicate: true,
      };
    }

    console.log(`[EventIngestor] Limitless transcript ingested with ID: ${eventId}, urgency: ${classification.urgency}`);

    return {
      eventId,
      classification,
      fastPathed: false, // Limitless data is rarely critical
      duplicate: false,
    };
  } catch (error) {
    console.error('[EventIngestor] Error ingesting Limitless transcript:', error);
    throw error;
  }
}

/**
 * Ingest calendar event into Working Memory
 *
 * @param event - Calendar event data
 * @returns Promise<IngestionResult>
 */
export async function ingestCalendar(event: CalendarInput): Promise<IngestionResult> {
  try {
    console.log(`[EventIngestor] Ingesting calendar event: ${event.title}`);

    const classification = classifyCalendarUrgency(event);

    // Build content string for WorkingMemory
    const content = JSON.stringify({
      title: event.title,
      time: event.time,
      endTime: event.endTime,
      attendees: event.attendees,
    });

    // Add to Working Memory
    const workingMemory = getWorkingMemory();
    const eventId = await workingMemory.addEvent({
      source: 'calendar',
      timestamp: event.time,
      content,
      initialClassification: {
        urgency: classification.urgency,
        keywords: classification.keywords,
      },
      metadata: {
        eventId: event.eventId,
        title: event.title,
        attendees: event.attendees,
        ...event.metadata,
      },
      processedBySynthesis: false,
    });

    // If duplicate, return early
    if (!eventId) {
      console.log('[EventIngestor] Calendar event is duplicate, skipping');
      return {
        eventId: null,
        classification,
        fastPathed: false,
        duplicate: true,
      };
    }

    console.log(`[EventIngestor] Calendar event ingested with ID: ${eventId}, urgency: ${classification.urgency}`);

    // Fast-path critical items (events happening very soon) - route to EA agent
    if (classification.isCritical) {
      console.warn(`[EventIngestor] CRITICAL calendar event detected! Event ID: ${eventId}`);
      await routeCriticalToAgent(eventId, 'calendar', event, classification);
    }

    return {
      eventId,
      classification,
      fastPathed: classification.isCritical,
      duplicate: false,
    };
  } catch (error) {
    console.error('[EventIngestor] Error ingesting calendar event:', error);
    throw error;
  }
}

/**
 * Get ingestion statistics
 */
export async function getIngestionStats() {
  const workingMemory = getWorkingMemory();
  const stats = await workingMemory.getStats();

  return {
    totalEvents: stats.totalEvents,
    unprocessedEvents: stats.unprocessedEvents,
    eventsBySource: stats.eventsBySource,
    oldestEventTimestamp: stats.oldestEventTimestamp,
    newestEventTimestamp: stats.newestEventTimestamp,
  };
}

/**
 * Route critical items directly to agents via event bus for immediate processing
 * This bypasses the normal synthesis loop for time-sensitive items
 */
async function routeCriticalToAgent(
  eventId: string,
  source: 'email' | 'imessage' | 'calendar' | 'limitless',
  payload: EmailInput | IMessageInput | CalendarInput | LimitlessInput,
  classification: InitialClassification
): Promise<void> {
  try {
    const eventBus = getEventBus();

    // Determine target domain based on source and classification
    let targetDomain: EventBusDomain = DOMAINS.WORK; // Default to work domain
    if (classification.domain) {
      // Map domain to event bus domain
      const domainMap: Record<string, EventBusDomain> = {
        legal: DOMAINS.LEGAL,
        finance: DOMAINS.FINANCE,
        health: DOMAINS.HEALTH,
        business: DOMAINS.WORK,
        personal: DOMAINS.FAMILY,
        pm: DOMAINS.WORK,
        comms: DOMAINS.FAMILY,
        hyro: DOMAINS.FAMILY,
        general: DOMAINS.WORK,
      };
      targetDomain = domainMap[classification.domain] || DOMAINS.WORK;
    }

    // Create a critical event for the event bus
    const criticalEvent = createMessageEvent(
      `cortex.ingestor.${source}`,
      {
        eventId,
        source,
        payload,
        classification,
        fastPath: true,
        timestamp: new Date().toISOString(),
      },
      targetDomain,
      'critical', // Mark as critical priority
      `fast-path-${eventId}` // Correlation ID for tracking
    );

    // Publish to the event bus - subscribed agents will pick it up immediately
    await eventBus.publish(criticalEvent);

    console.log(`[EventIngestor] Fast-path routed ${source} event ${eventId} to domain ${targetDomain}`);
  } catch (error) {
    console.error(`[EventIngestor] Failed to fast-path route event ${eventId}:`, error);
    // Don't throw - we already ingested the event to working memory as fallback
  }
}
