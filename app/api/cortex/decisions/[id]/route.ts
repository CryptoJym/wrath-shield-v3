/**
 * Decision Queue API - Single Decision
 *
 * GET: Get a specific decision by ID
 * PATCH: Mark decision as presented (shown to user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDecisionQueue } from '@/lib/cortex/decision-queue';

// GET /api/cortex/decisions/[id] - Get a specific decision
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const queue = getDecisionQueue();
    const decision = await queue.getDecision(id);

    if (!decision) {
      return NextResponse.json(
        {
          success: false,
          error: 'Decision not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (error) {
    console.error('[API/Decisions] GET [id] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/cortex/decisions/[id] - Mark as presented
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const queue = getDecisionQueue();

    // Mark this decision as presented
    await queue.markAsPresented([id]);

    return NextResponse.json({
      success: true,
      message: `Decision ${id} marked as presented`,
    });
  } catch (error) {
    console.error('[API/Decisions] PATCH [id] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
