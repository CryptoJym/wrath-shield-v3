/**
 * Approvals API - Individual Approval Actions
 *
 * GET /api/approvals/[id] - Get a specific approval
 * POST /api/approvals/[id] - Approve, reject, or modify an approval
 *
 * Actions:
 * - approve: Execute the proposed action
 * - reject: Mark as dismissed
 * - modify: Edit content before approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { agentInvoker, invokeAgent } from '@/lib/agents/AgentInvoker';
import { getApprovalDecision, setApprovalDecision } from '../route';

export const dynamic = 'force-dynamic';

interface ApprovalAction {
  action: 'approve' | 'reject' | 'modify';
  /** Modified content (required for 'modify' action) */
  modifiedContent?: string;
  /** Reason for the decision */
  reason?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureServerOnly('api/approvals/[id]');

  try {
    const { id } = await params;

    // Find the approval in the activity log
    const pendingEscalations = agentInvoker.getPendingEscalations();
    const activity = pendingEscalations.find(a => a.id === id);

    if (!activity) {
      return NextResponse.json(
        { ok: false, error: 'Approval not found' },
        { status: 404 }
      );
    }

    const decision = getApprovalDecision(id);

    return NextResponse.json({
      ok: true,
      approval: {
        ...activity,
        reviewed: !!decision,
        decision: decision?.decision,
        decidedAt: decision?.decidedAt,
        modifiedContent: decision?.modifiedContent,
      },
    });
  } catch (error) {
    console.error('[Approvals API] GET [id] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureServerOnly('api/approvals/[id]');

  try {
    const { id } = await params;
    const body: ApprovalAction = await req.json();
    const { action, modifiedContent, reason } = body;

    if (!action || !['approve', 'reject', 'modify'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be: approve, reject, or modify' },
        { status: 400 }
      );
    }

    if (action === 'modify' && !modifiedContent) {
      return NextResponse.json(
        { ok: false, error: 'modifiedContent is required for modify action' },
        { status: 400 }
      );
    }

    // Find the approval in the activity log
    const pendingEscalations = agentInvoker.getPendingEscalations();
    const activity = pendingEscalations.find(a => a.id === id);

    if (!activity) {
      return NextResponse.json(
        { ok: false, error: 'Approval not found' },
        { status: 404 }
      );
    }

    // Check if already reviewed
    const existingDecision = getApprovalDecision(id);
    if (existingDecision) {
      return NextResponse.json(
        { ok: false, error: `Approval already ${existingDecision.decision}` },
        { status: 400 }
      );
    }

    let executionResult: { content?: string; error?: string } | null = null;

    // Handle the action
    if (action === 'approve' || action === 'modify') {
      // Execute the proposed action with forceExecute
      try {
        const contentToUse = action === 'modify' ? modifiedContent! : activity.input;

        const response = await invokeAgent({
          agentId: activity.agentId,
          userMessage: contentToUse,
          forceExecute: true, // Bypass escalation check
          context: {
            domainId: activity.domainId,
            metadata: {
              approvalId: id,
              approvalAction: action,
              originalContent: activity.input,
            },
          },
        });

        executionResult = { content: response.content };
      } catch (error) {
        executionResult = { error: error instanceof Error ? error.message : 'Execution failed' };
      }
    }

    // Convert action to decision format
    const decisionMap: Record<'approve' | 'reject' | 'modify', 'approved' | 'rejected' | 'modified'> = {
      approve: 'approved',
      reject: 'rejected',
      modify: 'modified',
    };
    const decision = decisionMap[action];

    // Record the decision
    setApprovalDecision(id, decision, action === 'modify' ? modifiedContent : undefined);

    console.log(`[Approvals API] ${action.toUpperCase()} approval ${id} for agent ${activity.agentId}${reason ? ` - Reason: ${reason}` : ''}`);

    return NextResponse.json({
      ok: true,
      approval_id: id,
      action,
      agent_id: activity.agentId,
      decided_at: new Date().toISOString(),
      reason,
      execution_result: executionResult,
    });
  } catch (error) {
    console.error('[Approvals API] POST [id] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
