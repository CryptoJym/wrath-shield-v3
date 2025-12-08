/**
 * Comms Temporal API
 *
 * GET /api/comms/temporal - Returns temporal aggregation of communications
 *
 * Query params:
 * - days: Number of days to include (default: 90)
 * - granularity: 'hour' | 'day' (default: 'day')
 * - date: ISO date string for detail view (YYYY-MM-DD)
 * - detail: 'true' to get messages for a specific date
 *
 * Returns:
 * - buckets: Array of temporal buckets with counts
 * - range: Start/end date range
 * - totals: Aggregate totals by source and classification
 * - granularity: The aggregation granularity used
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOrThrow } from '@/lib/auth/user';
import { listRecentEvents, EventRow } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// Types
// ============================================================================

interface TemporalBucket {
  date: string;
  hour?: number;
  count: number;
  sources: Record<string, number>;
  classifications: Record<string, number>;
}

interface MessagePreview {
  id: string;
  source: string;
  channel: string;
  subject: string | null;
  preview: string | null;
  ts: number;
  classification: string | null;
  contact: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function getDateKey(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toISOString().split('T')[0];
}

function getHourKey(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.toISOString().split('T')[0]}-${date.getHours().toString().padStart(2, '0')}`;
}

function aggregateByDay(events: EventRow[], startTs: number, endTs: number): TemporalBucket[] {
  const bucketMap = new Map<string, TemporalBucket>();

  // Initialize all days in range
  const current = new Date(startTs * 1000);
  const end = new Date(endTs * 1000);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0];
    bucketMap.set(dateKey, {
      date: dateKey,
      count: 0,
      sources: {},
      classifications: {},
    });
    current.setDate(current.getDate() + 1);
  }

  // Aggregate events
  for (const event of events) {
    if (event.ts < startTs || event.ts > endTs) continue;

    const dateKey = getDateKey(event.ts);
    let bucket = bucketMap.get(dateKey);

    if (!bucket) {
      bucket = {
        date: dateKey,
        count: 0,
        sources: {},
        classifications: {},
      };
      bucketMap.set(dateKey, bucket);
    }

    bucket.count++;

    // Track by source
    const source = event.source || 'unknown';
    bucket.sources[source] = (bucket.sources[source] || 0) + 1;

    // Track by classification
    const classification = event.classification || 'unclassified';
    bucket.classifications[classification] = (bucket.classifications[classification] || 0) + 1;
  }

  // Sort by date
  return Array.from(bucketMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByHour(events: EventRow[], startTs: number, endTs: number): TemporalBucket[] {
  const bucketMap = new Map<string, TemporalBucket>();

  // Aggregate events
  for (const event of events) {
    if (event.ts < startTs || event.ts > endTs) continue;

    const date = new Date(event.ts * 1000);
    const dateKey = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const hourKey = `${dateKey}-${hour.toString().padStart(2, '0')}`;

    let bucket = bucketMap.get(hourKey);

    if (!bucket) {
      bucket = {
        date: dateKey,
        hour,
        count: 0,
        sources: {},
        classifications: {},
      };
      bucketMap.set(hourKey, bucket);
    }

    bucket.count++;

    // Track by source
    const source = event.source || 'unknown';
    bucket.sources[source] = (bucket.sources[source] || 0) + 1;

    // Track by classification
    const classification = event.classification || 'unclassified';
    bucket.classifications[classification] = (bucket.classifications[classification] || 0) + 1;
  }

  // Sort by date and hour
  return Array.from(bucketMap.values()).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.hour || 0) - (b.hour || 0);
  });
}

function calculateTotals(events: EventRow[]): {
  total: number;
  bySource: Record<string, number>;
  byClassification: Record<string, number>;
} {
  const bySource: Record<string, number> = {};
  const byClassification: Record<string, number> = {};

  for (const event of events) {
    const source = event.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;

    const classification = event.classification || 'unclassified';
    byClassification[classification] = (byClassification[classification] || 0) + 1;
  }

  return {
    total: events.length,
    bySource,
    byClassification,
  };
}

function getMessagesForDate(events: EventRow[], dateStr: string, hour?: number): MessagePreview[] {
  const targetDate = new Date(dateStr);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startTs = Math.floor(startOfDay.getTime() / 1000);
  const endTs = Math.floor(endOfDay.getTime() / 1000);

  return events
    .filter((event) => {
      if (event.ts < startTs || event.ts > endTs) return false;
      if (hour !== undefined) {
        const eventHour = new Date(event.ts * 1000).getHours();
        return eventHour === hour;
      }
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50)
    .map((event) => ({
      id: event.id,
      source: event.source,
      channel: event.channel,
      subject: event.subject || null,
      preview: event.preview || null,
      ts: event.ts,
      classification: event.classification || null,
      contact: event.contact || null,
    }));
}

// ============================================================================
// Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = currentUserOrThrow();

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90', 10);
    const granularity = (searchParams.get('granularity') || 'day') as 'hour' | 'day';
    const detailDate = searchParams.get('date');
    const wantDetail = searchParams.get('detail') === 'true';

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const startTs = now - days * 24 * 60 * 60;

    // Get events - fetch more than default to cover the range
    const limit = Math.max(2000, days * 50);
    const events = listRecentEvents(limit, userId);

    // Filter events to our date range
    const filteredEvents = events.filter((e) => e.ts >= startTs && e.ts <= now);

    // Handle detail request
    if (detailDate && wantDetail) {
      const hour = searchParams.get('hour') ? parseInt(searchParams.get('hour')!, 10) : undefined;
      const messages = getMessagesForDate(filteredEvents, detailDate, hour);

      return NextResponse.json({
        date: detailDate,
        hour,
        messages,
        total: messages.length,
      });
    }

    // Aggregate data
    const buckets =
      granularity === 'hour'
        ? aggregateByHour(filteredEvents, startTs, now)
        : aggregateByDay(filteredEvents, startTs, now);

    const totals = calculateTotals(filteredEvents);

    const startDate = new Date(startTs * 1000).toISOString().split('T')[0];
    const endDate = new Date(now * 1000).toISOString().split('T')[0];

    return NextResponse.json({
      buckets,
      range: {
        start: startDate,
        end: endDate,
      },
      totals,
      granularity,
    });
  } catch (e) {
    console.error('[Comms Temporal API] Error:', e);
    const status = (e as Error)?.message === 'unauthorized' ? 401 : 500;
    return NextResponse.json({ error: 'Failed to get temporal data' }, { status });
  }
}
