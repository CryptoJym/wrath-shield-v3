/**
 * Pattern Recognition Module
 * Detects recurring patterns in agent activities and user behaviors
 */

import { getEventBus, AgentEvent } from '@/lib/agents/life-os-event-bus';

export interface RecurringPattern {
  id: string;
  type: 'task' | 'preference' | 'schedule' | 'escalation' | 'routing';
  description: string;
  agentId?: string;
  domain?: string;
  frequency: number;  // occurrences per period
  confidence: number;  // 0-1
  firstSeen: Date;
  lastSeen: Date;
  examples: string[];
  metadata?: Record<string, unknown>;
}

export interface PatternMatch {
  patternId: string;
  matchScore: number;  // 0-1
  suggestedAction?: string;
  precedents?: string[];
}

class PatternRecognizer {
  private patterns: Map<string, RecurringPattern> = new Map();
  private eventHistory: AgentEvent[] = [];
  private maxHistory = 5000;

  constructor() {
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    const eventBus = getEventBus();

    // Listen to all events for pattern detection
    eventBus.subscribe(
      '*',
      this.recordEvent.bind(this),
      1,  // Low priority - observe only
      'pattern-recognizer'
    );
  }

  private async recordEvent(event: AgentEvent): Promise<void> {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory);
    }

    // Periodically analyze patterns (every 100 events)
    if (this.eventHistory.length % 100 === 0) {
      await this.analyzePatterns();
    }
  }

  /**
   * Analyze event history for patterns
   */
  async analyzePatterns(): Promise<void> {
    // Group events by type and domain
    const groupedEvents = new Map<string, AgentEvent[]>();

    for (const event of this.eventHistory) {
      const key = `${event.type}:${event.domain || 'none'}:${event.source}`;
      if (!groupedEvents.has(key)) {
        groupedEvents.set(key, []);
      }
      groupedEvents.get(key)!.push(event);
    }

    // Detect recurring patterns (3+ occurrences)
    for (const [key, events] of groupedEvents) {
      if (events.length >= 3) {
        const [type, domain, source] = key.split(':');

        // Calculate frequency (events per week)
        const timeSpan = events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime();
        const weeksSpan = Math.max(timeSpan / (7 * 24 * 60 * 60 * 1000), 1);
        const frequency = events.length / weeksSpan;

        const patternId = `pattern_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const pattern: RecurringPattern = {
          id: patternId,
          type: type as RecurringPattern['type'],
          description: `Recurring ${type} events from ${source} in ${domain} domain`,
          agentId: source,
          domain: domain !== 'none' ? domain : undefined,
          frequency,
          confidence: Math.min(events.length / 10, 1),  // More events = higher confidence
          firstSeen: events[0].timestamp,
          lastSeen: events[events.length - 1].timestamp,
          examples: events.slice(-3).map(e => JSON.stringify(e.payload).slice(0, 100))
        };

        this.patterns.set(patternId, pattern);
      }
    }

    console.log(`[PatternRecognizer] Detected ${this.patterns.size} patterns`);
  }

  /**
   * Find patterns matching a new event
   */
  findMatchingPatterns(event: AgentEvent): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns.values()) {
      let matchScore = 0;

      // Check type match
      if (pattern.type === event.type) matchScore += 0.3;

      // Check domain match
      if (pattern.domain && pattern.domain === event.domain) matchScore += 0.3;

      // Check agent match
      if (pattern.agentId && pattern.agentId === event.source) matchScore += 0.2;

      // Boost for high-confidence patterns
      matchScore *= (0.5 + pattern.confidence * 0.5);

      if (matchScore >= 0.4) {
        matches.push({
          patternId: pattern.id,
          matchScore,
          suggestedAction: this.suggestAction(pattern, event),
          precedents: pattern.examples
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  private suggestAction(pattern: RecurringPattern, event: AgentEvent): string {
    if (pattern.frequency > 5) {
      return `This is a frequent pattern (${pattern.frequency.toFixed(1)}/week). Consider automation.`;
    }
    if (pattern.confidence > 0.8) {
      return `High-confidence pattern. Reference precedents for handling.`;
    }
    return `Pattern detected. Review previous examples.`;
  }

  /**
   * Get all detected patterns
   */
  getAllPatterns(): RecurringPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns for a specific agent
   */
  getAgentPatterns(agentId: string): RecurringPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.agentId === agentId);
  }

  /**
   * Get patterns for a specific domain
   */
  getDomainPatterns(domain: string): RecurringPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.domain === domain);
  }
}

// Singleton
let recognizerInstance: PatternRecognizer | null = null;

export function getPatternRecognizer(): PatternRecognizer {
  if (!recognizerInstance) {
    recognizerInstance = new PatternRecognizer();
  }
  return recognizerInstance;
}
