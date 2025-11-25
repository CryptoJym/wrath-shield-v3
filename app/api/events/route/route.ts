/**
 * Events Route API
 *
 * POST /api/events/route - Route an event to a target agent
 * Creates a context-request and emits a bus message
 */

import { NextResponse } from 'next/server';
import { routeEvent, listRecentEvents } from '@/lib/events';
import { createContextRequest, type RoutingTarget } from '@/lib/context_requests';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TARGETS: RoutingTarget[] = ['finance', 'pm', 'legal', 'orchestrator'];

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { id, target } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    if (!target || !VALID_TARGETS.includes(target)) {
      return NextResponse.json(
        { error: `target required and must be one of: ${VALID_TARGETS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get event details for context request
    const events = listRecentEvents(1000, userId);
    const event = events.find((e) => e.id === id);

    if (!event) {
      return NextResponse.json({ error: 'event not found' }, { status: 404 });
    }

    // Update event's routed_target in database
    routeEvent(id, target, userId);

    // Create context request and emit bus message
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

    return NextResponse.json({
      ok: true,
      context_request_id: contextRequest.id,
      status: contextRequest.status,
      bus_messages: contextRequest.bus_message_ids.length,
      dispatched_to: contextRequest.dispatched_to,
    });
  } catch (e) {
    console.error('[Events Route API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to route event' }, { status });
  }
}
