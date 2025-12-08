/**
 * Cognitive Synthesis Engine - Type Definitions
 *
 * This module defines all types for the Cognitive Synthesis Engine, which processes
 * events from multiple sources (Limitless, email, iMessage, calendar, GitHub) and
 * synthesizes them into unified, actionable tasks with proactive agent recommendations.
 *
 * Architecture:
 * - Working Memory Buffer: Holds recent events awaiting synthesis
 * - LLM Synthesis Loop: Periodically processes events to generate unified tasks
 * - Proactive Actions: Proposes automatic actions that agents can execute
 * - Pattern Learning: Identifies and stores recurring patterns for future synthesis
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import type { Domain } from '../ea/preference-model';
import type { AgentId } from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/cortex/types');

// ============================================================================
// Event Source Types
// ============================================================================

/**
 * Supported event sources for the Working Memory Buffer
 */
export type EventSource =
  | 'limitless'    // Limitless lifelogs (meetings, conversations, notes)
  | 'email'        // Email messages
  | 'imessage'     // iMessage conversations
  | 'calendar'     // Calendar events and reminders
  | 'github'       // GitHub notifications, PRs, issues
  | 'slack'        // Slack messages (future)
  | 'motion'       // Motion tasks (future)
  | 'whoop';       // WHOOP health data (future)

// ============================================================================
// Working Memory Event
// ============================================================================

/**
 * Event in the Working Memory Buffer awaiting synthesis
 *
 * Events are stored chronologically and processed in batches by the synthesis loop.
 * Each event tracks its processing status and can be linked to synthesized tasks.
 */
export interface WorkingMemoryEvent {
  /** Unique event identifier */
  id: string;

  /** Source of the event */
  source: EventSource;

  /** When the event occurred */
  timestamp: string; // ISO 8601

  /** Raw event content (text, JSON, etc.) */
  content: string;

  /**
   * Hash of content for deduplication
   * Used to prevent processing the same event multiple times
   */
  contentHash: string;

  /**
   * Optional vector embedding for semantic search
   * Generated lazily on first synthesis pass
   */
  embedding?: number[];

  /**
   * Initial classification from source ingestion
   * May be refined during synthesis
   */
  initialClassification?: {
    domain?: Domain;
    urgency?: 'critical' | 'high' | 'medium' | 'low' | 'background';
    keywords?: string[];
  };

  /**
   * Whether this event has been processed by synthesis
   * Events remain in buffer for context window even after processing
   */
  processedBySynthesis: boolean;

  /**
   * ID of synthesis task this event contributed to (if any)
   */
  synthesisTaskId?: string;

  /**
   * Optional metadata from source system
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Unified Task
// ============================================================================

/**
 * Task status lifecycle
 */
export type UnifiedTaskStatus =
  | 'synthesizing' // Being synthesized/refined from events
  | 'ready'        // Ready for review/approval
  | 'approved'     // Approved and ready for execution
  | 'executing'    // Currently being executed
  | 'completed'    // Finished
  | 'dismissed';   // Dismissed/archived

/**
 * Urgency levels for prioritization
 */
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low' | 'background';

/**
 * Unified Task - Output of cognitive synthesis
 *
 * The synthesis engine consolidates multiple related events into unified,
 * actionable tasks with clear context and proposed next steps.
 */
export interface UnifiedTask {
  /** Unique task identifier */
  id: string;

  /** Human-readable task title */
  title: string;

  /** Detailed task description with context from source events */
  description: string;

  /**
   * Confidence score (0-1) in this synthesis
   * Higher scores indicate stronger evidence from multiple correlated events
   */
  confidence: number;

  /**
   * Urgency level derived from events and patterns
   */
  urgency: UrgencyLevel;

  /**
   * Domain classification for agent routing
   */
  domain: Domain;

  /**
   * Source events that contributed to this task
   * Maintains full traceability to original data
   */
  sourceEvents: string[]; // Event IDs

  /**
   * Proactive action recommended by synthesis
   * Can be executed automatically or presented for approval
   */
  proposedAction?: ProactiveAction;

  /**
   * Current task status
   */
  status: UnifiedTaskStatus;

  /** When task was created */
  createdAt: string; // ISO 8601

  /** When task was last refined/updated by synthesis */
  lastRefinedAt?: string; // ISO 8601

  /**
   * Number of times this task has been refined
   * Tracks evolution as new events arrive
   */
  refinementCount: number;

  /**
   * Optional: Assigned agent for execution
   */
  assignedAgent?: AgentId;

  /**
   * Optional: Deadline inferred from events
   */
  deadline?: string; // ISO 8601

  /**
   * Optional: Related task IDs (dependencies, blockers)
   */
  relatedTasks?: string[];

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Proactive Action
// ============================================================================

/**
 * Types of proactive actions the synthesis engine can propose
 */
export type ProactiveActionType =
  | 'reply'         // Draft email/message reply
  | 'create_task'   // Create task in external system (Motion, Todoist)
  | 'schedule'      // Schedule calendar event
  | 'delegate'      // Assign to another agent or person
  | 'archive'       // Archive/dismiss as irrelevant
  | 'escalate'      // Flag for immediate human attention
  | 'research'      // Trigger research agent for more info
  | 'summarize';    // Generate summary document

/**
 * Proactive Action - Proposed automatic action
 *
 * The synthesis engine can recommend specific actions based on event patterns.
 * Actions can be executed automatically (if confidence is high) or presented
 * for approval (if confidence is moderate).
 */
export interface ProactiveAction {
  /** Action type */
  type: ProactiveActionType;

  /**
   * Target agent ID for execution
   * Different action types route to different agents
   */
  targetAgentId: AgentId;

  /**
   * Action-specific payload
   * Structure depends on action type
   */
  payload: Record<string, unknown>;

  /**
   * Confidence threshold required for auto-execution
   * If UnifiedTask.confidence < this, action requires approval
   */
  confidenceRequired: number;

  /**
   * Estimated impact/value of this action
   * Used for prioritization when multiple actions are proposed
   */
  estimatedImpact: 'high' | 'medium' | 'low';

  /**
   * Human-readable rationale for why this action was proposed
   */
  rationale: string;

  /**
   * Whether this action has been executed
   */
  executed: boolean;

  /** When action was executed (if applicable) */
  executedAt?: string; // ISO 8601

  /** Result of execution (if applicable) */
  executionResult?: {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
}

// ============================================================================
// Synthesis Pattern
// ============================================================================

/**
 * Types of patterns the synthesis engine learns
 */
export type SynthesisPatternType =
  | 'consolidation'  // Multiple events → single task
  | 'urgency'        // Urgency classification rules
  | 'action'         // Event → proactive action mapping
  | 'relationship'   // Event correlation patterns
  | 'sequence';      // Temporal event sequences

/**
 * Synthesis Pattern - Learned pattern for future synthesis
 *
 * Over time, the synthesis engine identifies recurring patterns in how events
 * should be combined, classified, and acted upon. These patterns improve
 * future synthesis quality and reduce hallucination.
 */
export interface SynthesisPattern {
  /** Unique pattern identifier */
  id: string;

  /** Pattern type */
  patternType: SynthesisPatternType;

  /** Human-readable pattern description */
  description: string;

  /**
   * Conditions that trigger this pattern
   * Can be event source combinations, keyword matches, temporal windows, etc.
   */
  triggerConditions: {
    sources?: EventSource[];
    keywords?: string[];
    temporalWindow?: number; // milliseconds
    minEventCount?: number;
    customCondition?: string; // Natural language description
  };

  /**
   * Suggested behavior when pattern matches
   */
  suggestedBehavior: {
    consolidateEvents?: boolean;
    urgencyOverride?: UrgencyLevel;
    domainOverride?: Domain;
    proposedActionType?: ProactiveActionType;
    customGuidance?: string; // Natural language guidance for LLM
  };

  /**
   * Success rate of this pattern (0-1)
   * Tracks how often pattern-based synthesis is confirmed by user
   */
  successRate: number;

  /**
   * Number of times this pattern has been used
   */
  usageCount: number;

  /** When pattern was learned */
  learnedAt: string; // ISO 8601

  /** When pattern was last used */
  lastUsedAt?: string; // ISO 8601

  /**
   * Optional: Example events that triggered this pattern
   */
  exampleEvents?: string[]; // Event IDs
}

// ============================================================================
// Synthesis Result (LLM Output)
// ============================================================================

/**
 * Task update from synthesis
 * Used when refining existing tasks with new event context
 */
export interface TaskUpdate {
  /** ID of task to update */
  taskId: string;

  /** Updated fields */
  updates: {
    description?: string;
    urgency?: UrgencyLevel;
    confidence?: number;
    proposedAction?: ProactiveAction;
    deadline?: string;
  };

  /** IDs of new events added to this task */
  newSourceEvents: string[];

  /** Rationale for update */
  rationale: string;
}

/**
 * SynthesisResult - Structured output from LLM synthesis pass
 *
 * The synthesis loop sends batches of events to an LLM and receives structured
 * output defining new tasks, task updates, proposed actions, and learned patterns.
 */
export interface SynthesisResult {
  /**
   * Summary of what was synthesized in this pass
   */
  synthesis_summary: string;

  /**
   * New unified tasks created from events
   */
  unified_tasks: Array<Omit<UnifiedTask, 'id' | 'createdAt' | 'status' | 'refinementCount'>>;

  /**
   * Updates to existing tasks based on new events
   */
  task_updates: TaskUpdate[];

  /**
   * Proactive actions proposed (not yet assigned to tasks)
   */
  proposed_actions: ProactiveAction[];

  /**
   * New patterns learned during this synthesis
   */
  new_patterns: Array<Omit<SynthesisPattern, 'id' | 'learnedAt' | 'successRate' | 'usageCount'>>;

  /**
   * Event IDs that were fully processed and can be archived
   */
  events_fully_processed: string[];

  /**
   * Event IDs that need more context (keep in buffer)
   */
  needs_more_context: string[];

  /**
   * Optional: Reasoning trace for debugging
   */
  reasoning?: string;
}

// ============================================================================
// Synthesis Loop Configuration
// ============================================================================

/**
 * Confidence thresholds for different synthesis behaviors
 */
export interface ConfidenceThresholds {
  /** Minimum confidence to auto-execute proactive actions (0.9+) */
  autoExecute: number;

  /** Minimum confidence to propose tasks/actions for review (0.6+) */
  propose: number;

  /** Minimum confidence to refine existing tasks (0.4+) */
  refine: number;
}

/**
 * SynthesisLoopConfig - Configuration for synthesis engine
 */
export interface SynthesisLoopConfig {
  /**
   * How often to run synthesis (milliseconds)
   * Default: 300000 (5 minutes)
   */
  intervalMs: number;

  /**
   * Minimum events in buffer before triggering synthesis
   * Default: 3
   */
  minEventsForSynthesis: number;

  /**
   * Maximum events to process in a single synthesis pass
   * Prevents context window overflow
   * Default: 50
   */
  maxEventsPerPass: number;

  /**
   * Confidence thresholds
   */
  confidenceThresholds: ConfidenceThresholds;

  /**
   * Whether synthesis loop is currently active
   */
  enabled: boolean;

  /**
   * LLM model to use for synthesis
   */
  llmModel?: string;

  /**
   * Maximum LLM tokens for synthesis
   */
  maxTokens?: number;

  /**
   * Temperature for LLM synthesis (0-1)
   */
  temperature?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for WorkingMemoryEvent
 */
export function isWorkingMemoryEvent(obj: unknown): obj is WorkingMemoryEvent {
  if (!obj || typeof obj !== 'object') return false;
  const event = obj as Partial<WorkingMemoryEvent>;

  return (
    typeof event.id === 'string' &&
    typeof event.source === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.content === 'string' &&
    typeof event.contentHash === 'string' &&
    typeof event.processedBySynthesis === 'boolean'
  );
}

/**
 * Type guard for UnifiedTask
 */
export function isUnifiedTask(obj: unknown): obj is UnifiedTask {
  if (!obj || typeof obj !== 'object') return false;
  const task = obj as Partial<UnifiedTask>;

  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.description === 'string' &&
    typeof task.confidence === 'number' &&
    typeof task.urgency === 'string' &&
    typeof task.domain === 'string' &&
    Array.isArray(task.sourceEvents) &&
    typeof task.status === 'string' &&
    typeof task.createdAt === 'string' &&
    typeof task.refinementCount === 'number'
  );
}

/**
 * Type guard for ProactiveAction
 */
export function isProactiveAction(obj: unknown): obj is ProactiveAction {
  if (!obj || typeof obj !== 'object') return false;
  const action = obj as Partial<ProactiveAction>;

  return (
    typeof action.type === 'string' &&
    typeof action.targetAgentId === 'string' &&
    typeof action.payload === 'object' &&
    typeof action.confidenceRequired === 'number' &&
    typeof action.estimatedImpact === 'string' &&
    typeof action.rationale === 'string' &&
    typeof action.executed === 'boolean'
  );
}

/**
 * Type guard for SynthesisPattern
 */
export function isSynthesisPattern(obj: unknown): obj is SynthesisPattern {
  if (!obj || typeof obj !== 'object') return false;
  const pattern = obj as Partial<SynthesisPattern>;

  return (
    typeof pattern.id === 'string' &&
    typeof pattern.patternType === 'string' &&
    typeof pattern.description === 'string' &&
    typeof pattern.triggerConditions === 'object' &&
    typeof pattern.suggestedBehavior === 'object' &&
    typeof pattern.successRate === 'number' &&
    typeof pattern.usageCount === 'number' &&
    typeof pattern.learnedAt === 'string'
  );
}

/**
 * Type guard for SynthesisResult
 */
export function isSynthesisResult(obj: unknown): obj is SynthesisResult {
  if (!obj || typeof obj !== 'object') return false;
  const result = obj as Partial<SynthesisResult>;

  return (
    typeof result.synthesis_summary === 'string' &&
    Array.isArray(result.unified_tasks) &&
    Array.isArray(result.task_updates) &&
    Array.isArray(result.proposed_actions) &&
    Array.isArray(result.new_patterns) &&
    Array.isArray(result.events_fully_processed) &&
    Array.isArray(result.needs_more_context)
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Partial update to UnifiedTask
 */
export type UnifiedTaskPartial = Partial<UnifiedTask> & { id: string };

/**
 * Event buffer query options
 */
export interface EventBufferQuery {
  /** Filter by source */
  source?: EventSource;

  /** Filter by processed status */
  processedOnly?: boolean;

  /** Filter by date range */
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Task query options
 */
export interface TaskQuery {
  /** Filter by status */
  status?: UnifiedTaskStatus | UnifiedTaskStatus[];

  /** Filter by domain */
  domain?: Domain | Domain[];

  /** Filter by urgency */
  urgency?: UrgencyLevel | UrgencyLevel[];

  /** Filter by assigned agent */
  assignedAgent?: AgentId;

  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Sort by field */
  sortBy?: 'createdAt' | 'urgency' | 'confidence' | 'deadline';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Limit number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Synthesis metrics
 */
export interface SynthesisMetrics {
  /** Total events processed */
  eventsProcessed: number;

  /** Total tasks created */
  tasksCreated: number;

  /** Total tasks refined */
  tasksRefined: number;

  /** Total actions proposed */
  actionsProposed: number;

  /** Total actions executed */
  actionsExecuted: number;

  /** Total patterns learned */
  patternsLearned: number;

  /** Average confidence score */
  averageConfidence: number;

  /** Synthesis passes completed */
  synthesisPassesCompleted: number;

  /** Last synthesis timestamp */
  lastSynthesisAt?: string; // ISO 8601

  /** Next synthesis scheduled */
  nextSynthesisAt?: string; // ISO 8601
}

// ============================================================================
// Exports
// ============================================================================

export type {
  // Core types already exported above via export interface
};

/**
 * Default configuration for synthesis loop
 */
export const DEFAULT_SYNTHESIS_CONFIG: SynthesisLoopConfig = {
  intervalMs: 300000, // 5 minutes
  minEventsForSynthesis: 3,
  maxEventsPerPass: 50,
  confidenceThresholds: {
    autoExecute: 0.9,
    propose: 0.6,
    refine: 0.4,
  },
  enabled: false, // Must be explicitly enabled
  llmModel: 'anthropic/claude-sonnet-4.5',
  maxTokens: 4000,
  temperature: 0.3, // Lower temperature for more consistent synthesis
};

/**
 * Helper: Create a new WorkingMemoryEvent
 */
export function createWorkingMemoryEvent(
  source: EventSource,
  content: string,
  metadata?: Record<string, unknown>
): Omit<WorkingMemoryEvent, 'id' | 'contentHash'> {
  return {
    source,
    timestamp: new Date().toISOString(),
    content,
    processedBySynthesis: false,
    metadata,
  };
}

/**
 * Helper: Create a new UnifiedTask (partial, before persisting)
 */
export function createUnifiedTask(
  title: string,
  description: string,
  domain: Domain,
  urgency: UrgencyLevel,
  sourceEvents: string[],
  confidence: number
): Omit<UnifiedTask, 'id' | 'createdAt' | 'status' | 'refinementCount'> {
  return {
    title,
    description,
    domain,
    urgency,
    sourceEvents,
    confidence,
  };
}

/**
 * Helper: Create a ProactiveAction
 */
export function createProactiveAction(
  type: ProactiveActionType,
  targetAgentId: AgentId,
  payload: Record<string, unknown>,
  rationale: string,
  estimatedImpact: 'high' | 'medium' | 'low' = 'medium',
  confidenceRequired: number = 0.7
): ProactiveAction {
  return {
    type,
    targetAgentId,
    payload,
    confidenceRequired,
    estimatedImpact,
    rationale,
    executed: false,
  };
}
