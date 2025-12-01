import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { resetAndReclassifyTransactions } from '@/lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/finance/reclassify
 * Reset and reclassify transactions in a date range
 */
export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();

    const { dateStart, dateEnd, dryRun = true } = body;

    if (!dateStart || !dateEnd) {
      return NextResponse.json(
        { error: 'dateStart and dateEnd are required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStart) || !dateRegex.test(dateEnd)) {
      return NextResponse.json(
        { error: 'Dates must be in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    console.log(`[reclassify] ${dryRun ? 'DRY RUN:' : 'EXECUTING:'} Reclassifying transactions from ${dateStart} to ${dateEnd}`);

    const result = resetAndReclassifyTransactions(dateStart, dateEnd, dryRun);

    console.log(`[reclassify] Result: ${result.total} total, ${result.reset} would change`);

    return NextResponse.json({
      success: true,
      dryRun,
      dateRange: { start: dateStart, end: dateEnd },
      total: result.total,
      changed: result.reset,
      bucketBreakdown: result.reclassified,
    });
  } catch (e: any) {
    console.error('[reclassify] Error:', e);
    if (e.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e.message || 'Failed to reclassify' }, { status: 500 });
  }
}
