/**
 * AI Observability Tests
 *
 * Tests for the PM AI triage observability layer including:
 * - Decision recording
 * - Human feedback capture
 * - Analytics and metrics
 * - Confidence threshold analysis
 */

import {
  recordTriageDecision,
  recordHumanFeedback,
  getDisagreementSummary,
  getConfidenceDistribution,
  getPerformanceMetrics,
  getRecentDisagreements,
  getPendingReviewDecisions,
  analyzeOptimalThreshold,
  type TriageDecisionRecord,
} from '@/lib/pm/ai-observability';
import type { IncomingSignal, TriageResult } from '@/lib/pm/task-queue';
import type { AITriageResult } from '@/lib/pm/ai-triage';

// Mock the database
const mockDbRun = jest.fn(() => ({ changes: 1 }));
const mockDbGet = jest.fn();
const mockDbAll = jest.fn(() => []);
const mockDbExec = jest.fn();
const mockDbPrepare = jest.fn(() => ({
  run: mockDbRun,
  get: mockDbGet,
  all: mockDbAll,
}));

jest.mock('@/lib/db/Database', () => ({
  getDatabase: () => ({
    getRawDb: () => ({
      exec: mockDbExec,
      prepare: mockDbPrepare,
    }),
  }),
}));

// Mock pm-memory
jest.mock('@/lib/pm/pm-memory', () => ({
  addPMMemory: jest.fn().mockResolvedValue(undefined),
  searchPMMemories: jest.fn().mockResolvedValue([]),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('AI Observability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordTriageDecision', () => {
    const mockSignal: IncomingSignal = {
      id: 'signal_123',
      source: 'github',
      signal_type: 'task',
      payload: { title: 'Test issue', action: 'opened' },
      timestamp: Math.floor(Date.now() / 1000),
      confidence: 0.85,
    };

    const mockAIResult: AITriageResult = {
      action: 'local_task',
      rationale: 'AI determined this is a routine task',
      priority: 'medium',
      escalation_level: 'auto',
      confidence: 0.82,
      ai_rationale: 'AI determined this is a routine task',
      zep_context_used: true,
      model_used: 'gpt-4.1-2025-04-14',
      metadata: {
        ai_powered: true,
        processing_time_ms: 150,
      },
    };

    const mockRuleResult: TriageResult = {
      action: 'local_task',
      rationale: 'github-issue-opened rule matched',
      priority: 'medium',
      escalation_level: 'auto',
      metadata: {
        rule_id: 'github-issue-opened',
      },
    };

    test('should record a decision when AI and rules agree', async () => {
      const result = await recordTriageDecision({
        signal: mockSignal,
        aiResult: mockAIResult,
        ruleResult: mockRuleResult,
        finalResult: mockAIResult,
        decisionSource: 'ai',
      });

      expect(result).toMatch(/^td_/);
      expect(mockDbPrepare).toHaveBeenCalled();
      expect(mockDbRun).toHaveBeenCalled();

      // Check that ai_rules_agreed was set to 1
      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_rules_agreed).toBe(1);
      expect(runCall.disagreement_type).toBeNull();
    });

    test('should record disagreement when AI and rules differ on action', async () => {
      const disagreedRuleResult: TriageResult = {
        ...mockRuleResult,
        action: 'github_issue',
      };

      await recordTriageDecision({
        signal: mockSignal,
        aiResult: mockAIResult,
        ruleResult: disagreedRuleResult,
        finalResult: mockAIResult,
        decisionSource: 'ai',
      });

      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_rules_agreed).toBe(0);
      expect(runCall.disagreement_type).toBe('action');
    });

    test('should record disagreement when AI and rules differ on escalation', async () => {
      const disagreedRuleResult: TriageResult = {
        ...mockRuleResult,
        escalation_level: 'propose',
      };

      await recordTriageDecision({
        signal: mockSignal,
        aiResult: mockAIResult,
        ruleResult: disagreedRuleResult,
        finalResult: mockAIResult,
        decisionSource: 'ai',
      });

      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_rules_agreed).toBe(0);
      expect(runCall.disagreement_type).toBe('escalation');
    });

    test('should record multiple disagreement types', async () => {
      const disagreedRuleResult: TriageResult = {
        ...mockRuleResult,
        action: 'github_issue',
        escalation_level: 'propose',
        priority: 'high',
      };

      await recordTriageDecision({
        signal: mockSignal,
        aiResult: mockAIResult,
        ruleResult: disagreedRuleResult,
        finalResult: mockAIResult,
        decisionSource: 'ai',
      });

      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_rules_agreed).toBe(0);
      expect(runCall.disagreement_type).toBe('multiple');
    });

    test('should handle AI-only decisions (no rules result)', async () => {
      await recordTriageDecision({
        signal: mockSignal,
        aiResult: mockAIResult,
        ruleResult: null,
        finalResult: mockAIResult,
        decisionSource: 'ai',
      });

      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_action).toBe('local_task');
      expect(runCall.rule_action).toBeNull();
      expect(runCall.ai_rules_agreed).toBe(0); // Can't agree with nothing
    });

    test('should handle rules-only decisions (no AI result)', async () => {
      await recordTriageDecision({
        signal: mockSignal,
        aiResult: null,
        ruleResult: mockRuleResult,
        finalResult: mockRuleResult,
        decisionSource: 'rules',
      });

      const runCall = mockDbRun.mock.calls[0][0];
      expect(runCall.ai_action).toBeNull();
      expect(runCall.rule_action).toBe('local_task');
      expect(runCall.decision_source).toBe('rules');
    });
  });

  describe('recordHumanFeedback', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should record human feedback and update decision', async () => {
      mockDbGet.mockReturnValueOnce({
        id: 'td_123',
        signal_source: 'github',
        signal_type: 'task',
        ai_action: 'local_task',
        rule_action: 'github_issue',
        final_action: 'defer',
      });

      const result = await recordHumanFeedback({
        decisionId: 'td_123',
        humanAction: 'local_task',
        humanEscalation: 'auto',
        humanPriority: 'medium',
        feedback: 'AI was correct, this is a routine sync task',
      });

      expect(result).toBe(true);
      // Verify prepare was called (for the UPDATE statement)
      expect(mockDbPrepare).toHaveBeenCalled();
      // Verify run was called with the parameters
      expect(mockDbRun).toHaveBeenCalled();
    });

    test('should return false if decision not found', async () => {
      mockDbGet.mockReturnValueOnce(null);

      const result = await recordHumanFeedback({
        decisionId: 'td_nonexistent',
        humanAction: 'local_task',
      });

      expect(result).toBe(false);
    });

    test('should persist feedback to Zep memory for learning', async () => {
      const { addPMMemory } = require('@/lib/pm/pm-memory');

      mockDbGet.mockReturnValueOnce({
        id: 'td_123',
        signal_source: 'github',
        signal_type: 'task',
        ai_action: 'local_task',
        rule_action: 'github_issue',
        final_action: 'defer',
      });

      await recordHumanFeedback({
        decisionId: 'td_123',
        humanAction: 'local_task',
        feedback: 'AI was correct',
      });

      expect(addPMMemory).toHaveBeenCalledWith(
        expect.stringContaining('Human override'),
        'pattern',
        expect.objectContaining({
          type: 'human_override',
        })
      );
    });
  });

  describe('getDisagreementSummary', () => {
    test('should return summary with agreement rate', () => {
      // Mock the various count queries
      mockDbGet
        .mockReturnValueOnce({ count: 100 }) // total
        .mockReturnValueOnce({ count: 80 })  // both available
        .mockReturnValueOnce({ count: 10 })  // ai only
        .mockReturnValueOnce({ count: 10 })  // rules only
        .mockReturnValueOnce({ count: 60 }); // agreements

      mockDbAll.mockReturnValueOnce([
        { disagreement_type: 'action', count: 10 },
        { disagreement_type: 'escalation', count: 5 },
        { disagreement_type: 'multiple', count: 5 },
      ]);

      mockDbGet
        .mockReturnValueOnce({ count: 5 })   // overrides
        .mockReturnValueOnce({ count: 3 })   // ai correct
        .mockReturnValueOnce({ count: 1 });  // rules correct

      const summary = getDisagreementSummary();

      expect(summary.total_decisions).toBe(100);
      expect(summary.both_available).toBe(80);
      expect(summary.agreements).toBe(60);
      expect(summary.disagreements).toBe(20); // 80 - 60
      expect(summary.agreement_rate).toBe(0.75); // 60 / 80
      expect(summary.disagreement_by_type.action).toBe(10);
      expect(summary.disagreement_by_type.escalation).toBe(5);
      expect(summary.disagreement_by_type.multiple).toBe(5);
      expect(summary.human_overrides).toBe(5);
      expect(summary.ai_correct_after_override).toBe(3);
      expect(summary.rules_correct_after_override).toBe(1);
    });

    test('should handle empty dataset', () => {
      mockDbGet.mockReturnValue({ count: 0 });
      mockDbAll.mockReturnValue([]);

      const summary = getDisagreementSummary();

      expect(summary.total_decisions).toBe(0);
      expect(summary.agreement_rate).toBe(0);
    });
  });

  describe('getConfidenceDistribution', () => {
    test('should return confidence buckets', () => {
      // Mock each bucket's queries
      for (let i = 0; i < 5; i++) {
        mockDbGet
          .mockReturnValueOnce({ count: 20 - i * 3 })  // total
          .mockReturnValueOnce({ count: 15 - i * 2 })  // accepted
          .mockReturnValueOnce({ count: 3 })           // fallback
          .mockReturnValueOnce({ count: 2 });          // override
      }

      const distribution = getConfidenceDistribution();

      expect(distribution).toHaveLength(5);
      expect(distribution[0].bucket).toBe('0-20%');
      expect(distribution[4].bucket).toBe('80-100%');

      // Each bucket should have counts
      distribution.forEach(bucket => {
        expect(bucket.count).toBeGreaterThanOrEqual(0);
        expect(bucket.ai_accepted).toBeGreaterThanOrEqual(0);
        expect(bucket.fallback_to_rules).toBeGreaterThanOrEqual(0);
        expect(bucket.human_override).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getPerformanceMetrics', () => {
    test('should return performance metrics', () => {
      mockDbGet.mockReturnValueOnce({
        total: 100,
        ai_processed: 85,
        avg_confidence: 0.75,
        avg_time: 120,
        zep_used: 70,
        overrides: 5,
      });

      const metrics = getPerformanceMetrics();

      expect(metrics.total_signals).toBe(100);
      expect(metrics.ai_processed).toBe(85);
      expect(metrics.ai_success_rate).toBe(0.85);
      expect(metrics.avg_ai_confidence).toBe(0.75);
      expect(metrics.avg_processing_time_ms).toBe(120);
      expect(metrics.zep_context_usage_rate).toBeCloseTo(0.82, 1);
      expect(metrics.human_override_rate).toBe(0.05);
    });

    test('should handle null averages', () => {
      mockDbGet.mockReturnValueOnce({
        total: 0,
        ai_processed: 0,
        avg_confidence: null,
        avg_time: null,
        zep_used: 0,
        overrides: 0,
      });

      const metrics = getPerformanceMetrics();

      expect(metrics.avg_ai_confidence).toBe(0);
      expect(metrics.avg_processing_time_ms).toBe(0);
    });
  });

  describe('getRecentDisagreements', () => {
    test('should return recent disagreement records', () => {
      mockDbAll.mockReturnValueOnce([
        {
          id: 'td_1',
          signal_id: 'sig_1',
          signal_source: 'github',
          signal_type: 'task',
          timestamp: Date.now() / 1000,
          ai_action: 'local_task',
          ai_escalation: 'auto',
          ai_confidence: 0.75,
          rule_action: 'github_issue',
          rule_escalation: 'propose',
          final_action: 'defer',
          final_escalation: 'propose',
          final_priority: 'medium',
          decision_source: 'merged',
          ai_rules_agreed: 0,
          disagreement_type: 'action',
        },
      ]);

      const disagreements = getRecentDisagreements(10);

      expect(disagreements).toHaveLength(1);
      expect(disagreements[0].ai_action).toBe('local_task');
      expect(disagreements[0].rule_action).toBe('github_issue');
      expect(disagreements[0].ai_rules_agreed).toBe(false);
    });
  });

  describe('getPendingReviewDecisions', () => {
    test('should return decisions pending human review', () => {
      mockDbAll.mockReturnValueOnce([
        {
          id: 'td_1',
          signal_id: 'sig_1',
          signal_source: 'comms',
          signal_type: 'follow_up',
          timestamp: Date.now() / 1000,
          ai_action: 'local_task',
          rule_action: 'defer',
          final_action: 'defer',
          final_escalation: 'propose',
          final_priority: 'medium',
          decision_source: 'merged',
          human_override: 0,
          ai_rules_agreed: 0,
        },
      ]);

      const pending = getPendingReviewDecisions(20);

      expect(pending).toHaveLength(1);
      expect(pending[0].human_override).toBe(false);
      expect(pending[0].ai_rules_agreed).toBe(false);
    });
  });

  describe('analyzeOptimalThreshold', () => {
    test('should return threshold analysis with recommendations', () => {
      // Mock queries for each threshold level
      const thresholds = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

      thresholds.forEach(() => {
        mockDbGet
          .mockReturnValueOnce({ count: 50 })  // above threshold
          .mockReturnValueOnce({ count: 100 }) // total
          .mockReturnValueOnce({ count: 8 })   // human agreed
          .mockReturnValueOnce({ count: 10 })  // human reviewed
          .mockReturnValueOnce({ count: 5 });  // disagreed
      });

      const analysis = analyzeOptimalThreshold();

      expect(analysis.current_threshold).toBe(0.6);
      expect(analysis.recommended_threshold).toBeGreaterThanOrEqual(0.4);
      expect(analysis.recommended_threshold).toBeLessThanOrEqual(0.9);
      expect(analysis.analysis).toHaveLength(6);

      analysis.analysis.forEach(a => {
        expect(a.threshold).toBeGreaterThanOrEqual(0.4);
        expect(a.ai_acceptance_rate).toBeGreaterThanOrEqual(0);
        expect(a.ai_acceptance_rate).toBeLessThanOrEqual(1);
      });
    });
  });
});
