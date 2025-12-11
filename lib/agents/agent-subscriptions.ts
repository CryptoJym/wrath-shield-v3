/**
 * Agent Subscription Configuration
 * Defines which agents listen to which event patterns
 */

import { getEventBus, DOMAINS, AgentEvent } from './life-os-event-bus';

interface AgentSubscriptionConfig {
  agentId: string;
  patterns: {
    pattern: string;
    priority: number;
  }[];
}

// Default subscription configuration
export const AGENT_SUBSCRIPTIONS: AgentSubscriptionConfig[] = [
  // Orchestrator - sees everything
  {
    agentId: 'agent.orchestrator',
    patterns: [
      { pattern: '*', priority: 100 },
      { pattern: 'escalation.*', priority: 100 },
    ]
  },

  // EA Agent - calendar/scheduling
  {
    agentId: 'agent.ea',
    patterns: [
      { pattern: 'domain.family.*', priority: 50 },
      { pattern: 'domain.work.*', priority: 50 },
      { pattern: 'type.task', priority: 40 },
    ]
  },

  // Comms Agent - message classification
  {
    agentId: 'agent.comms',
    patterns: [
      { pattern: 'type.message', priority: 60 },
      { pattern: 'domain.family.*', priority: 30 },
      { pattern: 'domain.work.*', priority: 30 },
    ]
  },

  // Finance Agent
  {
    agentId: 'agent.finance',
    patterns: [
      { pattern: 'domain.finance.*', priority: 80 },
      { pattern: 'type.task', priority: 20 },
    ]
  },

  // Legal Agent
  {
    agentId: 'agent.legal',
    patterns: [
      { pattern: 'domain.legal.*', priority: 90 },
      { pattern: 'escalation.*', priority: 70 },
    ]
  },

  // PM Agent - project management
  {
    agentId: 'agent.pm',
    patterns: [
      { pattern: 'domain.work.*', priority: 60 },
      { pattern: 'type.task', priority: 50 },
    ]
  },

  // Hyro Education Agent
  {
    agentId: 'agent.hyro.education',
    patterns: [
      { pattern: 'domain.family.hyro.*', priority: 90 },
      { pattern: 'domain.learning.*', priority: 40 },
    ]
  },

  // James Learning Agent
  {
    agentId: 'agent.james.learning',
    patterns: [
      { pattern: 'domain.learning.*', priority: 70 },
      { pattern: 'domain.work.research.*', priority: 50 },
    ]
  },

  // Health Agent
  {
    agentId: 'agent.health',
    patterns: [
      { pattern: 'domain.health.*', priority: 80 },
      { pattern: 'domain.family.health.*', priority: 60 },
    ]
  },

  // Relationships Agent
  {
    agentId: 'agent.relationships',
    patterns: [
      { pattern: 'domain.family.*', priority: 40 },
      { pattern: 'type.message', priority: 30 },
    ]
  },
];

/**
 * Initialize all agent subscriptions
 * Call this during app startup
 */
export function initializeAgentSubscriptions(): void {
  const eventBus = getEventBus();

  for (const config of AGENT_SUBSCRIPTIONS) {
    for (const { pattern, priority } of config.patterns) {
      eventBus.subscribe(
        pattern,
        createAgentHandler(config.agentId),
        priority,
        config.agentId
      );
    }
  }

  console.log(`[AgentSubscriptions] Initialized ${AGENT_SUBSCRIPTIONS.length} agents with subscriptions`);
}

/**
 * Create a handler function for an agent
 * This will route the event to the appropriate agent invoker
 */
function createAgentHandler(agentId: string) {
  return async (event: AgentEvent): Promise<void> => {
    console.log(`[AgentSubscriptions] ${agentId} received event: ${event.type} from ${event.source}`);

    // TODO: Integrate with AgentInvoker
    // For now, just log - actual invocation will be added in Phase 4
    // const invoker = getAgentInvoker();
    // await invoker.invoke(agentId, event);
  };
}

/**
 * Get subscription stats for monitoring
 */
export function getSubscriptionStats(): {
  totalAgents: number;
  totalPatterns: number;
  agentDetails: { agentId: string; patternCount: number }[];
} {
  return {
    totalAgents: AGENT_SUBSCRIPTIONS.length,
    totalPatterns: AGENT_SUBSCRIPTIONS.reduce((sum, a) => sum + a.patterns.length, 0),
    agentDetails: AGENT_SUBSCRIPTIONS.map(a => ({
      agentId: a.agentId,
      patternCount: a.patterns.length
    }))
  };
}
