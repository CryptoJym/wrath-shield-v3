// @ts-nocheck
/**
 * Wrath Shield v3 - MemoryWrapper Tests
 *
 * Tests for the unified memory wrapper that supports:
 * - Zep Cloud (primary)
 * - SQLite (fallback)
 * - In-memory store (test mode)
 */

import {
  initializeMemory,
  getMemory,
  getMemoryConfig,
  addMemory,
  searchMemories,
  getAllMemories,
  deleteMemory,
  resetMemory,
  addDailySummary,
  addAnchor,
  getAnchors,
} from '@/lib/MemoryWrapper';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock memory/zep module
jest.mock('@/lib/memory/zep', () => ({
  initializeZep: jest.fn(),
  addZepMemory: jest.fn(),
  searchZepMemory: jest.fn(),
  getRecentZepMemories: jest.fn(),
  getZepContext: jest.fn(),
}));

// Mock Database
jest.mock('@/lib/db/Database', () => ({
  Database: {
    getInstance: jest.fn().mockReturnValue({
      getRawDb: jest.fn().mockReturnValue({
        exec: jest.fn(),
        prepare: jest.fn().mockReturnValue({
          run: jest.fn(),
          all: jest.fn().mockReturnValue([]),
        }),
      }),
    }),
  },
}));

describe('MemoryWrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    resetMemory();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Test Mode (In-Memory Store)', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();
      await initializeMemory();
    });

    it('should initialize in test mode with in-memory store', async () => {
      const config = getMemoryConfig();
      expect(config?.vectorStore).toBe('sqlite');
    });

    it('should add and retrieve memories', async () => {
      await addMemory('Test memory content', 'test-user', { type: 'test' });

      const memories = await getAllMemories('test-user');
      expect(memories.length).toBe(1);
      expect(memories[0].text).toBe('Test memory content');
      expect(memories[0].metadata?.type).toBe('test');
    });

    it('should add multiple memories for same user', async () => {
      await addMemory('Memory 1', 'user-1');
      await addMemory('Memory 2', 'user-1');
      await addMemory('Memory 3', 'user-1');

      const memories = await getAllMemories('user-1');
      expect(memories.length).toBe(3);
    });

    it('should keep memories separate per user', async () => {
      await addMemory('User 1 memory', 'user-1');
      await addMemory('User 2 memory', 'user-2');

      const user1Memories = await getAllMemories('user-1');
      const user2Memories = await getAllMemories('user-2');

      expect(user1Memories.length).toBe(1);
      expect(user2Memories.length).toBe(1);
      expect(user1Memories[0].text).toBe('User 1 memory');
      expect(user2Memories[0].text).toBe('User 2 memory');
    });

    it('should search memories by query', async () => {
      await addMemory('Meeting with John about project', 'user-1');
      await addMemory('Call from Sarah regarding budget', 'user-1');
      await addMemory('Email from John with details', 'user-1');

      const results = await searchMemories('John', 'user-1');
      expect(results.length).toBe(2);
    });

    it('should limit search results', async () => {
      await addMemory('Test 1', 'user-1');
      await addMemory('Test 2', 'user-1');
      await addMemory('Test 3', 'user-1');
      await addMemory('Test 4', 'user-1');
      await addMemory('Test 5', 'user-1');
      await addMemory('Test 6', 'user-1');

      const results = await searchMemories('Test', 'user-1', 3);
      expect(results.length).toBe(3);
    });

    it('should delete specific memory', async () => {
      await addMemory('To be kept', 'user-1');
      await addMemory('To be deleted', 'user-1');

      const memoriesBefore = await getAllMemories('user-1');
      expect(memoriesBefore.length).toBe(2);

      const toDelete = memoriesBefore.find(m => m.text === 'To be deleted');
      await deleteMemory(toDelete.id);

      const memoriesAfter = await getAllMemories('user-1');
      expect(memoriesAfter.length).toBe(1);
      expect(memoriesAfter[0].text).toBe('To be kept');
    });

    it('should return empty array for non-existent user', async () => {
      const memories = await getAllMemories('non-existent');
      expect(memories).toEqual([]);
    });
  });

  describe('Daily Summary Helper', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();
      await initializeMemory();
    });

    it('should add daily summary with date', async () => {
      await addDailySummary(
        'Productive day with 5 meetings',
        'user-1',
        { mood: 'good' }
      );

      const memories = await getAllMemories('user-1');
      expect(memories.length).toBe(1);
      expect(memories[0].metadata?.type).toBe('daily_summary');
      expect(memories[0].metadata?.date).toBeDefined();
    });

    it('should use provided date', async () => {
      await addDailySummary(
        'Summary for specific date',
        'user-1',
        { date: '2025-01-15' }
      );

      const memories = await getAllMemories('user-1');
      expect(memories[0].metadata?.date).toBe('2025-01-15');
    });
  });

  describe('Anchor Helper', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();
      await initializeMemory();
    });

    it('should add anchor memory', async () => {
      await addAnchor(
        'Started new fitness routine',
        'health',
        '2025-01-10',
        'user-1'
      );

      const memories = await getAllMemories('user-1');
      expect(memories.length).toBe(1);
      expect(memories[0].metadata?.type).toBe('anchor');
      expect(memories[0].metadata?.category).toBe('health');
      expect(memories[0].metadata?.date).toBe('2025-01-10');
    });

    it('should get filtered anchors', async () => {
      await addAnchor('Health anchor 1', 'health', '2025-01-01', 'user-1');
      await addAnchor('Health anchor 2', 'health', '2025-01-15', 'user-1');
      await addAnchor('Work anchor', 'work', '2025-01-10', 'user-1');
      await addMemory('Regular memory', 'user-1'); // Not an anchor

      // Get all anchors
      const allAnchors = await getAnchors('user-1');
      expect(allAnchors.length).toBe(3);

      // Filter by category
      const healthAnchors = await getAnchors('user-1', { category: 'health' });
      expect(healthAnchors.length).toBe(2);

      // Filter by date (since)
      const recentAnchors = await getAnchors('user-1', { since: '2025-01-10' });
      expect(recentAnchors.length).toBe(2);

      // Combined filter
      const filtered = await getAnchors('user-1', {
        category: 'health',
        since: '2025-01-10'
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].metadata?.date).toBe('2025-01-15');
    });

    it('should sort anchors by date descending', async () => {
      await addAnchor('Anchor 1', 'work', '2025-01-05', 'user-1');
      await addAnchor('Anchor 2', 'work', '2025-01-20', 'user-1');
      await addAnchor('Anchor 3', 'work', '2025-01-10', 'user-1');

      const anchors = await getAnchors('user-1');
      expect(anchors[0].metadata?.date).toBe('2025-01-20');
      expect(anchors[1].metadata?.date).toBe('2025-01-10');
      expect(anchors[2].metadata?.date).toBe('2025-01-05');
    });
  });

  describe('User ID Mapping', () => {
    beforeEach(async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();
      await initializeMemory();
    });

    it('should accept short agent IDs', async () => {
      await addMemory('Finance memory', 'finance');
      await addMemory('Legal memory', 'legal');
      await addMemory('PM memory', 'pm');

      const financeMemories = await getAllMemories('finance');
      const legalMemories = await getAllMemories('legal');
      const pmMemories = await getAllMemories('pm');

      expect(financeMemories.length).toBe(1);
      expect(legalMemories.length).toBe(1);
      expect(pmMemories.length).toBe(1);
    });

    it('should accept full agent IDs', async () => {
      await addMemory('Finance agent memory', 'finance-agent');

      const memories = await getAllMemories('finance-agent');
      expect(memories.length).toBe(1);
    });
  });

  describe('Memory Reset', () => {
    it('should reset memory state', async () => {
      process.env.NODE_ENV = 'test';
      await initializeMemory();

      await addMemory('Test memory', 'user-1');
      let memories = await getAllMemories('user-1');
      expect(memories.length).toBe(1);

      resetMemory();
      await initializeMemory();

      memories = await getAllMemories('user-1');
      expect(memories.length).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getMemory calls', async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();

      const instance1 = await getMemory();
      const instance2 = await getMemory();

      expect(instance1).toBe(instance2);
    });

    it('should auto-initialize on getMemory if not initialized', async () => {
      process.env.NODE_ENV = 'test';
      resetMemory();

      // Call getMemory without explicit initialization
      const instance = await getMemory();
      expect(instance).toBeDefined();
      expect(typeof instance.add).toBe('function');
      expect(typeof instance.search).toBe('function');
    });
  });

  describe('Zep Cloud Integration', () => {
    const zepModule = require('@/lib/memory/zep');

    beforeEach(() => {
      resetMemory();
    });

    it('should NOT use Zep in test mode even with API key', async () => {
      process.env.NODE_ENV = 'test';
      process.env.ZEP_API_KEY = 'test-zep-key';

      await initializeMemory();

      const config = getMemoryConfig();
      expect(config?.vectorStore).toBe('sqlite');
      expect(zepModule.initializeZep).not.toHaveBeenCalled();
    });

    it('should try Zep in non-test mode with API key', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ZEP_API_KEY = 'test-zep-key';
      zepModule.initializeZep.mockResolvedValue(undefined);

      await initializeMemory();

      expect(zepModule.initializeZep).toHaveBeenCalled();
    });

    it('should fallback to SQLite when Zep fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ZEP_API_KEY = 'test-zep-key';
      zepModule.initializeZep.mockRejectedValue(new Error('Zep connection failed'));

      await initializeMemory();

      const config = getMemoryConfig();
      expect(config?.vectorStore).toBe('sqlite');
    });
  });
});
