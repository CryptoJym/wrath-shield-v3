// @ts-nocheck
/**
 * Wrath Shield v3 - Memory Wrapper Tests
 *
 * Tests for Zep/SQLite memory initialization and operations.
 */

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

// Mock @getzep/zep-cloud
jest.mock('@getzep/zep-cloud', () => ({
  ZepClient: jest.fn(),
}));

describe('MemoryWrapper', () => {
  let mockZepClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Zep client
    mockZepClient = {
      user: {
        get: jest.fn(),
        add: jest.fn(),
      },
      graph: {
        add: jest.fn(),
        search: jest.fn().mockResolvedValue({ edges: [], nodes: [] }),
        delete: jest.fn(),
        episode: {
          getByUserId: jest.fn().mockResolvedValue({ episodes: [] }),
        },
      },
    };

    // Mock ZepClient constructor
    const { ZepClient } = require('@getzep/zep-cloud');
    ZepClient.mockImplementation(() => mockZepClient);
  });

  afterEach(() => {
    // Reset the wrapper singleton
    const { resetMemory } = require('../../lib/MemoryWrapper');
    resetMemory();
  });

  describe('Initialization', () => {
    it('should initialize with in-memory store in test mode', async () => {
      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');
      await initializeMemory();

      const config = getMemoryConfig();
      expect(config).toBeDefined();
      expect(config.provider).toBe('in-memory');
    });

    it('should not reinitialize if already initialized', async () => {
      const { initializeMemory, getMemoryConfig } = require('../../lib/MemoryWrapper');

      await initializeMemory();
      const config1 = getMemoryConfig();

      await initializeMemory();
      const config2 = getMemoryConfig();

      expect(config1).toBe(config2);
    });

    it('should reset properly', async () => {
      const { initializeMemory, getMemoryConfig, resetMemory } = require('../../lib/MemoryWrapper');

      await initializeMemory();
      expect(getMemoryConfig()).not.toBeNull();

      resetMemory();
      expect(getMemoryConfig()).toBeNull();
    });
  });

  describe('Memory Operations', () => {
    beforeEach(async () => {
      const { initializeMemory } = require('../../lib/MemoryWrapper');
      await initializeMemory();
    });

    it('should add memory with user ID and metadata', async () => {
      const { addMemory, getAllMemories } = require('../../lib/MemoryWrapper');

      await addMemory('Test memory content', 'user-123', { category: 'test' });

      const memories = await getAllMemories('user-123');
      expect(memories).toHaveLength(1);
      expect(memories[0].text).toBe('Test memory content');
      expect(memories[0].metadata.category).toBe('test');
    });

    it('should search memories by query', async () => {
      const { addMemory, searchMemories } = require('../../lib/MemoryWrapper');

      await addMemory('Found memory content', 'user-123');
      await addMemory('Other content', 'user-123');

      const results = await searchMemories('found', 'user-123', 10);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('Found memory content');
    });

    it('should use default limit of 5 for search', async () => {
      const { addMemory, searchMemories } = require('../../lib/MemoryWrapper');

      // Add 10 memories with "test" in them
      for (let i = 0; i < 10; i++) {
        await addMemory(`Test memory ${i}`, 'user-123');
      }

      const results = await searchMemories('test', 'user-123');

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should get all memories for a user', async () => {
      const { addMemory, getAllMemories } = require('../../lib/MemoryWrapper');

      await addMemory('Memory 1', 'user-123');
      await addMemory('Memory 2', 'user-123');
      await addMemory('Memory 3', 'user-123');

      const memories = await getAllMemories('user-123');

      expect(memories).toHaveLength(3);
    });

    it('should delete a memory', async () => {
      const { addMemory, getAllMemories, deleteMemory } = require('../../lib/MemoryWrapper');

      await addMemory('Memory to delete', 'user-123');
      let memories = await getAllMemories('user-123');
      expect(memories).toHaveLength(1);

      await deleteMemory(memories[0].id);
      memories = await getAllMemories('user-123');
      expect(memories).toHaveLength(0);
    });

    it('should isolate memories between users', async () => {
      const { addMemory, getAllMemories } = require('../../lib/MemoryWrapper');

      await addMemory('User 1 memory', 'user-1');
      await addMemory('User 2 memory', 'user-2');

      const user1Memories = await getAllMemories('user-1');
      const user2Memories = await getAllMemories('user-2');

      expect(user1Memories).toHaveLength(1);
      expect(user1Memories[0].text).toBe('User 1 memory');
      expect(user2Memories).toHaveLength(1);
      expect(user2Memories[0].text).toBe('User 2 memory');
    });
  });

  describe('Memory Item Structure', () => {
    beforeEach(async () => {
      const { initializeMemory } = require('../../lib/MemoryWrapper');
      await initializeMemory();
    });

    it('should return memory items with correct structure', async () => {
      const { addMemory, getAllMemories } = require('../../lib/MemoryWrapper');

      await addMemory('Structured memory', 'user-123', { key: 'value' });

      const memories = await getAllMemories('user-123');
      expect(memories[0]).toHaveProperty('id');
      expect(memories[0]).toHaveProperty('text');
      expect(memories[0]).toHaveProperty('metadata');
      expect(memories[0].text).toBe('Structured memory');
      expect(memories[0].metadata.key).toBe('value');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      const { initializeMemory } = require('../../lib/MemoryWrapper');
      await initializeMemory();
    });

    it('should handle empty search results', async () => {
      const { searchMemories } = require('../../lib/MemoryWrapper');

      const results = await searchMemories('nonexistent', 'user-123');

      expect(results).toEqual([]);
    });

    it('should handle getting memories for user with no memories', async () => {
      const { getAllMemories } = require('../../lib/MemoryWrapper');

      const memories = await getAllMemories('user-with-no-memories');

      expect(memories).toEqual([]);
    });

    it('should handle special characters in memory content', async () => {
      const { addMemory, getAllMemories } = require('../../lib/MemoryWrapper');

      await addMemory('Memory with "quotes" and \'apostrophes\'', 'user-123');
      await addMemory('Memory with unicode: 你好 🎉', 'user-123');

      const memories = await getAllMemories('user-123');

      expect(memories).toHaveLength(2);
    });
  });
});
