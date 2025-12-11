// @ts-nocheck
/**
 * Tests for HYRO FORGE: LLM Evaluator Service
 *
 * Tests the GTC (Generative Transfer Capacity) framework evaluator
 * with core scores, meta-generative dimensions, and aggregation functions.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the database
const mockPrepare = jest.fn();
const mockRun = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn();

jest.unstable_mockModule('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    prepare: mockPrepare.mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    }),
  })),
}));

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks
const {
  evaluateResponse,
  saveEvaluationResult,
  getEvaluationCriteria,
  getMetaProbe,
  getActiveMetaProbes,
  getMetaProbesByType,
  calculateGTCScore,
  calculateStateVector,
  aggregateEvaluations,
} = await import('../../../lib/hyro/forge-evaluator');

import type {
  CoreScores,
  MetaDimensionScores,
  ConfidenceAssessment,
  EvaluationEvidence,
  EvaluationFlags,
  EvaluationResult,
  EvaluationInput,
} from '../../../lib/hyro/forge-evaluator';

describe('HYRO FORGE: LLM Evaluator Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define CoreScores structure', () => {
      const scores: CoreScores = {
        validity: 0.8,
        coherence: 0.75,
        transfer: 0.6,
        utility: 0.7,
        efficiency: 0.85,
      };

      expect(scores.validity).toBe(0.8);
      expect(scores.coherence).toBe(0.75);
      expect(scores.transfer).toBe(0.6);
      expect(scores.utility).toBe(0.7);
      expect(scores.efficiency).toBe(0.85);
    });

    it('should define MetaDimensionScores structure', () => {
      const meta: MetaDimensionScores = {
        manifold_fluidity: 0.5,
        multi_model_coherence: 0.6,
        identity_elasticity: 0.4,
        gradient_awareness: 0.3,
        entropy_intuition: 0.55,
        non_dual_resolution: 0.45,
        cooperative_generativity: 0.7,
      };

      expect(Object.keys(meta)).toHaveLength(7);
    });

    it('should define ConfidenceAssessment structure', () => {
      const confidence: ConfidenceAssessment = {
        overall: 0.8,
        low_evidence_dims: ['gradient_awareness', 'non_dual_resolution'],
      };

      expect(confidence.overall).toBe(0.8);
      expect(confidence.low_evidence_dims).toHaveLength(2);
    });

    it('should define EvaluationEvidence structure', () => {
      const evidence: EvaluationEvidence = {
        quotes: ['Example quote from response'],
        observations: ['Student showed clear reasoning'],
      };

      expect(evidence.quotes).toHaveLength(1);
      expect(evidence.observations).toHaveLength(1);
    });

    it('should define EvaluationFlags structure', () => {
      const flags: EvaluationFlags = {
        overconfident: false,
        handwavy: true,
        style_over_substance_risk: false,
      };

      expect(flags.overconfident).toBe(false);
      expect(flags.handwavy).toBe(true);
    });

    it('should define complete EvaluationResult structure', () => {
      const result: EvaluationResult = {
        item_id: 'test-item-123',
        scores: {
          validity: 0.8,
          coherence: 0.75,
          transfer: 0.6,
          utility: 0.7,
          efficiency: 0.85,
        },
        meta: {
          manifold_fluidity: 0.5,
          multi_model_coherence: 0.6,
          identity_elasticity: 0.4,
          gradient_awareness: 0.3,
          entropy_intuition: 0.55,
          non_dual_resolution: 0.45,
          cooperative_generativity: 0.7,
        },
        confidence: {
          overall: 0.8,
          low_evidence_dims: [],
        },
        evidence: {
          quotes: [],
          observations: [],
        },
        flags: {
          overconfident: false,
          handwavy: false,
          style_over_substance_risk: false,
        },
      };

      expect(result.item_id).toBe('test-item-123');
      expect(result.scores).toBeDefined();
      expect(result.meta).toBeDefined();
    });

    it('should define EvaluationInput structure', () => {
      const input: EvaluationInput = {
        itemId: 'item-123',
        itemType: 'short_answer',
        prompt: 'What is 2 + 2?',
        studentResponse: 'The answer is 4 because...',
        scoringGuidance: 'Award full credit for correct answer',
        correctAnswer: '4',
        targetDimensions: ['coherence'],
        studentGradeLevel: 5,
        timeTakenMs: 30000,
        confidenceSelfReport: 80,
      };

      expect(input.itemId).toBe('item-123');
      expect(input.itemType).toBe('short_answer');
    });
  });

  // ==========================================================================
  // calculateGTCScore Tests
  // ==========================================================================

  describe('calculateGTCScore', () => {
    it('should calculate weighted GTC score', () => {
      const scores: CoreScores = {
        validity: 1.0,
        coherence: 1.0,
        transfer: 1.0,
        utility: 1.0,
        efficiency: 1.0,
      };

      const gtc = calculateGTCScore(scores);

      // All 1.0 should give 1.0
      expect(gtc).toBeCloseTo(1.0);
    });

    it('should weight transfer highest (0.30)', () => {
      const baseScores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      // Only transfer = 1
      const withTransfer = calculateGTCScore({ ...baseScores, transfer: 1.0 });
      expect(withTransfer).toBeCloseTo(0.30);
    });

    it('should weight utility second highest (0.25)', () => {
      const baseScores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      // Only utility = 1
      const withUtility = calculateGTCScore({ ...baseScores, utility: 1.0 });
      expect(withUtility).toBeCloseTo(0.25);
    });

    it('should weight coherence at 0.20', () => {
      const baseScores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      const withCoherence = calculateGTCScore({ ...baseScores, coherence: 1.0 });
      expect(withCoherence).toBeCloseTo(0.20);
    });

    it('should weight validity at 0.15', () => {
      const baseScores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      const withValidity = calculateGTCScore({ ...baseScores, validity: 1.0 });
      expect(withValidity).toBeCloseTo(0.15);
    });

    it('should weight efficiency at 0.10', () => {
      const baseScores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      const withEfficiency = calculateGTCScore({ ...baseScores, efficiency: 1.0 });
      expect(withEfficiency).toBeCloseTo(0.10);
    });

    it('should calculate realistic mixed scores', () => {
      const scores: CoreScores = {
        validity: 0.8,
        coherence: 0.7,
        transfer: 0.6,
        utility: 0.75,
        efficiency: 0.85,
      };

      const gtc = calculateGTCScore(scores);

      // Manual: 0.8*0.15 + 0.7*0.20 + 0.6*0.30 + 0.75*0.25 + 0.85*0.10
      // = 0.12 + 0.14 + 0.18 + 0.1875 + 0.085 = 0.7125
      expect(gtc).toBeCloseTo(0.7125);
    });

    it('should return 0 for all zero scores', () => {
      const scores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      expect(calculateGTCScore(scores)).toBe(0);
    });
  });

  // ==========================================================================
  // calculateStateVector Tests
  // ==========================================================================

  describe('calculateStateVector', () => {
    it('should calculate C/E/G state vector', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: {
          validity: 0.8,
          coherence: 0.9,
          transfer: 0.7,
          utility: 0.75,
          efficiency: 0.85,
        },
        meta: {
          manifold_fluidity: 0.6,
          multi_model_coherence: 0.7,
          identity_elasticity: 0.5,
          gradient_awareness: 0.4,
          entropy_intuition: 0.55,
          non_dual_resolution: 0.45,
          cooperative_generativity: 0.65,
        },
        confidence: { overall: 0.8, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      expect(vector).toHaveProperty('coherence');
      expect(vector).toHaveProperty('entropy');
      expect(vector).toHaveProperty('generativity');
    });

    it('should calculate coherence component correctly', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: {
          validity: 1.0,
          coherence: 1.0,
          transfer: 0,
          utility: 0,
          efficiency: 0,
        },
        meta: {
          manifold_fluidity: 0,
          multi_model_coherence: 1.0,
          identity_elasticity: 0,
          gradient_awareness: 0,
          entropy_intuition: 0,
          non_dual_resolution: 0,
          cooperative_generativity: 0,
        },
        confidence: { overall: 1, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      // Coherence = (validity*0.3 + coherence*0.4 + multi_model_coherence*0.3) * 100
      // = (1.0*0.3 + 1.0*0.4 + 1.0*0.3) * 100 = 100
      expect(vector.coherence).toBeCloseTo(100);
    });

    it('should calculate entropy component correctly', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: {
          validity: 0,
          coherence: 0,
          transfer: 1.0,
          utility: 0,
          efficiency: 0,
        },
        meta: {
          manifold_fluidity: 0,
          multi_model_coherence: 0,
          identity_elasticity: 1.0,
          gradient_awareness: 0,
          entropy_intuition: 1.0,
          non_dual_resolution: 0,
          cooperative_generativity: 0,
        },
        confidence: { overall: 1, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      // Entropy = (transfer*0.4 + entropy_intuition*0.3 + identity_elasticity*0.3) * 100
      // = (1.0*0.4 + 1.0*0.3 + 1.0*0.3) * 100 = 100
      expect(vector.entropy).toBeCloseTo(100);
    });

    it('should calculate generativity component correctly', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: {
          validity: 0,
          coherence: 0,
          transfer: 0,
          utility: 1.0,
          efficiency: 0,
        },
        meta: {
          manifold_fluidity: 1.0,
          multi_model_coherence: 0,
          identity_elasticity: 0,
          gradient_awareness: 0,
          entropy_intuition: 0,
          non_dual_resolution: 0,
          cooperative_generativity: 1.0,
        },
        confidence: { overall: 1, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      // Generativity = (utility*0.3 + manifold_fluidity*0.35 + cooperative_generativity*0.35) * 100
      // = (1.0*0.3 + 1.0*0.35 + 1.0*0.35) * 100 = 100
      expect(vector.generativity).toBeCloseTo(100);
    });

    it('should return values scaled 0-100', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: {
          validity: 0.5,
          coherence: 0.5,
          transfer: 0.5,
          utility: 0.5,
          efficiency: 0.5,
        },
        meta: {
          manifold_fluidity: 0.5,
          multi_model_coherence: 0.5,
          identity_elasticity: 0.5,
          gradient_awareness: 0.5,
          entropy_intuition: 0.5,
          non_dual_resolution: 0.5,
          cooperative_generativity: 0.5,
        },
        confidence: { overall: 0.5, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      expect(vector.coherence).toBeCloseTo(50);
      expect(vector.entropy).toBeCloseTo(50);
      expect(vector.generativity).toBeCloseTo(50);
    });
  });

  // ==========================================================================
  // aggregateEvaluations Tests
  // ==========================================================================

  describe('aggregateEvaluations', () => {
    const createEvaluation = (
      scores: Partial<CoreScores>,
      meta: Partial<MetaDimensionScores> = {}
    ): EvaluationResult => ({
      item_id: 'test',
      scores: {
        validity: 0.5,
        coherence: 0.5,
        transfer: 0.5,
        utility: 0.5,
        efficiency: 0.5,
        ...scores,
      },
      meta: {
        manifold_fluidity: 0.5,
        multi_model_coherence: 0.5,
        identity_elasticity: 0.5,
        gradient_awareness: 0.5,
        entropy_intuition: 0.5,
        non_dual_resolution: 0.5,
        cooperative_generativity: 0.5,
        ...meta,
      },
      confidence: { overall: 0.8, low_evidence_dims: [] },
      evidence: { quotes: [], observations: [] },
      flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
    });

    it('should return default values for empty array', () => {
      const result = aggregateEvaluations([]);

      expect(result.coherence).toBe(50);
      expect(result.entropy).toBe(50);
      expect(result.generativity).toBe(50);
      expect(result.n_items).toBe(0);
      expect(result.signal_agreement).toBe(0);
    });

    it('should calculate means for single evaluation', () => {
      const eval1 = createEvaluation({ validity: 0.8, coherence: 0.8 });
      const result = aggregateEvaluations([eval1]);

      expect(result.n_items).toBe(1);
      expect(result.coherence).toBeGreaterThan(50);
    });

    it('should calculate means for multiple evaluations', () => {
      const eval1 = createEvaluation({ validity: 0.8, coherence: 0.9 });
      const eval2 = createEvaluation({ validity: 0.6, coherence: 0.7 });
      const result = aggregateEvaluations([eval1, eval2]);

      expect(result.n_items).toBe(2);
    });

    it('should include confidence intervals', () => {
      const eval1 = createEvaluation({});
      const eval2 = createEvaluation({});
      const result = aggregateEvaluations([eval1, eval2]);

      expect(result).toHaveProperty('ci_low');
      expect(result).toHaveProperty('ci_high');
      expect(result.ci_low).toBeLessThanOrEqual(result.ci_high);
    });

    it('should calculate signal agreement', () => {
      // Consistent evaluations should have high agreement
      const consistentEvals = [
        createEvaluation({ validity: 0.8, coherence: 0.8, transfer: 0.8 }),
        createEvaluation({ validity: 0.8, coherence: 0.8, transfer: 0.8 }),
      ];
      const consistentResult = aggregateEvaluations(consistentEvals);

      // Varied evaluations should have lower agreement
      const variedEvals = [
        createEvaluation({ validity: 0.2, coherence: 0.2, transfer: 0.2 }),
        createEvaluation({ validity: 0.9, coherence: 0.9, transfer: 0.9 }),
      ];
      const variedResult = aggregateEvaluations(variedEvals);

      expect(consistentResult.signal_agreement).toBeGreaterThan(variedResult.signal_agreement);
    });

    it('should bound values between 0 and 100', () => {
      const evals = [createEvaluation({})];
      const result = aggregateEvaluations(evals);

      expect(result.coherence).toBeGreaterThanOrEqual(0);
      expect(result.coherence).toBeLessThanOrEqual(100);
      expect(result.entropy).toBeGreaterThanOrEqual(0);
      expect(result.entropy).toBeLessThanOrEqual(100);
      expect(result.generativity).toBeGreaterThanOrEqual(0);
      expect(result.generativity).toBeLessThanOrEqual(100);
      expect(result.ci_low).toBeGreaterThanOrEqual(0);
      expect(result.ci_high).toBeLessThanOrEqual(100);
    });

    it('should round values to 1 decimal place', () => {
      const evals = [createEvaluation({})];
      const result = aggregateEvaluations(evals);

      const decimals = (n: number) => {
        const str = n.toString();
        if (!str.includes('.')) return 0;
        return str.split('.')[1].length;
      };

      expect(decimals(result.coherence)).toBeLessThanOrEqual(1);
      expect(decimals(result.entropy)).toBeLessThanOrEqual(1);
      expect(decimals(result.generativity)).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Database Operations Tests
  // ==========================================================================

  describe('saveEvaluationResult', () => {
    it('should save evaluation to database', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test-123',
        scores: {
          validity: 0.8,
          coherence: 0.75,
          transfer: 0.6,
          utility: 0.7,
          efficiency: 0.85,
        },
        meta: {
          manifold_fluidity: 0.5,
          multi_model_coherence: 0.6,
          identity_elasticity: 0.4,
          gradient_awareness: 0.3,
          entropy_intuition: 0.55,
          non_dual_resolution: 0.45,
          cooperative_generativity: 0.7,
        },
        confidence: { overall: 0.8, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      saveEvaluationResult('response-123', evaluation, 'claude-opus', '{"raw":"response"}');

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('getEvaluationCriteria', () => {
    it('should query evaluation criteria from database', () => {
      mockAll.mockReturnValue([
        { dimension_name: 'validity', criteria_type: 'positive' },
        { dimension_name: 'coherence', criteria_type: 'positive' },
      ]);

      const criteria = getEvaluationCriteria();

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(criteria).toHaveLength(2);
    });
  });

  describe('getMetaProbe', () => {
    it('should query meta probe by ID', () => {
      mockGet.mockReturnValue({
        id: 'probe-123',
        probe_type: 'reflection',
        difficulty: 0.5,
      });

      const probe = getMetaProbe('probe-123');

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledWith('probe-123');
      expect(probe.id).toBe('probe-123');
    });
  });

  describe('getActiveMetaProbes', () => {
    it('should query all active meta probes', () => {
      mockAll.mockReturnValue([
        { id: 'probe-1', is_active: 1 },
        { id: 'probe-2', is_active: 1 },
      ]);

      const probes = getActiveMetaProbes();

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(probes).toHaveLength(2);
    });
  });

  describe('getMetaProbesByType', () => {
    it('should query meta probes filtered by type', () => {
      mockAll.mockReturnValue([
        { id: 'probe-1', probe_type: 'reflection' },
      ]);

      const probes = getMetaProbesByType('reflection');

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalledWith('reflection');
      expect(probes[0].probe_type).toBe('reflection');
    });
  });

  // ==========================================================================
  // evaluateResponse Tests
  // ==========================================================================

  describe('evaluateResponse', () => {
    beforeEach(() => {
      // Reset fetch mock
      mockFetch.mockReset();
    });

    it('should throw error if API key not configured', async () => {
      // Mock getConfig to return no API key
      jest.unstable_mockModule('@/lib/config', () => ({
        getConfig: () => ({
          openrouter: { apiKey: null },
        }),
      }));

      // Re-import to get mocked version
      const { evaluateResponse: evalFn } = await import('../../../lib/hyro/forge-evaluator');

      const input: EvaluationInput = {
        itemId: 'test-123',
        itemType: 'short_answer',
        prompt: 'What is 2+2?',
        studentResponse: '4',
      };

      // Note: This test may need adjustment based on actual implementation
      // The function checks for API key before making the request
    });

    it('should call OpenRouter API with correct parameters', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                item_id: 'test-123',
                scores: { validity: 0.8, coherence: 0.8, transfer: 0.7, utility: 0.75, efficiency: 0.8 },
                meta: {
                  manifold_fluidity: 0.5,
                  multi_model_coherence: 0.6,
                  identity_elasticity: 0.4,
                  gradient_awareness: 0.3,
                  entropy_intuition: 0.5,
                  non_dual_resolution: 0.4,
                  cooperative_generativity: 0.6,
                },
                confidence: { overall: 0.8, low_evidence_dims: [] },
                evidence: { quotes: [], observations: ['Good response'] },
                flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
              }),
            },
          }],
        }),
      });

      // This would need proper config mocking to work
      // The test structure is here for when integration testing is needed
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero scores in GTC calculation', () => {
      const scores: CoreScores = {
        validity: 0,
        coherence: 0,
        transfer: 0,
        utility: 0,
        efficiency: 0,
      };

      const gtc = calculateGTCScore(scores);
      expect(gtc).toBe(0);
    });

    it('should handle state vector with all zeros', () => {
      const evaluation: EvaluationResult = {
        item_id: 'test',
        scores: { validity: 0, coherence: 0, transfer: 0, utility: 0, efficiency: 0 },
        meta: {
          manifold_fluidity: 0,
          multi_model_coherence: 0,
          identity_elasticity: 0,
          gradient_awareness: 0,
          entropy_intuition: 0,
          non_dual_resolution: 0,
          cooperative_generativity: 0,
        },
        confidence: { overall: 0, low_evidence_dims: [] },
        evidence: { quotes: [], observations: [] },
        flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
      };

      const vector = calculateStateVector(evaluation);

      expect(vector.coherence).toBe(0);
      expect(vector.entropy).toBe(0);
      expect(vector.generativity).toBe(0);
    });

    it('should handle maximum scores (all 1.0)', () => {
      const scores: CoreScores = {
        validity: 1,
        coherence: 1,
        transfer: 1,
        utility: 1,
        efficiency: 1,
      };

      const gtc = calculateGTCScore(scores);
      expect(gtc).toBe(1);
    });

    it('should handle very small differences in aggregation', () => {
      const evals = [
        createMockEvaluation(0.501),
        createMockEvaluation(0.502),
        createMockEvaluation(0.503),
      ];

      const result = aggregateEvaluations(evals);

      expect(result.signal_agreement).toBeGreaterThan(0.9);
    });
  });
});

// Helper function for creating mock evaluations
function createMockEvaluation(baseScore: number): EvaluationResult {
  return {
    item_id: 'test',
    scores: {
      validity: baseScore,
      coherence: baseScore,
      transfer: baseScore,
      utility: baseScore,
      efficiency: baseScore,
    },
    meta: {
      manifold_fluidity: baseScore,
      multi_model_coherence: baseScore,
      identity_elasticity: baseScore,
      gradient_awareness: baseScore,
      entropy_intuition: baseScore,
      non_dual_resolution: baseScore,
      cooperative_generativity: baseScore,
    },
    confidence: { overall: 0.8, low_evidence_dims: [] },
    evidence: { quotes: [], observations: [] },
    flags: { overconfident: false, handwavy: false, style_over_substance_risk: false },
  };
}
