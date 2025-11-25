import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { listByDateRange, updateTransaction } from '../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { userId } = currentUserOrThrow();
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  }
  const rows = listByDateRange(start, end, userId);
  return NextResponse.json({ txns: rows });
}

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json();
  const { id, bucket, project, reimbursable, note, rationale, status } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  updateTransaction(id, {
    bucket,
    project,
    reimbursable,
    note,
    rationale,
    status: status || 'classified',
  }, userId);
  return NextResponse.json({ ok: true });
}
