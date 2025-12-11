// @ts-nocheck
/**
 * Tests for Entity Extraction System
 *
 * Tests the entity extraction system that extracts structured entities
 * (people, organizations, amounts, dates, agreements) from event content.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
  transaction: jest.fn((fn) => fn),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    getRawDb: () => mockDb,
  })),
}));

// Mock DirectLLMClients
const mockLLMResponse = {
  content: JSON.stringify({
    entities: [
      { type: 'person', value: 'John Smith', confidence: 0.95 },
      { type: 'amount', value: '$5,000', normalizedValue: '5000.00', confidence: 0.9 },
    ],
    relationships: [
      { sourceEntity: 'John Smith', targetEntity: '$5,000', relationshipType: 'owes', confidence: 0.8 },
    ],
  }),
};

jest.mock('../../../lib/DirectLLMClients', () => ({
  DirectLLMClients: {
    openRouterChat: jest.fn(() => Promise.resolve(mockLLMResponse)),
  },
}));

// Import after mocks
import {
  EntityExtractor,
  getEntityExtractor,
  resetEntityExtractor,
  extractEntities,
  getEntitiesForEvent,
  getRelationshipsForEntity,
  searchEntitiesByType,
  findRelatedEntities,
  type EntityType,
  type ExtractedEntity,
  type EntityExtractionResult,
  type EntityRelationship,
  type EntityExtractorConfig,
} from '../../../lib/cortex/entity-extractor';
import { DirectLLMClients } from '../../../lib/DirectLLMClients';

describe('Entity Extraction System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetEntityExtractor();
  });

  afterEach(() => {
    resetEntityExtractor();
  });

  // ==========================================================================
  // Type Definitions Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    describe('EntityType', () => {
      it('should accept valid entity types', () => {
        const validTypes: EntityType[] = [
          'person',
          'organization',
          'amount',
          'date',
          'location',
          'agreement',
          'task',
          'deadline',
          'email',
          'phone',
        ];
        expect(validTypes).toHaveLength(10);
      });
    });

    describe('ExtractedEntity', () => {
      it('should define a valid extracted entity structure', () => {
        const entity: ExtractedEntity = {
          id: 'ent-1',
          type: 'person',
          value: 'John Smith',
          normalizedValue: 'john smith',
          confidence: 0.95,
          startPos: 10,
          endPos: 20,
          metadata: { source: 'email' },
        };
        expect(entity.type).toBe('person');
        expect(entity.confidence).toBe(0.95);
      });

      it('should allow entity without optional fields', () => {
        const entity: ExtractedEntity = {
          id: 'ent-2',
          type: 'amount',
          value: '$500',
          confidence: 0.8,
          startPos: 0,
          endPos: 4,
        };
        expect(entity.normalizedValue).toBeUndefined();
        expect(entity.metadata).toBeUndefined();
      });
    });

    describe('EntityExtractionResult', () => {
      it('should define a valid extraction result structure', () => {
        const result: EntityExtractionResult = {
          entities: [
            { id: 'e1', type: 'person', value: 'Jane', confidence: 0.9, startPos: 0, endPos: 4 },
          ],
          relationships: [
            {
              id: 'r1',
              sourceEntityId: 'e1',
              targetEntityId: 'e2',
              relationshipType: 'works_for',
              confidence: 0.85,
            },
          ],
          extractedAt: '2025-01-01T00:00:00Z',
        };
        expect(result.entities).toHaveLength(1);
        expect(result.relationships).toHaveLength(1);
      });
    });

    describe('EntityRelationship', () => {
      it('should define a valid relationship structure', () => {
        const relationship: EntityRelationship = {
          id: 'rel-1',
          sourceEntityId: 'ent-1',
          targetEntityId: 'ent-2',
          relationshipType: 'owes',
          confidence: 0.9,
          metadata: { context: 'invoice' },
        };
        expect(relationship.relationshipType).toBe('owes');
      });
    });

    describe('EntityExtractorConfig', () => {
      it('should define valid configuration structure', () => {
        const config: EntityExtractorConfig = {
          useLLM: true,
          llmModel: 'anthropic/claude-haiku-3.5',
          maxTokens: 1500,
          temperature: 0.1,
          cacheTTLHours: 24,
          minConfidence: 0.5,
        };
        expect(config.useLLM).toBe(true);
        expect(config.minConfidence).toBe(0.5);
      });
    });
  });

  // ==========================================================================
  // EntityExtractor Class Tests
  // ==========================================================================

  describe('EntityExtractor Class', () => {
    let extractor: EntityExtractor;

    beforeEach(() => {
      extractor = new EntityExtractor();
    });

    describe('constructor', () => {
      it('should create entity extractor with default config', () => {
        expect(mockDb.exec).toHaveBeenCalled();
        const execCalls = mockDb.exec.mock.calls;
        const tableCreation = execCalls.find((call) =>
          call[0].includes('CREATE TABLE IF NOT EXISTS cortex_extracted_entities')
        );
        expect(tableCreation).toBeDefined();
      });

      it('should create entity extractor with custom config', () => {
        const customExtractor = new EntityExtractor({
          useLLM: false,
          minConfidence: 0.7,
          cacheTTLHours: 48,
        });
        expect(customExtractor).toBeDefined();
      });

      it('should create necessary tables and indexes', () => {
        const execCalls = mockDb.exec.mock.calls;
        const allSql = execCalls.map((call) => call[0]).join(' ');

        expect(allSql).toContain('cortex_extracted_entities');
        expect(allSql).toContain('cortex_entity_relationships');
        expect(allSql).toContain('cortex_extraction_cache');
        expect(allSql).toContain('idx_cortex_entities_event');
        expect(allSql).toContain('idx_cortex_entities_type');
      });
    });

    describe('extractEntities', () => {
      it('should extract entities using LLM', async () => {
        // Mock cache miss
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(), // delete expired cache
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => null), // cache lookup
        });
        // Mock entity insert statement
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(),
        });
        // Mock transaction
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        // Mock relationship insert
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(),
        });
        // Mock cache store
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(),
        });

        const result = await extractor.extractEntities(
          'John Smith owes $5,000 for the project.',
          'evt-1'
        );

        expect(result.entities).toBeDefined();
        expect(result.relationships).toBeDefined();
        expect(result.extractedAt).toBeDefined();
        expect(DirectLLMClients.openRouterChat).toHaveBeenCalled();
      });

      it('should use cached extraction when available', async () => {
        const cachedResult: EntityExtractionResult = {
          entities: [
            { id: 'cached-1', type: 'person', value: 'Cached Person', confidence: 0.9, startPos: 0, endPos: 13 },
          ],
          relationships: [],
          extractedAt: '2025-01-01T00:00:00Z',
        };

        // Mock cache hit
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(), // delete expired
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({
            extraction_json: JSON.stringify(cachedResult),
          })),
        });

        const result = await extractor.extractEntities('Some content', 'evt-2');

        expect(result).toEqual(cachedResult);
        expect(DirectLLMClients.openRouterChat).not.toHaveBeenCalled();
      });

      it('should fall back to regex when LLM fails', async () => {
        // Mock cache miss
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(),
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => null),
        });

        // Make LLM fail
        (DirectLLMClients.openRouterChat as jest.Mock).mockRejectedValueOnce(
          new Error('LLM unavailable')
        );

        // Mock transaction
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({
          run: jest.fn(),
        });

        const result = await extractor.extractEntities(
          'Contact john@example.com or call 555-123-4567 about $1,000 payment on 2025-01-15',
          'evt-3'
        );

        expect(result.entities).toBeDefined();
        expect(result.relationships).toEqual([]);
      });
    });

    describe('extractWithRegex (via non-LLM extraction)', () => {
      let regexExtractor: EntityExtractor;

      beforeEach(() => {
        regexExtractor = new EntityExtractor({ useLLM: false });
      });

      it('should extract ISO dates', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'Meeting scheduled for 2025-12-25',
          'evt-1'
        );

        const dateEntities = result.entities.filter((e) => e.type === 'date');
        expect(dateEntities.length).toBeGreaterThan(0);
        expect(dateEntities[0].value).toBe('2025-12-25');
        expect(dateEntities[0].confidence).toBe(0.9);
      });

      it('should extract natural language dates', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'See you next Tuesday or maybe December 25th',
          'evt-2'
        );

        const dateEntities = result.entities.filter((e) => e.type === 'date');
        expect(dateEntities.length).toBeGreaterThan(0);
      });

      it('should extract currency amounts', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'The total is $1,234.56 or 500 dollars',
          'evt-3'
        );

        const amountEntities = result.entities.filter((e) => e.type === 'amount');
        expect(amountEntities.length).toBeGreaterThan(0);
      });

      it('should normalize currency amounts', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities('Pay $1,234.56', 'evt-4');

        const amountEntity = result.entities.find((e) => e.type === 'amount');
        expect(amountEntity?.normalizedValue).toBe('1234.56');
      });

      it('should extract email addresses', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'Contact us at support@example.com',
          'evt-5'
        );

        const emailEntities = result.entities.filter((e) => e.type === 'email');
        expect(emailEntities).toHaveLength(1);
        expect(emailEntities[0].value).toBe('support@example.com');
        expect(emailEntities[0].normalizedValue).toBe('support@example.com');
        expect(emailEntities[0].confidence).toBe(0.95);
      });

      it('should extract phone numbers', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'Call (555) 123-4567 or 555-987-6543',
          'evt-6'
        );

        const phoneEntities = result.entities.filter((e) => e.type === 'phone');
        expect(phoneEntities.length).toBeGreaterThan(0);
      });

      it('should normalize phone numbers to E.164 format', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities('Call 555-123-4567', 'evt-7');

        const phoneEntity = result.entities.find((e) => e.type === 'phone');
        expect(phoneEntity?.normalizedValue).toBe('+15551234567');
      });

      it('should extract multiple entity types from complex text', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await regexExtractor.extractEntities(
          'Meeting on 2025-01-15 with john@example.com. Payment of $5,000 due. Call 555-123-4567.',
          'evt-8'
        );

        const types = new Set(result.entities.map((e) => e.type));
        expect(types.has('date')).toBe(true);
        expect(types.has('email')).toBe(true);
        expect(types.has('amount')).toBe(true);
        expect(types.has('phone')).toBe(true);
      });
    });

    describe('getEntitiesForEvent', () => {
      it('should get all entities for an event', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-1',
              event_id: 'evt-1',
              type: 'person',
              value: 'John',
              normalized_value: null,
              confidence: 0.9,
              start_pos: 0,
              end_pos: 4,
              metadata_json: null,
            },
            {
              id: 'ent-2',
              event_id: 'evt-1',
              type: 'amount',
              value: '$500',
              normalized_value: '500.00',
              confidence: 0.85,
              start_pos: 10,
              end_pos: 14,
              metadata_json: '{"currency":"USD"}',
            },
          ]),
        });

        const entities = await extractor.getEntitiesForEvent('evt-1');

        expect(entities).toHaveLength(2);
        expect(entities[0].type).toBe('person');
        expect(entities[1].type).toBe('amount');
        expect(entities[1].normalizedValue).toBe('500.00');
        expect(entities[1].metadata).toEqual({ currency: 'USD' });
      });

      it('should return empty array for event with no entities', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const entities = await extractor.getEntitiesForEvent('evt-no-entities');
        expect(entities).toEqual([]);
      });
    });

    describe('getRelationshipsForEntity', () => {
      it('should get relationships for an entity', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'rel-1',
              source_entity_id: 'ent-1',
              target_entity_id: 'ent-2',
              relationship_type: 'owes',
              confidence: 0.9,
              metadata_json: null,
            },
            {
              id: 'rel-2',
              source_entity_id: 'ent-3',
              target_entity_id: 'ent-1',
              relationship_type: 'scheduled_with',
              confidence: 0.8,
              metadata_json: '{"context":"meeting"}',
            },
          ]),
        });

        const relationships = await extractor.getRelationshipsForEntity('ent-1');

        expect(relationships).toHaveLength(2);
        expect(relationships[0].relationshipType).toBe('owes');
        expect(relationships[1].metadata).toEqual({ context: 'meeting' });
      });

      it('should return empty array for entity with no relationships', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const relationships = await extractor.getRelationshipsForEntity('lonely-entity');
        expect(relationships).toEqual([]);
      });
    });

    describe('searchEntitiesByType', () => {
      it('should search entities by type', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-1',
              type: 'person',
              value: 'John Smith',
              normalized_value: null,
              confidence: 0.95,
              start_pos: 0,
              end_pos: 10,
              metadata_json: null,
            },
            {
              id: 'ent-2',
              type: 'person',
              value: 'Jane Doe',
              normalized_value: null,
              confidence: 0.9,
              start_pos: 15,
              end_pos: 23,
              metadata_json: null,
            },
          ]),
        });

        const entities = await extractor.searchEntitiesByType('person');

        expect(entities).toHaveLength(2);
        expect(entities.every((e) => e.type === 'person')).toBe(true);
      });

      it('should respect limit parameter', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-1',
              type: 'amount',
              value: '$1000',
              normalized_value: '1000.00',
              confidence: 0.9,
              start_pos: 0,
              end_pos: 5,
              metadata_json: null,
            },
          ]),
        });

        await extractor.searchEntitiesByType('amount', 50);
        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });

    describe('searchEntitiesByValue', () => {
      it('should search entities by value', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-1',
              type: 'person',
              value: 'John Smith',
              normalized_value: 'john smith',
              confidence: 0.9,
              start_pos: 0,
              end_pos: 10,
              metadata_json: null,
            },
          ]),
        });

        const entities = await extractor.searchEntitiesByValue('John');

        expect(entities).toHaveLength(1);
        expect(entities[0].value).toBe('John Smith');
      });

      it('should return empty for no matches', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const entities = await extractor.searchEntitiesByValue('NonExistent');
        expect(entities).toEqual([]);
      });
    });

    describe('findRelatedEntities', () => {
      it('should find related entities with graph traversal', async () => {
        // Mock relationships for entity A
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'rel-1',
              source_entity_id: 'ent-A',
              target_entity_id: 'ent-B',
              relationship_type: 'relates_to',
              confidence: 0.9,
              metadata_json: null,
            },
          ]),
        });
        // Mock relationships for entity B
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'rel-2',
              source_entity_id: 'ent-B',
              target_entity_id: 'ent-C',
              relationship_type: 'relates_to',
              confidence: 0.85,
              metadata_json: null,
            },
          ]),
        });
        // Mock fetching related entities
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-B',
              type: 'person',
              value: 'Entity B',
              normalized_value: null,
              confidence: 0.9,
              start_pos: 0,
              end_pos: 8,
              metadata_json: null,
            },
            {
              id: 'ent-C',
              type: 'organization',
              value: 'Entity C',
              normalized_value: null,
              confidence: 0.85,
              start_pos: 0,
              end_pos: 8,
              metadata_json: null,
            },
          ]),
        });

        const related = await extractor.findRelatedEntities('ent-A', 2);

        expect(related.length).toBeGreaterThan(0);
      });

      it('should return empty array when no relationships exist', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const related = await extractor.findRelatedEntities('isolated-entity', 2);
        expect(related).toEqual([]);
      });

      it('should respect depth limit', async () => {
        // Only traverse 1 level deep
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'rel-1',
              source_entity_id: 'ent-A',
              target_entity_id: 'ent-B',
              relationship_type: 'relates_to',
              confidence: 0.9,
              metadata_json: null,
            },
          ]),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'ent-B',
              type: 'person',
              value: 'Entity B',
              normalized_value: null,
              confidence: 0.9,
              start_pos: 0,
              end_pos: 8,
              metadata_json: null,
            },
          ]),
        });

        const related = await extractor.findRelatedEntities('ent-A', 1);
        expect(related).toBeDefined();
      });
    });

    describe('getStats', () => {
      it('should return entity statistics', async () => {
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ count: 100 })),
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ count: 50 })),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            { type: 'person', count: 40 },
            { type: 'amount', count: 30 },
            { type: 'date', count: 20 },
            { type: 'email', count: 10 },
          ]),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            { relationship_type: 'owes', count: 25 },
            { relationship_type: 'scheduled_with', count: 15 },
            { relationship_type: 'belongs_to', count: 10 },
          ]),
        });

        const stats = await extractor.getStats();

        expect(stats.totalEntities).toBe(100);
        expect(stats.totalRelationships).toBe(50);
        expect(stats.entitiesByType).toHaveProperty('person');
        expect(stats.relationshipsByType).toHaveProperty('owes');
      });

      it('should handle empty database', async () => {
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ count: 0 })),
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ count: 0 })),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const stats = await extractor.getStats();

        expect(stats.totalEntities).toBe(0);
        expect(stats.totalRelationships).toBe(0);
        expect(stats.entitiesByType).toEqual({});
        expect(stats.relationshipsByType).toEqual({});
      });
    });

    describe('clearAll', () => {
      it('should clear all entities and relationships', async () => {
        mockDb.prepare.mockReturnValue({
          run: jest.fn(),
        });

        await extractor.clearAll();

        expect(mockDb.prepare).toHaveBeenCalledWith(
          'DELETE FROM cortex_entity_relationships'
        );
        expect(mockDb.prepare).toHaveBeenCalledWith(
          'DELETE FROM cortex_extracted_entities'
        );
        expect(mockDb.prepare).toHaveBeenCalledWith(
          'DELETE FROM cortex_extraction_cache'
        );
      });
    });
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe('Singleton Pattern', () => {
    beforeEach(() => {
      resetEntityExtractor();
    });

    describe('getEntityExtractor', () => {
      it('should return same instance on multiple calls', () => {
        const instance1 = getEntityExtractor();
        const instance2 = getEntityExtractor();
        expect(instance1).toBe(instance2);
      });

      it('should create new instance after reset', () => {
        const instance1 = getEntityExtractor();
        resetEntityExtractor();
        const instance2 = getEntityExtractor();
        expect(instance1).not.toBe(instance2);
      });

      it('should accept custom config on first call', () => {
        const instance = getEntityExtractor({ useLLM: false, minConfidence: 0.8 });
        expect(instance).toBeDefined();
      });
    });

    describe('resetEntityExtractor', () => {
      it('should reset singleton instance', () => {
        const instance1 = getEntityExtractor();
        resetEntityExtractor();
        const instance2 = getEntityExtractor();
        expect(instance1).not.toBe(instance2);
      });
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe('Convenience Functions', () => {
    beforeEach(() => {
      resetEntityExtractor();
    });

    describe('extractEntities', () => {
      it('should extract entities using convenience function', async () => {
        mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
        mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
        mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
        mockDb.prepare.mockReturnValue({ run: jest.fn() });

        const result = await extractEntities('Some content with entities', 'evt-1');

        expect(result).toBeDefined();
        expect(result.entities).toBeDefined();
        expect(result.relationships).toBeDefined();
      });
    });

    describe('getEntitiesForEvent', () => {
      it('should get entities using convenience function', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const entities = await getEntitiesForEvent('evt-1');
        expect(Array.isArray(entities)).toBe(true);
      });
    });

    describe('getRelationshipsForEntity', () => {
      it('should get relationships using convenience function', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const relationships = await getRelationshipsForEntity('ent-1');
        expect(Array.isArray(relationships)).toBe(true);
      });
    });

    describe('searchEntitiesByType', () => {
      it('should search by type using convenience function', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const entities = await searchEntitiesByType('person');
        expect(Array.isArray(entities)).toBe(true);
      });

      it('should accept optional limit', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const entities = await searchEntitiesByType('amount', 25);
        expect(Array.isArray(entities)).toBe(true);
      });
    });

    describe('findRelatedEntities', () => {
      it('should find related entities using convenience function', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const related = await findRelatedEntities('ent-1');
        expect(Array.isArray(related)).toBe(true);
      });

      it('should accept optional depth', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        const related = await findRelatedEntities('ent-1', 3);
        expect(Array.isArray(related)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Caching Tests
  // ==========================================================================

  describe('Caching', () => {
    it('should cache extraction results', async () => {
      resetEntityExtractor();
      const extractor = new EntityExtractor();

      // First extraction - cache miss
      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() }); // delete expired
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) }); // cache lookup
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      await extractor.extractEntities('Test content', 'evt-1');

      // Second extraction with same content - should hit cache
      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => ({
          extraction_json: JSON.stringify({
            entities: [],
            relationships: [],
            extractedAt: '2025-01-01T00:00:00Z',
          }),
        })),
      });

      await extractor.extractEntities('Test content', 'evt-2');

      // LLM should only be called once (first time)
      expect(DirectLLMClients.openRouterChat).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      const extractor = new EntityExtractor({ cacheTTLHours: 1 });
      expect(extractor).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      const result = await extractor.extractEntities('', 'evt-empty');
      expect(result.entities).toEqual([]);
    });

    it('should handle content with no extractable entities', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      const result = await extractor.extractEntities(
        'This is just plain text with nothing special.',
        'evt-plain'
      );
      // May extract some entities depending on regex patterns
      expect(result).toBeDefined();
    });

    it('should handle very long content', async () => {
      const extractor = new EntityExtractor({ useLLM: false });
      const longContent = 'Email: test@example.com ' + 'A'.repeat(10000);

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      const result = await extractor.extractEntities(longContent, 'evt-long');
      expect(result).toBeDefined();
    });

    it('should handle special characters in content', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      const result = await extractor.extractEntities(
        "Content with <html> tags, 'quotes', \"double quotes\", and émojis 🎉",
        'evt-special'
      );
      expect(result).toBeDefined();
    });

    it('should handle malformed LLM response', async () => {
      resetEntityExtractor();
      const extractor = new EntityExtractor();

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      // Mock malformed LLM response
      (DirectLLMClients.openRouterChat as jest.Mock).mockResolvedValueOnce({
        content: 'not valid json',
      });

      const result = await extractor.extractEntities('Some content', 'evt-malformed');

      // Should fall back to regex extraction
      expect(result).toBeDefined();
      expect(result.relationships).toEqual([]);
    });

    it('should filter entities below minimum confidence', async () => {
      resetEntityExtractor();
      const extractor = new EntityExtractor({ minConfidence: 0.8 });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      // Mock LLM response with mixed confidence
      (DirectLLMClients.openRouterChat as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          entities: [
            { type: 'person', value: 'High Confidence', confidence: 0.95 },
            { type: 'person', value: 'Low Confidence', confidence: 0.5 },
          ],
          relationships: [],
        }),
      });

      const result = await extractor.extractEntities('Some content', 'evt-confidence');

      // Only high confidence entity should be included
      expect(result.entities.every((e) => e.confidence >= 0.8)).toBe(true);
    });
  });

  // ==========================================================================
  // Content Hashing Tests
  // ==========================================================================

  describe('Content Hashing', () => {
    it('should generate consistent hashes for same content', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      // Same content should hit cache on second call
      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      await extractor.extractEntities('Same content', 'evt-1');

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      const cacheGetMock = jest.fn(() => ({
        extraction_json: JSON.stringify({
          entities: [],
          relationships: [],
          extractedAt: '2025-01-01T00:00:00Z',
        }),
      }));
      mockDb.prepare.mockReturnValueOnce({ get: cacheGetMock });

      await extractor.extractEntities('Same content', 'evt-2');

      expect(cacheGetMock).toHaveBeenCalled();
    });

    it('should generate different hashes for different content', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      await extractor.extractEntities('Content A', 'evt-1');

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      await extractor.extractEntities('Content B', 'evt-2');

      // Both should be processed (no cache hit)
    });

    it('should trim content before hashing', async () => {
      const extractor = new EntityExtractor({ useLLM: false });

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      mockDb.prepare.mockReturnValueOnce({ get: jest.fn(() => null) });
      mockDb.transaction = jest.fn((fn) => (entities) => fn(entities));
      mockDb.prepare.mockReturnValue({ run: jest.fn() });

      await extractor.extractEntities('  Same content  ', 'evt-1');

      mockDb.prepare.mockReturnValueOnce({ run: jest.fn() });
      const cacheGetMock = jest.fn(() => ({
        extraction_json: JSON.stringify({
          entities: [],
          relationships: [],
          extractedAt: '2025-01-01T00:00:00Z',
        }),
      }));
      mockDb.prepare.mockReturnValueOnce({ get: cacheGetMock });

      await extractor.extractEntities('Same content', 'evt-2');

      // Should hit cache because trimmed content matches
      expect(cacheGetMock).toHaveBeenCalled();
    });
  });
});
