/**
 * Agent Subscription Configuration
 * Defines which agents listen to which event patterns
 */

import { getEventBus, DOMAINS, AgentEvent } from './life-os-event-bus';
import { invokeAgent, type AgentResponse } from './AgentInvoker';

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

    try {
      // Build user message from event data
      const userMessage = formatEventAsMessage(event);

      // Extract metadata from payload if available
      const payloadObj = event.payload as Record<string, unknown> | undefined;
      const eventMetadata = payloadObj?.metadata as Record<string, unknown> | undefined;
      const skipMemory = eventMetadata?.skipMemory === true;

      // Invoke the agent via AgentInvoker
      const response: AgentResponse = await invokeAgent({
        agentId,
        userMessage,
        context: {
          domainId: event.domain,
          metadata: {
            event_id: event.id,
            event_type: event.type,
            event_source: event.source,
            event_timestamp: event.timestamp,
            ...(eventMetadata || {}),
          },
          skipMemory,
        },
      });

      console.log(`[AgentSubscriptions] ${agentId} responded: escalation=${response.escalationLevel}, executed=${response.shouldExecute}`);

      // Handle escalation if needed
      if (!response.shouldExecute) {
        console.log(`[AgentSubscriptions] ${agentId} action blocked by escalation: ${response.escalationReason}`);
        // Could emit an escalation event here for tracking
      }
    } catch (error) {
      console.error(`[AgentSubscriptions] ${agentId} failed to process event:`, error);
      // Don't rethrow - we don't want one agent failure to block others
    }
  };
}

/**
 * Format an event as a user message for the agent
 */
function formatEventAsMessage(event: AgentEvent): string {
  const parts = [
    `Event Type: ${event.type}`,
    `Source: ${event.source}`,
    `Domain: ${event.domain || 'unknown'}`,
    `Priority: ${event.priority}`,
  ];

  if (event.payload) {
    const payloadObj = event.payload as Record<string, unknown>;
    if (typeof event.payload === 'string') {
      parts.push(`Content: ${event.payload}`);
    } else if (payloadObj && typeof payloadObj === 'object') {
      if ('message' in payloadObj && payloadObj.message) {
        parts.push(`Message: ${String(payloadObj.message)}`);
      } else if ('content' in payloadObj && payloadObj.content) {
        parts.push(`Content: ${String(payloadObj.content)}`);
      } else if ('task' in payloadObj && payloadObj.task) {
        parts.push(`Task: ${JSON.stringify(payloadObj.task)}`);
      } else {
        parts.push(`Data: ${JSON.stringify(event.payload)}`);
      }
    } else {
      parts.push(`Data: ${JSON.stringify(event.payload)}`);
    }
  }

  return parts.join('\n');
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
