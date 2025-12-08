/**
 * HYRO FORGE: Event Bus (Redis Pub/Sub)
 *
 * This module implements the event-driven architecture for real-time adaptive learning.
 * Events flow through Redis pub/sub channels, triggering state updates, path planning,
 * and metacognitive interventions.
 *
 * Architecture:
 * ```
 * Student Action → Redis Publish → Multiple Subscribers Process → State Update → WebSocket Push
 * ```
 *
 * Event Flow Example:
 * ```
 * answer.submitted →
 *   ├── ZPD subscriber (updates difficulty)
 *   ├── Profile subscriber (updates knowledge graph)
 *   ├── Metacog subscriber (checks if PMRE needed)
 *   └── State subscriber (computes ΔC/ΔE/ΔG)
 * → state.updated →
 *   └── WebSocket push to client
 * ```
 *
 * For local development, this uses an in-memory event emitter.
 * For production, connect to Redis (Upstash or Railway).
 */

import { ensureServerOnly } from '../server-only-guard';
import type {
  HyroEvent,
  RedisChannel,
  BaseEvent,
  AnswerSubmittedEvent,
  StateUpdatedEvent,
  PMRETriggeredEvent
} from './forge-event-schemas';
import {
  REDIS_CHANNELS,
  getChannelForEvent,
  generateEventId,
  validateEvent
} from './forge-event-schemas';
import type { LearnerState, TrajectoryEffect } from './forge-learner-state';
import {
  applyTrajectoryEffect,
  findNearestAttractor
} from './forge-learner-state';
import {
  computeAnswerUpdate,
  computeHintUpdate,
  computeMetacogUpdate,
  computeSessionUpdate,
  type AnswerContext
} from './forge-update-equations';

ensureServerOnly('lib/hyro/forge-event-bus');

// =============================================================================
// EVENT BUS TYPES
// =============================================================================

type EventHandler<T extends HyroEvent = HyroEvent> = (event: T) => void | Promise<void>;

interface Subscription {
  id: string;
  channel: RedisChannel | '*';
  handler: EventHandler;
  priority: number; // Lower = runs first
}

interface EventBusConfig {
  mode: 'memory' | 'redis';
  redisUrl?: string;
  enableLogging?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

// =============================================================================
// IN-MEMORY EVENT BUS (Development)
// =============================================================================

/**
 * In-memory event bus for local development
 * Mimics Redis pub/sub behavior without external dependencies
 */
class MemoryEventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private eventLog: HyroEvent[] = [];
  private config: EventBusConfig;
  private isProcessing = false;
  private eventQueue: HyroEvent[] = [];

  constructor(config: EventBusConfig) {
    this.config = config;
    // Initialize channel subscription lists
    for (const channel of Object.values(REDIS_CHANNELS)) {
      this.subscriptions.set(channel, []);
    }
    // Wildcard subscriptions
    this.subscriptions.set('*', []);
  }

  /**
   * Subscribe to a channel
   */
  subscribe<T extends HyroEvent>(
    channel: RedisChannel | '*',
    handler: EventHandler<T>,
    priority: number = 100
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const subscription: Subscription = {
      id,
      channel,
      handler: handler as EventHandler,
      priority
    };

    const existing = this.subscriptions.get(channel) || [];
    existing.push(subscription);
    // Sort by priority (lower first)
    existing.sort((a, b) => a.priority - b.priority);
    this.subscriptions.set(channel, existing);

    if (this.config.enableLogging) {
      console.log(`[EventBus] Subscribed to ${channel} with id ${id}`);
    }

    return id;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [channel, subs] of this.subscriptions.entries()) {
      const index = subs.findIndex(s => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        if (this.config.enableLogging) {
          console.log(`[EventBus] Unsubscribed ${subscriptionId} from ${channel}`);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Publish an event to a channel
   */
  async publish(event: HyroEvent): Promise<void> {
    const validation = validateEvent(event);
    if (!validation.valid) {
      console.error(`[EventBus] Invalid event:`, validation.errors);
      throw new Error(`Invalid event: ${validation.errors.join(', ')}`);
    }

    const channel = getChannelForEvent(event.event_type);
    if (!channel) {
      console.error(`[EventBus] No channel mapping for event type: ${event.event_type}`);
      throw new Error(`No channel for event type: ${event.event_type}`);
    }

    // Log the event
    this.eventLog.push(event);
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-5000); // Keep last 5000
    }

    if (this.config.enableLogging) {
      console.log(`[EventBus] Publishing to ${channel}:`, event.event_type);
    }

    // Queue the event for processing
    this.eventQueue.push(event);
    await this.processQueue();
  }

  /**
   * Process queued events
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.dispatchEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Dispatch event to all relevant subscribers
   */
  private async dispatchEvent(event: HyroEvent): Promise<void> {
    const channel = getChannelForEvent(event.event_type);
    if (!channel) return;

    // Get channel-specific and wildcard subscribers
    const channelSubs = this.subscriptions.get(channel) || [];
    const wildcardSubs = this.subscriptions.get('*') || [];
    const allSubs = [...channelSubs, ...wildcardSubs].sort((a, b) => a.priority - b.priority);

    for (const sub of allSubs) {
      try {
        await sub.handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${sub.id}:`, error);
        // Continue to other handlers even if one fails
      }
    }
  }

  /**
   * Get recent events for debugging
   */
  getRecentEvents(limit: number = 100): HyroEvent[] {
    return this.eventLog.slice(-limit);
  }

  /**
   * Get events for a specific learner
   */
  getEventsForLearner(learnerId: string, limit: number = 100): HyroEvent[] {
    return this.eventLog
      .filter(e => e.learner_id === learnerId)
      .slice(-limit);
  }

  /**
   * Clear all subscriptions (for testing)
   */
  clearSubscriptions(): void {
    for (const [channel] of this.subscriptions) {
      this.subscriptions.set(channel, []);
    }
  }
}

// =============================================================================
// SINGLETON EVENT BUS
// =============================================================================

let eventBus: MemoryEventBus | null = null;

/**
 * Get or create the event bus singleton
 */
export function getEventBus(config?: Partial<EventBusConfig>): MemoryEventBus {
  if (!eventBus) {
    eventBus = new MemoryEventBus({
      mode: 'memory',
      enableLogging: process.env.NODE_ENV === 'development',
      maxRetries: 3,
      retryDelayMs: 1000,
      ...config
    });

    // Register default subscribers
    registerDefaultSubscribers(eventBus);
  }
  return eventBus;
}

/**
 * Reset event bus (for testing)
 */
export function resetEventBus(): void {
  if (eventBus) {
    eventBus.clearSubscriptions();
    eventBus = null;
  }
}

// =============================================================================
// DEFAULT SUBSCRIBERS
// =============================================================================

/**
 * Register the core system subscribers
 */
function registerDefaultSubscribers(bus: MemoryEventBus): void {
  // State update subscriber (highest priority)
  bus.subscribe<AnswerSubmittedEvent>(
    REDIS_CHANNELS.ANSWER_SUBMITTED,
    handleAnswerSubmitted,
    10
  );

  // Logging subscriber (lowest priority)
  bus.subscribe(
    '*',
    handleAllEvents,
    1000
  );
}

/**
 * Handle answer submitted events - compute state updates
 */
async function handleAnswerSubmitted(event: AnswerSubmittedEvent): Promise<void> {
  // This would normally fetch current state from a store
  // For now, we'll emit a state update event with computed trajectory

  const answerContext: AnswerContext = {
    is_correct: event.is_correct,
    time_taken_ms: event.time_taken_ms,
    confidence: event.confidence,
    attempt_number: event.attempt_number,
    difficulty: event.difficulty,
    concept_id: event.concept_id,
    current_streak: 0, // Would come from state
    mastery_estimate: 0.5, // Would come from state
    error_patterns: event.error_patterns ? event.error_patterns.join(',') : undefined
  };

  // In a full implementation, this would:
  // 1. Fetch current learner state
  // 2. Compute trajectory effect
  // 3. Apply to state
  // 4. Publish state.updated event
  // 5. Check if PMRE should be triggered

  console.log(`[Subscriber] Processing answer for ${event.learner_id}:`, {
    correct: event.is_correct,
    concept: event.concept_id
  });
}

/**
 * Log all events for debugging
 */
function handleAllEvents(event: HyroEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[EventLog] ${event.event_type}`, {
      learner: event.learner_id,
      timestamp: event.timestamp
    });
  }
}

// =============================================================================
// EVENT PUBLISHING HELPERS
// =============================================================================

/**
 * Publish an answer submitted event
 */
export async function publishAnswerSubmitted(
  learnerId: string,
  data: Omit<AnswerSubmittedEvent, keyof BaseEvent | 'event_type'>
): Promise<void> {
  const bus = getEventBus();
  const event: AnswerSubmittedEvent = {
    event_id: generateEventId(),
    event_type: 'answer.submitted',
    learner_id: learnerId,
    timestamp: Date.now(),
    source: 'server',
    ...data
  };
  await bus.publish(event);
}

/**
 * Publish a state updated event
 */
export async function publishStateUpdated(
  learnerId: string,
  previousState: Pick<LearnerState, 'C' | 'E' | 'G'>,
  newState: Pick<LearnerState, 'C' | 'E' | 'G'>,
  trigger: StateUpdatedEvent['trigger'],
  effect: TrajectoryEffect
): Promise<void> {
  const bus = getEventBus();
  const event: StateUpdatedEvent = {
    event_id: generateEventId(),
    event_type: 'state.updated',
    learner_id: learnerId,
    timestamp: Date.now(),
    source: 'server',
    previous_state: previousState,
    new_state: newState,
    trigger,
    effect_applied: effect
  };
  await bus.publish(event);
}

/**
 * Publish a PMRE trigger event
 */
export async function publishPMRETrigger(
  learnerId: string,
  dimension: PMRETriggeredEvent['dimension'],
  reason: PMRETriggeredEvent['trigger_reason'],
  suggestedPrompt: string,
  priority: PMRETriggeredEvent['priority'] = 'medium'
): Promise<void> {
  const bus = getEventBus();
  const event: PMRETriggeredEvent = {
    event_id: generateEventId(),
    event_type: 'pmre.triggered',
    learner_id: learnerId,
    timestamp: Date.now(),
    source: 'server',
    dimension,
    trigger_reason: reason,
    suggested_prompt: suggestedPrompt,
    priority
  };
  await bus.publish(event);
}

// =============================================================================
// SUBSCRIPTION HELPERS
// =============================================================================

/**
 * Subscribe to state updates for a specific learner
 */
export function subscribeToLearnerState(
  learnerId: string,
  handler: (state: Pick<LearnerState, 'C' | 'E' | 'G'>) => void
): string {
  const bus = getEventBus();
  return bus.subscribe<StateUpdatedEvent>(
    REDIS_CHANNELS.STATE_UPDATED,
    (event) => {
      if (event.learner_id === learnerId) {
        handler(event.new_state);
      }
    },
    50
  );
}

/**
 * Subscribe to PMRE triggers for a specific learner
 */
export function subscribeToPMRETriggers(
  learnerId: string,
  handler: (event: PMRETriggeredEvent) => void
): string {
  const bus = getEventBus();
  return bus.subscribe<PMRETriggeredEvent>(
    REDIS_CHANNELS.PMRE_TRIGGERED,
    (event) => {
      if (event.learner_id === learnerId) {
        handler(event);
      }
    },
    50
  );
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Publish multiple events in sequence
 */
export async function publishBatch(events: HyroEvent[]): Promise<void> {
  const bus = getEventBus();
  for (const event of events) {
    await bus.publish(event);
  }
}

/**
 * Get event statistics
 */
export function getEventStats(): {
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEventsPerSecond: number;
} {
  const bus = getEventBus();
  const events = bus.getRecentEvents(1000);

  const eventsByType: Record<string, number> = {};
  for (const event of events) {
    eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
  }

  // Calculate events per second in last minute
  const oneMinuteAgo = Date.now() - 60000;
  const recentEvents = events.filter(e => e.timestamp > oneMinuteAgo);
  const recentEventsPerSecond = recentEvents.length / 60;

  return {
    totalEvents: events.length,
    eventsByType,
    recentEventsPerSecond
  };
}
