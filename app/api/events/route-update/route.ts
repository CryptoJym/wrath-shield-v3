import { NextResponse } from 'next/server';
import { routeEvent } from '@/lib/events';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json();
  const { id, target } = body || {};
  if (!id || !target) return NextResponse.json({ error: 'id and target required' }, { status: 400 });
  routeEvent(id, target, userId);
  return NextResponse.json({ ok: true });
}
