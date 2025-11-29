/**
 * Wrath Shield v3 - Zep Cloud Memory Integration (v3 API)
 *
 * Dual-Graph Architecture:
 * 1. Individual Agent Graphs - Each agent has its own private memory
 * 2. Org-Council Graph - Shared organizational knowledge requiring council approval
 *
 * Architecture:
 * - Each agent gets a dedicated graph: wrath-shield-{agent}-agent
 * - Shared org graph: wrath-shield-org-council
 * - Agents can freely write to their own graph
 * - Org graph edits require council review (PROPOSE escalation)
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import * as councilDb from '../db/council';

// Prevent client-side imports
ensureServerOnly('lib/memory/zep');

// Agent IDs for individual graphs
export type AgentId =
  | 'orchestrator-agent'
  | 'legal-agent'
  | 'finance-agent'
  | 'pm-agent'
  | 'comms-agent'
  | 'health-agent'
  | 'coaching-agent'
  | 'hyro-agent'
  | 'grok-agent'
  | 'sherlock-agent'
  | 'ea-agent'
  | 'relationships-agent'
  | 'eeg-agent';

// Special org-council graph ID
export const ORG_COUNCIL_GRAPH = 'org-council';

export interface ZepConfig {
  apiKey: string;
}

export interface ZepMemory {
  id: string;
  text: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface ZepSearchResult {
  memory: ZepMemory;
  score?: number;
}

/**
 * Pending org-council edit awaiting approval
 * Now persisted to SQLite via lib/db/council.ts
 */
export interface OrgCouncilProposal {
  id: string;
  proposedBy: AgentId;
  text: string;
  metadata?: Record<string, any>;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

// Helper to convert DB proposal to Zep proposal format
function dbToZepProposal(dbProposal: councilDb.CouncilProposal): OrgCouncilProposal {
  return {
    id: dbProposal.id,
    proposedBy: dbProposal.proposed_by as AgentId,
    text: dbProposal.text,
    metadata: dbProposal.metadata,
    timestamp: new Date(dbProposal.created_at * 1000).toISOString(),
    status: dbProposal.status,
    reviewedBy: dbProposal.reviewed_by,
    reviewedAt: dbProposal.reviewed_at ? new Date(dbProposal.reviewed_at * 1000).toISOString() : undefined,
  };
}

/**
 * Zep Cloud Client Wrapper (v3 Graph API)
 *
 * Dual-graph architecture:
 * - Individual agent graphs for private memory
 * - Shared org-council graph for organizational knowledge
 */
class ZepClient {
  private client: any | null = null;
  private config: ZepConfig | null = null;
  private graphsCreated: Set<string> = new Set();

  /**
   * Initialize Zep Cloud client
   */
  async initialize(): Promise<void> {
    if (this.client) {
      return; // Already initialized
    }

    const apiKey = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;
    if (!apiKey || apiKey.length === 0) {
      throw new Error('[ZepClient] ZEP_API_KEY or ZEP_LEGAL_API_KEY not configured');
    }

    this.config = { apiKey };

    try {
      const { ZepClient: ZepSDK } = await import('@getzep/zep-cloud');
      this.client = new ZepSDK({ apiKey: this.config.apiKey });
      console.log('[ZepClient] Successfully initialized Zep Cloud client (v3)');
    } catch (error) {
      console.error('[ZepClient] Failed to initialize Zep client:', error);
      throw new Error(`Zep initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      await this.initialize();
    }
    return this.client!;
  }

  /**
   * Get the graph ID for an agent
   */
  getAgentGraphId(agentId: AgentId): string {
    return `wrath-shield-${agentId}`;
  }

  /**
   * Get the org-council graph ID
   */
  getOrgCouncilGraphId(): string {
    return `wrath-shield-${ORG_COUNCIL_GRAPH}`;
  }

  /**
   * Ensure a graph exists (create if needed)
   */
  async ensureGraph(graphId: string, name: string, description: string): Promise<string> {
    const client = await this.getClient();

    if (this.graphsCreated.has(graphId)) {
      return graphId;
    }

    try {
      await client.graph.get(graphId);
      console.log(`[ZepClient] Graph ${graphId} already exists`);
      this.graphsCreated.add(graphId);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404 || error?.message?.includes('not found')) {
        console.log(`[ZepClient] Creating graph ${graphId}`);
        try {
          await client.graph.create({ graphId, name, description });
          console.log(`[ZepClient] Created graph ${graphId}`);
          this.graphsCreated.add(graphId);
        } catch (createError: any) {
          if (createError?.message?.includes('already exists')) {
            console.log(`[ZepClient] Graph ${graphId} already exists (concurrent creation)`);
            this.graphsCreated.add(graphId);
          } else {
            throw createError;
          }
        }
      } else {
        throw error;
      }
    }

    return graphId;
  }

  /**
   * Ensure agent's individual graph exists
   */
  async ensureAgentGraph(agentId: AgentId): Promise<string> {
    const graphId = this.getAgentGraphId(agentId);
    return this.ensureGraph(
      graphId,
      `Wrath Shield - ${agentId}`,
      `Private memory graph for ${agentId}`
    );
  }

  /**
   * Ensure org-council graph exists
   */
  async ensureOrgCouncilGraph(): Promise<string> {
    const graphId = this.getOrgCouncilGraphId();
    return this.ensureGraph(
      graphId,
      'Wrath Shield - Org Council',
      'Shared organizational knowledge requiring council approval for edits'
    );
  }

  // ============================================
  // AGENT GRAPH OPERATIONS (Direct Access)
  // ============================================

  /**
   * Add memory to agent's private graph (no approval needed)
   */
  async addAgentMemory(
    agentId: AgentId,
    text: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const client = await this.getClient();
    const graphId = await this.ensureAgentGraph(agentId);

    try {
      await client.graph.add({
        graphId,
        data: text,
        type: 'text',
        metadata: {
          agent_id: agentId,
          graph_type: 'agent',
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });
      console.log(`[ZepClient] Added memory to agent graph ${graphId}`);
    } catch (error) {
      console.error(`[ZepClient] Failed to add agent memory:`, error);
      throw error;
    }
  }

  /**
   * Search agent's private graph
   */
  async searchAgentMemory(
    agentId: AgentId,
    query: string,
    limit: number = 5
  ): Promise<ZepSearchResult[]> {
    const client = await this.getClient();
    const graphId = await this.ensureAgentGraph(agentId);

    try {
      const results = await client.graph.search({ graphId, query, limit });
      const edges = results?.edges || results?.nodes || [];
      console.log(`[ZepClient] Found ${edges.length} memories in agent graph ${graphId}`);

      return edges.map((edge: any) => ({
        memory: {
          id: edge.uuid || edge.id || 'unknown',
          text: edge.fact || edge.name || edge.content || '',
          metadata: edge.metadata,
          createdAt: edge.created_at,
        },
        score: edge.score || edge.weight,
      }));
    } catch (error) {
      console.error(`[ZepClient] Agent search failed:`, error);
      throw error;
    }
  }

  // ============================================
  // ORG-COUNCIL GRAPH OPERATIONS (Approval Required)
  // ============================================

  /**
   * Propose an edit to the org-council graph (requires approval)
   * Returns a proposal ID that can be approved/rejected
   * Now persisted to SQLite
   */
  async proposeOrgMemory(
    proposedBy: AgentId,
    text: string,
    metadata?: Record<string, any>
  ): Promise<OrgCouncilProposal> {
    const id = `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Persist to SQLite
    const dbProposal = councilDb.createProposal(id, proposedBy, text, metadata);
    console.log(`[ZepClient] Org-council proposal created and persisted: ${id} by ${proposedBy}`);

    return dbToZepProposal(dbProposal);
  }

  /**
   * Get all pending org-council proposals
   * Now reads from SQLite
   */
  getPendingOrgProposals(): OrgCouncilProposal[] {
    const dbProposals = councilDb.getPendingProposals();
    return dbProposals.map(dbToZepProposal);
  }

  /**
   * Get all proposals (with optional status filter)
   */
  getAllOrgProposals(status?: 'pending' | 'approved' | 'rejected', limit = 50): OrgCouncilProposal[] {
    const dbProposals = status
      ? councilDb.getProposalsByStatus(status, limit)
      : councilDb.getAllProposals(limit);
    return dbProposals.map(dbToZepProposal);
  }

  /**
   * Get proposal counts by status
   */
  getProposalCounts(): Record<'pending' | 'approved' | 'rejected', number> {
    return councilDb.getProposalCounts();
  }

  /**
   * Approve an org-council proposal (adds to graph and updates DB)
   */
  async approveOrgProposal(
    proposalId: string,
    reviewedBy: string
  ): Promise<boolean> {
    // Get proposal from DB
    const dbProposal = councilDb.getProposal(proposalId);
    if (!dbProposal || dbProposal.status !== 'pending') {
      console.error(`[ZepClient] Proposal not found or already processed: ${proposalId}`);
      return false;
    }

    const client = await this.getClient();
    const graphId = await this.ensureOrgCouncilGraph();

    try {
      // Write to Zep org-council graph
      await client.graph.add({
        graphId,
        data: dbProposal.text,
        type: 'text',
        metadata: {
          proposed_by: dbProposal.proposed_by,
          proposed_at: new Date(dbProposal.created_at * 1000).toISOString(),
          approved_by: reviewedBy,
          approved_at: new Date().toISOString(),
          graph_type: 'org-council',
          ...dbProposal.metadata,
        },
      });

      // Update DB status
      councilDb.approveProposal(proposalId, reviewedBy);

      console.log(`[ZepClient] Org-council proposal approved and persisted: ${proposalId}`);
      return true;
    } catch (error) {
      console.error(`[ZepClient] Failed to approve proposal:`, error);
      return false;
    }
  }

  /**
   * Reject an org-council proposal (updates DB)
   */
  rejectOrgProposal(proposalId: string, reviewedBy: string): boolean {
    const success = councilDb.rejectProposal(proposalId, reviewedBy);

    if (success) {
      console.log(`[ZepClient] Org-council proposal rejected: ${proposalId}`);
    }
    return success;
  }

  /**
   * Search org-council graph (read-only, all agents can search)
   */
  async searchOrgMemory(
    query: string,
    limit: number = 5
  ): Promise<ZepSearchResult[]> {
    const client = await this.getClient();
    const graphId = await this.ensureOrgCouncilGraph();

    try {
      const results = await client.graph.search({ graphId, query, limit });
      const edges = results?.edges || results?.nodes || [];
      console.log(`[ZepClient] Found ${edges.length} memories in org-council graph`);

      return edges.map((edge: any) => ({
        memory: {
          id: edge.uuid || edge.id || 'unknown',
          text: edge.fact || edge.name || edge.content || '',
          metadata: edge.metadata,
          createdAt: edge.created_at,
        },
        score: edge.score || edge.weight,
      }));
    } catch (error) {
      console.error(`[ZepClient] Org search failed:`, error);
      return [];
    }
  }

  // ============================================
  // COMBINED OPERATIONS (Both Graphs)
  // ============================================

  /**
   * Search both agent and org-council graphs
   * Returns combined results with source indicated
   */
  async searchAllMemory(
    agentId: AgentId,
    query: string,
    limit: number = 5
  ): Promise<{ agent: ZepSearchResult[]; org: ZepSearchResult[] }> {
    const [agentResults, orgResults] = await Promise.all([
      this.searchAgentMemory(agentId, query, limit).catch(() => []),
      this.searchOrgMemory(query, limit).catch(() => []),
    ]);

    return { agent: agentResults, org: orgResults };
  }

  /**
   * Add memory with automatic routing:
   * - If isOrgKnowledge=true, creates proposal for council review
   * - Otherwise, adds directly to agent's private graph
   */
  async addMemory(
    agentId: AgentId,
    text: string,
    metadata?: Record<string, any>,
    isOrgKnowledge: boolean = false
  ): Promise<{ type: 'direct' | 'proposal'; proposalId?: string }> {
    if (isOrgKnowledge) {
      const proposal = await this.proposeOrgMemory(agentId, text, metadata);
      return { type: 'proposal', proposalId: proposal.id };
    } else {
      await this.addAgentMemory(agentId, text, metadata);
      return { type: 'direct' };
    }
  }

  // ============================================
  // BACKWARDS COMPATIBILITY
  // ============================================

  async ensureUser(userId: AgentId, metadata?: Record<string, any>): Promise<void> {
    await this.ensureAgentGraph(userId);
  }

  async ensureSession(userId: AgentId, sessionId?: string, metadata?: Record<string, any>): Promise<string> {
    return this.ensureAgentGraph(userId);
  }

  async searchMemory(agentId: AgentId, query: string, limit?: number, sessionId?: string): Promise<ZepSearchResult[]> {
    return this.searchAgentMemory(agentId, query, limit);
  }

  async getRecentMemories(agentId: AgentId, limit: number = 10): Promise<ZepMemory[]> {
    const results = await this.searchAgentMemory(agentId, '*', limit);
    return results.map(r => r.memory);
  }

  async getContext(agentId: AgentId): Promise<string> {
    const memories = await this.getRecentMemories(agentId, 5);
    return memories.map(m => m.text).join('\n\n');
  }

  async deleteMemory(sessionId: string, memoryId: string): Promise<void> {
    console.warn(`[ZepClient] Memory deletion not fully implemented in v3`);
  }

  async getGraphs(): Promise<string[]> {
    const client = await this.getClient();
    try {
      const response = await client.graph.listAll({});
      return (response?.graphs || []).map((g: any) => g.graphId);
    } catch (error) {
      return [];
    }
  }

  async getSessions(userId: AgentId): Promise<string[]> {
    return this.getGraphs();
  }
}

/**
 * Singleton instance
 */
const zepClient = new ZepClient();

/**
 * Export singleton instance methods
 */

// Initialization
export const initializeZep = () => zepClient.initialize();

// Agent Graph Operations (Direct Access)
export const addAgentMemory = (agentId: AgentId, text: string, metadata?: Record<string, any>) =>
  zepClient.addAgentMemory(agentId, text, metadata);
export const searchAgentMemory = (agentId: AgentId, query: string, limit?: number) =>
  zepClient.searchAgentMemory(agentId, query, limit);

// Org-Council Graph Operations (Approval Required)
export const proposeOrgMemory = (proposedBy: AgentId, text: string, metadata?: Record<string, any>) =>
  zepClient.proposeOrgMemory(proposedBy, text, metadata);
export const getPendingOrgProposals = () => zepClient.getPendingOrgProposals();
export const getAllOrgProposals = (status?: 'pending' | 'approved' | 'rejected', limit?: number) =>
  zepClient.getAllOrgProposals(status, limit);
export const getProposalCounts = () => zepClient.getProposalCounts();
export const approveOrgProposal = (proposalId: string, reviewedBy: string) =>
  zepClient.approveOrgProposal(proposalId, reviewedBy);
export const rejectOrgProposal = (proposalId: string, reviewedBy: string) =>
  zepClient.rejectOrgProposal(proposalId, reviewedBy);
export const searchOrgMemory = (query: string, limit?: number) =>
  zepClient.searchOrgMemory(query, limit);

// Council Notifications (re-export from db/council)
export const getUnreadNotifications = (recipient: string) =>
  councilDb.getUnreadNotifications(recipient);
export const markNotificationsRead = (recipient: string, proposalIds?: string[]) =>
  councilDb.markNotificationsRead(recipient, proposalIds);
export const getUnreadNotificationCount = (recipient: string) =>
  councilDb.getUnreadNotificationCount(recipient);

// Combined Operations
export const searchAllMemory = (agentId: AgentId, query: string, limit?: number) =>
  zepClient.searchAllMemory(agentId, query, limit);
export const addMemory = (agentId: AgentId, text: string, metadata?: Record<string, any>, isOrgKnowledge?: boolean) =>
  zepClient.addMemory(agentId, text, metadata, isOrgKnowledge);

// Backwards Compatibility Exports
export const ensureZepUser = (userId: AgentId, metadata?: Record<string, any>) =>
  zepClient.ensureUser(userId, metadata);
export const ensureZepSession = (userId: AgentId, sessionId?: string, metadata?: Record<string, any>) =>
  zepClient.ensureSession(userId, sessionId, metadata);
export const addZepMemory = (userId: AgentId, text: string, metadata?: Record<string, any>, sessionId?: string) =>
  zepClient.addAgentMemory(userId, text, metadata);
export const searchZepMemory = (userId: AgentId, query: string, limit?: number, sessionId?: string) =>
  zepClient.searchMemory(userId, query, limit, sessionId);
export const getZepContext = (userId: AgentId, sessionId?: string) =>
  zepClient.getContext(userId);
export const getRecentZepMemories = (userId: AgentId, limit?: number, sessionId?: string) =>
  zepClient.getRecentMemories(userId, limit);
export const deleteZepMemory = (sessionId: string, memoryId: string) =>
  zepClient.deleteMemory(sessionId, memoryId);
export const getZepSessions = (userId: AgentId) => zepClient.getSessions(userId);
