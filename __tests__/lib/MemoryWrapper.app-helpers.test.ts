/**
 * Wrath Shield v3 - MemoryWrapper App-Specific Helpers Tests
 *
 * Tests for addDailySummary, addAnchor, and getAnchors helpers
 */

import { addDailySummary, addAnchor, getAnchors, resetMemory, getAllMemories, addMemory } from '@/lib/MemoryWrapper';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  cfg: jest.fn(() => ({
    qdrant: {
      host: 'localhost',
      port: 6333,
    },
    openai: {
      apiKey: undefined,
    },
  })),
}));

// Mock @getzep/zep-cloud (won't be used in test mode, but needs to be defined)
jest.mock('@getzep/zep-cloud', () => ({
  ZepClient: jest.fn(),
}));

describe('MemoryWrapper App-Specific Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMemory();
  });

  describe('addDailySummary', () => {
    it('should add daily summary with auto-generated date', async () => {
      await addDailySummary('Today was productive', 'user123');

      const memories = await getAllMemories('user123');
      expect(memories).toHaveLength(1);
      expect(memories[0].text).toBe('Today was productive');
      expect(memories[0].metadata.type).toBe('daily_summary');
      expect(memories[0].metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should preserve provided date in metadata', async () => {
      await addDailySummary('Custom date summary', 'user456', { date: '2024-02-20' });

      const memories = await getAllMemories('user456');
      expect(memories[0].metadata.date).toBe('2024-02-20');
      expect(memories[0].metadata.type).toBe('daily_summary');
    });

    it('should merge additional metadata with type and date', async () => {
      await addDailySummary('Summary with extra metadata', 'user789', {
        date: '2024-03-10',
        mood: 'positive',
        energy_level: 8,
      });

      const memories = await getAllMemories('user789');
      expect(memories[0].metadata).toEqual(
        expect.objectContaining({
          type: 'daily_summary',
          date: '2024-03-10',
          mood: 'positive',
          energy_level: 8,
        })
      );
    });

    it('should generate YYYY-MM-DD format for dates', async () => {
      await addDailySummary('Test summary', 'user999');

      const memories = await getAllMemories('user999');
      expect(memories[0].metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('addAnchor', () => {
    it('should add anchor with type, category, and date metadata', async () => {
      await addAnchor('Started new job', 'career', '2024-01-01', 'user123');

      const memories = await getAllMemories('user123');
      expect(memories[0].text).toBe('Started new job');
      expect(memories[0].metadata).toEqual({
        type: 'anchor',
        category: 'career',
        date: '2024-01-01',
      });
    });

    it('should support multiple anchor categories', async () => {
      await addAnchor('Moved to new city', 'location', '2024-02-15', 'user456');
      await addAnchor('Got married', 'relationship', '2024-03-20', 'user456');
      await addAnchor('Started meditation', 'health', '2024-04-10', 'user456');

      const memories = await getAllMemories('user456');
      expect(memories).toHaveLength(3);

      const categories = memories.map((m) => m.metadata.category);
      expect(categories).toContain('location');
      expect(categories).toContain('relationship');
      expect(categories).toContain('health');
    });

    it('should handle different date formats as strings', async () => {
      await addAnchor('Event 1', 'test', '2024-01-15', 'user789');
      await addAnchor('Event 2', 'test', '2024-12-31', 'user789');

      const memories = await getAllMemories('user789');
      const dates = memories.map((m) => m.metadata.date);
      expect(dates).toContain('2024-01-15');
      expect(dates).toContain('2024-12-31');
    });
  });

  describe('getAnchors', () => {
    beforeEach(async () => {
      // Setup test data: mix of anchors, daily summaries, and other types
      await addAnchor('Anchor 1', 'career', '2024-01-15', 'user123');
      await addAnchor('Anchor 2', 'health', '2024-02-20', 'user123');
      await addAnchor('Anchor 3', 'career', '2024-03-10', 'user123');
      await addDailySummary('Not an anchor', 'user123', { date: '2024-02-01' });
      await addAnchor('Anchor 4', 'relationship', '2024-04-05', 'user123');
    });

    it('should return only anchor memories', async () => {
      const anchors = await getAnchors('user123');

      expect(anchors).toHaveLength(4);
      expect(anchors.every((a) => a.metadata.type === 'anchor')).toBe(true);
    });

    it('should sort anchors by date descending (newest first)', async () => {
      const anchors = await getAnchors('user123');

      expect(anchors[0].metadata.date).toBe('2024-04-05'); // Newest
      expect(anchors[1].metadata.date).toBe('2024-03-10');
      expect(anchors[2].metadata.date).toBe('2024-02-20');
      expect(anchors[3].metadata.date).toBe('2024-01-15'); // Oldest
    });

    it('should filter by since date (inclusive)', async () => {
      const anchors = await getAnchors('user123', { since: '2024-02-20' });

      expect(anchors).toHaveLength(3);
      expect(anchors.every((a) => a.metadata.date >= '2024-02-20')).toBe(true);
      expect(anchors.map((a) => a.metadata.date)).toEqual(['2024-04-05', '2024-03-10', '2024-02-20']);
    });

    it('should filter by category', async () => {
      const careerAnchors = await getAnchors('user123', { category: 'career' });

      expect(careerAnchors).toHaveLength(2);
      expect(careerAnchors.every((a) => a.metadata.category === 'career')).toBe(true);
      expect(careerAnchors.map((a) => a.text)).toEqual(['Anchor 3', 'Anchor 1']);
    });

    it('should filter by both since and category', async () => {
      const filteredAnchors = await getAnchors('user123', { since: '2024-02-01', category: 'career' });

      expect(filteredAnchors).toHaveLength(1);
      expect(filteredAnchors[0].metadata.date).toBe('2024-03-10');
      expect(filteredAnchors[0].metadata.category).toBe('career');
    });

    it('should return empty array when no anchors exist', async () => {
      const anchors = await getAnchors('user-with-no-anchors');

      expect(anchors).toEqual([]);
    });

    it('should handle missing metadata gracefully', async () => {
      // Add a memory with incomplete metadata using the base addMemory
      await addMemory('Missing type metadata', 'user123', {});

      const anchors = await getAnchors('user123');

      // Should not include the incomplete memory (only the 4 anchors from beforeEach)
      expect(anchors).toHaveLength(4);
      expect(anchors.every((a) => a.metadata.type === 'anchor')).toBe(true);
    });

    it('should handle null/undefined dates in sorting', async () => {
      // Add anchor with missing date
      await addMemory('Anchor without date', 'user123', { type: 'anchor', category: 'test' });

      const anchors = await getAnchors('user123');

      // Should still return results, with null date sorted to end
      expect(anchors).toHaveLength(5);
      expect(anchors[4].text).toBe('Anchor without date');
    });
  });

  describe('Integration Tests', () => {
    it('should support complete anchor workflow', async () => {
      const userId = 'integration-user';

      // Add multiple anchors
      await addAnchor('Started therapy', 'health', '2024-01-10', userId);
      await addAnchor('Promotion at work', 'career', '2024-02-15', userId);
      await addAnchor('Moved to new apartment', 'location', '2024-03-20', userId);

      // Retrieve and verify
      const allAnchors = await getAnchors(userId);
      expect(allAnchors).toHaveLength(3);

      // Filter by category
      const healthAnchors = await getAnchors(userId, { category: 'health' });
      expect(healthAnchors).toHaveLength(1);
      expect(healthAnchors[0].text).toBe('Started therapy');

      // Filter by date
      const recentAnchors = await getAnchors(userId, { since: '2024-02-01' });
      expect(recentAnchors).toHaveLength(2);
      expect(recentAnchors.map((a) => a.metadata.category)).toEqual(['location', 'career']);
    });

    it('should work with in-memory store in test mode', async () => {
      // This test verifies the test-mode in-memory store works

      await addDailySummary('Test summary', 'fallback-user');
      await addAnchor('Test anchor', 'test', '2024-01-01', 'fallback-user');

      const anchors = await getAnchors('fallback-user');
      expect(anchors).toHaveLength(1);
      expect(anchors[0].metadata.type).toBe('anchor');
    });
  });

  describe('Resilience', () => {
    it('should handle empty getAll response', async () => {
      const anchors = await getAnchors('empty-user');

      expect(anchors).toEqual([]);
    });
  });
});
