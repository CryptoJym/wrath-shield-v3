/**
 * Events Dismiss API
 *
 * POST /api/events/dismiss - Dismiss an event from the inbox
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { dismissEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { id } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    dismissEvent(id, userId);

    return NextResponse.json({
      ok: true,
      eventId: id,
      message: `Event ${id} dismissed`,
    });
  } catch (e) {
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to dismiss event' }, { status });
  }
}
