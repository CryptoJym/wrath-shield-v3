import { NextRequest, NextResponse } from 'next/server';
import {
  runSync,
  getSyncHistory,
  getLastSuccessfulSync,
  isSyncRunning,
} from '@/lib/pm/sync-service';

/**
 * GET /api/pm/sync
 *
 * Get GitHub sync status and history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'status') {
      const isRunning = isSyncRunning();
      const lastSync = getLastSuccessfulSync();

      return NextResponse.json({
        isRunning,
        lastSync,
        source: 'github',
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'history') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const history = getSyncHistory(limit);

      return NextResponse.json({
        history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: status, history' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PM Sync API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pm/sync
 *
 * Start a GitHub sync operation
 *
 * Body:
 * {
 *   dryRun?: boolean,
 *   repoFilter?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const {
      dryRun = false,
      repoFilter,
    } = body;

    // Check if already running
    if (isSyncRunning()) {
      return NextResponse.json(
        { error: 'A sync operation is already in progress' },
        { status: 409 }
      );
    }

    // Run GitHub sync
    const result = await runSync({
      dryRun,
      repoFilter,
    });

    return NextResponse.json({
      message: dryRun ? 'Dry run completed' : 'GitHub sync completed',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PM Sync API] POST Error:', error);
    return NextResponse.json(
      { error: 'Sync operation failed', details: String(error) },
      { status: 500 }
    );
  }
}
