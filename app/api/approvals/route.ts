/**
 * Approvals API - Get Pending Approvals
 *
 * GET /api/approvals - List all PROPOSE-level items awaiting human approval
 *
 * Returns agent activities that have escalationLevel = 'PROPOSE' and were not executed.
 * These are proposals from agents that require human review before action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { agentInvoker, type AgentActivity } from '@/lib/agents/AgentInvoker';

export const dynamic = 'force-dynamic';

export interface PendingApproval extends AgentActivity {
  /** Whether this approval has been reviewed (approved/rejected) */
  reviewed?: boolean;
  /** The decision made: 'approved' | 'rejected' | 'modified' */
  decision?: 'approved' | 'rejected' | 'modified';
  /** Timestamp of the decision */
  decidedAt?: string;
  /** Modified content (if decision was 'modified') */
  modifiedContent?: string;
}

// In-memory store for approval decisions (will be persisted in future phase)
const approvalDecisions: Map<string, {
  decision: 'approved' | 'rejected' | 'modified';
  decidedAt: string;
  modifiedContent?: string;
}> = new Map();

export function getApprovalDecision(id: string) {
  return approvalDecisions.get(id);
}

export function setApprovalDecision(id: string, decision: 'approved' | 'rejected' | 'modified', modifiedContent?: string) {
  approvalDecisions.set(id, {
    decision,
    decidedAt: new Date().toISOString(),
    modifiedContent,
  });
}

export async function GET(req: NextRequest) {
  ensureServerOnly('api/approvals');

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // 'pending' | 'reviewed' | 'all'
    const agentFilter = searchParams.get('agent');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // Get pending escalations from AgentInvoker
    const pendingEscalations = agentInvoker.getPendingEscalations();

    // Enrich with approval decision status
    let approvals: PendingApproval[] = pendingEscalations.map((activity) => {
      const decision = approvalDecisions.get(activity.id);
      return {
        ...activity,
        reviewed: !!decision,
        decision: decision?.decision,
        decidedAt: decision?.decidedAt,
        modifiedContent: decision?.modifiedContent,
      };
    });

    // Filter by status
    if (statusFilter === 'pending') {
      approvals = approvals.filter(a => !a.reviewed);
    } else if (statusFilter === 'reviewed') {
      approvals = approvals.filter(a => a.reviewed);
    }

    // Filter by agent
    if (agentFilter) {
      approvals = approvals.filter(a => a.agentId === agentFilter);
    }

    // Sort by timestamp (newest first)
    approvals.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    approvals = approvals.slice(0, limit);

    // Calculate counts
    const allEscalations = agentInvoker.getPendingEscalations();
    const counts = {
      pending: allEscalations.filter(a => !approvalDecisions.has(a.id)).length,
      approved: Array.from(approvalDecisions.values()).filter(d => d.decision === 'approved').length,
      rejected: Array.from(approvalDecisions.values()).filter(d => d.decision === 'rejected').length,
      modified: Array.from(approvalDecisions.values()).filter(d => d.decision === 'modified').length,
      total: allEscalations.length,
    };

    return NextResponse.json({
      ok: true,
      approvals,
      counts,
    });
  } catch (error) {
    console.error('[Approvals API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
