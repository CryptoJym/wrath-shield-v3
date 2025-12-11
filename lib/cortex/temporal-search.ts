/**
 * Temporal Search Preprocessing System for Life OS Memory Architecture
 *
 * Provides intelligent temporal reasoning for queries like:
 * - "what did I discuss with John last week"
 * - "what's overdue from Tuesday's meeting"
 * - "show me everything from yesterday afternoon"
 *
 * Features:
 * - Natural language temporal parsing (relative, absolute, recurring)
 * - Temporal-aware search with scoring
 * - Overdue detection with deadline extraction
 * - Recency bias for ranking results
 *
 * SECURITY: Server-side only module
 */

import { ensureServerOnly } from '../server-only-guard';
import type { WorkingMemory } from './working-memory';
import type { WorkingMemoryEvent } from './types';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  addDays,
  addWeeks,
  addMonths,
  parseISO,
  isValid,
  isBefore,
  isAfter,
  differenceInMilliseconds,
} from 'date-fns';

// Ensure server-side only
ensureServerOnly('lib/cortex/temporal-search');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Temporal reference types for queries
 */
export type TemporalReference =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | { date: Date }
  | { range: { start: Date; end: Date } };

/**
 * Directional modifiers for temporal queries
 */
export type TemporalDirection = 'before' | 'after' | 'around' | 'exact';

/**
 * Temporal query specification
 */
export interface TemporalQuery {
  /** The temporal reference point or range */
  reference: TemporalReference;

  /** Optional direction modifier */
  direction?: TemporalDirection;

  /** Window size in milliseconds for 'around' queries (default: 1 hour) */
  windowMs?: number;
}

/**
 * Options for temporal search
 */
export interface TemporalSearchOptions {
  /** Temporal constraints */
  temporal?: TemporalQuery;

  /** Include items with past deadlines */
  includeOverdue?: boolean;

  /** Only return items with deadlines */
  deadlineOnly?: boolean;

  /** Recency bias factor (0-1, higher = prefer recent) */
  recencyBias?: number;

  /** Maximum results to return */
  limit?: number;
}

/**
 * Parsed temporal expression from natural language
 */
export interface ParsedTemporalExpression {
  /** Original text */
  original: string;

  /** Resolved date range */
  resolved: { start: Date; end: Date };

  /** Confidence in parse (0-1) */
  confidence: number;

  /** Type of temporal expression */
  type: 'absolute' | 'relative' | 'recurring';
}

// ============================================================================
// Natural Language Temporal Parsing
// ============================================================================

/**
 * Temporal pattern matchers
 */
interface TemporalPattern {
  pattern: RegExp;
  type: 'absolute' | 'relative' | 'recurring';
  resolver: (match: RegExpMatchArray, referenceDate: Date) => { start: Date; end: Date } | null;
  confidence: number;
}

/**
 * Parse day of week from text
 */
function parseDayOfWeek(day: string): number | null {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return days[day.toLowerCase()] ?? null;
}

/**
 * Parse month from text
 */
function parseMonth(month: string): number | null {
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  return months[month.toLowerCase()] ?? null;
}

/**
 * Get date range for a specific day of week (looking backward)
 */
function getLastDayOfWeek(dayOfWeek: number, referenceDate: Date): { start: Date; end: Date } {
  const current = new Date(referenceDate);
  const currentDay = current.getDay();

  // Calculate days to subtract
  let daysBack = currentDay - dayOfWeek;
  if (daysBack <= 0) {
    daysBack += 7; // Go to previous week
  }

  const targetDate = subDays(current, daysBack);
  return {
    start: startOfDay(targetDate),
    end: endOfDay(targetDate),
  };
}

/**
 * Get date range for next occurrence of day of week
 */
function getNextDayOfWeek(dayOfWeek: number, referenceDate: Date): { start: Date; end: Date } {
  const current = new Date(referenceDate);
  const currentDay = current.getDay();

  // Calculate days to add
  let daysForward = dayOfWeek - currentDay;
  if (daysForward <= 0) {
    daysForward += 7; // Go to next week
  }

  const targetDate = addDays(current, daysForward);
  return {
    start: startOfDay(targetDate),
    end: endOfDay(targetDate),
  };
}

/**
 * Temporal pattern definitions
 */
const TEMPORAL_PATTERNS: TemporalPattern[] = [
  // Relative - Today/Yesterday/Tomorrow
  {
    pattern: /\btoday\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => ({
      start: startOfDay(ref),
      end: endOfDay(ref),
    }),
  },
  {
    pattern: /\byesterday\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => {
      const yesterday = subDays(ref, 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    },
  },
  {
    pattern: /\btomorrow\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => {
      const tomorrow = addDays(ref, 1);
      return {
        start: startOfDay(tomorrow),
        end: endOfDay(tomorrow),
      };
    },
  },

  // Relative - This/Last Week/Month/Year
  {
    pattern: /\bthis\s+week\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => ({
      start: startOfWeek(ref, { weekStartsOn: 0 }),
      end: endOfWeek(ref, { weekStartsOn: 0 }),
    }),
  },
  {
    pattern: /\blast\s+week\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => {
      const lastWeek = subWeeks(ref, 1);
      return {
        start: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        end: endOfWeek(lastWeek, { weekStartsOn: 0 }),
      };
    },
  },
  {
    pattern: /\bthis\s+month\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => ({
      start: startOfMonth(ref),
      end: endOfMonth(ref),
    }),
  },
  {
    pattern: /\blast\s+month\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => {
      const lastMonth = subMonths(ref, 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    },
  },
  {
    pattern: /\bthis\s+year\b/i,
    type: 'relative',
    confidence: 1.0,
    resolver: (_, ref) => ({
      start: startOfYear(ref),
      end: endOfYear(ref),
    }),
  },

  // Relative - N days/weeks/months ago
  {
    pattern: /\b(\d+)\s+days?\s+ago\b/i,
    type: 'relative',
    confidence: 0.95,
    resolver: (match, ref) => {
      const days = parseInt(match[1], 10);
      const targetDate = subDays(ref, days);
      return {
        start: startOfDay(targetDate),
        end: endOfDay(targetDate),
      };
    },
  },
  {
    pattern: /\b(\d+)\s+weeks?\s+ago\b/i,
    type: 'relative',
    confidence: 0.95,
    resolver: (match, ref) => {
      const weeks = parseInt(match[1], 10);
      const targetDate = subWeeks(ref, weeks);
      return {
        start: startOfWeek(targetDate, { weekStartsOn: 0 }),
        end: endOfWeek(targetDate, { weekStartsOn: 0 }),
      };
    },
  },
  {
    pattern: /\b(\d+)\s+months?\s+ago\b/i,
    type: 'relative',
    confidence: 0.95,
    resolver: (match, ref) => {
      const months = parseInt(match[1], 10);
      const targetDate = subMonths(ref, months);
      return {
        start: startOfMonth(targetDate),
        end: endOfMonth(targetDate),
      };
    },
  },

  // Relative - Last/Next [DayOfWeek]
  {
    pattern: /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    type: 'relative',
    confidence: 0.9,
    resolver: (match, ref) => {
      const dayOfWeek = parseDayOfWeek(match[1]);
      if (dayOfWeek === null) return null;
      return getLastDayOfWeek(dayOfWeek, ref);
    },
  },
  {
    pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    type: 'relative',
    confidence: 0.9,
    resolver: (match, ref) => {
      const dayOfWeek = parseDayOfWeek(match[1]);
      if (dayOfWeek === null) return null;
      return getNextDayOfWeek(dayOfWeek, ref);
    },
  },

  // Absolute - ISO date (YYYY-MM-DD)
  {
    pattern: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    type: 'absolute',
    confidence: 1.0,
    resolver: (match) => {
      const date = parseISO(match[0]);
      if (!isValid(date)) return null;
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    },
  },

  // Absolute - M/D/YY or MM/DD/YYYY
  {
    pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/,
    type: 'absolute',
    confidence: 0.85,
    resolver: (match) => {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);

      // Convert 2-digit year to 4-digit
      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      const date = new Date(year, month, day);
      if (!isValid(date)) return null;
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    },
  },

  // Absolute - Month Day (e.g., "December 5th", "Dec 5")
  {
    pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
    type: 'absolute',
    confidence: 0.9,
    resolver: (match, ref) => {
      const month = parseMonth(match[1]);
      if (month === null) return null;

      const day = parseInt(match[2], 10);
      const year = ref.getFullYear();
      const date = new Date(year, month, day);

      if (!isValid(date)) return null;
      return {
        start: startOfDay(date),
        end: endOfDay(date),
      };
    },
  },

  // Ranges - Between X and Y
  {
    pattern: /\bbetween\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+and\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    type: 'relative',
    confidence: 0.8,
    resolver: (match, ref) => {
      const startDay = parseDayOfWeek(match[1]);
      const endDay = parseDayOfWeek(match[2]);

      if (startDay === null || endDay === null) return null;

      const startRange = getLastDayOfWeek(startDay, ref);
      const endRange = getLastDayOfWeek(endDay, ref);

      return {
        start: startRange.start,
        end: endRange.end,
      };
    },
  },

  // Recurring - every [period]
  {
    pattern: /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|day|week|month)\b/i,
    type: 'recurring',
    confidence: 0.7,
    resolver: (match, ref) => {
      // For recurring patterns, return a wide range (last 30 days)
      // Actual recurring logic should be handled separately
      return {
        start: subDays(ref, 30),
        end: ref,
      };
    },
  },
];

/**
 * Parse temporal expression from natural language text
 *
 * @param text - Natural language text potentially containing temporal expressions
 * @param referenceDate - Reference date for relative expressions (default: now)
 * @returns Parsed temporal expression or null if no match
 */
export function parseTemporalExpression(
  text: string,
  referenceDate: Date = new Date()
): ParsedTemporalExpression | null {
  for (const pattern of TEMPORAL_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (match) {
      const resolved = pattern.resolver(match, referenceDate);
      if (resolved) {
        return {
          original: match[0],
          resolved,
          confidence: pattern.confidence,
          type: pattern.type,
        };
      }
    }
  }

  return null;
}

/**
 * Extract temporal context from a natural language query
 *
 * Identifies temporal expressions and returns cleaned query + temporal info
 *
 * @param query - Natural language query
 * @returns Cleaned query (temporal expressions removed) and temporal query
 */
export function extractTemporalContext(query: string): {
  cleanedQuery: string;
  temporal: TemporalQuery | null;
} {
  const parsed = parseTemporalExpression(query);

  if (!parsed) {
    return { cleanedQuery: query, temporal: null };
  }

  // Remove temporal expression from query
  const cleanedQuery = query.replace(parsed.original, '').trim();

  // Convert to TemporalQuery
  const temporal: TemporalQuery = {
    reference: { range: parsed.resolved },
    direction: 'exact',
  };

  return { cleanedQuery, temporal };
}

// ============================================================================
// Temporal Scoring
// ============================================================================

/**
 * Calculate temporal relevance score for an event
 *
 * @param eventTimestamp - Timestamp of the event
 * @param queryTemporal - Temporal query specification
 * @param recencyBias - Recency bias factor (0-1, higher = prefer recent)
 * @returns Temporal score (0-1)
 */
export function calculateTemporalScore(
  eventTimestamp: Date,
  queryTemporal: TemporalQuery,
  recencyBias: number = 0
): number {
  const { reference, direction = 'exact', windowMs = 3600000 } = queryTemporal;

  let queryStart: Date;
  let queryEnd: Date;

  // Resolve reference to date range
  if (typeof reference === 'string') {
    // Handle string references
    const now = new Date();
    switch (reference) {
      case 'today':
        queryStart = startOfDay(now);
        queryEnd = endOfDay(now);
        break;
      case 'yesterday':
        queryStart = startOfDay(subDays(now, 1));
        queryEnd = endOfDay(subDays(now, 1));
        break;
      case 'this_week':
        queryStart = startOfWeek(now, { weekStartsOn: 0 });
        queryEnd = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case 'last_week':
        queryStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        queryEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        break;
      case 'this_month':
        queryStart = startOfMonth(now);
        queryEnd = endOfMonth(now);
        break;
      case 'last_month':
        queryStart = startOfMonth(subMonths(now, 1));
        queryEnd = endOfMonth(subMonths(now, 1));
        break;
      case 'this_year':
        queryStart = startOfYear(now);
        queryEnd = endOfYear(now);
        break;
      default:
        return 0;
    }
  } else if ('date' in reference) {
    queryStart = startOfDay(reference.date);
    queryEnd = endOfDay(reference.date);
  } else {
    queryStart = reference.range.start;
    queryEnd = reference.range.end;
  }

  // Apply direction modifier
  if (direction === 'before') {
    queryEnd = queryStart;
    queryStart = new Date(0); // Beginning of time
  } else if (direction === 'after') {
    queryStart = queryEnd;
    queryEnd = new Date(2100, 0, 1); // Far future
  } else if (direction === 'around') {
    const centerTime = (queryStart.getTime() + queryEnd.getTime()) / 2;
    queryStart = new Date(centerTime - windowMs);
    queryEnd = new Date(centerTime + windowMs);
  }

  // Calculate base temporal score
  let baseScore = 0;

  if (isAfter(eventTimestamp, queryStart) && isBefore(eventTimestamp, queryEnd)) {
    // Event is within range
    baseScore = 1.0;
  } else {
    // Event is outside range - calculate distance penalty
    const distanceBefore = Math.max(0, differenceInMilliseconds(queryStart, eventTimestamp));
    const distanceAfter = Math.max(0, differenceInMilliseconds(eventTimestamp, queryEnd));
    const distance = Math.min(distanceBefore, distanceAfter);

    // Exponential decay based on distance
    const maxDistance = 30 * 24 * 3600 * 1000; // 30 days
    baseScore = Math.exp(-distance / maxDistance);
  }

  // Apply recency bias if specified
  if (recencyBias > 0) {
    const now = new Date();
    const age = differenceInMilliseconds(now, eventTimestamp);
    const maxAge = 365 * 24 * 3600 * 1000; // 1 year
    const recencyScore = Math.exp(-age / maxAge);

    // Blend base score with recency score
    baseScore = baseScore * (1 - recencyBias) + recencyScore * recencyBias;
  }

  return Math.max(0, Math.min(1, baseScore));
}

// ============================================================================
// Overdue Detection
// ============================================================================

/**
 * Extract deadline from event metadata or content
 *
 * @param event - Working memory event
 * @returns Deadline date if found, null otherwise
 */
function extractDeadline(event: WorkingMemoryEvent): Date | null {
  // Check metadata first
  if (event.metadata?.deadline) {
    const deadline = parseISO(event.metadata.deadline as string);
    if (isValid(deadline)) return deadline;
  }

  // Try to parse from content
  const deadlineExpressions = [
    /\bdeadline:?\s*(\d{4}-\d{2}-\d{2})/i,
    /\bdue:?\s*(\d{4}-\d{2}-\d{2})/i,
    /\bby:?\s*(\d{4}-\d{2}-\d{2})/i,
    /\bdeadline:?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i,
  ];

  for (const expr of deadlineExpressions) {
    const match = event.content.match(expr);
    if (match) {
      const parsed = parseTemporalExpression(match[0]);
      if (parsed) {
        return parsed.resolved.end;
      }
    }
  }

  return null;
}

/**
 * Find overdue items in working memory
 *
 * @param workingMemory - Working memory instance
 * @param referenceDate - Reference date for "now" (default: current time)
 * @returns Array of overdue events
 */
export async function findOverdueItems(
  workingMemory: WorkingMemory,
  referenceDate: Date = new Date()
): Promise<WorkingMemoryEvent[]> {
  // Get all unprocessed events
  const events = await workingMemory.getUnprocessed(1000);

  // Filter for events with past deadlines
  const overdueEvents = events.filter((event) => {
    const deadline = extractDeadline(event);
    if (!deadline) return false;
    return isBefore(deadline, referenceDate);
  });

  // Sort by deadline (most overdue first)
  return overdueEvents.sort((a, b) => {
    const deadlineA = extractDeadline(a)!;
    const deadlineB = extractDeadline(b)!;
    return deadlineA.getTime() - deadlineB.getTime();
  });
}

// ============================================================================
// Temporal Search
// ============================================================================

/**
 * Search working memory with temporal constraints
 *
 * @param baseQuery - Base search query (can include temporal expressions)
 * @param options - Temporal search options
 * @param workingMemory - Working memory instance
 * @returns Array of matching events with temporal scoring
 */
export async function searchWithTemporal(
  baseQuery: string,
  options: TemporalSearchOptions,
  workingMemory: WorkingMemory
): Promise<WorkingMemoryEvent[]> {
  let { temporal, includeOverdue = false, deadlineOnly = false, recencyBias = 0, limit } = options;

  // Extract temporal context from query if not explicitly provided
  if (!temporal) {
    const extracted = extractTemporalContext(baseQuery);
    temporal = extracted.temporal ?? undefined; // Convert null to undefined
    baseQuery = extracted.cleanedQuery;
  }

  // Get candidate events
  let candidates: WorkingMemoryEvent[];

  if (temporal) {
    // Get events within expanded temporal range
    const reference = temporal.reference;
    let rangeStart: Date;
    let rangeEnd: Date;

    if (typeof reference === 'string') {
      const now = new Date();
      switch (reference) {
        case 'today':
          rangeStart = startOfDay(now);
          rangeEnd = endOfDay(now);
          break;
        case 'yesterday':
          rangeStart = startOfDay(subDays(now, 1));
          rangeEnd = endOfDay(subDays(now, 1));
          break;
        case 'this_week':
          rangeStart = startOfWeek(now, { weekStartsOn: 0 });
          rangeEnd = endOfWeek(now, { weekStartsOn: 0 });
          break;
        case 'last_week':
          rangeStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
          rangeEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
          break;
        case 'this_month':
          rangeStart = startOfMonth(now);
          rangeEnd = endOfMonth(now);
          break;
        case 'last_month':
          rangeStart = startOfMonth(subMonths(now, 1));
          rangeEnd = endOfMonth(subMonths(now, 1));
          break;
        case 'this_year':
          rangeStart = startOfYear(now);
          rangeEnd = endOfYear(now);
          break;
        default:
          rangeStart = subYears(now, 1);
          rangeEnd = now;
      }
    } else if ('date' in reference) {
      rangeStart = startOfDay(reference.date);
      rangeEnd = endOfDay(reference.date);
    } else {
      rangeStart = reference.range.start;
      rangeEnd = reference.range.end;
    }

    // Get events in time range (with buffer)
    const buffer = 7 * 24 * 3600 * 1000; // 7 days buffer
    const expandedStart = new Date(rangeStart.getTime() - buffer);
    const expandedEnd = new Date(rangeEnd.getTime() + buffer);

    const hoursDiff = differenceInMilliseconds(expandedEnd, expandedStart) / 3600000;
    candidates = await workingMemory.getRecent(hoursDiff);
  } else {
    // No temporal constraint - get recent events
    candidates = await workingMemory.getRecent(24 * 30); // Last 30 days
  }

  // Filter by deadline if requested
  if (deadlineOnly) {
    candidates = candidates.filter((event) => extractDeadline(event) !== null);
  }

  if (includeOverdue) {
    const overdue = await findOverdueItems(workingMemory);
    // Merge overdue with candidates (avoid duplicates)
    const candidateIds = new Set(candidates.map((e) => e.id));
    for (const event of overdue) {
      if (!candidateIds.has(event.id)) {
        candidates.push(event);
      }
    }
  }

  // Filter by text query if provided
  if (baseQuery.trim()) {
    const queryLower = baseQuery.toLowerCase();
    candidates = candidates.filter((event) => {
      return (
        event.content.toLowerCase().includes(queryLower) ||
        event.source.toLowerCase().includes(queryLower) ||
        JSON.stringify(event.metadata || {})
          .toLowerCase()
          .includes(queryLower)
      );
    });
  }

  // Score and sort events
  const scored = candidates.map((event) => {
    let score = 1.0;

    // Apply temporal scoring if temporal query exists
    if (temporal) {
      const eventDate = parseISO(event.timestamp);
      const temporalScore = calculateTemporalScore(eventDate, temporal, recencyBias);
      score *= temporalScore;
    } else if (recencyBias > 0) {
      // Just apply recency bias
      const eventDate = parseISO(event.timestamp);
      const now = new Date();
      const age = differenceInMilliseconds(now, eventDate);
      const maxAge = 365 * 24 * 3600 * 1000; // 1 year
      const recencyScore = Math.exp(-age / maxAge);
      score *= recencyScore;
    }

    // Boost overdue items
    const deadline = extractDeadline(event);
    if (deadline && isBefore(deadline, new Date())) {
      score *= 1.5;
    }

    return { event, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Apply limit if specified
  const results = scored.map((s) => s.event);
  return limit ? results.slice(0, limit) : results;
}

// ============================================================================
// Temporal Search Preprocessor
// ============================================================================

/**
 * Temporal search preprocessor that wraps working memory search
 */
export class TemporalSearchPreprocessor {
  constructor(private workingMemory: WorkingMemory) {}

  /**
   * Search working memory with natural language temporal queries
   *
   * @param query - Natural language query (can include temporal expressions)
   * @param options - Optional search options
   * @returns Array of matching events
   */
  async search(query: string, options?: TemporalSearchOptions): Promise<WorkingMemoryEvent[]> {
    return searchWithTemporal(query, options || {}, this.workingMemory);
  }

  /**
   * Extract temporal context from natural language query
   *
   * @param query - Natural language query
   * @returns Cleaned query and temporal query
   */
  extractTemporalContext(query: string): {
    cleanedQuery: string;
    temporal: TemporalQuery | null;
  } {
    return extractTemporalContext(query);
  }

  /**
   * Find all overdue items
   *
   * @param referenceDate - Optional reference date (default: now)
   * @returns Array of overdue events
   */
  async findOverdue(referenceDate?: Date): Promise<WorkingMemoryEvent[]> {
    return findOverdueItems(this.workingMemory, referenceDate);
  }

  /**
   * Parse temporal expression from text
   *
   * @param text - Text containing temporal expression
   * @param referenceDate - Optional reference date
   * @returns Parsed temporal expression or null
   */
  parseExpression(text: string, referenceDate?: Date): ParsedTemporalExpression | null {
    return parseTemporalExpression(text, referenceDate);
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Types are exported via export interface above
};

/**
 * Create a temporal search preprocessor for a working memory instance
 *
 * @param workingMemory - Working memory instance
 * @returns Temporal search preprocessor
 */
export function createTemporalSearchPreprocessor(
  workingMemory: WorkingMemory
): TemporalSearchPreprocessor {
  return new TemporalSearchPreprocessor(workingMemory);
}
