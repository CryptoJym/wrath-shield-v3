// @ts-nocheck
/**
 * Tests for HYRO FORGE: Assessment Framework
 *
 * Tests the standards-based, manifold-aware assessment engine including
 * session management, item selection, scoring, and completion.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database
const mockDb = {
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
  exec: jest.fn(),
};

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(),
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

// Mock forge-learner-state
jest.mock('../../../lib/hyro/forge-learner-state', () => ({
  distanceCEG: jest.fn(() => 10),
  findNearestAttractor: jest.fn(() => ({ name: 'flow' })),
}));

// Mock forge-zpd-engine
jest.mock('../../../lib/hyro/forge-zpd-engine', () => ({
  getZPDState: jest.fn(() => ({
    stat_name: 'math',
    current_level: 60,
    optimal_difficulty: 65,
    zpd_lower: 55,
    zpd_upper: 75,
    trend: 'improving',
    adjustment_needed: 'none',
    scaffolding_recommended: false,
  })),
}));

// Mock forge-proficiency
jest.mock('../../../lib/hyro/forge-proficiency', () => ({
  recordSkillEvidence: jest.fn(),
  getSkillProficiency: jest.fn(() => ({ level: 60 })),
}));

// Mock education-store
jest.mock('../../../lib/hyro/education-store', () => ({
  getStandard: jest.fn(() => ({
    id: '6.RP.A.1',
    description: 'Understand ratio concepts',
    category: 'Math',
  })),
  getStandardMastery: jest.fn(() => null),
  getAllStandards: jest.fn(() => [
    { id: '6.RP.A.1', category: 'Math', description: 'Ratios' },
    { id: '6.EE.A.1', category: 'Math', description: 'Expressions' },
  ]),
}));

// Mock forge-types
jest.mock('../../../lib/hyro/forge-types', () => ({
  STAT_NAMES: ['math', 'reading', 'writing', 'science'],
}));

// Import after mocks
import {
  initializeAssessmentTables,
  createAssessmentSession,
  getAssessmentSession,
  selectAssessmentItems,
  calculateManifoldFit,
  scoreAssessmentResponse,
  completeAssessment,
  generateDiagnosticAssessment,
  getRubric,
  getNextItem,
  loadItemBank,
  getItemsForStandard,
  convertToAssessmentItem,
  identifyAttractorField,
  selectItemsWithAttractorAwareness,
  getAssessmentHistory,
} from '../../../lib/hyro/forge-assessment';
import type {
  AssessmentType,
  ItemType,
  AssessmentItem,
  AssessmentRubric,
  AssessmentSession,
  AssessmentResponse,
  AssessmentResults,
} from '../../../lib/hyro/forge-assessment';

describe('HYRO FORGE: Assessment Framework', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define AssessmentType values', () => {
      const types: AssessmentType[] = [
        'diagnostic',
        'formative',
        'summative',
        'transfer',
        'metacognitive',
      ];
      expect(types).toHaveLength(5);
    });

    it('should define ItemType values', () => {
      const types: ItemType[] = [
        'multiple_choice',
        'constructed_response',
        'performance_task',
      ];
      expect(types).toHaveLength(3);
    });

    it('should define AssessmentItem interface', () => {
      const item: AssessmentItem = {
        id: 'item-123',
        standard_ids: ['6.RP.A.1'],
        item_type: 'multiple_choice',
        content: 'What is 2:3 as a ratio?',
        difficulty: 50,
        cognitive_level: 2,
        c_demand: 60,
        e_tolerance: 40,
        g_requirement: 50,
      };

      expect(item.id).toBe('item-123');
      expect(item.cognitive_level).toBe(2);
    });

    it('should define AssessmentRubric interface', () => {
      const rubric: AssessmentRubric = {
        criteria: [
          {
            name: 'Accuracy',
            weight: 0.7,
            levels: [
              { score: 4, description: 'Fully accurate' },
              { score: 1, description: 'Not accurate' },
            ],
          },
        ],
      };

      expect(rubric.criteria).toHaveLength(1);
      expect(rubric.criteria[0].weight).toBe(0.7);
    });

    it('should define AssessmentSession interface', () => {
      const session: AssessmentSession = {
        id: 'session-123',
        student_id: 'student-1',
        assessment_type: 'formative',
        target_standards: ['6.RP.A.1'],
        items: [],
        responses: [],
        state_vector_start: { coherence: 50, entropy: 50, generativity: 50 },
        started_at: Date.now(),
      };

      expect(session.assessment_type).toBe('formative');
    });

    it('should define AssessmentResponse interface', () => {
      const response: AssessmentResponse = {
        item_id: 'item-123',
        student_response: 'My answer is...',
        score: 85,
        rubric_scores: { Accuracy: 4, Completeness: 3 },
        time_spent_seconds: 120,
        scaffolding_used: [],
        is_correct: true,
      };

      expect(response.score).toBe(85);
      expect(response.is_correct).toBe(true);
    });

    it('should define AssessmentResults interface', () => {
      const results: AssessmentResults = {
        session_id: 'session-123',
        total_score: 350,
        max_score: 400,
        percentage: 87.5,
        standards_assessed: [
          {
            standard_id: '6.RP.A.1',
            items_count: 4,
            correct_count: 3,
            mastery_estimate: 75,
            status: 'proficient',
          },
        ],
        state_vector_change: {
          delta_C: 5,
          delta_E: -3,
          delta_G: 2,
        },
        recommendations: ['Good work!'],
        next_steps: ['Continue to next unit'],
      };

      expect(results.percentage).toBe(87.5);
      expect(results.standards_assessed[0].status).toBe('proficient');
    });
  });

  // ==========================================================================
  // Database Initialization Tests
  // ==========================================================================

  describe('initializeAssessmentTables', () => {
    it('should create assessment_items table', () => {
      initializeAssessmentTables();

      expect(mockDb.exec).toHaveBeenCalled();
      const calls = mockDb.exec.mock.calls.flat().join('');
      expect(calls).toContain('hyro_assessment_items');
    });

    it('should create assessment_sessions table', () => {
      initializeAssessmentTables();

      const calls = mockDb.exec.mock.calls.flat().join('');
      expect(calls).toContain('hyro_assessment_sessions');
    });

    it('should create indexes', () => {
      initializeAssessmentTables();

      const calls = mockDb.exec.mock.calls.flat().join('');
      expect(calls).toContain('CREATE INDEX');
    });
  });

  // ==========================================================================
  // Session Management Tests
  // ==========================================================================

  describe('createAssessmentSession', () => {
    it('should create a new session', () => {
      const mockRun = jest.fn();
      mockDb.prepare.mockReturnValue({
        run: mockRun,
        get: jest.fn(() => null),
      });

      const session = createAssessmentSession(
        'student-1',
        'formative',
        ['6.RP.A.1']
      );

      expect(session.id).toBe('mock-uuid-12345');
      expect(session.student_id).toBe('student-1');
      expect(session.assessment_type).toBe('formative');
    });

    it('should set initial state vector', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
      });

      const session = createAssessmentSession(
        'student-1',
        'diagnostic',
        ['6.RP.A.1']
      );

      expect(session.state_vector_start).toBeDefined();
      expect(session.state_vector_start.coherence).toBeDefined();
    });

    it('should initialize empty items and responses', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
      });

      const session = createAssessmentSession(
        'student-1',
        'summative',
        ['6.RP.A.1']
      );

      expect(session.items).toEqual([]);
      expect(session.responses).toEqual([]);
    });
  });

  describe('getAssessmentSession', () => {
    it('should return null for non-existent session', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => null),
      });

      const session = getAssessmentSession('nonexistent');

      expect(session).toBeNull();
    });

    it('should parse JSON fields from database', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          id: 'session-1',
          student_id: 'student-1',
          assessment_type: 'formative',
          target_standards: '["6.RP.A.1"]',
          items: '[]',
          responses: '[]',
          state_vector_start: '{"coherence": 50, "entropy": 50, "generativity": 50}',
          started_at: 1705330800,
        })),
      });

      const session = getAssessmentSession('session-1');

      expect(session).not.toBeNull();
      expect(session?.target_standards).toEqual(['6.RP.A.1']);
      expect(session?.state_vector_start.coherence).toBe(50);
    });
  });

  // ==========================================================================
  // Item Selection Tests
  // ==========================================================================

  describe('selectAssessmentItems', () => {
    it('should return array of items', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
        get: jest.fn(() => null),
      });

      const items = selectAssessmentItems('student-1', '6.RP.A.1', 5);

      expect(Array.isArray(items)).toBe(true);
    });

    it('should generate default items when none in database', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
        get: jest.fn(() => null),
      });

      const items = selectAssessmentItems('student-1', '6.RP.A.1', 5);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should respect count parameter', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => []),
        get: jest.fn(() => null),
      });

      const items = selectAssessmentItems('student-1', '6.RP.A.1', 3);

      expect(items.length).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateManifoldFit', () => {
    it('should return neutral score for items without manifold properties', () => {
      const item: AssessmentItem = {
        id: 'item-1',
        standard_ids: ['6.RP.A.1'],
        item_type: 'multiple_choice',
        content: 'Question',
        difficulty: 50,
        cognitive_level: 2,
      };

      const currentState = { coherence: 50, entropy: 50, generativity: 50 };
      const targetState = { coherence: 70, entropy: 40, generativity: 60 };

      const fit = calculateManifoldFit(item, currentState, targetState);

      expect(fit).toBe(50);
    });

    it('should calculate fit based on state distance', () => {
      const item: AssessmentItem = {
        id: 'item-1',
        standard_ids: ['6.RP.A.1'],
        item_type: 'multiple_choice',
        content: 'Question',
        difficulty: 50,
        cognitive_level: 2,
        c_demand: 60,
        e_tolerance: 40,
        g_requirement: 55,
      };

      const currentState = { coherence: 60, entropy: 40, generativity: 55 };
      const targetState = { coherence: 70, entropy: 35, generativity: 60 };

      const fit = calculateManifoldFit(item, currentState, targetState);

      // Perfect match to current state should score high
      expect(fit).toBeGreaterThan(50);
    });

    it('should penalize large state mismatches', () => {
      const item: AssessmentItem = {
        id: 'item-1',
        standard_ids: ['6.RP.A.1'],
        item_type: 'multiple_choice',
        content: 'Question',
        difficulty: 50,
        cognitive_level: 2,
        c_demand: 90,
        e_tolerance: 10,
        g_requirement: 90,
      };

      const currentState = { coherence: 30, entropy: 80, generativity: 20 };
      const targetState = { coherence: 70, entropy: 35, generativity: 60 };

      const fit = calculateManifoldFit(item, currentState, targetState);

      expect(fit).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // Rubric Tests
  // ==========================================================================

  describe('getRubric', () => {
    it('should return DOK 1 rubric', () => {
      const rubric = getRubric('6.RP.A.1', 1);

      expect(rubric.criteria).toBeDefined();
      expect(rubric.criteria.some(c => c.name === 'Accuracy')).toBe(true);
    });

    it('should return DOK 2 rubric', () => {
      const rubric = getRubric('6.RP.A.1', 2);

      expect(rubric.criteria.some(c => c.name === 'Understanding')).toBe(true);
      expect(rubric.criteria.some(c => c.name === 'Application')).toBe(true);
    });

    it('should return DOK 3 rubric', () => {
      const rubric = getRubric('6.RP.A.1', 3);

      expect(rubric.criteria.some(c => c.name === 'Reasoning')).toBe(true);
      expect(rubric.criteria.some(c => c.name === 'Evidence')).toBe(true);
      expect(rubric.criteria.some(c => c.name === 'Analysis')).toBe(true);
    });

    it('should return DOK 4 rubric', () => {
      const rubric = getRubric('6.RP.A.1', 4);

      expect(rubric.criteria.some(c => c.name === 'Creativity')).toBe(true);
      expect(rubric.criteria.some(c => c.name === 'Synthesis')).toBe(true);
      expect(rubric.criteria.some(c => c.name === 'Transfer')).toBe(true);
    });

    it('should clamp DOK to valid range', () => {
      const rubricLow = getRubric('6.RP.A.1', 0);
      const rubricHigh = getRubric('6.RP.A.1', 10);

      expect(rubricLow.criteria).toBeDefined();
      expect(rubricHigh.criteria).toBeDefined();
    });

    it('should have weights that sum to 1', () => {
      for (let dok = 1; dok <= 4; dok++) {
        const rubric = getRubric('6.RP.A.1', dok);
        const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
        expect(totalWeight).toBeCloseTo(1.0, 5);
      }
    });
  });

  // ==========================================================================
  // Scoring Tests
  // ==========================================================================

  describe('scoreAssessmentResponse', () => {
    beforeEach(() => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          id: 'session-1',
          student_id: 'student-1',
          assessment_type: 'formative',
          target_standards: '["6.RP.A.1"]',
          items: JSON.stringify([{
            id: 'item-1',
            standard_ids: ['6.RP.A.1'],
            item_type: 'constructed_response',
            content: 'Question',
            difficulty: 50,
            cognitive_level: 2,
            rubric: { criteria: [{ name: 'Accuracy', weight: 1.0, levels: [] }] },
          }]),
          responses: '[]',
          state_vector_start: '{"coherence": 50, "entropy": 50, "generativity": 50}',
          started_at: 1705330800,
        })),
        run: jest.fn(),
      });
    });

    it('should score response and return result', () => {
      const result = scoreAssessmentResponse(
        'session-1',
        'item-1',
        'This is my detailed answer with multiple sentences explaining the concept.',
        60,
        []
      );

      expect(result.score).toBeDefined();
      expect(result.feedback).toBeDefined();
    });

    it('should throw for non-existent session', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => null),
      });

      expect(() => scoreAssessmentResponse(
        'nonexistent',
        'item-1',
        'Answer',
        60,
        []
      )).toThrow('Session not found');
    });

    it('should apply scaffolding penalty', () => {
      const resultWithout = scoreAssessmentResponse(
        'session-1',
        'item-1',
        'A very long and detailed answer that spans many words.',
        60,
        []
      );

      // Reset mock to get fresh session
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          id: 'session-1',
          student_id: 'student-1',
          assessment_type: 'formative',
          target_standards: '["6.RP.A.1"]',
          items: JSON.stringify([{
            id: 'item-1',
            standard_ids: ['6.RP.A.1'],
            item_type: 'constructed_response',
            content: 'Question',
            difficulty: 50,
            cognitive_level: 2,
            rubric: { criteria: [{ name: 'Accuracy', weight: 1.0, levels: [] }] },
          }]),
          responses: '[]',
          state_vector_start: '{"coherence": 50, "entropy": 50, "generativity": 50}',
          started_at: 1705330800,
        })),
        run: jest.fn(),
      });

      const resultWith = scoreAssessmentResponse(
        'session-1',
        'item-1',
        'A very long and detailed answer that spans many words.',
        60,
        ['hint1', 'hint2']
      );

      expect(resultWith.score).toBeLessThan(resultWithout.score);
    });
  });

  // ==========================================================================
  // Attractor Field Tests
  // ==========================================================================

  describe('identifyAttractorField', () => {
    it('should identify flow state', () => {
      const flowState = { coherence: 75, entropy: 35, generativity: 70 };
      const field = identifyAttractorField(flowState);

      expect(field.name).toBe('flow');
    });

    it('should identify confusion state', () => {
      const confusionState = { coherence: 35, entropy: 75, generativity: 45 };
      const field = identifyAttractorField(confusionState);

      expect(field.name).toBe('confusion');
    });

    it('should identify boredom state', () => {
      const boredomState = { coherence: 80, entropy: 25, generativity: 30 };
      const field = identifyAttractorField(boredomState);

      expect(field.name).toBe('boredom');
    });

    it('should identify frustration state', () => {
      const frustrationState = { coherence: 30, entropy: 80, generativity: 25 };
      const field = identifyAttractorField(frustrationState);

      expect(field.name).toBe('frustration');
    });

    it('should identify discovery state', () => {
      const discoveryState = { coherence: 55, entropy: 60, generativity: 75 };
      const field = identifyAttractorField(discoveryState);

      expect(field.name).toBe('discovery');
    });
  });

  // ==========================================================================
  // Item Bank Tests
  // ==========================================================================

  describe('loadItemBank', () => {
    it('should return empty array when file not found', () => {
      const items = loadItemBank('math', 'g6');

      expect(items).toEqual([]);
    });

    it('should cache loaded items', () => {
      const items1 = loadItemBank('math', 'g6');
      const items2 = loadItemBank('math', 'g6');

      expect(items1).toBe(items2);
    });
  });

  describe('getItemsForStandard', () => {
    it('should return empty array for invalid standard', () => {
      const items = getItemsForStandard('INVALID.STANDARD');

      expect(items).toEqual([]);
    });
  });

  describe('convertToAssessmentItem', () => {
    it('should convert bank item to assessment item', () => {
      const bankItem = {
        id: 'bank-1',
        standard_id: '6.RP.A.1',
        dok_level: 2,
        question_type: 'multiple_choice',
        question: 'What is a ratio?',
        correct_answer: 'A comparison of two quantities',
        difficulty: 0.5,
        time_estimate_seconds: 60,
        manifold_fit: {
          coherence_delta: 2,
          entropy_delta: -1,
          generativity_delta: 0,
        },
      };

      const item = convertToAssessmentItem(bankItem);

      expect(item.id).toBe('bank-1');
      expect(item.standard_ids).toEqual(['6.RP.A.1']);
      expect(item.difficulty).toBe(50); // 0.5 * 100
      expect(item.cognitive_level).toBe(2);
    });
  });

  // ==========================================================================
  // Assessment History Tests
  // ==========================================================================

  describe('getAssessmentHistory', () => {
    it('should return assessment sessions for student', () => {
      mockDb.prepare.mockReturnValue({
        all: jest.fn(() => [
          {
            id: 'session-1',
            student_id: 'student-1',
            assessment_type: 'formative',
            target_standards: '["6.RP.A.1"]',
            items: '[]',
            responses: '[]',
            state_vector_start: '{"coherence": 50, "entropy": 50, "generativity": 50}',
            started_at: 1705330800,
          },
        ]),
      });

      const history = getAssessmentHistory('student-1');

      expect(history).toHaveLength(1);
      expect(history[0].student_id).toBe('student-1');
    });

    it('should respect limit parameter', () => {
      const mockAll = jest.fn(() => []);
      mockDb.prepare.mockReturnValue({ all: mockAll });

      getAssessmentHistory('student-1', 5);

      expect(mockAll).toHaveBeenCalledWith('student-1', 5);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty target standards', () => {
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        get: jest.fn(() => null),
      });

      const session = createAssessmentSession('student-1', 'diagnostic', []);

      expect(session.target_standards).toEqual([]);
    });

    it('should handle missing rubric in scoring', () => {
      mockDb.prepare.mockReturnValue({
        get: jest.fn(() => ({
          id: 'session-1',
          student_id: 'student-1',
          assessment_type: 'formative',
          target_standards: '["6.RP.A.1"]',
          items: JSON.stringify([{
            id: 'item-1',
            standard_ids: ['6.RP.A.1'],
            item_type: 'multiple_choice',
            content: 'Question',
            difficulty: 50,
            cognitive_level: 1,
            // No rubric
          }]),
          responses: '[]',
          state_vector_start: '{"coherence": 50, "entropy": 50, "generativity": 50}',
          started_at: 1705330800,
        })),
        run: jest.fn(),
      });

      const result = scoreAssessmentResponse(
        'session-1',
        'item-1',
        'A',
        30,
        []
      );

      // Should still return a result
      expect(result.score).toBeDefined();
    });

    it('should handle extreme state vector values', () => {
      const extremeState = { coherence: 100, entropy: 0, generativity: 100 };
      const field = identifyAttractorField(extremeState);

      expect(field).toBeDefined();
      expect(field.name).toBeDefined();
    });
  });
});
