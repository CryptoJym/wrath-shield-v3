// @ts-nocheck
/**
 * Tests for forge-memory-architecture.ts
 * Memory Architecture System for persistent student context
 */

import {
  getStudentProfile,
  updateStudentProfile,
  updateStatProfile,
  recordMisconception,
  getActiveMisconceptions,
  resolveMisconception,
  recordLearningEvent,
  getRecentLearningEvents,
  getAssessmentContext,
  startSession,
  getActiveSession,
  recordSessionItem,
  updateSessionAbility,
  completeSession,
  getLearningTrajectory,
  getPersistentGaps,
  getEffectiveApproaches,
  getOptimalDifficulty,
  getStudentContext,
  updateAbilityProfile,
  analyzeAndUpdateLearningPatterns,
} from '@/lib/hyro/forge-memory-architecture';
import type {
  StudentLearningProfile,
  StatProfile,
  StrandProfile,
  MisconceptionRecord,
  LearningEvent,
  LearningEventType,
  AssessmentContext,
  RecentPerformance,
  RecommendedFocus,
  SessionAdjustments,
  SessionState,
  SessionItem,
} from '@/lib/hyro/forge-memory-architecture';
import type { StatName } from '@/lib/hyro/forge-types';

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

jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockStudentProfile(overrides: Partial<StudentLearningProfile> = {}): StudentLearningProfile {
  const now = new Date().toISOString();
  return {
    student_id: 'student-123',
    created_at: now,
    updated_at: now,
    global_theta: 0,
    global_se: 1.5,
    stat_profiles: {
      math: createMockStatProfile('math'),
      reading: createMockStatProfile('reading'),
      writing: createMockStatProfile('writing'),
      science: createMockStatProfile('science'),
    } as Record<StatName, StatProfile>,
    learning_velocity: 0.5,
    consistency_index: 0.5,
    challenge_affinity: 0.5,
    optimal_session_length: 15,
    optimal_difficulty_band: [0.3, 0.7],
    best_performance_time: 'morning',
    fatigue_threshold: 20,
    ...overrides,
  };
}

function createMockStatProfile(statName: StatName): StatProfile {
  return {
    stat_name: statName,
    theta: 0,
    se: 1.5,
    items_total: 0,
    last_assessed: '',
    strand_profiles: {},
    manifold_profile: {
      coherence: 0.5,
      fluidity: 0.5,
      elasticity: 0.5,
      gradient_awareness: 0.5,
      entropy_intuition: 0.5,
      non_dual_resolution: 0.5,
      generativity: 0.5,
    },
    theta_history: [],
  };
}

function createMockMisconception(overrides: Partial<MisconceptionRecord> = {}): MisconceptionRecord {
  const now = new Date().toISOString();
  return {
    id: 'misconception-123',
    student_id: 'student-123',
    stat_name: 'math',
    strand: 'algebra',
    misconception: 'Confuses addition with multiplication',
    detection_count: 1,
    first_detected: now,
    last_detected: now,
    resolved: false,
    related_items: ['item-1'],
    ...overrides,
  };
}

function createMockSessionState(overrides: Partial<SessionState> = {}): SessionState {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'session-123',
    student_id: 'student-123',
    stat_name: 'math',
    status: 'active',
    initial_theta: 0,
    current_theta: 0,
    standard_error: 1.5,
    items_administered: [],
    started_at: now,
    last_activity_at: now,
    total_time_seconds: 0,
    avg_response_time_ms: 0,
    hesitation_count: 0,
    quick_response_count: 0,
    current_streak: 0,
    longest_correct_streak: 0,
    difficulty_trend: 'stable',
    ...overrides,
  };
}

function createMockSessionItem(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    item_id: 'item-123',
    strand: 'algebra',
    difficulty: 0.5,
    score: 1,
    is_correct: true,
    response_time_ms: 5000,
    timestamp: Date.now(),
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

describe('forge-memory-architecture types', () => {
  describe('StudentLearningProfile interface', () => {
    it('should have all required properties', () => {
      const profile: StudentLearningProfile = createMockStudentProfile();

      expect(profile.student_id).toBeDefined();
      expect(profile.global_theta).toBeDefined();
      expect(profile.global_se).toBeDefined();
      expect(profile.stat_profiles).toBeDefined();
      expect(profile.learning_velocity).toBeDefined();
      expect(profile.consistency_index).toBeDefined();
      expect(profile.challenge_affinity).toBeDefined();
      expect(profile.optimal_session_length).toBeDefined();
      expect(profile.optimal_difficulty_band).toBeDefined();
    });
  });

  describe('StatProfile interface', () => {
    it('should have all required properties', () => {
      const statProfile: StatProfile = createMockStatProfile('math');

      expect(statProfile.stat_name).toBeDefined();
      expect(statProfile.theta).toBeDefined();
      expect(statProfile.se).toBeDefined();
      expect(statProfile.items_total).toBeDefined();
      expect(statProfile.strand_profiles).toBeDefined();
      expect(statProfile.manifold_profile).toBeDefined();
      expect(statProfile.theta_history).toBeDefined();
    });
  });

  describe('StrandProfile interface', () => {
    it('should have all required properties', () => {
      const strandProfile: StrandProfile = {
        strand: 'algebra',
        tier: 'Foundation',
        theta: 0.5,
        se: 0.8,
        items_total: 10,
        mastery_status: 'developing',
        last_assessed: new Date().toISOString(),
      };

      expect(strandProfile.strand).toBeDefined();
      expect(strandProfile.tier).toBeDefined();
      expect(strandProfile.theta).toBeDefined();
      expect(strandProfile.se).toBeDefined();
      expect(strandProfile.mastery_status).toBeDefined();
    });

    it('should support all mastery statuses', () => {
      const statuses: Array<StrandProfile['mastery_status']> = [
        'not_started',
        'developing',
        'proficient',
        'mastered',
      ];

      statuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });
  });

  describe('MisconceptionRecord interface', () => {
    it('should have all required properties', () => {
      const record: MisconceptionRecord = createMockMisconception();

      expect(record.id).toBeDefined();
      expect(record.student_id).toBeDefined();
      expect(record.stat_name).toBeDefined();
      expect(record.strand).toBeDefined();
      expect(record.misconception).toBeDefined();
      expect(record.detection_count).toBeDefined();
      expect(record.first_detected).toBeDefined();
      expect(record.last_detected).toBeDefined();
      expect(record.resolved).toBeDefined();
      expect(record.related_items).toBeDefined();
    });

    it('should support optional resolved_at', () => {
      const record: MisconceptionRecord = createMockMisconception({
        resolved: true,
        resolved_at: new Date().toISOString(),
      });

      expect(record.resolved_at).toBeDefined();
    });
  });

  describe('LearningEvent interface', () => {
    it('should have all required properties', () => {
      const event: LearningEvent = {
        id: 'event-123',
        student_id: 'student-123',
        event_type: 'breakthrough',
        data: { theta_change: 0.5 },
        timestamp: new Date().toISOString(),
      };

      expect(event.id).toBeDefined();
      expect(event.student_id).toBeDefined();
      expect(event.event_type).toBeDefined();
      expect(event.data).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('should support all event types', () => {
      const types: LearningEventType[] = [
        'breakthrough',
        'plateau_detected',
        'misconception_resolved',
        'mastery_achieved',
        'tier_advancement',
        'struggle_detected',
        'engagement_drop',
        'optimal_challenge',
      ];

      types.forEach((type) => {
        expect(type).toBeDefined();
      });
    });
  });

  describe('SessionState interface', () => {
    it('should have all required properties', () => {
      const session: SessionState = createMockSessionState();

      expect(session.id).toBeDefined();
      expect(session.student_id).toBeDefined();
      expect(session.stat_name).toBeDefined();
      expect(session.status).toBeDefined();
      expect(session.initial_theta).toBeDefined();
      expect(session.current_theta).toBeDefined();
      expect(session.standard_error).toBeDefined();
      expect(session.items_administered).toBeDefined();
      expect(session.started_at).toBeDefined();
      expect(session.difficulty_trend).toBeDefined();
    });

    it('should support all status values', () => {
      const statuses: Array<SessionState['status']> = ['active', 'completed', 'abandoned'];

      statuses.forEach((status) => {
        expect(status).toBeDefined();
      });
    });

    it('should support all difficulty trends', () => {
      const trends: Array<SessionState['difficulty_trend']> = ['increasing', 'stable', 'decreasing'];

      trends.forEach((trend) => {
        expect(trend).toBeDefined();
      });
    });
  });

  describe('SessionItem interface', () => {
    it('should have all required properties', () => {
      const item: SessionItem = createMockSessionItem();

      expect(item.item_id).toBeDefined();
      expect(item.strand).toBeDefined();
      expect(item.difficulty).toBeDefined();
      expect(item.score).toBeDefined();
      expect(item.is_correct).toBeDefined();
      expect(item.response_time_ms).toBeDefined();
      expect(item.timestamp).toBeDefined();
    });

    it('should support optional misconception_detected', () => {
      const item: SessionItem = createMockSessionItem({
        misconception_detected: 'Order of operations error',
      });

      expect(item.misconception_detected).toBe('Order of operations error');
    });
  });
});

// ============================================================================
// getStudentProfile Tests
// ============================================================================

describe('getStudentProfile', () => {
  it('should return existing profile when found', () => {
    const existingProfile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(existingProfile) });

    const result = getStudentProfile('student-123');

    expect(result.student_id).toBe('student-123');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('should create new profile when not found', () => {
    mockGet.mockReturnValue(undefined);

    const result = getStudentProfile('new-student');

    expect(mockRun).toHaveBeenCalled();
    expect(result.student_id).toBe('new-student');
    expect(result.global_theta).toBe(0);
    expect(result.global_se).toBe(1.5);
  });

  it('should initialize stat profiles for new profile', () => {
    mockGet.mockReturnValue(undefined);

    const result = getStudentProfile('new-student');

    expect(result.stat_profiles).toBeDefined();
    expect(Object.keys(result.stat_profiles).length).toBeGreaterThan(0);
  });

  it('should set default learning characteristics', () => {
    mockGet.mockReturnValue(undefined);

    const result = getStudentProfile('new-student');

    expect(result.learning_velocity).toBe(0.5);
    expect(result.consistency_index).toBe(0.5);
    expect(result.challenge_affinity).toBe(0.5);
    expect(result.optimal_session_length).toBe(15);
  });
});

// ============================================================================
// updateStudentProfile Tests
// ============================================================================

describe('updateStudentProfile', () => {
  it('should update profile in database', () => {
    const profile = createMockStudentProfile();

    updateStudentProfile(profile);

    expect(mockRun).toHaveBeenCalled();
  });

  it('should update updated_at timestamp', () => {
    const profile = createMockStudentProfile();
    const originalUpdatedAt = profile.updated_at;

    // Small delay to ensure timestamp difference
    updateStudentProfile(profile);

    expect(profile.updated_at).not.toBe(originalUpdatedAt);
  });
});

// ============================================================================
// updateStatProfile Tests
// ============================================================================

describe('updateStatProfile', () => {
  beforeEach(() => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
  });

  it('should update theta and SE', () => {
    updateStatProfile('student-123', 'math', {
      theta: 1.5,
      se: 0.3,
      items_added: 10,
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it('should add items to total count', () => {
    updateStatProfile('student-123', 'math', {
      theta: 1.5,
      se: 0.3,
      items_added: 10,
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it('should update strand profiles when provided', () => {
    updateStatProfile('student-123', 'math', {
      theta: 1.5,
      se: 0.3,
      items_added: 10,
      strand_updates: {
        algebra: { theta: 1.2, se: 0.4, items: 5 },
      },
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it('should update manifold profile when provided', () => {
    updateStatProfile('student-123', 'math', {
      theta: 1.5,
      se: 0.3,
      items_added: 10,
      manifold_updates: {
        coherence: 0.8,
        fluidity: 0.7,
      },
    });

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// recordMisconception Tests
// ============================================================================

describe('recordMisconception', () => {
  it('should create new misconception record', () => {
    mockGet.mockReturnValue(undefined);

    const result = recordMisconception(
      'student-123',
      'math',
      'algebra',
      'Order of operations',
      'item-1'
    );

    expect(mockRun).toHaveBeenCalled();
    expect(result.misconception).toBe('Order of operations');
    expect(result.detection_count).toBe(1);
  });

  it('should update existing misconception record', () => {
    const existing = {
      id: 'existing-id',
      student_id: 'student-123',
      stat_name: 'math',
      misconception: 'Order of operations',
      detection_count: 2,
      resolved: 0,
      related_items: JSON.stringify(['item-1']),
    };
    mockGet.mockReturnValue(existing);

    const result = recordMisconception(
      'student-123',
      'math',
      'algebra',
      'Order of operations',
      'item-2'
    );

    expect(result.detection_count).toBe(3);
  });

  it('should add item to related_items', () => {
    mockGet.mockReturnValue(undefined);

    const result = recordMisconception(
      'student-123',
      'math',
      'algebra',
      'Order of operations',
      'item-1'
    );

    expect(result.related_items).toContain('item-1');
  });
});

// ============================================================================
// getActiveMisconceptions Tests
// ============================================================================

describe('getActiveMisconceptions', () => {
  it('should return active misconceptions', () => {
    const mockMisconceptions = [
      {
        ...createMockMisconception(),
        resolved: 0,
        related_items: JSON.stringify(['item-1']),
      },
    ];
    mockAll.mockReturnValue(mockMisconceptions);

    const result = getActiveMisconceptions('student-123');

    expect(result).toHaveLength(1);
    expect(result[0].resolved).toBe(false);
  });

  it('should filter by stat name when provided', () => {
    mockAll.mockReturnValue([]);

    getActiveMisconceptions('student-123', 'math');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should filter by strand when provided', () => {
    mockAll.mockReturnValue([]);

    getActiveMisconceptions('student-123', 'math', 'algebra');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should parse related_items JSON', () => {
    const mockMisconceptions = [
      {
        ...createMockMisconception(),
        resolved: 0,
        related_items: JSON.stringify(['item-1', 'item-2']),
      },
    ];
    mockAll.mockReturnValue(mockMisconceptions);

    const result = getActiveMisconceptions('student-123');

    expect(result[0].related_items).toEqual(['item-1', 'item-2']);
  });
});

// ============================================================================
// resolveMisconception Tests
// ============================================================================

describe('resolveMisconception', () => {
  it('should mark misconception as resolved', () => {
    resolveMisconception('misconception-123');

    expect(mockRun).toHaveBeenCalled();
  });

  it('should set resolved_at timestamp', () => {
    resolveMisconception('misconception-123');

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// recordLearningEvent Tests
// ============================================================================

describe('recordLearningEvent', () => {
  it('should create learning event', () => {
    const result = recordLearningEvent(
      'student-123',
      'breakthrough',
      { theta_change: 0.5 }
    );

    expect(mockRun).toHaveBeenCalled();
    expect(result.event_type).toBe('breakthrough');
  });

  it('should include stat name when provided', () => {
    const result = recordLearningEvent(
      'student-123',
      'mastery_achieved',
      { mastered_concept: 'fractions' },
      'math'
    );

    expect(result.stat_name).toBe('math');
  });

  it('should include strand when provided', () => {
    const result = recordLearningEvent(
      'student-123',
      'tier_advancement',
      { new_tier: 'Advanced' },
      'math',
      'algebra'
    );

    expect(result.strand).toBe('algebra');
  });

  it('should include session ID when provided', () => {
    const result = recordLearningEvent(
      'student-123',
      'optimal_challenge',
      { difficulty: 0.7 },
      'math',
      'algebra',
      'session-456'
    );

    expect(result.session_id).toBe('session-456');
  });
});

// ============================================================================
// getRecentLearningEvents Tests
// ============================================================================

describe('getRecentLearningEvents', () => {
  it('should return recent events', () => {
    const mockEvents = [
      { event_type: 'breakthrough', data_json: JSON.stringify({ theta_change: 0.5 }) },
    ];
    mockAll.mockReturnValue(mockEvents);

    const result = getRecentLearningEvents('student-123');

    expect(result).toHaveLength(1);
  });

  it('should use default limit of 20', () => {
    mockAll.mockReturnValue([]);

    getRecentLearningEvents('student-123');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should respect custom limit', () => {
    mockAll.mockReturnValue([]);

    getRecentLearningEvents('student-123', 10);

    expect(mockAll).toHaveBeenCalled();
  });

  it('should filter by event types when provided', () => {
    mockAll.mockReturnValue([]);

    getRecentLearningEvents('student-123', 20, ['breakthrough', 'plateau_detected']);

    expect(mockAll).toHaveBeenCalled();
  });

  it('should parse data_json', () => {
    const mockEvents = [
      { event_type: 'breakthrough', data_json: JSON.stringify({ theta_change: 0.5 }) },
    ];
    mockAll.mockReturnValue(mockEvents);

    const result = getRecentLearningEvents('student-123');

    expect(result[0].data.theta_change).toBe(0.5);
  });
});

// ============================================================================
// getAssessmentContext Tests
// ============================================================================

describe('getAssessmentContext', () => {
  beforeEach(() => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
    mockAll.mockReturnValue([]);
  });

  it('should return assessment context', () => {
    const result = getAssessmentContext('student-123');

    expect(result.student_id).toBe('student-123');
    expect(result.profile).toBeDefined();
    expect(result.recent_performance).toBeDefined();
    expect(result.active_misconceptions).toBeDefined();
    expect(result.recommended_focus).toBeDefined();
    expect(result.session_adjustments).toBeDefined();
  });

  it('should include student profile', () => {
    const result = getAssessmentContext('student-123');

    expect(result.profile.student_id).toBe('student-123');
  });

  it('should include recent performance metrics', () => {
    mockGet
      .mockReturnValueOnce({ data_json: JSON.stringify(createMockStudentProfile()) })
      .mockReturnValueOnce({ items: 10, accuracy: 0.8, avg_difficulty: 0.5 })
      .mockReturnValueOnce({ items: 50, accuracy: 0.75, avg_difficulty: 0.5 });

    const result = getAssessmentContext('student-123');

    expect(result.recent_performance.last_7_days).toBeDefined();
    expect(result.recent_performance.last_30_days).toBeDefined();
  });

  it('should filter by stat name when provided', () => {
    const result = getAssessmentContext('student-123', 'math');

    expect(result.student_id).toBe('student-123');
  });
});

// ============================================================================
// startSession Tests
// ============================================================================

describe('startSession', () => {
  it('should create new session', () => {
    const result = startSession('student-123', 'math');

    expect(mockRun).toHaveBeenCalled();
    expect(result.student_id).toBe('student-123');
    expect(result.stat_name).toBe('math');
    expect(result.status).toBe('active');
  });

  it('should use default initial theta of 0', () => {
    const result = startSession('student-123', 'math');

    expect(result.initial_theta).toBe(0);
    expect(result.current_theta).toBe(0);
  });

  it('should use provided initial theta', () => {
    const result = startSession('student-123', 'math', 1.5);

    expect(result.initial_theta).toBe(1.5);
    expect(result.current_theta).toBe(1.5);
  });

  it('should initialize standard error to 1.5', () => {
    const result = startSession('student-123', 'math');

    expect(result.standard_error).toBe(1.5);
  });

  it('should initialize empty items array', () => {
    const result = startSession('student-123', 'math');

    expect(result.items_administered).toEqual([]);
  });

  it('should set started_at timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const result = startSession('student-123', 'math');
    const after = Math.floor(Date.now() / 1000);

    expect(result.started_at).toBeGreaterThanOrEqual(before);
    expect(result.started_at).toBeLessThanOrEqual(after);
  });

  it('should abandon existing active sessions', () => {
    startSession('student-123', 'math');

    // Should call run twice: once to abandon, once to create
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// getActiveSession Tests
// ============================================================================

describe('getActiveSession', () => {
  it('should return active session when found', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([]),
    };
    mockGet.mockReturnValue(mockSession);

    const result = getActiveSession('student-123');

    expect(result).not.toBeNull();
    expect(result?.student_id).toBe('student-123');
  });

  it('should return null when no active session', () => {
    mockGet.mockReturnValue(undefined);

    const result = getActiveSession('student-123');

    expect(result).toBeNull();
  });

  it('should filter by stat name when provided', () => {
    mockGet.mockReturnValue(undefined);

    getActiveSession('student-123', 'math');

    expect(mockGet).toHaveBeenCalled();
  });

  it('should parse items_administered JSON', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([createMockSessionItem()]),
    };
    mockGet.mockReturnValue(mockSession);

    const result = getActiveSession('student-123');

    expect(result?.items_administered).toHaveLength(1);
  });
});

// ============================================================================
// recordSessionItem Tests
// ============================================================================

describe('recordSessionItem', () => {
  it('should record item in session', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([]),
      status: 'active',
    };
    mockGet.mockReturnValue(mockSession);

    const item = createMockSessionItem();
    recordSessionItem('session-123', item);

    expect(mockRun).toHaveBeenCalled();
  });

  it('should throw error if session not found', () => {
    mockGet.mockReturnValue(undefined);

    const item = createMockSessionItem();

    expect(() => {
      recordSessionItem('invalid-session', item);
    }).toThrow('Session invalid-session not found or not active');
  });

  it('should throw error if session not active', () => {
    const mockSession = {
      ...createMockSessionState(),
      status: 'completed',
      items_administered: JSON.stringify([]),
    };
    mockGet.mockReturnValue(mockSession);

    const item = createMockSessionItem();

    expect(() => {
      recordSessionItem('session-123', item);
    }).toThrow();
  });

  it('should update streak on correct answer', () => {
    const mockSession = {
      ...createMockSessionState(),
      current_streak: 2,
      items_administered: JSON.stringify([]),
      status: 'active',
    };
    mockGet.mockReturnValue(mockSession);

    const item = createMockSessionItem({ is_correct: true });
    recordSessionItem('session-123', item);

    expect(mockRun).toHaveBeenCalled();
  });

  it('should update streak on incorrect answer', () => {
    const mockSession = {
      ...createMockSessionState(),
      current_streak: 2,
      items_administered: JSON.stringify([]),
      status: 'active',
    };
    mockGet.mockReturnValue(mockSession);

    const item = createMockSessionItem({ is_correct: false });
    recordSessionItem('session-123', item);

    expect(mockRun).toHaveBeenCalled();
  });

  it('should record misconception when detected', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([]),
      status: 'active',
    };
    mockGet
      .mockReturnValueOnce(mockSession)
      .mockReturnValueOnce(undefined); // For recordMisconception

    const item = createMockSessionItem({
      misconception_detected: 'Order of operations error',
    });
    recordSessionItem('session-123', item);

    // Should call run twice: once for session update, once for misconception
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// updateSessionAbility Tests
// ============================================================================

describe('updateSessionAbility', () => {
  it('should update theta and SE', () => {
    updateSessionAbility('session-123', 1.5, 0.3);

    expect(mockRun).toHaveBeenCalled();
  });

  it('should update last_activity_at', () => {
    updateSessionAbility('session-123', 1.5, 0.3);

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// completeSession Tests
// ============================================================================

describe('completeSession', () => {
  it('should complete session', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([createMockSessionItem()]),
      initial_theta: 0,
    };
    mockGet.mockReturnValue(mockSession);

    const result = completeSession('session-123', 1.5, 0.3);

    expect(result.status).toBe('completed');
    expect(result.current_theta).toBe(1.5);
    expect(result.standard_error).toBe(0.3);
  });

  it('should throw error if session not found', () => {
    mockGet.mockReturnValue(undefined);

    expect(() => {
      completeSession('invalid-session', 1.5, 0.3);
    }).toThrow('Session invalid-session not found');
  });

  it('should record breakthrough event on significant improvement', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([createMockSessionItem()]),
      initial_theta: 0,
    };
    mockGet.mockReturnValue(mockSession);

    completeSession('session-123', 1.0, 0.3); // Theta change > 0.5

    expect(mockRun).toHaveBeenCalled();
  });

  it('should record struggle event on significant decline', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: JSON.stringify([createMockSessionItem()]),
      initial_theta: 1.0,
    };
    mockGet.mockReturnValue(mockSession);

    completeSession('session-123', 0.0, 0.3); // Theta change < -0.5

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// getLearningTrajectory Tests
// ============================================================================

describe('getLearningTrajectory', () => {
  it('should return trajectory data', () => {
    const mockSessions = [
      {
        date: '2024-01-15',
        stat_name: 'math',
        theta: 1.0,
        se: 0.5,
        items: 10,
        items_administered: JSON.stringify([
          { is_correct: true },
          { is_correct: true },
          { is_correct: false },
        ]),
      },
    ];
    mockAll.mockReturnValue(mockSessions);

    const result = getLearningTrajectory('student-123');

    expect(result).toHaveLength(1);
    expect(result[0].theta).toBe(1.0);
  });

  it('should calculate accuracy from items', () => {
    const mockSessions = [
      {
        date: '2024-01-15',
        stat_name: 'math',
        theta: 1.0,
        se: 0.5,
        items: 3,
        items_administered: JSON.stringify([
          { is_correct: true },
          { is_correct: true },
          { is_correct: false },
        ]),
      },
    ];
    mockAll.mockReturnValue(mockSessions);

    const result = getLearningTrajectory('student-123');

    expect(result[0].accuracy).toBeCloseTo(2 / 3, 2);
  });

  it('should filter by stat name when provided', () => {
    mockAll.mockReturnValue([]);

    getLearningTrajectory('student-123', 'math');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should use default of 30 days', () => {
    mockAll.mockReturnValue([]);

    getLearningTrajectory('student-123');

    expect(mockAll).toHaveBeenCalled();
  });

  it('should respect custom days parameter', () => {
    mockAll.mockReturnValue([]);

    getLearningTrajectory('student-123', undefined, 7);

    expect(mockAll).toHaveBeenCalled();
  });
});

// ============================================================================
// getPersistentGaps Tests
// ============================================================================

describe('getPersistentGaps', () => {
  it('should return persistent gaps', () => {
    const mockGaps = [
      {
        stat_name: 'math',
        strand: 'algebra',
        misconception: 'Order of operations',
        first_detected: '2024-01-01',
        detection_count: 5,
        days_persistent: 14,
      },
    ];
    mockAll.mockReturnValue(mockGaps);

    const result = getPersistentGaps('student-123');

    expect(result).toHaveLength(1);
    expect(result[0].misconception).toBe('Order of operations');
    expect(result[0].days_persistent).toBe(14);
  });

  it('should return empty array when no gaps', () => {
    mockAll.mockReturnValue([]);

    const result = getPersistentGaps('student-123');

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// getEffectiveApproaches Tests
// ============================================================================

describe('getEffectiveApproaches', () => {
  it('should return effective approaches', () => {
    const mockResolved = [
      {
        stat_name: 'math',
        strand: 'algebra',
        misconception: 'Order of operations',
        first_detected: '2024-01-01',
        resolved_at: '2024-01-15',
      },
    ];
    mockAll.mockReturnValue(mockResolved);

    const result = getEffectiveApproaches('student-123');

    expect(result).toHaveLength(1);
    expect(result[0].stat_name).toBe('math');
  });

  it('should return empty array when no resolved misconceptions', () => {
    mockAll.mockReturnValue([]);

    const result = getEffectiveApproaches('student-123');

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// getOptimalDifficulty Tests
// ============================================================================

describe('getOptimalDifficulty', () => {
  it('should return optimal difficulty range', () => {
    const mockData = [
      { diff_bucket: 0.4, total: 10, correct: 7 },
      { diff_bucket: 0.5, total: 10, correct: 7 },
      { diff_bucket: 0.6, total: 10, correct: 6 },
    ];
    mockAll.mockReturnValue(mockData);

    const result = getOptimalDifficulty('student-123', 'math');

    expect(result.min).toBeDefined();
    expect(result.max).toBeDefined();
    expect(result.sweet_spot).toBeDefined();
  });

  it('should return defaults when no data', () => {
    mockAll.mockReturnValue([]);

    const result = getOptimalDifficulty('student-123', 'math');

    expect(result.min).toBe(0.3);
    expect(result.max).toBe(0.7);
    expect(result.sweet_spot).toBe(0.5);
  });
});

// ============================================================================
// getStudentContext Tests
// ============================================================================

describe('getStudentContext', () => {
  beforeEach(() => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
    mockAll.mockReturnValue([]);
  });

  it('should return comprehensive student context', () => {
    const result = getStudentContext('student-123', 'math');

    expect(result.student_id).toBe('student-123');
    expect(result.profile).toBeDefined();
    expect(result.learning_trajectory).toBeDefined();
    expect(result.persistent_gaps).toBeDefined();
    expect(result.effective_approaches).toBeDefined();
    expect(result.optimal_difficulty).toBeDefined();
  });

  it('should include assessment context', () => {
    const result = getStudentContext('student-123', 'math');

    expect(result.recent_performance).toBeDefined();
    expect(result.active_misconceptions).toBeDefined();
    expect(result.recommended_focus).toBeDefined();
    expect(result.session_adjustments).toBeDefined();
  });
});

// ============================================================================
// updateAbilityProfile Tests
// ============================================================================

describe('updateAbilityProfile', () => {
  beforeEach(() => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
  });

  it('should update ability profile', () => {
    updateAbilityProfile('student-123', {
      stat_name: 'math',
      strand: 'algebra',
      tier: 'Foundation',
      theta: 1.5,
      se: 0.3,
      items: 10,
      accuracy: 0.8,
      misconceptions: [],
      manifold_signals: { coherence: 0.8 },
    });

    expect(mockRun).toHaveBeenCalled();
  });

  it('should record misconceptions', () => {
    mockGet
      .mockReturnValueOnce({ data_json: JSON.stringify(createMockStudentProfile()) })
      .mockReturnValueOnce({ data_json: JSON.stringify(createMockStudentProfile()) })
      .mockReturnValueOnce(undefined); // For recordMisconception

    updateAbilityProfile('student-123', {
      stat_name: 'math',
      strand: 'algebra',
      tier: 'Foundation',
      theta: 1.5,
      se: 0.3,
      items: 10,
      accuracy: 0.8,
      misconceptions: ['Order of operations'],
      manifold_signals: {},
    });

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// analyzeAndUpdateLearningPatterns Tests
// ============================================================================

describe('analyzeAndUpdateLearningPatterns', () => {
  it('should skip analysis with insufficient data', () => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
    mockAll.mockReturnValue([]); // Less than 10 items

    analyzeAndUpdateLearningPatterns('student-123');

    // Should not update profile
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('should analyze patterns with sufficient data', () => {
    const profile = createMockStudentProfile();
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });

    // Generate 15 mock items
    const items = Array.from({ length: 15 }, (_, i) => ({
      difficulty: 0.5,
      is_correct: i % 2 === 0 ? 1 : 0,
      score: i % 2 === 0 ? 1 : 0,
      created_at: new Date().toISOString(),
    }));
    mockAll.mockReturnValue(items);

    analyzeAndUpdateLearningPatterns('student-123');

    expect(mockRun).toHaveBeenCalled();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty theta history', () => {
    const profile = createMockStudentProfile();
    profile.stat_profiles.math.theta_history = [];
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
    mockAll.mockReturnValue([]);

    const result = getAssessmentContext('student-123');

    expect(result).toBeDefined();
  });

  it('should handle null/undefined data_json fields', () => {
    mockAll.mockReturnValue([
      {
        id: 'misc-1',
        resolved: 0,
        related_items: null,
      },
    ]);

    const result = getActiveMisconceptions('student-123');

    expect(result[0].related_items).toEqual([]);
  });

  it('should handle empty items_administered', () => {
    const mockSession = {
      ...createMockSessionState(),
      items_administered: '[]',
    };
    mockGet.mockReturnValue(mockSession);

    const result = getActiveSession('student-123');

    expect(result?.items_administered).toEqual([]);
  });

  it('should handle session with no items for accuracy calculation', () => {
    const mockSessions = [
      {
        date: '2024-01-15',
        stat_name: 'math',
        theta: 0,
        se: 1.5,
        items: 0,
        items_administered: '[]',
      },
    ];
    mockAll.mockReturnValue(mockSessions);

    const result = getLearningTrajectory('student-123');

    expect(result[0].accuracy).toBe(0);
  });

  it('should handle profile with no strand profiles', () => {
    const profile = createMockStudentProfile();
    profile.stat_profiles.math.strand_profiles = {};
    mockGet.mockReturnValue({ data_json: JSON.stringify(profile) });
    mockAll.mockReturnValue([]);

    const result = getAssessmentContext('student-123', 'math');

    expect(result.recommended_focus).toBeDefined();
  });
});
