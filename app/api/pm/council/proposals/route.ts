/**
 * PM Council Proposals API
 *
 * GET /api/pm/council/proposals - List proposals needing review
 * POST /api/pm/council/proposals - Approve, reject, or defer a proposal
 *
 * Proposals are queue items with triage.escalation_level = 'propose'
 * that need human review before execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { getActionableItems } from '@/lib/pm/daily-digest';
import { getQueuedItem, updateQueuedItemStatus } from '@/lib/pm/task-queue';
import { createTaskFromSignal } from '@/lib/pm/integration';
import { recordCorrection, type CorrectionType } from '@/lib/pm/correction-feedback';

export const dynamic = 'force-dynamic';

interface ProposalAction {
  proposal_id: string;
  action: 'approve' | 'reject' | 'defer';
  reason?: string;
  modified_params?: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  ensureServerOnly('api/pm/council/proposals');

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'pending';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 20;

    // Get actionable items (includes proposals)
    const { proposals } = await getActionableItems();

    // Filter by status if needed
    const filteredProposals = proposals.filter(p => {
      if (statusFilter === 'pending') return true; // All actionable proposals are pending
      return false; // Other statuses would need to query queue history
    });

    return NextResponse.json({
      ok: true,
      proposals: filteredProposals.slice(0, limit),
      total: filteredProposals.length,
    });
  } catch (error) {
    console.error('[PM Council Proposals API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureServerOnly('api/pm/council/proposals');

  try {
    const body: ProposalAction = await req.json();
    const { proposal_id, action, reason, modified_params } = body;

    if (!proposal_id || !action) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: proposal_id, action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'defer'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be: approve, reject, or defer' },
        { status: 400 }
      );
    }

    // Get the queue item
    const queueItem = await getQueuedItem(proposal_id);

    if (!queueItem) {
      return NextResponse.json(
        { ok: false, error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Access triage.escalation_level from the nested object
    if (queueItem.triage.escalation_level !== 'propose') {
      return NextResponse.json(
        { ok: false, error: 'Queue item is not a proposal' },
        { status: 400 }
      );
    }

    let result: Record<string, unknown> = {};

    if (action === 'approve') {
      // Build signal from nested queueItem.signal
      const signal = {
        id: queueItem.signal.id,
        source: queueItem.signal.source,
        signal_type: queueItem.signal.signal_type,
        payload: queueItem.signal.payload,
        timestamp: queueItem.signal.timestamp,
        confidence: queueItem.signal.confidence,
      };

      // Build triage from nested queueItem.triage
      const triage = {
        action: queueItem.triage.action,
        rationale: queueItem.triage.rationale,
        priority: queueItem.triage.priority,
        escalation_level: queueItem.triage.escalation_level,
        due_date: queueItem.triage.due_date,
        assigned_project: queueItem.triage.assigned_project,
        suggested_title: queueItem.triage.suggested_title,
        suggested_labels: queueItem.triage.suggested_labels,
        metadata: queueItem.triage.metadata,
      };

      // Apply modified parameters if provided
      if (modified_params) {
        if (modified_params.priority) triage.priority = modified_params.priority as typeof triage.priority;
        if (modified_params.due_date) triage.due_date = modified_params.due_date as string;
        if (modified_params.assigned_project) {
          triage.assigned_project = modified_params.assigned_project as string;
        }
      }

      // Create the task
      const task = await createTaskFromSignal(signal, triage);

      if (task) {
        result = {
          executed: true,
          task_created: true,
          task_id: task.id,
        };

        // Update queue item status
        await updateQueuedItemStatus(proposal_id, 'completed');
      } else {
        result = {
          executed: false,
          error: 'Failed to create task',
        };
        await updateQueuedItemStatus(proposal_id, 'failed');
      }
    } else if (action === 'reject') {
      // Record as correction for learning
      const originalValue = {
        action: queueItem.triage.action,
        priority: queueItem.triage.priority,
      };

      await recordCorrection({
        correction_type: 'suggestion' as CorrectionType,
        original_entity_type: 'signal',
        original_entity_id: queueItem.signal.id,
        original_value: originalValue,
        corrected_value: { rejected: true },
        context: queueItem.signal.payload as Record<string, unknown>,
        reason: reason || 'User rejected proposal',
      });

      // Update queue item status
      await updateQueuedItemStatus(proposal_id, 'completed');

      result = {
        rejected: true,
        correction_recorded: true,
      };
    } else if (action === 'defer') {
      // Update queue item status to deferred
      await updateQueuedItemStatus(proposal_id, 'deferred');

      result = {
        deferred: true,
      };
    }

    return NextResponse.json({
      ok: true,
      proposal_id,
      action,
      ...result,
    });
  } catch (error) {
    console.error('[PM Council Proposals API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
