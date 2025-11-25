import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '../../../../lib/auth/user';
import { syncFromLegalAdvocate } from '../../../../lib/legal/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const { userId } = currentUserOrThrow();
  const stats = syncFromLegalAdvocate(userId);
  return NextResponse.json({ ok: true, ...stats });
}
