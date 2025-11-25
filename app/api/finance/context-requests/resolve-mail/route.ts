import { NextResponse } from 'next/server';
import { resolveViaMail } from '@/lib/finance/mailBridge';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json().catch(() => ({}));
  const limit = Number(body.limit || 5);
  try {
    const res = await resolveViaMail(limit, userId);
    return NextResponse.json({ results: res });
  } catch (e: any) {
    console.error('[finance mail resolve]', e?.message || e);
    return NextResponse.json({ error: e?.message || 'mail resolve failed' }, { status: 500 });
  }
}
