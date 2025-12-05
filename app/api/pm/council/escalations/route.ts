/**
 * PM Council Escalations API
 *
 * GET /api/pm/council/escalations - List critical escalations
 * POST /api/pm/council/escalations - Acknowledge, resolve, or snooze escalation
 *
 * Escalations are queue items with triage.escalation_level = 'critical'
 * that require immediate attention.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/utils/server-only';
import { getActionableItems } from '@/lib/pm/daily-digest';
import { getQueuedItem, updateQueuedItemStatus } from '@/lib/pm/task-queue';

export const dynamic = 'force-dynamic';

interface EscalationAction {
  escalation_id: string;
  action: 'acknowledge' | 'resolve' | 'snooze';
  resolution?: string;
  snooze_until?: string;
}

export async function GET(req: NextRequest) {
  ensureServerOnly('api/pm/council/escalations');

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const severityFilter = searchParams.get('severity');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 20;

    // Get actionable items (includes escalations)
    const { escalations } = await getActionableItems();

    // Filter by severity if specified
    let filteredEscalations = escalations;
    if (severityFilter && ['warning', 'critical'].includes(severityFilter)) {
      filteredEscalations = escalations.filter(e => e.severity === severityFilter);
    }

    // Filter by status if specified (would need to track acknowledgment in metadata)
    if (statusFilter && statusFilter !== 'active') {
      // For now, all escalations from getActionableItems are 'active'
      // To support acknowledged/resolved, we'd need to check queue item metadata
      filteredEscalations = [];
    }

    return NextResponse.json({
      ok: true,
      escalations: filteredEscalations.slice(0, limit),
      total: filteredEscalations.length,
    });
  } catch (error) {
    console.error('[PM Council Escalations API] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureServerOnly('api/pm/council/escalations');

  try {
    const body: EscalationAction = await req.json();
    const { escalation_id, action, resolution, snooze_until } = body;

    if (!escalation_id || !action) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: escalation_id, action' },
        { status: 400 }
      );
    }

    if (!['acknowledge', 'resolve', 'snooze'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Must be: acknowledge, resolve, or snooze' },
        { status: 400 }
      );
    }

    // Get the queue item
    const queueItem = await getQueuedItem(escalation_id);

    if (!queueItem) {
      return NextResponse.json(
        { ok: false, error: 'Escalation not found' },
        { status: 404 }
      );
    }

    // Access triage.escalation_level from the nested object
    if (queueItem.triage.escalation_level !== 'critical') {
      return NextResponse.json(
        { ok: false, error: 'Queue item is not a critical escalation' },
        { status: 400 }
      );
    }

    let result: Record<string, unknown> = {};
    let newStatus: 'pending' | 'completed' | 'deferred' = 'pending';

    if (action === 'acknowledge') {
      // For acknowledge, we keep status pending but track in metadata
      // Since updateQueuedItemStatus only takes 2 args, we just update status
      // In a real implementation, we'd update metadata separately
      newStatus = 'pending';
      result = {
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      };
    } else if (action === 'resolve') {
      // Mark as completed
      await updateQueuedItemStatus(escalation_id, 'completed');
      newStatus = 'completed';
      result = {
        resolved: true,
        resolution: resolution || 'Resolved by user',
      };
    } else if (action === 'snooze') {
      if (!snooze_until) {
        return NextResponse.json(
          { ok: false, error: 'snooze_until is required for snooze action' },
          { status: 400 }
        );
      }

      const snoozeDate = new Date(snooze_until);
      if (isNaN(snoozeDate.getTime())) {
        return NextResponse.json(
          { ok: false, error: 'Invalid snooze_until date. Must be valid ISO timestamp.' },
          { status: 400 }
        );
      }

      // Mark as deferred
      await updateQueuedItemStatus(escalation_id, 'deferred');
      newStatus = 'deferred';
      result = {
        snoozed: true,
        snooze_until,
      };
    }

    return NextResponse.json({
      ok: true,
      escalation_id,
      action,
      new_status: newStatus,
      ...result,
    });
  } catch (error) {
    console.error('[PM Council Escalations API] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
