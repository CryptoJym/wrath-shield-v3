/**
 * PM Requests API
 *
 * GET /api/pm/requests - Returns all context requests routed to PM
 * Provides detailed list of all PM items with full metadata
 */

import { NextResponse } from 'next/server';
import { getAllContextRequests } from '@/lib/context_requests';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all PM-routed requests
    const pmRequests = getAllContextRequests({
      target: 'pm',
    });

    // No seed data - if no real requests exist, return empty array (actual state)

    // Calculate some additional metrics
    const now = Math.floor(Date.now() / 1000);
    const enrichedRequests = pmRequests.map((req: any) => ({
      ...req,
      age_seconds: now - req.created_at,
      age_hours: Math.floor((now - req.created_at) / 3600),
      is_overdue: req.status === 'pending' && (now - req.created_at) > 86400, // 24 hours
    }));

    // Sort by created_at descending (newest first)
    enrichedRequests.sort((a, b) => b.created_at - a.created_at);

    return NextResponse.json({
      ok: true,
      count: enrichedRequests.length,
      requests: enrichedRequests,
      stats: {
        total: enrichedRequests.length,
        pending: enrichedRequests.filter((r: any) => r.status === 'pending').length,
        processing: enrichedRequests.filter((r: any) => r.status === 'processing').length,
        done: enrichedRequests.filter((r: any) => r.status === 'done').length,
        failed: enrichedRequests.filter((r: any) => r.status === 'failed').length,
        overdue: enrichedRequests.filter((r: any) => r.is_overdue).length,
      },
    });
  } catch (error) {
    console.error('[PM Requests API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
