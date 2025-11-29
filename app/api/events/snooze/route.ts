/**
 * Events Snooze API
 *
 * POST /api/events/snooze - Snooze an event to delay processing
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { snoozeEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { id, snoozeUntil } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Default snooze: 4 hours from now
    const defaultSnoozeSeconds = 4 * 60 * 60;
    const snoozeTimestamp = snoozeUntil
      ? Math.floor(new Date(snoozeUntil).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + defaultSnoozeSeconds;

    snoozeEvent(id, snoozeTimestamp, userId);

    return NextResponse.json({
      ok: true,
      eventId: id,
      snoozeUntil: snoozeTimestamp,
      message: 'Event snoozed',
    });
  } catch (e) {
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to snooze event' }, { status });
  }
}
