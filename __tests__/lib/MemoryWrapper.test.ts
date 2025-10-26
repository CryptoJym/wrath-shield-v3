/**
 * Wrath Shield v3 - Memory Wrapper Tests
 *
 * Tests for Mem0 initialization with Qdrant/in-memory fallback,
 * vector store resilience, and memory operations.
 */

import { QdrantClient } from 'qdrant-client';

// Disable server-only guard for testing
jest.mock('../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock config to provide test configuration
jest.mock('../../lib/config', () => ({
  cfg: jest.fn(() => ({
    qdrant: {
      host: 'localhost',
      port: 6333,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  })),
}));

// Mock qdrant-client
jest.mock('qdrant-client', () => ({
  QdrantClient: jest.fn(),
}));

// Mock mem0ai
jest.mock('mem0ai', () => ({
  Memory: jest.fn(),
}));

describe('MemoryWrapper', () => {
  let mockQdrantClient: any;
  let mockMemory: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Qdrant client
    mockQdrantClient = {
      getCollections: jest.fn(),
    };
    (QdrantClient as jest.MockedClass<typeof QdrantClient>).mockImplementation(
      () => mockQdrantClient
    );

    // Setup mock Memory instance
    mockMemory = {
      add: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([]),
      getAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Memory constructor to return mockMemory instance
    const mem0ai = require('mem0ai');
    mem0ai.Memory.mockImplementation(() => mockMemory);
  });

  afterEach(() => {
    // Reset the wrapper singleton
    const { resetMemory } = require('../../lib/MemoryWrapper');
    resetMemory();
  });

  describe('Initialization', () => {
    it('should initialize with Qdrant when available', async () => {
      // Mock successful Qdrant connection
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });

      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      const config = getMemoryConfig();
      expect(config).toBeTruthy();
      expect(config?.vectorStore).toBe('qdrant');
      expect(config?.qdrantUrl).toBe('http://localhost:6333');
      expect(config?.qdrantCollection).toBe('wrath_shield_memories');
    });

    it('should fall back to in-memory when Qdrant is unavailable', async () => {
      // Mock failed Qdrant connection
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Connection refused'));

      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');

      // Should not throw, should fall back
      await expect(initializeMemory()).resolves.not.toThrow();

      const config = getMemoryConfig();
      expect(config).toBeTruthy();
      expect(config?.vectorStore).toBe('in-memory');
      expect(config?.qdrantUrl).toBeUndefined();
    });

    it('should configure OpenAI embeddings when API key is available', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });

      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      const config = getMemoryConfig();
      expect(config?.embeddingsProvider).toBe('openai');
      expect(config?.embeddingsApiKey).toBe('test-key');

      delete process.env.OPENAI_API_KEY;
    });

    it('should use local embeddings when OpenAI key is not available', async () => {
      delete process.env.OPENAI_API_KEY;
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });

      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      const config = getMemoryConfig();
      expect(config?.embeddingsProvider).toBe('local');
      expect(config?.embeddingsApiKey).toBeUndefined();
    });

    it('should not reinitialize if already initialized', async () => {
      mockQdrantClient.getCollections.mockResolvedValue({ collections: [] });

      const { initializeMemory } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      // Reset mock to verify it's not called again
      mockQdrantClient.getCollections.mockClear();

      await initializeMemory();

      // getCollections should not be called again
      expect(mockQdrantClient.getCollections).not.toHaveBeenCalled();
    });
  });

  describe('Memory Operations', () => {
    beforeEach(async () => {
      // Initialize with in-memory for testing
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Test mode'));

      const { initializeMemory } = require('../../lib/MemoryWrapper');
      await initializeMemory();
    });

    it('should add memory with user ID and metadata', async () => {
      const { addMemory } = require('../../lib/MemoryWrapper');

      await addMemory('Test memory content', 'user-123', { category: 'test' });

      expect(mockMemory.add).toHaveBeenCalledWith('Test memory content', {
        user_id: 'user-123',
        metadata: { category: 'test' },
      });
    });

    it('should search memories by query', async () => {
      const { searchMemories } = require('../../lib/MemoryWrapper');
      mockMemory.search.mockResolvedValue([
        { id: '1', text: 'Found memory', score: 0.95 },
      ]);

      const results = await searchMemories('test query', 'user-123', 10);

      expect(mockMemory.search).toHaveBeenCalledWith('test query', {
        user_id: 'user-123',
        limit: 10,
      });
      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Found memory');
    });

    it('should use default limit of 5 for search', async () => {
      const { searchMemories } = require('../../lib/MemoryWrapper');

      await searchMemories('test query', 'user-123');

      expect(mockMemory.search).toHaveBeenCalledWith('test query', {
        user_id: 'user-123',
        limit: 5,
      });
    });

    it('should get all memories for a user', async () => {
      const { getAllMemories } = require('../../lib/MemoryWrapper');
      mockMemory.getAll.mockResolvedValue([
        { id: '1', text: 'Memory 1' },
        { id: '2', text: 'Memory 2' },
      ]);

      const memories = await getAllMemories('user-123');

      expect(mockMemory.getAll).toHaveBeenCalledWith({ user_id: 'user-123' });
      expect(memories).toHaveLength(2);
    });

    it('should delete a specific memory', async () => {
      const { deleteMemory } = require('../../lib/MemoryWrapper');

      await deleteMemory('memory-id-123');

      expect(mockMemory.delete).toHaveBeenCalledWith('memory-id-123');
    });

    it('should auto-initialize on first operation if not initialized', async () => {
      const { resetMemory, addMemory } = require('../../lib/MemoryWrapper');
      resetMemory(); // Reset to uninitialized state

      mockQdrantClient.getCollections.mockRejectedValue(new Error('Test mode'));

      // This should trigger initialization
      await addMemory('Test', 'user-123');

      expect(mockMemory.add).toHaveBeenCalled();
    });
  });

  describe('Resilience & Edge Cases', () => {
    it('should handle Qdrant timeout gracefully', async () => {
      // Simulate timeout
      mockQdrantClient.getCollections.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ETIMEDOUT')), 50);
        });
      });

      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');

      await initializeMemory();

      // Should fall back to in-memory
      const config = getMemoryConfig();
      expect(config?.vectorStore).toBe('in-memory');
    });

    it('should handle empty search results', async () => {
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Test mode'));

      const { initializeMemory, searchMemories } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      mockMemory.search.mockResolvedValue([]);

      const results = await searchMemories('nonexistent query', 'user-123');

      expect(results).toEqual([]);
    });

    it('should handle empty memory list', async () => {
      mockQdrantClient.getCollections.mockRejectedValue(new Error('Test mode'));

      const { initializeMemory, getAllMemories } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      mockMemory.getAll.mockResolvedValue([]);

      const memories = await getAllMemories('new-user');

      expect(memories).toEqual([]);
    });

    it('should reset singleton state', () => {
      const { resetMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');

      resetMemory();

      const config = getMemoryConfig();
      expect(config).toBeNull();
    });
  });

  describe('Configuration Variants', () => {
    it('should use custom Qdrant host and port from config', async () => {
      // Mock custom config before requiring MemoryWrapper
      jest.resetModules();

      jest.doMock('../../lib/config', () => ({
        cfg: jest.fn(() => ({
          qdrant: {
            host: 'custom-host',
            port: 9999,
          },
          openai: {
            apiKey: undefined,
          },
        })),
      }));

      // Re-mock qdrant and mem0ai after reset
      jest.doMock('qdrant-client', () => ({
        QdrantClient: jest.fn(() => ({
          getCollections: jest.fn().mockResolvedValue({ collections: [] }),
        })),
      }));

      jest.doMock('mem0ai', () => ({
        Memory: jest.fn(() => mockMemory),
      }));

      // Now require MemoryWrapper with custom config
      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      const config = getMemoryConfig();
      expect(config?.qdrantUrl).toBe('http://custom-host:9999');
    });
  });
});
