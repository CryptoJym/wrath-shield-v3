import { NextResponse } from 'next/server';
import { markJunk } from '@/lib/events';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = currentUserOrThrow();
  const body = await req.json();
  const { id, junk } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  markJunk(id, !!junk, userId);
  return NextResponse.json({ ok: true });
}
