/**
 * Wrath Shield v3 - Cognitive Synthesis Engine Initialization
 *
 * Initializes the Cortex system on application startup:
 * - Initializes Working Memory buffer
 * - Optionally starts Synthesis Loop (background processing)
 * - Provides health check utilities
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getWorkingMemory, type WorkingMemoryConfig } from './working-memory';

// Prevent client-side imports
ensureServerOnly('lib/cortex/init');

/**
 * Cortex initialization configuration
 */
export interface CortexInitConfig {
  /** Working Memory configuration */
  workingMemory?: Partial<WorkingMemoryConfig>;

  /** Whether to start the synthesis loop automatically (default: false) */
  startSynthesisLoop?: boolean;

  /** Synthesis loop interval in milliseconds (default: 300000 = 5 minutes) */
  synthesisIntervalMs?: number;

  /** Minimum events before triggering synthesis (default: 3) */
  minEventsForSynthesis?: number;
}

/**
 * Cortex initialization state
 */
interface CortexState {
  initialized: boolean;
  workingMemoryReady: boolean;
  synthesisLoopRunning: boolean;
  lastInitialized?: Date;
  synthesisTimerId?: NodeJS.Timeout;
}

const state: CortexState = {
  initialized: false,
  workingMemoryReady: false,
  synthesisLoopRunning: false,
};

/**
 * Initialize Cortex system
 *
 * Call this function on application startup (e.g., in API route middleware or server initialization).
 *
 * @param config - Optional configuration
 * @returns Promise<void>
 */
export async function initializeCortex(config?: CortexInitConfig): Promise<void> {
  if (state.initialized) {
    console.log('[Cortex] Already initialized, skipping');
    return;
  }

  console.log('[Cortex] Initializing Cognitive Synthesis Engine...');

  try {
    // 1. Initialize Working Memory
    console.log('[Cortex] Initializing Working Memory...');
    const workingMemory = getWorkingMemory(config?.workingMemory);
    const stats = await workingMemory.getStats();

    console.log('[Cortex] Working Memory initialized:', {
      totalEvents: stats.totalEvents,
      unprocessedEvents: stats.unprocessedEvents,
      eventsBySource: stats.eventsBySource,
    });

    state.workingMemoryReady = true;

    // 2. Optionally start Synthesis Loop
    if (config?.startSynthesisLoop) {
      console.log('[Cortex] Starting Synthesis Loop...');
      await startSynthesisLoop({
        intervalMs: config.synthesisIntervalMs || 300000, // 5 minutes
        minEventsForSynthesis: config.minEventsForSynthesis || 3,
      });
    } else {
      console.log('[Cortex] Synthesis Loop not started (startSynthesisLoop: false)');
    }

    state.initialized = true;
    state.lastInitialized = new Date();

    console.log('[Cortex] Initialization complete ✓');
  } catch (error) {
    console.error('[Cortex] Initialization failed:', error);
    throw new Error(`Cortex initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start the synthesis loop (background task that processes events)
 *
 * NOTE: This is a placeholder. The actual synthesis loop implementation
 * will be in a separate module (e.g., lib/cortex/synthesis-loop.ts).
 *
 * @param config - Synthesis loop configuration
 */
async function startSynthesisLoop(config: {
  intervalMs: number;
  minEventsForSynthesis: number;
}): Promise<void> {
  if (state.synthesisLoopRunning) {
    console.warn('[Cortex] Synthesis Loop already running');
    return;
  }

  console.log(`[Cortex] Starting Synthesis Loop (interval: ${config.intervalMs}ms, min events: ${config.minEventsForSynthesis})`);

  // Import synthesis loop dynamically to avoid circular dependencies
  const { getSynthesisLoop } = await import('./synthesis-loop');
  const { taskStore, applySynthesisResult } = await import('./task-store');
  const { learnFromSynthesis } = await import('./pattern-learner');

  const runSynthesis = async () => {
    try {
      const workingMemory = getWorkingMemory();
      const stats = await workingMemory.getStats();

      if (stats.unprocessedEvents >= config.minEventsForSynthesis) {
        console.log(`[Cortex] Synthesis triggered: ${stats.unprocessedEvents} unprocessed events`);

        // Get synthesis loop and run a synthesis pass
        const synthesisLoop = getSynthesisLoop();
        const result = await synthesisLoop.runSynthesisPass();

        if (result) {
          // Apply synthesis result to database
          const summary = await applySynthesisResult(result, taskStore);
          console.log(`[Cortex] ${summary.summary}`);

          // Learn from synthesis patterns
          await learnFromSynthesis(result);
          console.log(`[Cortex] Learned ${result.new_patterns.length} new patterns`);
        }
      } else {
        console.log(`[Cortex] Synthesis skipped: only ${stats.unprocessedEvents} unprocessed events (min: ${config.minEventsForSynthesis})`);
      }
    } catch (error) {
      console.error('[Cortex] Synthesis loop error:', error);
    }
  };

  // Run immediately on start
  await runSynthesis();

  // Schedule periodic runs
  state.synthesisTimerId = setInterval(runSynthesis, config.intervalMs);
  state.synthesisLoopRunning = true;

  console.log('[Cortex] Synthesis Loop started ✓');
}

/**
 * Stop the synthesis loop
 */
export function stopSynthesisLoop(): void {
  if (state.synthesisTimerId) {
    clearInterval(state.synthesisTimerId);
    state.synthesisTimerId = undefined;
    state.synthesisLoopRunning = false;
    console.log('[Cortex] Synthesis Loop stopped');
  }
}

/**
 * Get Cortex health status
 *
 * @returns Health status object
 */
export async function getCortexHealth() {
  if (!state.initialized) {
    return {
      status: 'not_initialized',
      initialized: false,
      workingMemoryReady: false,
      synthesisLoopRunning: false,
    };
  }

  try {
    const workingMemory = getWorkingMemory();
    const stats = await workingMemory.getStats();

    return {
      status: 'healthy',
      initialized: state.initialized,
      workingMemoryReady: state.workingMemoryReady,
      synthesisLoopRunning: state.synthesisLoopRunning,
      lastInitialized: state.lastInitialized?.toISOString(),
      workingMemoryStats: {
        totalEvents: stats.totalEvents,
        unprocessedEvents: stats.unprocessedEvents,
        eventsBySource: stats.eventsBySource,
        oldestEvent: stats.oldestEventTimestamp,
        newestEvent: stats.newestEventTimestamp,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      initialized: state.initialized,
      workingMemoryReady: false,
      synthesisLoopRunning: state.synthesisLoopRunning,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reset Cortex state (for testing)
 */
export function resetCortex(): void {
  stopSynthesisLoop();
  state.initialized = false;
  state.workingMemoryReady = false;
  state.synthesisLoopRunning = false;
  state.lastInitialized = undefined;
  console.log('[Cortex] State reset');
}

/**
 * Check if Cortex is initialized
 */
export function isCortexInitialized(): boolean {
  return state.initialized;
}

/**
 * Check if Synthesis Loop is running
 */
export function isSynthesisLoopRunning(): boolean {
  return state.synthesisLoopRunning;
}
