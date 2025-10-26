/**
 * Wrath Shield v3 - MemoryWrapper App-Specific Helpers Tests
 *
 * Tests for addDailySummary, addAnchor, and getAnchors helpers
 */

import { addDailySummary, addAnchor, getAnchors, resetMemory } from '@/lib/MemoryWrapper';

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
      apiKey: undefined, // Force local embeddings
    },
  })),
}));

// Mock mem0ai
let mockMemories: any[] = [];
const mockMem0Instance = {
  add: jest.fn((text: string, opts: any) => {
    const memory = {
      id: `mem_${Date.now()}_${Math.random()}`,
      text,
      user_id: opts.user_id,
      metadata: opts.metadata || {},
    };
    mockMemories.push(memory);
    return Promise.resolve();
  }),
  getAll: jest.fn((opts: any) => {
    return Promise.resolve(mockMemories.filter((m) => m.user_id === opts.user_id));
  }),
};

jest.mock('mem0ai', () => ({
  Memory: jest.fn().mockImplementation(() => mockMem0Instance),
}));

// Mock qdrant-client (simulate unavailable to force in-memory fallback)
jest.mock('qdrant-client', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getCollections: jest.fn().mockRejectedValue(new Error('Qdrant not available')),
  })),
}));

describe('MemoryWrapper App-Specific Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemories = [];
    resetMemory();
  });

  describe('addDailySummary', () => {
    it('should add daily summary with auto-generated date', async () => {
      // Stub Date.toISOString to fixed value for predictable testing
      const realDate = Date;
      const fixedDateString = '2024-01-15T10:30:00.000Z';
      global.Date = class extends Date {
        constructor() {
          super();
          return new realDate('2024-01-15T10:30:00Z');
        }
        toISOString() {
          return fixedDateString;
        }
        static now() {
          return realDate.now();
        }
      } as any;

      await addDailySummary('Today was productive', 'user123');

      expect(mockMem0Instance.add).toHaveBeenCalledWith('Today was productive', {
        user_id: 'user123',
        metadata: {
          type: 'daily_summary',
          date: '2024-01-15',
        },
      });

      // Restore Date
      global.Date = realDate;
    });

    it('should preserve provided date in metadata', async () => {
      await addDailySummary('Custom date summary', 'user456', { date: '2024-02-20' });

      expect(mockMem0Instance.add).toHaveBeenCalledWith('Custom date summary', {
        user_id: 'user456',
        metadata: {
          type: 'daily_summary',
          date: '2024-02-20',
        },
      });
    });

    it('should merge additional metadata with type and date', async () => {
      await addDailySummary('Summary with extra metadata', 'user789', {
        date: '2024-03-10',
        mood: 'positive',
        energy_level: 8,
      });

      expect(mockMem0Instance.add).toHaveBeenCalledWith('Summary with extra metadata', {
        user_id: 'user789',
        metadata: {
          type: 'daily_summary',
          date: '2024-03-10',
          mood: 'positive',
          energy_level: 8,
        },
      });
    });

    it('should generate YYYY-MM-DD format for dates', async () => {
      const realDate = Date;
      const fixedDateString = '2024-12-25T23:59:59.000Z';
      global.Date = class extends Date {
        constructor() {
          super();
          return new realDate('2024-12-25T23:59:59Z');
        }
        toISOString() {
          return fixedDateString;
        }
        static now() {
          return realDate.now();
        }
      } as any;

      await addDailySummary('Christmas summary', 'user999');

      const call = (mockMem0Instance.add as jest.Mock).mock.calls[0];
      expect(call[1].metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(call[1].metadata.date).toBe('2024-12-25');

      global.Date = realDate;
    });
  });

  describe('addAnchor', () => {
    it('should add anchor with type, category, and date metadata', async () => {
      await addAnchor('Started new job', 'career', '2024-01-01', 'user123');

      expect(mockMem0Instance.add).toHaveBeenCalledWith('Started new job', {
        user_id: 'user123',
        metadata: {
          type: 'anchor',
          category: 'career',
          date: '2024-01-01',
        },
      });
    });

    it('should support multiple anchor categories', async () => {
      await addAnchor('Moved to new city', 'location', '2024-02-15', 'user456');
      await addAnchor('Got married', 'relationship', '2024-03-20', 'user456');
      await addAnchor('Started meditation', 'health', '2024-04-10', 'user456');

      expect(mockMem0Instance.add).toHaveBeenCalledTimes(3);

      const calls = (mockMem0Instance.add as jest.Mock).mock.calls;
      expect(calls[0][1].metadata.category).toBe('location');
      expect(calls[1][1].metadata.category).toBe('relationship');
      expect(calls[2][1].metadata.category).toBe('health');
    });

    it('should handle different date formats as strings', async () => {
      await addAnchor('Event 1', 'test', '2024-01-15', 'user789');
      await addAnchor('Event 2', 'test', '2024-12-31', 'user789');

      const calls = (mockMem0Instance.add as jest.Mock).mock.calls;
      expect(calls[0][1].metadata.date).toBe('2024-01-15');
      expect(calls[1][1].metadata.date).toBe('2024-12-31');
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
      // Add a memory with incomplete metadata
      mockMemories.push({
        id: 'incomplete',
        text: 'Missing metadata',
        user_id: 'user123',
        metadata: {}, // No type field
      });

      const anchors = await getAnchors('user123');

      // Should not include the incomplete memory
      expect(anchors).toHaveLength(4);
      expect(anchors.every((a) => a.metadata.type === 'anchor')).toBe(true);
    });

    it('should handle null/undefined dates in sorting', async () => {
      // Add anchor with missing date
      mockMemories.push({
        id: 'no-date',
        text: 'Anchor without date',
        user_id: 'user123',
        metadata: { type: 'anchor', category: 'test' },
      });

      const anchors = await getAnchors('user123');

      // Should still return results, with null date sorted to end
      expect(anchors).toHaveLength(5);
      expect(anchors[4].id).toBe('no-date');
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

    it('should work with in-memory vector store fallback', async () => {
      // This test verifies the mocks are set up correctly
      // Qdrant is mocked to fail, so we should be using in-memory

      await addDailySummary('Test summary', 'fallback-user');
      await addAnchor('Test anchor', 'test', '2024-01-01', 'fallback-user');

      const anchors = await getAnchors('fallback-user');
      expect(anchors).toHaveLength(1);
      expect(anchors[0].metadata.type).toBe('anchor');
    });
  });

  describe('Resilience', () => {
    it('should handle empty getAll response', async () => {
      (mockMem0Instance.getAll as jest.Mock).mockResolvedValueOnce([]);

      const anchors = await getAnchors('empty-user');

      expect(anchors).toEqual([]);
    });

    it('should handle getAll errors gracefully', async () => {
      (mockMem0Instance.getAll as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(getAnchors('error-user')).rejects.toThrow('Database error');
    });

    it('should handle add errors gracefully', async () => {
      (mockMem0Instance.add as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

      await expect(addDailySummary('Test', 'error-user')).rejects.toThrow('Storage full');
    });
  });
});
