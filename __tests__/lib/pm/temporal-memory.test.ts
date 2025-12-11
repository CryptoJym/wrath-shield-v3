// @ts-nocheck
/**
 * Wrath Shield v3 - Temporal Memory Tests
 *
 * Tests for bi-temporal fact storage (Graphiti-style):
 * - Fact recording and retrieval
 * - Valid time and transaction time tracking
 * - Entity state management
 * - Relationship tracking
 * - Historical queries
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

import {
  recordFact,
  getCurrentFact,
  queryFacts,
  getEntityHistory,
  getFactsAtTime,
  getCurrentState,
  getHistoricalState,
  recordRelationship,
  getCurrentRelationships,
  getRelationshipsAtTime,
  endRelationship,
  getTemporalStats,
  archiveOldFacts,
  type EntityType,
  type FactSource,
  type TemporalFact,
  type EntityRelationship,
  type RelationshipType,
  type FactQuery,
  type EntityState,
} from '@/lib/pm/temporal-memory';

describe('Temporal Memory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(null);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  describe('Types', () => {
    it('should define EntityType values', () => {
      const types: EntityType[] = ['task', 'project', 'person', 'decision', 'pattern', 'rule'];
      expect(types).toHaveLength(6);
    });

    it('should define FactSource values', () => {
      const sources: FactSource[] = [
        'github_webhook',
        'user_edit',
        'ai_suggestion',
        'queue_processor',
        'pattern_extraction',
        'manual',
        'system',
      ];
      expect(sources).toHaveLength(7);
    });

    it('should define TemporalFact interface', () => {
      const fact: TemporalFact = {
        id: 'fact_1234567890_abcd1234',
        entity_type: 'task',
        entity_id: 'task-123',
        valid_from: Math.floor(Date.now() / 1000),
        valid_to: null,
        recorded_at: Math.floor(Date.now() / 1000),
        attribute: 'priority',
        value: '"high"',
        previous_value: '"medium"',
        source: 'user_edit',
        source_id: 'user-1',
        confidence: 1.0,
        metadata: {},
      };

      expect(fact.entity_type).toBe('task');
      expect(fact.attribute).toBe('priority');
    });

    it('should define EntityRelationship interface', () => {
      const relationship: EntityRelationship = {
        id: 'rel_1234567890_abcd1234',
        from_entity_type: 'task',
        from_entity_id: 'task-123',
        to_entity_type: 'person',
        to_entity_id: 'user-1',
        relationship_type: 'assigned_to',
        valid_from: Math.floor(Date.now() / 1000),
        valid_to: null,
        strength: 1.0,
        metadata: {},
      };

      expect(relationship.relationship_type).toBe('assigned_to');
    });

    it('should define RelationshipType values', () => {
      const types: RelationshipType[] = [
        'assigned_to',
        'belongs_to',
        'blocks',
        'depends_on',
        'related_to',
        'created_by',
        'mentioned_in',
        'part_of',
      ];
      expect(types).toHaveLength(8);
    });

    it('should define FactQuery interface', () => {
      const query: FactQuery = {
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        valid_at: new Date(),
        recorded_after: new Date(Date.now() - 86400000),
        source: 'github_webhook',
        limit: 10,
      };

      expect(query.entity_type).toBe('task');
    });

    it('should define EntityState interface', () => {
      const state: EntityState = {
        entity_type: 'task',
        entity_id: 'task-123',
        attributes: {
          status: 'pending',
          priority: 'high',
        },
        relationships: [],
        last_updated: Math.floor(Date.now() / 1000),
      };

      expect(state.attributes.status).toBe('pending');
    });
  });

  describe('recordFact', () => {
    it('should record a temporal fact', async () => {
      mockGet.mockReturnValueOnce(null); // No previous fact

      const fact = await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: 'pending',
        source: 'github_webhook',
      });

      expect(fact.entity_type).toBe('task');
      expect(fact.attribute).toBe('status');
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO temporal_facts')
      );
    });

    it('should close previous fact on update', async () => {
      const previousFact = {
        id: 'fact_previous',
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: '"pending"',
        valid_to: null,
      };
      mockGet.mockReturnValueOnce(previousFact);

      await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: 'done',
        source: 'user_edit',
      });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE temporal_facts')
      );
    });

    it('should preserve previous value', async () => {
      const previousFact = {
        id: 'fact_previous',
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'priority',
        value: '"medium"',
        valid_to: null,
        metadata: '{}',
      };
      mockGet.mockReturnValueOnce(previousFact);

      const fact = await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'priority',
        value: 'high',
        source: 'user_edit',
      });

      expect(fact.previous_value).toBe('"medium"');
    });

    it('should use custom valid_from if provided', async () => {
      mockGet.mockReturnValueOnce(null);
      const customDate = new Date(Date.now() - 86400000); // Yesterday

      const fact = await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: 'pending',
        source: 'manual',
        valid_from: customDate,
      });

      expect(fact.valid_from).toBe(Math.floor(customDate.getTime() / 1000));
    });

    it('should set default confidence', async () => {
      mockGet.mockReturnValueOnce(null);

      const fact = await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: 'pending',
        source: 'github_webhook',
      });

      expect(fact.confidence).toBe(1.0);
    });

    it('should accept custom confidence', async () => {
      mockGet.mockReturnValueOnce(null);

      const fact = await recordFact({
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'priority',
        value: 'high',
        source: 'ai_suggestion',
        confidence: 0.8,
      });

      expect(fact.confidence).toBe(0.8);
    });
  });

  describe('getCurrentFact', () => {
    it('should return current fact for attribute', () => {
      mockGet.mockReturnValueOnce({
        id: 'fact_1234567890_abcd1234',
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: '"pending"',
        valid_to: null,
        metadata: '{}',
      });

      const fact = getCurrentFact('task', 'task-123', 'status');

      expect(fact).not.toBeNull();
      expect(fact?.attribute).toBe('status');
    });

    it('should return null when no fact exists', () => {
      mockGet.mockReturnValueOnce(undefined);

      const fact = getCurrentFact('task', 'nonexistent', 'status');

      expect(fact).toBeNull();
    });

    it('should parse metadata JSON', () => {
      mockGet.mockReturnValueOnce({
        id: 'fact_1234567890_abcd1234',
        entity_type: 'task',
        entity_id: 'task-123',
        attribute: 'status',
        value: '"pending"',
        valid_to: null,
        metadata: '{"changed_by": "user-1"}',
      });

      const fact = getCurrentFact('task', 'task-123', 'status');

      expect(fact?.metadata.changed_by).toBe('user-1');
    });
  });

  describe('queryFacts', () => {
    it('should query facts with filters', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'fact_1',
          entity_type: 'task',
          entity_id: 'task-123',
          attribute: 'status',
          value: '"pending"',
          metadata: '{}',
        },
      ]);

      const facts = queryFacts({ entity_type: 'task' });

      expect(facts).toHaveLength(1);
    });

    it('should filter by entity_id', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ entity_type: 'task', entity_id: 'task-123' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('entity_id')
      );
    });

    it('should filter by attribute', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ attribute: 'status' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('attribute')
      );
    });

    it('should filter by valid_at time', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ valid_at: new Date() });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('valid_from')
      );
    });

    it('should filter by recorded_after', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ recorded_after: new Date(Date.now() - 86400000) });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('recorded_at')
      );
    });

    it('should filter by source', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ source: 'github_webhook' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('source')
      );
    });

    it('should respect limit', () => {
      mockAll.mockReturnValueOnce([]);

      queryFacts({ limit: 10 });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });
  });

  describe('getEntityHistory', () => {
    it('should return all facts for an entity', () => {
      mockAll.mockReturnValueOnce([
        { id: 'fact_1', attribute: 'status', value: '"pending"', metadata: '{}' },
        { id: 'fact_2', attribute: 'status', value: '"done"', metadata: '{}' },
      ]);

      const history = getEntityHistory('task', 'task-123');

      expect(history).toHaveLength(2);
    });
  });

  describe('getFactsAtTime', () => {
    it('should return facts valid at a specific time', () => {
      mockAll.mockReturnValueOnce([
        { id: 'fact_1', attribute: 'status', value: '"pending"', metadata: '{}' },
      ]);

      const pastDate = new Date(Date.now() - 86400000);
      const facts = getFactsAtTime('task', 'task-123', pastDate);

      expect(Array.isArray(facts)).toBe(true);
    });
  });

  describe('getCurrentState', () => {
    it('should return current entity state', () => {
      mockAll
        .mockReturnValueOnce([
          { attribute: 'status', value: '"pending"', recorded_at: 1000 },
          { attribute: 'priority', value: '"high"', recorded_at: 1001 },
        ])
        .mockReturnValueOnce([]); // relationships

      const state = getCurrentState('task', 'task-123');

      expect(state.entity_type).toBe('task');
      expect(state.entity_id).toBe('task-123');
      expect(state.attributes.status).toBe('pending');
      expect(state.attributes.priority).toBe('high');
    });

    it('should include current relationships', () => {
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            id: 'rel_1',
            from_entity_type: 'task',
            from_entity_id: 'task-123',
            to_entity_type: 'person',
            to_entity_id: 'user-1',
            relationship_type: 'assigned_to',
            metadata: '{}',
          },
        ]);

      const state = getCurrentState('task', 'task-123');

      expect(state.relationships).toHaveLength(1);
    });

    it('should track last_updated', () => {
      mockAll
        .mockReturnValueOnce([
          { attribute: 'status', value: '"pending"', recorded_at: 1000 },
          { attribute: 'priority', value: '"high"', recorded_at: 2000 },
        ])
        .mockReturnValueOnce([]);

      const state = getCurrentState('task', 'task-123');

      expect(state.last_updated).toBe(2000);
    });
  });

  describe('getHistoricalState', () => {
    it('should return entity state at point in time', () => {
      mockAll
        .mockReturnValueOnce([
          { attribute: 'status', value: '"pending"', valid_from: 1000, metadata: '{}' },
        ])
        .mockReturnValueOnce([]);

      const pastDate = new Date(Date.now() - 86400000);
      const state = getHistoricalState('task', 'task-123', pastDate);

      expect(state.entity_type).toBe('task');
      expect(state.attributes.status).toBe('pending');
    });
  });

  describe('recordRelationship', () => {
    it('should record a new relationship', async () => {
      mockGet.mockReturnValueOnce(undefined); // No existing

      const relationship = await recordRelationship({
        from_entity_type: 'task',
        from_entity_id: 'task-123',
        to_entity_type: 'person',
        to_entity_id: 'user-1',
        relationship_type: 'assigned_to',
      });

      expect(relationship.relationship_type).toBe('assigned_to');
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entity_relationships')
      );
    });

    it('should update existing relationship strength', async () => {
      mockGet.mockReturnValueOnce({
        id: 'rel_existing',
        from_entity_type: 'task',
        from_entity_id: 'task-123',
        to_entity_type: 'person',
        to_entity_id: 'user-1',
        relationship_type: 'assigned_to',
        strength: 1.0,
        metadata: '{}',
      });

      await recordRelationship({
        from_entity_type: 'task',
        from_entity_id: 'task-123',
        to_entity_type: 'person',
        to_entity_id: 'user-1',
        relationship_type: 'assigned_to',
        strength: 0.8,
      });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE entity_relationships')
      );
    });

    it('should set default strength', async () => {
      mockGet.mockReturnValueOnce(undefined);

      const relationship = await recordRelationship({
        from_entity_type: 'task',
        from_entity_id: 'task-123',
        to_entity_type: 'project',
        to_entity_id: 'proj-1',
        relationship_type: 'belongs_to',
      });

      expect(relationship.strength).toBe(1.0);
    });
  });

  describe('getCurrentRelationships', () => {
    it('should return current relationships for entity', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'rel_1',
          from_entity_type: 'task',
          from_entity_id: 'task-123',
          to_entity_type: 'person',
          to_entity_id: 'user-1',
          relationship_type: 'assigned_to',
          valid_to: null,
          metadata: '{}',
        },
      ]);

      const relationships = getCurrentRelationships('task', 'task-123');

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationship_type).toBe('assigned_to');
    });

    it('should filter by relationship type', () => {
      mockAll.mockReturnValueOnce([]);

      getCurrentRelationships('task', 'task-123', 'assigned_to');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('relationship_type')
      );
    });
  });

  describe('getRelationshipsAtTime', () => {
    it('should return relationships valid at specific time', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'rel_1',
          from_entity_type: 'task',
          from_entity_id: 'task-123',
          to_entity_type: 'person',
          to_entity_id: 'user-1',
          relationship_type: 'assigned_to',
          metadata: '{}',
        },
      ]);

      const pastDate = new Date(Date.now() - 86400000);
      const relationships = getRelationshipsAtTime('task', 'task-123', pastDate);

      expect(Array.isArray(relationships)).toBe(true);
    });
  });

  describe('endRelationship', () => {
    it('should set valid_to on relationship', () => {
      endRelationship('rel_123');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE entity_relationships')
      );
    });

    it('should use custom end time', () => {
      const customEndTime = new Date(Date.now() - 3600000);

      endRelationship('rel_123', customEndTime);

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('getTemporalStats', () => {
    it('should return temporal memory statistics', () => {
      mockGet.mockReturnValueOnce({
        total_facts: 100,
        current_facts: 50,
        total_relationships: 30,
        current_relationships: 20,
        entities_tracked: 25,
        oldest_fact: 1000000000,
        newest_fact: Math.floor(Date.now() / 1000),
      });

      const stats = getTemporalStats();

      expect(stats).toHaveProperty('total_facts');
      expect(stats).toHaveProperty('current_facts');
      expect(stats).toHaveProperty('total_relationships');
      expect(stats).toHaveProperty('current_relationships');
      expect(stats).toHaveProperty('entities_tracked');
    });
  });

  describe('archiveOldFacts', () => {
    it('should delete old closed facts', () => {
      mockRun.mockReturnValueOnce({ changes: 10 });

      const archived = archiveOldFacts();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM temporal_facts')
      );
      expect(archived).toBe(10);
    });

    it('should use custom retention period', () => {
      mockRun.mockReturnValueOnce({ changes: 5 });

      archiveOldFacts(180); // 180 days

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('Table Creation', () => {
    it('should create temporal_facts table', () => {
      mockAll.mockReturnValue([]);

      queryFacts({});

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS temporal_facts')
      );
    });

    it('should create entity_relationships table', () => {
      mockAll.mockReturnValue([]);

      getCurrentRelationships('task', 'task-123');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS entity_relationships')
      );
    });

    it('should create indices', () => {
      mockAll.mockReturnValue([]);

      queryFacts({});

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });
});
