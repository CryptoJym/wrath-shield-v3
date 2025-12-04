/**
 * Temporal Context Service
 *
 * Provides time-aware grounding for the PM agent system.
 * Ensures the agent always knows:
 * - Current date/time
 * - Time elapsed since events
 * - Relative temporal context for decisions
 * - Stale data detection
 */

import { getDatabase } from '@/lib/db/Database';

export interface TemporalContext {
  current_timestamp: number;
  current_date: string; // ISO date
  current_time: string; // HH:MM format
  day_of_week: string;
  week_of_year: number;
  quarter: number;
  fiscal_year: number;
  time_zone: string;
  business_hours: boolean;
  relative_markers: RelativeMarkers;
}

export interface RelativeMarkers {
  start_of_day: number;
  start_of_week: number;
  start_of_month: number;
  start_of_quarter: number;
  start_of_year: number;
  one_hour_ago: number;
  one_day_ago: number;
  one_week_ago: number;
  one_month_ago: number;
}

export interface TimeElapsed {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  weeks: number;
  months: number;
  human_readable: string;
  is_stale: boolean;
  staleness_level: 'fresh' | 'aging' | 'stale' | 'very_stale' | 'ancient';
}

export interface TemporalEvent {
  id: string;
  event_type: string;
  event_key: string; // Unique identifier for the event
  timestamp: number;
  metadata: Record<string, unknown>;
  created_at: number;
}

interface EventRow {
  id: string;
  event_type: string;
  event_key: string;
  timestamp: number;
  metadata: string;
  created_at: number;
}

// Staleness thresholds in seconds
const STALENESS_THRESHOLDS = {
  fresh: 3600, // 1 hour
  aging: 86400, // 1 day
  stale: 604800, // 1 week
  very_stale: 2592000, // 30 days
  // anything beyond is 'ancient'
};

function ensureTable(): void {
  const db = getDatabase().getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS temporal_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_key TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(event_type, event_key)
    );

    CREATE INDEX IF NOT EXISTS idx_temporal_type ON temporal_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_temporal_key ON temporal_events(event_key);
    CREATE INDEX IF NOT EXISTS idx_temporal_ts ON temporal_events(timestamp);
  `);
}

/**
 * Get the current temporal context
 */
export function getCurrentContext(timezone: string = 'America/New_York'): TemporalContext {
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);

  // Get localized date/time
  const localDate = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const localTime = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' });

  // Calculate week of year
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekOfYear = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );

  // Calculate quarter
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;

  // Check business hours (9 AM - 5 PM)
  const hour = parseInt(localTime.split(':')[0]);
  const isWeekday = !['Saturday', 'Sunday'].includes(dayOfWeek);
  const businessHours = isWeekday && hour >= 9 && hour < 17;

  // Calculate relative markers
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(month / 3) * 3, 1);
  const startOfYearDate = new Date(now.getFullYear(), 0, 1);

  return {
    current_timestamp: timestamp,
    current_date: localDate,
    current_time: localTime,
    day_of_week: dayOfWeek,
    week_of_year: weekOfYear,
    quarter,
    fiscal_year: now.getFullYear(),
    time_zone: timezone,
    business_hours: businessHours,
    relative_markers: {
      start_of_day: Math.floor(startOfDay.getTime() / 1000),
      start_of_week: Math.floor(startOfWeek.getTime() / 1000),
      start_of_month: Math.floor(startOfMonth.getTime() / 1000),
      start_of_quarter: Math.floor(startOfQuarter.getTime() / 1000),
      start_of_year: Math.floor(startOfYearDate.getTime() / 1000),
      one_hour_ago: timestamp - 3600,
      one_day_ago: timestamp - 86400,
      one_week_ago: timestamp - 604800,
      one_month_ago: timestamp - 2592000,
    },
  };
}

/**
 * Calculate time elapsed since a timestamp
 */
export function getTimeElapsed(fromTimestamp: number, stalenessContext?: string): TimeElapsed {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - fromTimestamp;

  const seconds = elapsed;
  const minutes = Math.floor(elapsed / 60);
  const hours = Math.floor(elapsed / 3600);
  const days = Math.floor(elapsed / 86400);
  const weeks = Math.floor(elapsed / 604800);
  const months = Math.floor(elapsed / 2592000);

  // Generate human-readable string
  let humanReadable: string;
  if (seconds < 60) {
    humanReadable = 'just now';
  } else if (minutes < 60) {
    humanReadable = `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    humanReadable = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 7) {
    humanReadable = `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (weeks < 4) {
    humanReadable = `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  } else if (months < 12) {
    humanReadable = `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(months / 12);
    humanReadable = `${years} year${years !== 1 ? 's' : ''} ago`;
  }

  // Determine staleness level
  let stalenessLevel: TimeElapsed['staleness_level'];
  if (elapsed <= STALENESS_THRESHOLDS.fresh) {
    stalenessLevel = 'fresh';
  } else if (elapsed <= STALENESS_THRESHOLDS.aging) {
    stalenessLevel = 'aging';
  } else if (elapsed <= STALENESS_THRESHOLDS.stale) {
    stalenessLevel = 'stale';
  } else if (elapsed <= STALENESS_THRESHOLDS.very_stale) {
    stalenessLevel = 'very_stale';
  } else {
    stalenessLevel = 'ancient';
  }

  // Different contexts have different staleness expectations
  const isStale =
    stalenessContext === 'sync'
      ? elapsed > 900 // 15 minutes for sync
      : stalenessContext === 'commit'
        ? elapsed > 86400 // 1 day for commits
        : elapsed > STALENESS_THRESHOLDS.stale; // Default 1 week

  return {
    seconds,
    minutes,
    hours,
    days,
    weeks,
    months,
    human_readable: humanReadable,
    is_stale: isStale,
    staleness_level: stalenessLevel,
  };
}

/**
 * Record a temporal event (for tracking last sync, last update, etc.)
 */
export function recordEvent(params: {
  event_type: string;
  event_key: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}): TemporalEvent {
  ensureTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const id = `evt_${params.event_type}_${params.event_key}_${now}`;

  db.prepare(`
    INSERT OR REPLACE INTO temporal_events (id, event_type, event_key, timestamp, metadata, created_at)
    VALUES (@id, @event_type, @event_key, @timestamp, @metadata, @created_at)
  `).run({
    id,
    event_type: params.event_type,
    event_key: params.event_key,
    timestamp: params.timestamp || now,
    metadata: JSON.stringify(params.metadata || {}),
    created_at: now,
  });

  return getEvent(params.event_type, params.event_key)!;
}

/**
 * Get a temporal event
 */
export function getEvent(event_type: string, event_key: string): TemporalEvent | null {
  ensureTable();
  const db = getDatabase().getRawDb();
  const row = db
    .prepare('SELECT * FROM temporal_events WHERE event_type = ? AND event_key = ?')
    .get(event_type, event_key) as EventRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    event_type: row.event_type,
    event_key: row.event_key,
    timestamp: row.timestamp,
    metadata: JSON.parse(row.metadata || '{}'),
    created_at: row.created_at,
  };
}

/**
 * Get time since an event
 */
export function getTimeSinceEvent(
  event_type: string,
  event_key: string,
  stalenessContext?: string
): TimeElapsed | null {
  const event = getEvent(event_type, event_key);
  if (!event) return null;
  return getTimeElapsed(event.timestamp, stalenessContext);
}

/**
 * Get all events of a type, ordered by recency
 */
export function getEventsByType(event_type: string, limit: number = 50): TemporalEvent[] {
  ensureTable();
  const db = getDatabase().getRawDb();
  const rows = db
    .prepare('SELECT * FROM temporal_events WHERE event_type = ? ORDER BY timestamp DESC LIMIT ?')
    .all(event_type, limit) as EventRow[];

  return rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    event_key: row.event_key,
    timestamp: row.timestamp,
    metadata: JSON.parse(row.metadata || '{}'),
    created_at: row.created_at,
  }));
}

/**
 * Get stale events (events that haven't been updated recently)
 */
export function getStaleEvents(
  event_type?: string,
  maxAge: number = STALENESS_THRESHOLDS.stale
): TemporalEvent[] {
  ensureTable();
  const db = getDatabase().getRawDb();
  const cutoff = Math.floor(Date.now() / 1000) - maxAge;

  let sql = 'SELECT * FROM temporal_events WHERE timestamp < ?';
  const params: (string | number)[] = [cutoff];

  if (event_type) {
    sql += ' AND event_type = ?';
    params.push(event_type);
  }

  sql += ' ORDER BY timestamp ASC';

  const rows = db.prepare(sql).all(...params) as EventRow[];

  return rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    event_key: row.event_key,
    timestamp: row.timestamp,
    metadata: JSON.parse(row.metadata || '{}'),
    created_at: row.created_at,
  }));
}

/**
 * Generate a temporal summary for the PM agent
 * This is the main function to ground the agent in the present
 */
export function getAgentTemporalSummary(): {
  context: TemporalContext;
  last_sync: TimeElapsed | null;
  last_commit_analysis: TimeElapsed | null;
  stale_items: {
    syncs: number;
    analyses: number;
  };
  grounding_statement: string;
} {
  const context = getCurrentContext();
  const lastSync = getTimeSinceEvent('sync', 'github_refresh', 'sync');
  const lastAnalysis = getTimeSinceEvent('commit_analysis', 'batch', 'commit');

  // Count stale items
  const staleSyncs = getStaleEvents('sync', 900).length; // 15 min
  const staleAnalyses = getStaleEvents('commit_analysis', 86400).length; // 1 day

  // Generate grounding statement
  const parts: string[] = [
    `Today is ${context.day_of_week}, ${context.current_date}.`,
    `Current time: ${context.current_time} ${context.time_zone}.`,
  ];

  if (lastSync) {
    parts.push(`Last GitHub sync: ${lastSync.human_readable}${lastSync.is_stale ? ' (STALE)' : ''}.`);
  } else {
    parts.push('No GitHub sync recorded yet.');
  }

  if (lastAnalysis) {
    parts.push(`Last commit analysis: ${lastAnalysis.human_readable}.`);
  }

  if (staleSyncs > 0 || staleAnalyses > 0) {
    parts.push(`Attention needed: ${staleSyncs} stale syncs, ${staleAnalyses} stale analyses.`);
  }

  return {
    context,
    last_sync: lastSync,
    last_commit_analysis: lastAnalysis,
    stale_items: {
      syncs: staleSyncs,
      analyses: staleAnalyses,
    },
    grounding_statement: parts.join(' '),
  };
}

/**
 * Format a date relative to now with context
 */
export function formatRelativeDate(
  timestamp: number,
  options?: { includeTime?: boolean; verbose?: boolean }
): string {
  const elapsed = getTimeElapsed(timestamp);
  const date = new Date(timestamp * 1000);

  if (options?.verbose) {
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = options?.includeTime
      ? ` at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    return `${dateStr}${timeStr} (${elapsed.human_readable})`;
  }

  return elapsed.human_readable;
}
