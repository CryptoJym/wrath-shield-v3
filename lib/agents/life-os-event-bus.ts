/**
 * LifeOS Event Bus
 * Pub/Sub message bus for multi-agent communication
 * Extends the Hyro Forge event bus pattern
 *
 * Architecture:
 * - In-memory event bus for agent-to-agent communication
 * - Pattern-based subscriptions (wildcards supported)
 * - Priority-based handler execution
 * - Event logging and monitoring
 * - Domain-based routing
 *
 * Usage:
 * ```typescript
 * const bus = getEventBus();
 *
 * // Subscribe to events
 * bus.subscribe('domain.family.*', async (event) => {
 *   console.log('Family event:', event);
 * }, 100, 'family-agent');
 *
 * // Publish event
 * await bus.publish({
 *   id: generateEventId(),
 *   type: 'message',
 *   source: 'inbox-agent',
 *   domain: 'family',
 *   priority: 'normal',
 *   payload: { text: 'New family message' },
 *   timestamp: new Date()
 * });
 * ```
 */

import { EventEmitter } from 'events';

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface AgentEvent {
  id: string;
  type: 'message' | 'task' | 'notification' | 'escalation';
  source: string;  // agent ID that emitted
  domain?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  payload: unknown;
  timestamp: Date;
  correlationId?: string;  // for tracking related events
}

export interface EventSubscription {
  pattern: string;  // e.g., 'domain.family.*', 'agent.ea', 'escalation.*'
  handler: (event: AgentEvent) => Promise<void> | void;
  priority: number;  // higher = processed first
  agentId: string;
}

// =============================================================================
// EVENT BUS IMPLEMENTATION
// =============================================================================

export class LifeOSEventBus extends EventEmitter {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventLog: AgentEvent[] = [];
  private maxLogSize = 1000;
  private isProcessing = false;
  private eventQueue: AgentEvent[] = [];

  /**
   * Subscribe to events matching a pattern
   * Supports wildcards: 'domain.*', 'agent.ea.*', '*'
   */
  subscribe(
    pattern: string,
    handler: (event: AgentEvent) => Promise<void> | void,
    priority: number = 100,
    agentId: string
  ): () => void {
    const subscription: EventSubscription = { pattern, handler, priority, agentId };

    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);
    }

    const subs = this.subscriptions.get(pattern)!;
    subs.push(subscription);
    // Sort by priority (higher first)
    subs.sort((a, b) => b.priority - a.priority);

    console.log(`[LifeOS EventBus] ${agentId} subscribed to "${pattern}" (priority: ${priority})`);

    // Return unsubscribe function
    return () => {
      const idx = subs.indexOf(subscription);
      if (idx > -1) {
        subs.splice(idx, 1);
        console.log(`[LifeOS EventBus] ${agentId} unsubscribed from "${pattern}"`);
      }
    };
  }

  /**
   * Publish an event to all matching subscribers
   */
  async publish(event: AgentEvent): Promise<void> {
    // Validate event
    if (!event.id || !event.type || !event.source || !event.priority) {
      console.error('[LifeOS EventBus] Invalid event:', event);
      throw new Error('Invalid event: missing required fields (id, type, source, priority)');
    }

    // Add to log
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
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
   * Dispatch event to all matching subscribers
   */
  private async dispatchEvent(event: AgentEvent): Promise<void> {
    // Find all matching subscriptions
    const matchingHandlers: { handler: EventSubscription['handler']; priority: number; agentId: string }[] = [];

    this.subscriptions.forEach((subs, pattern) => {
      if (this.matchesPattern(event, pattern)) {
        for (const sub of subs) {
          matchingHandlers.push({
            handler: sub.handler,
            priority: sub.priority,
            agentId: sub.agentId
          });
        }
      }
    });

    // Sort by priority (higher first)
    matchingHandlers.sort((a, b) => b.priority - a.priority);

    console.log(`[LifeOS EventBus] Publishing event ${event.id} to ${matchingHandlers.length} handlers`);

    // Execute handlers
    const errors: Error[] = [];
    for (const { handler, agentId } of matchingHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[LifeOS EventBus] Handler error for ${agentId}:`, error);
        errors.push(error as Error);
        // Don't break - continue to other handlers
      }
    }

    // Emit for external listeners
    this.emit('event', event);
    if (errors.length > 0) {
      this.emit('error', { event, errors });
    }
  }

  /**
   * Publish to a specific domain
   */
  publishToDomain(domain: string, event: Omit<AgentEvent, 'domain'>): Promise<void> {
    return this.publish({ ...event, domain });
  }

  /**
   * Publish directly to an agent
   */
  publishToAgent(agentId: string, event: AgentEvent): Promise<void> {
    // Agent-specific events use pattern 'agent.<agentId>'
    return this.publish(event);
  }

  /**
   * Publish an escalation event
   */
  publishEscalation(
    level: 'critical' | 'propose' | 'auto_execute',
    event: Omit<AgentEvent, 'type' | 'priority'>
  ): Promise<void> {
    const priority = level === 'critical' ? 'critical' : level === 'propose' ? 'high' : 'normal';
    return this.publish({
      ...event,
      type: 'escalation',
      priority
    });
  }

  /**
   * Check if event matches subscription pattern
   */
  private matchesPattern(event: AgentEvent, pattern: string): boolean {
    // Wildcard matches all
    if (pattern === '*') return true;

    // Direct agent match: 'agent.<agentId>'
    if (pattern.startsWith('agent.')) {
      const targetAgent = pattern.replace('agent.', '');
      if (targetAgent.endsWith('.*')) {
        const prefix = targetAgent.slice(0, -2);
        return event.source.startsWith(prefix);
      }
      return event.source === targetAgent;
    }

    // Domain match: 'domain.<domain>' or 'domain.<domain>.*'
    if (pattern.startsWith('domain.')) {
      const domainPattern = pattern.replace('domain.', '');
      if (domainPattern.endsWith('.*')) {
        const prefix = domainPattern.slice(0, -2);
        return event.domain?.startsWith(prefix) ?? false;
      }
      return event.domain === domainPattern;
    }

    // Type match: 'type.<type>'
    if (pattern.startsWith('type.')) {
      return event.type === pattern.replace('type.', '');
    }

    // Escalation match: 'escalation.*'
    if (pattern === 'escalation.*') {
      return event.type === 'escalation';
    }

    // Priority match: 'priority.<priority>'
    if (pattern.startsWith('priority.')) {
      return event.priority === pattern.replace('priority.', '');
    }

    return false;
  }

  /**
   * Get recent events (for debugging/monitoring)
   */
  getRecentEvents(count: number = 50): AgentEvent[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Get events for a specific agent
   */
  getEventsForAgent(agentId: string, count: number = 50): AgentEvent[] {
    return this.eventLog
      .filter(e => e.source === agentId)
      .slice(-count);
  }

  /**
   * Get events for a specific domain
   */
  getEventsForDomain(domain: string, count: number = 50): AgentEvent[] {
    return this.eventLog
      .filter(e => e.domain === domain)
      .slice(-count);
  }

  /**
   * Get subscription stats
   */
  getStats(): { patterns: number; totalSubscriptions: number; recentEvents: number } {
    let totalSubscriptions = 0;
    this.subscriptions.forEach((subs) => {
      totalSubscriptions += subs.length;
    });
    return {
      patterns: this.subscriptions.size,
      totalSubscriptions,
      recentEvents: this.eventLog.length
    };
  }

  /**
   * Clear all subscriptions (for testing)
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  /**
   * Clear event log (for testing)
   */
  clearEventLog(): void {
    this.eventLog = [];
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let eventBusInstance: LifeOSEventBus | null = null;

export function getEventBus(): LifeOSEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new LifeOSEventBus();
    console.log('[LifeOS EventBus] Event bus initialized');
  }
  return eventBusInstance;
}

/**
 * Reset event bus (for testing)
 */
export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.clearSubscriptions();
    eventBusInstance.clearEventLog();
    eventBusInstance = null;
  }
}

// =============================================================================
// DOMAIN CONSTANTS
// =============================================================================

export const DOMAINS = {
  FAMILY: 'family',
  WORK: 'work',
  HEALTH: 'health',
  FINANCE: 'finance',
  LEARNING: 'learning',
  LEGAL: 'legal',
} as const;

export type Domain = typeof DOMAINS[keyof typeof DOMAINS];

// =============================================================================
// EVENT HELPERS
// =============================================================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create a message event
 */
export function createMessageEvent(
  source: string,
  payload: unknown,
  domain?: Domain,
  priority: AgentEvent['priority'] = 'normal',
  correlationId?: string
): AgentEvent {
  return {
    id: generateEventId(),
    type: 'message',
    source,
    domain,
    priority,
    payload,
    timestamp: new Date(),
    correlationId
  };
}

/**
 * Create a task event
 */
export function createTaskEvent(
  source: string,
  payload: unknown,
  domain?: Domain,
  priority: AgentEvent['priority'] = 'normal',
  correlationId?: string
): AgentEvent {
  return {
    id: generateEventId(),
    type: 'task',
    source,
    domain,
    priority,
    payload,
    timestamp: new Date(),
    correlationId
  };
}

/**
 * Create a notification event
 */
export function createNotificationEvent(
  source: string,
  payload: unknown,
  domain?: Domain,
  priority: AgentEvent['priority'] = 'normal',
  correlationId?: string
): AgentEvent {
  return {
    id: generateEventId(),
    type: 'notification',
    source,
    domain,
    priority,
    payload,
    timestamp: new Date(),
    correlationId
  };
}

/**
 * Create an escalation event
 */
export function createEscalationEvent(
  source: string,
  payload: unknown,
  priority: 'critical' | 'high' | 'normal',
  domain?: Domain,
  correlationId?: string
): AgentEvent {
  return {
    id: generateEventId(),
    type: 'escalation',
    source,
    domain,
    priority,
    payload,
    timestamp: new Date(),
    correlationId
  };
}
