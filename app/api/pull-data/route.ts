/**
 * Wrath Shield v3 - Data Pull API Route
 *
 * Orchestrates data pulls from WHOOP and Limitless APIs.
 * Handles authentication, rate limiting, and partial failures.
 *
 * POST /api/pull-data
 * Body: { targetDate?: 'YYYY-MM-DD' } // Defaults to today
 *
 * Returns: {
 *   success: boolean,
 *   whoop: { cycles: number, recoveries: number, sleeps: number },
 *   limitless: { lifelogs: number },
 *   errors: string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWhoopClient } from '@/lib/WhoopClient';
import { getLimitlessClient } from '@/lib/LimitlessClient';
import { insertCycles, insertRecoveries, insertSleeps } from '@/lib/db/queries';

/**
 * Response structure for data pull operation
 */
interface PullDataResponse {
  success: boolean;
  whoop: {
    cycles: number;
    recoveries: number;
    sleeps: number;
  };
  limitless: {
    lifelogs: number;
  };
  errors: string[];
}

/**
 * POST /api/pull-data
 *
 * Orchestrates data pulls from WHOOP and Limitless
 */
export async function POST(request: NextRequest): Promise<NextResponse<PullDataResponse>> {
  const errors: string[] = [];

  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { targetDate } = body as { targetDate?: string };

    // Determine date range (default to today)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const date = targetDate || today;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          whoop: { cycles: 0, recoveries: 0, sleeps: 0 },
          limitless: { lifelogs: 0 },
          errors: ['Invalid date format. Expected YYYY-MM-DD.'],
        },
        { status: 400 }
      );
    }

    // Initialize counters
    let cyclesCount = 0;
    let recoveriesCount = 0;
    let sleepsCount = 0;
    let lifelogsCount = 0;

    // Pull WHOOP data
    try {
      const whoopClient = getWhoopClient();

      // Fetch cycles for the target date
      try {
        const cycles = await whoopClient.fetchCyclesForDb(date, date);
        if (cycles.length > 0) {
          insertCycles(cycles);
          cyclesCount = cycles.length;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WHOOP cycles: ${message}`);
      }

      // Fetch recoveries for the target date
      try {
        const recoveries = await whoopClient.fetchRecoveriesForDb(date, date);
        if (recoveries.length > 0) {
          insertRecoveries(recoveries);
          recoveriesCount = recoveries.length;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WHOOP recoveries: ${message}`);
      }

      // Fetch sleeps for the target date
      try {
        const sleeps = await whoopClient.fetchSleepsForDb(date, date);
        if (sleeps.length > 0) {
          insertSleeps(sleeps);
          sleepsCount = sleeps.length;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`WHOOP sleeps: ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`WHOOP authentication: ${message}`);
    }

    // Pull Limitless lifelogs (incremental sync since last pull)
    try {
      const limitlessClient = getLimitlessClient();
      lifelogsCount = await limitlessClient.syncNewLifelogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Limitless: ${message}`);
    }

    // Determine overall success (partial failures are OK)
    const success = errors.length === 0 || cyclesCount + recoveriesCount + sleepsCount + lifelogsCount > 0;

    return NextResponse.json(
      {
        success,
        whoop: {
          cycles: cyclesCount,
          recoveries: recoveriesCount,
          sleeps: sleepsCount,
        },
        limitless: {
          lifelogs: lifelogsCount,
        },
        errors,
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error('[pull-data] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        whoop: { cycles: 0, recoveries: 0, sleeps: 0 },
        limitless: { lifelogs: 0 },
        errors: ['Internal server error'],
      },
      { status: 500 }
    );
  }
}
