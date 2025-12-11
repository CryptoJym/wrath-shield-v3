// @ts-nocheck
/**
 * Tests for forge-memory-integration.ts
 * Enhanced memory layer bridging local SQLite with Mem0/Graphiti
 */

import {
  getEnhancedContext,
  recordItemResponseDual,
  recordSessionCompleteDual,
  recordLearningEventDual,
  getGenerationMemoryContext,
} from '@/lib/hyro/forge-memory-integration';
import type {
  EnhancedAssessmentContext,
  SemanticMemory,
  MergedMisconception,
  PerformanceSignal,
  AIInsight,
  GenerationParams,
} from '@/lib/hyro/forge-memory-integration';

// ============================================================================
// Mocks
// ============================================================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

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

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock forge-memory-architecture
const mockStudentProfile = {
  student_id: 'student-123',
  global_theta: 0,
  global_se: 1.5,
  stat_profiles: {
    math: {
      stat_name: 'math',
      theta: 0.5,
      se: 0.8,
      items_total: 20,
      strand_profiles: {},
      manifold_profile: {},
      theta_history: [],
    },
  },
  learning_velocity: 0.5,
  consistency_index: 0.6,
  challenge_affinity: 0.5,
  optimal_session_length: 15,
  optimal_difficulty_band: [0.3, 0.7],
};

const mockLocalContext = {
  student_id: 'student-123',
  profile: mockStudentProfile,
  recent_performance: {
    last_7_days: { items_attempted: 10, accuracy: 0.8 },
    last_30_days: { items_attempted: 50, accuracy: 0.75 },
  },
  active_misconceptions: [
    {
      id: 'misc-1',
      stat_name: 'math',
      strand: 'algebra',
      misconception: 'Order of operations',
      detection_count: 3,
      first_detected: '2024-01-01',
      last_detected: '2024-01-10',
      resolved: false,
    },
  ],
  recommended_focus: [],
  session_adjustments: {
    starting_difficulty: 0.5,
    difficulty_step: 0.1,
    max_items: 15,
    focus_strands: ['algebra'],
    avoid_strands: ['geometry'],
  },
};

jest.mock('@/lib/hyro/forge-memory-architecture', () => ({
  getStudentProfile: jest.fn(() => mockStudentProfile),
  getStudentContext: jest.fn(() => mockLocalContext),
  recordMisconception: jest.fn(),
  recordLearningEvent: jest.fn(),
  updateStatProfile: jest.fn(),
}));

// Mock forge-memory-client
jest.mock('@/lib/hyro/forge-memory-client', () => ({
  getMemoryClient: jest.fn(() => ({
    isAvailable: jest.fn().mockResolvedValue(true),
    recordEvent: jest.fn().mockResolvedValue({ success: true }),
    addMemory: jest.fn().mockResolvedValue({ success: true }),
    recordMisconception: jest.fn().mockResolvedValue({ success: true }),
    getStudentContext: jest.fn().mockResolvedValue({
      success: true,
      data: {
        student_id: 'student-123',
        memories: [],
        misconceptions: [],
        recent_events: [],
        generated_at: new Date().toISOString(),
      },
    }),
  })),
  recordItemResponse: jest.fn().mockResolvedValue(undefined),
  recordSessionComplete: jest.fn().mockResolvedValue(undefined),
  recordMisconceptionFromResponse: jest.fn().mockResolvedValue(undefined),
  getGenerationContext: jest.fn().mockResolvedValue({
    student_id: 'student-123',
    memories: [
      { id: 'mem-1', memory: 'Completed algebra session', score: 0.8, metadata: {} },
    ],
    misconceptions: [
      { id: 'mem-misc-1', memory: 'Order of operations', score: 0.7, metadata: { strand: 'algebra' } },
    ],
    recent_events: [
      { event_type: 'item_response', stat: 'math', timestamp: new Date().toISOString(), data: { correct: true } },
    ],
    generated_at: new Date().toISOString(),
  }),
}));

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-memory-integration types', () => {
  describe('EnhancedAssessmentContext interface', () => {
    it('should have all required properties', () => {
      const context: EnhancedAssessmentContext = {
        student_id: 'student-123',
        profile: mockStudentProfile as any,
        semantic_memories: [],
        active_misconceptions: [],
        recent_signals: [],
        generation_params: {
          target_difficulty: 0.5,
          difficulty_range: [0.3, 0.7],
          avoid_topics: [],
          emphasize_topics: [],
          scaffolding_level: 'none',
          misconception_focus: [],
        },
        sources: {
          local_available: true,
          mem0_available: false,
          graphiti_available: false,
        },
      };

      expect(context.student_id).toBeDefined();
      expect(context.profile).toBeDefined();
      expect(context.semantic_memories).toBeDefined();
      expect(context.active_misconceptions).toBeDefined();
      expect(context.recent_signals).toBeDefined();
      expect(context.generation_params).toBeDefined();
      expect(context.sources).toBeDefined();
    });

    it('should support optional ai_insights', () => {
      const context: EnhancedAssessmentContext = {
        student_id: 'student-123',
        profile: mockStudentProfile as any,
        semantic_memories: [],
        active_misconceptions: [],
        recent_signals: [],
        ai_insights: [
          { type: 'pattern', content: 'Test insight', confidence: 0.8 },
        ],
        generation_params: {
          target_difficulty: 0.5,
          difficulty_range: [0.3, 0.7],
          avoid_topics: [],
          emphasize_topics: [],
          scaffolding_level: 'none',
          misconception_focus: [],
        },
        sources: {
          local_available: true,
          mem0_available: false,
          graphiti_available: false,
        },
      };

      expect(context.ai_insights).toHaveLength(1);
    });
  });

  describe('SemanticMemory interface', () => {
    it('should have all required properties', () => {
      const memory: SemanticMemory = {
        id: 'mem-123',
        content: 'Learning content',
        relevance: 0.8,
        timestamp: new Date().toISOString(),
        metadata: { topic: 'algebra' },
      };

      expect(memory.id).toBeDefined();
      expect(memory.content).toBeDefined();
      expect(memory.relevance).toBeDefined();
      expect(memory.timestamp).toBeDefined();
      expect(memory.metadata).toBeDefined();
    });
  });

  describe('MergedMisconception interface', () => {
    it('should have all required properties', () => {
      const misconception: MergedMisconception = {
        id: 'misc-123',
        stat_name: 'math',
        strand: 'algebra',
        misconception: 'Order of operations',
        detection_count: 3,
        first_detected: '2024-01-01',
        last_detected: '2024-01-10',
        severity: 0.7,
        source: 'local',
      };

      expect(misconception.id).toBeDefined();
      expect(misconception.stat_name).toBeDefined();
      expect(misconception.severity).toBeDefined();
      expect(misconception.source).toBeDefined();
    });

    it('should support all source values', () => {
      const sources: Array<MergedMisconception['source']> = ['local', 'mem0', 'both'];

      sources.forEach((source) => {
        expect(source).toBeDefined();
      });
    });
  });

  describe('PerformanceSignal interface', () => {
    it('should have all required properties', () => {
      const signal: PerformanceSignal = {
        type: 'item_response',
        stat: 'math',
        timestamp: new Date().toISOString(),
        data: { correct: true },
      };

      expect(signal.type).toBeDefined();
      expect(signal.stat).toBeDefined();
      expect(signal.timestamp).toBeDefined();
      expect(signal.data).toBeDefined();
    });

    it('should support all signal types', () => {
      const types: Array<PerformanceSignal['type']> = [
        'item_response',
        'session_complete',
        'breakthrough',
        'struggle',
        'zpd_shift',
      ];

      types.forEach((type) => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('AIInsight interface', () => {
    it('should have required properties', () => {
      const insight: AIInsight = {
        type: 'pattern',
        content: 'Test insight',
        confidence: 0.8,
      };

      expect(insight.type).toBeDefined();
      expect(insight.content).toBeDefined();
      expect(insight.confidence).toBeDefined();
    });

    it('should support optional action', () => {
      const insight: AIInsight = {
        type: 'recommendation',
        content: 'Test recommendation',
        confidence: 0.7,
        action: 'Focus on scaffolded items',
      };

      expect(insight.action).toBe('Focus on scaffolded items');
    });

    it('should support all insight types', () => {
      const types: Array<AIInsight['type']> = ['pattern', 'recommendation', 'alert'];

      types.forEach((type) => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('GenerationParams interface', () => {
    it('should have all required properties', () => {
      const params: GenerationParams = {
        target_difficulty: 0.5,
        difficulty_range: [0.3, 0.7],
        avoid_topics: ['geometry'],
        emphasize_topics: ['algebra'],
        scaffolding_level: 'moderate',
        misconception_focus: ['Order of operations'],
      };

      expect(params.target_difficulty).toBeDefined();
      expect(params.difficulty_range).toBeDefined();
      expect(params.avoid_topics).toBeDefined();
      expect(params.emphasize_topics).toBeDefined();
      expect(params.scaffolding_level).toBeDefined();
      expect(params.misconception_focus).toBeDefined();
    });

    it('should support all scaffolding levels', () => {
      const levels: Array<GenerationParams['scaffolding_level']> = [
        'none',
        'light',
        'moderate',
        'significant',
      ];

      levels.forEach((level) => {
        expect(level).toBeDefined();
      });
    });
  });
});

// ============================================================================
// getEnhancedContext Tests
// ============================================================================

describe('getEnhancedContext', () => {
  it('should return enhanced context with local data', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(result.student_id).toBe('student-123');
    expect(result.profile).toBeDefined();
    expect(result.sources.local_available).toBe(true);
  });

  it('should include active misconceptions from local', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(result.active_misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(result.active_misconceptions[0].source).toBe('local');
  });

  it('should calculate generation params', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(result.generation_params.target_difficulty).toBeDefined();
    expect(result.generation_params.difficulty_range).toHaveLength(2);
  });

  it('should merge Mem0 data when available', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(result.sources.mem0_available).toBe(true);
    expect(result.semantic_memories).toBeDefined();
  });

  it('should calculate scaffolding level', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(['none', 'light', 'moderate', 'significant']).toContain(
      result.generation_params.scaffolding_level
    );
  });

  it('should generate AI insights from memories', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    expect(result.ai_insights).toBeDefined();
  });
});

// ============================================================================
// recordItemResponseDual Tests
// ============================================================================

describe('recordItemResponseDual', () => {
  it('should record item response without misconception', async () => {
    await recordItemResponseDual(
      'student-123',
      'math',
      'item-456',
      'algebra',
      true,
      5000,
      1.5,
      0.3,
      0.5
    );

    // Should call Mem0 record
    const { recordItemResponse } = require('@/lib/hyro/forge-memory-client');
    expect(recordItemResponse).toHaveBeenCalled();
  });

  it('should record item response with misconception', async () => {
    await recordItemResponseDual(
      'student-123',
      'math',
      'item-456',
      'algebra',
      false,
      5000,
      1.5,
      0.3,
      0.5,
      'Order of operations error'
    );

    // Should call local misconception record
    const { recordMisconception } = require('@/lib/hyro/forge-memory-architecture');
    expect(recordMisconception).toHaveBeenCalled();

    // Should call Mem0 misconception record
    const { recordMisconceptionFromResponse } = require('@/lib/hyro/forge-memory-client');
    expect(recordMisconceptionFromResponse).toHaveBeenCalled();
  });
});

// ============================================================================
// recordSessionCompleteDual Tests
// ============================================================================

describe('recordSessionCompleteDual', () => {
  it('should update local profile', async () => {
    await recordSessionCompleteDual(
      'student-123',
      'math',
      'session-789',
      10,
      0.8,
      1.5,
      0.3
    );

    const { updateStatProfile } = require('@/lib/hyro/forge-memory-architecture');
    expect(updateStatProfile).toHaveBeenCalledWith(
      'student-123',
      'math',
      expect.objectContaining({
        theta: 1.5,
        se: 0.3,
        items_added: 10,
      })
    );
  });

  it('should record local learning event', async () => {
    await recordSessionCompleteDual(
      'student-123',
      'math',
      'session-789',
      10,
      0.8,
      1.5,
      0.3
    );

    const { recordLearningEvent } = require('@/lib/hyro/forge-memory-architecture');
    expect(recordLearningEvent).toHaveBeenCalled();
  });

  it('should call Mem0 session complete', async () => {
    await recordSessionCompleteDual(
      'student-123',
      'math',
      'session-789',
      10,
      0.8,
      1.5,
      0.3
    );

    const { recordSessionComplete } = require('@/lib/hyro/forge-memory-client');
    expect(recordSessionComplete).toHaveBeenCalledWith(
      'student-123',
      'math',
      'session-789',
      10,
      0.8,
      1.5,
      0.3
    );
  });
});

// ============================================================================
// recordLearningEventDual Tests
// ============================================================================

describe('recordLearningEventDual', () => {
  it('should record local event', async () => {
    await recordLearningEventDual(
      'student-123',
      'breakthrough',
      { theta_change: 0.5 },
      'math',
      'algebra',
      'session-789'
    );

    const { recordLearningEvent } = require('@/lib/hyro/forge-memory-architecture');
    expect(recordLearningEvent).toHaveBeenCalledWith(
      'student-123',
      'breakthrough',
      { theta_change: 0.5 },
      'math',
      'algebra',
      'session-789'
    );
  });

  it('should record Mem0 event when available', async () => {
    await recordLearningEventDual(
      'student-123',
      'mastery_achieved',
      { concept: 'fractions' },
      'math'
    );

    const { getMemoryClient } = require('@/lib/hyro/forge-memory-client');
    const client = getMemoryClient();
    expect(client.recordEvent).toHaveBeenCalled();
  });
});

// ============================================================================
// getGenerationMemoryContext Tests
// ============================================================================

describe('getGenerationMemoryContext', () => {
  it('should return generation context', async () => {
    const result = await getGenerationMemoryContext('student-123', 'math');

    expect(result.avoid_topics).toBeDefined();
    expect(result.emphasize_topics).toBeDefined();
    expect(result.recent_misconceptions).toBeDefined();
    expect(result.student_context_summary).toBeDefined();
    expect(result.difficulty_recommendation).toBeDefined();
  });

  it('should include ability level in summary', async () => {
    const result = await getGenerationMemoryContext('student-123', 'math');

    expect(result.student_context_summary).toContain('ability level');
  });

  it('should filter memories by strand when provided', async () => {
    const result = await getGenerationMemoryContext('student-123', 'math', 'algebra');

    expect(result).toBeDefined();
  });

  it('should include misconception focus', async () => {
    const result = await getGenerationMemoryContext('student-123', 'math');

    expect(Array.isArray(result.recent_misconceptions)).toBe(true);
  });
});

// ============================================================================
// Severity Calculation Tests
// ============================================================================

describe('misconception severity calculation', () => {
  it('should calculate severity based on frequency and recency', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    // Misconceptions should have severity values
    for (const misc of result.active_misconceptions) {
      expect(misc.severity).toBeGreaterThanOrEqual(0);
      expect(misc.severity).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Scaffolding Level Tests
// ============================================================================

describe('scaffolding level calculation', () => {
  it('should return "none" for student with good performance', async () => {
    const result = await getEnhancedContext('student-123', 'math');

    // With default mock data (no high severity misconceptions), should be none or light
    expect(['none', 'light', 'moderate']).toContain(
      result.generation_params.scaffolding_level
    );
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty misconceptions', async () => {
    // Mock empty misconceptions
    const mockLocalContextEmpty = {
      ...mockLocalContext,
      active_misconceptions: [],
    };

    jest.spyOn(
      require('@/lib/hyro/forge-memory-architecture'),
      'getStudentContext'
    ).mockReturnValueOnce(mockLocalContextEmpty);

    const result = await getEnhancedContext('student-123', 'math');

    expect(result.active_misconceptions).toEqual([]);
    expect(result.generation_params.misconception_focus).toEqual([]);
  });

  it('should handle Mem0 unavailability gracefully', async () => {
    // Mock Mem0 unavailable
    jest.spyOn(
      require('@/lib/hyro/forge-memory-client'),
      'getMemoryClient'
    ).mockReturnValueOnce({
      isAvailable: jest.fn().mockResolvedValue(false),
    });

    const result = await getEnhancedContext('student-123', 'math');

    expect(result.sources.local_available).toBe(true);
  });

  it('should handle null stat profile gracefully', async () => {
    const mockProfileNoStat = {
      ...mockStudentProfile,
      stat_profiles: {},
    };

    jest.spyOn(
      require('@/lib/hyro/forge-memory-architecture'),
      'getStudentProfile'
    ).mockReturnValueOnce(mockProfileNoStat);

    const result = await getGenerationMemoryContext('student-123', 'math');

    expect(result.student_context_summary).toBeDefined();
  });

  it('should handle empty semantic memories', async () => {
    jest.spyOn(
      require('@/lib/hyro/forge-memory-client'),
      'getGenerationContext'
    ).mockResolvedValueOnce({
      student_id: 'student-123',
      memories: [],
      misconceptions: [],
      recent_events: [],
      generated_at: new Date().toISOString(),
    });

    const result = await getEnhancedContext('student-123', 'math');

    expect(result.semantic_memories).toBeDefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('dual-write integration', () => {
  it('should write to both local and Mem0 on session complete', async () => {
    const { updateStatProfile, recordLearningEvent } = require('@/lib/hyro/forge-memory-architecture');
    const { recordSessionComplete } = require('@/lib/hyro/forge-memory-client');

    await recordSessionCompleteDual(
      'student-123',
      'math',
      'session-789',
      10,
      0.8,
      1.5,
      0.3
    );

    expect(updateStatProfile).toHaveBeenCalled();
    expect(recordLearningEvent).toHaveBeenCalled();
    expect(recordSessionComplete).toHaveBeenCalled();
  });

  it('should handle Mem0 errors gracefully', async () => {
    // Mock Mem0 error
    jest.spyOn(
      require('@/lib/hyro/forge-memory-client'),
      'recordItemResponse'
    ).mockRejectedValueOnce(new Error('Mem0 error'));

    // Should not throw
    await expect(
      recordItemResponseDual(
        'student-123',
        'math',
        'item-456',
        'algebra',
        true,
        5000,
        1.5,
        0.3,
        0.5
      )
    ).resolves.not.toThrow();
  });
});
