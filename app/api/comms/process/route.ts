/**
 * Comms Process API
 *
 * POST /api/comms/process - Run pipeline on events
 *
 * Body:
 * - event_ids: string[] - Optional, specific events to process
 * - limit: number - Optional, process N recent events (default: 50)
 * - skip_dedupe: boolean - Optional, skip deduplication
 * - skip_route: boolean - Optional, skip auto-routing
 * - auto_route_threshold: number - Optional, min confidence for auto-routing (default: 0.7)
 *
 * Returns:
 * - processed: number - Number of events processed
 * - results: Array of pipeline results per event
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { listRecentEvents } from '@/lib/events';
import { runPipeline, runPipelineBatch } from '@/lib/comms/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const {
      event_ids,
      limit = 50,
      skip_dedupe = false,
      skip_route = false,
      auto_route_threshold = 0.7,
    } = body || {};

    // Get events to process
    let events;

    if (event_ids && Array.isArray(event_ids)) {
      // Process specific events
      const allEvents = listRecentEvents(1000, userId);
      events = allEvents.filter((e) => event_ids.includes(e.id));

      if (events.length === 0) {
        return NextResponse.json({ error: 'No matching events found' }, { status: 404 });
      }
    } else {
      // Process recent unprocessed events
      events = listRecentEvents(limit, userId).filter((e) => !e.classification || e.needs_review === 1);
    }

    // Run pipeline batch
    const batchResult = runPipelineBatch(events, {
      skip_dedupe,
      skip_route,
      user_id: userId,
    });

    // Format results
    const results = batchResult.results.map((result, idx) => ({
      event_id: events[idx].id,
      success: result.success,
      classification: {
        category: result.classification.category,
        confidence: result.classification.confidence,
        needs_review: result.classification.needs_review,
        keywords: result.classification.keywords,
      },
      dedupe: result.dedupe,
      routed: result.routing?.success
        ? {
            target: result.routing.routed_to,
            auto_routed: (result.classification.confidence || 0) >= auto_route_threshold,
          }
        : null,
      actions: result.actions,
      error: result.error,
    }));

    // Summary stats
    const summary = {
      total: events.length,
      processed: batchResult.processed,
      classified: results.filter((r) => r.success).length,
      routed: results.filter((r) => r.routed).length,
      needs_review: results.filter((r) => r.classification.needs_review).length,
      duplicates: results.filter((r) => r.dedupe.is_duplicate).length,
      errors: results.filter((r) => !r.success).length,
    };

    return NextResponse.json({
      ok: true,
      summary,
      results,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error('[Comms Process API] Error:', e);
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'Failed to process events' }, { status });
  }
}
