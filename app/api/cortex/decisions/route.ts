/**
 * Decision Queue API
 *
 * Manages pending decisions that require human input.
 * Part of the NEEDS_DECISION escalation flow from the Life Charter.
 *
 * GET: List pending decisions with optional filters
 * POST: Resolve a decision with selected option
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDecisionQueue,
  type DecisionStatus,
  type ResolveDecisionInput,
} from '@/lib/cortex/decision-queue';
import type { Domain } from '@/lib/life-os-config';

// GET /api/cortex/decisions - List pending decisions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as DecisionStatus | null;
    const domain = searchParams.get('domain') as Domain['id'] | null;
    const priority = searchParams.get('priority') as 'critical' | 'high' | 'medium' | 'low' | null;
    const limit = searchParams.get('limit');

    const queue = getDecisionQueue();

    const filters: {
      status?: DecisionStatus;
      domain?: Domain['id'];
      priority?: 'critical' | 'high' | 'medium' | 'low';
      limit?: number;
    } = {};

    if (status) filters.status = status;
    if (domain) filters.domain = domain;
    if (priority) filters.priority = priority;
    if (limit) filters.limit = parseInt(limit, 10);

    const decisions = await queue.getPendingDecisions(filters);

    return NextResponse.json({
      success: true,
      decisions,
      count: decisions.length,
    });
  } catch (error) {
    console.error('[API/Decisions] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/cortex/decisions - Resolve a decision
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.decisionId || !body.selectedOptionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: decisionId, selectedOptionId',
        },
        { status: 400 }
      );
    }

    const input: ResolveDecisionInput = {
      decisionId: body.decisionId,
      selectedOptionId: body.selectedOptionId,
      userFeedback: body.userFeedback,
    };

    const queue = getDecisionQueue();
    await queue.resolveDecision(input);

    return NextResponse.json({
      success: true,
      message: `Decision ${input.decisionId} resolved`,
    });
  } catch (error) {
    console.error('[API/Decisions] POST failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
