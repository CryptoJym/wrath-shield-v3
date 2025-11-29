/**
 * Comms Route API
 *
 * POST /api/comms/route - Manually route an event to a target using pipeline
 *
 * Body:
 * - event_id: string - ID of event to route
 * - target: 'finance' | 'legal' | 'pm' | 'orchestrator' - Target agent
 * - override_confidence: boolean - Optional, bypass confidence checks
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { listRecentEvents } from '@/lib/events';
import { routeEventToAgent, classifyEvent } from '@/lib/comms/pipeline';
import { type RoutingTarget } from '@/lib/context_requests';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TARGETS: RoutingTarget[] = ['finance', 'pm', 'legal', 'orchestrator'];

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { event_id, target, override_confidence } = body || {};

    // Validate input
    if (!event_id) {
      return NextResponse.json({ error: 'event_id required' }, { status: 400 });
    }

    if (!target || !VALID_TARGETS.includes(target)) {
      return NextResponse.json(
        { error: `target required and must be one of: ${VALID_TARGETS.join(', ')}` },
        { status: 400 }
      );
    }

    // Find event
    const events = listRecentEvents(1000, userId);
    const event = events.find((e) => e.id === event_id);

    if (!event) {
      return NextResponse.json({ error: 'event not found' }, { status: 404 });
    }

    // Classify event if not already classified
    let classification = event.classification
      ? {
          category: event.classification as any,
          confidence: event.confidence || 0.5,
          reasoning: 'Pre-classified',
          keywords: [],
          needs_review: event.needs_review === 1,
        }
      : classifyEvent(event);

    // Override confidence check if requested
    if (override_confidence) {
      classification.needs_review = false;
      classification.confidence = 1.0;
    }

    // Route using pipeline
    const routingResult = routeEventToAgent(event, classification, userId);

    if (!routingResult.success) {
      return NextResponse.json({ error: routingResult.error || 'Routing failed' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      event_id,
      target,
      classification: {
        category: classification.category,
        confidence: classification.confidence,
        needs_review: classification.needs_review,
      },
      routed_to: routingResult.routed_to,
    });
  } catch (e) {
    console.error('[Comms Route API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'Failed to route event' }, { status });
  }
}
