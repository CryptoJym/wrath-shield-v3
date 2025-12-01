import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import {
  bulkUpdateTransactionMeta,
  TransactionMetaUpdate,
  COMPANIES,
} from '@/lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/finance/transactions/bulk
 * Bulk update multiple transactions at once
 *
 * Body: {
 *   ids: string[],
 *   updates: TransactionMetaUpdate
 * }
 */
export async function POST(request: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (!body.updates || typeof body.updates !== 'object') {
      return NextResponse.json({ error: 'updates must be an object' }, { status: 400 });
    }

    // Validate company if provided
    if (body.updates.company !== undefined && body.updates.company !== null) {
      if (!COMPANIES.includes(body.updates.company)) {
        return NextResponse.json(
          { error: `Invalid company. Must be one of: ${COMPANIES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const updates: TransactionMetaUpdate = {};
    if (body.updates.company !== undefined) updates.company = body.updates.company;
    if (body.updates.assignee !== undefined) updates.assignee = body.updates.assignee;
    if (body.updates.usage_note !== undefined) updates.usage_note = body.updates.usage_note;
    if (body.updates.reimbursable !== undefined) updates.reimbursable = body.updates.reimbursable;
    if (body.updates.bucket !== undefined) updates.bucket = body.updates.bucket;
    if (body.updates.status !== undefined) updates.status = body.updates.status;

    const count = bulkUpdateTransactionMeta(body.ids, updates, userId, 'bulk_api');

    return NextResponse.json({
      message: `Updated ${count} transactions`,
      updated: count,
      requested: body.ids.length,
    });
  } catch (e: any) {
    console.error('[transactions/bulk] POST error:', e);
    if (e.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e.message || 'Failed to bulk update' }, { status: 500 });
  }
}
