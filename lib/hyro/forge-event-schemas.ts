/**
 * HYRO FORGE: Event Schemas & Redis Channel Definitions
 *
 * This module defines the event-driven architecture for real-time adaptive learning.
 * Events flow through Redis pub/sub channels, triggering state updates, path planning,
 * and metacognitive interventions.
 *
 * Architecture:
 * - Events are published to Redis channels
 * - Subscribers process events and update learner state
 * - WebSocket connections push updates to clients
 *
 * Event Flow (from spec):
 * Student answers → answer.submitted event
 *   → ZPD subscriber updates difficulty
 *   → Profile subscriber updates knowledge graph
 *   → Metacognition subscriber flags reflection
 *   → Next question generated (adjusted)
 *   → Pushed to student via WebSocket
 */

import { ensureServerOnly } from '../server-only-guard';
import type { LearnerState, AttractorType, ObjectiveVector, TrajectoryEffect } from './forge-learner-state';

ensureServerOnly('lib/hyro/forge-event-schemas');

// =============================================================================
// REDIS CHANNEL NAMES
// =============================================================================

/**
 * Redis channel namespace for Hyro Forge events
 */
export const HYRO_CHANNEL_PREFIX = 'hyro:forge:';

/**
 * All Redis channel names used by the system
 */
export const REDIS_CHANNELS = {
  // Core learning events
  ANSWER_SUBMITTED: `${HYRO_CHANNEL_PREFIX}answer.submitted`,
  HINT_REQUESTED: `${HYRO_CHANNEL_PREFIX}hint.requested`,
  SESSION_STARTED: `${HYRO_CHANNEL_PREFIX}session.started`,
  SESSION_ENDED: `${HYRO_CHANNEL_PREFIX}session.ended`,
  METACOG_RESPONDED: `${HYRO_CHANNEL_PREFIX}metacog.prompt_responded`,

  // State update events
  STATE_UPDATED: `${HYRO_CHANNEL_PREFIX}state.updated`,
  ATTRACTOR_CHANGED: `${HYRO_CHANNEL_PREFIX}attractor.changed`,
  MASTERY_UPDATED: `${HYRO_CHANNEL_PREFIX}mastery.updated`,

  // Path planning events
  PATH_UPDATED: `${HYRO_CHANNEL_PREFIX}path.updated`,
  CONTENT_SELECTED: `${HYRO_CHANNEL_PREFIX}content.selected`,

  // Metacognition events
  PMRE_TRIGGERED: `${HYRO_CHANNEL_PREFIX}pmre.triggered`,
  CALIBRATION_RECORDED: `${HYRO_CHANNEL_PREFIX}calibration.recorded`,

  // Knowledge graph events
  CONCEPT_LINKED: `${HYRO_CHANNEL_PREFIX}graph.concept_linked`,
  MISCONCEPTION_DETECTED: `${HYRO_CHANNEL_PREFIX}graph.misconception_detected`,
  PREREQUISITE_GAP: `${HYRO_CHANNEL_PREFIX}graph.prerequisite_gap`,

  // HGM (Huxley-Gödel Machine) events
  EXPERIMENT_STARTED: `${HYRO_CHANNEL_PREFIX}hgm.experiment_started`,
  EXPERIMENT_CONCLUDED: `${HYRO_CHANNEL_PREFIX}hgm.experiment_concluded`,
  PARAMETER_CHANGED: `${HYRO_CHANNEL_PREFIX}hgm.parameter_changed`,

  // Admin/debug events
  SYSTEM_ALERT: `${HYRO_CHANNEL_PREFIX}system.alert`,
  DEBUG_LOG: `${HYRO_CHANNEL_PREFIX}debug.log`
} as const;

export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];

// =============================================================================
// BASE EVENT TYPES
// =============================================================================

/**
 * Base event structure - all events extend this
 */
export interface BaseEvent {
  /** Unique event ID */
  event_id: string;

  /** Event type (matches channel name suffix) */
  event_type: string;

  /** Learner this event is associated with */
  learner_id: string;

  /** Session ID if applicable */
  session_id?: string;

  /** Unix timestamp (milliseconds) */
  timestamp: number;

  /** Event source (client, server, hgm, etc.) */
  source: 'client' | 'server' | 'hgm' | 'scheduler';

  /** Optional correlation ID for tracing event chains */
  correlation_id?: string;
}

// =============================================================================
// LEARNING EVENTS
// =============================================================================

/**
 * Emitted when a student submits an answer
 */
export interface AnswerSubmittedEvent extends BaseEvent {
  event_type: 'answer.submitted';

  /** The question/problem ID */
  question_id: string;

  /** Concept being assessed */
  concept_id: string;

  /** The student's answer */
  answer: string;

  /** Whether the answer was correct */
  is_correct: boolean;

  /** Time taken in milliseconds */
  time_taken_ms: number;

  /** Confidence rating if provided (0-100) */
  confidence?: number;

  /** Attempt number for this question */
  attempt_number: number;

  /** Difficulty level of the question */
  difficulty: number;

  /** Any error patterns detected */
  error_patterns?: string[];
}

/**
 * Emitted when a student requests a hint
 */
export interface HintRequestedEvent extends BaseEvent {
  event_type: 'hint.requested';

  /** The question/problem ID */
  question_id: string;

  /** Concept being worked on */
  concept_id: string;

  /** Which hint number (1st, 2nd, etc.) */
  hint_number: number;

  /** Time since question started (ms) */
  time_elapsed_ms: number;
}

/**
 * Emitted when a learning session starts
 */
export interface SessionStartedEvent extends BaseEvent {
  event_type: 'session.started';

  /** Session configuration */
  config: {
    domain: string;
    target_concepts?: string[];
    duration_minutes?: number;
    mode: 'practice' | 'assessment' | 'exploration';
  };

  /** Initial learner state snapshot */
  initial_state: Pick<LearnerState, 'C' | 'E' | 'G'>;
}

/**
 * Emitted when a learning session ends
 */
export interface SessionEndedEvent extends BaseEvent {
  event_type: 'session.ended';

  /** Session summary */
  summary: {
    duration_minutes: number;
    questions_attempted: number;
    questions_correct: number;
    hints_used: number;
    concepts_practiced: string[];
    xp_earned: number;
  };

  /** Final learner state snapshot */
  final_state: Pick<LearnerState, 'C' | 'E' | 'G'>;

  /** State change during session */
  state_delta: {
    delta_C: number;
    delta_E: number;
    delta_G: number;
  };
}

/**
 * Emitted when student responds to a metacognitive prompt
 */
export interface MetacogRespondedEvent extends BaseEvent {
  event_type: 'metacog.prompt_responded';

  /** PMRE dimension that was prompted */
  pmre_dimension: 'planning' | 'monitoring' | 'regulation' | 'evaluation';

  /** The prompt that was shown */
  prompt_id: string;

  /** Student's response */
  response: string;

  /** Quality score of the response (0-100) */
  quality_score?: number;

  /** Time to respond (ms) */
  response_time_ms: number;
}

// =============================================================================
// STATE UPDATE EVENTS
// =============================================================================

/**
 * Emitted when learner state is updated
 */
export interface StateUpdatedEvent extends BaseEvent {
  event_type: 'state.updated';

  /** Previous state (C/E/G only for efficiency) */
  previous_state: Pick<LearnerState, 'C' | 'E' | 'G'>;

  /** New state (C/E/G only) */
  new_state: Pick<LearnerState, 'C' | 'E' | 'G'>;

  /** What triggered this update */
  trigger: 'answer' | 'hint' | 'time' | 'metacog' | 'manual';

  /** The trajectory effect that was applied */
  effect_applied: TrajectoryEffect;
}

/**
 * Emitted when learner moves to a new attractor basin
 */
export interface AttractorChangedEvent extends BaseEvent {
  event_type: 'attractor.changed';

  /** Previous attractor */
  previous_attractor: AttractorType;

  /** New attractor */
  new_attractor: AttractorType;

  /** Distance to new attractor centroid */
  distance_to_centroid: number;

  /** Whether learner is fully in the basin */
  in_basin: boolean;

  /** Recommended intervention (if any) */
  recommended_intervention?: string;
}

/**
 * Emitted when mastery estimates are updated
 */
export interface MasteryUpdatedEvent extends BaseEvent {
  event_type: 'mastery.updated';

  /** Concept that was updated */
  concept_id: string;

  /** Previous mastery estimate */
  previous_mastery: number;

  /** New mastery estimate */
  new_mastery: number;

  /** Confidence in this estimate */
  confidence: number;

  /** Evidence that led to this update */
  evidence: {
    correct_count: number;
    total_count: number;
    recency_weight: number;
  };
}

// =============================================================================
// PATH PLANNING EVENTS
// =============================================================================

/**
 * Emitted when learning path is updated
 */
export interface PathUpdatedEvent extends BaseEvent {
  event_type: 'path.updated';

  /** Current concept */
  current_concept: string;

  /** Next recommended concepts (ordered) */
  next_concepts: string[];

  /** Why this path was chosen */
  rationale: string;

  /** Objective scores for this path */
  objectives: ObjectiveVector;
}

/**
 * Emitted when content is selected for the learner
 */
export interface ContentSelectedEvent extends BaseEvent {
  event_type: 'content.selected';

  /** Selected content ID */
  content_id: string;

  /** Content type */
  content_type: 'question' | 'explanation' | 'example' | 'activity';

  /** Target concept */
  concept_id: string;

  /** Difficulty level */
  difficulty: number;

  /** Expected trajectory effect */
  expected_effect: TrajectoryEffect;

  /** Selection rationale */
  rationale: string;
}

// =============================================================================
// METACOGNITION EVENTS
// =============================================================================

/**
 * Emitted when a PMRE prompt should be triggered
 */
export interface PMRETriggeredEvent extends BaseEvent {
  event_type: 'pmre.triggered';

  /** Which PMRE dimension to prompt */
  dimension: 'planning' | 'monitoring' | 'regulation' | 'evaluation';

  /** Why this dimension was triggered */
  trigger_reason:
    | 'session_start'
    | 'long_hesitation'
    | 'multiple_errors'
    | 'answer_submitted'
    | 'session_end'
    | 'calibration_poor'
    | 'attractor_shift';

  /** Suggested prompt to use */
  suggested_prompt: string;

  /** Priority (for queuing) */
  priority: 'low' | 'medium' | 'high';

  /** Learner's current calibration data */
  calibration_context?: {
    accuracy: number;
    overconfidence: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

/**
 * Emitted when calibration data is recorded
 */
export interface CalibrationRecordedEvent extends BaseEvent {
  event_type: 'calibration.recorded';

  /** Confidence before answer */
  confidence: number;

  /** Actual correctness */
  was_correct: boolean;

  /** Calibration error (confidence - actual) */
  calibration_error: number;

  /** Running calibration accuracy */
  running_accuracy: number;
}

// =============================================================================
// KNOWLEDGE GRAPH EVENTS
// =============================================================================

/**
 * Emitted when a concept link is created/updated in the graph
 */
export interface ConceptLinkedEvent extends BaseEvent {
  event_type: 'graph.concept_linked';

  /** Source concept */
  source_concept: string;

  /** Target concept */
  target_concept: string;

  /** Relationship type */
  relationship: 'prerequisite_of' | 'followup_to' | 'related_to' | 'misconception_of';

  /** Link strength (0-1) */
  strength: number;

  /** Whether this is a new link or update */
  is_new: boolean;
}

/**
 * Emitted when a misconception is detected
 */
export interface MisconceptionDetectedEvent extends BaseEvent {
  event_type: 'graph.misconception_detected';

  /** Concept the misconception is about */
  concept_id: string;

  /** Misconception ID (if known pattern) */
  misconception_id?: string;

  /** Error pattern observed */
  error_pattern: string;

  /** Number of times this pattern has occurred */
  occurrence_count: number;

  /** Suggested remediation */
  remediation_hint?: string;
}

/**
 * Emitted when a prerequisite gap is identified
 */
export interface PrerequisiteGapEvent extends BaseEvent {
  event_type: 'graph.prerequisite_gap';

  /** Concept learner is struggling with */
  target_concept: string;

  /** Missing prerequisite concepts */
  missing_prerequisites: string[];

  /** Confidence in this diagnosis */
  confidence: number;

  /** Suggested remediation path */
  suggested_path: string[];
}

// =============================================================================
// HGM (SELF-IMPROVEMENT) EVENTS
// =============================================================================

/**
 * Emitted when HGM starts an experiment
 */
export interface ExperimentStartedEvent extends BaseEvent {
  event_type: 'hgm.experiment_started';

  /** Experiment ID */
  experiment_id: string;

  /** What parameter is being tested */
  parameter: string;

  /** Control value */
  control_value: any;

  /** Treatment value */
  treatment_value: any;

  /** Expected duration */
  expected_duration_days: number;

  /** Minimum sample size */
  min_sample_size: number;
}

/**
 * Emitted when HGM concludes an experiment
 */
export interface ExperimentConcludedEvent extends BaseEvent {
  event_type: 'hgm.experiment_concluded';

  /** Experiment ID */
  experiment_id: string;

  /** Statistical results */
  results: {
    p_value: number;
    cohens_d: number;
    control_mean: number;
    treatment_mean: number;
    sample_size: number;
  };

  /** Decision made */
  decision: 'adopt' | 'reject' | 'inconclusive';

  /** Whether it was auto-applied */
  auto_applied: boolean;

  /** Requires human review? */
  requires_review: boolean;
}

/**
 * Emitted when HGM changes a parameter
 */
export interface ParameterChangedEvent extends BaseEvent {
  event_type: 'hgm.parameter_changed';

  /** Parameter that was changed */
  parameter: string;

  /** Previous value */
  previous_value: any;

  /** New value */
  new_value: any;

  /** Change percentage */
  change_percent: number;

  /** Experiment ID that justified this change */
  experiment_id?: string;

  /** Whether this was autonomous or human-approved */
  approval_type: 'autonomous' | 'human_approved';
}

// =============================================================================
// SYSTEM EVENTS
// =============================================================================

/**
 * System alert event
 */
export interface SystemAlertEvent extends BaseEvent {
  event_type: 'system.alert';

  /** Alert severity */
  severity: 'info' | 'warning' | 'error' | 'critical';

  /** Alert message */
  message: string;

  /** Additional context */
  context?: Record<string, any>;
}

// =============================================================================
// EVENT TYPE UNION
// =============================================================================

/**
 * Union of all event types
 */
export type HyroEvent =
  | AnswerSubmittedEvent
  | HintRequestedEvent
  | SessionStartedEvent
  | SessionEndedEvent
  | MetacogRespondedEvent
  | StateUpdatedEvent
  | AttractorChangedEvent
  | MasteryUpdatedEvent
  | PathUpdatedEvent
  | ContentSelectedEvent
  | PMRETriggeredEvent
  | CalibrationRecordedEvent
  | ConceptLinkedEvent
  | MisconceptionDetectedEvent
  | PrerequisiteGapEvent
  | ExperimentStartedEvent
  | ExperimentConcludedEvent
  | ParameterChangedEvent
  | SystemAlertEvent;

// =============================================================================
// EVENT FACTORY HELPERS
// =============================================================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `evt_${timestamp}_${random}`;
}

/**
 * Create base event properties
 */
export function createBaseEvent(
  eventType: string,
  learnerId: string,
  source: BaseEvent['source'] = 'server',
  sessionId?: string
): BaseEvent {
  return {
    event_id: generateEventId(),
    event_type: eventType,
    learner_id: learnerId,
    session_id: sessionId,
    timestamp: Date.now(),
    source
  };
}

/**
 * Get the Redis channel for an event type
 */
export function getChannelForEvent(eventType: string): RedisChannel | null {
  const channelMap: Record<string, RedisChannel> = {
    'answer.submitted': REDIS_CHANNELS.ANSWER_SUBMITTED,
    'hint.requested': REDIS_CHANNELS.HINT_REQUESTED,
    'session.started': REDIS_CHANNELS.SESSION_STARTED,
    'session.ended': REDIS_CHANNELS.SESSION_ENDED,
    'metacog.prompt_responded': REDIS_CHANNELS.METACOG_RESPONDED,
    'state.updated': REDIS_CHANNELS.STATE_UPDATED,
    'attractor.changed': REDIS_CHANNELS.ATTRACTOR_CHANGED,
    'mastery.updated': REDIS_CHANNELS.MASTERY_UPDATED,
    'path.updated': REDIS_CHANNELS.PATH_UPDATED,
    'content.selected': REDIS_CHANNELS.CONTENT_SELECTED,
    'pmre.triggered': REDIS_CHANNELS.PMRE_TRIGGERED,
    'calibration.recorded': REDIS_CHANNELS.CALIBRATION_RECORDED,
    'graph.concept_linked': REDIS_CHANNELS.CONCEPT_LINKED,
    'graph.misconception_detected': REDIS_CHANNELS.MISCONCEPTION_DETECTED,
    'graph.prerequisite_gap': REDIS_CHANNELS.PREREQUISITE_GAP,
    'hgm.experiment_started': REDIS_CHANNELS.EXPERIMENT_STARTED,
    'hgm.experiment_concluded': REDIS_CHANNELS.EXPERIMENT_CONCLUDED,
    'hgm.parameter_changed': REDIS_CHANNELS.PARAMETER_CHANGED,
    'system.alert': REDIS_CHANNELS.SYSTEM_ALERT
  };

  return channelMap[eventType] || null;
}

/**
 * Validate an event has required fields
 */
export function validateEvent(event: HyroEvent): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.event_id) errors.push('Missing event_id');
  if (!event.event_type) errors.push('Missing event_type');
  if (!event.learner_id) errors.push('Missing learner_id');
  if (!event.timestamp) errors.push('Missing timestamp');
  if (!event.source) errors.push('Missing source');

  return {
    valid: errors.length === 0,
    errors
  };
}
