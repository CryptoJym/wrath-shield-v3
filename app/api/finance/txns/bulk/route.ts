import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../../lib/auth/user';
import { bulkUpdateVendor } from '../../../../../lib/finance/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json();
  const { vendor, start, end, bucket, project, reimbursable } = body || {};
  if (!vendor || !start || !end) {
    return NextResponse.json({ error: 'vendor, start, end required' }, { status: 400 });
  }
  const changes = bulkUpdateVendor(vendor, start, end, { bucket, project, reimbursable, status: 'classified' }, userId);
  return NextResponse.json({ ok: true, updated: changes });
}
