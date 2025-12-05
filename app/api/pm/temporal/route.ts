/**
 * Temporal Context API
 *
 * Provides time-aware grounding for the PM system.
 *
 * GET /api/pm/temporal - Get agent temporal summary (main grounding endpoint)
 * GET /api/pm/temporal?action=context - Get current temporal context
 * GET /api/pm/temporal?action=elapsed&ts=X - Get time elapsed since timestamp
 * GET /api/pm/temporal?action=stale - Get stale events
 *
 * POST /api/pm/temporal
 *   - record-event: Record a temporal event
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentContext,
  getTimeElapsed,
  getAgentTemporalSummary,
  recordEvent,
  getEvent,
  getStaleEvents,
  formatRelativeDate,
} from '@/lib/pm/temporal-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Default: Get full agent temporal summary (grounding)
    if (!action) {
      const timezone = searchParams.get('tz') || undefined;
      const summary = getAgentTemporalSummary(timezone);

      return NextResponse.json({
        ok: true,
        ...summary,
        timestamp: new Date().toISOString(),
      });
    }

    switch (action) {
      case 'context': {
        const timezone = searchParams.get('tz') || 'America/New_York';
        const context = getCurrentContext(timezone);

        return NextResponse.json({
          ok: true,
          action: 'context',
          context,
          timestamp: new Date().toISOString(),
        });
      }

      case 'elapsed': {
        const ts = searchParams.get('ts');
        if (!ts) {
          return NextResponse.json(
            { ok: false, error: 'Missing ts parameter' },
            { status: 400 }
          );
        }

        const timestamp = parseInt(ts);
        if (isNaN(timestamp)) {
          return NextResponse.json(
            { ok: false, error: 'Invalid timestamp' },
            { status: 400 }
          );
        }

        const stalenessContext = searchParams.get('context') || undefined;
        const elapsed = getTimeElapsed(timestamp, stalenessContext);
        const formatted = formatRelativeDate(timestamp, { includeTime: true, verbose: true });

        return NextResponse.json({
          ok: true,
          action: 'elapsed',
          original_timestamp: timestamp,
          elapsed,
          formatted,
          timestamp: new Date().toISOString(),
        });
      }

      case 'stale': {
        const eventType = searchParams.get('type') || undefined;
        const maxAge = searchParams.get('maxAge') ? parseInt(searchParams.get('maxAge')!) : undefined;

        const staleEvents = getStaleEvents(eventType, maxAge);

        return NextResponse.json({
          ok: true,
          action: 'stale',
          count: staleEvents.length,
          events: staleEvents.map((e) => ({
            ...e,
            elapsed: getTimeElapsed(e.timestamp),
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'event': {
        const eventType = searchParams.get('type');
        const eventKey = searchParams.get('key');

        if (!eventType || !eventKey) {
          return NextResponse.json(
            { ok: false, error: 'Missing type or key parameter' },
            { status: 400 }
          );
        }

        const event = getEvent(eventType, eventKey);
        if (!event) {
          return NextResponse.json(
            { ok: false, error: 'Event not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          ok: true,
          action: 'event',
          event,
          elapsed: getTimeElapsed(event.timestamp),
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Temporal API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'Missing action in request body' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'record-event': {
        const { event_type, event_key, timestamp, metadata } = body;

        if (!event_type || !event_key) {
          return NextResponse.json(
            { ok: false, error: 'Missing required fields: event_type, event_key' },
            { status: 400 }
          );
        }

        const event = recordEvent({
          event_type,
          event_key,
          timestamp,
          metadata,
        });

        return NextResponse.json({
          ok: true,
          action: 'record-event',
          event,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Temporal API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
