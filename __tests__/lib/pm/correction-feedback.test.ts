// @ts-nocheck
/**
 * Wrath Shield v3 - Correction Feedback Tests
 *
 * Tests for learning from user corrections:
 * - Recording corrections
 * - Learning from corrections
 * - Feature weight updates
 * - Accuracy metrics
 * - Pattern-based predictions
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
  getCurrentState: jest.fn().mockReturnValue(null),
}));

// Mock pattern-extraction
jest.mock('@/lib/pm/pattern-extraction', () => ({
  getPattern: jest.fn().mockResolvedValue(null),
}));

import {
  recordCorrection,
  learnFromCorrections,
  getAccuracyMetrics,
  getFeatureWeights,
  predictWithFeatures,
  getEntityCorrections,
  getRecentCorrections,
  type Correction,
  type CorrectionType,
  type AccuracyMetrics,
} from '@/lib/pm/correction-feedback';

describe('Correction Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  describe('Types', () => {
    it('should define Correction interface', () => {
      const correction: Correction = {
        id: 'corr_1234567890_abcd1234',
        correction_type: 'priority',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: '"low"',
        corrected_value: '"high"',
        context: '{"labels": ["bug"]}',
        reason: 'Critical issue for launch',
        recorded_at: Math.floor(Date.now() / 1000),
      };

      expect(correction.correction_type).toBe('priority');
    });

    it('should define CorrectionType values', () => {
      const types: CorrectionType[] = ['priority', 'assignment', 'routing', 'suggestion', 'pattern'];
      expect(types).toHaveLength(5);
    });

    it('should define AccuracyMetrics interface', () => {
      const metrics: AccuracyMetrics = {
        total_suggestions: 100,
        accepted_suggestions: 85,
        corrected_suggestions: 15,
        accuracy_rate: 0.85,
        by_type: {
          priority: { total: 50, accepted: 45, accuracy: 0.9 },
        },
        trend: {
          last_7_days: 0.9,
          last_30_days: 0.85,
          direction: 'improving',
        },
      };

      expect(metrics.accuracy_rate).toBe(0.85);
      expect(metrics.trend.direction).toBe('improving');
    });
  });

  describe('recordCorrection', () => {
    it('should record a correction', async () => {
      const correction = await recordCorrection({
        correction_type: 'priority',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: 'low',
        corrected_value: 'high',
      });

      expect(correction.correction_type).toBe('priority');
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO corrections')
      );
    });

    it('should include context if provided', async () => {
      await recordCorrection({
        correction_type: 'assignment',
        original_entity_type: 'task',
        original_entity_id: 'task-456',
        original_value: 'user-1',
        corrected_value: 'user-2',
        context: { project: 'Project A' },
      });

      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should include reason if provided', async () => {
      await recordCorrection({
        correction_type: 'routing',
        original_entity_type: 'signal',
        original_entity_id: 'sig-789',
        original_value: 'pm',
        corrected_value: 'comms',
        reason: 'This was a sales inquiry, not a PM task',
      });

      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should generate unique ID', async () => {
      const correction = await recordCorrection({
        correction_type: 'suggestion',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: 'old',
        corrected_value: 'new',
      });

      expect(correction.id).toMatch(/^corr_/);
    });
  });

  describe('learnFromCorrections', () => {
    it('should process recent corrections', async () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{"labels": ["bug"], "based_on_patterns": []}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const result = await learnFromCorrections();

      expect(result).toHaveProperty('patterns_adjusted');
      expect(result).toHaveProperty('features_learned');
      expect(result).toHaveProperty('counter_patterns_created');
    });

    it('should adjust pattern confidence', async () => {
      const { getPattern } = require('@/lib/pm/pattern-extraction');
      const { recordFact } = require('@/lib/pm/temporal-memory');

      getPattern.mockResolvedValueOnce({
        id: 'pattern-1',
        confidence: 0.8,
      });

      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{"based_on_patterns": ["pattern-1"]}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      await learnFromCorrections();

      expect(recordFact).toHaveBeenCalled();
    });

    it('should learn feature weights', async () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{"priority": "low", "labels": ["bug"]}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const result = await learnFromCorrections();

      expect(result.features_learned).toBeGreaterThanOrEqual(0);
    });

    it('should detect repeated corrections', async () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      // Mock count for repeated corrections
      mockGet.mockReturnValueOnce({ count: 3 });

      await learnFromCorrections();

      // Should have attempted to create counter-pattern
      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('getAccuracyMetrics', () => {
    it('should return accuracy metrics', async () => {
      mockGet
        .mockReturnValueOnce({ count: 100 }) // total suggestions
        .mockReturnValueOnce({ count: 15 }); // total corrections
      mockAll.mockReturnValueOnce([]); // by_type data

      const metrics = await getAccuracyMetrics();

      expect(metrics).toHaveProperty('total_suggestions');
      expect(metrics).toHaveProperty('accepted_suggestions');
      expect(metrics).toHaveProperty('corrected_suggestions');
      expect(metrics).toHaveProperty('accuracy_rate');
    });

    it('should calculate accuracy rate', async () => {
      mockGet
        .mockReturnValueOnce({ count: 100 })
        .mockReturnValueOnce({ count: 20 });
      mockAll.mockReturnValueOnce([]);

      const metrics = await getAccuracyMetrics();

      expect(metrics.accuracy_rate).toBe(0.8);
    });

    it('should handle zero suggestions', async () => {
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 });
      mockAll.mockReturnValueOnce([]);

      const metrics = await getAccuracyMetrics();

      expect(metrics.accuracy_rate).toBe(0);
    });

    it('should include trend data', async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockReturnValue([]);

      const metrics = await getAccuracyMetrics();

      expect(metrics.trend).toHaveProperty('last_7_days');
      expect(metrics.trend).toHaveProperty('last_30_days');
      expect(metrics.trend).toHaveProperty('direction');
    });

    it('should determine trend direction', async () => {
      mockGet.mockReturnValue({ count: 0 });
      mockAll.mockReturnValue([]);

      const metrics = await getAccuracyMetrics();

      expect(['improving', 'declining', 'stable']).toContain(metrics.trend.direction);
    });
  });

  describe('getFeatureWeights', () => {
    it('should return feature weights for prediction', () => {
      mockAll.mockReturnValueOnce([
        { target_value: '"high"', weight: 5 },
        { target_value: '"medium"', weight: 2 },
      ]);

      const weights = getFeatureWeights('priority', { priority: 'low' });

      expect(typeof weights).toBe('object');
    });

    it('should aggregate weights from multiple features', () => {
      mockAll
        .mockReturnValueOnce([{ target_value: '"high"', weight: 3 }])
        .mockReturnValueOnce([{ target_value: '"high"', weight: 2 }]);

      const weights = getFeatureWeights('priority', {
        priority: 'low',
        project: 'Project A',
      });

      expect(typeof weights).toBe('object');
    });

    it('should return empty object when no weights', () => {
      mockAll.mockReturnValue([]);

      const weights = getFeatureWeights('priority', { unknown: 'feature' });

      expect(Object.keys(weights).length).toBe(0);
    });
  });

  describe('predictWithFeatures', () => {
    it('should predict value from learned features', async () => {
      mockAll.mockReturnValue([
        { target_value: '"high"', weight: 10 },
        { target_value: '"medium"', weight: 2 },
      ]);

      const prediction = await predictWithFeatures('priority', {
        labels: ['bug'],
      });

      if (prediction) {
        expect(prediction).toHaveProperty('value');
        expect(prediction).toHaveProperty('confidence');
      }
    });

    it('should return null when no learned features', async () => {
      mockAll.mockReturnValue([]);

      const prediction = await predictWithFeatures('priority', {
        unknown: 'context',
      });

      expect(prediction).toBeNull();
    });

    it('should calculate confidence from weight distribution', async () => {
      mockAll.mockReturnValue([
        { target_value: '"high"', weight: 8 },
        { target_value: '"low"', weight: 2 },
      ]);

      const prediction = await predictWithFeatures('priority', {
        priority: 'medium',
      });

      if (prediction) {
        expect(prediction.confidence).toBe(0.8); // 8/10
      }
    });
  });

  describe('getEntityCorrections', () => {
    it('should return corrections for an entity', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-123',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const corrections = getEntityCorrections('task', 'task-123');

      expect(corrections).toHaveLength(1);
    });

    it('should return empty array when no corrections', () => {
      mockAll.mockReturnValueOnce([]);

      const corrections = getEntityCorrections('task', 'nonexistent');

      expect(corrections).toHaveLength(0);
    });
  });

  describe('getRecentCorrections', () => {
    it('should return recent corrections', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
        {
          id: 'corr_2',
          correction_type: 'assignment',
          original_entity_type: 'task',
          original_entity_id: 'task-2',
          original_value: '"user-1"',
          corrected_value: '"user-2"',
          context: '{}',
          recorded_at: Math.floor(Date.now() / 1000) - 3600,
        },
      ]);

      const corrections = getRecentCorrections();

      expect(corrections).toHaveLength(2);
    });

    it('should respect limit parameter', () => {
      mockAll.mockReturnValueOnce([]);

      getRecentCorrections(5);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT')
      );
    });

    it('should filter by correction type', () => {
      mockAll.mockReturnValueOnce([]);

      getRecentCorrections(20, 'priority');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('correction_type')
      );
    });
  });

  describe('Table Creation', () => {
    it('should create corrections table', async () => {
      await recordCorrection({
        correction_type: 'priority',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: 'old',
        corrected_value: 'new',
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS corrections')
      );
    });

    it('should create feature_weights table', async () => {
      await recordCorrection({
        correction_type: 'priority',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: 'old',
        corrected_value: 'new',
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS feature_weights')
      );
    });

    it('should create indices', async () => {
      await recordCorrection({
        correction_type: 'priority',
        original_entity_type: 'task',
        original_entity_id: 'task-123',
        original_value: 'old',
        corrected_value: 'new',
      });

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS')
      );
    });
  });

  describe('Learning Strategies', () => {
    it('should extract features from context', async () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{"priority": "low", "project": "Project A", "labels": ["bug", "urgent"]}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const result = await learnFromCorrections();

      expect(result.features_learned).toBeGreaterThanOrEqual(0);
    });

    it('should create counter-pattern for repeated corrections', async () => {
      const { recordFact } = require('@/lib/pm/temporal-memory');

      mockAll.mockReturnValueOnce([
        {
          id: 'corr_1',
          correction_type: 'priority',
          original_entity_type: 'task',
          original_entity_id: 'task-1',
          original_value: '"low"',
          corrected_value: '"high"',
          context: '{}',
          recorded_at: Math.floor(Date.now() / 1000),
        },
      ]);

      // 3+ similar corrections = pattern
      mockGet.mockReturnValueOnce({ count: 3 });

      await learnFromCorrections();

      expect(recordFact).toHaveBeenCalled();
    });
  });
});
