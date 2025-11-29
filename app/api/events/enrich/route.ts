/**
 * Events Enrichment API
 *
 * POST /api/events/enrich - Enrich events with AI analysis
 * Fuses signals from multiple channels and generates context
 */

import { NextResponse } from 'next/server';
import { listRecentEvents, updateEventClassification } from '@/lib/events';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface EnrichmentResult {
  id: string;
  classification: string;
  confidence: number;
  suggestions?: string[];
  context?: string;
  suggested_task?: string;
  summary?: string;
}

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { eventIds, autoClassify = true } = body || {};

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: 'eventIds array required' }, { status: 400 });
    }

    // Get all recent events for context
    const allEvents = listRecentEvents(1000, userId);
    const eventsToEnrich = allEvents.filter(ev => eventIds.includes(ev.id));

    if (eventsToEnrich.length === 0) {
      return NextResponse.json({ error: 'no matching events found' }, { status: 404 });
    }

    const enrichmentResults: EnrichmentResult[] = [];

    for (const event of eventsToEnrich) {
      // Find related events (same contact, similar subject, within time window)
      const relatedEvents = findRelatedEvents(event, allEvents);

      // Generate enrichment based on event type and related signals
      const enrichment = await enrichEvent(event, relatedEvents);

      // Optionally update DB with classification
      if (autoClassify && enrichment.classification) {
        updateEventClassification(
          event.id,
          enrichment.classification,
          enrichment.confidence,
          userId
        );
      }

      enrichmentResults.push({
        id: event.id,
        classification: enrichment.classification,
        confidence: enrichment.confidence,
        suggestions: enrichment.suggestions,
        context: enrichment.context,
        suggested_task: enrichment.suggested_task,
        summary: enrichment.summary,
      });
    }

    return NextResponse.json({
      ok: true,
      enriched: enrichmentResults.length,
      results: enrichmentResults,
    });
  } catch (e) {
    console.error('[Events Enrich API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to enrich events' }, { status });
  }
}

function findRelatedEvents(targetEvent: any, allEvents: any[]): any[] {
  const related: any[] = [];
  const timeWindow = 7 * 24 * 60 * 60; // 7 days in seconds

  for (const event of allEvents) {
    if (event.id === targetEvent.id) continue;

    // Same contact
    if (event.contact && targetEvent.contact && event.contact === targetEvent.contact) {
      if (Math.abs(event.ts - targetEvent.ts) <= timeWindow) {
        related.push(event);
      }
    }

    // Similar subject (for email threads)
    if (event.subject && targetEvent.subject) {
      const subj1 = normalizeSubject(event.subject);
      const subj2 = normalizeSubject(targetEvent.subject);
      if (subj1 && subj2 && subj1 === subj2) {
        if (Math.abs(event.ts - targetEvent.ts) <= timeWindow) {
          related.push(event);
        }
      }
    }
  }

  // Sort by timestamp (most recent first)
  return related.sort((a, b) => b.ts - a.ts).slice(0, 10);
}

function normalizeSubject(subject: string): string {
  // Remove Re:, Fwd:, etc.
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
}

async function enrichEvent(event: any, relatedEvents: any[]): Promise<{
  classification: string;
  confidence: number;
  suggestions?: string[];
  context?: string;
  suggested_task?: string;
  summary?: string;
}> {
  // Simple rule-based classification for now
  // In production, this would use an LLM for deeper analysis

  const channel = event.channel || 'email';
  const subject = (event.subject || '').toLowerCase();
  const preview = (event.preview || '').toLowerCase();
  const contact = event.contact || '';

  // Calendar events
  if (channel === 'calendar') {
    if (subject.includes('interview') || subject.includes('screening')) {
      return {
        classification: 'recruitment',
        confidence: 0.85,
        suggestions: [
          'Prepare interview questions',
          'Review candidate resume',
          'Set up video conference link',
        ],
        context: `Interview scheduled with ${contact}. ${relatedEvents.length} related messages found.`,
        suggested_task: `Prepare for interview with ${contact}`,
        summary: `Upcoming interview/screening with ${contact}. Review materials and prepare questions based on ${relatedEvents.length} related communications.`,
      };
    }

    if (subject.includes('meeting') || subject.includes('call') || subject.includes('sync')) {
      return {
        classification: 'meeting',
        confidence: 0.8,
        suggestions: [
          'Review meeting agenda',
          'Prepare talking points',
          'Check for conflicts',
        ],
        context: `Meeting with ${contact}. ${relatedEvents.length} related events in thread.`,
        suggested_task: `Prepare agenda and materials for meeting with ${contact}`,
        summary: `Scheduled meeting with ${contact}. ${relatedEvents.length} related events in the conversation thread - review context before attending.`,
      };
    }

    return {
      classification: 'calendar_event',
      confidence: 0.7,
      context: `Calendar event with ${contact}`,
      suggested_task: `Review details for upcoming event with ${contact}`,
      summary: `Calendar event scheduled with ${contact}.`,
    };
  }

  // Email classification
  if (channel === 'email') {
    // Financial/invoices
    if (subject.includes('invoice') || subject.includes('payment') || subject.includes('receipt')) {
      return {
        classification: 'financial',
        confidence: 0.9,
        suggestions: [
          'Review invoice details',
          'Verify payment amount',
          'Update accounting records',
        ],
        context: `Financial communication from ${contact}. ${relatedEvents.length} related messages.`,
        suggested_task: `Process invoice/payment from ${contact}`,
        summary: `Financial document from ${contact}. Verify amount and update records. ${relatedEvents.length} related financial communications in thread.`,
      };
    }

    // Legal/contracts
    if (subject.includes('contract') || subject.includes('agreement') || subject.includes('legal')) {
      return {
        classification: 'legal',
        confidence: 0.85,
        suggestions: [
          'Review contract terms',
          'Consult legal counsel if needed',
          'Prepare signature',
        ],
        context: `Legal document from ${contact}. ${relatedEvents.length} related messages.`,
        suggested_task: `Review and sign contract from ${contact}`,
        summary: `Legal agreement from ${contact}. Review terms carefully and prepare for signature. ${relatedEvents.length} related legal communications.`,
      };
    }

    // Action required
    if (preview.includes('action required') || preview.includes('please respond') || preview.includes('urgent')) {
      return {
        classification: 'action_required',
        confidence: 0.75,
        suggestions: [
          'Review request details',
          'Draft response',
          'Set follow-up reminder',
        ],
        context: `Requires action from ${contact}. ${relatedEvents.length} related messages.`,
        suggested_task: `Respond to urgent request from ${contact}`,
        summary: `Action needed: ${contact} requires response. ${relatedEvents.length} messages in thread - review context and draft reply.`,
      };
    }

    // Thread with multiple messages
    if (relatedEvents.length >= 3) {
      return {
        classification: 'conversation_thread',
        confidence: 0.8,
        suggestions: [
          'Review conversation history',
          'Summarize key points',
          'Determine next action',
        ],
        context: `Active conversation with ${contact}. ${relatedEvents.length} messages in thread.`,
        suggested_task: `Review and respond to ongoing conversation with ${contact}`,
        summary: `Active email thread with ${contact} (${relatedEvents.length} messages). Review history to determine next steps.`,
      };
    }

    return {
      classification: 'general_email',
      confidence: 0.6,
      context: `Email from ${contact}`,
      suggested_task: `Review email from ${contact}`,
      summary: `Email from ${contact}.`,
    };
  }

  // iMessage
  if (channel === 'imessage') {
    if (relatedEvents.length >= 5) {
      return {
        classification: 'active_conversation',
        confidence: 0.85,
        context: `Active text conversation with ${contact}. ${relatedEvents.length} recent messages.`,
        suggested_task: `Catch up and respond to conversation with ${contact}`,
        summary: `Ongoing text conversation with ${contact} (${relatedEvents.length} messages). Active thread may need response.`,
      };
    }

    return {
      classification: 'message',
      confidence: 0.7,
      context: `Message from ${contact}`,
      suggested_task: `Review message from ${contact}`,
      summary: `Text message from ${contact}.`,
    };
  }

  // Lifelog
  if (channel === 'lifelog') {
    return {
      classification: 'personal_note',
      confidence: 0.9,
      suggestions: [
        'Review notes for action items',
        'Tag relevant contacts',
        'Schedule follow-ups',
      ],
      context: `Personal lifelog entry. ${relatedEvents.length} related entries.`,
      suggested_task: `Review lifelog entry for action items`,
      summary: `Personal note captured via lifelog. ${relatedEvents.length} related entries - extract tasks and insights.`,
    };
  }

  // Default
  return {
    classification: 'uncategorized',
    confidence: 0.5,
    context: `Event from ${contact}`,
    suggested_task: `Review event from ${contact}`,
    summary: `Uncategorized event from ${contact}.`,
  };
}

// GET endpoint to retrieve enrichment data
export async function GET(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const { searchParams } = new URL(req.url);
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.7');

    // Get events that need review (low confidence)
    const allEvents = listRecentEvents(500, userId);
    const needsReview = allEvents.filter(ev =>
      ev.needs_review === 1 ||
      (ev.confidence !== null && ev.confidence !== undefined && ev.confidence < minConfidence)
    );

    // Build enrichment results by re-generating enrichment for classified events
    const classifiedEvents = allEvents.filter(ev => ev.classification || ev.confidence !== null);
    const results: EnrichmentResult[] = [];

    for (const ev of classifiedEvents) {
      // Find related events for context
      const relatedEvents = findRelatedEvents(ev, allEvents);

      // Re-generate full enrichment to get suggestions, context, etc.
      const enrichment = await enrichEvent(ev, relatedEvents);

      results.push({
        id: ev.id,
        classification: ev.classification || enrichment.classification,
        confidence: ev.confidence ?? enrichment.confidence,
        suggestions: enrichment.suggestions,
        context: enrichment.context,
        suggested_task: enrichment.suggested_task,
        summary: enrichment.summary,
      });
    }

    console.log(`[Events Enrich API] GET success: userId=${userId}, total=${allEvents.length}, needs_review=${needsReview.length}, results=${results.length}`);

    return NextResponse.json({
      ok: true,
      total_events: allEvents.length,
      needs_review_count: needsReview.length,
      needs_review: needsReview.slice(0, 20),
      results,
    });
  } catch (e) {
    console.error('[Events Enrich API] GET Error:', e);
    console.error('[Events Enrich API] Stack:', (e as any)?.stack);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to fetch enrichment data', details: (e as any)?.message }, { status });
  }
}
