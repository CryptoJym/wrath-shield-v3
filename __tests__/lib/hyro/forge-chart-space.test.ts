// @ts-nocheck
/**
 * Tests for HYRO FORGE: Chart-Space Analytics
 *
 * Tests Pareto-optimal content selection, attractor-field clustering,
 * state transition prediction, and trajectory planning.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database
const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();
const mockDbExec = jest.fn();
const mockPrepare = jest.fn(() => ({
  run: mockDbRun,
  get: mockDbGet,
  all: mockDbAll,
}));

jest.mock('@/lib/db/Database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
    exec: mockDbExec,
  }),
}));

// Mock forge-zpd-engine
const mockGetStateVector = jest.fn();
jest.mock('../../../lib/hyro/forge-zpd-engine', () => ({
  getStateVector: (...args: any[]) => mockGetStateVector(...args),
}));

// Mock forge-proficiency
const mockGetSkillProficiency = jest.fn();
jest.mock('../../../lib/hyro/forge-proficiency', () => ({
  getSkillProficiency: (...args: any[]) => mockGetSkillProficiency(...args),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

// Import after mocks
import {
  calculateContentObjectives,
  getParetoOptimalContent,
  clusterLearningStates,
  detectCurrentAttractor,
  predictStateTransition,
  planOptimalTrajectory,
  getStateHistory,
  getChartSpaceData,
  getChartSpaceDataWithPareto,
  getChartSpaceDataWithTrajectory,
  initializeStateHistoryTable,
  recordStateHistory,
  recordAttractorAssignment,
  recordParetoSelection,
} from '../../../lib/hyro/forge-chart-space';

import type {
  Content,
  ContentWithObjectives,
  ParetoFrontier,
  AttractorField,
  StateVector,
  Intervention,
  TrajectoryPlan,
  ChartSpaceVisualization,
} from '../../../lib/hyro/forge-chart-space';

describe('HYRO FORGE: Chart-Space Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default proficiency mock
    mockGetSkillProficiency.mockReturnValue({
      level: 50,
      evidence_count: 10,
    });

    // Default state vector mock
    mockGetStateVector.mockReturnValue({
      coherence: 60,
      entropy: 40,
      generativity: 55,
      n_items_used: 20,
    });
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define Content interface', () => {
      const content: Content = {
        id: 'content-1',
        title: 'Algebra Basics',
        type: 'lesson',
        difficulty: 50,
        stat_name: 'math',
        estimated_time_minutes: 30,
        metadata: { topic: 'equations' },
      };

      expect(content.id).toBe('content-1');
      expect(content.difficulty).toBe(50);
      expect(content.stat_name).toBe('math');
    });

    it('should define ContentWithObjectives interface', () => {
      const content: ContentWithObjectives = {
        id: 'content-1',
        title: 'Test',
        type: 'lesson',
        difficulty: 50,
        stat_name: 'math',
        estimated_time_minutes: 30,
        learning_gain: 75,
        engagement_score: 80,
        efficiency_score: 60,
        transfer_potential: 70,
      };

      expect(content.learning_gain).toBe(75);
      expect(content.engagement_score).toBe(80);
      expect(content.efficiency_score).toBe(60);
      expect(content.transfer_potential).toBe(70);
    });

    it('should define AttractorType values', () => {
      const types = ['flow', 'confusion', 'boredom', 'frustration', 'discovery'];
      expect(types).toHaveLength(5);
    });

    it('should define Intervention types', () => {
      const intervention: Intervention = {
        type: 'scaffolding',
        content_ids: ['content-1'],
        parameters: { level: 'beginner' },
        description: 'Provide structured support',
      };

      expect(intervention.type).toBe('scaffolding');
      expect(intervention.description).toBe('Provide structured support');
    });
  });

  // ==========================================================================
  // Content Objective Calculation Tests
  // ==========================================================================

  describe('calculateContentObjectives', () => {
    it('should calculate all objective scores', () => {
      const content: Content = {
        id: 'content-1',
        title: 'Math Lesson',
        type: 'lesson',
        difficulty: 65,
        stat_name: 'math',
        estimated_time_minutes: 20,
      };

      const result = calculateContentObjectives(content, 'student-1');

      expect(result).toHaveProperty('learning_gain');
      expect(result).toHaveProperty('engagement_score');
      expect(result).toHaveProperty('efficiency_score');
      expect(result).toHaveProperty('transfer_potential');
      expect(result.id).toBe('content-1');
    });

    it('should calculate higher learning gain for optimal skill gap', () => {
      mockGetSkillProficiency.mockReturnValue({ level: 50, evidence_count: 10 });

      const optimalContent: Content = {
        id: 'optimal',
        title: 'Optimal Difficulty',
        type: 'lesson',
        difficulty: 65, // 15 points above proficiency (optimal gap)
        stat_name: 'math',
        estimated_time_minutes: 20,
      };

      const tooEasyContent: Content = {
        id: 'easy',
        title: 'Too Easy',
        type: 'lesson',
        difficulty: 30,
        stat_name: 'math',
        estimated_time_minutes: 20,
      };

      const optimalResult = calculateContentObjectives(optimalContent, 'student-1');
      const easyResult = calculateContentObjectives(tooEasyContent, 'student-1');

      expect(optimalResult.learning_gain).toBeGreaterThanOrEqual(easyResult.learning_gain);
    });

    it('should include generativity in engagement score', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 60,
        entropy: 40,
        generativity: 90, // High generativity
        n_items_used: 20,
      });

      const content: Content = {
        id: 'content-1',
        title: 'Test',
        type: 'lesson',
        difficulty: 50,
        stat_name: 'math',
        estimated_time_minutes: 20,
      };

      const result = calculateContentObjectives(content, 'student-1');
      expect(result.engagement_score).toBeGreaterThan(0);
    });

    it('should calculate efficiency based on learning gain per time', () => {
      const shortContent: Content = {
        id: 'short',
        title: 'Short',
        type: 'lesson',
        difficulty: 65,
        stat_name: 'math',
        estimated_time_minutes: 10,
      };

      const longContent: Content = {
        id: 'long',
        title: 'Long',
        type: 'lesson',
        difficulty: 65,
        stat_name: 'math',
        estimated_time_minutes: 60,
      };

      const shortResult = calculateContentObjectives(shortContent, 'student-1');
      const longResult = calculateContentObjectives(longContent, 'student-1');

      // Shorter content should be more efficient if same learning gain
      expect(shortResult.efficiency_score).toBeGreaterThanOrEqual(longResult.efficiency_score);
    });

    it('should cap all scores at 100', () => {
      const content: Content = {
        id: 'content-1',
        title: 'Test',
        type: 'lesson',
        difficulty: 65,
        stat_name: 'math',
        estimated_time_minutes: 1, // Very short for high efficiency
      };

      const result = calculateContentObjectives(content, 'student-1');

      expect(result.learning_gain).toBeLessThanOrEqual(100);
      expect(result.engagement_score).toBeLessThanOrEqual(100);
      expect(result.efficiency_score).toBeLessThanOrEqual(100);
      expect(result.transfer_potential).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Pareto-Optimal Content Selection Tests
  // ==========================================================================

  describe('getParetoOptimalContent', () => {
    it('should identify Pareto-optimal content', () => {
      const candidates: Content[] = [
        { id: 'c1', title: 'C1', type: 'lesson', difficulty: 50, stat_name: 'math', estimated_time_minutes: 20 },
        { id: 'c2', title: 'C2', type: 'lesson', difficulty: 60, stat_name: 'math', estimated_time_minutes: 25 },
        { id: 'c3', title: 'C3', type: 'lesson', difficulty: 70, stat_name: 'math', estimated_time_minutes: 30 },
      ];

      const result = getParetoOptimalContent('student-1', candidates);

      expect(result).toHaveProperty('optimal_content');
      expect(result).toHaveProperty('dominated_content');
      expect(result).toHaveProperty('pareto_graph');
      expect(result).toHaveProperty('recommendation');
    });

    it('should provide recommendations', () => {
      const candidates: Content[] = [
        { id: 'c1', title: 'C1', type: 'lesson', difficulty: 50, stat_name: 'math', estimated_time_minutes: 20 },
        { id: 'c2', title: 'C2', type: 'lesson', difficulty: 60, stat_name: 'math', estimated_time_minutes: 25 },
      ];

      const result = getParetoOptimalContent('student-1', candidates);

      expect(result.recommendation).toHaveProperty('top_balanced');
      expect(result.recommendation).toHaveProperty('top_learning');
      expect(result.recommendation).toHaveProperty('top_engagement');
      expect(result.recommendation).toHaveProperty('top_efficiency');
    });

    it('should mark dominated content correctly', () => {
      const candidates: Content[] = [
        { id: 'c1', title: 'C1', type: 'lesson', difficulty: 50, stat_name: 'math', estimated_time_minutes: 20 },
        { id: 'c2', title: 'C2', type: 'lesson', difficulty: 55, stat_name: 'math', estimated_time_minutes: 20 },
        { id: 'c3', title: 'C3', type: 'lesson', difficulty: 60, stat_name: 'math', estimated_time_minutes: 20 },
      ];

      const result = getParetoOptimalContent('student-1', candidates);

      // All content should have pareto graph entries
      expect(result.pareto_graph.length).toBe(3);

      // Each entry should have domination info
      for (const point of result.pareto_graph) {
        expect(point).toHaveProperty('is_pareto_optimal');
        expect(point).toHaveProperty('dominates');
        expect(point).toHaveProperty('dominated_by');
      }
    });

    it('should handle single content item', () => {
      const candidates: Content[] = [
        { id: 'c1', title: 'C1', type: 'lesson', difficulty: 50, stat_name: 'math', estimated_time_minutes: 20 },
      ];

      const result = getParetoOptimalContent('student-1', candidates);

      expect(result.optimal_content).toHaveLength(1);
      expect(result.dominated_content).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Attractor-Field Clustering Tests
  // ==========================================================================

  describe('clusterLearningStates', () => {
    it('should return attractor fields with probabilities', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 75,
        entropy: 35,
        generativity: 70,
        n_items_used: 20,
      });

      const result = clusterLearningStates('student-1', 'math');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      for (const attractor of result) {
        expect(attractor).toHaveProperty('type');
        expect(attractor).toHaveProperty('center');
        expect(attractor).toHaveProperty('student_probability');
        expect(attractor).toHaveProperty('intervention_suggestions');
      }
    });

    it('should return empty array if no state vector', () => {
      mockGetStateVector.mockReturnValue(null);

      const result = clusterLearningStates('student-1', 'math');

      expect(result).toEqual([]);
    });

    it('should sort by probability descending', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 75,
        entropy: 35,
        generativity: 70,
        n_items_used: 20,
      });

      const result = clusterLearningStates('student-1', 'math');

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].student_probability).toBeGreaterThanOrEqual(
          result[i].student_probability
        );
      }
    });

    it('should identify flow state when coordinates match', () => {
      // Flow center is approximately: coherence: 75, entropy: 35, generativity: 70
      mockGetStateVector.mockReturnValue({
        coherence: 75,
        entropy: 35,
        generativity: 70,
        n_items_used: 20,
      });

      const result = clusterLearningStates('student-1', 'math');

      // Flow should have high probability
      const flowAttractor = result.find(a => a.type === 'flow');
      expect(flowAttractor).toBeDefined();
      expect(flowAttractor!.student_probability).toBeGreaterThan(0);
    });

    it('should identify frustration state when coordinates match', () => {
      // Frustration center: coherence: 30, entropy: 80, generativity: 25
      mockGetStateVector.mockReturnValue({
        coherence: 30,
        entropy: 80,
        generativity: 25,
        n_items_used: 20,
      });

      const result = clusterLearningStates('student-1', 'math');

      const frustrationAttractor = result.find(a => a.type === 'frustration');
      expect(frustrationAttractor).toBeDefined();
      expect(frustrationAttractor!.student_probability).toBeGreaterThan(0);
    });
  });

  describe('detectCurrentAttractor', () => {
    it('should return highest probability attractor', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 75,
        entropy: 35,
        generativity: 70,
        n_items_used: 20,
      });

      const result = detectCurrentAttractor('student-1', 'math');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('student_probability');
    });

    it('should return null if no state vector', () => {
      mockGetStateVector.mockReturnValue(null);

      const result = detectCurrentAttractor('student-1', 'math');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // State Transition Prediction Tests
  // ==========================================================================

  describe('predictStateTransition', () => {
    const baseState: StateVector = {
      coherence: 50,
      entropy: 50,
      generativity: 50,
      n_items_used: 10,
    };

    it('should increase coherence for content intervention', () => {
      const intervention: Intervention = {
        type: 'content',
        description: 'Regular content practice',
      };

      const result = predictStateTransition(baseState, intervention);

      expect(result.coherence).toBeGreaterThan(baseState.coherence);
    });

    it('should increase coherence and decrease entropy for scaffolding', () => {
      const intervention: Intervention = {
        type: 'scaffolding',
        description: 'Structured practice',
      };

      const result = predictStateTransition(baseState, intervention);

      expect(result.coherence).toBeGreaterThan(baseState.coherence);
      expect(result.entropy).toBeLessThan(baseState.entropy);
    });

    it('should increase entropy and generativity for challenge', () => {
      const intervention: Intervention = {
        type: 'challenge',
        description: 'Challenging problems',
      };

      const result = predictStateTransition(baseState, intervention);

      expect(result.entropy).toBeGreaterThan(baseState.entropy);
      expect(result.generativity).toBeGreaterThan(baseState.generativity);
    });

    it('should increase generativity for exploration', () => {
      const intervention: Intervention = {
        type: 'exploration',
        description: 'Creative exploration',
      };

      const result = predictStateTransition(baseState, intervention);

      expect(result.generativity).toBeGreaterThan(baseState.generativity);
    });

    it('should decrease entropy for rest', () => {
      const intervention: Intervention = {
        type: 'rest',
        description: 'Take a break',
      };

      const result = predictStateTransition(baseState, intervention);

      expect(result.entropy).toBeLessThan(baseState.entropy);
    });

    it('should cap values at 0-100', () => {
      const highState: StateVector = {
        coherence: 99,
        entropy: 99,
        generativity: 99,
        n_items_used: 10,
      };

      const intervention: Intervention = {
        type: 'challenge',
        description: 'Challenge',
      };

      const result = predictStateTransition(highState, intervention);

      expect(result.entropy).toBeLessThanOrEqual(100);
      expect(result.generativity).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Trajectory Planning Tests
  // ==========================================================================

  describe('planOptimalTrajectory', () => {
    it('should plan trajectory to target state', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 40,
        entropy: 60,
        generativity: 45,
        n_items_used: 10,
      });

      const targetState: StateVector = {
        coherence: 70,
        entropy: 40,
        generativity: 65,
        n_items_used: 0,
      };

      const result = planOptimalTrajectory('student-1', 'math', targetState);

      expect(result).toHaveProperty('current_state');
      expect(result).toHaveProperty('target_state');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('total_duration_minutes');
      expect(result).toHaveProperty('success_probability');
      expect(result).toHaveProperty('risk_factors');
    });

    it('should throw error if no current state', () => {
      mockGetStateVector.mockReturnValue(null);

      const targetState: StateVector = {
        coherence: 70,
        entropy: 40,
        generativity: 65,
        n_items_used: 0,
      };

      expect(() => {
        planOptimalTrajectory('student-1', 'math', targetState);
      }).toThrow('No state vector found');
    });

    it('should include intervention steps', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 30,
        entropy: 70,
        generativity: 40,
        n_items_used: 10,
      });

      const targetState: StateVector = {
        coherence: 70,
        entropy: 40,
        generativity: 70,
        n_items_used: 0,
      };

      const result = planOptimalTrajectory('student-1', 'math', targetState);

      expect(result.steps.length).toBeGreaterThan(0);

      for (const step of result.steps) {
        expect(step).toHaveProperty('state');
        expect(step).toHaveProperty('intervention');
        expect(step).toHaveProperty('expected_duration_minutes');
        expect(step).toHaveProperty('confidence');
      }
    });

    it('should identify risk factors', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 20,
        entropy: 30,
        generativity: 20,
        n_items_used: 5,
      });

      const targetState: StateVector = {
        coherence: 90,
        entropy: 70, // Large entropy increase
        generativity: 90,
        n_items_used: 0,
      };

      const result = planOptimalTrajectory('student-1', 'math', targetState);

      expect(result.risk_factors.length).toBeGreaterThan(0);
    });

    it('should calculate success probability', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 50,
        entropy: 50,
        generativity: 50,
        n_items_used: 10,
      });

      const targetState: StateVector = {
        coherence: 60,
        entropy: 45,
        generativity: 60,
        n_items_used: 0,
      };

      const result = planOptimalTrajectory('student-1', 'math', targetState);

      expect(result.success_probability).toBeGreaterThan(0);
      expect(result.success_probability).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Chart-Space Visualization Tests
  // ==========================================================================

  describe('getStateHistory', () => {
    it('should query database for state history', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'h1',
          student_id: 'student-1',
          stat_name: 'math',
          coherence: 50,
          entropy: 50,
          generativity: 50,
          n_items_used: 10,
          created_at: 1234567890,
        },
      ]);

      const result = getStateHistory('student-1', 'math', 30);

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockDbAll).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should default to 30 days', () => {
      mockDbAll.mockReturnValue([]);

      getStateHistory('student-1', 'math');

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('getChartSpaceData', () => {
    it('should return complete visualization data', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 60,
        entropy: 40,
        generativity: 55,
        n_items_used: 20,
      });
      mockDbAll.mockReturnValue([]);

      const result = getChartSpaceData('student-1', 'math');

      expect(result).toHaveProperty('student_id');
      expect(result).toHaveProperty('stat_name');
      expect(result).toHaveProperty('current_state');
      expect(result).toHaveProperty('state_history');
      expect(result).toHaveProperty('attractor_fields');
    });

    it('should throw error if no state vector', () => {
      mockGetStateVector.mockReturnValue(null);

      expect(() => {
        getChartSpaceData('student-1', 'math');
      }).toThrow('No state vector found');
    });
  });

  describe('getChartSpaceDataWithPareto', () => {
    it('should include Pareto frontier', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 60,
        entropy: 40,
        generativity: 55,
        n_items_used: 20,
      });
      mockDbAll.mockReturnValue([]);

      const candidates: Content[] = [
        { id: 'c1', title: 'C1', type: 'lesson', difficulty: 50, stat_name: 'math', estimated_time_minutes: 20 },
      ];

      const result = getChartSpaceDataWithPareto('student-1', 'math', candidates);

      expect(result).toHaveProperty('pareto_frontier');
      expect(result.pareto_frontier).toBeDefined();
    });
  });

  describe('getChartSpaceDataWithTrajectory', () => {
    it('should include trajectory projection', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 60,
        entropy: 40,
        generativity: 55,
        n_items_used: 20,
      });
      mockDbAll.mockReturnValue([]);

      const targetState: StateVector = {
        coherence: 75,
        entropy: 35,
        generativity: 70,
        n_items_used: 0,
      };

      const result = getChartSpaceDataWithTrajectory('student-1', 'math', targetState);

      expect(result).toHaveProperty('trajectory_projection');
      expect(result.trajectory_projection).toBeDefined();
    });
  });

  // ==========================================================================
  // Database Operations Tests
  // ==========================================================================

  describe('initializeStateHistoryTable', () => {
    it('should create required tables', () => {
      initializeStateHistoryTable();

      expect(mockDbExec).toHaveBeenCalled();
      const calls = mockDbExec.mock.calls.map(c => c[0]);
      const allSql = calls.join(' ');

      expect(allSql).toContain('hyro_state_history');
      expect(allSql).toContain('hyro_attractor_assignments');
      expect(allSql).toContain('hyro_pareto_selections');
    });
  });

  describe('recordStateHistory', () => {
    it('should insert state history record', () => {
      const state: StateVector = {
        coherence: 60,
        entropy: 40,
        generativity: 55,
        n_items_used: 20,
      };

      recordStateHistory('student-1', 'math', state, 'assessment_complete');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO hyro_state_history'));
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe('recordAttractorAssignment', () => {
    it('should insert attractor assignment', () => {
      const attractor: AttractorField = {
        id: 'a1',
        type: 'flow',
        center: { coherence: 75, entropy: 35, generativity: 70, n_items_used: 0 },
        radius: 15,
        strength: 0.9,
        student_probability: 0.85,
        characteristics: ['High engagement'],
        intervention_suggestions: ['Maintain difficulty'],
      };

      const state: StateVector = {
        coherence: 73,
        entropy: 37,
        generativity: 68,
        n_items_used: 25,
      };

      recordAttractorAssignment('student-1', 'math', attractor, state);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO hyro_attractor_assignments'));
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe('recordParetoSelection', () => {
    it('should insert Pareto selection record', () => {
      const content: ContentWithObjectives = {
        id: 'c1',
        title: 'Content 1',
        type: 'lesson',
        difficulty: 55,
        stat_name: 'math',
        estimated_time_minutes: 25,
        learning_gain: 70,
        engagement_score: 75,
        efficiency_score: 65,
        transfer_potential: 60,
      };

      recordParetoSelection('student-1', 'math', content, true, true);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO hyro_pareto_selections'));
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero time estimate in efficiency calculation', () => {
      const content: Content = {
        id: 'c1',
        title: 'Instant',
        type: 'lesson',
        difficulty: 50,
        stat_name: 'math',
        estimated_time_minutes: 0,
      };

      // Should not throw - handles Math.max(1, ...) internally
      const result = calculateContentObjectives(content, 'student-1');
      expect(result.efficiency_score).toBeDefined();
    });

    it('should handle empty content array in Pareto calculation', () => {
      const candidates: Content[] = [];

      // This may throw or return empty - test the behavior
      expect(() => {
        getParetoOptimalContent('student-1', candidates);
      }).not.toThrow();
    });

    it('should handle state vector at boundaries', () => {
      mockGetStateVector.mockReturnValue({
        coherence: 0,
        entropy: 100,
        generativity: 0,
        n_items_used: 0,
      });

      const result = clusterLearningStates('student-1', 'math');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle null proficiency gracefully', () => {
      mockGetSkillProficiency.mockReturnValue({ level: 0, evidence_count: 0 });
      mockGetStateVector.mockReturnValue({
        coherence: 50,
        entropy: 50,
        generativity: 50,
        n_items_used: 0,
      });

      const content: Content = {
        id: 'c1',
        title: 'Test',
        type: 'lesson',
        difficulty: 50,
        stat_name: 'math',
        estimated_time_minutes: 20,
      };

      const result = calculateContentObjectives(content, 'student-1');
      expect(result).toBeDefined();
    });
  });
});
