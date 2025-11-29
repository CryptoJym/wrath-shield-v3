/**
 * Events Flag API
 *
 * POST /api/events/flag - Flag an event for urgent attention
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { flagEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { id, flagged = true } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    flagEvent(id, flagged, userId);

    return NextResponse.json({
      ok: true,
      eventId: id,
      flagged,
      message: `Event ${flagged ? 'flagged' : 'unflagged'}`,
    });
  } catch (e) {
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to flag event' }, { status });
  }
}
