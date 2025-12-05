/**
 * PM Queue Management API
 *
 * GET /api/pm/queue - View queue status and items
 * POST /api/pm/queue - Manually enqueue a signal
 * PATCH /api/pm/queue - Update queue item status or retry
 * DELETE /api/pm/queue - Remove item from queue
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getQueueStatus,
  getQueuedItemsByStatus,
  enqueueSignal,
  getQueuedItem,
  retryQueuedItem,
  updateQueuedItemStatus,
  deleteQueuedItem,
  type IncomingSignal,
  type QueueItemStatus,
} from '@/lib/pm/task-queue';

export const dynamic = 'force-dynamic';

/**
 * GET - View queue status or items by status
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as QueueItemStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const queueId = searchParams.get('queue_id');

    // Get specific item
    if (queueId) {
      const item = await getQueuedItem(queueId);
      if (!item) {
        return NextResponse.json(
          { ok: false, error: 'Queue item not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, item });
    }

    // Get items by status
    if (status) {
      const items = await getQueuedItemsByStatus(status, limit, offset);
      return NextResponse.json({
        ok: true,
        status,
        count: items.length,
        items,
      });
    }

    // Get overall queue status
    const queueStatus = await getQueueStatus();
    return NextResponse.json({
      ok: true,
      status: queueStatus,
    });
  } catch (error) {
    console.error('[PM Queue API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually enqueue a signal
 */
export async function POST(req: NextRequest) {
  try {
    const signal: IncomingSignal = await req.json();

    // Validate signal
    if (!signal.source || !signal.signal_type || !signal.payload) {
      return NextResponse.json(
        { ok: false, error: 'Invalid signal: missing required fields (source, signal_type, payload)' },
        { status: 400 }
      );
    }

    // Set defaults
    if (!signal.id) {
      signal.id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!signal.timestamp) {
      signal.timestamp = Date.now();
    }
    if (signal.confidence === undefined) {
      signal.confidence = 0.5; // Default to medium confidence
    }

    const queueId = await enqueueSignal(signal);
    const item = await getQueuedItem(queueId);

    return NextResponse.json({
      ok: true,
      queue_id: queueId,
      item,
    });
  } catch (error) {
    console.error('[PM Queue API] POST error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update queue item status or retry
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { queue_id, status, retry } = body;

    if (!queue_id) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: queue_id' },
        { status: 400 }
      );
    }

    // Retry failed item
    if (retry) {
      const success = await retryQueuedItem(queue_id);
      if (!success) {
        return NextResponse.json(
          { ok: false, error: 'Failed to retry item (not found or not in failed status)' },
          { status: 404 }
        );
      }
      const item = await getQueuedItem(queue_id);
      return NextResponse.json({ ok: true, retried: true, item });
    }

    // Update status
    if (status) {
      const success = await updateQueuedItemStatus(queue_id, status as QueueItemStatus);
      if (!success) {
        return NextResponse.json(
          { ok: false, error: 'Failed to update status (item not found)' },
          { status: 404 }
        );
      }
      const item = await getQueuedItem(queue_id);
      return NextResponse.json({ ok: true, updated: true, item });
    }

    return NextResponse.json(
      { ok: false, error: 'No action specified (provide status or retry)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PM Queue API] PATCH error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove item from queue
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queue_id = searchParams.get('queue_id');

    if (!queue_id) {
      return NextResponse.json(
        { ok: false, error: 'Missing required parameter: queue_id' },
        { status: 400 }
      );
    }

    const success = await deleteQueuedItem(queue_id);
    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'Failed to delete item (not found)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deleted: queue_id });
  } catch (error) {
    console.error('[PM Queue API] DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
