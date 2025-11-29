/**
 * Privacy API Route - Data Purge Operations
 *
 * Handles secure deletion of data by source (WHOOP or Limitless).
 * Ensures complete removal with no residual data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';

ensureServerOnly('privacy/purge');

/**
 * Purge all data for a specific source
 *
 * Deletes all records associated with the source including:
 * - WHOOP: cycles, recoveries, sleeps, OAuth tokens
 * - Limitless: lifelogs, API key settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source } = body;

    // Validate source parameter
    if (!source) {
      return NextResponse.json(
        { error: 'Missing required parameter: source' },
        { status: 400 }
      );
    }

    if (source !== 'whoop' && source !== 'limitless') {
      return NextResponse.json(
        { error: 'Invalid source. Must be "whoop" or "limitless"' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid circular dependencies
    const { Database } = await import('@/lib/db/Database');
    const db = Database.getInstance().getRawDb();

    let deletedRecords = 0;

    if (source === 'whoop') {
      // Delete all WHOOP-related data
      const cyclesResult = db.prepare('DELETE FROM cycles').run();
      const recoveriesResult = db.prepare('DELETE FROM recoveries').run();
      const sleepsResult = db.prepare('DELETE FROM sleeps').run();
      const tokensResult = db.prepare('DELETE FROM tokens WHERE provider = ?').run('whoop');

      deletedRecords =
        (cyclesResult.changes || 0) +
        (recoveriesResult.changes || 0) +
        (sleepsResult.changes || 0) +
        (tokensResult.changes || 0);

      console.log(`[Privacy] Purged ${deletedRecords} WHOOP records`);

    } else if (source === 'limitless') {
      // Delete all Limitless-related data
      const lifelogsResult = db.prepare('DELETE FROM lifelogs').run();
      const settingsResult = db.prepare("DELETE FROM settings WHERE key = 'limitless_api_key'").run();
      const pullTimestampResult = db.prepare("DELETE FROM settings WHERE key = 'limitless_last_pull'").run();

      deletedRecords =
        (lifelogsResult.changes || 0) +
        (settingsResult.changes || 0) +
        (pullTimestampResult.changes || 0);

      console.log(`[Privacy] Purged ${deletedRecords} Limitless records`);
    }

    return NextResponse.json({
      success: true,
      source,
      deletedRecords,
      message: `Successfully purged ${deletedRecords} ${source} records`,
    }, { status: 200 });

  } catch (error) {
    console.error('[Privacy] Purge operation failed:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'Failed to purge data. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Get purge status and counts for each source
 *
 * Returns the number of records that would be deleted for each source
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');

    if (!source) {
      return NextResponse.json(
        { error: 'Missing required parameter: source' },
        { status: 400 }
      );
    }

    if (source !== 'whoop' && source !== 'limitless') {
      return NextResponse.json(
        { error: 'Invalid source. Must be "whoop" or "limitless"' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid circular dependencies
    const { Database } = await import('@/lib/db/Database');
    const db = Database.getInstance().getRawDb();

    let recordCount = 0;

    if (source === 'whoop') {
      const cyclesCount = db.prepare('SELECT COUNT(*) as count FROM cycles').get() as { count: number } | undefined;
      const recoveriesCount = db.prepare('SELECT COUNT(*) as count FROM recoveries').get() as { count: number } | undefined;
      const sleepsCount = db.prepare('SELECT COUNT(*) as count FROM sleeps').get() as { count: number } | undefined;
      const tokensCount = db.prepare('SELECT COUNT(*) as count FROM tokens WHERE provider = ?').get('whoop') as { count: number } | undefined;

      recordCount = (cyclesCount?.count || 0) + (recoveriesCount?.count || 0) + (sleepsCount?.count || 0) + (tokensCount?.count || 0);

    } else if (source === 'limitless') {
      const lifelogsCount = db.prepare('SELECT COUNT(*) as count FROM lifelogs').get() as { count: number } | undefined;
      const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key IN (?, ?)').get('limitless_api_key', 'limitless_last_pull') as { count: number } | undefined;

      recordCount = (lifelogsCount?.count || 0) + (settingsCount?.count || 0);
    }

    return NextResponse.json({
      source,
      recordCount,
      hasData: recordCount > 0,
    }, { status: 200 });

  } catch (error) {
    console.error('[Privacy] Get purge status failed:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'Failed to get purge status. Please try again.' },
      { status: 500 }
    );
  }
}
