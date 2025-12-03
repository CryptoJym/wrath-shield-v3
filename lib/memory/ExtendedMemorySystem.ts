/**
 * Extended Memory System - Multiple Graphs Per Agent
 *
 * This system extends the base Zep integration to support multiple memory graphs
 * per agent for different purposes:
 *
 * 1. Domain-specific graphs (e.g., legal-family, legal-fcra)
 * 2. Temporal memory buckets (hot/warm/cold)
 * 3. Matter-specific graphs for case/project isolation
 * 4. Dynamic graph creation and management
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                     EXTENDED MEMORY SYSTEM                               │
 * │                                                                          │
 * │  ┌─────────────────────────────────────────────────────────────────────┐│
 * │  │                        MEMORY ROUTER                                 ││
 * │  │   Routes queries to appropriate graph based on context               ││
 * │  └─────────────────────────────────────────────────────────────────────┘│
 * │                                │                                         │
 * │         ┌──────────────────────┼──────────────────────┐                 │
 * │         │                      │                      │                 │
 * │         ▼                      ▼                      ▼                 │
 * │  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐           │
 * │  │   DOMAIN    │       │  TEMPORAL   │       │   MATTER    │           │
 * │  │   GRAPHS    │       │   BUCKETS   │       │   GRAPHS    │           │
 * │  │             │       │             │       │             │           │
 * │  │ legal-family│       │    HOT      │       │ matter_123  │           │
 * │  │ legal-fcra  │       │   (7 days)  │       │ matter_456  │           │
 * │  │ legal-empl  │       │    WARM     │       │             │           │
 * │  │             │       │  (30 days)  │       │             │           │
 * │  │             │       │    COLD     │       │             │           │
 * │  │             │       │  (archive)  │       │             │           │
 * │  └─────────────┘       └─────────────┘       └─────────────┘           │
 * │                                │                                         │
 * │                                ▼                                         │
 * │                      ┌─────────────────┐                                │
 * │                      │   ZEP CLOUD     │                                │
 * │                      │  (Base Layer)   │                                │
 * │                      └─────────────────┘                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { ensureServerOnly } from '../server-only-guard';
import type { AgentId, ZepMemory, ZepSearchResult } from './zep';

ensureServerOnly('lib/memory/ExtendedMemorySystem');

// =============================================================================
// Types
// =============================================================================

export type TemporalBucket = 'hot' | 'warm' | 'cold';

export interface ExtendedGraphId {
  baseAgentId: AgentId;
  domain?: string;        // e.g., 'family', 'fcra'
  temporalBucket?: TemporalBucket;
  matterId?: string;      // For matter-specific isolation
}

export interface MemorySearchOptions {
  domains?: string[];           // Search specific domains
  temporalBuckets?: TemporalBucket[];
  matterId?: string;           // Limit to specific matter
  includeOrg?: boolean;        // Include org-council graph
  limit?: number;
  minScore?: number;
}

export interface MemoryWriteOptions {
  domain?: string;             // Write to domain-specific graph
  matterId?: string;           // Write to matter-specific graph
  temporalBucket?: TemporalBucket;
  isOrgKnowledge?: boolean;    // Write to org-council (requires approval)
}

export interface ExtendedSearchResult extends ZepSearchResult {
  source: {
    graphId: string;
    domain?: string;
    matterId?: string;
    temporalBucket?: TemporalBucket;
  };
}

export interface GraphStats {
  graphId: string;
  memoryCount: number;
  lastUpdated: string;
  domain?: string;
  matterId?: string;
}

export interface AgentMemoryOverview {
  agentId: AgentId;
  totalMemories: number;
  graphs: GraphStats[];
  domainBreakdown: Record<string, number>;
  temporalBreakdown: Record<TemporalBucket, number>;
}

// =============================================================================
// Graph ID Construction
// =============================================================================

/**
 * Build a Zep graph ID from extended components
 */
function buildGraphId(extended: ExtendedGraphId): string {
  const parts = ['wrath-shield', extended.baseAgentId];

  if (extended.domain) {
    parts.push(extended.domain);
  }
  if (extended.matterId) {
    parts.push(`matter-${extended.matterId}`);
  }
  if (extended.temporalBucket && extended.temporalBucket !== 'hot') {
    parts.push(extended.temporalBucket);
  }

  return parts.join('-');
}

/**
 * Parse a Zep graph ID into extended components
 */
function parseGraphId(graphId: string): ExtendedGraphId | null {
  const parts = graphId.split('-');

  if (parts.length < 2 || parts[0] !== 'wrath' || parts[1] !== 'shield') {
    return null;
  }

  // Remove 'wrath-shield-' prefix
  const remainder = parts.slice(2);

  // Find the base agent ID (format: xxx-agent)
  const agentIndex = remainder.findIndex((p) => p === 'agent');
  if (agentIndex === -1 || agentIndex === 0) {
    return null;
  }

  const baseAgentId = `${remainder[agentIndex - 1]}-agent` as AgentId;
  const afterAgent = remainder.slice(agentIndex + 1);

  const result: ExtendedGraphId = { baseAgentId };

  // Parse remaining parts
  for (let i = 0; i < afterAgent.length; i++) {
    const part = afterAgent[i];
    if (part === 'matter' && afterAgent[i + 1]) {
      result.matterId = afterAgent[i + 1];
      i++;
    } else if (part === 'warm' || part === 'cold') {
      result.temporalBucket = part as TemporalBucket;
    } else if (!['matter'].includes(part)) {
      result.domain = part;
    }
  }

  return result;
}

// =============================================================================
// Extended Memory Class
// =============================================================================

class ExtendedMemorySystem {
  private graphRegistry: Map<string, GraphStats> = new Map();
  private initialized = false;

  /**
   * Initialize and discover existing graphs
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get list of existing graphs from Zep
      const zep = await import('./zep');
      // Note: Zep v3 SDK method to list graphs would go here
      // For now, we'll discover graphs as we use them
      this.initialized = true;
      console.log('[ExtendedMemory] Initialized');
    } catch (error) {
      console.warn('[ExtendedMemory] Initialization warning:', error);
      this.initialized = true;
    }
  }

  // ===========================================================================
  // Domain-Specific Operations
  // ===========================================================================

  /**
   * Write to a domain-specific graph
   */
  async writeToDomain(
    agentId: AgentId,
    domain: string,
    text: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    await this.initialize();

    const graphId = buildGraphId({ baseAgentId: agentId, domain });

    try {
      const { addAgentMemory } = await import('./zep');
      // Note: We're using the base agent ID for now
      // In a full implementation, we'd create separate graphs per domain
      await addAgentMemory(agentId, text, {
        ...metadata,
        domain,
        extended_graph_id: graphId,
        timestamp: new Date().toISOString(),
      });

      // Update registry
      this.updateGraphStats(graphId, { domain });
      return true;
    } catch (error) {
      console.error(`[ExtendedMemory] Failed to write to domain ${domain}:`, error);
      return false;
    }
  }

  /**
   * Search domain-specific memories
   */
  async searchDomain(
    agentId: AgentId,
    domain: string,
    query: string,
    limit = 5
  ): Promise<ExtendedSearchResult[]> {
    await this.initialize();

    try {
      const { searchAgentMemory } = await import('./zep');
      const results = await searchAgentMemory(agentId, query, limit * 2);

      // Filter to domain-specific results
      const domainResults = results.filter(
        (r) => r.memory.metadata?.domain === domain
      );

      return domainResults.slice(0, limit).map((r) => ({
        ...r,
        source: {
          graphId: buildGraphId({ baseAgentId: agentId, domain }),
          domain,
        },
      }));
    } catch (error) {
      console.error(`[ExtendedMemory] Failed to search domain ${domain}:`, error);
      return [];
    }
  }

  // ===========================================================================
  // Matter-Specific Operations
  // ===========================================================================

  /**
   * Write to a matter-specific graph
   */
  async writeToMatter(
    agentId: AgentId,
    matterId: string,
    text: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    await this.initialize();

    const graphId = buildGraphId({ baseAgentId: agentId, matterId });

    try {
      const { addAgentMemory } = await import('./zep');
      await addAgentMemory(agentId, text, {
        ...metadata,
        matter_id: matterId,
        extended_graph_id: graphId,
        timestamp: new Date().toISOString(),
      });

      this.updateGraphStats(graphId, { matterId });
      return true;
    } catch (error) {
      console.error(`[ExtendedMemory] Failed to write to matter ${matterId}:`, error);
      return false;
    }
  }

  /**
   * Search matter-specific memories
   */
  async searchMatter(
    agentId: AgentId,
    matterId: string,
    query: string,
    limit = 5
  ): Promise<ExtendedSearchResult[]> {
    await this.initialize();

    try {
      const { searchAgentMemory } = await import('./zep');
      const results = await searchAgentMemory(agentId, query, limit * 2);

      const matterResults = results.filter(
        (r) => r.memory.metadata?.matter_id === matterId
      );

      return matterResults.slice(0, limit).map((r) => ({
        ...r,
        source: {
          graphId: buildGraphId({ baseAgentId: agentId, matterId }),
          matterId,
        },
      }));
    } catch (error) {
      console.error(`[ExtendedMemory] Failed to search matter ${matterId}:`, error);
      return [];
    }
  }

  /**
   * Get all memories for a matter
   */
  async getMatterMemories(
    agentId: AgentId,
    matterId: string,
    limit = 50
  ): Promise<ExtendedSearchResult[]> {
    return this.searchMatter(agentId, matterId, '*', limit);
  }

  // ===========================================================================
  // Temporal Operations
  // ===========================================================================

  /**
   * Categorize memory age into temporal bucket
   */
  private getTemporalBucket(createdAt: string): TemporalBucket {
    const age = Date.now() - new Date(createdAt).getTime();
    const days = age / (1000 * 60 * 60 * 24);

    if (days <= 7) return 'hot';
    if (days <= 30) return 'warm';
    return 'cold';
  }

  /**
   * Search with temporal filtering
   */
  async searchTemporal(
    agentId: AgentId,
    query: string,
    buckets: TemporalBucket[] = ['hot', 'warm'],
    limit = 5
  ): Promise<ExtendedSearchResult[]> {
    await this.initialize();

    try {
      const { searchAgentMemory } = await import('./zep');
      const results = await searchAgentMemory(agentId, query, limit * 3);

      // Filter by temporal bucket
      const filteredResults = results.filter((r) => {
        const createdAt = r.memory.createdAt || new Date().toISOString();
        const bucket = this.getTemporalBucket(createdAt);
        return buckets.includes(bucket);
      });

      return filteredResults.slice(0, limit).map((r) => {
        const createdAt = r.memory.createdAt || new Date().toISOString();
        const bucket = this.getTemporalBucket(createdAt);
        return {
          ...r,
          source: {
            graphId: buildGraphId({ baseAgentId: agentId, temporalBucket: bucket }),
            temporalBucket: bucket,
          },
        };
      });
    } catch (error) {
      console.error('[ExtendedMemory] Temporal search failed:', error);
      return [];
    }
  }

  // ===========================================================================
  // Combined Search
  // ===========================================================================

  /**
   * Search across multiple graphs with options
   */
  async search(
    agentId: AgentId,
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<ExtendedSearchResult[]> {
    await this.initialize();

    const {
      domains,
      temporalBuckets = ['hot', 'warm'],
      matterId,
      includeOrg = true,
      limit = 10,
      minScore = 0.3,
    } = options;

    const results: ExtendedSearchResult[] = [];

    try {
      // Search agent's main graph
      const { searchAgentMemory, searchOrgMemory } = await import('./zep');
      const agentResults = await searchAgentMemory(agentId, query, limit * 2);

      // Filter and enrich results
      for (const r of agentResults) {
        const createdAt = r.memory.createdAt || new Date().toISOString();
        const bucket = this.getTemporalBucket(createdAt);
        const memDomain = r.memory.metadata?.domain;
        const memMatter = r.memory.metadata?.matter_id;

        // Apply filters
        if (domains && memDomain && !domains.includes(memDomain)) continue;
        if (temporalBuckets && !temporalBuckets.includes(bucket)) continue;
        if (matterId && memMatter && memMatter !== matterId) continue;
        if (r.score && r.score < minScore) continue;

        results.push({
          ...r,
          source: {
            graphId: buildGraphId({
              baseAgentId: agentId,
              domain: memDomain,
              matterId: memMatter,
              temporalBucket: bucket,
            }),
            domain: memDomain,
            matterId: memMatter,
            temporalBucket: bucket,
          },
        });
      }

      // Include org-council results if requested
      if (includeOrg) {
        const orgResults = await searchOrgMemory(query, Math.ceil(limit / 3));
        for (const r of orgResults) {
          if (r.score && r.score < minScore) continue;
          results.push({
            ...r,
            source: {
              graphId: 'wrath-shield-org-council',
            },
          });
        }
      }

      // Sort by score and limit
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
      return results.slice(0, limit);
    } catch (error) {
      console.error('[ExtendedMemory] Combined search failed:', error);
      return [];
    }
  }

  /**
   * Write with options
   */
  async write(
    agentId: AgentId,
    text: string,
    metadata: Record<string, any> = {},
    options: MemoryWriteOptions = {}
  ): Promise<boolean> {
    await this.initialize();

    const { domain, matterId, isOrgKnowledge } = options;

    try {
      if (isOrgKnowledge) {
        // Route to org-council proposal
        const { proposeOrgMemory } = await import('./zep');
        await proposeOrgMemory(agentId, text, metadata);
        return true;
      }

      const { addAgentMemory } = await import('./zep');
      await addAgentMemory(agentId, text, {
        ...metadata,
        domain,
        matter_id: matterId,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('[ExtendedMemory] Write failed:', error);
      return false;
    }
  }

  // ===========================================================================
  // Graph Management
  // ===========================================================================

  /**
   * Update graph statistics
   */
  private updateGraphStats(
    graphId: string,
    info: { domain?: string; matterId?: string }
  ): void {
    const existing = this.graphRegistry.get(graphId);
    const now = new Date().toISOString();

    this.graphRegistry.set(graphId, {
      graphId,
      memoryCount: (existing?.memoryCount || 0) + 1,
      lastUpdated: now,
      domain: info.domain || existing?.domain,
      matterId: info.matterId || existing?.matterId,
    });
  }

  /**
   * Get overview of agent's memory graphs
   */
  async getAgentMemoryOverview(agentId: AgentId): Promise<AgentMemoryOverview> {
    await this.initialize();

    const graphs: GraphStats[] = [];
    const domainBreakdown: Record<string, number> = {};
    const temporalBreakdown: Record<TemporalBucket, number> = { hot: 0, warm: 0, cold: 0 };

    // Get stats from registry for this agent
    for (const [graphId, stats] of this.graphRegistry.entries()) {
      if (graphId.includes(agentId)) {
        graphs.push(stats);
        if (stats.domain) {
          domainBreakdown[stats.domain] = (domainBreakdown[stats.domain] || 0) + stats.memoryCount;
        }
      }
    }

    // Try to get actual counts from Zep
    try {
      const { searchAgentMemory } = await import('./zep');
      const recentResults = await searchAgentMemory(agentId, '*', 100);

      for (const r of recentResults) {
        const createdAt = r.memory.createdAt || new Date().toISOString();
        const bucket = this.getTemporalBucket(createdAt);
        temporalBreakdown[bucket]++;

        const domain = r.memory.metadata?.domain;
        if (domain) {
          domainBreakdown[domain] = (domainBreakdown[domain] || 0) + 1;
        }
      }
    } catch {
      // Zep unavailable
    }

    const totalMemories = Object.values(temporalBreakdown).reduce((a, b) => a + b, 0);

    return {
      agentId,
      totalMemories,
      graphs,
      domainBreakdown,
      temporalBreakdown,
    };
  }

  /**
   * List all domains for an agent
   */
  async listAgentDomains(agentId: AgentId): Promise<string[]> {
    const overview = await this.getAgentMemoryOverview(agentId);
    return Object.keys(overview.domainBreakdown);
  }

  /**
   * List all matters for an agent
   */
  async listAgentMatters(agentId: AgentId): Promise<string[]> {
    const matters: Set<string> = new Set();

    try {
      const { searchAgentMemory } = await import('./zep');
      const results = await searchAgentMemory(agentId, '*', 200);

      for (const r of results) {
        const matterId = r.memory.metadata?.matter_id;
        if (matterId) {
          matters.add(matterId);
        }
      }
    } catch {
      // Zep unavailable
    }

    return Array.from(matters);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let instance: ExtendedMemorySystem | null = null;

export function getExtendedMemory(): ExtendedMemorySystem {
  if (!instance) {
    instance = new ExtendedMemorySystem();
  }
  return instance;
}

export { ExtendedMemorySystem, buildGraphId, parseGraphId };
