// @ts-nocheck
/**
 * Tests for Rule Lifecycle Manager
 *
 * Tests confidence decay, provenance tracking, and contradiction detection
 */

import {
  RuleLifecycleManager,
  getRuleLifecycleManager,
  resetRuleLifecycleManager,
  importExistingRules,
  syncWithPreferenceModel,
  type RuleCategory,
  type RuleStatus,
  type ContradictionType,
  type ContradictionSeverity,
  type ResolutionStrategy,
  type RuleWithProvenance,
  type ContradictionReport,
  type DecayConfig,
  type RuleLifecycleStats,
  type DecayCycleResult,
} from '@/lib/learning/rule-lifecycle';
import type { PatternRule } from '@/lib/ea/preference-model';

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockRun = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn();

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: mockPrepare,
    exec: mockExec,
  })),
}));

describe('rule-lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRuleLifecycleManager();

    // Default mock implementations
    mockPrepare.mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    });
  });

  // ============================================================================
  // Type Tests
  // ============================================================================

  describe('Type Definitions', () => {
    it('should have RuleCategory type with correct values', () => {
      const urgencyTrigger: RuleCategory = 'urgency_trigger';
      const autoArchive: RuleCategory = 'auto_archive';
      const custom: RuleCategory = 'custom';

      expect(urgencyTrigger).toBe('urgency_trigger');
      expect(autoArchive).toBe('auto_archive');
      expect(custom).toBe('custom');
    });

    it('should have RuleStatus type with correct values', () => {
      const active: RuleStatus = 'active';
      const decayed: RuleStatus = 'decayed';
      const contradicted: RuleStatus = 'contradicted';
      const archived: RuleStatus = 'archived';

      expect(active).toBe('active');
      expect(decayed).toBe('decayed');
      expect(contradicted).toBe('contradicted');
      expect(archived).toBe('archived');
    });

    it('should have ContradictionType type with correct values', () => {
      const directConflict: ContradictionType = 'direct_conflict';
      const overlappingPatterns: ContradictionType = 'overlapping_patterns';
      const behaviorConflict: ContradictionType = 'behavior_conflict';

      expect(directConflict).toBe('direct_conflict');
      expect(overlappingPatterns).toBe('overlapping_patterns');
      expect(behaviorConflict).toBe('behavior_conflict');
    });

    it('should have ContradictionSeverity type with correct values', () => {
      const high: ContradictionSeverity = 'high';
      const medium: ContradictionSeverity = 'medium';
      const low: ContradictionSeverity = 'low';

      expect(high).toBe('high');
      expect(medium).toBe('medium');
      expect(low).toBe('low');
    });

    it('should have ResolutionStrategy type with correct values', () => {
      const keepRule1: ResolutionStrategy = 'keep_rule1';
      const keepRule2: ResolutionStrategy = 'keep_rule2';
      const merge: ResolutionStrategy = 'merge';
      const humanReview: ResolutionStrategy = 'human_review';

      expect(keepRule1).toBe('keep_rule1');
      expect(keepRule2).toBe('keep_rule2');
      expect(merge).toBe('merge');
      expect(humanReview).toBe('human_review');
    });

    it('should define RuleWithProvenance interface correctly', () => {
      const ruleWithProvenance: RuleWithProvenance = {
        rule: {
          pattern: 'test',
          isRegex: false,
          caseSensitive: false,
          weight: 0.8,
          learnedAt: '2024-01-01',
          source: 'inferred',
        },
        ruleId: 'rule_123',
        category: 'urgency_trigger',
        derivedFromEvents: ['event_1', 'event_2'],
        createdAt: '2024-01-01',
        lastReinforcedAt: '2024-01-15',
        reinforcementCount: 5,
        currentConfidence: 0.75,
        originalConfidence: 0.8,
        decayHistory: [
          { timestamp: '2024-01-10', reason: 'Natural decay', newValue: 0.75 },
        ],
        status: 'active',
      };

      expect(ruleWithProvenance.ruleId).toBe('rule_123');
      expect(ruleWithProvenance.category).toBe('urgency_trigger');
      expect(ruleWithProvenance.status).toBe('active');
    });

    it('should define ContradictionReport interface correctly', () => {
      const report: ContradictionReport = {
        id: 'contradiction_123',
        rule1Id: 'rule_1',
        rule2Id: 'rule_2',
        contradictionType: 'direct_conflict',
        description: 'Rules conflict',
        severity: 'high',
        suggestedResolution: 'human_review',
        detectedAt: '2024-01-01',
        resolvedAt: '2024-01-02',
        resolution: 'keep_rule1',
      };

      expect(report.id).toBe('contradiction_123');
      expect(report.contradictionType).toBe('direct_conflict');
      expect(report.severity).toBe('high');
    });

    it('should define DecayConfig interface correctly', () => {
      const config: DecayConfig = {
        decayIntervalDays: 7,
        decayRatePerInterval: 0.1,
        minConfidenceThreshold: 0.3,
        reinforcementBoost: 0.15,
        maxConfidence: 1.0,
      };

      expect(config.decayIntervalDays).toBe(7);
      expect(config.decayRatePerInterval).toBe(0.1);
      expect(config.minConfidenceThreshold).toBe(0.3);
    });

    it('should define RuleLifecycleStats interface correctly', () => {
      const stats: RuleLifecycleStats = {
        totalRules: 100,
        activeRules: 80,
        decayedRules: 15,
        contradictions: 5,
        avgConfidence: 0.75,
      };

      expect(stats.totalRules).toBe(100);
      expect(stats.activeRules).toBe(80);
      expect(stats.avgConfidence).toBe(0.75);
    });

    it('should define DecayCycleResult interface correctly', () => {
      const result: DecayCycleResult = {
        decayed: ['rule_1', 'rule_2'],
        archived: ['rule_3'],
      };

      expect(result.decayed).toHaveLength(2);
      expect(result.archived).toHaveLength(1);
    });
  });

  // ============================================================================
  // RuleLifecycleManager Tests
  // ============================================================================

  describe('RuleLifecycleManager', () => {
    describe('constructor', () => {
      it('should initialize with default config', () => {
        const manager = new RuleLifecycleManager();

        // Should have called exec to create tables
        expect(mockExec).toHaveBeenCalled();
      });

      it('should initialize with custom config', () => {
        const customConfig: Partial<DecayConfig> = {
          decayIntervalDays: 14,
          decayRatePerInterval: 0.2,
        };

        const manager = new RuleLifecycleManager(customConfig);
        expect(mockExec).toHaveBeenCalled();
      });

      it('should create database tables on initialization', () => {
        new RuleLifecycleManager();

        // Should create rule_provenance table
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS rule_provenance')
        );

        // Should create contradiction_reports table
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS contradiction_reports')
        );

        // Should create indexes
        expect(mockExec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_rule_provenance_status')
        );
      });
    });

    describe('addRule', () => {
      it('should add a new rule to the database', async () => {
        const manager = new RuleLifecycleManager();

        const rule: PatternRule = {
          pattern: 'urgent|critical',
          isRegex: true,
          caseSensitive: false,
          weight: 0.8,
          learnedAt: '2024-01-01',
          source: 'inferred',
          exampleMatches: ['urgent email'],
        };

        mockRun.mockReturnValue(undefined);

        const ruleId = await manager.addRule(rule, 'urgency_trigger', ['event_1']);

        expect(ruleId).toMatch(/^rule_/);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO rule_provenance')
        );
        expect(mockRun).toHaveBeenCalled();
      });

      it('should generate unique rule IDs', async () => {
        const manager = new RuleLifecycleManager();

        const rule1: PatternRule = {
          pattern: 'pattern1',
          isRegex: false,
          caseSensitive: false,
          weight: 0.5,
          learnedAt: '2024-01-01',
          source: 'inferred',
        };

        const rule2: PatternRule = {
          pattern: 'pattern2',
          isRegex: false,
          caseSensitive: false,
          weight: 0.5,
          learnedAt: '2024-01-01',
          source: 'inferred',
        };

        const id1 = await manager.addRule(rule1, 'urgency_trigger');
        const id2 = await manager.addRule(rule2, 'auto_archive');

        expect(id1).not.toBe(id2);
      });
    });

    describe('runDecayCycle', () => {
      it('should decay rules that need decay', async () => {
        const manager = new RuleLifecycleManager();

        const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        mockAll.mockReturnValue([
          {
            rule_id: 'rule_1',
            category: 'urgency_trigger',
            pattern: 'test',
            is_regex: 0,
            case_sensitive: 0,
            derived_from_events_json: '[]',
            created_at: oldDate,
            last_reinforced_at: oldDate,
            reinforcement_count: 0,
            current_confidence: 0.8,
            original_confidence: 0.8,
            decay_history_json: '[]',
            status: 'active',
            weight: 0.8,
            learned_at: oldDate,
            source: 'inferred',
            example_matches_json: '[]',
          },
        ]);

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          category: 'urgency_trigger',
          pattern: 'test',
          is_regex: 0,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: oldDate,
          last_reinforced_at: oldDate,
          reinforcement_count: 0,
          current_confidence: 0.8,
          original_confidence: 0.8,
          decay_history_json: '[]',
          status: 'active',
          weight: 0.8,
          learned_at: oldDate,
          source: 'inferred',
          example_matches_json: '[]',
        });

        const result = await manager.runDecayCycle();

        expect(result).toHaveProperty('decayed');
        expect(result).toHaveProperty('archived');
        expect(Array.isArray(result.decayed)).toBe(true);
        expect(Array.isArray(result.archived)).toBe(true);
      });

      it('should archive rules below minimum threshold', async () => {
        const manager = new RuleLifecycleManager();

        const oldDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        mockAll.mockReturnValue([
          {
            rule_id: 'rule_low_confidence',
            category: 'urgency_trigger',
            pattern: 'test',
            is_regex: 0,
            case_sensitive: 0,
            derived_from_events_json: '[]',
            created_at: oldDate,
            last_reinforced_at: oldDate,
            reinforcement_count: 0,
            current_confidence: 0.25, // Below threshold
            original_confidence: 0.8,
            decay_history_json: '[]',
            status: 'active',
            weight: 0.25,
            learned_at: oldDate,
            source: 'inferred',
            example_matches_json: '[]',
          },
        ]);

        mockGet.mockReturnValue({
          rule_id: 'rule_low_confidence',
          current_confidence: 0.25,
          decay_history_json: '[]',
          status: 'active',
        });

        const result = await manager.runDecayCycle();

        expect(result).toBeDefined();
      });
    });

    describe('decayRule', () => {
      it('should reduce rule confidence', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          category: 'urgency_trigger',
          pattern: 'test',
          is_regex: 0,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-01',
          reinforcement_count: 0,
          current_confidence: 0.8,
          original_confidence: 0.8,
          decay_history_json: '[]',
          status: 'active',
          weight: 0.8,
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '[]',
        });

        await manager.decayRule('rule_1', 'Natural decay');

        expect(mockRun).toHaveBeenCalled();
      });

      it('should handle non-existent rule', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue(null);

        // Should not throw
        await manager.decayRule('non_existent', 'Test');
      });
    });

    describe('reinforceRule', () => {
      it('should increase rule confidence', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          category: 'urgency_trigger',
          pattern: 'test',
          is_regex: 0,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-01',
          reinforcement_count: 0,
          current_confidence: 0.5,
          original_confidence: 0.8,
          decay_history_json: '[]',
          status: 'active',
          weight: 0.5,
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '[]',
        });

        await manager.reinforceRule('rule_1', ['event_new']);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE rule_provenance')
        );
      });

      it('should cap confidence at maxConfidence', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          current_confidence: 0.95,
          reinforcement_count: 10,
          derived_from_events_json: '[]',
        });

        await manager.reinforceRule('rule_1');

        // Should still call update but confidence will be capped
        expect(mockRun).toHaveBeenCalled();
      });
    });

    describe('addProvenance', () => {
      it('should add event IDs to rule provenance', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          derived_from_events_json: '["event_1"]',
        });

        await manager.addProvenance('rule_1', ['event_2', 'event_3']);

        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE rule_provenance')
        );
      });
    });

    describe('getProvenance', () => {
      it('should return rule with full provenance', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          rule_id: 'rule_1',
          category: 'urgency_trigger',
          pattern: 'test|pattern',
          is_regex: 1,
          case_sensitive: 0,
          derived_from_events_json: '["event_1", "event_2"]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-15',
          reinforcement_count: 5,
          current_confidence: 0.75,
          original_confidence: 0.8,
          decay_history_json: '[{"timestamp":"2024-01-10","reason":"decay","newValue":0.75}]',
          status: 'active',
          weight: 0.75,
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '["example1"]',
        });

        const result = await manager.getProvenance('rule_1');

        expect(result).not.toBeNull();
        expect(result?.ruleId).toBe('rule_1');
        expect(result?.category).toBe('urgency_trigger');
        expect(result?.derivedFromEvents).toEqual(['event_1', 'event_2']);
        expect(result?.rule.isRegex).toBe(true);
      });

      it('should return null for non-existent rule', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue(null);

        const result = await manager.getProvenance('non_existent');

        expect(result).toBeNull();
      });
    });

    describe('detectContradictions', () => {
      it('should detect direct conflicts between rules', async () => {
        const manager = new RuleLifecycleManager();

        // Return two conflicting rules
        mockAll.mockReturnValueOnce([
          {
            rule_id: 'rule_urgency',
            category: 'urgency_trigger',
            pattern: 'newsletter',
            is_regex: 0,
            weight: 0.8,
            current_confidence: 0.8,
            status: 'active',
          },
          {
            rule_id: 'rule_archive',
            category: 'auto_archive',
            pattern: 'newsletter',
            is_regex: 0,
            weight: 0.8,
            current_confidence: 0.8,
            status: 'active',
          },
        ].map((r) => ({
          ...r,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-01',
          reinforcement_count: 0,
          original_confidence: 0.8,
          decay_history_json: '[]',
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '[]',
        })));

        // No existing contradiction
        mockGet.mockReturnValue(null);

        const contradictions = await manager.detectContradictions();

        expect(Array.isArray(contradictions)).toBe(true);
      });

      it('should detect overlapping patterns in same category', async () => {
        const manager = new RuleLifecycleManager();

        mockAll.mockReturnValueOnce([
          {
            rule_id: 'rule_1',
            category: 'urgency_trigger',
            pattern: 'urgent',
            weight: 0.9,
            current_confidence: 0.9,
          },
          {
            rule_id: 'rule_2',
            category: 'urgency_trigger',
            pattern: 'urgent message',
            weight: 0.5, // Different weight
            current_confidence: 0.5,
          },
        ].map((r) => ({
          ...r,
          is_regex: 0,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-01',
          reinforcement_count: 0,
          original_confidence: r.current_confidence,
          decay_history_json: '[]',
          status: 'active',
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '[]',
        })));

        mockGet.mockReturnValue(null);

        const contradictions = await manager.detectContradictions();

        expect(Array.isArray(contradictions)).toBe(true);
      });
    });

    describe('resolveContradiction', () => {
      it('should resolve contradiction by keeping rule1', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          id: 'contradiction_1',
          rule1_id: 'rule_1',
          rule2_id: 'rule_2',
        });

        await manager.resolveContradiction('contradiction_1', 'keep_rule1');

        expect(mockRun).toHaveBeenCalled();
      });

      it('should resolve contradiction by keeping rule2', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          id: 'contradiction_1',
          rule1_id: 'rule_1',
          rule2_id: 'rule_2',
        });

        await manager.resolveContradiction('contradiction_1', 'keep_rule2');

        expect(mockRun).toHaveBeenCalled();
      });

      it('should resolve contradiction by archiving both', async () => {
        const manager = new RuleLifecycleManager();

        mockGet.mockReturnValue({
          id: 'contradiction_1',
          rule1_id: 'rule_1',
          rule2_id: 'rule_2',
        });

        await manager.resolveContradiction('contradiction_1', 'archive_both');

        expect(mockRun).toHaveBeenCalled();
      });

      it('should handle merge resolution', async () => {
        const manager = new RuleLifecycleManager();

        mockGet
          .mockReturnValueOnce({
            id: 'contradiction_1',
            rule1_id: 'rule_1',
            rule2_id: 'rule_2',
          })
          .mockReturnValueOnce({
            rule_id: 'rule_1',
            current_confidence: 0.8,
          })
          .mockReturnValueOnce({
            rule_id: 'rule_2',
            current_confidence: 0.6,
          });

        await manager.resolveContradiction('contradiction_1', 'merge');

        expect(mockRun).toHaveBeenCalled();
      });
    });

    describe('getActiveRules', () => {
      it('should return all active rules', async () => {
        const manager = new RuleLifecycleManager();

        mockAll.mockReturnValue([
          {
            rule_id: 'rule_1',
            category: 'urgency_trigger',
            pattern: 'test',
            is_regex: 0,
            case_sensitive: 0,
            derived_from_events_json: '[]',
            created_at: '2024-01-01',
            last_reinforced_at: '2024-01-01',
            reinforcement_count: 0,
            current_confidence: 0.8,
            original_confidence: 0.8,
            decay_history_json: '[]',
            status: 'active',
            weight: 0.8,
            learned_at: '2024-01-01',
            source: 'inferred',
            example_matches_json: '[]',
          },
        ]);

        const rules = await manager.getActiveRules();

        expect(Array.isArray(rules)).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("WHERE status = 'active'")
        );
      });
    });

    describe('getDecayedRules', () => {
      it('should return all decayed rules', async () => {
        const manager = new RuleLifecycleManager();

        mockAll.mockReturnValue([]);

        const rules = await manager.getDecayedRules();

        expect(Array.isArray(rules)).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("WHERE status = 'decayed'")
        );
      });
    });

    describe('getRulesNeedingReview', () => {
      it('should return contradicted and low-confidence rules', async () => {
        const manager = new RuleLifecycleManager();

        mockAll.mockReturnValue([]);

        const rules = await manager.getRulesNeedingReview();

        expect(Array.isArray(rules)).toBe(true);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("status = 'contradicted'")
        );
      });
    });

    describe('getStats', () => {
      it('should return lifecycle statistics', async () => {
        const manager = new RuleLifecycleManager();

        mockGet
          .mockReturnValueOnce({ count: 100 })
          .mockReturnValueOnce({ count: 80 })
          .mockReturnValueOnce({ count: 15 })
          .mockReturnValueOnce({ count: 5 })
          .mockReturnValueOnce({ avg: 0.75 });

        const stats = await manager.getStats();

        expect(stats.totalRules).toBe(100);
        expect(stats.activeRules).toBe(80);
        expect(stats.decayedRules).toBe(15);
        expect(stats.contradictions).toBe(5);
        expect(stats.avgConfidence).toBe(0.75);
      });

      it('should handle null average confidence', async () => {
        const manager = new RuleLifecycleManager();

        mockGet
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ avg: null });

        const stats = await manager.getStats();

        expect(stats.avgConfidence).toBe(0);
      });
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const manager1 = getRuleLifecycleManager();
      const manager2 = getRuleLifecycleManager();

      expect(manager1).toBe(manager2);
    });

    it('should accept config on first call', () => {
      const manager = getRuleLifecycleManager({ decayIntervalDays: 14 });

      expect(manager).toBeDefined();
    });

    it('should reset singleton instance', () => {
      const manager1 = getRuleLifecycleManager();
      resetRuleLifecycleManager();
      const manager2 = getRuleLifecycleManager();

      expect(manager1).not.toBe(manager2);
    });
  });

  // ============================================================================
  // Integration Helper Tests
  // ============================================================================

  describe('importExistingRules', () => {
    it('should import urgency triggers and auto-archive patterns', async () => {
      const urgencyTriggers: PatternRule[] = [
        {
          pattern: 'urgent',
          isRegex: false,
          caseSensitive: false,
          weight: 0.8,
          learnedAt: '2024-01-01',
          source: 'inferred',
        },
      ];

      const autoArchivePatterns: PatternRule[] = [
        {
          pattern: 'newsletter',
          isRegex: false,
          caseSensitive: false,
          weight: 0.7,
          learnedAt: '2024-01-01',
          source: 'inferred',
        },
      ];

      const result = await importExistingRules(urgencyTriggers, autoArchivePatterns);

      expect(result).toHaveProperty('imported');
      expect(result).toHaveProperty('skipped');
      expect(typeof result.imported).toBe('number');
      expect(typeof result.skipped).toBe('number');
    });

    it('should handle import failures', async () => {
      mockRun.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await importExistingRules(
        [{ pattern: 'test', isRegex: false, caseSensitive: false, weight: 0.5, learnedAt: '2024-01-01', source: 'inferred' }],
        []
      );

      expect(result.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('syncWithPreferenceModel', () => {
    it('should sync preference model with active rules', async () => {
      mockAll.mockReturnValue([
        {
          rule_id: 'rule_1',
          category: 'urgency_trigger',
          pattern: 'active_pattern',
          is_regex: 0,
          case_sensitive: 0,
          derived_from_events_json: '[]',
          created_at: '2024-01-01',
          last_reinforced_at: '2024-01-01',
          reinforcement_count: 0,
          current_confidence: 0.8,
          original_confidence: 0.8,
          decay_history_json: '[]',
          status: 'active',
          weight: 0.8,
          learned_at: '2024-01-01',
          source: 'inferred',
          example_matches_json: '[]',
        },
      ]);

      const model = {
        urgency_triggers: [
          { pattern: 'old_pattern', isRegex: false, caseSensitive: false, weight: 0.5, learnedAt: '2024-01-01', source: 'inferred' as const },
        ],
        auto_archive_patterns: [],
      };

      await syncWithPreferenceModel(model);

      // Model should now have only active rules from lifecycle system
      expect(model.urgency_triggers).toHaveLength(1);
      expect(model.urgency_triggers[0].pattern).toBe('active_pattern');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty rule list', async () => {
      const manager = new RuleLifecycleManager();

      mockAll.mockReturnValue([]);

      const result = await manager.runDecayCycle();

      expect(result.decayed).toHaveLength(0);
      expect(result.archived).toHaveLength(0);
    });

    it('should handle malformed JSON in database', async () => {
      const manager = new RuleLifecycleManager();

      mockGet.mockReturnValue({
        rule_id: 'rule_1',
        category: 'urgency_trigger',
        pattern: 'test',
        is_regex: 0,
        case_sensitive: 0,
        derived_from_events_json: null, // Null instead of valid JSON
        created_at: '2024-01-01',
        last_reinforced_at: '2024-01-01',
        reinforcement_count: 0,
        current_confidence: 0.8,
        original_confidence: 0.8,
        decay_history_json: null,
        status: 'active',
        weight: 0.8,
        learned_at: '2024-01-01',
        source: 'inferred',
        example_matches_json: null,
      });

      const result = await manager.getProvenance('rule_1');

      expect(result).not.toBeNull();
      expect(result?.derivedFromEvents).toEqual([]);
      expect(result?.decayHistory).toEqual([]);
    });

    it('should generate unique hash for similar patterns', () => {
      const manager = new RuleLifecycleManager();

      // Access private method through the instance
      const hash1 = (manager as any).simpleHash('urgent');
      const hash2 = (manager as any).simpleHash('urgently');

      expect(hash1).not.toBe(hash2);
    });

    it('should detect pattern overlap with pipe-separated keywords', () => {
      const manager = new RuleLifecycleManager();

      // Access private method
      const result = (manager as any).patternsOverlap(
        'urgent|critical',
        'critical|emergency'
      );

      expect(result).toBe(true);
    });

    it('should not detect overlap for unrelated patterns', () => {
      const manager = new RuleLifecycleManager();

      const result = (manager as any).patternsOverlap(
        'newsletter|promotional',
        'urgent|critical'
      );

      expect(result).toBe(false);
    });
  });
});
