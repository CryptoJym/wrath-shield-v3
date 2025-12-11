/**
 * Systems Decisions API
 *
 * GET: Fetch recent decisions for visualization with resolution outcomes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDecisionQueue } from '@/lib/cortex/decision-queue';

// GET /api/systems/decisions - Get recent decisions with outcomes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const queue = getDecisionQueue();

    // Get decisions with different statuses
    const [pending, resolved] = await Promise.all([
      queue.getPendingDecisions({ limit: Math.ceil(limit / 2) }),
      status === 'pending' ? [] : queue.getResolvedDecisions(Math.floor(limit / 2)),
    ]);

    // Combine and format
    const decisions = [...pending, ...resolved]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((decision) => {
        const summary = decision.summary || '';
        return {
          id: decision.id,
          title: decision.title,
          description: summary.substring(0, 150) + (summary.length > 150 ? '...' : ''),
          domain: decision.domain,
          priority: decision.priority,
          status: decision.status,
          createdAt: decision.createdAt,
          resolvedAt: decision.resolvedAt,
          selectedOption: decision.selectedOptionId
            ? decision.options.find((o) => o.id === decision.selectedOptionId)?.label
            : null,
          optionsCount: decision.options.length,
          userFeedback: decision.userFeedback,
        };
      });

    return NextResponse.json({
      success: true,
      decisions,
      counts: {
        pending: pending.length,
        resolved: resolved.length,
      },
    });
  } catch (error) {
    console.error('[API/Systems/Decisions] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
