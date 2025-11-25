import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { listAudit } from '../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { userId } = currentUserOrThrow();
  const url = new URL(req.url);
  const txn = url.searchParams.get('txn');
  if (!txn) return NextResponse.json({ error: 'txn required' }, { status: 400 });
  const rows = listAudit(txn, userId);
  return NextResponse.json({ audit: rows });
}
