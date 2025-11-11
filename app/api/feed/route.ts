import { NextRequest, NextResponse } from 'next/server';
import { getMetricsLastNDays } from '@/lib/db/queries';
import { getAnchors } from '@/lib/MemoryWrapper';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const days = Number(searchParams.get('days') ?? '7');

    const metrics = getMetricsLastNDays(days, userId);
    const anchors = await getAnchors(userId || 'default');

    return NextResponse.json({ metrics, anchors });
  } catch (e) {
    console.error('[Feed API] Error:', e);
    return NextResponse.json({ error: 'Failed to compute feed' }, { status: 500 });
  }
}

