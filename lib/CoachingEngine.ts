/**
 * Wrath Shield v3 - Coaching Engine with Context Assembly
 *
 * Assembles coaching context from:
 * - Today's WHOOP metrics (recovery, cycle, sleep)
 * - Recent lifelogs with manipulation detection
 * - Retrieved memories from semantic search
 * - Relevant anchors from memory
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import type { Recovery, Cycle, Sleep, Lifelog } from './db/types';

// Prevent client-side imports
ensureServerOnly('lib/CoachingEngine');

/**
 * Daily context aggregated from database
 */
export interface DailyContext {
  date: string; // YYYY-MM-DD
  recovery: Recovery | null;
  cycle: Cycle | null;
  sleep: Sleep | null;
  lifelogs: Lifelog[];
  totalManipulations: number;
  wrathDeployed: boolean;
}

/**
 * Memory search result with relevance
 */
export interface RelevantMemory {
  id: string;
  text: string;
  metadata?: Record<string, any>;
  score?: number; // Similarity score if available
}

/**
 * Anchor memory for grounding
 */
export interface AnchorMemory {
  id: string;
  text: string;
  category: string;
  date: string;
  metadata?: Record<string, any>;
}

/**
 * Complete coaching context assembled for LLM
 */
export interface CoachingContext {
  dailyContext: DailyContext;
  relevantMemories: RelevantMemory[];
  anchors: AnchorMemory[];
  query: string; // The semantic query used for memory retrieval
}

/**
 * Build daily context from database for a specific date
 *
 * @param date - Date in YYYY-MM-DD format
 * @returns Complete daily context with WHOOP metrics and lifelogs
 */
export async function buildDailyContext(date: string): Promise<DailyContext> {
  // Dynamic imports to avoid circular dependencies
  const {
    getLatestRecovery,
    getLatestCycle,
    getLatestSleep,
    getLifelogsForDate,
  } = await import('./db/queries');

  // For "today", use latest metrics
  // For past dates, we would need date-specific queries (enhancement for future)
  const recovery = getLatestRecovery();
  const cycle = getLatestCycle();
  const sleep = getLatestSleep();
  const lifelogs = getLifelogsForDate(date);

  // Calculate manipulation stats
  const totalManipulations = lifelogs.reduce(
    (sum, log) => sum + log.manipulation_count,
    0
  );
  const wrathDeployed = lifelogs.some((log) => log.wrath_deployed === 1);

  return {
    date,
    recovery,
    cycle,
    sleep,
    lifelogs,
    totalManipulations,
    wrathDeployed,
  };
}

/**
 * Search for relevant memories using semantic query
 *
 * @param query - Semantic search query (e.g., "low recovery", "manipulation")
 * @param userId - User identifier for memory retrieval
 * @param limit - Maximum number of memories to retrieve (default: 5)
 * @returns Array of relevant memories with similarity scores
 */
export async function searchRelevantMemories(
  query: string,
  userId: string = 'default',
  limit: number = 5
): Promise<RelevantMemory[]> {
  const { searchMemories } = await import('./MemoryWrapper');

  const results = await searchMemories(query, userId, limit);

  // Transform Mem0 results to our interface
  return results.map((result) => ({
    id: result.id ?? result.memory_id ?? 'unknown',
    text: result.text ?? result.memory ?? '',
    metadata: result.metadata,
    score: result.score,
  }));
}

/**
 * Get relevant anchors from memory
 *
 * Anchors are foundational memories that ground the coaching context
 * (e.g., "I will not tolerate manipulation", "Recovery is non-negotiable")
 *
 * @param userId - User identifier for memory retrieval
 * @param category - Optional category filter (e.g., "boundaries", "recovery")
 * @param since - Optional date filter (YYYY-MM-DD), retrieves anchors >= this date
 * @param limit - Maximum number of anchors to retrieve (default: 5)
 * @returns Array of anchor memories sorted by date (newest first)
 */
export async function getRelevantAnchors(
  userId: string = 'default',
  category?: string,
  since?: string,
  limit: number = 5
): Promise<AnchorMemory[]> {
  const { getAnchors } = await import('./MemoryWrapper');

  const anchors = await getAnchors(userId, { category, since });

  // Limit results
  const limitedAnchors = anchors.slice(0, limit);

  // Transform to our interface
  return limitedAnchors.map((anchor) => ({
    id: anchor.id ?? anchor.memory_id ?? 'unknown',
    text: anchor.text ?? anchor.memory ?? '',
    category: anchor.metadata?.category ?? 'general',
    date: anchor.metadata?.date ?? '',
    metadata: anchor.metadata,
  }));
}

/**
 * Assemble complete coaching context for LLM prompt
 *
 * This is the main orchestrator that combines:
 * 1. Today's daily context (WHOOP + lifelogs)
 * 2. Semantic search results based on current state
 * 3. Relevant anchors for grounding
 *
 * @param date - Date to build context for (defaults to today)
 * @param userId - User identifier for memory retrieval
 * @returns Complete coaching context ready for prompt assembly
 */
export async function assembleCoachingContext(
  date?: string,
  userId: string = 'default'
): Promise<CoachingContext> {
  // Default to today if no date provided
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  // 1. Build daily context from database
  const dailyContext = await buildDailyContext(targetDate);

  // 2. Construct semantic query based on current state
  const queryParts: string[] = [];

  if (dailyContext.recovery && dailyContext.recovery.score !== null) {
    if (dailyContext.recovery.score < 40) {
      queryParts.push('low recovery');
    } else if (dailyContext.recovery.score >= 70) {
      queryParts.push('high recovery');
    }
  }

  if (dailyContext.totalManipulations > 0) {
    queryParts.push('manipulation');
    queryParts.push('boundaries');
  }

  if (dailyContext.cycle && dailyContext.cycle.strain !== null) {
    if (dailyContext.cycle.strain > 14) {
      queryParts.push('high strain');
    }
  }

  // Default query if no specific conditions
  const query = queryParts.length > 0 ? queryParts.join(' ') : 'daily coaching';

  // 3. Search for relevant memories
  const relevantMemories = await searchRelevantMemories(query, userId, 5);

  // 4. Get anchors (last 30 days, limit 5)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const anchors = await getRelevantAnchors(userId, undefined, thirtyDaysAgo, 5);

  return {
    dailyContext,
    relevantMemories,
    anchors,
    query,
  };
}
