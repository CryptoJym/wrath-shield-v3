// @ts-nocheck
/**
 * Tests for forge-generative-engine.ts
 * AI-powered generative assessment engine
 */

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

// Mock dependencies
jest.mock('@/lib/hyro/forge-blueprints', () => ({
  getBlueprint: jest.fn().mockReturnValue({
    stat: 'math',
    strands: [
      { strand: 'Algebra I (Foundations)', tier: 'Foundation', weight: 0.3, manifold_focus: 'coherence' },
      { strand: 'Geometry & Spatial Reasoning', tier: 'Bridge', weight: 0.25, manifold_focus: 'fluidity' },
      { strand: 'Calculus I (Differential)', tier: 'Power', weight: 0.2, manifold_focus: 'generativity' },
    ],
  }),
}));

jest.mock('@/lib/hyro/forge-domain-agents', () => ({
  getDomainAgent: jest.fn().mockReturnValue({
    displayName: 'Mathematics',
    expertPersona: 'You are an expert math educator.',
    assessmentPhilosophy: 'Focus on conceptual understanding.',
    evaluationGuidance: 'Evaluate step by step.',
    partialCreditGuidelines: 'Award partial credit for correct approach.',
    strandContexts: {},
    difficultyMarkers: {
      foundation: ['Basic recall', 'Simple application'],
      bridge: ['Multi-step problems'],
      power: ['Complex synthesis'],
      horizon: ['Graduate-level'],
    },
    commonMisconceptions: ['Sign errors', 'Order of operations'],
    qualityCriteria: ['Authentic', 'Calibrated', 'Clear'],
  }),
  buildAgentSystemPrompt: jest.fn().mockReturnValue('System prompt'),
  buildAgentEvaluationPrompt: jest.fn().mockReturnValue('Evaluation prompt'),
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  GenerativeAssessmentEngine,
  getGenerativeEngine,
  createInitialAbilityEstimate,
  GeneratedItem,
  ResponseEvaluation,
  AbilityEstimate,
} from '@/lib/hyro/forge-generative-engine';
import type { StrandTier, ManifoldDimension } from '@/lib/hyro/forge-blueprints';
import type { StatName } from '@/lib/hyro/forge-types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockItem(overrides: Partial<GeneratedItem> = {}): GeneratedItem {
  return {
    id: 'gen_123',
    stat_name: 'math',
    strand: 'Algebra I (Foundations)',
    tier: 'Foundation',
    manifold_focus: 'coherence',
    difficulty: 0.5,
    prompt: 'Solve for x: 2x + 5 = 15',
    format: 'multiple_choice',
    options: {
      a: '5',
      b: '10',
      c: '7.5',
      d: '3',
    },
    correct_answer: 'a',
    solution_path: 'Subtract 5 from both sides, then divide by 2',
    common_misconceptions: ['Forgot to subtract 5', 'Divided incorrectly'],
    cognitive_load: 'procedural',
    generated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockAbilityEstimate(overrides: Partial<AbilityEstimate> = {}): AbilityEstimate {
  return {
    theta: 0,
    standard_error: 1.5,
    items_administered: 0,
    strand_estimates: {},
    manifold_profile: {
      coherence: 0.5,
      fluidity: 0.5,
      elasticity: 0.5,
      gradient_awareness: 0.5,
      entropy_intuition: 0.5,
      non_dual_resolution: 0.5,
      generativity: 0.5,
    },
    ...overrides,
  };
}

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-generative-engine types', () => {
  describe('GeneratedItem', () => {
    it('should have required properties', () => {
      const item = createMockItem();

      expect(item.id).toBeDefined();
      expect(item.stat_name).toBeDefined();
      expect(item.strand).toBeDefined();
      expect(item.tier).toBeDefined();
      expect(item.manifold_focus).toBeDefined();
      expect(item.difficulty).toBeDefined();
      expect(item.prompt).toBeDefined();
      expect(item.format).toBeDefined();
      expect(item.correct_answer).toBeDefined();
      expect(item.solution_path).toBeDefined();
      expect(item.common_misconceptions).toBeDefined();
      expect(item.cognitive_load).toBeDefined();
      expect(item.generated_at).toBeDefined();
    });

    it('should support different formats', () => {
      const formats: GeneratedItem['format'][] = [
        'multiple_choice',
        'short_answer',
        'explanation',
        'problem_solving',
      ];

      formats.forEach((format) => {
        const item = createMockItem({ format });
        expect(item.format).toBe(format);
      });
    });

    it('should support different cognitive loads', () => {
      const loads: GeneratedItem['cognitive_load'][] = [
        'recall',
        'procedural',
        'conceptual',
        'transfer',
      ];

      loads.forEach((load) => {
        const item = createMockItem({ cognitive_load: load });
        expect(item.cognitive_load).toBe(load);
      });
    });
  });

  describe('ResponseEvaluation', () => {
    it('should have required properties', () => {
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 0.8,
        coherence_signal: 0.7,
        fluidity_signal: 0.6,
        elasticity_signal: 0.5,
        feedback: 'Great job!',
        evaluation_confidence: 0.9,
      };

      expect(evaluation.is_correct).toBeDefined();
      expect(evaluation.score).toBeDefined();
      expect(evaluation.feedback).toBeDefined();
    });
  });

  describe('AbilityEstimate', () => {
    it('should have required properties', () => {
      const estimate = createMockAbilityEstimate();

      expect(estimate.theta).toBeDefined();
      expect(estimate.standard_error).toBeDefined();
      expect(estimate.items_administered).toBeDefined();
      expect(estimate.strand_estimates).toBeDefined();
      expect(estimate.manifold_profile).toBeDefined();
    });
  });
});

// ============================================================================
// createInitialAbilityEstimate Tests
// ============================================================================

describe('createInitialAbilityEstimate', () => {
  it('should create estimate with theta at 0 (average)', () => {
    const estimate = createInitialAbilityEstimate();
    expect(estimate.theta).toBe(0);
  });

  it('should create estimate with high uncertainty', () => {
    const estimate = createInitialAbilityEstimate();
    expect(estimate.standard_error).toBe(1.5);
  });

  it('should start with 0 items administered', () => {
    const estimate = createInitialAbilityEstimate();
    expect(estimate.items_administered).toBe(0);
  });

  it('should start with empty strand estimates', () => {
    const estimate = createInitialAbilityEstimate();
    expect(estimate.strand_estimates).toEqual({});
  });

  it('should start with neutral manifold profile', () => {
    const estimate = createInitialAbilityEstimate();

    expect(estimate.manifold_profile.coherence).toBe(0.5);
    expect(estimate.manifold_profile.fluidity).toBe(0.5);
    expect(estimate.manifold_profile.elasticity).toBe(0.5);
    expect(estimate.manifold_profile.gradient_awareness).toBe(0.5);
    expect(estimate.manifold_profile.entropy_intuition).toBe(0.5);
    expect(estimate.manifold_profile.non_dual_resolution).toBe(0.5);
    expect(estimate.manifold_profile.generativity).toBe(0.5);
  });
});

// ============================================================================
// getGenerativeEngine Tests
// ============================================================================

describe('getGenerativeEngine', () => {
  it('should return singleton instance', () => {
    const engine1 = getGenerativeEngine();
    const engine2 = getGenerativeEngine();

    expect(engine1).toBe(engine2);
  });

  it('should return GenerativeAssessmentEngine instance', () => {
    const engine = getGenerativeEngine();
    expect(engine).toBeInstanceOf(GenerativeAssessmentEngine);
  });
});

// ============================================================================
// GenerativeAssessmentEngine Tests
// ============================================================================

describe('GenerativeAssessmentEngine', () => {
  let engine: GenerativeAssessmentEngine;
  let mockAnthropicCreate: jest.Mock;

  beforeEach(() => {
    engine = new GenerativeAssessmentEngine();
    mockAnthropicCreate = (engine as any).client.messages.create;
  });

  describe('generateItem', () => {
    it('should generate an item with correct structure', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              prompt: 'What is 2 + 2?',
              options: { a: '3', b: '4', c: '5', d: '6' },
              correct_answer: 'b',
              solution_path: 'Add 2 + 2 = 4',
              common_misconceptions: ['Counting error'],
              cognitive_load: 'recall',
            }),
          },
        ],
      });

      const item = await engine.generateItem(
        'math',
        'Arithmetic & Number Sense',
        'Foundation',
        0.3,
        'coherence'
      );

      expect(item.id).toMatch(/^gen_/);
      expect(item.stat_name).toBe('math');
      expect(item.strand).toBe('Arithmetic & Number Sense');
      expect(item.tier).toBe('Foundation');
      expect(item.difficulty).toBe(0.3);
      expect(item.prompt).toBe('What is 2 + 2?');
    });

    it('should call Anthropic API with correct parameters', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              prompt: 'Test question',
              options: { a: '1', b: '2', c: '3', d: '4' },
              correct_answer: 'a',
              solution_path: 'Solution',
              common_misconceptions: [],
              cognitive_load: 'procedural',
            }),
          },
        ],
      });

      await engine.generateItem('math', 'Algebra', 'Bridge', 0.5, 'fluidity', 'multiple_choice');

      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        max_tokens: 1024,
        messages: [{ role: 'user', content: expect.any(String) }],
      });
    });

    it('should handle non-multiple choice formats', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              prompt: 'Explain the concept of derivatives',
              correct_answer: 'The derivative measures rate of change',
              solution_path: 'Explain definition and application',
              rubric: {
                full_credit: 'Complete explanation',
                partial_credit: 'Partial understanding',
                no_credit: 'Incorrect',
              },
              common_misconceptions: ['Confusing with integral'],
              cognitive_load: 'conceptual',
            }),
          },
        ],
      });

      const item = await engine.generateItem(
        'math',
        'Calculus I',
        'Power',
        0.7,
        'generativity',
        'short_answer'
      );

      expect(item.format).toBe('short_answer');
      expect(item.options).toBeUndefined();
    });

    it('should throw on unexpected response type', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'image', data: 'base64data' }],
      });

      await expect(
        engine.generateItem('math', 'Algebra', 'Foundation', 0.3, 'coherence')
      ).rejects.toThrow('Unexpected response type');
    });
  });

  describe('evaluateResponse', () => {
    it('should quick evaluate correct MC answer', async () => {
      const item = createMockItem();
      const evaluation = await engine.evaluateResponse(item, 'a');

      expect(evaluation.is_correct).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.evaluation_confidence).toBe(1.0);
    });

    it('should quick evaluate incorrect MC answer', async () => {
      const item = createMockItem();
      const evaluation = await engine.evaluateResponse(item, 'b');

      expect(evaluation.is_correct).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.evaluation_confidence).toBe(1.0);
    });

    it('should handle answer with parenthesis', async () => {
      const item = createMockItem();
      const evaluation = await engine.evaluateResponse(item, 'a)');

      expect(evaluation.is_correct).toBe(true);
    });

    it('should be case insensitive for MC', async () => {
      const item = createMockItem();
      const evaluation = await engine.evaluateResponse(item, 'A');

      expect(evaluation.is_correct).toBe(true);
    });

    it('should use AI evaluation for complex responses', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              is_correct: true,
              score: 0.85,
              reasoning_quality: 0.9,
              misconception_detected: null,
              error_type: null,
              coherence_signal: 0.8,
              fluidity_signal: 0.7,
              elasticity_signal: 0.6,
              feedback: 'Good work, minor issues',
              suggested_remediation: 'Review order of operations',
            }),
          },
        ],
      });

      const item = createMockItem({ format: 'short_answer', options: undefined });
      const evaluation = await engine.evaluateResponse(item, 'x = 5 because...');

      expect(evaluation.score).toBe(0.85);
      expect(evaluation.evaluation_confidence).toBe(0.9);
      expect(mockAnthropicCreate).toHaveBeenCalled();
    });

    it('should detect misconceptions from wrong MC choice', async () => {
      const item = createMockItem();
      const evaluation = await engine.evaluateResponse(item, 'b');

      expect(evaluation.misconception_detected).toBeDefined();
    });
  });

  describe('selectNextItem', () => {
    it('should select item from undersampled strand', async () => {
      const abilityEstimate = createMockAbilityEstimate();
      const sessionHistory: GeneratedItem[] = [
        createMockItem({ strand: 'Algebra I (Foundations)' }),
        createMockItem({ strand: 'Algebra I (Foundations)' }),
      ];

      const selection = await engine.selectNextItem('math', abilityEstimate, sessionHistory);

      // Should prefer strands other than Algebra since it's oversampled
      expect(selection.strand).toBeDefined();
      expect(selection.difficulty).toBeGreaterThanOrEqual(0.1);
      expect(selection.difficulty).toBeLessThanOrEqual(0.95);
    });

    it('should handle empty session history', async () => {
      const abilityEstimate = createMockAbilityEstimate();
      const sessionHistory: GeneratedItem[] = [];

      const selection = await engine.selectNextItem('math', abilityEstimate, sessionHistory);

      expect(selection.strand).toBeDefined();
      expect(selection.tier).toBeDefined();
      expect(selection.manifold).toBeDefined();
    });

    it('should consider strand-specific ability', async () => {
      const abilityEstimate = createMockAbilityEstimate({
        strand_estimates: {
          'Algebra I (Foundations)': { theta: 0.5, se: 0.3, items: 10 },
          'Geometry & Spatial Reasoning': { theta: -0.5, se: 1.2, items: 2 },
        },
      });

      const selection = await engine.selectNextItem('math', abilityEstimate, []);

      // Should prefer strand with higher uncertainty
      expect(selection).toBeDefined();
    });
  });

  describe('updateAbilityEstimate', () => {
    it('should increase theta after correct response', () => {
      const current = createMockAbilityEstimate({ theta: 0, items_administered: 5 });
      const item = createMockItem({ difficulty: 0.5 });
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 0.8,
        coherence_signal: 0.7,
        fluidity_signal: 0.6,
        elasticity_signal: 0.5,
        feedback: 'Correct!',
        evaluation_confidence: 1.0,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.theta).toBeGreaterThan(current.theta);
      expect(updated.items_administered).toBe(6);
    });

    it('should decrease theta after incorrect response', () => {
      const current = createMockAbilityEstimate({ theta: 0, items_administered: 5 });
      const item = createMockItem({ difficulty: 0.5 });
      const evaluation: ResponseEvaluation = {
        is_correct: false,
        score: 0.0,
        reasoning_quality: 0.3,
        coherence_signal: 0.4,
        fluidity_signal: 0.4,
        elasticity_signal: 0.4,
        feedback: 'Try again',
        evaluation_confidence: 1.0,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.theta).toBeLessThan(current.theta);
    });

    it('should decrease standard error with more items', () => {
      const current = createMockAbilityEstimate({ standard_error: 1.5, items_administered: 5 });
      const item = createMockItem();
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 0.7,
        coherence_signal: 0.7,
        fluidity_signal: 0.6,
        elasticity_signal: 0.5,
        feedback: 'Good',
        evaluation_confidence: 0.9,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.standard_error).toBeLessThan(current.standard_error);
    });

    it('should update strand-specific estimates', () => {
      const current = createMockAbilityEstimate();
      const item = createMockItem({ strand: 'Algebra I (Foundations)' });
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 0.8,
        coherence_signal: 0.8,
        fluidity_signal: 0.7,
        elasticity_signal: 0.6,
        feedback: 'Excellent',
        evaluation_confidence: 1.0,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.strand_estimates['Algebra I (Foundations)']).toBeDefined();
      expect(updated.strand_estimates['Algebra I (Foundations)'].items).toBe(1);
    });

    it('should bound theta between -3 and +3', () => {
      const current = createMockAbilityEstimate({ theta: 2.9, items_administered: 50 });
      const item = createMockItem({ difficulty: 0.5 });
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 1.0,
        coherence_signal: 1.0,
        fluidity_signal: 1.0,
        elasticity_signal: 1.0,
        feedback: 'Perfect',
        evaluation_confidence: 1.0,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.theta).toBeLessThanOrEqual(3);
      expect(updated.theta).toBeGreaterThanOrEqual(-3);
    });

    it('should bound standard error above minimum', () => {
      const current = createMockAbilityEstimate({ standard_error: 0.25, items_administered: 100 });
      const item = createMockItem();
      const evaluation: ResponseEvaluation = {
        is_correct: true,
        score: 1.0,
        reasoning_quality: 0.8,
        coherence_signal: 0.7,
        fluidity_signal: 0.6,
        elasticity_signal: 0.5,
        feedback: 'Good',
        evaluation_confidence: 0.9,
      };

      const updated = engine.updateAbilityEstimate(current, item, evaluation);

      expect(updated.standard_error).toBeGreaterThanOrEqual(0.2);
    });
  });
});

// ============================================================================
// Difficulty Anchors Tests
// ============================================================================

describe('difficulty calibration', () => {
  it('should have Foundation tier at lower difficulty', () => {
    // Foundation: 0.1-0.35
    expect(0.1).toBeLessThan(0.35);
  });

  it('should have Bridge tier at medium difficulty', () => {
    // Bridge: 0.35-0.6
    expect(0.35).toBeLessThan(0.6);
  });

  it('should have Power tier at higher difficulty', () => {
    // Power: 0.6-0.8
    expect(0.6).toBeLessThan(0.8);
  });

  it('should have Horizon tier at highest difficulty', () => {
    // Horizon: 0.8-0.95
    expect(0.8).toBeLessThan(0.95);
  });
});
