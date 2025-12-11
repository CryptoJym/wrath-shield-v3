// @ts-nocheck
/**
 * Tests for forge-intel.ts
 * Daily Intel Feed - Educational content recommendations
 */

import {
  createIntelItem,
  getIntelItem,
  getDailyFeed,
  viewIntelItem,
  completeIntelItem,
  skipIntelItem,
  getIntelHistory,
  generateDailyIntel,
  generateSampleIntel,
} from '@/lib/hyro/forge-intel';
import type { DailyIntel, ContentType, IntelStatus, IntelFeed } from '@/lib/hyro/forge-intel';

// ============================================================================
// Mocks
// ============================================================================

const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: jest.fn(() => ({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    })),
  })),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('./forge-xp', () => ({
  awardXP: jest.fn(),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockIntelItem(overrides: Partial<DailyIntel> = {}): DailyIntel {
  return {
    id: 'intel-123',
    intel_date: '2024-01-15',
    title: 'Test Intel Item',
    summary: 'Test summary',
    content_type: 'video',
    subject: 'math',
    difficulty: 'medium',
    source_url: 'https://example.com/video',
    source_name: 'Test Source',
    thumbnail_url: 'https://example.com/thumb.jpg',
    estimated_time_minutes: 10,
    xp_reward: 15,
    status: 'new',
    viewed_at: null,
    completed_at: null,
    relevance_score: 0.8,
    curation_reason: 'Test curation reason',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-intel types', () => {
  describe('ContentType', () => {
    it('should support all content types', () => {
      const types: ContentType[] = ['video', 'article', 'quiz', 'fact', 'challenge'];
      types.forEach((type) => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('IntelStatus', () => {
    it('should support all status values', () => {
      const statuses: IntelStatus[] = ['new', 'viewed', 'engaged', 'completed', 'skipped'];
      statuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });
  });

  describe('DailyIntel interface', () => {
    it('should have required properties', () => {
      const intel: DailyIntel = createMockIntelItem();

      expect(intel.id).toBeDefined();
      expect(intel.intel_date).toBeDefined();
      expect(intel.title).toBeDefined();
      expect(intel.content_type).toBeDefined();
      expect(intel.xp_reward).toBeDefined();
      expect(intel.status).toBeDefined();
    });
  });

  describe('IntelFeed interface', () => {
    it('should have required properties', () => {
      const feed: IntelFeed = {
        date: '2024-01-15',
        items: [createMockIntelItem()],
        completion_stats: {
          total: 5,
          completed: 2,
          xp_earned: 30,
          xp_available: 75,
        },
      };

      expect(feed.date).toBeDefined();
      expect(feed.items).toBeInstanceOf(Array);
      expect(feed.completion_stats.total).toBeDefined();
      expect(feed.completion_stats.completed).toBeDefined();
    });
  });
});

// ============================================================================
// createIntelItem Tests
// ============================================================================

describe('createIntelItem', () => {
  beforeEach(() => {
    mockGet.mockReturnValue(createMockIntelItem());
  });

  it('should create intel item with required params', () => {
    const result = createIntelItem('student-1', {
      title: 'Test Video',
      content_type: 'video',
    });

    expect(mockRun).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.title).toBe('Test Intel Item'); // From mock return
  });

  it('should create intel item with all optional params', () => {
    createIntelItem('student-1', {
      title: 'Full Intel Item',
      summary: 'Complete summary',
      content_type: 'article',
      subject: 'science',
      difficulty: 'hard',
      source_url: 'https://example.com',
      source_name: 'Example',
      thumbnail_url: 'https://example.com/img.jpg',
      estimated_time_minutes: 15,
      xp_reward: 25,
      relevance_score: 0.9,
      curation_reason: 'Manual curation',
      intel_date: '2024-01-20',
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it('should use default values for optional params', () => {
    createIntelItem('student-1', {
      title: 'Minimal Item',
      content_type: 'fact',
    });

    // Check that run was called (defaults are applied in the function)
    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// getIntelItem Tests
// ============================================================================

describe('getIntelItem', () => {
  it('should return intel item when found', () => {
    const mockItem = createMockIntelItem();
    mockGet.mockReturnValue(mockItem);

    const result = getIntelItem('student-1', 'intel-123');

    expect(result).toEqual(mockItem);
  });

  it('should return null when not found', () => {
    mockGet.mockReturnValue(null);

    const result = getIntelItem('student-1', 'non-existent');

    expect(result).toBeNull();
  });
});

// ============================================================================
// getDailyFeed Tests
// ============================================================================

describe('getDailyFeed', () => {
  it('should return feed for today when no date provided', () => {
    const mockItems = [createMockIntelItem(), createMockIntelItem({ id: 'intel-456' })];
    mockAll.mockReturnValue(mockItems);
    mockGet.mockReturnValue({
      total: 2,
      completed: 1,
      xp_earned: 15,
      xp_available: 30,
    });

    const result = getDailyFeed('student-1');

    expect(result.date).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.completion_stats.total).toBe(2);
  });

  it('should return feed for specific date', () => {
    const mockItems = [createMockIntelItem()];
    mockAll.mockReturnValue(mockItems);
    mockGet.mockReturnValue({
      total: 1,
      completed: 0,
      xp_earned: 0,
      xp_available: 15,
    });

    const result = getDailyFeed('student-1', '2024-01-10');

    expect(result.date).toBe('2024-01-10');
    expect(result.items).toHaveLength(1);
  });

  it('should return empty feed when no items exist', () => {
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({
      total: 0,
      completed: 0,
      xp_earned: 0,
      xp_available: 0,
    });

    const result = getDailyFeed('student-1', '2024-01-01');

    expect(result.items).toHaveLength(0);
    expect(result.completion_stats.total).toBe(0);
  });
});

// ============================================================================
// viewIntelItem Tests
// ============================================================================

describe('viewIntelItem', () => {
  it('should mark item as viewed', () => {
    const viewedItem = createMockIntelItem({ status: 'viewed', viewed_at: Date.now() });
    mockGet.mockReturnValue(viewedItem);

    const result = viewIntelItem('student-1', 'intel-123');

    expect(mockRun).toHaveBeenCalled();
    expect(result.status).toBe('viewed');
  });

  it('should set viewed_at timestamp', () => {
    const viewedItem = createMockIntelItem({ status: 'viewed', viewed_at: 1705000000 });
    mockGet.mockReturnValue(viewedItem);

    const result = viewIntelItem('student-1', 'intel-123');

    expect(result.viewed_at).toBeDefined();
    expect(result.viewed_at).not.toBeNull();
  });
});

// ============================================================================
// completeIntelItem Tests
// ============================================================================

describe('completeIntelItem', () => {
  it('should complete item and award XP', () => {
    const pendingItem = createMockIntelItem({ status: 'viewed', xp_reward: 20 });
    const completedItem = createMockIntelItem({ status: 'completed', completed_at: Date.now() });
    mockGet.mockReturnValueOnce(pendingItem).mockReturnValueOnce(completedItem);

    const result = completeIntelItem('student-1', 'intel-123');

    expect(result.intel.status).toBe('completed');
    expect(result.xp_earned).toBe(20);
  });

  it('should return 0 XP if already completed', () => {
    const completedItem = createMockIntelItem({ status: 'completed' });
    mockGet.mockReturnValue(completedItem);

    const result = completeIntelItem('student-1', 'intel-123');

    expect(result.xp_earned).toBe(0);
  });

  it('should throw error if item not found', () => {
    mockGet.mockReturnValue(null);

    expect(() => {
      completeIntelItem('student-1', 'non-existent');
    }).toThrow('Intel item not found');
  });
});

// ============================================================================
// skipIntelItem Tests
// ============================================================================

describe('skipIntelItem', () => {
  it('should mark item as skipped', () => {
    const skippedItem = createMockIntelItem({ status: 'skipped' });
    mockGet.mockReturnValue(skippedItem);

    const result = skipIntelItem('student-1', 'intel-123');

    expect(mockRun).toHaveBeenCalled();
    expect(result.status).toBe('skipped');
  });
});

// ============================================================================
// getIntelHistory Tests
// ============================================================================

describe('getIntelHistory', () => {
  it('should return history for past 7 days by default', () => {
    const mockHistory = [
      { date: '2024-01-15', completed: 3, total: 5, xp_earned: 45 },
      { date: '2024-01-14', completed: 4, total: 5, xp_earned: 60 },
    ];
    mockAll.mockReturnValue(mockHistory);

    const result = getIntelHistory('student-1');

    expect(result).toHaveLength(2);
    expect(result[0].completed).toBe(3);
  });

  it('should return history for custom number of days', () => {
    const mockHistory = Array(14)
      .fill(null)
      .map((_, i) => ({
        date: `2024-01-${15 - i}`,
        completed: 3,
        total: 5,
        xp_earned: 45,
      }));
    mockAll.mockReturnValue(mockHistory);

    const result = getIntelHistory('student-1', 14);

    expect(mockAll).toHaveBeenCalled();
  });

  it('should return empty array when no history', () => {
    mockAll.mockReturnValue([]);

    const result = getIntelHistory('student-1');

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// generateDailyIntel Tests
// ============================================================================

describe('generateDailyIntel', () => {
  it('should return existing items if already generated', () => {
    mockGet.mockReturnValue({ count: 5 });
    mockAll.mockReturnValue([createMockIntelItem()]);

    const result = generateDailyIntel('student-1', '2024-01-15');

    // Should return existing items without generating new ones
    expect(result).toBeDefined();
  });

  it('should generate sample intel if pool is empty', () => {
    // First call: no existing items
    mockGet.mockReturnValueOnce({ count: 0 });
    // Pool is empty
    mockAll.mockReturnValueOnce([]);
    // Then: sample generation calls
    mockGet.mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(createMockIntelItem());

    const result = generateDailyIntel('student-1', '2024-01-15');

    expect(result).toBeDefined();
  });

  it('should generate intel from content pool', () => {
    // No existing items
    mockGet.mockReturnValueOnce({ count: 0 });
    // Pool has items
    mockAll.mockReturnValueOnce([
      {
        id: 'pool-1',
        title: 'Pool Video',
        summary: 'Summary',
        content_type: 'video',
        subject: 'math',
        difficulty: 'medium',
        source_url: null,
        source_name: null,
        thumbnail_url: null,
        estimated_time_minutes: 10,
        xp_reward: 15,
        tags: null,
        times_used: 0,
        last_used_date: null,
      },
      {
        id: 'pool-2',
        title: 'Pool Fact',
        summary: 'Fact summary',
        content_type: 'fact',
        subject: 'science',
        difficulty: 'easy',
        source_url: null,
        source_name: null,
        thumbnail_url: null,
        estimated_time_minutes: 2,
        xp_reward: 5,
        tags: null,
        times_used: 1,
        last_used_date: null,
      },
    ]);
    mockGet.mockReturnValue(createMockIntelItem());

    const result = generateDailyIntel('student-1', '2024-01-15');

    expect(result).toBeDefined();
  });
});

// ============================================================================
// generateSampleIntel Tests
// ============================================================================

describe('generateSampleIntel', () => {
  it('should return existing items if already generated', () => {
    mockGet.mockReturnValue({ count: 5 });
    const existingItems = [createMockIntelItem()];
    mockAll.mockReturnValue(existingItems);

    const result = generateSampleIntel('student-1', '2024-01-15');

    expect(result).toBeDefined();
  });

  it('should generate sample items for new date', () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockGet.mockReturnValue(createMockIntelItem());

    const result = generateSampleIntel('student-1', '2024-01-15');

    expect(result).toBeDefined();
    // Sample content should be created
    expect(mockRun).toHaveBeenCalled();
  });

  it('should create variety of content types', () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    mockGet.mockReturnValue(createMockIntelItem());

    generateSampleIntel('student-1');

    // Should call run multiple times for different content types
    expect(mockRun.mock.calls.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle null summary', () => {
    const item = createMockIntelItem({ summary: null });
    mockGet.mockReturnValue(item);

    const result = getIntelItem('student-1', 'intel-123');

    expect(result?.summary).toBeNull();
  });

  it('should handle null optional fields', () => {
    const item = createMockIntelItem({
      source_url: null,
      source_name: null,
      thumbnail_url: null,
      estimated_time_minutes: null,
      relevance_score: null,
      curation_reason: null,
    });
    mockGet.mockReturnValue(item);

    const result = getIntelItem('student-1', 'intel-123');

    expect(result?.source_url).toBeNull();
    expect(result?.source_name).toBeNull();
  });

  it('should handle all content types in feed', () => {
    const items: DailyIntel[] = [
      createMockIntelItem({ content_type: 'video' }),
      createMockIntelItem({ content_type: 'article', id: 'intel-2' }),
      createMockIntelItem({ content_type: 'quiz', id: 'intel-3' }),
      createMockIntelItem({ content_type: 'fact', id: 'intel-4' }),
      createMockIntelItem({ content_type: 'challenge', id: 'intel-5' }),
    ];
    mockAll.mockReturnValue(items);
    mockGet.mockReturnValue({ total: 5, completed: 0, xp_earned: 0, xp_available: 70 });

    const result = getDailyFeed('student-1');

    expect(result.items).toHaveLength(5);
  });

  it('should handle all difficulty levels', () => {
    const items: DailyIntel[] = [
      createMockIntelItem({ difficulty: 'easy' }),
      createMockIntelItem({ difficulty: 'medium', id: 'intel-2' }),
      createMockIntelItem({ difficulty: 'hard', id: 'intel-3' }),
    ];
    mockAll.mockReturnValue(items);
    mockGet.mockReturnValue({ total: 3, completed: 0, xp_earned: 0, xp_available: 45 });

    const result = getDailyFeed('student-1');

    expect(result.items).toHaveLength(3);
  });
});
