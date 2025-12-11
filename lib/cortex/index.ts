/**
 * Cognitive Synthesis Engine - Main Entry Point
 *
 * The Cortex is the brain of the LifeOS system that transforms raw event streams
 * (emails, messages, Limitless transcripts, calendar events) into synthesized,
 * unified tasks through continuous LLM-powered analysis.
 *
 * Key Capabilities:
 * - Holistic stream processing (not event-by-event)
 * - Task consolidation and refinement
 * - Confidence-based proactive execution
 * - Pattern learning and meta-improvement
 *
 * @module lib/cortex
 */

import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/cortex');

// ============================================================================
// Core Types
// ============================================================================

export type {
  WorkingMemoryEvent,
  EventSource,
  UnifiedTask,
  UnifiedTaskStatus,
  UrgencyLevel,
  ProactiveAction,
  ProactiveActionType,
  SynthesisPattern,
  SynthesisPatternType,
  SynthesisResult,
  TaskUpdate,
  SynthesisLoopConfig,
  ConfidenceThresholds,
  TaskQuery,
  EventBufferQuery,
  SynthesisMetrics,
  UnifiedTaskPartial,
} from './types';

export {
  DEFAULT_SYNTHESIS_CONFIG,
  createWorkingMemoryEvent,
  createUnifiedTask,
  createProactiveAction,
  isWorkingMemoryEvent,
  isUnifiedTask,
  isProactiveAction,
  isSynthesisPattern,
  isSynthesisResult,
} from './types';

// ============================================================================
// Working Memory Buffer
// ============================================================================

export {
  WorkingMemory,
  getWorkingMemory,
  resetWorkingMemory,
  type WorkingMemoryConfig,
  type WorkingMemoryStats,
} from './working-memory';

// ============================================================================
// Event Ingestion
// ============================================================================

export {
  ingestEmail,
  ingestIMessage,
  ingestLimitless,
  ingestCalendar,
  type EmailInput,
  type IMessageInput,
  type LimitlessInput,
  type CalendarInput,
  type IngestionResult,
} from './event-ingestor';

// ============================================================================
// Synthesis Engine
// ============================================================================

export {
  SynthesisLoop,
  getSynthesisLoop,
  resetSynthesisLoop,
  synthesisLoop,
  type SynthesisLoopStatus,
} from './synthesis-loop';

export {
  buildSynthesisPrompt,
  formatEventsForPrompt,
  formatTasksForPrompt,
  formatPatternsForPrompt,
  SYNTHESIS_SYSTEM_PROMPT,
  type SynthesisContext,
} from './synthesis-prompt';

// ============================================================================
// Task Management
// ============================================================================

export {
  TaskStore,
  Consolidator,
  taskStore,
  consolidator,
  applySynthesisResult,
} from './task-store';

// ============================================================================
// Proactive Execution
// ============================================================================

export {
  ProactiveExecutor,
  proactiveExecutor,
  evaluateAction,
  executeAction,
  proposeAction,
  handleSynthesisActions,
  type ExecutionDecision,
  type ExecutionResult,
  type ExecutionSummary,
  type ExecutionEscalationLevel,
} from './executor';

// ============================================================================
// Pattern Learning
// ============================================================================

export {
  PatternLearner,
  MetaImprover,
  learnFromSynthesis,
  learnFromCorrection,
  getRelevantPatterns,
  updatePatternSuccess,
  prunePatterns,
} from './pattern-learner';

// Default export re-exported as named
export { default as patternLearner } from './pattern-learner';

// ============================================================================
// Initialization
// ============================================================================

export {
  initializeCortex,
  getCortexHealth,
  stopSynthesisLoop,
  resetCortex,
  isCortexInitialized,
  isSynthesisLoopRunning,
  type CortexInitConfig,
} from './init';

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run a single synthesis pass manually.
 * Useful for testing or triggering synthesis on-demand.
 */
export async function runSynthesis(): Promise<import('./types').SynthesisResult | null> {
  const { synthesisLoop } = await import('./synthesis-loop');
  return synthesisLoop.runSynthesisPass();
}

/**
 * Get current cortex status for dashboards.
 */
export async function getCortexStatus() {
  const { getCortexHealth } = await import('./init');
  const { synthesisLoop } = await import('./synthesis-loop');
  const { getWorkingMemory } = await import('./working-memory');

  const health = await getCortexHealth();
  const loopStatus = synthesisLoop.getStatus();
  const workingMemory = getWorkingMemory();
  const memoryStats = await workingMemory.getStats();

  return {
    initialized: health.initialized,
    synthesisLoop: loopStatus,
    workingMemory: memoryStats,
    health: health.status,
    lastError: 'error' in health ? health.error : undefined,
  };
}

/**
 * Quick health check for API routes.
 */
export function isHealthy(): boolean {
  try {
    const { isCortexInitialized } = require('./init');
    return isCortexInitialized();
  } catch {
    return false;
  }
}
