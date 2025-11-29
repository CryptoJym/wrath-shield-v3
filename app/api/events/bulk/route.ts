/**
 * Events Bulk Operations API
 *
 * POST /api/events/bulk - Perform bulk operations on multiple events
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { bulkRouteEvents, bulkDismissEvents, bulkEnrichEvents } from '@/lib/events';
import { createContextRequest, type RoutingTarget } from '@/lib/context_requests';
import { listRecentEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TARGETS: RoutingTarget[] = ['finance', 'pm', 'legal', 'orchestrator'];

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { action, eventIds, target } = body || {};

    if (!action) {
      return NextResponse.json({ error: 'action required' }, { status: 400 });
    }

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ error: 'eventIds array required' }, { status: 400 });
    }

    switch (action) {
      case 'route': {
        if (!target || !VALID_TARGETS.includes(target)) {
          return NextResponse.json(
            { error: `target required and must be one of: ${VALID_TARGETS.join(', ')}` },
            { status: 400 }
          );
        }

        // Bulk route events
        bulkRouteEvents(eventIds, target, userId);

        // Create context requests for each event
        const allEvents = listRecentEvents(1000, userId);
        const contextRequests = [];

        for (const id of eventIds) {
          const event = allEvents.find((e) => e.id === id);
          if (event) {
            const contextRequest = createContextRequest({
              event_id: id,
              event_payload: {
                channel: event.channel,
                subject: event.subject || undefined,
                preview: event.preview || undefined,
                contact: event.contact || undefined,
                source: event.source,
                ts: event.ts,
              },
              target: target as RoutingTarget,
              user_id: userId,
            });
            contextRequests.push(contextRequest);
          }
        }

        return NextResponse.json({
          ok: true,
          action: 'route',
          processed: eventIds.length,
          target,
          contextRequests: contextRequests.length,
        });
      }

      case 'dismiss': {
        bulkDismissEvents(eventIds, userId);

        return NextResponse.json({
          ok: true,
          action: 'dismiss',
          processed: eventIds.length,
        });
      }

      case 'enrich': {
        // Enrich events with AI
        const results = await bulkEnrichEvents(eventIds, userId);

        return NextResponse.json({
          ok: true,
          action: 'enrich',
          processed: eventIds.length,
          enriched: results.length,
        });
      }

      case 'clear_resolved': {
        // This clears events that have been dismissed or completed
        bulkDismissEvents(eventIds, userId);

        return NextResponse.json({
          ok: true,
          action: 'clear_resolved',
          processed: eventIds.length,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error('[Events Bulk API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to perform bulk operation' }, { status });
  }
}
