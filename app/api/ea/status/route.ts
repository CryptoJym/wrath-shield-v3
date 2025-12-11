import { NextResponse } from 'next/server';
import { getEAAgent } from '@/lib/agents/ea-agent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ea/status
 * Returns EA agent status, daily agenda, and upcoming events
 */
export async function GET() {
  try {
    const eaAgent = getEAAgent();
    const agenda = await eaAgent.generateDailyAgenda();
    const upcomingEvents = await eaAgent.getUpcomingEvents(7);

    return NextResponse.json({
      ok: true,
      status: 'active',
      agent: 'agent.ea',
      name: 'Executive Assistant',
      capabilities: [
        'calendar_management',
        'meeting_scheduling',
        'daily_agenda',
        'conflict_detection',
        'time_blocking',
      ],
      stats: {
        upcomingEvents: upcomingEvents.length,
        todayEvents: upcomingEvents.filter((e) =>
          e.start.toDateString() === new Date().toDateString()
        ).length,
        weekEvents: upcomingEvents.length,
      },
      dailyAgenda: {
        date: agenda.date,
        summary: agenda.summary,
        eventCount: agenda.events.length,
        freeSlots: agenda.freeSlots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          durationMinutes: Math.round(
            (slot.end.getTime() - slot.start.getTime()) / 60000
          ),
        })),
        events: agenda.events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          duration: Math.round((e.end.getTime() - e.start.getTime()) / 60000),
        })),
      },
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        location: e.location,
        attendees: e.attendees,
      })),
    });
  } catch (error) {
    console.error('[EA Status API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
