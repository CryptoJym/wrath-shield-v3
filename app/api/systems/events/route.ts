/**
 * Systems Events API
 *
 * GET: Fetch recent events from working memory for live visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkingMemory } from '@/lib/cortex/working-memory';

// GET /api/systems/events - Get recent events
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const wm = getWorkingMemory();
    const events = await wm.getRecent(hours);

    // Transform to frontend-friendly format
    const formattedEvents = events.slice(0, limit).map((event) => ({
      id: event.id,
      source: event.source,
      timestamp: event.timestamp,
      content: event.content.substring(0, 200) + (event.content.length > 200 ? '...' : ''),
      processed: event.processedBySynthesis,
      classification: event.initialClassification,
      metadata: event.metadata,
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      total: events.length,
    });
  } catch (error) {
    console.error('[API/Systems/Events] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
