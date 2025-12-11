import { NextRequest, NextResponse } from 'next/server';
import { getEAAgent } from '@/lib/agents/ea-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ea/schedule
 * Handle scheduling requests: block time, schedule meetings, check conflicts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eaAgent = getEAAgent();

    const { action, ...params } = body;

    switch (action) {
      case 'block_time': {
        if (!params.title || !params.start || !params.end) {
          return NextResponse.json(
            { error: 'Missing required fields: title, start, end' },
            { status: 400 }
          );
        }

        const block = await eaAgent.blockTime(
          params.title,
          new Date(params.start),
          new Date(params.end)
        );

        return NextResponse.json({
          success: true,
          action: 'block_time',
          event: {
            id: block.id,
            title: block.title,
            start: block.start.toISOString(),
            end: block.end.toISOString(),
          },
        });
      }

      case 'schedule_meeting': {
        if (!params.title || !params.duration) {
          return NextResponse.json(
            { error: 'Missing required fields: title, duration' },
            { status: 400 }
          );
        }

        const meetingRequest = {
          title: params.title,
          duration: params.duration,
          attendees: params.attendees,
          preferredTimes: params.preferredTimes?.map((t: string) => new Date(t)),
          description: params.description,
        };

        try {
          const meeting = await eaAgent.scheduleMeeting(meetingRequest);

          return NextResponse.json({
            success: true,
            action: 'schedule_meeting',
            event: {
              id: meeting.id,
              title: meeting.title,
              start: meeting.start.toISOString(),
              end: meeting.end.toISOString(),
              attendees: meeting.attendees,
            },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Scheduling failed',
            },
            { status: 409 }
          );
        }
      }

      case 'check_conflicts': {
        if (!params.start || !params.end) {
          return NextResponse.json(
            { error: 'Missing required fields: start, end' },
            { status: 400 }
          );
        }

        const conflicts = await eaAgent.checkConflicts(
          new Date(params.start),
          new Date(params.end)
        );

        return NextResponse.json({
          success: true,
          action: 'check_conflicts',
          hasConflicts: conflicts.length > 0,
          conflicts: conflicts.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          })),
        });
      }

      case 'get_agenda': {
        const agenda = await eaAgent.generateDailyAgenda();

        return NextResponse.json({
          success: true,
          action: 'get_agenda',
          agenda: {
            date: agenda.date.toISOString(),
            summary: agenda.summary,
            events: agenda.events.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start.toISOString(),
              end: e.end.toISOString(),
            })),
            freeSlots: agenda.freeSlots.map((slot) => ({
              start: slot.start.toISOString(),
              end: slot.end.toISOString(),
            })),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[EA Schedule API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ea/schedule
 * Get all upcoming scheduled events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    const eaAgent = getEAAgent();
    const events = await eaAgent.getUpcomingEvents(days);

    return NextResponse.json({
      success: true,
      days,
      count: events.length,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        location: e.location,
        attendees: e.attendees,
        description: e.description,
      })),
    });
  } catch (error) {
    console.error('[EA Schedule API] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
