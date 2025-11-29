import { NextResponse } from 'next/server';
import {
  createContextRequest,
  listContextRequests,
  updateContextRequest,
  updateTransaction,
} from '../../../../lib/finance/store';
import { applyCommsContext } from '../../../../lib/finance/enrich';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { autoClassifyOne } from '../../../../lib/finance/llm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const { userId } = currentUserOrThrow();
  const rows = listContextRequests('pending', userId);
  return NextResponse.json({ requests: rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { userId } = currentUserOrThrow();
  // If comms agent posts a context resolution payload
  if (body.comms === true && body.id && body.summary) {
    const updated = applyCommsContext(body.id, {
      id: body.id,
      summary: body.summary,
      confidence: body.confidence,
      bucket: body.bucket,
      project: body.project,
      reimbursable: body.reimbursable,
      note: body.note,
      rationale: body.rationale,
    });
    return NextResponse.json({ request: updated });
  }

  // Trigger LLM auto-classification for a single request
  if (body.llm === true && body.id) {
    try {
      const result = await autoClassifyOne(body.id, userId);
      return NextResponse.json({ request: result });
    } catch (e: any) {
      console.error('[finance llm classify]', e?.message || e);
      return NextResponse.json({ error: e?.message || 'llm classify failed' }, { status: 500 });
    }
  }

  if (body.id && body.status) {
    const updated = updateContextRequest(body.id, {
      status: body.status,
      summary: body.summary,
      confidence: body.confidence,
      bucket: body.bucket,
      project: body.project,
      reimbursable: body.reimbursable,
      note: body.note,
      rationale: body.rationale,
    });
    // If user resolved manually, learn vendor rule for future
    if (updated?.vendor) {
      const { upsertRule } = await import('../../../../lib/finance/vendorRules');
      upsertRule({
        vendor: updated.vendor,
        bucket: body.bucket ?? updated.bucket ?? undefined,
        reimbursable:
          body.reimbursable === undefined ? (updated.reimbursable as any) : body.reimbursable,
        project: body.project ?? updated.project ?? undefined,
        note: body.note ?? updated.note ?? undefined,
        rationale: body.rationale ?? updated.rationale ?? undefined,
      });
    }
    if (updated?.txn_id && body.status === 'resolved') {
      updateTransaction(updated.txn_id, {
        bucket: body.bucket ?? updated.bucket,
        project: body.project ?? updated.project,
        reimbursable:
          body.reimbursable === undefined ? (updated.reimbursable as any) : body.reimbursable,
        status: 'confirmed',
      });
    }
    return NextResponse.json({ request: updated });
  }
  const created = createContextRequest({
    user_id: userId,
    txn_id: body.txn_id,
    vendor: body.vendor,
    date: body.date,
    amount: body.amount,
    confidence: body.confidence,
    status: body.status || 'pending',
    summary: body.summary,
    bucket: body.bucket,
    project: body.project,
    reimbursable: body.reimbursable,
    note: body.note,
    rationale: body.rationale,
  });
  return NextResponse.json({ request: created });
}
