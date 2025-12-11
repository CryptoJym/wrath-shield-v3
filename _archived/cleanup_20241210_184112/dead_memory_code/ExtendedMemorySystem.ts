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
// Relationship Extraction Types (Zep/Graphiti-style)
// =============================================================================

export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'amount' | 'agreement' | 'task' | 'deadline' | 'other';
  confidence: number;
  mentions: number;
  firstSeen: string;
  lastSeen: string;
  metadata?: Record<string, any>;
}

export interface ExtractedRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string; // e.g., 'works_for', 'owes_money_to', 'deadline_for', 'related_to'
  confidence: number;
  context: string; // The text that established this relationship
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RelationshipGraph {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  lastUpdated: string;
}

export interface EntitySearchResult {
  entity: ExtractedEntity;
  relationships: ExtractedRelationship[];
  relatedEntities: ExtractedEntity[];
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
    this.graphRegistry.forEach((stats, graphId) => {
      if (graphId.includes(agentId)) {
        graphs.push(stats);
        if (stats.domain) {
          domainBreakdown[stats.domain] = (domainBreakdown[stats.domain] || 0) + stats.memoryCount;
        }
      }
    });

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

  // ===========================================================================
  // Relationship Extraction (Zep/Graphiti-style Knowledge Graph)
  // ===========================================================================

  /**
   * Extract entities and relationships from text using Zep's graph capabilities
   * Leverages Zep v3 SDK's automatic entity extraction when adding to graph
   */
  async writeWithRelationshipExtraction(
    agentId: AgentId,
    text: string,
    metadata: Record<string, any> = {},
    options: MemoryWriteOptions = {}
  ): Promise<{ success: boolean; extractedEntities?: string[] }> {
    await this.initialize();

    const { domain, matterId } = options;

    try {
      const { addAgentMemory } = await import('./zep');

      // Zep v3 automatically extracts entities and relationships when adding text
      // The graph API builds a knowledge graph from the text content
      await addAgentMemory(agentId, text, {
        ...metadata,
        domain,
        matter_id: matterId,
        timestamp: new Date().toISOString(),
        // Signal to enable relationship extraction in metadata
        extract_entities: true,
        extract_relationships: true,
      });

      // Zep extracts entities automatically - we note common patterns found
      const entityPatterns = this.quickEntityExtract(text);

      console.log(`[ExtendedMemory] Added memory with relationship extraction: ${entityPatterns.length} potential entities`);
      return { success: true, extractedEntities: entityPatterns };
    } catch (error) {
      console.error('[ExtendedMemory] Write with relationship extraction failed:', error);
      return { success: false };
    }
  }

  /**
   * Quick local entity extraction for immediate feedback
   * (Zep does deeper extraction server-side)
   */
  private quickEntityExtract(text: string): string[] {
    const entities: string[] = [];

    // Person names (capitalized words)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    const names = text.match(namePattern) || [];
    entities.push(...names.map(n => `person:${n}`));

    // Money amounts
    const moneyPattern = /\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD)\b/gi;
    const amounts = text.match(moneyPattern) || [];
    entities.push(...amounts.map(a => `amount:${a}`));

    // Dates
    const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gi;
    const dates = text.match(datePattern) || [];
    entities.push(...dates.map(d => `date:${d}`));

    // Organizations (LLC, Inc, Corp patterns)
    const orgPattern = /\b[A-Z][A-Za-z\s&]+(?:LLC|Inc\.?|Corp\.?|Company|Co\.?|Ltd\.?|Foundation|Association)\b/g;
    const orgs = text.match(orgPattern) || [];
    entities.push(...orgs.map(o => `org:${o}`));

    return Array.from(new Set(entities)).slice(0, 20); // Dedupe and limit
  }

  /**
   * Search for entities across the knowledge graph
   */
  async searchEntities(
    agentId: AgentId,
    entityQuery: string,
    options: { type?: ExtractedEntity['type']; limit?: number } = {}
  ): Promise<EntitySearchResult[]> {
    await this.initialize();

    const { type, limit = 10 } = options;

    try {
      const { searchAgentMemory } = await import('./zep');

      // Search Zep graph - it returns nodes/edges which include entity information
      const results = await searchAgentMemory(agentId, entityQuery, limit * 2);

      const entityResults: EntitySearchResult[] = [];
      const seenEntities = new Set<string>();

      for (const r of results) {
        // Extract entity info from Zep result metadata
        const entityName = r.memory.metadata?.entity_name || this.extractEntityFromText(r.memory.text);
        const entityType = r.memory.metadata?.entity_type || 'other';

        if (!entityName || seenEntities.has(entityName)) continue;
        seenEntities.add(entityName);

        // Filter by type if specified
        if (type && entityType !== type) continue;

        const entity: ExtractedEntity = {
          id: r.memory.id,
          name: entityName,
          type: entityType as ExtractedEntity['type'],
          confidence: r.score || 0.5,
          mentions: 1,
          firstSeen: r.memory.createdAt || new Date().toISOString(),
          lastSeen: r.memory.createdAt || new Date().toISOString(),
          metadata: r.memory.metadata,
        };

        entityResults.push({
          entity,
          relationships: [], // Would be populated from Zep edge data
          relatedEntities: [],
        });
      }

      return entityResults.slice(0, limit);
    } catch (error) {
      console.error('[ExtendedMemory] Entity search failed:', error);
      return [];
    }
  }

  /**
   * Extract primary entity name from text
   */
  private extractEntityFromText(text: string): string | null {
    // Try to find the first capitalized proper noun
    const match = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/);
    return match ? match[0] : null;
  }

  /**
   * Get relationship graph for an entity
   */
  async getEntityGraph(
    agentId: AgentId,
    entityName: string,
    depth: number = 1
  ): Promise<RelationshipGraph> {
    await this.initialize();

    const entities: ExtractedEntity[] = [];
    const relationships: ExtractedRelationship[] = [];
    const processedIds = new Set<string>();

    try {
      const { searchAgentMemory } = await import('./zep');

      // Search for memories mentioning this entity
      const results = await searchAgentMemory(agentId, entityName, 50);

      for (const r of results) {
        if (processedIds.has(r.memory.id)) continue;
        processedIds.add(r.memory.id);

        // Extract entities mentioned in this memory
        const localEntities = this.quickEntityExtract(r.memory.text);

        for (const entityStr of localEntities) {
          const [type, name] = entityStr.split(':');
          if (!name) continue;

          const entityId = `${type}_${name.replace(/\s+/g, '_').toLowerCase()}`;

          if (!entities.find(e => e.id === entityId)) {
            entities.push({
              id: entityId,
              name,
              type: type as ExtractedEntity['type'],
              confidence: r.score || 0.5,
              mentions: 1,
              firstSeen: r.memory.createdAt || new Date().toISOString(),
              lastSeen: r.memory.createdAt || new Date().toISOString(),
            });
          }

          // Create relationship if this isn't the source entity
          if (name.toLowerCase() !== entityName.toLowerCase()) {
            const sourceId = `search_${entityName.replace(/\s+/g, '_').toLowerCase()}`;
            relationships.push({
              id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              sourceEntityId: sourceId,
              targetEntityId: entityId,
              type: 'mentioned_with',
              confidence: r.score || 0.5,
              context: r.memory.text.substring(0, 200),
              timestamp: r.memory.createdAt || new Date().toISOString(),
            });
          }
        }
      }

      return {
        entities,
        relationships,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ExtendedMemory] Get entity graph failed:', error);
      return { entities: [], relationships: [], lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Find connections between two entities
   */
  async findEntityConnections(
    agentId: AgentId,
    entity1: string,
    entity2: string
  ): Promise<{ connected: boolean; path: string[]; evidence: string[] }> {
    await this.initialize();

    try {
      const { searchAgentMemory } = await import('./zep');

      // Search for memories mentioning both entities
      const combinedQuery = `${entity1} ${entity2}`;
      const results = await searchAgentMemory(agentId, combinedQuery, 20);

      const evidence: string[] = [];
      let connected = false;

      for (const r of results) {
        const text = r.memory.text.toLowerCase();
        if (text.includes(entity1.toLowerCase()) && text.includes(entity2.toLowerCase())) {
          connected = true;
          evidence.push(r.memory.text.substring(0, 300));
        }
      }

      return {
        connected,
        path: connected ? [entity1, entity2] : [],
        evidence: evidence.slice(0, 5),
      };
    } catch (error) {
      console.error('[ExtendedMemory] Find entity connections failed:', error);
      return { connected: false, path: [], evidence: [] };
    }
  }

  /**
   * Get temporal view of entity mentions
   */
  async getEntityTimeline(
    agentId: AgentId,
    entityName: string,
    days: number = 30
  ): Promise<{ date: string; mentions: number; context: string }[]> {
    await this.initialize();

    const timeline: Map<string, { count: number; contexts: string[] }> = new Map();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    try {
      const { searchAgentMemory } = await import('./zep');
      const results = await searchAgentMemory(agentId, entityName, 100);

      for (const r of results) {
        const createdAt = r.memory.createdAt ? new Date(r.memory.createdAt) : new Date();
        if (createdAt < cutoff) continue;

        const dateKey = createdAt.toISOString().split('T')[0];
        const existing = timeline.get(dateKey) || { count: 0, contexts: [] };
        existing.count++;
        if (existing.contexts.length < 3) {
          existing.contexts.push(r.memory.text.substring(0, 100));
        }
        timeline.set(dateKey, existing);
      }

      return Array.from(timeline.entries())
        .map(([date, data]) => ({
          date,
          mentions: data.count,
          context: data.contexts.join(' | '),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('[ExtendedMemory] Get entity timeline failed:', error);
      return [];
    }
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
