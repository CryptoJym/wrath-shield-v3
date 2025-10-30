/**
 * Privacy API Route - Data Purge Operations
 *
 * Handles secure deletion of data by source (WHOOP or Limitless).
 * Ensures complete removal with no residual data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureServerOnly } from '@/lib/server-only-guard';

ensureServerOnly();

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
    const db = Database.getInstance();

    let deletedRecords = 0;

    if (source === 'whoop') {
      // Delete all WHOOP-related data
      const deleteCycles = db.prepare('DELETE FROM cycles');
      const deleteRecoveries = db.prepare('DELETE FROM recoveries');
      const deleteSleeps = db.prepare('DELETE FROM sleeps');
      const deleteTokens = db.prepare('DELETE FROM tokens WHERE provider = ?');

      db.transaction(() => {
        const cyclesResult = deleteCycles.run();
        const recoveriesResult = deleteRecoveries.run();
        const sleepsResult = deleteSleeps.run();
        const tokensResult = deleteTokens.run('whoop');

        deletedRecords =
          cyclesResult.changes +
          recoveriesResult.changes +
          sleepsResult.changes +
          tokensResult.changes;
      })();

      console.log(`[Privacy] Purged ${deletedRecords} WHOOP records`);

    } else if (source === 'limitless') {
      // Delete all Limitless-related data
      const deleteLifelogs = db.prepare('DELETE FROM lifelogs');
      const deleteSettings = db.prepare('DELETE FROM settings WHERE key = ?');
      const deletePullTimestamp = db.prepare('DELETE FROM settings WHERE key = ?');

      db.transaction(() => {
        const lifelogsResult = deleteLifelogs.run();
        const settingsResult = deleteSettings.run('limitless_api_key');
        const pullTimestampResult = deletePullTimestamp.run('limitless_last_pull');

        deletedRecords =
          lifelogsResult.changes +
          settingsResult.changes +
          pullTimestampResult.changes;
      })();

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
    const db = Database.getInstance();

    let recordCount = 0;

    if (source === 'whoop') {
      const cyclesCount = db.prepare('SELECT COUNT(*) as count FROM cycles').get() as { count: number };
      const recoveriesCount = db.prepare('SELECT COUNT(*) as count FROM recoveries').get() as { count: number };
      const sleepsCount = db.prepare('SELECT COUNT(*) as count FROM sleeps').get() as { count: number };
      const tokensCount = db.prepare('SELECT COUNT(*) as count FROM tokens WHERE provider = ?').get('whoop') as { count: number };

      recordCount = cyclesCount.count + recoveriesCount.count + sleepsCount.count + tokensCount.count;

    } else if (source === 'limitless') {
      const lifelogsCount = db.prepare('SELECT COUNT(*) as count FROM lifelogs').get() as { count: number };
      const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key IN (?, ?)').get('limitless_api_key', 'limitless_last_pull') as { count: number };

      recordCount = lifelogsCount.count + settingsCount.count;
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
