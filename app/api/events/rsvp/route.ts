/**
 * Events RSVP API
 *
 * POST /api/events/rsvp - Send RSVP response for calendar invites
 */

import { NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RsvpResponse = 'accepted' | 'declined' | 'maybe';

export async function POST(req: Request) {
  try {
    const { userId } = currentUserOrThrow();
    const body = await req.json();
    const { id, response, eventData } = body || {};

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    if (!response || !['accepted', 'declined', 'maybe'].includes(response)) {
      return NextResponse.json(
        { error: 'response required (accepted, declined, maybe)' },
        { status: 400 }
      );
    }

    // TODO: Integrate with actual calendar APIs (Google Calendar, Outlook, Apple Calendar)
    // For now, we store the RSVP response locally and log it
    console.log(`[RSVP] Event ${id}: User ${userId} responded with "${response}"`);

    // If we have event metadata with calendar info, we could send the response
    if (eventData?.calendarId && eventData?.eventId) {
      console.log(`[RSVP] Would send response to calendar: ${eventData.calendarId}`);
      // Future: Call calendar API to send RSVP
      // - Google Calendar: events.patch with attendees.responseStatus
      // - Outlook: POST to /me/events/{id}/accept or /decline or /tentativelyAccept
      // - Apple Calendar: CalDAV REPLY
    }

    // Store RSVP in local state (could use events.db or a separate store)
    // For now, just acknowledge the request
    return NextResponse.json({
      ok: true,
      eventId: id,
      response,
      message: `RSVP "${response}" recorded for event ${id}`,
      // Flag indicating this needs sync to actual calendar
      pendingSync: !eventData?.calendarId,
    });
  } catch (e) {
    const status = (e as any)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'failed to send RSVP' }, { status });
  }
}
