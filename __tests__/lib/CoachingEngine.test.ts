/**
 * Wrath Shield v3 - CoachingEngine Tests
 *
 * Tests for context assembly functions that gather data from:
 * - Database (WHOOP metrics + lifelogs)
 * - Mem0 memory (semantic search + anchors)
 */

import {
  buildDailyContext,
  searchRelevantMemories,
  getRelevantAnchors,
  assembleCoachingContext,
} from '@/lib/CoachingEngine';
import type { Recovery, Cycle, Sleep, Lifelog } from '@/lib/db/types';

// Mock database queries
jest.mock('@/lib/db/queries', () => ({
  getLatestRecovery: jest.fn(),
  getLatestCycle: jest.fn(),
  getLatestSleep: jest.fn(),
  getLifelogsForDate: jest.fn(),
}));

// Mock memory wrapper
jest.mock('@/lib/MemoryWrapper', () => ({
  searchMemories: jest.fn(),
  getAnchors: jest.fn(),
}));

// Import mocked modules
const { getLatestRecovery, getLatestCycle, getLatestSleep, getLifelogsForDate } = require('@/lib/db/queries');
const { searchMemories, getAnchors } = require('@/lib/MemoryWrapper');

describe('buildDailyContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockRecovery: Recovery = {
    id: 'rec_1',
    date: '2025-01-31',
    score: 78,
    hrv: 45,
    rhr: 58,
    spo2: 98,
    skin_temp: 98.2,
  };

  const mockCycle: Cycle = {
    id: 'cycle_1',
    date: '2025-01-31',
    strain: 12.4,
    kilojoules: 8500,
    avg_hr: 85,
    max_hr: 165,
  };

  const mockSleep: Sleep = {
    id: 'sleep_1',
    date: '2025-01-31',
    performance: 85,
    rem_min: 120,
    sws_min: 90,
    light_min: 180,
    respiration: 15,
    sleep_debt_min: 0,
  };

  const mockLifelogs: Lifelog[] = [
    {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Morning conversation',
      manipulation_count: 2,
      wrath_deployed: 1,
      raw_json: '{}',
    },
    {
      id: 'lifelog_2',
      date: '2025-01-31',
      title: 'Afternoon meeting',
      manipulation_count: 1,
      wrath_deployed: 0,
      raw_json: '{}',
    },
  ];

  it('should build daily context with all metrics', async () => {
    getLatestRecovery.mockReturnValue(mockRecovery);
    getLatestCycle.mockReturnValue(mockCycle);
    getLatestSleep.mockReturnValue(mockSleep);
    getLifelogsForDate.mockReturnValue(mockLifelogs);

    const context = await buildDailyContext('2025-01-31');

    expect(context).toEqual({
      date: '2025-01-31',
      recovery: mockRecovery,
      cycle: mockCycle,
      sleep: mockSleep,
      lifelogs: mockLifelogs,
      totalManipulations: 3, // 2 + 1
      wrathDeployed: true, // lifelog_1 has wrath=1
    });

    expect(getLifelogsForDate).toHaveBeenCalledWith('2025-01-31');
  });

  it('should handle null WHOOP metrics', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([]);

    const context = await buildDailyContext('2025-01-31');

    expect(context).toEqual({
      date: '2025-01-31',
      recovery: null,
      cycle: null,
      sleep: null,
      lifelogs: [],
      totalManipulations: 0,
      wrathDeployed: false,
    });
  });

  it('should calculate total manipulations correctly', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);

    const logsWithManipulations: Lifelog[] = [
      {
        id: 'log1',
        date: '2025-01-31',
        title: 'Interaction 1',
        manipulation_count: 5,
        wrath_deployed: 0,
        raw_json: null,
      },
      {
        id: 'log2',
        date: '2025-01-31',
        title: 'Interaction 2',
        manipulation_count: 3,
        wrath_deployed: 1,
      },
      {
        id: 'log3',
        date: '2025-01-31',
        title: 'Interaction 3',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: null,
      },
    ];

    getLifelogsForDate.mockReturnValue(logsWithManipulations);

    const context = await buildDailyContext('2025-01-31');

    expect(context.totalManipulations).toBe(8); // 5 + 3 + 0
    expect(context.wrathDeployed).toBe(true); // log2 has wrath=1
  });

  it('should detect wrath deployed if any lifelog has wrath=1', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);

    const logsWithWrath: Lifelog[] = [
      {
        id: 'log1',
        date: '2025-01-31',
        title: 'No wrath',
        manipulation_count: 2,
        wrath_deployed: 0,
        raw_json: null,
      },
      {
        id: 'log2',
        date: '2025-01-31',
        title: 'Wrath deployed!',
        manipulation_count: 3,
        wrath_deployed: 1,
        raw_json: null,
      },
    ];

    getLifelogsForDate.mockReturnValue(logsWithWrath);

    const context = await buildDailyContext('2025-01-31');

    expect(context.wrathDeployed).toBe(true);
  });

  it('should set wrathDeployed to false if no lifelogs have wrath', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);

    const logsNoWrath: Lifelog[] = [
      {
        id: 'log1',
        date: '2025-01-31',
        title: 'No wrath 1',
        manipulation_count: 2,
        wrath_deployed: 0,
        raw_json: null,
      },
      {
        id: 'log2',
        date: '2025-01-31',
        title: 'No wrath 2',
        manipulation_count: 1,
        wrath_deployed: 0,
        raw_json: null,
      },
    ];

    getLifelogsForDate.mockReturnValue(logsNoWrath);

    const context = await buildDailyContext('2025-01-31');

    expect(context.wrathDeployed).toBe(false);
  });
});

describe('searchRelevantMemories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should transform Mem0 results to RelevantMemory interface', async () => {
    const mockMem0Results = [
      {
        id: 'mem_1',
        text: 'Low recovery requires rest',
        metadata: { type: 'daily_summary', date: '2025-01-30' },
        score: 0.95,
      },
      {
        memory_id: 'mem_2', // Alternative ID field
        memory: 'Manipulation detected in morning', // Alternative text field
        metadata: { type: 'daily_summary', date: '2025-01-29' },
        score: 0.87,
      },
    ];

    searchMemories.mockResolvedValue(mockMem0Results);

    const results = await searchRelevantMemories('low recovery', 'user_123', 5);

    expect(searchMemories).toHaveBeenCalledWith('low recovery', 'user_123', 5);
    expect(results).toEqual([
      {
        id: 'mem_1',
        text: 'Low recovery requires rest',
        metadata: { type: 'daily_summary', date: '2025-01-30' },
        score: 0.95,
      },
      {
        id: 'mem_2',
        text: 'Manipulation detected in morning',
        metadata: { type: 'daily_summary', date: '2025-01-29' },
        score: 0.87,
      },
    ]);
  });

  it('should use default userId and limit', async () => {
    searchMemories.mockResolvedValue([]);

    await searchRelevantMemories('test query');

    expect(searchMemories).toHaveBeenCalledWith('test query', 'default', 5);
  });

  it('should handle empty results', async () => {
    searchMemories.mockResolvedValue([]);

    const results = await searchRelevantMemories('nonexistent query', 'user_123');

    expect(results).toEqual([]);
  });

  it('should handle missing optional fields gracefully', async () => {
    const mockResults = [
      {
        memory_id: 'mem_1',
        memory: 'Some text',
        // No metadata
        // No score
      },
    ];

    searchMemories.mockResolvedValue(mockResults);

    const results = await searchRelevantMemories('query');

    expect(results[0]).toEqual({
      id: 'mem_1',
      text: 'Some text',
      metadata: undefined,
      score: undefined,
    });
  });
});

describe('getRelevantAnchors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve and transform anchors with filters', async () => {
    const mockAnchors = [
      {
        id: 'anchor_1',
        text: 'I will not tolerate manipulation',
        metadata: { type: 'anchor', category: 'boundaries', date: '2025-01-15' },
      },
      {
        id: 'anchor_2',
        text: 'Recovery is non-negotiable',
        metadata: { type: 'anchor', category: 'recovery', date: '2025-01-10' },
      },
    ];

    getAnchors.mockResolvedValue(mockAnchors);

    const results = await getRelevantAnchors('user_123', 'boundaries', '2025-01-01', 10);

    expect(getAnchors).toHaveBeenCalledWith('user_123', {
      category: 'boundaries',
      since: '2025-01-01',
    });
    expect(results).toEqual([
      {
        id: 'anchor_1',
        text: 'I will not tolerate manipulation',
        category: 'boundaries',
        date: '2025-01-15',
        metadata: { type: 'anchor', category: 'boundaries', date: '2025-01-15' },
      },
      {
        id: 'anchor_2',
        text: 'Recovery is non-negotiable',
        category: 'recovery',
        date: '2025-01-10',
        metadata: { type: 'anchor', category: 'recovery', date: '2025-01-10' },
      },
    ]);
  });

  it('should use default parameters', async () => {
    getAnchors.mockResolvedValue([]);

    await getRelevantAnchors();

    expect(getAnchors).toHaveBeenCalledWith('default', {
      category: undefined,
      since: undefined,
    });
  });

  it('should limit results to specified count', async () => {
    const manyAnchors = Array.from({ length: 20 }, (_, i) => ({
      id: `anchor_${i}`,
      text: `Anchor ${i}`,
      metadata: { type: 'anchor', category: 'general', date: '2025-01-01' },
    }));

    getAnchors.mockResolvedValue(manyAnchors);

    const results = await getRelevantAnchors('user_123', undefined, undefined, 5);

    expect(results).toHaveLength(5);
    expect(results[0].id).toBe('anchor_0');
    expect(results[4].id).toBe('anchor_4');
  });

  it('should handle anchors with missing metadata gracefully', async () => {
    const mockAnchors = [
      {
        memory_id: 'anchor_1',
        memory: 'Some anchor text',
        // No metadata
      },
    ];

    getAnchors.mockResolvedValue(mockAnchors);

    const results = await getRelevantAnchors();

    expect(results[0]).toEqual({
      id: 'anchor_1',
      text: 'Some anchor text',
      category: 'general', // Default category
      date: '', // Default empty date
      metadata: undefined,
    });
  });
});

describe('assembleCoachingContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now() for consistent "today" date
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-31T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockRecovery: Recovery = {
    id: 'rec_1',
    date: '2025-01-31',
    score: 35, // Low recovery
    hrv: 30,
    rhr: 65,
    spo2: 97,
    skin_temp: 98.0,
  };

  const mockCycle: Cycle = {
    id: 'cycle_1',
    date: '2025-01-31',
    strain: 16.5, // High strain
    kilojoules: 12000,
    avg_hr: 95,
    max_hr: 180,
  };

  const mockLifelogs: Lifelog[] = [
    {
      id: 'log_1',
      date: '2025-01-31',
      title: 'Manipulative interaction',
      manipulation_count: 5,
      wrath_deployed: 1,
      raw_json: '{}',
    },
  ];

  it('should assemble complete coaching context with all components', async () => {
    getLatestRecovery.mockReturnValue(mockRecovery);
    getLatestCycle.mockReturnValue(mockCycle);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue(mockLifelogs);

    const mockMemories = [
      {
        id: 'mem_1',
        text: 'Previous low recovery situation',
        metadata: {},
        score: 0.9,
      },
    ];

    const mockAnchors = [
      {
        id: 'anchor_1',
        text: 'Boundaries are essential',
        metadata: { type: 'anchor', category: 'boundaries', date: '2025-01-15' },
      },
    ];

    searchMemories.mockResolvedValue(mockMemories);
    getAnchors.mockResolvedValue(mockAnchors);

    const context = await assembleCoachingContext();

    // Check daily context
    expect(context.dailyContext.date).toBe('2025-01-31');
    expect(context.dailyContext.recovery).toEqual(mockRecovery);
    expect(context.dailyContext.cycle).toEqual(mockCycle);
    expect(context.dailyContext.totalManipulations).toBe(5);
    expect(context.dailyContext.wrathDeployed).toBe(true);

    // Check query construction (low recovery + manipulation + high strain)
    expect(context.query).toContain('low recovery');
    expect(context.query).toContain('manipulation');
    expect(context.query).toContain('boundaries');
    expect(context.query).toContain('high strain');

    // Check memories retrieved
    expect(searchMemories).toHaveBeenCalledWith(expect.stringContaining('low recovery'), 'default', 5);
    expect(context.relevantMemories).toHaveLength(1);

    // Check anchors retrieved
    expect(getAnchors).toHaveBeenCalledWith('default', {
      category: undefined,
      since: expect.any(String), // 30 days ago
    });
    expect(context.anchors).toHaveLength(1);
  });

  it('should use custom date if provided', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([]);
    searchMemories.mockResolvedValue([]);
    getAnchors.mockResolvedValue([]);

    const context = await assembleCoachingContext('2025-02-01', 'custom_user');

    expect(context.dailyContext.date).toBe('2025-02-01');
    expect(getLifelogsForDate).toHaveBeenCalledWith('2025-02-01');
    expect(searchMemories).toHaveBeenCalledWith(expect.any(String), 'custom_user', 5);
    expect(getAnchors).toHaveBeenCalledWith('custom_user', expect.any(Object));
  });

  it('should construct high recovery query', async () => {
    const highRecovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 85, // High recovery
      hrv: 60,
      rhr: 52,
      spo2: 99,
      skin_temp: 98.5,
    };

    getLatestRecovery.mockReturnValue(highRecovery);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([]);
    searchMemories.mockResolvedValue([]);
    getAnchors.mockResolvedValue([]);

    const context = await assembleCoachingContext();

    expect(context.query).toContain('high recovery');
    expect(context.query).not.toContain('low recovery');
  });

  it('should use default query when no special conditions', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([]);
    searchMemories.mockResolvedValue([]);
    getAnchors.mockResolvedValue([]);

    const context = await assembleCoachingContext();

    expect(context.query).toBe('daily coaching');
  });

  it('should retrieve anchors from last 30 days', async () => {
    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(null);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([]);
    searchMemories.mockResolvedValue([]);
    getAnchors.mockResolvedValue([]);

    await assembleCoachingContext();

    const expectedDate = '2025-01-01'; // 30 days before 2025-01-31
    expect(getAnchors).toHaveBeenCalledWith('default', {
      category: undefined,
      since: expectedDate,
    });
  });

  it('should handle manipulation without high strain', async () => {
    const lowStrain: Cycle = {
      id: 'cycle_1',
      date: '2025-01-31',
      strain: 8.5, // Low strain
      kilojoules: 5000,
      avg_hr: 70,
      max_hr: 120,
    };

    getLatestRecovery.mockReturnValue(null);
    getLatestCycle.mockReturnValue(lowStrain);
    getLatestSleep.mockReturnValue(null);
    getLifelogsForDate.mockReturnValue([
      {
        id: 'log_1',
        date: '2025-01-31',
        title: 'Manipulation',
        manipulation_count: 3,
        wrath_deployed: 0,
        raw_json: null,
      },
    ]);
    searchMemories.mockResolvedValue([]);
    getAnchors.mockResolvedValue([]);

    const context = await assembleCoachingContext();

    expect(context.query).toContain('manipulation');
    expect(context.query).toContain('boundaries');
    expect(context.query).not.toContain('high strain');
  });
});
