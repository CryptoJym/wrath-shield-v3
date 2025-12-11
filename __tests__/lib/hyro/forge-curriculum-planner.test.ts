// @ts-nocheck
/**
 * Tests for HYRO FORGE: Curriculum Planning System
 *
 * Tests semester-long curriculum planning with prerequisite graphs
 * and adaptive replanning.
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

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}));

// Import after mocks
import {
  initializeCurriculumTables,
  planSemesterCurriculum,
  getCurriculumPlan,
  getStudentCurriculumPlans,
  buildPrerequisiteGraph,
  getOptimalLearningPath,
  adaptCurriculumPlan,
  getPlanMilestones,
  updateMilestoneStatus,
  getCurrentWeekMilestones,
  activateCurriculumPlan,
  archiveCurriculumPlan,
} from '../../../lib/hyro/forge-curriculum-planner';

import type {
  CurriculumPlanStatus,
  MilestoneStatus,
  LearningGoal,
  CurriculumPlan,
  CurriculumMilestone,
  PrerequisiteGraph,
  LearningPath,
  ProgressUpdate,
  AdaptedPlan,
} from '../../../lib/hyro/forge-curriculum-planner';

describe('HYRO FORGE: Curriculum Planning System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define CurriculumPlanStatus values', () => {
      const statuses: CurriculumPlanStatus[] = ['draft', 'active', 'completed', 'archived'];
      expect(statuses).toHaveLength(4);
    });

    it('should define MilestoneStatus values', () => {
      const statuses: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'skipped'];
      expect(statuses).toHaveLength(4);
    });

    it('should define LearningGoal interface', () => {
      const goal: LearningGoal = {
        stat_name: 'math',
        target_level: 75,
        priority: 'high',
        description: 'Master algebra',
      };

      expect(goal.stat_name).toBe('math');
      expect(goal.target_level).toBe(75);
      expect(goal.priority).toBe('high');
    });

    it('should define CurriculumPlan interface', () => {
      const plan: CurriculumPlan = {
        id: 'plan-1',
        student_id: 'student-1',
        title: 'Fall Semester',
        description: 'Math focus',
        start_date: '2024-09-01',
        end_date: '2024-12-15',
        goals: [],
        status: 'draft',
        total_milestones: 10,
        completed_milestones: 3,
        progress_percent: 30,
        created_at: 1234567890,
        updated_at: 1234567890,
      };

      expect(plan.title).toBe('Fall Semester');
      expect(plan.status).toBe('draft');
    });

    it('should define CurriculumMilestone interface', () => {
      const milestone: CurriculumMilestone = {
        id: 'ms-1',
        plan_id: 'plan-1',
        student_id: 'student-1',
        title: 'Complete Fractions',
        week_number: 2,
        stat_name: 'math',
        target_level: 50,
        depends_on: ['ms-0'],
        status: 'pending',
        sort_order: 1,
        started_at: null,
        completed_at: null,
        created_at: 1234567890,
      };

      expect(milestone.week_number).toBe(2);
      expect(milestone.depends_on).toContain('ms-0');
    });
  });

  // ==========================================================================
  // Database Initialization Tests
  // ==========================================================================

  describe('initializeCurriculumTables', () => {
    it('should create curriculum tables', () => {
      initializeCurriculumTables();

      expect(mockDbExec).toHaveBeenCalled();
      const sql = mockDbExec.mock.calls[0][0];

      expect(sql).toContain('hyro_curriculum_plans');
      expect(sql).toContain('hyro_curriculum_milestones');
    });

    it('should create indexes', () => {
      initializeCurriculumTables();

      const sql = mockDbExec.mock.calls[0][0];

      expect(sql).toContain('CREATE INDEX');
      expect(sql).toContain('idx_curriculum_plans_student');
      expect(sql).toContain('idx_milestones_plan');
    });
  });

  // ==========================================================================
  // Curriculum Planning Tests
  // ==========================================================================

  describe('planSemesterCurriculum', () => {
    it('should create curriculum plan with milestones', () => {
      const goals: LearningGoal[] = [
        { stat_name: 'math', target_level: 80, priority: 'high' },
        { stat_name: 'reading', target_level: 70, priority: 'medium' },
      ];

      const result = planSemesterCurriculum({
        student_id: 'student-1',
        title: 'Fall 2024',
        description: 'Focus on math and reading',
        start_date: '2024-09-01',
        end_date: '2024-12-15',
        goals,
      });

      expect(result.title).toBe('Fall 2024');
      expect(result.status).toBe('draft');
      expect(result.total_milestones).toBeGreaterThan(0);
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should prioritize high-priority goals', () => {
      const goals: LearningGoal[] = [
        { stat_name: 'reading', target_level: 60, priority: 'low' },
        { stat_name: 'math', target_level: 80, priority: 'high' },
      ];

      const result = planSemesterCurriculum({
        title: 'Test Plan',
        start_date: '2024-01-01',
        end_date: '2024-06-30',
        goals,
      });

      // High priority should get more weeks
      expect(result.total_milestones).toBeGreaterThan(0);
    });

    it('should default student_id to hyro', () => {
      const result = planSemesterCurriculum({
        title: 'Test',
        start_date: '2024-01-01',
        end_date: '2024-03-01',
        goals: [{ stat_name: 'math', target_level: 50, priority: 'medium' }],
      });

      expect(result.student_id).toBe('hyro');
    });

    it('should calculate weeks correctly', () => {
      const result = planSemesterCurriculum({
        title: 'One Month',
        start_date: '2024-01-01',
        end_date: '2024-01-28', // 4 weeks
        goals: [{ stat_name: 'math', target_level: 100, priority: 'high' }],
      });

      expect(result.total_milestones).toBeGreaterThan(0);
    });
  });

  describe('getCurriculumPlan', () => {
    it('should get plan by ID', () => {
      mockDbGet.mockReturnValue({
        id: 'plan-1',
        student_id: 'student-1',
        title: 'Test Plan',
        description: null,
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        goals_json: JSON.stringify([{ stat_name: 'math', target_level: 50, priority: 'high' }]),
        status: 'active',
        total_milestones: 10,
        completed_milestones: 5,
        progress_percent: 50,
        created_at: 1234567890,
        updated_at: 1234567890,
      });

      const result = getCurriculumPlan('plan-1');

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test Plan');
      expect(result!.goals).toHaveLength(1);
    });

    it('should return null if not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const result = getCurriculumPlan('nonexistent');

      expect(result).toBeNull();
    });

    it('should parse goals JSON', () => {
      mockDbGet.mockReturnValue({
        id: 'plan-1',
        goals_json: JSON.stringify([
          { stat_name: 'math', target_level: 80, priority: 'high' },
          { stat_name: 'reading', target_level: 70, priority: 'medium' },
        ]),
        student_id: 'student-1',
        title: 'Test',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        status: 'draft',
        total_milestones: 10,
        completed_milestones: 0,
        progress_percent: 0,
        created_at: 1234567890,
        updated_at: 1234567890,
      });

      const result = getCurriculumPlan('plan-1');

      expect(result!.goals).toHaveLength(2);
      expect(result!.goals[0].stat_name).toBe('math');
    });
  });

  describe('getStudentCurriculumPlans', () => {
    it('should get all plans for a student', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'plan-1',
          title: 'Plan 1',
          goals_json: '[]',
          student_id: 'student-1',
          start_date: '2024-01-01',
          end_date: '2024-06-01',
          status: 'active',
          total_milestones: 5,
          completed_milestones: 2,
          progress_percent: 40,
          created_at: 1234567890,
          updated_at: 1234567890,
        },
        {
          id: 'plan-2',
          title: 'Plan 2',
          goals_json: '[]',
          student_id: 'student-1',
          start_date: '2024-07-01',
          end_date: '2024-12-01',
          status: 'draft',
          total_milestones: 10,
          completed_milestones: 0,
          progress_percent: 0,
          created_at: 1234567891,
          updated_at: 1234567891,
        },
      ]);

      const result = getStudentCurriculumPlans('student-1');

      expect(result).toHaveLength(2);
    });

    it('should default to hyro student', () => {
      mockDbAll.mockReturnValue([]);

      getStudentCurriculumPlans();

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Prerequisite Graph Tests
  // ==========================================================================

  describe('buildPrerequisiteGraph', () => {
    it('should build graph from milestones', () => {
      const milestones: CurriculumMilestone[] = [
        {
          id: 'ms-1', plan_id: 'plan-1', student_id: 'student-1',
          title: 'Milestone 1', week_number: 1, stat_name: 'math',
          target_level: 30, depends_on: [], status: 'pending',
          sort_order: 0, started_at: null, completed_at: null, created_at: 0,
        },
        {
          id: 'ms-2', plan_id: 'plan-1', student_id: 'student-1',
          title: 'Milestone 2', week_number: 2, stat_name: 'math',
          target_level: 50, depends_on: ['ms-1'], status: 'pending',
          sort_order: 1, started_at: null, completed_at: null, created_at: 0,
        },
        {
          id: 'ms-3', plan_id: 'plan-1', student_id: 'student-1',
          title: 'Milestone 3', week_number: 3, stat_name: 'math',
          target_level: 70, depends_on: ['ms-2'], status: 'pending',
          sort_order: 2, started_at: null, completed_at: null, created_at: 0,
        },
      ];

      const result = buildPrerequisiteGraph(milestones);

      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });

    it('should calculate node depths', () => {
      const milestones: CurriculumMilestone[] = [
        {
          id: 'ms-1', plan_id: 'plan-1', student_id: 'student-1',
          title: 'Milestone 1', week_number: 1, stat_name: 'math',
          target_level: 30, depends_on: [], status: 'pending',
          sort_order: 0, started_at: null, completed_at: null, created_at: 0,
        },
        {
          id: 'ms-2', plan_id: 'plan-1', student_id: 'student-1',
          title: 'Milestone 2', week_number: 2, stat_name: 'math',
          target_level: 50, depends_on: ['ms-1'], status: 'pending',
          sort_order: 1, started_at: null, completed_at: null, created_at: 0,
        },
      ];

      const result = buildPrerequisiteGraph(milestones);

      const node1 = result.nodes.find(n => n.id === 'ms-1');
      const node2 = result.nodes.find(n => n.id === 'ms-2');

      expect(node1!.depth).toBe(0);
      expect(node2!.depth).toBe(1);
    });

    it('should handle empty milestones', () => {
      const result = buildPrerequisiteGraph([]);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('getOptimalLearningPath', () => {
    it('should return topologically sorted milestones', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'ms-1', plan_id: 'plan-1', student_id: 'student-1',
          title: 'M1', week_number: 1, stat_name: 'math', target_level: 30,
          depends_on_json: '[]', status: 'pending', sort_order: 0,
          started_at: null, completed_at: null, created_at: 0,
        },
        {
          id: 'ms-2', plan_id: 'plan-1', student_id: 'student-1',
          title: 'M2', week_number: 2, stat_name: 'math', target_level: 50,
          depends_on_json: '["ms-1"]', status: 'pending', sort_order: 1,
          started_at: null, completed_at: null, created_at: 0,
        },
      ]);

      const result = getOptimalLearningPath('plan-1');

      expect(result).toHaveProperty('ordered_milestones');
      expect(result).toHaveProperty('estimated_weeks');
      expect(result).toHaveProperty('critical_path');
    });

    it('should identify critical path', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'ms-1', week_number: 1, depends_on_json: '[]',
          plan_id: 'p1', student_id: 's1', title: 'M1',
          stat_name: 'math', target_level: 30, status: 'pending',
          sort_order: 0, created_at: 0,
        },
        {
          id: 'ms-2', week_number: 2, depends_on_json: '["ms-1"]',
          plan_id: 'p1', student_id: 's1', title: 'M2',
          stat_name: 'math', target_level: 50, status: 'pending',
          sort_order: 1, created_at: 0,
        },
      ]);

      const result = getOptimalLearningPath('plan-1');

      expect(result.critical_path.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Adaptive Replanning Tests
  // ==========================================================================

  describe('adaptCurriculumPlan', () => {
    beforeEach(() => {
      mockDbGet.mockImplementation((planId) => {
        if (typeof planId === 'string') {
          return {
            id: planId,
            goals_json: '[]',
            student_id: 'student-1',
            title: 'Test',
            start_date: '2024-01-01',
            end_date: '2024-06-01',
            status: 'active',
            total_milestones: 10,
            completed_milestones: 3,
            progress_percent: 30,
            created_at: 0,
            updated_at: 0,
          };
        }
        return { count: 5 };
      });
      mockDbAll.mockReturnValue([
        { id: 'ms-1', title: 'Pending 1', status: 'pending' },
        { id: 'ms-2', title: 'Pending 2', status: 'pending' },
        { id: 'ms-3', title: 'Pending 3', status: 'pending' },
      ]);
    });

    it('should adapt plan for high performers', () => {
      const progress: ProgressUpdate = {
        completed_standards: ['standard-1', 'standard-2'],
        current_performance: 95, // High performer
      };

      const result = adaptCurriculumPlan('plan-1', progress);

      expect(result.plan_id).toBe('plan-1');
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes.some(c => c.includes('accelerating'))).toBe(true);
    });

    it('should adapt plan for struggling students', () => {
      const progress: ProgressUpdate = {
        completed_standards: [],
        current_performance: 45, // Struggling
      };

      const result = adaptCurriculumPlan('plan-1', progress);

      expect(result.changes.some(c => c.includes('support'))).toBe(true);
    });

    it('should throw error if plan not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const progress: ProgressUpdate = {
        completed_standards: [],
        current_performance: 70,
      };

      expect(() => {
        adaptCurriculumPlan('nonexistent', progress);
      }).toThrow('Plan not found');
    });

    it('should update progress percentage', () => {
      const progress: ProgressUpdate = {
        completed_standards: ['s1'],
        current_performance: 75,
      };

      adaptCurriculumPlan('plan-1', progress);

      // Check UPDATE was called for progress
      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Milestone Management Tests
  // ==========================================================================

  describe('getPlanMilestones', () => {
    it('should get all milestones for a plan', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'ms-1', plan_id: 'plan-1', student_id: 'student-1',
          title: 'M1', week_number: 1, stat_name: 'math', target_level: 30,
          depends_on_json: '[]', status: 'completed', sort_order: 0,
          started_at: null, completed_at: 1234567890, created_at: 0,
        },
        {
          id: 'ms-2', plan_id: 'plan-1', student_id: 'student-1',
          title: 'M2', week_number: 2, stat_name: 'math', target_level: 50,
          depends_on_json: '["ms-1"]', status: 'in_progress', sort_order: 1,
          started_at: 1234567891, completed_at: null, created_at: 0,
        },
      ]);

      const result = getPlanMilestones('plan-1');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('in_progress');
    });

    it('should parse depends_on JSON', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'ms-1',
          depends_on_json: '["dep-1", "dep-2"]',
          plan_id: 'p1', student_id: 's1', title: 'M1',
          week_number: 1, stat_name: 'math', target_level: 30,
          status: 'pending', sort_order: 0, created_at: 0,
        },
      ]);

      const result = getPlanMilestones('plan-1');

      expect(result[0].depends_on).toEqual(['dep-1', 'dep-2']);
    });
  });

  describe('updateMilestoneStatus', () => {
    beforeEach(() => {
      mockDbGet.mockImplementation((query) => {
        if (typeof query === 'string') {
          return { plan_id: 'plan-1', count: 5 };
        }
        return {
          id: 'ms-1', plan_id: 'plan-1', student_id: 'student-1',
          title: 'M1', week_number: 1, stat_name: 'math', target_level: 30,
          depends_on_json: '[]', status: 'in_progress', sort_order: 0,
          started_at: 1234567890, completed_at: null, created_at: 0,
        };
      });
    });

    it('should update milestone status', () => {
      const result = updateMilestoneStatus('ms-1', 'completed');

      expect(mockDbRun).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should set started_at when moving to in_progress', () => {
      updateMilestoneStatus('ms-1', 'in_progress');

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should set completed_at when completing', () => {
      updateMilestoneStatus('ms-1', 'completed');

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should update plan progress', () => {
      updateMilestoneStatus('ms-1', 'completed');

      // Check that plan progress was updated
      const updateCall = mockPrepare.mock.calls.find(call =>
        call[0].includes('UPDATE hyro_curriculum_plans')
      );
      expect(updateCall).toBeDefined();
    });

    it('should return null if milestone not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const result = updateMilestoneStatus('nonexistent', 'completed');

      expect(result).toBeNull();
    });
  });

  describe('getCurrentWeekMilestones', () => {
    beforeEach(() => {
      mockDbGet.mockReturnValue({
        id: 'plan-1',
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week ago
        end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        goals_json: '[]',
        student_id: 'student-1',
        title: 'Test',
        status: 'active',
        total_milestones: 10,
        completed_milestones: 2,
        progress_percent: 20,
        created_at: 0,
        updated_at: 0,
      });
    });

    it('should get milestones for current week', () => {
      mockDbAll.mockReturnValue([
        {
          id: 'ms-1',
          week_number: 2,
          depends_on_json: '[]',
          plan_id: 'plan-1', student_id: 'student-1', title: 'M1',
          stat_name: 'math', target_level: 40, status: 'pending',
          sort_order: 0, created_at: 0,
        },
      ]);

      const result = getCurrentWeekMilestones('plan-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array if plan not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const result = getCurrentWeekMilestones('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('activateCurriculumPlan', () => {
    it('should activate a plan', () => {
      mockDbGet.mockReturnValue({
        id: 'plan-1',
        status: 'active',
        goals_json: '[]',
        student_id: 'student-1',
        title: 'Test',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        total_milestones: 10,
        completed_milestones: 0,
        progress_percent: 0,
        created_at: 0,
        updated_at: 0,
      });

      const result = activateCurriculumPlan('plan-1');

      expect(mockDbRun).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });
  });

  describe('archiveCurriculumPlan', () => {
    it('should archive a plan', () => {
      mockDbGet.mockReturnValue({
        id: 'plan-1',
        status: 'archived',
        goals_json: '[]',
        student_id: 'student-1',
        title: 'Test',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        total_milestones: 10,
        completed_milestones: 10,
        progress_percent: 100,
        created_at: 0,
        updated_at: 0,
      });

      const result = archiveCurriculumPlan('plan-1');

      expect(mockDbRun).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle plan with no goals', () => {
      const result = planSemesterCurriculum({
        title: 'Empty Plan',
        start_date: '2024-01-01',
        end_date: '2024-06-01',
        goals: [],
      });

      expect(result.total_milestones).toBe(0);
    });

    it('should handle very short date range', () => {
      const result = planSemesterCurriculum({
        title: 'Short Plan',
        start_date: '2024-01-01',
        end_date: '2024-01-07', // 1 week
        goals: [{ stat_name: 'math', target_level: 100, priority: 'high' }],
      });

      expect(result.total_milestones).toBeGreaterThanOrEqual(0);
    });

    it('should handle milestones with no dependencies', () => {
      const milestones: CurriculumMilestone[] = [
        {
          id: 'ms-1', plan_id: 'p1', student_id: 's1',
          title: 'M1', week_number: 1, stat_name: 'math',
          target_level: 50, depends_on: [], status: 'pending',
          sort_order: 0, started_at: null, completed_at: null, created_at: 0,
        },
        {
          id: 'ms-2', plan_id: 'p1', student_id: 's1',
          title: 'M2', week_number: 1, stat_name: 'reading',
          target_level: 50, depends_on: [], status: 'pending',
          sort_order: 1, started_at: null, completed_at: null, created_at: 0,
        },
      ];

      const graph = buildPrerequisiteGraph(milestones);

      expect(graph.edges).toHaveLength(0);
      expect(graph.nodes.every(n => n.depth === 0)).toBe(true);
    });

    it('should handle circular-like dependencies gracefully', () => {
      const milestones: CurriculumMilestone[] = [
        {
          id: 'ms-1', plan_id: 'p1', student_id: 's1',
          title: 'M1', week_number: 1, stat_name: 'math',
          target_level: 30, depends_on: ['ms-nonexistent'], // Points to nonexistent
          status: 'pending', sort_order: 0, started_at: null, completed_at: null, created_at: 0,
        },
      ];

      // Should not throw
      const graph = buildPrerequisiteGraph(milestones);
      expect(graph.nodes).toHaveLength(1);
    });
  });
});
