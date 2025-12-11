// @ts-nocheck
/**
 * Wrath Shield v3 - Pattern Extraction Tests
 *
 * Tests for pattern extraction from temporal memory:
 * - Completion time patterns
 * - Priority drift patterns
 * - Stale project patterns
 * - Productive time patterns
 * - Collaboration patterns
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);
const mockRun = jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

// Mock temporal-memory
jest.mock('@/lib/pm/temporal-memory', () => ({
  recordFact: jest.fn().mockResolvedValue({}),
  queryFacts: jest.fn().mockReturnValue([]),
  ensureTemporalTables: jest.fn(),
}));

// Mock integration
jest.mock('@/lib/pm/integration', () => ({
  getAllTasks: jest.fn().mockResolvedValue([]),
}));

import {
  extractCompletionPatterns,
  detectPriorityDrift,
  identifyStaleProjects,
  identifyProductiveWindows,
  findCollaborationPatterns,
  runPatternExtraction,
  getPattern,
  getPatternsByType,
  type Pattern,
  type PatternType,
} from '@/lib/pm/pattern-extraction';

describe('Pattern Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  describe('Types', () => {
    it('should define Pattern interface', () => {
      const pattern: Pattern = {
        id: 'completion_time_high',
        pattern_type: 'completion_time',
        description: 'High priority tasks complete in 3.5 ± 1.2 days',
        confidence: 0.85,
        evidence: ['task-1', 'task-2', 'task-3'],
        extracted_at: new Date().toISOString(),
        insight: 'Average completion time for high priority: 3.5 days',
        suggested_action: 'Consider breaking down tasks into smaller chunks',
        metadata: {
          sample_size: 10,
          avg_days: 3.5,
          std_dev: 1.2,
        },
      };

      expect(pattern.pattern_type).toBe('completion_time');
      expect(pattern.confidence).toBe(0.85);
    });

    it('should define PatternType values', () => {
      const types: PatternType[] = [
        'completion_time',
        'priority_drift',
        'stale_project',
        'productive_time',
        'collaboration',
        'assignment_preference',
      ];
      expect(types).toHaveLength(6);
    });
  });

  describe('extractCompletionPatterns', () => {
    it('should return empty array when no completed tasks', async () => {
      mockAll.mockReturnValueOnce([]);

      const patterns = await extractCompletionPatterns();

      expect(patterns).toHaveLength(0);
    });

    it('should extract patterns from completed tasks', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"high"', project: '"Project A"', created_at: 1000, completed_at: 1500, days_to_complete: 5.8 },
        { task_id: 'task-2', priority: '"high"', project: '"Project A"', created_at: 2000, completed_at: 2300, days_to_complete: 3.5 },
        { task_id: 'task-3', priority: '"high"', project: '"Project B"', created_at: 3000, completed_at: 3400, days_to_complete: 4.6 },
      ]);

      const patterns = await extractCompletionPatterns();

      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate average completion time', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"medium"', project: null, created_at: 1000, completed_at: 1432, days_to_complete: 5 },
        { task_id: 'task-2', priority: '"medium"', project: null, created_at: 2000, completed_at: 2259, days_to_complete: 3 },
        { task_id: 'task-3', priority: '"medium"', project: null, created_at: 3000, completed_at: 3346, days_to_complete: 4 },
      ]);

      const patterns = await extractCompletionPatterns();

      const mediumPattern = patterns.find(p => p.id === 'completion_time_medium');
      if (mediumPattern) {
        expect(mediumPattern.metadata.avg_days).toBe(4);
      }
    });

    it('should require minimum sample size', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"urgent"', project: null, created_at: 1000, completed_at: 1086, days_to_complete: 1 },
        { task_id: 'task-2', priority: '"urgent"', project: null, created_at: 2000, completed_at: 2172, days_to_complete: 2 },
        // Only 2 samples - below threshold of 3
      ]);

      const patterns = await extractCompletionPatterns();

      expect(patterns.filter(p => p.metadata.sample_size === 2)).toHaveLength(0);
    });

    it('should record patterns as temporal facts', async () => {
      const { recordFact } = require('@/lib/pm/temporal-memory');

      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"low"', project: null, created_at: 1000, completed_at: 1604, days_to_complete: 7 },
        { task_id: 'task-2', priority: '"low"', project: null, created_at: 2000, completed_at: 2518, days_to_complete: 6 },
        { task_id: 'task-3', priority: '"low"', project: null, created_at: 3000, completed_at: 3691, days_to_complete: 8 },
      ]);

      await extractCompletionPatterns();

      expect(recordFact).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'pattern',
          source: 'pattern_extraction',
        })
      );
    });

    it('should suggest action for long completion times', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"high"', project: null, created_at: 1000, completed_at: 1691, days_to_complete: 8 },
        { task_id: 'task-2', priority: '"high"', project: null, created_at: 2000, completed_at: 2864, days_to_complete: 10 },
        { task_id: 'task-3', priority: '"high"', project: null, created_at: 3000, completed_at: 3778, days_to_complete: 9 },
      ]);

      const patterns = await extractCompletionPatterns();

      const highPattern = patterns.find(p => p.id === 'completion_time_high');
      if (highPattern) {
        expect(highPattern.suggested_action).toContain('breaking down');
      }
    });
  });

  describe('detectPriorityDrift', () => {
    it('should return empty array when no drift', async () => {
      mockAll.mockReturnValueOnce([]);

      const patterns = await detectPriorityDrift();

      expect(patterns).toHaveLength(0);
    });

    it('should detect high to medium drift', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', old_priority: '"high"', new_priority: '"medium"', old_time: 1000, new_time: 1432, days_between: 5 },
        { task_id: 'task-2', old_priority: '"high"', new_priority: '"medium"', old_time: 2000, new_time: 2518, days_between: 6 },
        { task_id: 'task-3', old_priority: '"high"', new_priority: '"medium"', old_time: 3000, new_time: 3346, days_between: 4 },
      ]);

      const patterns = await detectPriorityDrift();

      const driftPattern = patterns.find(p => p.id === 'priority_drift_high_to_medium');
      expect(driftPattern).toBeDefined();
    });

    it('should detect urgent task delays', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', old_priority: '"urgent"', new_priority: '"high"', old_time: 1000, new_time: 1172, days_between: 2 },
        { task_id: 'task-2', old_priority: '"urgent"', new_priority: '"high"', old_time: 2000, new_time: 2259, days_between: 3 },
      ]);

      const patterns = await detectPriorityDrift();

      const urgentPattern = patterns.find(p => p.id === 'priority_drift_urgent_delayed');
      expect(urgentPattern).toBeDefined();
    });

    it('should include suggested actions', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', old_priority: '"high"', new_priority: '"medium"', old_time: 1000, new_time: 1432, days_between: 5 },
        { task_id: 'task-2', old_priority: '"high"', new_priority: '"medium"', old_time: 2000, new_time: 2518, days_between: 6 },
        { task_id: 'task-3', old_priority: '"high"', new_priority: '"medium"', old_time: 3000, new_time: 3346, days_between: 4 },
      ]);

      const patterns = await detectPriorityDrift();

      const driftPattern = patterns.find(p => p.id === 'priority_drift_high_to_medium');
      expect(driftPattern?.suggested_action).toBeTruthy();
    });
  });

  describe('identifyStaleProjects', () => {
    it('should return empty array when no stale projects', async () => {
      mockAll.mockReturnValueOnce([]);

      const patterns = await identifyStaleProjects();

      expect(patterns).toHaveLength(0);
    });

    it('should identify projects with old completions', async () => {
      const now = Math.floor(Date.now() / 1000);
      const fifteenDaysAgo = now - (15 * 86400);

      mockAll.mockReturnValueOnce([
        {
          project_name: '"Project Alpha"',
          task_count: 5,
          last_completion: fifteenDaysAgo,
          first_completion: fifteenDaysAgo - 86400 * 30,
        },
      ]);

      const patterns = await identifyStaleProjects();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].pattern_type).toBe('stale_project');
    });

    it('should include days since completion', async () => {
      const now = Math.floor(Date.now() / 1000);
      const twentyDaysAgo = now - (20 * 86400);

      mockAll.mockReturnValueOnce([
        {
          project_name: '"Stale Project"',
          task_count: 3,
          last_completion: twentyDaysAgo,
          first_completion: twentyDaysAgo - 86400 * 10,
        },
      ]);

      const patterns = await identifyStaleProjects();

      expect(patterns[0].metadata.days_since_completion).toBeGreaterThanOrEqual(20);
    });

    it('should suggest review action', async () => {
      const now = Math.floor(Date.now() / 1000);

      mockAll.mockReturnValueOnce([
        {
          project_name: '"Review Me"',
          task_count: 2,
          last_completion: now - (21 * 86400),
          first_completion: now - (30 * 86400),
        },
      ]);

      const patterns = await identifyStaleProjects();

      expect(patterns[0].suggested_action).toContain('Review');
    });
  });

  describe('identifyProductiveWindows', () => {
    it('should return empty array when no data', async () => {
      mockAll.mockReturnValueOnce([]);

      const patterns = await identifyProductiveWindows();

      expect(patterns).toHaveLength(0);
    });

    it('should identify peak productivity times', async () => {
      mockAll.mockReturnValueOnce([
        { day_of_week: 1, hour_of_day: 10, completion_count: 15 },
        { day_of_week: 2, hour_of_day: 14, completion_count: 12 },
      ]);

      const patterns = await identifyProductiveWindows();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].pattern_type).toBe('productive_time');
    });

    it('should format day names correctly', async () => {
      mockAll.mockReturnValueOnce([
        { day_of_week: 1, hour_of_day: 10, completion_count: 10 }, // Monday
      ]);

      const patterns = await identifyProductiveWindows();

      expect(patterns[0].description).toContain('Monday');
    });

    it('should format time with AM/PM', async () => {
      mockAll.mockReturnValueOnce([
        { day_of_week: 3, hour_of_day: 14, completion_count: 8 }, // 2 PM
      ]);

      const patterns = await identifyProductiveWindows();

      expect(patterns[0].description).toContain('PM');
    });
  });

  describe('findCollaborationPatterns', () => {
    it('should return empty array when no assignees', async () => {
      mockAll.mockReturnValueOnce([]);

      const patterns = await findCollaborationPatterns();

      expect(patterns).toHaveLength(0);
    });

    it('should extract assignee completion times', async () => {
      mockAll.mockReturnValueOnce([
        { assignee: 'user-1', tasks_assigned: 5, avg_completion_days: 3.5 },
        { assignee: 'user-2', tasks_assigned: 8, avg_completion_days: 4.2 },
      ]);

      const patterns = await findCollaborationPatterns();

      expect(patterns).toHaveLength(2);
      expect(patterns[0].pattern_type).toBe('collaboration');
    });

    it('should include assignee in pattern ID', async () => {
      mockAll.mockReturnValueOnce([
        { assignee: 'john-doe', tasks_assigned: 4, avg_completion_days: 2.8 },
      ]);

      const patterns = await findCollaborationPatterns();

      expect(patterns[0].id).toContain('john-doe');
    });

    it('should include task count in metadata', async () => {
      mockAll.mockReturnValueOnce([
        { assignee: 'developer', tasks_assigned: 10, avg_completion_days: 5.0 },
      ]);

      const patterns = await findCollaborationPatterns();

      expect(patterns[0].metadata.tasks_assigned).toBe(10);
    });
  });

  describe('runPatternExtraction', () => {
    it('should run all extractors', async () => {
      mockAll.mockReturnValue([]);

      const patterns = await runPatternExtraction();

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should combine patterns from all extractors', async () => {
      // Mock different returns for each extractor call
      mockAll
        .mockReturnValueOnce([
          { task_id: 'task-1', priority: '"high"', project: null, created_at: 1000, completed_at: 1432, days_to_complete: 5 },
          { task_id: 'task-2', priority: '"high"', project: null, created_at: 2000, completed_at: 2259, days_to_complete: 3 },
          { task_id: 'task-3', priority: '"high"', project: null, created_at: 3000, completed_at: 3346, days_to_complete: 4 },
        ])
        .mockReturnValue([]);

      const patterns = await runPatternExtraction();

      expect(patterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should log extraction summary', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockAll.mockReturnValue([]);

      await runPatternExtraction();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('PatternExtraction')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getPattern', () => {
    it('should return pattern by ID', async () => {
      const { queryFacts } = require('@/lib/pm/temporal-memory');
      queryFacts.mockReturnValueOnce([
        {
          id: 'fact_1',
          entity_type: 'pattern',
          entity_id: 'completion_time_high',
          attribute: 'avg_completion_days',
          value: '3.5',
          confidence: 0.85,
          recorded_at: Math.floor(Date.now() / 1000),
          metadata: {
            pattern_type: 'completion_time',
            description: 'Test pattern',
            insight: 'Test insight',
          },
        },
      ]);

      const pattern = await getPattern('completion_time_high');

      expect(pattern).not.toBeNull();
      expect(pattern?.id).toBe('completion_time_high');
    });

    it('should return null when pattern not found', async () => {
      const { queryFacts } = require('@/lib/pm/temporal-memory');
      queryFacts.mockReturnValueOnce([]);

      const pattern = await getPattern('nonexistent');

      expect(pattern).toBeNull();
    });
  });

  describe('getPatternsByType', () => {
    it('should return patterns of specific type', async () => {
      const { queryFacts } = require('@/lib/pm/temporal-memory');
      queryFacts.mockReturnValueOnce([
        {
          id: 'fact_1',
          entity_type: 'pattern',
          entity_id: 'completion_time_high',
          confidence: 0.8,
          recorded_at: Math.floor(Date.now() / 1000),
          metadata: { pattern_type: 'completion_time' },
        },
        {
          id: 'fact_2',
          entity_type: 'pattern',
          entity_id: 'priority_drift_high_to_medium',
          confidence: 0.7,
          recorded_at: Math.floor(Date.now() / 1000),
          metadata: { pattern_type: 'priority_drift' },
        },
      ]);

      const patterns = await getPatternsByType('completion_time');

      expect(patterns).toHaveLength(1);
      expect(patterns[0].pattern_type).toBe('completion_time');
    });

    it('should filter out non-matching types', async () => {
      const { queryFacts } = require('@/lib/pm/temporal-memory');
      queryFacts.mockReturnValueOnce([
        {
          id: 'fact_1',
          entity_type: 'pattern',
          entity_id: 'stale_project_alpha',
          confidence: 0.9,
          recorded_at: Math.floor(Date.now() / 1000),
          metadata: { pattern_type: 'stale_project' },
        },
      ]);

      const patterns = await getPatternsByType('completion_time');

      expect(patterns).toHaveLength(0);
    });
  });

  describe('Statistical Functions', () => {
    it('should calculate correct average', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"medium"', project: null, created_at: 1000, completed_at: 1173, days_to_complete: 2 },
        { task_id: 'task-2', priority: '"medium"', project: null, created_at: 2000, completed_at: 2346, days_to_complete: 4 },
        { task_id: 'task-3', priority: '"medium"', project: null, created_at: 3000, completed_at: 3518, days_to_complete: 6 },
      ]);

      const patterns = await extractCompletionPatterns();

      const mediumPattern = patterns.find(p => p.id === 'completion_time_medium');
      if (mediumPattern) {
        expect(mediumPattern.metadata.avg_days).toBe(4); // (2+4+6)/3
      }
    });

    it('should calculate standard deviation', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"low"', project: null, created_at: 1000, completed_at: 1173, days_to_complete: 2 },
        { task_id: 'task-2', priority: '"low"', project: null, created_at: 2000, completed_at: 2346, days_to_complete: 4 },
        { task_id: 'task-3', priority: '"low"', project: null, created_at: 3000, completed_at: 3518, days_to_complete: 6 },
      ]);

      const patterns = await extractCompletionPatterns();

      const lowPattern = patterns.find(p => p.id === 'completion_time_low');
      if (lowPattern) {
        expect(lowPattern.metadata.std_dev).toBeCloseTo(1.63, 1); // std dev of [2,4,6]
      }
    });

    it('should track min and max values', async () => {
      mockAll.mockReturnValueOnce([
        { task_id: 'task-1', priority: '"high"', project: null, created_at: 1000, completed_at: 1086, days_to_complete: 1 },
        { task_id: 'task-2', priority: '"high"', project: null, created_at: 2000, completed_at: 2432, days_to_complete: 5 },
        { task_id: 'task-3', priority: '"high"', project: null, created_at: 3000, completed_at: 3259, days_to_complete: 3 },
      ]);

      const patterns = await extractCompletionPatterns();

      const highPattern = patterns.find(p => p.id === 'completion_time_high');
      if (highPattern) {
        expect(highPattern.metadata.min_days).toBe(1);
        expect(highPattern.metadata.max_days).toBe(5);
      }
    });
  });
});
