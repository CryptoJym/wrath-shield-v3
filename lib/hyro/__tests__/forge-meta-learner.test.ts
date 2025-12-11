/**
 * Meta-Learning Trajectory System Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MetaLearner,
  getMetaLearner,
  recordLearningTrajectory,
  manifoldDistance,
  clusterState,
  findSimilarPatterns,
  getPatternStatistics,
  getTrajectoryHistory,
  StateVector,
  Intervention,
  TrajectoryRecord,
} from '../forge-meta-learner';

describe('MetaLearner', () => {
  let learner: MetaLearner;

  beforeEach(() => {
    learner = getMetaLearner();
  });

  describe('manifoldDistance', () => {
    it('should calculate distance between two states', () => {
      const state1: StateVector = { coherence: 50, entropy: 50, generativity: 50 };
      const state2: StateVector = { coherence: 60, entropy: 60, generativity: 60 };

      const distance = manifoldDistance(state1, state2);
      
      // Distance should be sqrt(10^2 + 10^2 + 10^2) = sqrt(300) ≈ 17.32
      expect(distance).toBeCloseTo(17.32, 1);
    });

    it('should return 0 for identical states', () => {
      const state: StateVector = { coherence: 50, entropy: 50, generativity: 50 };
      expect(manifoldDistance(state, state)).toBe(0);
    });
  });

  describe('clusterState', () => {
    it('should round state to nearest cluster center', () => {
      const state: StateVector = { coherence: 47, entropy: 53, generativity: 62 };
      const clustered = clusterState(state);

      // Should round to nearest 10
      expect(clustered.coherence).toBe(50);
      expect(clustered.entropy).toBe(50);
      expect(clustered.generativity).toBe(60);
    });
  });

  describe('recordLearningTrajectory', () => {
    it('should record a successful trajectory', () => {
      const startState: StateVector = { coherence: 40, entropy: 60, generativity: 45 };
      const endState: StateVector = { coherence: 55, entropy: 50, generativity: 60 };
      const interventions: Intervention[] = [
        { type: 'content', stat_target: 'math', duration_minutes: 20 },
        { type: 'scaffolding', stat_target: 'math', duration_minutes: 15 },
      ];

      const trajectory = recordLearningTrajectory(
        'student_1',
        'math',
        startState,
        endState,
        interventions,
        0.5,
        true
      );

      expect(trajectory.student_id).toBe('student_1');
      expect(trajectory.stat_name).toBe('math');
      expect(trajectory.success).toBe(true);
      expect(trajectory.interventions).toEqual(interventions);
    });
  });

  describe('getTrajectoryHistory', () => {
    it('should retrieve trajectory history for a student', () => {
      const startState: StateVector = { coherence: 40, entropy: 60, generativity: 45 };
      const endState: StateVector = { coherence: 55, entropy: 50, generativity: 60 };
      const interventions: Intervention[] = [
        { type: 'content', stat_target: 'math', duration_minutes: 20 },
      ];

      // Record a trajectory
      recordLearningTrajectory(
        'student_test',
        'math',
        startState,
        endState,
        interventions,
        0.5,
        true
      );

      const history = getTrajectoryHistory('student_test');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].student_id).toBe('student_test');
    });
  });

  describe('recommendTrajectory', () => {
    it('should provide a rule-based trajectory when no patterns exist', () => {
      const targetState: StateVector = { coherence: 75, entropy: 35, generativity: 70 };
      const currentState: StateVector = { coherence: 50, entropy: 50, generativity: 50 };

      const plan = learner.recommendTrajectory(
        'student_new',
        'math',
        targetState,
        currentState
      );

      expect(plan.student_id).toBe('student_new');
      expect(plan.stat_name).toBe('math');
      expect(plan.recommended_interventions.length).toBeGreaterThan(0);
      expect(plan.confidence).toBeGreaterThan(0);
    });
  });

  describe('getPatternStatistics', () => {
    it('should return pattern statistics', () => {
      const stats = getPatternStatistics();

      expect(stats).toHaveProperty('total_patterns');
      expect(stats).toHaveProperty('average_confidence');
      expect(stats).toHaveProperty('average_success_rate');
      expect(stats).toHaveProperty('patterns_by_stat');
    });
  });
});
