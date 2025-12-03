/**
 * Unified Bus - Full Org Access for Conductor
 *
 * This module provides Conductor with complete access to:
 * 1. All agent memories (read/write any agent's Zep graph)
 * 2. Real-time agent status tracking
 * 3. Direct agent addressing (@agent syntax)
 * 4. Cross-agent coordination
 * 5. Org-council memory management
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                        CONDUCTOR                                 │
 * │                    (God Mode Access)                            │
 * └───────────────────────────┬─────────────────────────────────────┘
 *                             │
 *                             ▼
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                      UNIFIED BUS                                 │
 * │                                                                  │
 * │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
 * │  │   MEMORY    │ │   STATUS    │ │   INVOKE    │ │  CONFIG   │ │
 * │  │   ACCESS    │ │  TRACKER    │ │   ROUTER    │ │  MANAGER  │ │
 * │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
 * └───────────────────────────┬─────────────────────────────────────┘
 *                             │
 *         ┌───────────────────┼───────────────────┐
 *         │                   │                   │
 *         ▼                   ▼                   ▼
 *    ┌─────────┐        ┌─────────┐        ┌─────────┐
 *    │   ZEP   │        │ AGENTS  │        │ CONFIG  │
 *    │ MEMORY  │        │ (LLMs)  │        │  FILES  │
 *    └─────────┘        └─────────┘        └─────────┘
 */

import { ensureServerOnly } from '../server-only-guard';
import type { AgentId as ZepAgentId } from '../memory/zep';

ensureServerOnly('lib/agents/UnifiedBus');

// =============================================================================
// Types
// =============================================================================

export type LifeOSAgentId =
  | 'agent.orchestrator'
  | 'agent.legal'
  | 'agent.finance'
  | 'agent.pm'
  | 'agent.comms'
  | 'agent.health'
  | 'agent.coaching'
  | 'agent.hyro'
  | 'agent.grok'
  | 'agent.family'
  | 'agent.utlyze'
  | 'agent.vuplicity'
  | 'agent.ea'
  | 'agent.relationships'
  | 'agent.eeg';

export interface AgentState {
  agentId: LifeOSAgentId;
  name: string;
  status: 'online' | 'busy' | 'idle' | 'offline' | 'error';
  lastActivity: string;
  currentTask?: string;
  queueDepth: number;
  memoryCount: number;
  model: string;
  provider: 'openai' | 'xai';
  capabilities: string[];
}

export interface MemoryEntry {
  id: string;
  text: string;
  metadata?: Record<string, any>;
  createdAt: string;
  score?: number;
}

export interface CrossAgentMemoryQuery {
  agentId: LifeOSAgentId;
  query: string;
  limit?: number;
}

export interface CrossAgentMemoryWrite {
  agentId: LifeOSAgentId;
  text: string;
  metadata?: Record<string, any>;
}

export interface DirectInvokeRequest {
  agentId: LifeOSAgentId;
  message: string;
  context?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  awaitResponse?: boolean;
}

export interface DirectInvokeResponse {
  success: boolean;
  agentId: LifeOSAgentId;
  response: string;
  escalationLevel: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
  wasExecuted: boolean;
  latencyMs: number;
  model: string;
}

export interface BroadcastMessage {
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  targetAgents?: LifeOSAgentId[];
  context?: Record<string, any>;
}

export interface BroadcastResponse {
  success: boolean;
  responses: DirectInvokeResponse[];
  totalAgents: number;
  successCount: number;
  failCount: number;
}

// =============================================================================
// Agent ID Mappings
// =============================================================================

const LIFE_OS_TO_ZEP: Record<LifeOSAgentId, ZepAgentId> = {
  'agent.orchestrator': 'orchestrator-agent',
  'agent.legal': 'legal-agent',
  'agent.finance': 'finance-agent',
  'agent.pm': 'pm-agent',
  'agent.comms': 'comms-agent',
  'agent.health': 'health-agent',
  'agent.coaching': 'coaching-agent',
  'agent.hyro': 'hyro-agent',
  'agent.grok': 'grok-agent',
  'agent.family': 'orchestrator-agent', // Uses orchestrator graph
  'agent.utlyze': 'orchestrator-agent', // Uses orchestrator graph
  'agent.vuplicity': 'legal-agent', // Uses legal graph (FCRA)
  'agent.ea': 'ea-agent',
  'agent.relationships': 'relationships-agent',
  'agent.eeg': 'eeg-agent',
};

const AGENT_NAMES: Record<LifeOSAgentId, string> = {
  'agent.orchestrator': 'Conductor',
  'agent.legal': 'Legal Advocate',
  'agent.finance': 'Finance Analyst',
  'agent.pm': 'Project Maestro',
  'agent.comms': 'Comms Scout',
  'agent.health': 'Health Monitor',
  'agent.coaching': 'Life Coach',
  'agent.hyro': 'Hyro Education',
  'agent.grok': 'Research Agent',
  'agent.family': 'Family Steward',
  'agent.utlyze': 'Utlyze Org Agent',
  'agent.vuplicity': 'Vuplicity Compliance',
  'agent.ea': 'Executive Assistant',
  'agent.relationships': 'Relationship Manager',
  'agent.eeg': 'Bio-Data Analyst',
};

// Agent shorthand aliases for @mention syntax
const AGENT_ALIASES: Record<string, LifeOSAgentId> = {
  // Full names
  'conductor': 'agent.orchestrator',
  'orchestrator': 'agent.orchestrator',
  'legal': 'agent.legal',
  'finance': 'agent.finance',
  'pm': 'agent.pm',
  'comms': 'agent.comms',
  'health': 'agent.health',
  'coaching': 'agent.coaching',
  'coach': 'agent.coaching',
  'hyro': 'agent.hyro',
  'education': 'agent.hyro',
  'grok': 'agent.grok',
  'research': 'agent.grok',
  'family': 'agent.family',
  'utlyze': 'agent.utlyze',
  'vuplicity': 'agent.vuplicity',
  'fcra': 'agent.vuplicity',
  'ea': 'agent.ea',
  'assistant': 'agent.ea',
  'relationships': 'agent.relationships',
  'contacts': 'agent.relationships',
  'eeg': 'agent.eeg',
  'bio': 'agent.eeg',
};

// =============================================================================
// Unified Bus Class
// =============================================================================

class UnifiedBusImpl {
  private agentStates: Map<LifeOSAgentId, AgentState> = new Map();
  private activityLog: Array<{ agentId: LifeOSAgentId; action: string; timestamp: number }> = [];
  private maxActivityLog = 500;

  constructor() {
    this.initializeAgentStates();
  }

  /**
   * Initialize agent states from config
   */
  private initializeAgentStates(): void {
    const { getAgents } = require('../life-os-config');
    const { AGENT_PROVIDER_MAP } = require('./types');

    try {
      const agentsConfig = getAgents();
      for (const agent of agentsConfig.agents) {
        const agentId = agent.id as LifeOSAgentId;
        const providerConfig = AGENT_PROVIDER_MAP[agentId] || AGENT_PROVIDER_MAP.default;

        this.agentStates.set(agentId, {
          agentId,
          name: agent.name,
          status: 'idle',
          lastActivity: new Date().toISOString(),
          queueDepth: 0,
          memoryCount: 0,
          model: providerConfig.model,
          provider: providerConfig.provider,
          capabilities: agent.tools || [],
        });
      }
    } catch (error) {
      console.warn('[UnifiedBus] Failed to load agent config, using defaults:', error);
    }
  }

  /**
   * Resolve agent alias to full agent ID
   */
  resolveAgentId(aliasOrId: string): LifeOSAgentId | null {
    const normalized = aliasOrId.toLowerCase().replace(/^@/, '').replace(/^agent\./, '');

    // Check aliases first
    if (AGENT_ALIASES[normalized]) {
      return AGENT_ALIASES[normalized];
    }

    // Check if it's already a full ID
    const fullId = `agent.${normalized}` as LifeOSAgentId;
    if (LIFE_OS_TO_ZEP[fullId]) {
      return fullId;
    }

    return null;
  }

  /**
   * Parse @mentions from a message
   */
  parseAgentMentions(message: string): LifeOSAgentId[] {
    const mentionPattern = /@(\w+)/g;
    const mentions: LifeOSAgentId[] = [];
    let match;

    while ((match = mentionPattern.exec(message)) !== null) {
      const agentId = this.resolveAgentId(match[1]);
      if (agentId && !mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }

    return mentions;
  }

  /**
   * Get all agent states
   */
  getAllAgentStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }

  /**
   * Get single agent state
   */
  getAgentState(agentId: LifeOSAgentId): AgentState | null {
    return this.agentStates.get(agentId) || null;
  }

  /**
   * Update agent state
   */
  updateAgentState(agentId: LifeOSAgentId, update: Partial<AgentState>): void {
    const current = this.agentStates.get(agentId);
    if (current) {
      this.agentStates.set(agentId, {
        ...current,
        ...update,
        lastActivity: new Date().toISOString(),
      });
    }
  }

  /**
   * Log agent activity
   */
  logActivity(agentId: LifeOSAgentId, action: string): void {
    this.activityLog.unshift({ agentId, action, timestamp: Date.now() });
    if (this.activityLog.length > this.maxActivityLog) {
      this.activityLog.pop();
    }
  }

  /**
   * Get recent activity
   */
  getRecentActivity(limit = 50): typeof this.activityLog {
    return this.activityLog.slice(0, limit);
  }

  // ===========================================================================
  // Memory Access (Cross-Agent)
  // ===========================================================================

  /**
   * Read any agent's memory
   */
  async readAgentMemory(agentId: LifeOSAgentId, query: string, limit = 5): Promise<MemoryEntry[]> {
    const zepAgentId = LIFE_OS_TO_ZEP[agentId];
    if (!zepAgentId) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    try {
      const { searchAgentMemory } = await import('../memory/zep');
      const results = await searchAgentMemory(zepAgentId, query, limit);

      this.logActivity(agentId, `memory_read: "${query.substring(0, 50)}..."`);

      return results.map((r) => ({
        id: r.memory.id,
        text: r.memory.text,
        metadata: r.memory.metadata,
        createdAt: r.memory.createdAt || new Date().toISOString(),
        score: r.score,
      }));
    } catch (error) {
      console.error(`[UnifiedBus] Failed to read memory for ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Write to any agent's memory
   */
  async writeAgentMemory(agentId: LifeOSAgentId, text: string, metadata?: Record<string, any>): Promise<boolean> {
    const zepAgentId = LIFE_OS_TO_ZEP[agentId];
    if (!zepAgentId) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    try {
      const { addAgentMemory } = await import('../memory/zep');
      await addAgentMemory(zepAgentId, text, {
        ...metadata,
        written_by: 'conductor',
        written_at: new Date().toISOString(),
      });

      this.logActivity(agentId, `memory_write: "${text.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      console.error(`[UnifiedBus] Failed to write memory for ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Search all agent memories at once
   */
  async searchAllAgentMemories(query: string, limit = 3): Promise<Record<LifeOSAgentId, MemoryEntry[]>> {
    const results: Record<string, MemoryEntry[]> = {};
    const agentIds = Object.keys(LIFE_OS_TO_ZEP) as LifeOSAgentId[];

    // Search in parallel
    const searches = agentIds.map(async (agentId) => {
      try {
        const memories = await this.readAgentMemory(agentId, query, limit);
        return { agentId, memories };
      } catch {
        return { agentId, memories: [] };
      }
    });

    const searchResults = await Promise.all(searches);
    for (const { agentId, memories } of searchResults) {
      if (memories.length > 0) {
        results[agentId] = memories;
      }
    }

    return results as Record<LifeOSAgentId, MemoryEntry[]>;
  }

  /**
   * Read org-council memory
   */
  async readOrgMemory(query: string, limit = 5): Promise<MemoryEntry[]> {
    try {
      const { searchOrgMemory } = await import('../memory/zep');
      const results = await searchOrgMemory(query, limit);

      return results.map((r) => ({
        id: r.memory.id,
        text: r.memory.text,
        metadata: r.memory.metadata,
        createdAt: r.memory.createdAt || new Date().toISOString(),
        score: r.score,
      }));
    } catch (error) {
      console.error('[UnifiedBus] Failed to read org memory:', error);
      return [];
    }
  }

  /**
   * Write to org-council memory (direct, no proposal)
   * Only Conductor has this privilege
   */
  async writeOrgMemory(text: string, metadata?: Record<string, any>): Promise<boolean> {
    try {
      const { addOrgMemory } = await import('../memory/zep');
      await addOrgMemory(text, {
        ...metadata,
        written_by: 'conductor',
        written_at: new Date().toISOString(),
        direct_write: true, // Bypass proposal system
      });

      this.logActivity('agent.orchestrator', `org_memory_write: "${text.substring(0, 50)}..."`);
      return true;
    } catch (error) {
      console.error('[UnifiedBus] Failed to write org memory:', error);
      return false;
    }
  }

  // ===========================================================================
  // Direct Agent Invocation
  // ===========================================================================

  /**
   * Invoke any agent directly
   */
  async invokeAgent(request: DirectInvokeRequest): Promise<DirectInvokeResponse> {
    const { agentId, message, context, priority = 'normal', awaitResponse = true } = request;

    // Mark agent as busy
    this.updateAgentState(agentId, { status: 'busy', currentTask: message.substring(0, 100) });

    try {
      const { invokeAgent } = await import('./AgentInvoker');

      const startTime = Date.now();
      const response = await invokeAgent({
        agentId,
        userMessage: message,
        context: {
          metadata: {
            ...context,
            priority,
            invoked_by: 'conductor',
          },
        },
        forceExecute: priority === 'critical',
      });

      const latencyMs = Date.now() - startTime;

      // Update agent state
      this.updateAgentState(agentId, {
        status: 'idle',
        currentTask: undefined,
      });

      this.logActivity(agentId, `invoked: ${response.escalationLevel} (${latencyMs}ms)`);

      return {
        success: true,
        agentId,
        response: response.content,
        escalationLevel: response.escalationLevel,
        wasExecuted: response.shouldExecute,
        latencyMs,
        model: response.model,
      };
    } catch (error) {
      // Mark agent as error
      this.updateAgentState(agentId, { status: 'error', currentTask: undefined });
      this.logActivity(agentId, `invoke_error: ${error instanceof Error ? error.message : 'Unknown'}`);

      return {
        success: false,
        agentId,
        response: error instanceof Error ? error.message : 'Invocation failed',
        escalationLevel: 'CRITICAL',
        wasExecuted: false,
        latencyMs: 0,
        model: 'unknown',
      };
    }
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcast(request: BroadcastMessage): Promise<BroadcastResponse> {
    const { message, priority, targetAgents, context } = request;

    // Determine which agents to target
    const agents = targetAgents || (Object.keys(LIFE_OS_TO_ZEP) as LifeOSAgentId[]);

    // Filter out orchestrator (don't broadcast to self)
    const filteredAgents = agents.filter((a) => a !== 'agent.orchestrator');

    // Invoke all agents in parallel
    const invocations = filteredAgents.map((agentId) =>
      this.invokeAgent({
        agentId,
        message,
        context,
        priority,
        awaitResponse: true,
      })
    );

    const responses = await Promise.all(invocations);
    const successCount = responses.filter((r) => r.success).length;

    return {
      success: successCount > 0,
      responses,
      totalAgents: filteredAgents.length,
      successCount,
      failCount: filteredAgents.length - successCount,
    };
  }

  /**
   * Route message to appropriate agent based on @mentions or domain detection
   */
  async routeMessage(
    message: string,
    context?: Record<string, any>
  ): Promise<{ agentId: LifeOSAgentId; response: DirectInvokeResponse } | null> {
    // Check for @mentions first
    const mentions = this.parseAgentMentions(message);
    if (mentions.length > 0) {
      // Route to first mentioned agent
      const response = await this.invokeAgent({
        agentId: mentions[0],
        message,
        context,
      });
      return { agentId: mentions[0], response };
    }

    // Otherwise, use domain detection from agent_bus
    try {
      const { detectDomain, routeToAgents } = await import('../agent_bus');
      const domain = detectDomain(message);
      if (domain) {
        const busAgents = routeToAgents({ subject: message, body: message });
        if (busAgents.length > 0) {
          // Map bus agent ID to Life OS agent ID
          const mapping: Record<string, LifeOSAgentId> = {
            orchestrator: 'agent.orchestrator',
            'legal-agent': 'agent.legal',
            'finance-agent': 'agent.finance',
            'pm-agent': 'agent.pm',
            'comms-agent': 'agent.comms',
            'health-agent': 'agent.health',
            'hyro-agent': 'agent.hyro',
          };
          const agentId = mapping[busAgents[0]] || 'agent.orchestrator';
          const response = await this.invokeAgent({ agentId, message, context });
          return { agentId, response };
        }
      }
    } catch (error) {
      console.warn('[UnifiedBus] Domain detection failed:', error);
    }

    return null;
  }

  // ===========================================================================
  // System Overview
  // ===========================================================================

  /**
   * Get full system overview
   */
  async getSystemOverview(): Promise<{
    agents: AgentState[];
    orgMemoryCount: number;
    recentActivity: typeof this.activityLog;
    pendingEscalations: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
  }> {
    const agents = this.getAllAgentStates();

    // Count org memory entries
    let orgMemoryCount = 0;
    try {
      const { getProposalCounts } = await import('../memory/zep');
      const counts = getProposalCounts();
      orgMemoryCount = counts.approved || 0;
    } catch {
      // Zep not available
    }

    // Get pending escalations
    let pendingEscalations = 0;
    try {
      const { agentInvoker } = await import('./AgentInvoker');
      const pending = agentInvoker.getPendingEscalations();
      pendingEscalations = pending.length;
    } catch {
      // AgentInvoker not available
    }

    // Calculate system health
    const errorAgents = agents.filter((a) => a.status === 'error').length;
    const offlineAgents = agents.filter((a) => a.status === 'offline').length;

    let systemHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (errorAgents > 2 || pendingEscalations > 5) {
      systemHealth = 'critical';
    } else if (errorAgents > 0 || offlineAgents > 2 || pendingEscalations > 2) {
      systemHealth = 'degraded';
    }

    return {
      agents,
      orgMemoryCount,
      recentActivity: this.getRecentActivity(20),
      pendingEscalations,
      systemHealth,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let instance: UnifiedBusImpl | null = null;

export function getUnifiedBus(): UnifiedBusImpl {
  if (!instance) {
    instance = new UnifiedBusImpl();
  }
  return instance;
}

// Export class for type usage
export { UnifiedBusImpl as UnifiedBus };

// Export mappings for external use
export { LIFE_OS_TO_ZEP, AGENT_NAMES, AGENT_ALIASES };
