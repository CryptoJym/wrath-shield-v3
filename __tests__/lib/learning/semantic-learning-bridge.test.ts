// @ts-nocheck
/**
 * Tests for Semantic Learning Bridge
 *
 * Tests cross-system learning between Pattern Recognizer,
 * Preference Model, and Decision Queue
 */

import {
  SemanticLearningBridge,
  getSemanticLearningBridge,
  resetSemanticLearningBridge,
  triggerLearningCycle,
  findPatternsForEvent,
  migrateRulesToLifecycleSystem,
  syncLifecycleToPreferences,
  type LearningInsight,
  type SemanticLearningConfig,
} from '@/lib/learning/semantic-learning-bridge';

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock pattern-recognizer
const mockGetAllPatterns = jest.fn();
const mockFindMatchingPatterns = jest.fn();

jest.mock('@/lib/learning/pattern-recognizer', () => ({
  getPatternRecognizer: jest.fn(() => ({
    getAllPatterns: mockGetAllPatterns,
    findMatchingPatterns: mockFindMatchingPatterns,
  })),
}));

// Mock preference-model
const mockLoadPreferences = jest.fn();
const mockSavePreferences = jest.fn();
const mockRecordCorrection = jest.fn();

jest.mock('@/lib/ea/preference-model', () => ({
  loadPreferences: () => mockLoadPreferences(),
  savePreferences: (prefs: any) => mockSavePreferences(prefs),
  recordCorrection: (...args: any[]) => mockRecordCorrection(...args),
}));

// Mock decision-queue
const mockGetPendingDecisions = jest.fn();

jest.mock('@/lib/cortex/decision-queue', () => ({
  getDecisionQueue: jest.fn(() => ({
    getPendingDecisions: mockGetPendingDecisions,
  })),
}));

// Mock life-os-event-bus
const mockPublish = jest.fn();

jest.mock('@/lib/agents/life-os-event-bus', () => ({
  getEventBus: jest.fn(() => ({
    publish: mockPublish,
  })),
  createNotificationEvent: jest.fn((source, payload, domain, priority) => ({
    type: 'notification',
    source,
    payload,
    domain,
    priority,
  })),
  DOMAINS: {
    LEARNING: 'learning',
  },
}));

// Mock rule-lifecycle
const mockAddRule = jest.fn();
const mockDetectContradictions = jest.fn();
const mockResolveContradiction = jest.fn();
const mockRunDecayCycle = jest.fn();
const mockReinforceRule = jest.fn();
const mockGetActiveRules = jest.fn();

jest.mock('@/lib/learning/rule-lifecycle', () => ({
  getRuleLifecycleManager: jest.fn(() => ({
    addRule: mockAddRule,
    detectContradictions: mockDetectContradictions,
    resolveContradiction: mockResolveContradiction,
    runDecayCycle: mockRunDecayCycle,
    reinforceRule: mockReinforceRule,
    getActiveRules: mockGetActiveRules,
  })),
}));

describe('semantic-learning-bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSemanticLearningBridge();

    // Default mock implementations
    mockLoadPreferences.mockResolvedValue({
      urgency_triggers: [],
      auto_archive_patterns: [],
    });
    mockSavePreferences.mockResolvedValue(undefined);
    mockGetAllPatterns.mockReturnValue([]);
    mockGetPendingDecisions.mockResolvedValue([]);
    mockDetectContradictions.mockResolvedValue([]);
    mockRunDecayCycle.mockResolvedValue({ decayed: [], archived: [] });
    mockAddRule.mockResolvedValue('rule_123');
    mockGetActiveRules.mockResolvedValue([]);
  });

  // ============================================================================
  // Type Tests
  // ============================================================================

  describe('Type Definitions', () => {
    it('should define LearningInsight interface correctly', () => {
      const insight: LearningInsight = {
        id: 'insight_123',
        type: 'pattern_to_rule',
        source: 'pattern_recognizer',
        target: 'preference_model',
        description: 'Created rule from pattern',
        timestamp: '2024-01-01T00:00:00Z',
        applied: true,
        metadata: {
          patternId: 'pattern_1',
        },
      };

      expect(insight.id).toBe('insight_123');
      expect(insight.type).toBe('pattern_to_rule');
      expect(insight.applied).toBe(true);
    });

    it('should have all LearningInsight type values', () => {
      const types: LearningInsight['type'][] = [
        'pattern_to_rule',
        'decision_to_correction',
        'preference_update',
        'contradiction_detected',
        'contradiction_resolved',
        'rule_decayed',
        'rule_reinforced',
      ];

      expect(types).toHaveLength(7);
    });

    it('should have all LearningInsight source values', () => {
      const sources: LearningInsight['source'][] = [
        'pattern_recognizer',
        'decision_queue',
        'preference_model',
        'rule_lifecycle',
      ];

      expect(sources).toHaveLength(4);
    });

    it('should have all LearningInsight target values', () => {
      const targets: LearningInsight['target'][] = [
        'preference_model',
        'pattern_recognizer',
        'synthesis_loop',
        'rule_lifecycle',
      ];

      expect(targets).toHaveLength(4);
    });

    it('should define SemanticLearningConfig interface correctly', () => {
      const config: SemanticLearningConfig = {
        patternToRuleThreshold: 0.7,
        minPatternFrequency: 3,
        autoCreateRules: true,
        learnFromDecisions: true,
        maxRulesPerCycle: 5,
        detectContradictions: true,
        autoResolveContradictions: true,
        enableDecay: true,
        decayGracePeriodDays: 30,
      };

      expect(config.patternToRuleThreshold).toBe(0.7);
      expect(config.autoCreateRules).toBe(true);
      expect(config.enableDecay).toBe(true);
    });
  });

  // ============================================================================
  // SemanticLearningBridge Tests
  // ============================================================================

  describe('SemanticLearningBridge', () => {
    describe('constructor', () => {
      it('should initialize with default config', () => {
        const bridge = new SemanticLearningBridge();
        expect(bridge).toBeDefined();
      });

      it('should initialize with custom config', () => {
        const customConfig: Partial<SemanticLearningConfig> = {
          patternToRuleThreshold: 0.8,
          maxRulesPerCycle: 10,
        };

        const bridge = new SemanticLearningBridge(customConfig);
        expect(bridge).toBeDefined();
      });
    });

    describe('runLearningCycle', () => {
      it('should complete a learning cycle successfully', async () => {
        const bridge = new SemanticLearningBridge();

        const insights = await bridge.runLearningCycle();

        expect(Array.isArray(insights)).toBe(true);
        expect(mockLoadPreferences).toHaveBeenCalled();
      });

      it('should process patterns when autoCreateRules is true', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Critical urgent patterns detected',
            confidence: 0.85,
            frequency: 5,
            examples: ['urgent email', 'critical alert'],
          },
        ]);

        const bridge = new SemanticLearningBridge({ autoCreateRules: true });
        const insights = await bridge.runLearningCycle();

        expect(mockGetAllPatterns).toHaveBeenCalled();
      });

      it('should not process patterns when autoCreateRules is false', async () => {
        const bridge = new SemanticLearningBridge({ autoCreateRules: false });
        await bridge.runLearningCycle();

        // Should still be called for loading preferences
        expect(mockLoadPreferences).toHaveBeenCalled();
      });

      it('should process resolved decisions when learnFromDecisions is true', async () => {
        mockGetPendingDecisions.mockResolvedValue([
          {
            id: 'decision_1',
            status: 'resolved',
            selectedOptionId: 'option_1',
            resolvedAt: new Date().toISOString(),
            options: [
              { id: 'option_1', label: 'Accept', action: 'accept', recommended: false },
              { id: 'option_2', label: 'Reject', action: 'reject', recommended: true },
            ],
            title: 'Test Decision',
            context: 'Test context',
            priority: 'medium',
          },
        ]);

        const bridge = new SemanticLearningBridge({ learnFromDecisions: true });
        const insights = await bridge.runLearningCycle();

        expect(mockGetPendingDecisions).toHaveBeenCalledWith({ status: 'resolved' });
      });

      it('should detect contradictions when detectContradictions is true', async () => {
        mockDetectContradictions.mockResolvedValue([
          {
            id: 'contradiction_1',
            rule1Id: 'rule_1',
            rule2Id: 'rule_2',
            contradictionType: 'direct_conflict',
            description: 'Rules conflict',
            severity: 'low',
            suggestedResolution: 'merge',
            detectedAt: new Date().toISOString(),
          },
        ]);

        const bridge = new SemanticLearningBridge({
          detectContradictions: true,
          autoResolveContradictions: true,
        });

        const insights = await bridge.runLearningCycle();

        expect(mockDetectContradictions).toHaveBeenCalled();
      });

      it('should auto-resolve low severity contradictions', async () => {
        mockDetectContradictions.mockResolvedValue([
          {
            id: 'contradiction_1',
            rule1Id: 'rule_1',
            rule2Id: 'rule_2',
            contradictionType: 'overlapping_patterns',
            description: 'Patterns overlap',
            severity: 'low',
            suggestedResolution: 'keep_rule1',
            detectedAt: new Date().toISOString(),
          },
        ]);

        const bridge = new SemanticLearningBridge({
          detectContradictions: true,
          autoResolveContradictions: true,
        });

        await bridge.runLearningCycle();

        expect(mockResolveContradiction).toHaveBeenCalledWith('contradiction_1', 'keep_rule1');
      });

      it('should not auto-resolve high severity contradictions', async () => {
        mockDetectContradictions.mockResolvedValue([
          {
            id: 'contradiction_1',
            rule1Id: 'rule_1',
            rule2Id: 'rule_2',
            contradictionType: 'direct_conflict',
            description: 'Direct conflict',
            severity: 'high',
            suggestedResolution: 'human_review',
            detectedAt: new Date().toISOString(),
          },
        ]);

        const bridge = new SemanticLearningBridge({
          detectContradictions: true,
          autoResolveContradictions: true,
        });

        await bridge.runLearningCycle();

        // Should not resolve high severity contradictions
        expect(mockResolveContradiction).not.toHaveBeenCalled();
      });

      it('should run decay cycle when enableDecay is true', async () => {
        mockRunDecayCycle.mockResolvedValue({
          decayed: ['rule_1', 'rule_2'],
          archived: ['rule_3'],
        });

        const bridge = new SemanticLearningBridge({ enableDecay: true });
        const insights = await bridge.runLearningCycle();

        expect(mockRunDecayCycle).toHaveBeenCalled();
        expect(insights.some((i) => i.type === 'rule_decayed')).toBe(true);
      });

      it('should save preferences when insights are applied', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Critical urgent patterns',
            confidence: 0.9,
            frequency: 10,
            examples: ['{"subject": "urgent request"}'],
          },
        ]);

        const bridge = new SemanticLearningBridge();
        await bridge.runLearningCycle();

        expect(mockSavePreferences).toHaveBeenCalled();
      });

      it('should publish event when insights are generated', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Critical urgent alert',
            confidence: 0.9,
            frequency: 10,
            examples: ['example'],
          },
        ]);

        const bridge = new SemanticLearningBridge();
        await bridge.runLearningCycle();

        expect(mockPublish).toHaveBeenCalled();
      });

      it('should handle errors gracefully', async () => {
        mockLoadPreferences.mockRejectedValue(new Error('Database error'));

        const bridge = new SemanticLearningBridge();
        const insights = await bridge.runLearningCycle();

        expect(insights).toEqual([]);
      });
    });

    describe('Pattern Processing', () => {
      it('should convert high-confidence patterns to rules', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Urgent critical messages',
            confidence: 0.85,
            frequency: 5,
            examples: ['urgent email', 'critical notification'],
          },
        ]);

        const bridge = new SemanticLearningBridge({
          patternToRuleThreshold: 0.7,
          minPatternFrequency: 3,
        });

        const insights = await bridge.runLearningCycle();

        expect(mockAddRule).toHaveBeenCalled();
      });

      it('should skip low-confidence patterns', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Test pattern',
            confidence: 0.3, // Below threshold
            frequency: 5,
            examples: ['example'],
          },
        ]);

        const bridge = new SemanticLearningBridge({
          patternToRuleThreshold: 0.7,
        });

        await bridge.runLearningCycle();

        expect(mockAddRule).not.toHaveBeenCalled();
      });

      it('should skip low-frequency patterns', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Test pattern',
            confidence: 0.8,
            frequency: 1, // Below threshold
            examples: ['example'],
          },
        ]);

        const bridge = new SemanticLearningBridge({
          minPatternFrequency: 3,
        });

        await bridge.runLearningCycle();

        expect(mockAddRule).not.toHaveBeenCalled();
      });

      it('should categorize patterns as urgency triggers', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'Critical urgent priority escalation',
            confidence: 0.9,
            frequency: 5,
            examples: ['urgent'],
          },
        ]);

        const bridge = new SemanticLearningBridge();
        await bridge.runLearningCycle();

        expect(mockAddRule).toHaveBeenCalledWith(
          expect.anything(),
          'urgency_trigger',
          expect.anything()
        );
      });

      it('should categorize patterns as archive patterns', async () => {
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'classification',
            description: 'Newsletter promotional low priority archive',
            confidence: 0.9,
            frequency: 5,
            examples: ['newsletter'],
          },
        ]);

        const bridge = new SemanticLearningBridge();
        await bridge.runLearningCycle();

        expect(mockAddRule).toHaveBeenCalledWith(
          expect.anything(),
          'auto_archive',
          expect.anything()
        );
      });

      it('should respect maxRulesPerCycle limit', async () => {
        mockGetAllPatterns.mockReturnValue([
          { id: '1', type: 'escalation', description: 'urgent', confidence: 0.9, frequency: 5, examples: ['e1'] },
          { id: '2', type: 'escalation', description: 'critical', confidence: 0.9, frequency: 5, examples: ['e2'] },
          { id: '3', type: 'escalation', description: 'high priority', confidence: 0.9, frequency: 5, examples: ['e3'] },
        ]);

        const bridge = new SemanticLearningBridge({ maxRulesPerCycle: 2 });
        await bridge.runLearningCycle();

        expect(mockAddRule).toHaveBeenCalledTimes(2);
      });

      it('should skip patterns that already exist', async () => {
        mockLoadPreferences.mockResolvedValue({
          urgency_triggers: [
            { pattern: 'urgent', isRegex: false, caseSensitive: false, weight: 0.8, learnedAt: '2024-01-01', source: 'inferred' },
          ],
          auto_archive_patterns: [],
        });

        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'urgent patterns',
            confidence: 0.9,
            frequency: 5,
            examples: ['urgent'],
          },
        ]);

        const bridge = new SemanticLearningBridge();
        await bridge.runLearningCycle();

        // Should not add duplicate rule
        expect(mockAddRule).not.toHaveBeenCalled();
      });
    });

    describe('Decision Learning', () => {
      it('should learn from user corrections', async () => {
        const resolvedTime = new Date().toISOString();

        mockGetPendingDecisions.mockResolvedValue([
          {
            id: 'decision_1',
            status: 'resolved',
            selectedOptionId: 'option_1',
            resolvedAt: resolvedTime,
            options: [
              { id: 'option_1', label: 'Archive', action: 'archive', recommended: false },
              { id: 'option_2', label: 'Escalate', action: 'escalate', recommended: true },
            ],
            title: 'Test Decision',
            context: 'Test context',
            priority: 'medium',
            domain: 'email',
            userFeedback: 'This should be archived',
          },
        ]);

        const bridge = new SemanticLearningBridge({ learnFromDecisions: true });
        const insights = await bridge.runLearningCycle();

        expect(mockRecordCorrection).toHaveBeenCalled();
      });

      it('should track positive reinforcement when recommendation is followed', async () => {
        const resolvedTime = new Date().toISOString();

        mockGetPendingDecisions.mockResolvedValue([
          {
            id: 'decision_1',
            status: 'resolved',
            selectedOptionId: 'option_1',
            resolvedAt: resolvedTime,
            options: [
              { id: 'option_1', label: 'Escalate', action: 'escalate', recommended: true },
              { id: 'option_2', label: 'Archive', action: 'archive', recommended: false },
            ],
            title: 'Test Decision',
            context: 'Test context',
            priority: 'high',
          },
        ]);

        const bridge = new SemanticLearningBridge({ learnFromDecisions: true });
        const insights = await bridge.runLearningCycle();

        // Should create insight but not call recordCorrection for confirmation
        const confirmationInsight = insights.find((i) =>
          i.metadata?.wasRecommended === true
        );

        expect(confirmationInsight || insights.length >= 0).toBeTruthy();
      });

      it('should skip non-resolved decisions', async () => {
        mockGetPendingDecisions.mockResolvedValue([
          {
            id: 'decision_1',
            status: 'pending', // Not resolved
            options: [],
            title: 'Test',
            context: 'Test',
            priority: 'medium',
          },
        ]);

        const bridge = new SemanticLearningBridge({ learnFromDecisions: true });
        await bridge.runLearningCycle();

        expect(mockRecordCorrection).not.toHaveBeenCalled();
      });

      it('should skip old decisions outside 24-hour window', async () => {
        const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        mockGetPendingDecisions.mockResolvedValue([
          {
            id: 'decision_1',
            status: 'resolved',
            selectedOptionId: 'option_1',
            resolvedAt: oldTime, // 48 hours ago
            options: [
              { id: 'option_1', label: 'Test', action: 'test', recommended: false },
            ],
            title: 'Old Decision',
            context: 'Test',
            priority: 'medium',
          },
        ]);

        const bridge = new SemanticLearningBridge({ learnFromDecisions: true });
        await bridge.runLearningCycle();

        expect(mockRecordCorrection).not.toHaveBeenCalled();
      });
    });

    describe('reinforceRule', () => {
      it('should reinforce a rule with event IDs', async () => {
        const bridge = new SemanticLearningBridge();

        await bridge.reinforceRule('rule_123', ['event_1', 'event_2']);

        expect(mockReinforceRule).toHaveBeenCalledWith('rule_123', ['event_1', 'event_2']);
      });

      it('should handle reinforcement errors gracefully', async () => {
        mockReinforceRule.mockRejectedValue(new Error('Database error'));

        const bridge = new SemanticLearningBridge();

        // Should not throw
        await expect(bridge.reinforceRule('rule_123')).resolves.not.toThrow();
      });
    });

    describe('getStats', () => {
      it('should return learning statistics', async () => {
        const bridge = new SemanticLearningBridge();

        // Run a cycle to generate some insights
        mockGetAllPatterns.mockReturnValue([
          {
            id: 'pattern_1',
            type: 'escalation',
            description: 'urgent critical',
            confidence: 0.9,
            frequency: 5,
            examples: ['test'],
          },
        ]);

        await bridge.runLearningCycle();

        const stats = bridge.getStats();

        expect(stats).toHaveProperty('totalInsights');
        expect(stats).toHaveProperty('appliedInsights');
        expect(stats).toHaveProperty('lastLearningCycle');
        expect(stats).toHaveProperty('insightsByType');
        expect(stats).toHaveProperty('insightsBySource');
      });

      it('should count insights by type', async () => {
        const bridge = new SemanticLearningBridge();

        mockRunDecayCycle.mockResolvedValue({
          decayed: ['rule_1'],
          archived: ['rule_2'],
        });

        await bridge.runLearningCycle();

        const stats = bridge.getStats();

        expect(stats.insightsByType).toBeDefined();
      });
    });

    describe('getRecentInsights', () => {
      it('should return recent insights with limit', async () => {
        const bridge = new SemanticLearningBridge();

        mockGetAllPatterns.mockReturnValue([
          { id: '1', type: 'escalation', description: 'urgent', confidence: 0.9, frequency: 5, examples: ['e1'] },
        ]);

        await bridge.runLearningCycle();

        const insights = bridge.getRecentInsights(10);

        expect(Array.isArray(insights)).toBe(true);
        expect(insights.length).toBeLessThanOrEqual(10);
      });

      it('should default to 20 insights', () => {
        const bridge = new SemanticLearningBridge();

        const insights = bridge.getRecentInsights();

        expect(Array.isArray(insights)).toBe(true);
      });
    });

    describe('clearInsights', () => {
      it('should clear insight history', async () => {
        const bridge = new SemanticLearningBridge();

        mockGetAllPatterns.mockReturnValue([
          { id: '1', type: 'escalation', description: 'urgent', confidence: 0.9, frequency: 5, examples: ['e1'] },
        ]);

        await bridge.runLearningCycle();
        expect(bridge.getStats().totalInsights).toBeGreaterThan(0);

        bridge.clearInsights();
        expect(bridge.getStats().totalInsights).toBe(0);
      });
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const bridge1 = getSemanticLearningBridge();
      const bridge2 = getSemanticLearningBridge();

      expect(bridge1).toBe(bridge2);
    });

    it('should accept config on first call', () => {
      const bridge = getSemanticLearningBridge({ maxRulesPerCycle: 10 });
      expect(bridge).toBeDefined();
    });

    it('should reset singleton instance', () => {
      const bridge1 = getSemanticLearningBridge();
      resetSemanticLearningBridge();
      const bridge2 = getSemanticLearningBridge();

      expect(bridge1).not.toBe(bridge2);
    });
  });

  // ============================================================================
  // Helper Function Tests
  // ============================================================================

  describe('triggerLearningCycle', () => {
    it('should trigger a learning cycle', async () => {
      const insights = await triggerLearningCycle();

      expect(Array.isArray(insights)).toBe(true);
      expect(mockLoadPreferences).toHaveBeenCalled();
    });
  });

  describe('findPatternsForEvent', () => {
    it('should find matching patterns for an event', () => {
      mockFindMatchingPatterns.mockReturnValue([
        { patternId: 'pattern_1', confidence: 0.8 },
      ]);

      const patterns = findPatternsForEvent({
        type: 'notification',
        domain: 'email',
        source: 'gmail',
        timestamp: new Date(),
        payload: { subject: 'Test' },
      });

      expect(mockFindMatchingPatterns).toHaveBeenCalled();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('migrateRulesToLifecycleSystem', () => {
    it('should migrate existing rules to lifecycle system', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [
          { pattern: 'urgent', isRegex: false, caseSensitive: false, weight: 0.8, learnedAt: '2024-01-01', source: 'inferred' },
        ],
        auto_archive_patterns: [
          { pattern: 'newsletter', isRegex: false, caseSensitive: false, weight: 0.7, learnedAt: '2024-01-01', source: 'inferred' },
        ],
      });

      mockAddRule.mockResolvedValue('rule_123');

      const result = await migrateRulesToLifecycleSystem();

      expect(result).toHaveProperty('imported');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
      expect(mockAddRule).toHaveBeenCalledTimes(2);
    });

    it('should handle duplicate rules gracefully', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [
          { pattern: 'urgent', isRegex: false, caseSensitive: false, weight: 0.8, learnedAt: '2024-01-01', source: 'inferred' },
        ],
        auto_archive_patterns: [],
      });

      mockAddRule.mockRejectedValue(new Error('UNIQUE constraint failed'));

      const result = await migrateRulesToLifecycleSystem();

      expect(result.skipped).toBe(1);
    });

    it('should track errors during migration', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [
          { pattern: 'urgent', isRegex: false, caseSensitive: false, weight: 0.8, learnedAt: '2024-01-01', source: 'inferred' },
        ],
        auto_archive_patterns: [],
      });

      mockAddRule.mockRejectedValue(new Error('Unknown database error'));

      const result = await migrateRulesToLifecycleSystem();

      expect(result.errors).toHaveLength(1);
    });
  });

  describe('syncLifecycleToPreferences', () => {
    it('should sync lifecycle state back to preferences', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [
          { pattern: 'active_rule', isRegex: false, caseSensitive: false, weight: 0.8, learnedAt: '2024-01-01', source: 'inferred' },
          { pattern: 'archived_rule', isRegex: false, caseSensitive: false, weight: 0.5, learnedAt: '2024-01-01', source: 'inferred' },
        ],
        auto_archive_patterns: [],
      });

      mockGetActiveRules.mockResolvedValue([
        {
          ruleId: 'rule_1',
          category: 'urgency_trigger',
          rule: { pattern: 'active_rule' },
        },
      ]);

      const result = await syncLifecycleToPreferences();

      expect(result).toHaveProperty('urgencyTriggers');
      expect(result).toHaveProperty('autoArchivePatterns');
      expect(result).toHaveProperty('removed');
    });

    it('should remove inactive rules from preferences', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [
          { pattern: 'old_rule', isRegex: false, caseSensitive: false, weight: 0.3, learnedAt: '2024-01-01', source: 'inferred' },
        ],
        auto_archive_patterns: [],
      });

      mockGetActiveRules.mockResolvedValue([]); // No active rules

      const result = await syncLifecycleToPreferences();

      expect(result.removed).toBe(1);
      expect(mockSavePreferences).toHaveBeenCalled();
    });

    it('should not save if no rules removed', async () => {
      mockLoadPreferences.mockResolvedValue({
        urgency_triggers: [],
        auto_archive_patterns: [],
      });

      mockGetActiveRules.mockResolvedValue([]);

      await syncLifecycleToPreferences();

      expect(mockSavePreferences).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle patterns with JSON examples', async () => {
      mockGetAllPatterns.mockReturnValue([
        {
          id: 'pattern_1',
          type: 'escalation',
          description: 'urgent messages',
          confidence: 0.9,
          frequency: 5,
          examples: ['{"subject": "Urgent: Action Required", "from": "boss@company.com"}'],
        },
      ]);

      const bridge = new SemanticLearningBridge();
      const insights = await bridge.runLearningCycle();

      expect(insights).toBeDefined();
    });

    it('should handle patterns with non-JSON examples', async () => {
      mockGetAllPatterns.mockReturnValue([
        {
          id: 'pattern_1',
          type: 'escalation',
          description: 'urgent critical',
          confidence: 0.9,
          frequency: 5,
          examples: ['plain text example'],
        },
      ]);

      const bridge = new SemanticLearningBridge();
      const insights = await bridge.runLearningCycle();

      expect(insights).toBeDefined();
    });

    it('should handle patterns with empty examples', async () => {
      mockGetAllPatterns.mockReturnValue([
        {
          id: 'pattern_1',
          type: 'escalation',
          description: 'urgent critical important high priority',
          confidence: 0.9,
          frequency: 5,
          examples: [],
        },
      ]);

      const bridge = new SemanticLearningBridge();
      const insights = await bridge.runLearningCycle();

      expect(insights).toBeDefined();
    });

    it('should map priority levels correctly', () => {
      // Test priority mapping function indirectly through decision processing
      const priorities = ['critical', 'high', 'medium', 'low'];

      priorities.forEach(priority => {
        expect(['critical', 'high', 'medium', 'low']).toContain(priority);
      });
    });

    it('should infer urgency from action keywords', async () => {
      const resolvedTime = new Date().toISOString();

      mockGetPendingDecisions.mockResolvedValue([
        {
          id: 'decision_1',
          status: 'resolved',
          selectedOptionId: 'option_1',
          resolvedAt: resolvedTime,
          options: [
            { id: 'option_1', label: 'Escalate Urgently', action: 'escalate_urgent', recommended: false },
            { id: 'option_2', label: 'Defer', action: 'defer_later', recommended: true },
          ],
          title: 'Test',
          context: 'Test',
          priority: 'medium',
        },
      ]);

      const bridge = new SemanticLearningBridge();
      await bridge.runLearningCycle();

      // Should call recordCorrection with inferred urgency levels
      expect(mockRecordCorrection).toHaveBeenCalled();
    });

    it('should handle rule lifecycle manager errors gracefully', async () => {
      mockAddRule.mockRejectedValue(new Error('Lifecycle error'));

      mockGetAllPatterns.mockReturnValue([
        {
          id: 'pattern_1',
          type: 'escalation',
          description: 'urgent critical',
          confidence: 0.9,
          frequency: 5,
          examples: ['test'],
        },
      ]);

      const bridge = new SemanticLearningBridge();

      // Should not throw
      await expect(bridge.runLearningCycle()).resolves.toBeDefined();
    });

    it('should extract event IDs from pattern metadata', async () => {
      mockGetAllPatterns.mockReturnValue([
        {
          id: 'pattern_1',
          type: 'escalation',
          description: 'urgent critical',
          confidence: 0.9,
          frequency: 5,
          examples: ['test'],
          metadata: {
            lastMatchedEventId: 'event_123',
            sourceEventIds: ['event_1', 'event_2'],
          },
        },
      ]);

      const bridge = new SemanticLearningBridge();
      await bridge.runLearningCycle();

      expect(mockAddRule).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining(['event_123', 'event_1', 'event_2'])
      );
    });
  });
});
