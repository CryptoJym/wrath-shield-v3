import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TIMELINE_PATH = path.resolve(process.cwd(), '.data', 'legal', 'timeline', 'master_timeline.json');

export interface TimelineEvent {
  date: string;
  category: 'filing' | 'email' | 'event' | 'deadline' | 'violation';
  title: string;
  description: string;
  source: string;
  parties?: string[];
  attachments?: string[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!fs.existsSync(TIMELINE_PATH)) {
      return NextResponse.json({
        events: [],
        error: 'Timeline not built yet. Run: npx tsx scripts/build-legal-timeline.ts'
      });
    }

    let events: TimelineEvent[] = JSON.parse(fs.readFileSync(TIMELINE_PATH, 'utf8'));

    // Filter by category
    if (category && category !== 'all') {
      events = events.filter(e => e.category === category);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      events = events.filter(e => new Date(e.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      events = events.filter(e => new Date(e.date) <= end);
    }

    // Sort by date descending (newest first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply limit
    events = events.slice(0, limit);

    // Group by month for UI
    const byMonth: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const d = new Date(event.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(event);
    }

    // Statistics
    const stats = {
      total: events.length,
      byCategory: {
        filing: events.filter(e => e.category === 'filing').length,
        email: events.filter(e => e.category === 'email').length,
        event: events.filter(e => e.category === 'event').length,
        violation: events.filter(e => e.category === 'violation').length,
        deadline: events.filter(e => e.category === 'deadline').length,
      },
      dateRange: {
        oldest: events[events.length - 1]?.date,
        newest: events[0]?.date,
      }
    };

    return NextResponse.json({
      events,
      byMonth,
      stats,
      case: {
        number: '164400524',
        name: 'Brady v. Brady',
        court: 'Utah 4th District - Provo',
        status: 'Active - Father has custody per 10/21/2025 Order'
      }
    });
  } catch (error) {
    console.error('Timeline API error:', error);
    return NextResponse.json({ events: [], error: 'Failed to load timeline' }, { status: 500 });
  }
}
