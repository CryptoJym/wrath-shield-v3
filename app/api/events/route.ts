import { NextRequest, NextResponse } from 'next/server';
import { listRecentEvents } from '@/lib/events';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '300', 10) || 300, 1000);
    const events = listRecentEvents(limit, userId);
    return NextResponse.json({ events });
  } catch (e) {
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to load events' }, { status });
  }
}
