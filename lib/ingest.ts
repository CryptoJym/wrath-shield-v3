/**
 * Wrath Shield v3 - Daily Data Ingestion and Summary Composition
 *
 * Orchestrates daily data processing:
 * - Runs manipulation detection on lifelogs
 * - Composes semantically rich summaries combining WHOOP metrics + lifelog insights
 * - Prepares data for Mem0 storage
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import { analyzeLifelogFromRaw, type ManipulationAnalysis } from './ManipulationDetector';
import type { Recovery, Cycle, Sleep, Lifelog } from './db/types';

// Prevent client-side imports
ensureServerOnly('lib/ingest');

/**
 * Daily data aggregation from all sources
 */
export interface DailyData {
  date: string; // YYYY-MM-DD
  recovery?: Recovery;
  cycle?: Cycle;
  sleep?: Sleep;
  lifelogs: Lifelog[];
}

/**
 * Analyzed lifelog with manipulation detection results
 */
export interface AnalyzedLifelog {
  lifelog: Lifelog;
  analysis: ManipulationAnalysis;
}

/**
 * Complete daily summary ready for Mem0 storage
 */
export interface DailySummary {
  date: string; // YYYY-MM-DD
  summary: string; // Human-readable rich text summary
  metrics: {
    recovery_score: number | null;
    strain: number | null;
    sleep_performance: number | null;
    total_manipulations: number;
    wrath_deployed: boolean;
  };
  analyzed_lifelogs: AnalyzedLifelog[];
}

/**
 * Analyze a single lifelog's raw JSON for manipulation patterns
 *
 * @param lifelog - Lifelog record from database
 * @returns Analyzed lifelog with manipulation detection results
 */
export function analyzeLifelog(lifelog: Lifelog): AnalyzedLifelog {
  const analysis = lifelog.raw_json
    ? analyzeLifelogFromRaw(lifelog.raw_json)
    : {
        manipulation_count: 0,
        wrath_deployed: 0,
        flags: [],
      };

  return {
    lifelog,
    analysis,
  };
}

/**
 * Analyze all lifelogs for a given day
 *
 * @param lifelogs - Array of lifelog records
 * @returns Array of analyzed lifelogs
 */
export function analyzeLifelogs(lifelogs: Lifelog[]): AnalyzedLifelog[] {
  return lifelogs.map((lifelog) => analyzeLifelog(lifelog));
}

/**
 * Compose manipulation summary text from analyzed lifelogs
 *
 * @param analyzedLifelogs - Array of analyzed lifelogs
 * @returns Human-readable summary of manipulation events
 */
function composeManipulationSummary(analyzedLifelogs: AnalyzedLifelog[]): string {
  const totalManipulations = analyzedLifelogs.reduce(
    (sum, al) => sum + al.analysis.manipulation_count,
    0
  );

  const wrathDeployed = analyzedLifelogs.some((al) => al.analysis.wrath_deployed === 1);

  if (totalManipulations === 0) {
    return 'No manipulative interactions detected.';
  }

  const manipulationText = `${totalManipulations} manipulative ${
    totalManipulations === 1 ? 'phrase' : 'phrases'
  } detected`;

  if (wrathDeployed) {
    return `${manipulationText}. Deployed assertive boundaries in response.`;
  }

  return `${manipulationText}. No assertive boundary response detected.`;
}

/**
 * Compose a rich daily summary combining WHOOP metrics and lifelog insights
 *
 * Format: "YYYY-MM-DD: Recovery X%, Strain Y, Sleep Z%. [Manipulation summary]"
 *
 * Example outputs:
 * - "2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. No manipulative interactions detected."
 * - "2025-01-31: Recovery 45%, Strain 18.2, Sleep 62%. 3 manipulative phrases detected. Deployed assertive boundaries in response."
 * - "2025-01-31: No WHOOP data available. 1 manipulative phrase detected. No assertive boundary response detected."
 *
 * @param dailyData - Aggregated data for a single day
 * @returns DailySummary with rich text and structured metrics
 */
export function composeDailySummary(dailyData: DailyData): DailySummary {
  const { date, recovery, cycle, sleep, lifelogs } = dailyData;

  // Analyze all lifelogs
  const analyzedLifelogs = analyzeLifelogs(lifelogs);

  // Extract metrics with null handling
  const recoveryScore = recovery?.score ?? null;
  const strain = cycle?.strain ?? null;
  const sleepPerformance = sleep?.performance ?? null;

  const totalManipulations = analyzedLifelogs.reduce(
    (sum, al) => sum + al.analysis.manipulation_count,
    0
  );
  const wrathDeployed = analyzedLifelogs.some((al) => al.analysis.wrath_deployed === 1);

  // Compose WHOOP metrics part
  let whoopSummary: string;
  const hasWhoopData = recoveryScore !== null || strain !== null || sleepPerformance !== null;

  if (hasWhoopData) {
    const parts: string[] = [];

    if (recoveryScore !== null) {
      parts.push(`Recovery ${Math.round(recoveryScore)}%`);
    }

    if (strain !== null) {
      parts.push(`Strain ${strain.toFixed(1)}`);
    }

    if (sleepPerformance !== null) {
      parts.push(`Sleep ${Math.round(sleepPerformance)}%`);
    }

    whoopSummary = parts.join(', ') + '.';
  } else {
    whoopSummary = 'No WHOOP data available.';
  }

  // Compose manipulation summary part
  const manipulationSummary = composeManipulationSummary(analyzedLifelogs);

  // Combine into final summary
  const summary = `${date}: ${whoopSummary} ${manipulationSummary}`;

  return {
    date,
    summary,
    metrics: {
      recovery_score: recoveryScore,
      strain,
      sleep_performance: sleepPerformance,
      total_manipulations: totalManipulations,
      wrath_deployed: wrathDeployed,
    },
    analyzed_lifelogs: analyzedLifelogs,
  };
}

/**
 * Process daily data and compose summaries for multiple days
 *
 * @param dailyDataArray - Array of daily data aggregations
 * @returns Array of daily summaries
 */
export function composeDailySummaries(dailyDataArray: DailyData[]): DailySummary[] {
  return dailyDataArray.map((dailyData) => composeDailySummary(dailyData));
}

/**
 * Store daily summary in Mem0 and update SQLite with analyzed lifelog data
 *
 * This function orchestrates the complete storage workflow:
 * 1. Stores semantically rich summary in Mem0 for coaching retrieval
 * 2. Updates lifelogs table with manipulation detection results
 * 3. Calculates and stores unbending score in scores table
 *
 * @param summary - Complete daily summary from composeDailySummary()
 * @param userId - User identifier for Mem0 storage (defaults to 'default')
 */
export async function storeDailySummary(
  summary: DailySummary,
  userId: string = 'default'
): Promise<void> {
  // Lazy-load modules to avoid circular dependencies
  const { addDailySummary } = await import('./MemoryWrapper');
  // Keep legacy API names for test compatibility; user scoping handled in DB defaults
  const { insertLifelogs, calculateUnbendingScore } = await import('./db/queries');

  // 1. Store summary in Mem0 with structured metadata
  await addDailySummary(summary.summary, userId, {
    date: summary.date,
    recovery_score: summary.metrics.recovery_score,
    strain: summary.metrics.strain,
    sleep_performance: summary.metrics.sleep_performance,
    total_manipulations: summary.metrics.total_manipulations,
    wrath_deployed: summary.metrics.wrath_deployed,
  });

  // 2. Update lifelogs table with manipulation detection results
  // Build array of lifelog updates with analyzed manipulation data
  const lifelogUpdates = summary.analyzed_lifelogs.map((al) => ({
    id: al.lifelog.id,
    date: al.lifelog.date,
    title: al.lifelog.title,
    manipulation_count: al.analysis.manipulation_count,
    wrath_deployed: al.analysis.wrath_deployed,
    raw_json: al.lifelog.raw_json,
  }));

  // Perform idempotent batch upsert (handles same-day re-runs)
  if (lifelogUpdates.length > 0) {
    insertLifelogs(lifelogUpdates);
  }

  // 3. Calculate and store unbending score for this date
  // This reads the freshly-updated lifelogs and computes the score
  calculateUnbendingScore(summary.date);
}

/**
 * Store multiple daily summaries in batch
 *
 * @param summaries - Array of daily summaries
 * @param userId - User identifier for Mem0 storage (defaults to 'default')
 */
export async function storeDailySummaries(
  summaries: DailySummary[],
  userId: string = 'default'
): Promise<void> {
  // Process sequentially to maintain database transaction integrity
  for (const summary of summaries) {
    await storeDailySummary(summary, userId);
  }
}
