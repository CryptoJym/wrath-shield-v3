/**
 * Cognitive Synthesis Engine - Working Memory Access
 *
 * GET /api/cortex/events - List events in working memory
 * Query params: ?processed=false&source=limitless&limit=50&offset=0
 *
 * POST /api/cortex/events - Manually add event to working memory (for testing)
 * Body: { source, content, initialClassification?, metadata? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';
import { currentUserOrThrow } from '@/lib/auth/user';
import { getWorkingMemory } from '@/lib/cortex/working-memory';
import type { WorkingMemoryEvent, EventSource } from '@/lib/cortex/types';

ensureServerOnly('app/api/cortex/events/route');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// GET - List Events
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const { searchParams } = new URL(request.url);
    const workingMemory = getWorkingMemory();

    // Check if filtering by processed status
    const processedParam = searchParams.get('processed');
    const sourceParam = searchParams.get('source') as EventSource | null;
    const hoursParam = searchParams.get('hours');

    let events: WorkingMemoryEvent[] = [];

    // Get events based on filters
    if (processedParam === 'false') {
      // Get unprocessed events only
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
      events = await workingMemory.getUnprocessed(limit);
    } else if (hoursParam) {
      // Get recent events from last N hours
      const hours = parseInt(hoursParam, 10);
      events = await workingMemory.getRecent(hours);
    } else {
      // Get recent events (default: last 24 hours)
      events = await workingMemory.getRecent(24);
    }

    // Filter by source if specified
    if (sourceParam) {
      events = events.filter((e) => e.source === sourceParam);
    }

    // Filter by processed status if specified (for recent queries)
    if (processedParam !== null && processedParam !== 'false') {
      const wantProcessed = processedParam === 'true';
      events = events.filter((e) => e.processedBySynthesis === wantProcessed);
    }

    // Apply pagination
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const total = events.length;
    events = events.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      events,
      total,
      offset,
      limit,
    });
  } catch (e) {
    console.error('[Cortex Events API] Error listing events:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to list events' }, { status });
  }
}

// ============================================================================
// POST - Add Event to Working Memory
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const body = await request.json();
    const { source, content, initialClassification, metadata } = body;

    // Validate required fields
    if (!source || !content) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: source, content' },
        { status: 400 }
      );
    }

    // Validate source
    const validSources: EventSource[] = [
      'limitless',
      'email',
      'imessage',
      'calendar',
      'github',
      'slack',
      'motion',
      'whoop',
    ];
    if (!validSources.includes(source)) {
      return NextResponse.json({ ok: false, error: `Invalid source: ${source}` }, { status: 400 });
    }

    // Add event to working memory
    const workingMemory = getWorkingMemory();
    const eventId = await workingMemory.addEvent({
      source,
      content,
      timestamp: new Date().toISOString(),
      initialClassification,
      processedBySynthesis: false,
      metadata,
    });

    if (!eventId) {
      return NextResponse.json({
        ok: false,
        error: 'Event was duplicate and not added',
      });
    }

    // Get the created event
    const events = await workingMemory.getByIds([eventId]);
    const event = events[0];

    return NextResponse.json({
      ok: true,
      event,
      message: 'Event added to working memory',
    });
  } catch (e) {
    console.error('[Cortex Events API] Error adding event:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: 'Failed to add event' }, { status });
  }
}
