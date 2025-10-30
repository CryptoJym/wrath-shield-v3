/**
 * POST /api/import/limitless
 *
 * Triggers Limitless lifelog import and starts a digestion job for the target date.
 * Body (optional): { start_date?: 'YYYY-MM-DD', end_date?: 'YYYY-MM-DD', date?: 'YYYY-MM-DD' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLimitlessClient } from '@/lib/LimitlessClient';
import { insertLifelogs } from '@/lib/db/queries';
import { startDigestForDate } from '@/lib/digestLimitless';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const { start_date, end_date, date } = body as {
      start_date?: string;
      end_date?: string;
      date?: string;
    };

    const limitless = getLimitlessClient();
    let imported = 0;

    if (start_date || end_date) {
      const lifelogsForDb = await limitless.fetchLifelogsForDb({ start_date, end_date });
      if (lifelogsForDb.length > 0) {
        insertLifelogs(lifelogsForDb);
        imported = lifelogsForDb.length;
      }
    } else {
      imported = await limitless.syncNewLifelogs();
    }

    const target = date || new Date().toISOString().split('T')[0];
    const job = await startDigestForDate(target);

    return NextResponse.json(
      {
        success: true,
        imported,
        digest: {
          jobId: job.jobId,
          total: job.total,
          processed: job.processed,
          date: job.date,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[import/limitless] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import Limitless lifelogs',
      },
      { status: 500 }
    );
  }
}

