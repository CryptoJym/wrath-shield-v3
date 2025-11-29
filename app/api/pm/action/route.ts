/**
 * PM Action API
 *
 * POST /api/pm/action - Handle accept/reject/complete actions for PM items
 * Actions:
 * - accept: Move pending item to processing (in-progress)
 * - reject: Mark item as failed and route back or dismiss
 * - complete: Mark processing item as done with optional resolution
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getContextRequest,
  updateContextRequestStatus,
  loadContextRequestStore,
  saveContextRequestStore,
} from '@/lib/context_requests';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, resolution } = body;

    if (!id || !action) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: id, action' },
        { status: 400 }
      );
    }

    const validActions = ['accept', 'reject', 'complete'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { ok: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Get the context request
    const request = getContextRequest(id);
    if (!request) {
      return NextResponse.json(
        { ok: false, error: 'Context request not found' },
        { status: 404 }
      );
    }

    // Verify this is a PM-routed item
    if (request.target !== 'pm') {
      return NextResponse.json(
        { ok: false, error: 'This item is not routed to PM' },
        { status: 400 }
      );
    }

    let updatedRequest;

    switch (action) {
      case 'accept':
        // Move from pending to processing
        if (request.status !== 'pending') {
          return NextResponse.json(
            { ok: false, error: 'Can only accept pending items' },
            { status: 400 }
          );
        }
        updatedRequest = updateContextRequestStatus(
          id,
          'processing',
          'Accepted by PM - work in progress'
        );
        break;

      case 'reject':
        // Mark as failed
        if (request.status === 'done') {
          return NextResponse.json(
            { ok: false, error: 'Cannot reject completed items' },
            { status: 400 }
          );
        }
        updatedRequest = updateContextRequestStatus(
          id,
          'failed',
          resolution || 'Rejected by PM - not applicable or requires clarification'
        );
        break;

      case 'complete':
        // Mark as done
        if (request.status !== 'processing') {
          return NextResponse.json(
            { ok: false, error: 'Can only complete in-progress items' },
            { status: 400 }
          );
        }
        updatedRequest = updateContextRequestStatus(
          id,
          'done',
          resolution || 'Completed by PM'
        );
        break;

      default:
        return NextResponse.json(
          { ok: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { ok: false, error: 'Failed to update request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      action,
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        resolution_summary: updatedRequest.resolution_summary,
        updated_at: updatedRequest.updated_at,
      },
    });
  } catch (error) {
    console.error('[PM Action API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
