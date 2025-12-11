// @ts-nocheck
/**
 * Tests for Hyro Education Memory Module
 *
 * Tests specialized memory operations for Hyro's education tracking including:
 * - Learning patterns and preferences
 * - Lesson plan history
 * - Assignment context
 * - Educational progress tracking
 * - Memory search and retrieval
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep memory module
const mockAddAgentMemory = jest.fn(() => Promise.resolve());
const mockSearchAgentMemory = jest.fn(() => Promise.resolve([]));

jest.mock('../../../lib/memory/zep', () => ({
  addAgentMemory: mockAddAgentMemory,
  searchAgentMemory: mockSearchAgentMemory,
}));

// Import after mocks
import {
  searchEducationMemory,
  addEducationMemory,
  recordLessonPlan,
  recordLearningPattern,
  recordAssignment,
  recordProgress,
  recordResource,
  getSubjectPatterns,
  getRecentLessonPlans,
  getLessonPlanningContext,
  getWeeklyContext,
  learnFromFeedback,
  HYRO_EDUCATION_AGENT_ID,
  type LessonPlan,
  type Activity,
  type Resource,
  type LearningPattern,
  type AssignmentContext,
} from '../../../lib/hyro/education-memory';

describe('Hyro Education Memory Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definitions Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    describe('LessonPlan', () => {
      it('should create valid lesson plan', () => {
        const plan: LessonPlan = {
          id: 'plan-123',
          subject: 'Math',
          topic: 'Fractions',
          objectives: ['Understand fractions', 'Add simple fractions'],
          activities: [
            { name: 'Introduction', duration: 10, type: 'instruction' },
            { name: 'Practice', duration: 20, type: 'practice' },
          ],
          duration: 45,
          grade_level: '4th',
          date: '2025-01-20',
          status: 'scheduled',
          notes: 'Use visual aids',
          resources: [{ title: 'Fraction Kit', type: 'other' }],
        };

        expect(plan.id).toBe('plan-123');
        expect(plan.activities).toHaveLength(2);
        expect(plan.status).toBe('scheduled');
      });

      it('should accept all status values', () => {
        const statuses: LessonPlan['status'][] = ['draft', 'scheduled', 'completed', 'archived'];
        expect(statuses).toHaveLength(4);
      });
    });

    describe('Activity', () => {
      it('should create valid activity', () => {
        const activity: Activity = {
          name: 'Group Discussion',
          duration: 15,
          type: 'discussion',
          description: 'Discuss the problem-solving strategies',
          materials: ['Whiteboard', 'Markers'],
        };

        expect(activity.type).toBe('discussion');
        expect(activity.materials).toHaveLength(2);
      });

      it('should accept all activity types', () => {
        const types: Activity['type'][] = [
          'instruction', 'practice', 'assessment', 'discussion', 'project', 'break'
        ];
        expect(types).toHaveLength(6);
      });
    });

    describe('Resource', () => {
      it('should create valid resource', () => {
        const resource: Resource = {
          title: 'Khan Academy Fractions',
          type: 'website',
          url: 'https://khanacademy.org/fractions',
          notes: 'Great for visual learners',
        };

        expect(resource.type).toBe('website');
        expect(resource.url).toContain('khanacademy');
      });

      it('should accept all resource types', () => {
        const types: Resource['type'][] = ['video', 'worksheet', 'website', 'book', 'game', 'other'];
        expect(types).toHaveLength(6);
      });
    });

    describe('LearningPattern', () => {
      it('should create valid learning pattern', () => {
        const pattern: LearningPattern = {
          category: 'strength',
          subject: 'Math',
          observation: 'Excels at visual problem solving',
          confidence: 0.85,
          source: 'observed',
        };

        expect(pattern.category).toBe('strength');
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });

      it('should accept all category values', () => {
        const categories: LearningPattern['category'][] = [
          'strength', 'weakness', 'preference', 'style', 'interest'
        ];
        expect(categories).toHaveLength(5);
      });

      it('should accept all source values', () => {
        const sources: LearningPattern['source'][] = ['observed', 'reported', 'inferred'];
        expect(sources).toHaveLength(3);
      });
    });

    describe('AssignmentContext', () => {
      it('should create valid assignment context', () => {
        const assignment: AssignmentContext = {
          platform: 'Canyon Grove',
          subject: 'Reading',
          title: 'Chapter 5 Questions',
          dueDate: '2025-01-22',
          status: 'pending',
          notes: 'Focus on comprehension questions',
        };

        expect(assignment.platform).toBe('Canyon Grove');
        expect(assignment.status).toBe('pending');
      });

      it('should accept all status values', () => {
        const statuses: AssignmentContext['status'][] = [
          'pending', 'in_progress', 'completed', 'overdue'
        ];
        expect(statuses).toHaveLength(4);
      });
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('Constants', () => {
    it('should export HYRO_EDUCATION_AGENT_ID', () => {
      expect(HYRO_EDUCATION_AGENT_ID).toBe('hyro-agent');
    });
  });

  // ==========================================================================
  // Memory Operations Tests
  // ==========================================================================

  describe('Memory Operations', () => {
    describe('searchEducationMemory', () => {
      it('should call searchAgentMemory with correct agent ID', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        await searchEducationMemory('test query');

        expect(mockSearchAgentMemory).toHaveBeenCalledWith('hyro-agent', 'test query', 10);
      });

      it('should pass custom limit', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        await searchEducationMemory('test query', 5);

        expect(mockSearchAgentMemory).toHaveBeenCalledWith('hyro-agent', 'test query', 5);
      });

      it('should return search results', async () => {
        const mockResults = [
          { memory: { text: 'Result 1', metadata: {} }, score: 0.9 },
          { memory: { text: 'Result 2', metadata: {} }, score: 0.8 },
        ];
        mockSearchAgentMemory.mockResolvedValueOnce(mockResults);

        const results = await searchEducationMemory('test');

        expect(results).toHaveLength(2);
        expect(results[0].score).toBe(0.9);
      });
    });

    describe('addEducationMemory', () => {
      it('should add memory with correct prefix and metadata', async () => {
        await addEducationMemory('Test content', 'lesson_plan', { extra: 'data' });

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          '[EDUCATION - LESSON_PLAN] Test content',
          expect.objectContaining({
            domain: 'education',
            category: 'lesson_plan',
            extra: 'data',
          })
        );
      });

      it('should handle all category types', async () => {
        const categories = ['lesson_plan', 'progress', 'pattern', 'assignment', 'resource', 'note'] as const;

        for (const category of categories) {
          await addEducationMemory('Content', category);
          expect(mockAddAgentMemory).toHaveBeenCalledWith(
            'hyro-agent',
            `[EDUCATION - ${category.toUpperCase()}] Content`,
            expect.objectContaining({ category })
          );
        }
      });
    });
  });

  // ==========================================================================
  // Record Functions Tests
  // ==========================================================================

  describe('Record Functions', () => {
    describe('recordLessonPlan', () => {
      it('should record lesson plan with full details', async () => {
        const plan: LessonPlan = {
          id: 'plan-456',
          subject: 'Science',
          topic: 'Photosynthesis',
          objectives: ['Understand the process', 'Identify key components'],
          activities: [
            { name: 'Video', duration: 15, type: 'instruction' },
            { name: 'Lab', duration: 25, type: 'project' },
          ],
          duration: 45,
          status: 'scheduled',
          notes: 'Prepare lab materials',
        };

        const result = await recordLessonPlan(plan);

        expect(result).toBe('plan-456');
        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Lesson Plan: Science - Photosynthesis'),
          expect.objectContaining({
            lesson_plan_id: 'plan-456',
            subject: 'Science',
            topic: 'Photosynthesis',
          })
        );
      });

      it('should include objectives in text', async () => {
        const plan: LessonPlan = {
          id: 'plan-obj',
          subject: 'Math',
          topic: 'Fractions',
          objectives: ['Learn fractions', 'Practice addition'],
          activities: [],
          duration: 30,
          status: 'draft',
        };

        await recordLessonPlan(plan);

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Learn fractions; Practice addition'),
          expect.any(Object)
        );
      });
    });

    describe('recordLearningPattern', () => {
      it('should record learning pattern with all details', async () => {
        const pattern: LearningPattern = {
          category: 'strength',
          subject: 'Reading',
          observation: 'Strong vocabulary comprehension',
          confidence: 0.9,
          source: 'observed',
        };

        await recordLearningPattern(pattern);

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Learning Pattern: Strong vocabulary comprehension'),
          expect.objectContaining({
            pattern_category: 'strength',
            subject: 'Reading',
            confidence: 0.9,
          })
        );
      });

      it('should handle pattern without subject', async () => {
        const pattern: LearningPattern = {
          category: 'preference',
          observation: 'Prefers morning learning sessions',
          confidence: 0.7,
          source: 'reported',
        };

        await recordLearningPattern(pattern);

        expect(mockAddAgentMemory).toHaveBeenCalled();
      });
    });

    describe('recordAssignment', () => {
      it('should record assignment context', async () => {
        const assignment: AssignmentContext = {
          platform: 'Google Classroom',
          subject: 'Writing',
          title: 'Essay Draft',
          dueDate: '2025-01-25',
          status: 'in_progress',
          notes: 'First draft only',
        };

        await recordAssignment(assignment);

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Assignment: Essay Draft'),
          expect.objectContaining({
            platform: 'Google Classroom',
            subject: 'Writing',
            status: 'in_progress',
          })
        );
      });

      it('should handle assignment without due date', async () => {
        const assignment: AssignmentContext = {
          platform: 'Manual',
          subject: 'Art',
          title: 'Drawing Practice',
          status: 'pending',
        };

        await recordAssignment(assignment);

        expect(mockAddAgentMemory).toHaveBeenCalled();
      });
    });

    describe('recordProgress', () => {
      it('should record progress update', async () => {
        await recordProgress('Math', 'Completed fractions unit with 90% accuracy', {
          accuracy: 90,
          unitsCompleted: 5,
        });

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Progress Update - Math: Completed fractions unit'),
          expect.objectContaining({
            subject: 'Math',
            accuracy: 90,
            unitsCompleted: 5,
          })
        );
      });

      it('should handle progress without metrics', async () => {
        await recordProgress('Reading', 'Finished chapter book');

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.any(String),
          expect.objectContaining({ subject: 'Reading' })
        );
      });
    });

    describe('recordResource', () => {
      it('should record educational resource', async () => {
        const resource: Resource = {
          title: 'BrainPOP',
          type: 'website',
          url: 'https://brainpop.com',
          notes: 'Great animated videos',
        };

        await recordResource(resource, 'Science');

        expect(mockAddAgentMemory).toHaveBeenCalledWith(
          'hyro-agent',
          expect.stringContaining('Educational Resource: BrainPOP'),
          expect.objectContaining({
            resource_type: 'website',
            subject: 'Science',
            url: 'https://brainpop.com',
          })
        );
      });

      it('should handle resource without subject', async () => {
        const resource: Resource = {
          title: 'General Learning Games',
          type: 'game',
        };

        await recordResource(resource);

        expect(mockAddAgentMemory).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Retrieval Functions Tests
  // ==========================================================================

  describe('Retrieval Functions', () => {
    describe('getSubjectPatterns', () => {
      it('should search for patterns and filter by category', async () => {
        const mockResults = [
          { memory: { text: 'Pattern 1', metadata: { category: 'pattern', subject: 'Math' } }, score: 0.9 },
          { memory: { text: 'Pattern 2', metadata: { category: 'pattern' } }, score: 0.8 },
          { memory: { text: 'Not a pattern', metadata: { category: 'assignment' } }, score: 0.7 },
        ];
        mockSearchAgentMemory.mockResolvedValueOnce(mockResults);

        const results = await getSubjectPatterns('Math', 3);

        expect(mockSearchAgentMemory).toHaveBeenCalledWith('hyro-agent', 'learning pattern Math', 6);
        expect(results.length).toBeLessThanOrEqual(3);
      });

      it('should use default limit of 5', async () => {
        mockSearchAgentMemory.mockResolvedValueOnce([]);

        await getSubjectPatterns('Science');

        expect(mockSearchAgentMemory).toHaveBeenCalledWith('hyro-agent', expect.any(String), 10);
      });
    });

    describe('getRecentLessonPlans', () => {
      it('should search and filter lesson plans', async () => {
        const mockResults = [
          { memory: { text: 'Lesson 1', metadata: { category: 'lesson_plan' } }, score: 0.9 },
          { memory: { text: 'Lesson 2', metadata: { category: 'lesson_plan' } }, score: 0.8 },
          { memory: { text: 'Assignment', metadata: { category: 'assignment' } }, score: 0.7 },
        ];
        mockSearchAgentMemory.mockResolvedValueOnce(mockResults);

        const results = await getRecentLessonPlans(5);

        expect(results.every(r => r.memory.metadata?.category === 'lesson_plan')).toBe(true);
      });
    });

    describe('getLessonPlanningContext', () => {
      it('should compile context from multiple sources', async () => {
        // Mock patterns
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: '[EDUCATION - PATTERN] Math strength', metadata: { category: 'pattern' } }, score: 0.9 },
        ]);
        // Mock recent plans
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: '[EDUCATION - LESSON_PLAN] Math fractions', metadata: { category: 'lesson_plan' } }, score: 0.8 },
        ]);
        // Mock resources
        mockSearchAgentMemory.mockResolvedValueOnce([
          { memory: { text: '[EDUCATION - RESOURCE] Math video', metadata: { category: 'resource' } }, score: 0.7 },
        ]);

        const context = await getLessonPlanningContext('Math', 'Decimals');

        expect(context).toContain('Lesson Planning Context for Math: Decimals');
        expect(mockSearchAgentMemory).toHaveBeenCalledTimes(3);
      });

      it('should handle empty results gracefully', async () => {
        mockSearchAgentMemory.mockResolvedValue([]);

        const context = await getLessonPlanningContext('Art', 'Drawing');

        expect(context).toContain('Lesson Planning Context for Art: Drawing');
      });
    });

    describe('getWeeklyContext', () => {
      it('should retrieve weekly assignments, plans, and patterns', async () => {
        mockSearchAgentMemory
          .mockResolvedValueOnce([
            { memory: { text: 'Assignment', metadata: { category: 'assignment' } }, score: 0.9 },
          ])
          .mockResolvedValueOnce([
            { memory: { text: 'Lesson', metadata: { category: 'lesson_plan' } }, score: 0.8 },
          ])
          .mockResolvedValueOnce([
            { memory: { text: 'Pattern', metadata: { category: 'pattern' } }, score: 0.7 },
          ]);

        const result = await getWeeklyContext('2025-01-20', '2025-01-26');

        expect(result.assignments).toHaveLength(1);
        expect(result.lessonPlans).toHaveLength(1);
        expect(result.patterns).toHaveLength(1);
      });
    });
  });

  // ==========================================================================
  // Feedback Learning Tests
  // ==========================================================================

  describe('learnFromFeedback', () => {
    it('should record feedback for lesson plan', async () => {
      await learnFromFeedback(
        'plan-123',
        'Students were highly engaged with the hands-on activities',
        'very_effective',
        'Add more hands-on elements to future lessons'
      );

      expect(mockAddAgentMemory).toHaveBeenCalled();
    });

    it('should record pattern for very effective lessons', async () => {
      await learnFromFeedback(
        'plan-123',
        'Visual aids helped a lot',
        'very_effective'
      );

      // Should be called twice: once for feedback, once for pattern
      expect(mockAddAgentMemory).toHaveBeenCalledTimes(2);
    });

    it('should record pattern for ineffective lessons', async () => {
      await learnFromFeedback(
        'plan-456',
        'Lecture was too long, students lost focus',
        'ineffective',
        'Break up lectures into shorter segments'
      );

      // Should be called twice: once for feedback, once for pattern
      expect(mockAddAgentMemory).toHaveBeenCalledTimes(2);
    });

    it('should not record pattern for neutral effectiveness', async () => {
      await learnFromFeedback(
        'plan-789',
        'Lesson went okay',
        'neutral'
      );

      // Should only be called once for feedback
      expect(mockAddAgentMemory).toHaveBeenCalledTimes(1);
    });

    it('should not record pattern for effective (but not very effective)', async () => {
      await learnFromFeedback(
        'plan-101',
        'Good lesson overall',
        'effective'
      );

      // Should only be called once for feedback
      expect(mockAddAgentMemory).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty search results', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([]);

      const results = await searchEducationMemory('nonexistent');

      expect(results).toEqual([]);
    });

    it('should handle lesson plan with minimal data', async () => {
      const minimalPlan: LessonPlan = {
        id: 'min-plan',
        subject: 'Test',
        topic: 'Test Topic',
        objectives: [],
        activities: [],
        duration: 0,
        status: 'draft',
      };

      await recordLessonPlan(minimalPlan);

      expect(mockAddAgentMemory).toHaveBeenCalled();
    });

    it('should handle special characters in content', async () => {
      await addEducationMemory(
        'Test with "quotes" and <special> & characters',
        'note'
      );

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'hyro-agent',
        expect.stringContaining('"quotes"'),
        expect.any(Object)
      );
    });

    it('should handle very long content', async () => {
      const longContent = 'A'.repeat(5000);
      await addEducationMemory(longContent, 'note');

      expect(mockAddAgentMemory).toHaveBeenCalled();
    });

    it('should handle Unicode content', async () => {
      await addEducationMemory('Lesson on  and ', 'lesson_plan');

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'hyro-agent',
        expect.stringContaining(''),
        expect.any(Object)
      );
    });

    it('should handle pattern with 0 confidence', async () => {
      const pattern: LearningPattern = {
        category: 'interest',
        observation: 'Possible interest in robotics',
        confidence: 0,
        source: 'inferred',
      };

      await recordLearningPattern(pattern);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'hyro-agent',
        expect.stringContaining('Confidence: 0%'),
        expect.any(Object)
      );
    });

    it('should handle pattern with 1.0 confidence', async () => {
      const pattern: LearningPattern = {
        category: 'strength',
        observation: 'Definitely strong at math',
        confidence: 1,
        source: 'observed',
      };

      await recordLearningPattern(pattern);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'hyro-agent',
        expect.stringContaining('Confidence: 100%'),
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // Server-Only Guard Tests
  // ==========================================================================

  describe('Server-Only Guard', () => {
    it('should call ensureServerOnly on module load', () => {
      const { ensureServerOnly } = require('../../../lib/server-only-guard');

      expect(ensureServerOnly).toHaveBeenCalledWith('lib/hyro/education-memory');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should propagate search errors', async () => {
      mockSearchAgentMemory.mockRejectedValueOnce(new Error('Search failed'));

      await expect(searchEducationMemory('test')).rejects.toThrow('Search failed');
    });

    it('should propagate add errors', async () => {
      mockAddAgentMemory.mockRejectedValueOnce(new Error('Add failed'));

      await expect(addEducationMemory('test', 'note')).rejects.toThrow('Add failed');
    });
  });
});
