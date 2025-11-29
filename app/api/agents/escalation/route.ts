/**
 * Escalation API Endpoint
 *
 * Manages escalation workflow for CRITICAL and PROPOSE items.
 *
 * GET /api/agents/escalation - List pending escalations
 * POST /api/agents/escalation/approve - Approve a pending escalation
 * POST /api/agents/escalation/reject - Reject a pending escalation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingEscalations,
  approveEscalatedRequest,
  dismissEscalatedRequest,
  getContextRequest,
  type ContextRequest,
} from '@/lib/context_requests';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/escalation
 * Returns all pending escalations (CRITICAL and PROPOSE items awaiting approval)
 */
export async function GET(req: NextRequest) {
  try {
    const pendingEscalations = getPendingEscalations();

    // Enrich with escalation metadata
    const enriched = pendingEscalations.map((esc) => ({
      ...esc,
      escalation_type: esc.escalation_level === 'CRITICAL' ? 'critical' : 'propose',
      age_seconds: Math.floor(Date.now() / 1000) - esc.created_at,
      proposed_agents: esc.dispatched_to || [],
    }));

    // Sort by escalation level (CRITICAL first) then by age
    enriched.sort((a, b) => {
      if (a.escalation_level === 'CRITICAL' && b.escalation_level !== 'CRITICAL') return -1;
      if (b.escalation_level === 'CRITICAL' && a.escalation_level !== 'CRITICAL') return 1;
      return b.created_at - a.created_at;
    });

    return NextResponse.json({
      pending: enriched,
      counts: {
        critical: enriched.filter((e) => e.escalation_level === 'CRITICAL').length,
        propose: enriched.filter((e) => e.escalation_level === 'PROPOSE').length,
        total: enriched.length,
      },
    });
  } catch (error) {
    console.error('[Escalation API] Error fetching pending:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/escalation
 * Approve or reject an escalation
 *
 * Body: { action: 'approve' | 'reject', requestId: string, reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, requestId, reason } = body;

    if (!action || !requestId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, requestId' },
        { status: 400 }
      );
    }

    // Verify request exists
    const existing = getContextRequest(requestId);
    if (!existing) {
      return NextResponse.json(
        { error: `Request not found: ${requestId}` },
        { status: 404 }
      );
    }

    let result: ContextRequest | null = null;

    if (action === 'approve') {
      result = approveEscalatedRequest(requestId);
      if (result) {
        return NextResponse.json({
          success: true,
          message: `Escalation approved. Dispatched to: ${result.dispatched_to?.join(', ') || 'unknown'}`,
          request: result,
        });
      }
    } else if (action === 'reject' || action === 'dismiss') {
      result = dismissEscalatedRequest(requestId, reason);
      if (result) {
        return NextResponse.json({
          success: true,
          message: `Escalation dismissed: ${reason || 'No reason provided'}`,
          request: result,
        });
      }
    } else {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Use 'approve' or 'reject'` },
        { status: 400 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to process escalation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, request: result });
  } catch (error) {
    console.error('[Escalation API] Error processing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
