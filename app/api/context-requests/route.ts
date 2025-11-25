/**
 * Context Requests API
 *
 * GET /api/context-requests - List context requests with optional filters
 * POST /api/context-requests - Actions: updateStatus, addFollowUp, dispatch
 */

import { NextResponse } from 'next/server';
import {
  getAllContextRequests,
  getContextRequest,
  getRoutingStats,
  getPendingCountByTarget,
  updateContextRequestStatus,
  addFollowUpQuestion,
  orchestratorDispatch,
  type RoutingTarget,
  type RequestStatus,
} from '@/lib/context_requests';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const target = searchParams.get('target') as RoutingTarget | null;
    const status = searchParams.get('status') as RequestStatus | null;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      return NextResponse.json({
        success: true,
        stats: getRoutingStats(),
        pending_by_target: getPendingCountByTarget(),
      });
    }

    const requests = getAllContextRequests({
      limit,
      target: target || undefined,
      status: status || undefined,
    });

    return NextResponse.json({
      success: true,
      requests,
      count: requests.length,
      stats: getRoutingStats(),
      pending_by_target: getPendingCountByTarget(),
    });
  } catch (error) {
    console.error('[Context Requests API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, requestId, status, resolution, question } = body;

    switch (action) {
      case 'updateStatus': {
        if (!requestId || !status) {
          return NextResponse.json(
            { success: false, error: 'requestId and status required' },
            { status: 400 }
          );
        }
        const updated = updateContextRequestStatus(requestId, status, resolution);
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Request not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          request: updated,
        });
      }

      case 'addFollowUp': {
        if (!requestId || !question) {
          return NextResponse.json(
            { success: false, error: 'requestId and question required' },
            { status: 400 }
          );
        }
        const updated = addFollowUpQuestion(requestId, question);
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Request not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          request: updated,
        });
      }

      case 'dispatch': {
        if (!requestId) {
          return NextResponse.json(
            { success: false, error: 'requestId required' },
            { status: 400 }
          );
        }
        const dispatched = orchestratorDispatch(requestId);
        if (!dispatched) {
          return NextResponse.json(
            { success: false, error: 'Request not found or not an orchestrator request' },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          request: dispatched,
          dispatched_to: dispatched.dispatched_to,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: updateStatus, addFollowUp, dispatch' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Context Requests API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
