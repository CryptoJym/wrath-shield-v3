import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingOrgProposals,
  getAllOrgProposals,
  getProposalCounts,
  approveOrgProposal,
  rejectOrgProposal,
  proposeOrgMemory,
  searchOrgMemory,
  getUnreadNotificationCount,
  getUnreadNotifications,
  markNotificationsRead,
  type AgentId,
} from '@/lib/memory/zep';

/**
 * Org-Council Memory API
 *
 * Manages the shared organizational knowledge graph that requires
 * council approval before edits are persisted.
 *
 * GET - List proposals, search org memory, or get notifications
 * POST - Create a new proposal or mark notifications read
 * PUT - Approve or reject a proposal
 */

// GET /api/memory/council?action=proposals|search|notifications&status=...&query=...
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'proposals';

    if (action === 'proposals') {
      // Get proposals with optional status filter
      const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
      const limit = parseInt(searchParams.get('limit') || '50', 10);

      let proposals;
      if (status) {
        proposals = getAllOrgProposals(status, limit);
      } else {
        // Default to pending only for backwards compat
        proposals = getPendingOrgProposals();
      }

      const counts = getProposalCounts();

      return NextResponse.json({
        proposals,
        count: proposals.length,
        counts,
      });
    }

    if (action === 'search') {
      // Search org-council memory
      const query = searchParams.get('query') || '*';
      const limit = parseInt(searchParams.get('limit') || '10', 10);

      const results = await searchOrgMemory(query, limit);
      return NextResponse.json({
        results,
        count: results.length,
        query,
      });
    }

    if (action === 'notifications') {
      // Get notification count and optionally full notifications
      const recipient = searchParams.get('recipient') || 'council';
      const includeDetails = searchParams.get('details') === 'true';

      const unreadCount = getUnreadNotificationCount(recipient);

      if (includeDetails) {
        const notifications = getUnreadNotifications(recipient);
        return NextResponse.json({
          unreadCount,
          notifications,
        });
      }

      return NextResponse.json({ unreadCount });
    }

    if (action === 'counts') {
      // Just get counts
      const counts = getProposalCounts();
      return NextResponse.json({ counts });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Council API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch council data', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/memory/council - Create a new proposal or mark notifications read
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle mark notifications read
    if (body.action === 'markRead') {
      const { recipient, proposalIds } = body;
      const count = markNotificationsRead(recipient || 'council', proposalIds);
      return NextResponse.json({
        success: true,
        markedRead: count,
      });
    }

    // Handle create proposal
    const { agentId, knowledge, metadata } = body;

    if (!agentId || !knowledge) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, knowledge' },
        { status: 400 }
      );
    }

    const proposal = await proposeOrgMemory(agentId as AgentId, knowledge, metadata);

    return NextResponse.json({
      success: true,
      proposal,
      message: 'Proposal created and pending council review',
    });
  } catch (error: any) {
    console.error('[Council API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/memory/council - Approve or reject a proposal
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, action, reviewedBy } = body;

    if (!proposalId || !action || !reviewedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: proposalId, action, reviewedBy' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    let success: boolean;
    if (action === 'approve') {
      success = await approveOrgProposal(proposalId, reviewedBy);
    } else {
      success = rejectOrgProposal(proposalId, reviewedBy);
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Proposal not found or already processed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      proposalId,
      action,
      reviewedBy,
      message: `Proposal ${action}d successfully`,
    });
  } catch (error: any) {
    console.error('[Council API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to process proposal', details: error.message },
      { status: 500 }
    );
  }
}
