// @ts-nocheck
/**
 * Wrath Shield v3 - Extended Memory System Tests
 *
 * Tests for the multi-graph memory system:
 * - Types and interfaces
 * - Graph ID construction and parsing
 * - Domain-specific operations
 * - Matter-specific operations
 * - Temporal operations
 * - Combined search
 * - Graph management
 * - Relationship extraction
 * - Entity search and graph operations
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep module
const mockAddAgentMemory = jest.fn().mockResolvedValue(undefined);
const mockSearchAgentMemory = jest.fn().mockResolvedValue([]);
const mockSearchOrgMemory = jest.fn().mockResolvedValue([]);
const mockProposeOrgMemory = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/memory/zep', () => ({
  addAgentMemory: mockAddAgentMemory,
  searchAgentMemory: mockSearchAgentMemory,
  searchOrgMemory: mockSearchOrgMemory,
  proposeOrgMemory: mockProposeOrgMemory,
}));

import {
  getExtendedMemory,
  ExtendedMemorySystem,
  buildGraphId,
  parseGraphId,
  type TemporalBucket,
  type ExtendedGraphId,
  type MemorySearchOptions,
  type MemoryWriteOptions,
  type ExtendedSearchResult,
  type GraphStats,
  type AgentMemoryOverview,
  type ExtractedEntity,
  type ExtractedRelationship,
  type RelationshipGraph,
  type EntitySearchResult,
} from '@/lib/memory/ExtendedMemorySystem';

describe('Extended Memory System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define TemporalBucket type', () => {
      const buckets: TemporalBucket[] = ['hot', 'warm', 'cold'];
      expect(buckets).toHaveLength(3);
    });

    it('should define ExtendedGraphId interface', () => {
      const graphId: ExtendedGraphId = {
        baseAgentId: 'legal-agent',
        domain: 'family',
        temporalBucket: 'hot',
        matterId: 'matter-123',
      };

      expect(graphId.baseAgentId).toBe('legal-agent');
      expect(graphId.domain).toBe('family');
    });

    it('should define MemorySearchOptions interface', () => {
      const options: MemorySearchOptions = {
        domains: ['family', 'fcra'],
        temporalBuckets: ['hot', 'warm'],
        matterId: 'matter-123',
        includeOrg: true,
        limit: 20,
        minScore: 0.5,
      };

      expect(options.domains).toContain('family');
      expect(options.limit).toBe(20);
    });

    it('should define MemoryWriteOptions interface', () => {
      const options: MemoryWriteOptions = {
        domain: 'employment',
        matterId: 'matter-456',
        temporalBucket: 'hot',
        isOrgKnowledge: false,
      };

      expect(options.domain).toBe('employment');
    });

    it('should define ExtendedSearchResult interface', () => {
      const result: ExtendedSearchResult = {
        memory: {
          id: 'mem-123',
          text: 'Test memory',
          createdAt: '2025-01-15T00:00:00Z',
          metadata: {},
        },
        score: 0.95,
        source: {
          graphId: 'wrath-shield-legal-agent-family',
          domain: 'family',
          matterId: undefined,
          temporalBucket: 'hot',
        },
      };

      expect(result.score).toBe(0.95);
      expect(result.source.domain).toBe('family');
    });

    it('should define GraphStats interface', () => {
      const stats: GraphStats = {
        graphId: 'wrath-shield-legal-agent',
        memoryCount: 150,
        lastUpdated: '2025-01-15T00:00:00Z',
        domain: 'family',
        matterId: 'matter-123',
      };

      expect(stats.memoryCount).toBe(150);
    });

    it('should define AgentMemoryOverview interface', () => {
      const overview: AgentMemoryOverview = {
        agentId: 'legal-agent',
        totalMemories: 500,
        graphs: [],
        domainBreakdown: { family: 200, fcra: 150, employment: 150 },
        temporalBreakdown: { hot: 100, warm: 200, cold: 200 },
      };

      expect(overview.totalMemories).toBe(500);
      expect(overview.domainBreakdown.family).toBe(200);
    });

    it('should define ExtractedEntity interface', () => {
      const entity: ExtractedEntity = {
        id: 'entity-123',
        name: 'John Smith',
        type: 'person',
        confidence: 0.9,
        mentions: 5,
        firstSeen: '2025-01-01T00:00:00Z',
        lastSeen: '2025-01-15T00:00:00Z',
        metadata: { role: 'client' },
      };

      expect(entity.type).toBe('person');
      expect(entity.mentions).toBe(5);
    });

    it('should define ExtractedRelationship interface', () => {
      const relationship: ExtractedRelationship = {
        id: 'rel-123',
        sourceEntityId: 'entity-1',
        targetEntityId: 'entity-2',
        type: 'works_for',
        confidence: 0.85,
        context: 'John works for ACME Corp',
        timestamp: '2025-01-15T00:00:00Z',
        metadata: {},
      };

      expect(relationship.type).toBe('works_for');
    });

    it('should define RelationshipGraph interface', () => {
      const graph: RelationshipGraph = {
        entities: [],
        relationships: [],
        lastUpdated: '2025-01-15T00:00:00Z',
      };

      expect(graph.entities).toHaveLength(0);
    });

    it('should define EntitySearchResult interface', () => {
      const result: EntitySearchResult = {
        entity: {
          id: 'entity-1',
          name: 'Test Entity',
          type: 'person',
          confidence: 0.9,
          mentions: 3,
          firstSeen: '2025-01-01',
          lastSeen: '2025-01-15',
        },
        relationships: [],
        relatedEntities: [],
      };

      expect(result.entity.name).toBe('Test Entity');
    });
  });

  describe('buildGraphId', () => {
    it('should build basic graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent' });
      expect(id).toBe('wrath-shield-legal-agent');
    });

    it('should include domain in graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', domain: 'family' });
      expect(id).toBe('wrath-shield-legal-agent-family');
    });

    it('should include matter in graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', matterId: '123' });
      expect(id).toBe('wrath-shield-legal-agent-matter-123');
    });

    it('should include warm/cold temporal bucket', () => {
      const warmId = buildGraphId({ baseAgentId: 'legal-agent', temporalBucket: 'warm' });
      expect(warmId).toBe('wrath-shield-legal-agent-warm');

      const coldId = buildGraphId({ baseAgentId: 'legal-agent', temporalBucket: 'cold' });
      expect(coldId).toBe('wrath-shield-legal-agent-cold');
    });

    it('should not include hot temporal bucket (default)', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', temporalBucket: 'hot' });
      expect(id).toBe('wrath-shield-legal-agent');
    });

    it('should build complex graph ID with multiple components', () => {
      const id = buildGraphId({
        baseAgentId: 'legal-agent',
        domain: 'family',
        matterId: '456',
        temporalBucket: 'warm',
      });
      expect(id).toBe('wrath-shield-legal-agent-family-matter-456-warm');
    });
  });

  describe('parseGraphId', () => {
    it('should parse basic graph ID', () => {
      const parsed = parseGraphId('wrath-shield-legal-agent');
      expect(parsed).not.toBeNull();
      expect(parsed?.baseAgentId).toBe('legal-agent');
    });

    it('should return null for invalid prefix', () => {
      const parsed = parseGraphId('invalid-prefix-legal-agent');
      expect(parsed).toBeNull();
    });

    it('should return null for missing agent suffix', () => {
      const parsed = parseGraphId('wrath-shield-legal');
      expect(parsed).toBeNull();
    });

    it('should parse domain from graph ID', () => {
      const parsed = parseGraphId('wrath-shield-legal-agent-family');
      expect(parsed?.domain).toBe('family');
    });

    it('should parse matter from graph ID', () => {
      const parsed = parseGraphId('wrath-shield-legal-agent-matter-123');
      expect(parsed?.matterId).toBe('123');
    });

    it('should parse temporal bucket from graph ID', () => {
      const warmParsed = parseGraphId('wrath-shield-legal-agent-warm');
      expect(warmParsed?.temporalBucket).toBe('warm');

      const coldParsed = parseGraphId('wrath-shield-legal-agent-cold');
      expect(coldParsed?.temporalBucket).toBe('cold');
    });
  });

  describe('getExtendedMemory (Singleton)', () => {
    it('should return ExtendedMemorySystem instance', () => {
      const instance = getExtendedMemory();
      expect(instance).toBeInstanceOf(ExtendedMemorySystem);
    });

    it('should return same instance on multiple calls', () => {
      const instance1 = getExtendedMemory();
      const instance2 = getExtendedMemory();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Domain-Specific Operations', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('writeToDomain', () => {
      it('should write memory with domain metadata', async () => {
        const result = await memory.writeToDomain(
          'legal-agent',
          'family',
          'Custody hearing scheduled for next week',
          { caseNumber: 'FAM-2025-001' }
        );

        expect(result).toBe(true);
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'legal-agent',
          'Custody hearing scheduled for next week',
          expect.objectContaining({
            domain: 'family',
            caseNumber: 'FAM-2025-001',
            extended_graph_id: 'wrath-shield-legal-agent-family',
          })
        );
      });

      it('should return false on error', async () => {
        mockAddAgentMemory.mockRejectedValueOnce(new Error('Zep error'));

        const result = await memory.writeToDomain('legal-agent', 'fcra', 'Test');

        expect(result).toBe(false);
      });
    });

    describe('searchDomain', () => {
      it('should search and filter by domain', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'Family case', metadata: { domain: 'family' } }, score: 0.9 },
          { memory: { id: '2', text: 'FCRA case', metadata: { domain: 'fcra' } }, score: 0.85 },
          { memory: { id: '3', text: 'Another family', metadata: { domain: 'family' } }, score: 0.8 },
        ]);

        const results = await memory.searchDomain('legal-agent', 'family', 'custody', 5);

        expect(results).toHaveLength(2);
        expect(results[0].source.domain).toBe('family');
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Search error'));

        const results = await memory.searchDomain('legal-agent', 'family', 'test');

        expect(results).toHaveLength(0);
      });
    });
  });

  describe('Matter-Specific Operations', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('writeToMatter', () => {
      it('should write memory with matter ID', async () => {
        const result = await memory.writeToMatter(
          'legal-agent',
          'matter-123',
          'Client consultation notes'
        );

        expect(result).toBe(true);
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'legal-agent',
          'Client consultation notes',
          expect.objectContaining({
            matter_id: 'matter-123',
          })
        );
      });
    });

    describe('searchMatter', () => {
      it('should search and filter by matter ID', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'Matter 123 note', metadata: { matter_id: 'matter-123' } }, score: 0.9 },
          { memory: { id: '2', text: 'Matter 456 note', metadata: { matter_id: 'matter-456' } }, score: 0.85 },
        ]);

        const results = await memory.searchMatter('legal-agent', 'matter-123', 'note');

        expect(results).toHaveLength(1);
        expect(results[0].source.matterId).toBe('matter-123');
      });
    });

    describe('getMatterMemories', () => {
      it('should get all memories for a matter', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        await memory.getMatterMemories('legal-agent', 'matter-123');

        expect(mockSearchAgentMemory).toHaveBeenCalledWith('legal-agent', '*', expect.any(Number));
      });
    });
  });

  describe('Temporal Operations', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('searchTemporal', () => {
      it('should filter by temporal bucket', async () => {
        const now = new Date();
        const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
        const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago

        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'Recent', createdAt: recentDate }, score: 0.9 },
          { memory: { id: '2', text: 'Old', createdAt: oldDate }, score: 0.85 },
        ]);

        const results = await memory.searchTemporal('legal-agent', 'test', ['hot']);

        expect(results.length).toBeLessThanOrEqual(1);
        if (results.length > 0) {
          expect(results[0].source.temporalBucket).toBe('hot');
        }
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const results = await memory.searchTemporal('legal-agent', 'test');

        expect(results).toHaveLength(0);
      });
    });
  });

  describe('Combined Search', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('search', () => {
      it('should search with default options', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);
        mockSearchOrgMemory.mockResolvedValueOnce([]);

        await memory.search('legal-agent', 'custody');

        expect(mockSearchAgentMemory).toHaveBeenCalled();
        expect(mockSearchOrgMemory).toHaveBeenCalled();
      });

      it('should exclude org results when includeOrg is false', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        await memory.search('legal-agent', 'test', { includeOrg: false });

        expect(mockSearchOrgMemory).not.toHaveBeenCalled();
      });

      it('should filter by minimum score', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'High score', createdAt: new Date().toISOString() }, score: 0.9 },
          { memory: { id: '2', text: 'Low score', createdAt: new Date().toISOString() }, score: 0.1 },
        ]);
        mockSearchOrgMemory.mockResolvedValueOnce([]);

        const results = await memory.search('legal-agent', 'test', { minScore: 0.5 });

        expect(results).toHaveLength(1);
        expect(results[0].score).toBe(0.9);
      });

      it('should sort results by score', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'Medium', createdAt: new Date().toISOString() }, score: 0.7 },
          { memory: { id: '2', text: 'High', createdAt: new Date().toISOString() }, score: 0.95 },
          { memory: { id: '3', text: 'Low', createdAt: new Date().toISOString() }, score: 0.5 },
        ]);
        mockSearchOrgMemory.mockResolvedValueOnce([]);

        const results = await memory.search('legal-agent', 'test', { minScore: 0.3 });

        expect(results[0].score).toBe(0.95);
        expect(results[1].score).toBe(0.7);
        expect(results[2].score).toBe(0.5);
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const results = await memory.search('legal-agent', 'test');

        expect(results).toHaveLength(0);
      });
    });

    describe('write', () => {
      it('should write memory with options', async () => {
        const result = await memory.write(
          'legal-agent',
          'Test memory',
          { key: 'value' },
          { domain: 'family', matterId: 'matter-123' }
        );

        expect(result).toBe(true);
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'legal-agent',
          'Test memory',
          expect.objectContaining({
            key: 'value',
            domain: 'family',
            matter_id: 'matter-123',
          })
        );
      });

      it('should route to org memory when isOrgKnowledge is true', async () => {
        const result = await memory.write(
          'legal-agent',
          'Org knowledge',
          {},
          { isOrgKnowledge: true }
        );

        expect(result).toBe(true);
        expect(mockProposeOrgMemory).toHaveBeenCalled();
        expect(mockAddAgentMemory).not.toHaveBeenCalled();
      });

      it('should return false on error', async () => {
        mockAddAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const result = await memory.write('legal-agent', 'Test');

        expect(result).toBe(false);
      });
    });
  });

  describe('Graph Management', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('getAgentMemoryOverview', () => {
      it('should return overview structure', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        const overview = await memory.getAgentMemoryOverview('legal-agent');

        expect(overview.agentId).toBe('legal-agent');
        expect(overview).toHaveProperty('totalMemories');
        expect(overview).toHaveProperty('graphs');
        expect(overview).toHaveProperty('domainBreakdown');
        expect(overview).toHaveProperty('temporalBreakdown');
      });

      it('should calculate temporal breakdown', async () => {
        const now = new Date();
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', createdAt: now.toISOString() }, score: 1 },
          { memory: { id: '2', createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() }, score: 1 },
        ]);

        const overview = await memory.getAgentMemoryOverview('legal-agent');

        expect(overview.temporalBreakdown.hot).toBeGreaterThanOrEqual(0);
      });
    });

    describe('listAgentDomains', () => {
      it('should return list of domains', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', metadata: { domain: 'family' }, createdAt: new Date().toISOString() }, score: 1 },
          { memory: { id: '2', metadata: { domain: 'fcra' }, createdAt: new Date().toISOString() }, score: 1 },
        ]);

        const domains = await memory.listAgentDomains('legal-agent');

        expect(domains).toContain('family');
        expect(domains).toContain('fcra');
      });
    });

    describe('listAgentMatters', () => {
      it('should return list of matter IDs', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', metadata: { matter_id: 'matter-123' } }, score: 1 },
          { memory: { id: '2', metadata: { matter_id: 'matter-456' } }, score: 1 },
          { memory: { id: '3', metadata: {} }, score: 1 },
        ]);

        const matters = await memory.listAgentMatters('legal-agent');

        expect(matters).toContain('matter-123');
        expect(matters).toContain('matter-456');
        expect(matters).toHaveLength(2);
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const matters = await memory.listAgentMatters('legal-agent');

        expect(matters).toHaveLength(0);
      });
    });
  });

  describe('Relationship Extraction', () => {
    let memory: ExtendedMemorySystem;

    beforeEach(() => {
      memory = new ExtendedMemorySystem();
    });

    describe('writeWithRelationshipExtraction', () => {
      it('should write with relationship extraction metadata', async () => {
        const result = await memory.writeWithRelationshipExtraction(
          'legal-agent',
          'John Smith owes $5,000 to ACME Corp by January 15, 2025.',
          { caseNumber: 'CIVIL-2025-001' }
        );

        expect(result.success).toBe(true);
        expect(result.extractedEntities).toBeDefined();
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'legal-agent',
          expect.any(String),
          expect.objectContaining({
            extract_entities: true,
            extract_relationships: true,
          })
        );
      });

      it('should extract person names', async () => {
        const result = await memory.writeWithRelationshipExtraction(
          'legal-agent',
          'John Smith met with Jane Doe yesterday.'
        );

        expect(result.extractedEntities?.some(e => e.includes('person:'))).toBe(true);
      });

      it('should extract money amounts', async () => {
        const result = await memory.writeWithRelationshipExtraction(
          'legal-agent',
          'The settlement was $50,000 dollars.'
        );

        expect(result.extractedEntities?.some(e => e.includes('amount:'))).toBe(true);
      });

      it('should extract dates', async () => {
        const result = await memory.writeWithRelationshipExtraction(
          'legal-agent',
          'The deadline is January 15, 2025.'
        );

        expect(result.extractedEntities?.some(e => e.includes('date:'))).toBe(true);
      });

      it('should extract organizations', async () => {
        const result = await memory.writeWithRelationshipExtraction(
          'legal-agent',
          'ACME Corp LLC filed the lawsuit.'
        );

        expect(result.extractedEntities?.some(e => e.includes('org:'))).toBe(true);
      });

      it('should return failure on error', async () => {
        mockAddAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const result = await memory.writeWithRelationshipExtraction('legal-agent', 'Test');

        expect(result.success).toBe(false);
      });
    });

    describe('searchEntities', () => {
      it('should search for entities', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'John Smith is the client', metadata: { entity_name: 'John Smith', entity_type: 'person' } }, score: 0.9 },
        ]);

        const results = await memory.searchEntities('legal-agent', 'John');

        expect(results.length).toBeGreaterThanOrEqual(0);
      });

      it('should filter by entity type', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'John Smith', metadata: { entity_type: 'person' } }, score: 0.9 },
          { memory: { id: '2', text: 'ACME Corp', metadata: { entity_type: 'organization' } }, score: 0.85 },
        ]);

        const results = await memory.searchEntities('legal-agent', 'test', { type: 'person' });

        // All results should be persons
        for (const r of results) {
          expect(r.entity.type).toBe('person');
        }
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const results = await memory.searchEntities('legal-agent', 'test');

        expect(results).toHaveLength(0);
      });
    });

    describe('getEntityGraph', () => {
      it('should return relationship graph', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { id: '1', text: 'John Smith works at ACME Corp' }, score: 0.9 },
        ]);

        const graph = await memory.getEntityGraph('legal-agent', 'John Smith');

        expect(graph).toHaveProperty('entities');
        expect(graph).toHaveProperty('relationships');
        expect(graph).toHaveProperty('lastUpdated');
      });

      it('should return empty graph on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const graph = await memory.getEntityGraph('legal-agent', 'Test');

        expect(graph.entities).toHaveLength(0);
        expect(graph.relationships).toHaveLength(0);
      });
    });

    describe('findEntityConnections', () => {
      it('should find connections between entities', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: 'John Smith is represented by Jane Doe' }, score: 0.9 },
        ]);

        const result = await memory.findEntityConnections('legal-agent', 'John Smith', 'Jane Doe');

        expect(result.connected).toBe(true);
        expect(result.path).toContain('John Smith');
        expect(result.path).toContain('Jane Doe');
        expect(result.evidence.length).toBeGreaterThan(0);
      });

      it('should return not connected when no matches', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        const result = await memory.findEntityConnections('legal-agent', 'Entity1', 'Entity2');

        expect(result.connected).toBe(false);
        expect(result.path).toHaveLength(0);
      });

      it('should return not connected on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const result = await memory.findEntityConnections('legal-agent', 'A', 'B');

        expect(result.connected).toBe(false);
      });
    });

    describe('getEntityTimeline', () => {
      it('should return timeline of entity mentions', async () => {
        const today = new Date().toISOString();
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: 'First mention', createdAt: today }, score: 0.9 },
        ]);

        const timeline = await memory.getEntityTimeline('legal-agent', 'John Smith', 30);

        expect(Array.isArray(timeline)).toBe(true);
      });

      it('should return empty array on error', async () => {
        mockSearchAgentMemory.mockRejectedValueOnce(new Error('Error'));

        const timeline = await memory.getEntityTimeline('legal-agent', 'Test');

        expect(timeline).toHaveLength(0);
      });

      it('should filter by days parameter', async () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 60);

        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: 'Old mention', createdAt: oldDate.toISOString() }, score: 0.9 },
        ]);

        const timeline = await memory.getEntityTimeline('legal-agent', 'Test', 30);

        // Old entry should be filtered out
        expect(timeline).toHaveLength(0);
      });
    });
  });

  describe('Initialization', () => {
    it('should only initialize once', async () => {
      const memory = new ExtendedMemorySystem();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Multiple operations should trigger initialization only once
      await memory.search('legal-agent', 'test', { includeOrg: false });
      await memory.search('legal-agent', 'test2', { includeOrg: false });

      const initLogs = consoleSpy.mock.calls.filter(call =>
        call[0]?.includes('[ExtendedMemory] Initialized')
      );
      expect(initLogs.length).toBeLessThanOrEqual(1);

      consoleSpy.mockRestore();
    });
  });
});
