/**
 * Orchestrator Gateway API
 *
 * Central API that exposes all Life OS capabilities to the Grok Orchestrator.
 * This is the bridge between the Python Grok service and the Next.js system.
 *
 * ENDPOINTS:
 * POST Operations (gatewayOperation):
 * - invoke: Invoke any agent via AgentInvoker
 * - memory: CRUD operations on memory graphs
 * - bus: Legacy agent bus operations
 * - unified: Unified Bus operations (NEW - full org access)
 * - coordinate: Multi-agent coordination
 *
 * GET Operations (?operation=):
 * - pulse: System status
 * - config: Configuration access
 * - states: All agent states (NEW)
 * - overview: Full system overview (NEW)
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentInvoker, type AgentInvocation, type AgentResponse } from '@/lib/agents/AgentInvoker';
import {
  searchAgentMemory,
  searchOrgMemory,
  searchAllMemory,
  addAgentMemory,
  proposeOrgMemory,
  getPendingOrgProposals,
  getAllOrgProposals,
  approveOrgProposal,
  rejectOrgProposal,
  getProposalCounts,
  type AgentId,
  type ZepSearchResult,
  type OrgCouncilProposal,
} from '@/lib/memory/zep';
import { getAllAgentsStatus } from '@/lib/agents/registry';
import {
  getLifeCharter,
  getDomains,
  getAgents,
  getMappings,
  getAgent,
  getDomain,
  type LifeCharter,
  type Domain,
  type AgentDefinition,
  type MappingsConfig,
} from '@/lib/life-os-config';
import {
  getUnifiedBus,
  type LifeOSAgentId,
  type DirectInvokeRequest,
  type BroadcastMessage,
} from '@/lib/agents/UnifiedBus';

// =============================================================================
// Types
// =============================================================================

// Invoke types
interface InvokeRequest {
  agentId: string;
  message: string;
  context?: {
    domainId?: string;
    metadata?: Record<string, any>;
  };
  forceExecute?: boolean;
  awaitResponse?: boolean;
}

interface InvokeResponse {
  success: boolean;
  agentId: string;
  content: string;
  escalationLevel: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
  wasExecuted: boolean;
  model: string;
  latencyMs: number;
  detectedDomain?: string;
  error?: string;
}

// Memory types
interface MemoryRequest {
  operation: 'search' | 'add' | 'propose' | 'approve' | 'reject' | 'list-proposals';
  graphType: 'agent' | 'org-council' | 'all';
  agentId?: string;
  query?: string;
  text?: string;
  metadata?: Record<string, any>;
  proposalId?: string;
  reviewedBy?: string;
  limit?: number;
}

interface MemoryResponse {
  success: boolean;
  operation: string;
  results?: ZepSearchResult[];
  proposalId?: string;
  proposals?: OrgCouncilProposal[];
  counts?: Record<string, number>;
  error?: string;
}

// Bus types
interface BusMessage {
  to: string | string[] | 'broadcast';
  category: 'task' | 'alert' | 'request' | 'response' | 'decision' | 'escalation';
  subject: string;
  body: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  context?: Record<string, any>;
}

interface BusRequest {
  operation: 'send' | 'query' | 'dispatch' | 'acknowledge';
  message?: BusMessage;
  query?: {
    agentId?: string;
    unreadOnly?: boolean;
    category?: string;
    limit?: number;
  };
  messageId?: string;
}

// Pulse types
interface AgentPulse {
  id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  lastActivity?: string;
  pendingItems: number;
  recentEscalations: number;
}

interface PulseResponse {
  timestamp: string;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  agents: AgentPulse[];
  bus: {
    unreadMessages: number;
    criticalPending: number;
    proposePending: number;
  };
  memory: {
    pendingProposals: number;
    proposalCounts: Record<string, number>;
  };
  config: {
    version: number;
    lastUpdated: string;
  };
}

// Config types
interface ConfigRequest {
  scope: 'life_charter' | 'domains' | 'agents' | 'mappings' | 'all';
  agentId?: string;
  domainId?: string;
}

// Unified Bus types (NEW - Full Org Access)
interface UnifiedBusRequest {
  operation:
    | 'read_agent_memory'
    | 'write_agent_memory'
    | 'search_all_memories'
    | 'read_org_memory'
    | 'write_org_memory'
    | 'invoke_agent'
    | 'broadcast'
    | 'route_message'
    | 'get_agent_state'
    | 'get_all_states'
    | 'get_overview';
  agentId?: string;
  query?: string;
  text?: string;
  message?: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  context?: Record<string, any>;
  targetAgents?: string[];
  limit?: number;
}

interface ConfigResponse {
  success: boolean;
  lifeCharter?: LifeCharter;
  domains?: Domain[];
  agents?: AgentDefinition[];
  mappings?: MappingsConfig;
  agent?: AgentDefinition | null;
  domain?: Domain | null;
  error?: string;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json();

    // Route based on operation type in body
    const operation = body.gatewayOperation;

    switch (operation) {
      case 'invoke':
        return handleInvoke(body as InvokeRequest);
      case 'memory':
        return handleMemory(body as MemoryRequest);
      case 'bus':
        return handleBus(body as BusRequest);
      case 'unified':
        return handleUnifiedBus(body as UnifiedBusRequest);
      default:
        return NextResponse.json(
          { error: `Unknown gateway operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Gateway] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');

    switch (operation) {
      case 'pulse':
        return handlePulse(url.searchParams);
      case 'config':
        return handleConfig(url.searchParams);
      case 'states':
        return handleAgentStates();
      case 'overview':
        return handleSystemOverview();
      default:
        return NextResponse.json(
          { error: `Unknown gateway operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Gateway] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Handler Functions
// =============================================================================

/**
 * Handle agent invocation requests
 */
async function handleInvoke(req: InvokeRequest): Promise<NextResponse> {
  const { agentId, message, context, forceExecute, awaitResponse = true } = req;

  if (!agentId || !message) {
    return NextResponse.json(
      { success: false, error: 'agentId and message are required' },
      { status: 400 }
    );
  }

  try {
    const invocation: AgentInvocation = {
      agentId,
      userMessage: message,
      context: {
        domainId: context?.domainId,
        metadata: context?.metadata,
      },
      forceExecute,
    };

    const response: AgentResponse = await agentInvoker.invoke(invocation);

    const result: InvokeResponse = {
      success: true,
      agentId: response.agentId,
      content: response.content,
      escalationLevel: response.escalationLevel,
      wasExecuted: response.shouldExecute,
      model: response.model,
      latencyMs: response.latencyMs,
      detectedDomain: response.detectedDomain,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(`[Gateway] Invoke error for ${agentId}:`, error);
    return NextResponse.json(
      {
        success: false,
        agentId,
        content: '',
        escalationLevel: 'CRITICAL',
        wasExecuted: false,
        model: 'unknown',
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle memory operations
 */
async function handleMemory(req: MemoryRequest): Promise<NextResponse> {
  const { operation, graphType, agentId, query, text, metadata, proposalId, reviewedBy, limit = 5 } = req;

  try {
    let result: MemoryResponse;

    switch (operation) {
      case 'search': {
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'query is required for search' },
            { status: 400 }
          );
        }

        let results: ZepSearchResult[] = [];

        if (graphType === 'agent') {
          if (!agentId) {
            return NextResponse.json(
              { success: false, error: 'agentId is required for agent graph search' },
              { status: 400 }
            );
          }
          results = await searchAgentMemory(agentId as AgentId, query, limit);
        } else if (graphType === 'org-council') {
          results = await searchOrgMemory(query, limit);
        } else if (graphType === 'all') {
          if (!agentId) {
            // Default to orchestrator if no agent specified
            const allResults = await searchAllMemory('orchestrator-agent', query, limit);
            results = [...allResults.agent, ...allResults.org];
          } else {
            const allResults = await searchAllMemory(agentId as AgentId, query, limit);
            results = [...allResults.agent, ...allResults.org];
          }
        }

        result = { success: true, operation: 'search', results };
        break;
      }

      case 'add': {
        if (!text) {
          return NextResponse.json(
            { success: false, error: 'text is required for add' },
            { status: 400 }
          );
        }

        if (graphType !== 'agent' || !agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required for direct add (use propose for org-council)' },
            { status: 400 }
          );
        }

        await addAgentMemory(agentId as AgentId, text, metadata);
        result = { success: true, operation: 'add' };
        break;
      }

      case 'propose': {
        if (!text) {
          return NextResponse.json(
            { success: false, error: 'text is required for propose' },
            { status: 400 }
          );
        }

        const proposedBy = (agentId || 'orchestrator-agent') as AgentId;
        const proposal = await proposeOrgMemory(proposedBy, text, metadata);
        result = { success: true, operation: 'propose', proposalId: proposal.id };
        break;
      }

      case 'approve': {
        if (!proposalId) {
          return NextResponse.json(
            { success: false, error: 'proposalId is required for approve' },
            { status: 400 }
          );
        }

        const approved = await approveOrgProposal(proposalId, reviewedBy || 'orchestrator');
        result = { success: approved, operation: 'approve' };
        break;
      }

      case 'reject': {
        if (!proposalId) {
          return NextResponse.json(
            { success: false, error: 'proposalId is required for reject' },
            { status: 400 }
          );
        }

        const rejected = rejectOrgProposal(proposalId, reviewedBy || 'orchestrator');
        result = { success: rejected, operation: 'reject' };
        break;
      }

      case 'list-proposals': {
        const proposals = getAllOrgProposals(undefined, limit);
        const counts = getProposalCounts();
        result = { success: true, operation: 'list-proposals', proposals, counts };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown memory operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`[Gateway] Memory error (${operation}):`, error);
    return NextResponse.json(
      {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle agent bus operations
 */
async function handleBus(req: BusRequest): Promise<NextResponse> {
  const { operation, message, query, messageId } = req;

  try {
    // Lazy import to avoid circular dependencies
    const agentBusModule = await import('@/lib/agent_bus');

    switch (operation) {
      case 'send': {
        if (!message) {
          return NextResponse.json(
            { success: false, error: 'message is required for send' },
            { status: 400 }
          );
        }

        // Convert to agent bus format
        const busMessage = {
          to: message.to,
          category: message.category,
          subject: message.subject,
          body: message.body,
          confidence: message.confidence,
          impact: message.impact,
          context: message.context,
          timestamp: Date.now(),
        };

        // Use agent bus emit
        if (typeof agentBusModule.emitEvent === 'function') {
          await agentBusModule.emitEvent('orchestrator', message.category, busMessage);
        }

        return NextResponse.json({ success: true, operation: 'send', messageId: `msg_${Date.now()}` });
      }

      case 'query': {
        // Get messages from bus (implementation depends on agent_bus structure)
        const messages: any[] = [];
        return NextResponse.json({ success: true, operation: 'query', messages });
      }

      case 'dispatch': {
        if (!messageId) {
          return NextResponse.json(
            { success: false, error: 'messageId is required for dispatch' },
            { status: 400 }
          );
        }
        // Dispatch logic
        return NextResponse.json({ success: true, operation: 'dispatch' });
      }

      case 'acknowledge': {
        if (!messageId) {
          return NextResponse.json(
            { success: false, error: 'messageId is required for acknowledge' },
            { status: 400 }
          );
        }
        // Acknowledge logic
        return NextResponse.json({ success: true, operation: 'acknowledge' });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown bus operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`[Gateway] Bus error (${operation}):`, error);
    return NextResponse.json(
      {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle system pulse requests
 */
async function handlePulse(params: URLSearchParams): Promise<NextResponse> {
  const includeActivity = params.get('includeActivity') !== 'false';
  const includePending = params.get('includePending') !== 'false';

  try {
    // Get all agent statuses
    const agentStatuses = await getAllAgentsStatus();

    // Get pending escalations from invoker
    const pendingEscalations = agentInvoker.getPendingEscalations();
    const criticalCount = pendingEscalations.filter(e => e.escalationLevel === 'CRITICAL').length;
    const proposeCount = pendingEscalations.filter(e => e.escalationLevel === 'PROPOSE').length;

    // Get memory proposal counts
    const proposalCounts = getProposalCounts();

    // Get config info
    const charter = getLifeCharter();

    // Calculate system health
    const redAgents = agentStatuses.filter(a => a.status === 'red').length;
    const systemHealth: 'healthy' | 'degraded' | 'critical' =
      criticalCount > 0 || redAgents > 2
        ? 'critical'
        : proposeCount > 5 || redAgents > 0
        ? 'degraded'
        : 'healthy';

    const pulse: PulseResponse = {
      timestamp: new Date().toISOString(),
      systemHealth,
      agents: agentStatuses.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        lastActivity: a.last_sync,
        pendingItems: a.open_items,
        recentEscalations: pendingEscalations.filter(e => e.agentId.includes(a.id)).length,
      })),
      bus: {
        unreadMessages: 0, // TODO: Get from agent bus
        criticalPending: criticalCount,
        proposePending: proposeCount,
      },
      memory: {
        pendingProposals: proposalCounts.pending,
        proposalCounts,
      },
      config: {
        version: charter.version,
        lastUpdated: charter.lastUpdated,
      },
    };

    return NextResponse.json(pulse);
  } catch (error) {
    console.error('[Gateway] Pulse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Handle configuration requests
 */
async function handleConfig(params: URLSearchParams): Promise<NextResponse> {
  const scope = params.get('scope') || 'all';
  const agentId = params.get('agentId');
  const domainId = params.get('domainId');

  try {
    const response: ConfigResponse = { success: true };

    if (scope === 'life_charter' || scope === 'all') {
      response.lifeCharter = getLifeCharter();
    }

    if (scope === 'domains' || scope === 'all') {
      response.domains = getDomains().domains;
    }

    if (scope === 'agents' || scope === 'all') {
      response.agents = getAgents().agents;
    }

    if (scope === 'mappings' || scope === 'all') {
      response.mappings = getMappings();
    }

    // Get specific agent if requested
    if (agentId) {
      response.agent = getAgent(agentId);
    }

    // Get specific domain if requested
    if (domainId) {
      response.domain = getDomain(domainId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Gateway] Config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// Unified Bus Handlers (NEW - Full Org Access)
// =============================================================================

/**
 * Handle Unified Bus operations - provides Conductor with full org access
 */
async function handleUnifiedBus(req: UnifiedBusRequest): Promise<NextResponse> {
  const bus = getUnifiedBus();
  const { operation, agentId, query, text, message, metadata, priority, context, targetAgents, limit } = req;

  try {
    switch (operation) {
      // Memory operations
      case 'read_agent_memory': {
        if (!agentId || !query) {
          return NextResponse.json(
            { success: false, error: 'agentId and query are required' },
            { status: 400 }
          );
        }
        const memories = await bus.readAgentMemory(agentId as LifeOSAgentId, query, limit || 5);
        return NextResponse.json({ success: true, operation, agentId, memories });
      }

      case 'write_agent_memory': {
        if (!agentId || !text) {
          return NextResponse.json(
            { success: false, error: 'agentId and text are required' },
            { status: 400 }
          );
        }
        const written = await bus.writeAgentMemory(agentId as LifeOSAgentId, text, metadata);
        return NextResponse.json({ success: written, operation, agentId });
      }

      case 'search_all_memories': {
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'query is required' },
            { status: 400 }
          );
        }
        const allMemories = await bus.searchAllAgentMemories(query, limit || 3);
        return NextResponse.json({ success: true, operation, memories: allMemories });
      }

      case 'read_org_memory': {
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'query is required' },
            { status: 400 }
          );
        }
        const orgMemories = await bus.readOrgMemory(query, limit || 5);
        return NextResponse.json({ success: true, operation, memories: orgMemories });
      }

      case 'write_org_memory': {
        if (!text) {
          return NextResponse.json(
            { success: false, error: 'text is required' },
            { status: 400 }
          );
        }
        const orgWritten = await bus.writeOrgMemory(text, metadata);
        return NextResponse.json({ success: orgWritten, operation });
      }

      // Agent invocation operations
      case 'invoke_agent': {
        if (!agentId || !message) {
          return NextResponse.json(
            { success: false, error: 'agentId and message are required' },
            { status: 400 }
          );
        }
        const invokeReq: DirectInvokeRequest = {
          agentId: agentId as LifeOSAgentId,
          message,
          context,
          priority: priority || 'normal',
        };
        const response = await bus.invokeAgent(invokeReq);
        return NextResponse.json({ success: response.success, operation, ...response });
      }

      case 'broadcast': {
        if (!message) {
          return NextResponse.json(
            { success: false, error: 'message is required' },
            { status: 400 }
          );
        }
        const broadcastReq: BroadcastMessage = {
          message,
          priority: priority || 'normal',
          targetAgents: targetAgents as LifeOSAgentId[],
          context,
        };
        const broadcastResponse = await bus.broadcast(broadcastReq);
        return NextResponse.json({ success: broadcastResponse.success, operation, ...broadcastResponse });
      }

      case 'route_message': {
        if (!message) {
          return NextResponse.json(
            { success: false, error: 'message is required' },
            { status: 400 }
          );
        }
        const routeResult = await bus.routeMessage(message, context);
        if (routeResult) {
          return NextResponse.json({ success: true, operation, ...routeResult });
        }
        return NextResponse.json({ success: false, operation, error: 'No suitable agent found' });
      }

      // State operations
      case 'get_agent_state': {
        if (!agentId) {
          return NextResponse.json(
            { success: false, error: 'agentId is required' },
            { status: 400 }
          );
        }
        const state = bus.getAgentState(agentId as LifeOSAgentId);
        return NextResponse.json({ success: !!state, operation, state });
      }

      case 'get_all_states': {
        const states = bus.getAllAgentStates();
        return NextResponse.json({ success: true, operation, states });
      }

      case 'get_overview': {
        const overview = await bus.getSystemOverview();
        return NextResponse.json({ success: true, operation, overview });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown unified bus operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`[Gateway] Unified bus error (${operation}):`, error);
    return NextResponse.json(
      {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get all agent states (GET endpoint)
 */
async function handleAgentStates(): Promise<NextResponse> {
  try {
    const bus = getUnifiedBus();
    const states = bus.getAllAgentStates();
    return NextResponse.json({ success: true, states });
  } catch (error) {
    console.error('[Gateway] Agent states error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Get full system overview (GET endpoint)
 */
async function handleSystemOverview(): Promise<NextResponse> {
  try {
    const bus = getUnifiedBus();
    const overview = await bus.getSystemOverview();
    return NextResponse.json({ success: true, overview });
  } catch (error) {
    console.error('[Gateway] System overview error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
