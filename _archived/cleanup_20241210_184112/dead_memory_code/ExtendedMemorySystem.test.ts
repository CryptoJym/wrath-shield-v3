/**
 * Extended Memory System Tests
 *
 * Tests the multi-graph memory architecture.
 */

import {
  getExtendedMemory,
  buildGraphId,
  parseGraphId,
  type ExtendedGraphId,
} from '@/lib/memory/ExtendedMemorySystem';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep
const mockSearchAgentMemory = jest.fn();
const mockAddAgentMemory = jest.fn();
const mockSearchOrgMemory = jest.fn();
const mockProposeOrgMemory = jest.fn();

jest.mock('@/lib/memory/zep', () => ({
  searchAgentMemory: (...args: any[]) => mockSearchAgentMemory(...args),
  addAgentMemory: (...args: any[]) => mockAddAgentMemory(...args),
  searchOrgMemory: (...args: any[]) => mockSearchOrgMemory(...args),
  proposeOrgMemory: (...args: any[]) => mockProposeOrgMemory(...args),
}));

describe('ExtendedMemorySystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchAgentMemory.mockResolvedValue([]);
    mockAddAgentMemory.mockResolvedValue(undefined);
    mockSearchOrgMemory.mockResolvedValue([]);
    mockProposeOrgMemory.mockResolvedValue({ id: 'proposal_123' });
  });

  describe('Graph ID Construction', () => {
    it('should build basic agent graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent' });
      expect(id).toBe('wrath-shield-legal-agent');
    });

    it('should build domain-specific graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', domain: 'family' });
      expect(id).toBe('wrath-shield-legal-agent-family');
    });

    it('should build matter-specific graph ID', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', matterId: '12345' });
      expect(id).toBe('wrath-shield-legal-agent-matter-12345');
    });

    it('should build combined graph ID', () => {
      const id = buildGraphId({
        baseAgentId: 'legal-agent',
        domain: 'fcra',
        matterId: '67890',
      });
      expect(id).toBe('wrath-shield-legal-agent-fcra-matter-67890');
    });

    it('should include temporal bucket for non-hot', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', temporalBucket: 'cold' });
      expect(id).toBe('wrath-shield-legal-agent-cold');
    });

    it('should not include hot bucket (default)', () => {
      const id = buildGraphId({ baseAgentId: 'legal-agent', temporalBucket: 'hot' });
      expect(id).toBe('wrath-shield-legal-agent');
    });
  });

  describe('Graph ID Parsing', () => {
    it('should parse basic agent graph ID', () => {
      const result = parseGraphId('wrath-shield-legal-agent');
      expect(result).not.toBeNull();
      expect(result?.baseAgentId).toBe('legal-agent');
    });

    it('should return null for invalid graph ID', () => {
      const result = parseGraphId('invalid-graph-id');
      expect(result).toBeNull();
    });

    it('should return null for non-wrath-shield prefix', () => {
      const result = parseGraphId('other-prefix-legal-agent');
      expect(result).toBeNull();
    });
  });

  describe('Domain-Specific Operations', () => {
    it('should write to domain-specific location', async () => {
      const memory = getExtendedMemory();

      await memory.writeToDomain('legal-agent', 'family', 'Test memory', { caseId: '123' });

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'legal-agent',
        'Test memory',
        expect.objectContaining({
          domain: 'family',
          caseId: '123',
        })
      );
    });

    it('should search domain-specific memories', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'Family law memory', metadata: { domain: 'family' } },
          score: 0.9,
        },
        {
          memory: { id: '2', text: 'Other memory', metadata: { domain: 'fcra' } },
          score: 0.8,
        },
      ]);

      const results = await memory.searchDomain('legal-agent', 'family', 'test query');

      expect(results.length).toBe(1);
      expect(results[0].memory.metadata?.domain).toBe('family');
    });

    it('should include source information in results', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'Memory', metadata: { domain: 'fcra' } },
          score: 0.9,
        },
      ]);

      const results = await memory.searchDomain('legal-agent', 'fcra', 'test');

      expect(results[0].source).toBeDefined();
      expect(results[0].source.domain).toBe('fcra');
    });
  });

  describe('Matter-Specific Operations', () => {
    it('should write to matter-specific location', async () => {
      const memory = getExtendedMemory();

      await memory.writeToMatter('legal-agent', 'matter_abc', 'Case note');

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'legal-agent',
        'Case note',
        expect.objectContaining({
          matter_id: 'matter_abc',
        })
      );
    });

    it('should search matter-specific memories', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'Matter note', metadata: { matter_id: 'matter_abc' } },
          score: 0.9,
        },
        {
          memory: { id: '2', text: 'Other note', metadata: { matter_id: 'matter_xyz' } },
          score: 0.8,
        },
      ]);

      const results = await memory.searchMatter('legal-agent', 'matter_abc', 'test');

      expect(results.length).toBe(1);
      expect(results[0].memory.metadata?.matter_id).toBe('matter_abc');
    });

    it('should get all memories for a matter', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'Note 1', metadata: { matter_id: 'matter_abc' } },
          score: 0.9,
        },
      ]);

      const results = await memory.getMatterMemories('legal-agent', 'matter_abc');

      expect(mockSearchAgentMemory).toHaveBeenCalledWith('legal-agent', '*', expect.any(Number));
    });
  });

  describe('Temporal Operations', () => {
    it('should search with temporal filtering', async () => {
      const memory = getExtendedMemory();
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'Recent', createdAt: recentDate.toISOString() },
          score: 0.9,
        },
        {
          memory: { id: '2', text: 'Old', createdAt: oldDate.toISOString() },
          score: 0.8,
        },
      ]);

      const results = await memory.searchTemporal('legal-agent', 'test', ['hot']);

      expect(results.length).toBe(1);
      expect(results[0].source.temporalBucket).toBe('hot');
    });

    it('should correctly bucket memories by age', async () => {
      const memory = getExtendedMemory();
      const now = new Date();
      const hotDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days
      const warmDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days
      const coldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days

      mockSearchAgentMemory.mockResolvedValue([
        { memory: { id: '1', text: 'Hot', createdAt: hotDate.toISOString() }, score: 0.9 },
        { memory: { id: '2', text: 'Warm', createdAt: warmDate.toISOString() }, score: 0.8 },
        { memory: { id: '3', text: 'Cold', createdAt: coldDate.toISOString() }, score: 0.7 },
      ]);

      const results = await memory.searchTemporal('legal-agent', 'test', ['hot', 'warm', 'cold']);

      expect(results.length).toBe(3);
      expect(results.find((r) => r.source.temporalBucket === 'hot')).toBeDefined();
      expect(results.find((r) => r.source.temporalBucket === 'warm')).toBeDefined();
      expect(results.find((r) => r.source.temporalBucket === 'cold')).toBeDefined();
    });
  });

  describe('Combined Search', () => {
    it('should search with multiple options', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: {
            id: '1',
            text: 'Memory',
            createdAt: new Date().toISOString(),
            metadata: { domain: 'family' },
          },
          score: 0.9,
        },
      ]);

      mockSearchOrgMemory.mockResolvedValue([
        { memory: { id: 'org1', text: 'Org memory' }, score: 0.8 },
      ]);

      const results = await memory.search('legal-agent', 'test', {
        domains: ['family'],
        includeOrg: true,
        limit: 5,
      });

      expect(mockSearchAgentMemory).toHaveBeenCalled();
      expect(mockSearchOrgMemory).toHaveBeenCalled();
    });

    it('should filter by minimum score', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: { id: '1', text: 'High score', createdAt: new Date().toISOString() },
          score: 0.9,
        },
        {
          memory: { id: '2', text: 'Low score', createdAt: new Date().toISOString() },
          score: 0.2,
        },
      ]);

      const results = await memory.search('legal-agent', 'test', {
        minScore: 0.5,
      });

      expect(results.length).toBe(1);
      expect(results[0].score).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Write Operations', () => {
    it('should write with options', async () => {
      const memory = getExtendedMemory();

      await memory.write('legal-agent', 'Test text', { key: 'value' }, { domain: 'family' });

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'legal-agent',
        'Test text',
        expect.objectContaining({
          key: 'value',
          domain: 'family',
        })
      );
    });

    it('should route org knowledge to proposal', async () => {
      const memory = getExtendedMemory();

      await memory.write('legal-agent', 'Org knowledge', {}, { isOrgKnowledge: true });

      expect(mockProposeOrgMemory).toHaveBeenCalledWith('legal-agent', 'Org knowledge', {});
    });
  });

  describe('Agent Memory Overview', () => {
    it('should provide overview of agent memories', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        {
          memory: {
            id: '1',
            text: 'Memory 1',
            createdAt: new Date().toISOString(),
            metadata: { domain: 'family' },
          },
        },
        {
          memory: {
            id: '2',
            text: 'Memory 2',
            createdAt: new Date().toISOString(),
            metadata: { domain: 'fcra' },
          },
        },
      ]);

      const overview = await memory.getAgentMemoryOverview('legal-agent');

      expect(overview.agentId).toBe('legal-agent');
      expect(overview.totalMemories).toBeGreaterThan(0);
      expect(overview.temporalBreakdown.hot).toBeGreaterThan(0);
    });

    it('should list agent domains', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        { memory: { id: '1', text: 'M1', metadata: { domain: 'family' } } },
        { memory: { id: '2', text: 'M2', metadata: { domain: 'fcra' } } },
      ]);

      // Call getAgentMemoryOverview first to populate
      await memory.getAgentMemoryOverview('legal-agent');
      const domains = await memory.listAgentDomains('legal-agent');

      // Domains should include family and fcra
      expect(domains).toContain('family');
      expect(domains).toContain('fcra');
    });

    it('should list agent matters', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockResolvedValue([
        { memory: { id: '1', text: 'M1', metadata: { matter_id: 'matter_1' } } },
        { memory: { id: '2', text: 'M2', metadata: { matter_id: 'matter_2' } } },
        { memory: { id: '3', text: 'M3', metadata: { matter_id: 'matter_1' } } }, // Duplicate
      ]);

      const matters = await memory.listAgentMatters('legal-agent');

      expect(matters).toContain('matter_1');
      expect(matters).toContain('matter_2');
      expect(matters.length).toBe(2); // Deduplicated
    });
  });

  describe('Error Handling', () => {
    it('should handle Zep errors gracefully in write', async () => {
      const memory = getExtendedMemory();

      mockAddAgentMemory.mockRejectedValue(new Error('Zep unavailable'));

      const result = await memory.writeToDomain('legal-agent', 'family', 'Test');

      expect(result).toBe(false);
    });

    it('should handle Zep errors gracefully in search', async () => {
      const memory = getExtendedMemory();

      mockSearchAgentMemory.mockRejectedValue(new Error('Zep unavailable'));

      const results = await memory.searchDomain('legal-agent', 'family', 'test');

      expect(results).toEqual([]);
    });
  });
});
