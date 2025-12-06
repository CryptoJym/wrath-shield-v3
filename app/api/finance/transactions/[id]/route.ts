import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import {
  getTransaction,
  updateTransactionMeta,
  recordReimbursementDecisionToMemory,
  TransactionMetaUpdate,
  COMPANIES,
  ASSIGNEES,
} from '@/lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/finance/transactions/[id]
 * Get a single transaction by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const txn = getTransaction(params.id);

    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ transaction: txn });
  } catch (e: any) {
    console.error('[transactions/[id]] GET error:', e);
    if (e.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e.message || 'Failed to get transaction' }, { status: 500 });
  }
}

/**
 * PATCH /api/finance/transactions/[id]
 * Update transaction metadata (assignee, usage_note, company, reimbursable, etc.)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await request.json();

    // Validate inputs
    if (body.company !== undefined && body.company !== null) {
      if (!COMPANIES.includes(body.company)) {
        return NextResponse.json(
          { error: `Invalid company. Must be one of: ${COMPANIES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: TransactionMetaUpdate = {};

    if (body.company !== undefined) updates.company = body.company;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    if (body.usage_note !== undefined) updates.usage_note = body.usage_note;
    if (body.utilization_score !== undefined) updates.utilization_score = body.utilization_score;
    if (body.receipt_verified !== undefined) updates.receipt_verified = body.receipt_verified;
    if (body.receipt_email_id !== undefined) updates.receipt_email_id = body.receipt_email_id;
    if (body.reimbursable !== undefined) updates.reimbursable = body.reimbursable;
    if (body.bucket !== undefined) updates.bucket = body.bucket;
    if (body.status !== undefined) updates.status = body.status;

    const updated = updateTransactionMeta(params.id, updates, userId, 'api');

    if (!updated) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // AI Memory recording is now handled inside updateTransactionMeta based on the input field changes.

    return NextResponse.json({ transaction: updated });
  } catch (e: any) {
    console.error('[transactions/[id]] PATCH error:', e);
    if (e.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: e.message || 'Failed to update transaction' }, { status: 500 });
  }
}
