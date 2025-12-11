// @ts-nocheck
/**
 * Tests for Education Data Store
 *
 * Tests SQLite-based storage for education data including:
 * - Assignments CRUD and filtering
 * - Lesson Plans CRUD
 * - Weekly Schedules
 * - Platform Credentials
 * - Sync Logs
 * - Standards and Concepts
 * - Standard Mastery tracking
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-id-12345678'),
  })),
}));

// Mock database
const mockStatement = {
  run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  get: jest.fn(),
  all: jest.fn(() => []),
};

const mockDb = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => mockStatement),
  close: jest.fn(),
};

jest.mock('better-sqlite3', () => {
  return jest.fn(() => mockDb);
});

// Import after mocks
import {
  createAssignment,
  updateAssignment,
  getAssignment,
  getAssignmentByPlatformId,
  listAssignments,
  deleteAssignment,
  createLessonPlan,
  updateLessonPlan,
  getLessonPlan,
  listLessonPlans,
  upsertWeeklySchedule,
  getWeeklySchedule,
  upsertPlatformCredentials,
  getPlatformCredentials,
  recordSyncLog,
  getLastSyncLog,
  getUpcomingAssignments,
  getOverdueAssignments,
  getWeeklyLessonPlans,
  getAssignmentStats,
  upsertConcept,
  getConcept,
  linkStandardToConcept,
  getConceptsForStandard,
  upsertStandard,
  getStandard,
  getAllStandards,
  getStandardMastery,
  updateStandardMastery,
  getAllStandardMastery,
  type Assignment,
  type AssignmentStatus,
  type AssignmentPlatform,
  type SubjectArea,
  type LessonPlan,
  type LessonActivity,
  type LessonResource,
  type WeeklySchedule,
  type DaySchedule,
  type ScheduleBlock,
  type PlatformCredentials,
  type SyncLog,
  type Standard,
  type StandardMastery,
  type Concept,
  type StandardConcept,
} from '../../../lib/hyro/education-store';

describe('Education Data Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatement.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockStatement.get.mockReturnValue(undefined);
    mockStatement.all.mockReturnValue([]);
  });

  // ==========================================================================
  // Type Definitions Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    describe('AssignmentStatus', () => {
      it('should accept valid status values', () => {
        const statuses: AssignmentStatus[] = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'];
        expect(statuses).toHaveLength(5);
      });
    });

    describe('AssignmentPlatform', () => {
      it('should accept valid platform values', () => {
        const platforms: AssignmentPlatform[] = [
          'canyon_grove', 'google_classroom', 'canvas', 'lexia', 'zearn', 'manual', 'other'
        ];
        expect(platforms).toHaveLength(7);
      });
    });

    describe('SubjectArea', () => {
      it('should accept valid subject values', () => {
        const subjects: SubjectArea[] = [
          'math', 'reading', 'writing', 'science', 'social_studies', 'art', 'music', 'pe', 'other'
        ];
        expect(subjects).toHaveLength(9);
      });
    });

    describe('Assignment interface', () => {
      it('should create valid assignment object', () => {
        const assignment: Assignment = {
          id: 'assign-123',
          platform: 'canyon_grove',
          platform_id: 'ext-456',
          student_id: 'student-1',
          subject: 'math',
          title: 'Math Chapter 5',
          description: 'Complete exercises 1-10',
          due_date: 1735689600,
          assigned_date: 1735603200,
          status: 'pending',
          score: undefined,
          max_score: 100,
          url: 'https://example.com/assignment',
          notes: 'Focus on fractions',
          created_at: 1735600000,
          updated_at: 1735600000,
          synced_at: 1735600000,
        };

        expect(assignment.id).toBe('assign-123');
        expect(assignment.platform).toBe('canyon_grove');
        expect(assignment.status).toBe('pending');
      });

      it('should allow minimal assignment with required fields only', () => {
        const assignment: Assignment = {
          id: 'assign-min',
          platform: 'manual',
          student_id: 'student-1',
          subject: 'reading',
          title: 'Read Book',
          status: 'pending',
          created_at: 1735600000,
          updated_at: 1735600000,
        };

        expect(assignment.description).toBeUndefined();
        expect(assignment.due_date).toBeUndefined();
      });
    });

    describe('LessonPlan interface', () => {
      it('should create valid lesson plan object', () => {
        const plan: LessonPlan = {
          id: 'plan-123',
          student_id: 'student-1',
          subject: 'science',
          topic: 'Photosynthesis',
          objectives: ['Understand the process', 'Identify key components'],
          activities: [
            { name: 'Introduction', duration_minutes: 10, type: 'instruction' },
            { name: 'Lab Activity', duration_minutes: 30, type: 'practice' },
          ],
          duration_minutes: 45,
          scheduled_date: '2025-01-20',
          scheduled_time: '09:00',
          status: 'scheduled',
          resources: [{ title: 'Textbook Ch. 4', type: 'book' }],
          notes: 'Prepare lab materials',
          effectiveness_rating: 4,
          feedback: 'Students engaged well',
          created_at: 1735600000,
          updated_at: 1735600000,
        };

        expect(plan.objectives).toHaveLength(2);
        expect(plan.activities).toHaveLength(2);
        expect(plan.status).toBe('scheduled');
      });
    });

    describe('LessonActivity interface', () => {
      it('should create valid activity objects', () => {
        const activities: LessonActivity[] = [
          { name: 'Warm-up', duration_minutes: 5, type: 'instruction' },
          { name: 'Practice', duration_minutes: 20, type: 'practice' },
          { name: 'Quiz', duration_minutes: 10, type: 'assessment' },
          { name: 'Group Talk', duration_minutes: 15, type: 'discussion' },
          { name: 'Build Model', duration_minutes: 30, type: 'project' },
          { name: 'Learning Game', duration_minutes: 20, type: 'game' },
          { name: 'Snack Time', duration_minutes: 10, type: 'break' },
        ];

        expect(activities).toHaveLength(7);
        activities.forEach(a => expect(a.duration_minutes).toBeGreaterThan(0));
      });

      it('should allow optional fields', () => {
        const activity: LessonActivity = {
          name: 'Main Lesson',
          duration_minutes: 30,
          type: 'instruction',
          description: 'Teach core concepts',
          materials: ['Whiteboard', 'Markers', 'Handouts'],
        };

        expect(activity.description).toBeDefined();
        expect(activity.materials).toHaveLength(3);
      });
    });

    describe('WeeklySchedule interface', () => {
      it('should create valid weekly schedule', () => {
        const schedule: WeeklySchedule = {
          id: 'sched-123',
          student_id: 'student-1',
          week_start: '2025-01-20',
          schedule: [
            {
              day: 'monday',
              blocks: [
                { start_time: '09:00', end_time: '10:00', subject: 'math' },
              ],
            },
          ],
          notes: 'Test week',
          created_at: 1735600000,
          updated_at: 1735600000,
        };

        expect(schedule.schedule).toHaveLength(1);
        expect(schedule.week_start).toBe('2025-01-20');
      });
    });

    describe('PlatformCredentials interface', () => {
      it('should create valid credentials object', () => {
        const creds: PlatformCredentials = {
          platform: 'canyon_grove',
          username: 'user@example.com',
          encrypted_password: 'encrypted-data',
          cookies: '{"session":"abc123"}',
          last_login_at: 1735600000,
          status: 'active',
          error_message: undefined,
        };

        expect(creds.status).toBe('active');
        expect(creds.platform).toBe('canyon_grove');
      });

      it('should handle error state', () => {
        const creds: PlatformCredentials = {
          platform: 'google_classroom',
          status: 'error',
          error_message: 'Authentication failed',
        };

        expect(creds.status).toBe('error');
        expect(creds.error_message).toBeDefined();
      });
    });

    describe('SyncLog interface', () => {
      it('should create valid sync log', () => {
        const log: SyncLog = {
          id: 'sync-123',
          platform: 'canvas',
          student_id: 'student-1',
          success: true,
          assignments_found: 15,
          assignments_new: 5,
          assignments_updated: 3,
          synced_at: 1735600000,
        };

        expect(log.success).toBe(true);
        expect(log.assignments_found).toBe(15);
      });

      it('should handle failed sync', () => {
        const log: SyncLog = {
          id: 'sync-fail',
          platform: 'lexia',
          student_id: 'student-1',
          success: false,
          assignments_found: 0,
          assignments_new: 0,
          assignments_updated: 0,
          error: 'Network timeout',
          synced_at: 1735600000,
        };

        expect(log.success).toBe(false);
        expect(log.error).toBeDefined();
      });
    });

    describe('Standard interface', () => {
      it('should create valid standard', () => {
        const standard: Standard = {
          id: '3.NBT.A.1',
          category: 'math',
          domain: 'Number and Operations in Base Ten',
          description: 'Use place value understanding to round whole numbers',
          prerequisites: ['2.NBT.A.1', '2.NBT.A.3'],
          cluster: 'Use place value understanding',
        };

        expect(standard.prerequisites).toHaveLength(2);
        expect(standard.domain).toContain('Base Ten');
      });
    });

    describe('StandardMastery interface', () => {
      it('should create valid mastery record', () => {
        const mastery: StandardMastery = {
          student_id: 'student-1',
          standard_id: '3.NBT.A.1',
          mastery_level: 75,
          evidence_count: 12,
          last_practiced_at: 1735600000,
          status: 'practicing',
          confidence_score: 0.85,
        };

        expect(mastery.mastery_level).toBe(75);
        expect(mastery.status).toBe('practicing');
      });

      it('should accept all status values', () => {
        const statuses: StandardMastery['status'][] = ['locked', 'unlocked', 'practicing', 'mastered'];
        expect(statuses).toHaveLength(4);
      });
    });

    describe('Concept interface', () => {
      it('should create valid concept', () => {
        const concept: Concept = {
          id: 'ratio',
          name: 'Ratio',
          definition: 'A comparison of two quantities',
          discipline: 'math',
          layer: 'fundamental',
        };

        expect(concept.layer).toBe('fundamental');
      });

      it('should accept all layer values', () => {
        const layers: Concept['layer'][] = ['fundamental', 'derived', 'heuristic'];
        expect(layers).toHaveLength(3);
      });
    });

    describe('StandardConcept interface', () => {
      it('should create valid link', () => {
        const link: StandardConcept = {
          standard_id: '3.NBT.A.1',
          concept_id: 'place-value',
          authenticity_layer: 'direct',
          notes: 'Core concept',
        };

        expect(link.authenticity_layer).toBe('direct');
      });

      it('should accept all authenticity layers', () => {
        const layers: StandardConcept['authenticity_layer'][] = ['direct', 'approximation', 'special_case'];
        expect(layers).toHaveLength(3);
      });
    });
  });

  // ==========================================================================
  // Assignment CRUD Tests
  // ==========================================================================

  describe('Assignment CRUD', () => {
    describe('createAssignment', () => {
      it('should create assignment with generated id and timestamps', () => {
        const input = {
          platform: 'canyon_grove' as AssignmentPlatform,
          student_id: 'student-1',
          subject: 'math' as SubjectArea,
          title: 'Math Homework',
          status: 'pending' as AssignmentStatus,
        };

        const result = createAssignment(input);

        expect(result.id).toBe('mock-id-12345678');
        expect(result.platform).toBe('canyon_grove');
        expect(result.created_at).toBeDefined();
        expect(result.updated_at).toBeDefined();
        expect(mockStatement.run).toHaveBeenCalled();
        expect(mockDb.close).toHaveBeenCalled();
      });

      it('should handle all optional fields', () => {
        const input = {
          platform: 'canvas' as AssignmentPlatform,
          platform_id: 'ext-123',
          student_id: 'student-1',
          subject: 'science' as SubjectArea,
          title: 'Lab Report',
          description: 'Write up experiment results',
          due_date: 1735689600,
          assigned_date: 1735603200,
          status: 'pending' as AssignmentStatus,
          max_score: 100,
          url: 'https://canvas.com/assignment/123',
          notes: 'Include diagrams',
        };

        const result = createAssignment(input);

        expect(result.description).toBe('Write up experiment results');
        expect(result.platform_id).toBe('ext-123');
      });
    });

    describe('getAssignment', () => {
      it('should return assignment when found', () => {
        const mockRow = {
          id: 'assign-123',
          platform: 'manual',
          student_id: 'student-1',
          subject: 'reading',
          title: 'Read Chapter',
          status: 'pending',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getAssignment('assign-123');

        expect(result).toEqual(mockRow);
        expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM assignments WHERE id = ?');
      });

      it('should return null when not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getAssignment('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getAssignmentByPlatformId', () => {
      it('should return assignment by platform and external id', () => {
        const mockRow = {
          id: 'assign-123',
          platform: 'google_classroom',
          platform_id: 'gc-456',
          student_id: 'student-1',
          subject: 'math',
          title: 'Assignment',
          status: 'pending',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getAssignmentByPlatformId('google_classroom', 'gc-456');

        expect(result).toEqual(mockRow);
        expect(mockDb.prepare).toHaveBeenCalledWith(
          'SELECT * FROM assignments WHERE platform = ? AND platform_id = ?'
        );
      });
    });

    describe('updateAssignment', () => {
      it('should update assignment and return merged result', () => {
        const existing = {
          id: 'assign-123',
          platform: 'manual',
          student_id: 'student-1',
          subject: 'math',
          title: 'Original Title',
          status: 'pending',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(existing);

        const result = updateAssignment('assign-123', {
          title: 'Updated Title',
          status: 'completed',
        });

        expect(result).not.toBeNull();
        expect(result!.title).toBe('Updated Title');
        expect(result!.status).toBe('completed');
        expect(result!.created_at).toBe(existing.created_at);
      });

      it('should return null if assignment not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = updateAssignment('nonexistent', { title: 'New' });

        expect(result).toBeNull();
      });
    });

    describe('listAssignments', () => {
      it('should list all assignments without filters', () => {
        const mockRows = [
          { id: 'a1', title: 'Assignment 1' },
          { id: 'a2', title: 'Assignment 2' },
        ];
        mockStatement.all.mockReturnValueOnce(mockRows);

        const result = listAssignments();

        expect(result).toEqual(mockRows);
      });

      it('should apply student_id filter', () => {
        mockStatement.all.mockReturnValueOnce([]);

        listAssignments({ student_id: 'student-1' });

        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should apply multiple filters', () => {
        mockStatement.all.mockReturnValueOnce([]);

        listAssignments({
          student_id: 'student-1',
          platform: 'canvas',
          status: 'pending',
          subject: 'math',
        });

        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should apply date filters', () => {
        mockStatement.all.mockReturnValueOnce([]);

        listAssignments({
          due_before: 1735700000,
          due_after: 1735600000,
        });

        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should apply limit and offset', () => {
        mockStatement.all.mockReturnValueOnce([]);

        listAssignments({ limit: 10, offset: 20 });

        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });

    describe('deleteAssignment', () => {
      it('should delete assignment and return true', () => {
        mockStatement.run.mockReturnValueOnce({ changes: 1 });

        const result = deleteAssignment('assign-123');

        expect(result).toBe(true);
        expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM assignments WHERE id = ?');
      });

      it('should return false if not found', () => {
        mockStatement.run.mockReturnValueOnce({ changes: 0 });

        const result = deleteAssignment('nonexistent');

        expect(result).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Lesson Plan CRUD Tests
  // ==========================================================================

  describe('Lesson Plan CRUD', () => {
    describe('createLessonPlan', () => {
      it('should create lesson plan with JSON fields', () => {
        const input = {
          student_id: 'student-1',
          subject: 'science' as SubjectArea,
          topic: 'Water Cycle',
          objectives: ['Understand evaporation', 'Explain condensation'],
          activities: [
            { name: 'Video', duration_minutes: 15, type: 'instruction' as const },
          ],
          duration_minutes: 45,
          status: 'draft' as const,
        };

        const result = createLessonPlan(input);

        expect(result.id).toBe('mock-id-12345678');
        expect(result.objectives).toEqual(input.objectives);
        expect(result.activities).toEqual(input.activities);
        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe('getLessonPlan', () => {
      it('should parse JSON fields when retrieving', () => {
        const mockRow = {
          id: 'plan-123',
          student_id: 'student-1',
          subject: 'math',
          topic: 'Fractions',
          objectives: '["Learn fractions"]',
          activities: '[{"name":"Practice","duration_minutes":20,"type":"practice"}]',
          resources: '[]',
          duration_minutes: 30,
          status: 'scheduled',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getLessonPlan('plan-123');

        expect(result).not.toBeNull();
        expect(result!.objectives).toEqual(['Learn fractions']);
        expect(result!.activities).toHaveLength(1);
      });

      it('should return null if not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getLessonPlan('nonexistent');

        expect(result).toBeNull();
      });

      it('should handle null resources', () => {
        const mockRow = {
          id: 'plan-123',
          student_id: 'student-1',
          subject: 'reading',
          topic: 'Poetry',
          objectives: '[]',
          activities: '[]',
          resources: null,
          duration_minutes: 30,
          status: 'draft',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getLessonPlan('plan-123');

        expect(result!.resources).toBeUndefined();
      });
    });

    describe('updateLessonPlan', () => {
      it('should update and merge fields', () => {
        const mockRow = {
          id: 'plan-123',
          student_id: 'student-1',
          subject: 'math',
          topic: 'Original Topic',
          objectives: '["obj1"]',
          activities: '[]',
          resources: null,
          duration_minutes: 30,
          status: 'draft',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = updateLessonPlan('plan-123', {
          topic: 'Updated Topic',
          status: 'scheduled',
        });

        expect(result).not.toBeNull();
        expect(result!.topic).toBe('Updated Topic');
        expect(result!.status).toBe('scheduled');
      });

      it('should return null if plan not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = updateLessonPlan('nonexistent', { topic: 'New' });

        expect(result).toBeNull();
      });
    });

    describe('listLessonPlans', () => {
      it('should list with filters and parse JSON', () => {
        const mockRows = [
          {
            id: 'plan-1',
            student_id: 'student-1',
            subject: 'math',
            topic: 'Topic 1',
            objectives: '["o1"]',
            activities: '[]',
            resources: null,
            duration_minutes: 30,
            status: 'scheduled',
            scheduled_date: '2025-01-20',
            created_at: 1735600000,
            updated_at: 1735600000,
          },
        ];
        mockStatement.all.mockReturnValueOnce(mockRows);

        const result = listLessonPlans({ student_id: 'student-1', subject: 'math' });

        expect(result).toHaveLength(1);
        expect(result[0].objectives).toEqual(['o1']);
      });

      it('should apply date range filters', () => {
        mockStatement.all.mockReturnValueOnce([]);

        listLessonPlans({
          scheduled_after: '2025-01-01',
          scheduled_before: '2025-01-31',
        });

        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Weekly Schedule Tests
  // ==========================================================================

  describe('Weekly Schedule', () => {
    describe('upsertWeeklySchedule', () => {
      it('should create new schedule if not exists', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const input = {
          student_id: 'student-1',
          week_start: '2025-01-20',
          schedule: [
            {
              day: 'monday' as const,
              blocks: [
                { start_time: '09:00', end_time: '10:00', subject: 'math' as SubjectArea },
              ],
            },
          ],
        };

        const result = upsertWeeklySchedule(input);

        expect(result.id).toBe('mock-id-12345678');
        expect(result.schedule).toEqual(input.schedule);
      });

      it('should update existing schedule', () => {
        const existing = {
          id: 'sched-existing',
          student_id: 'student-1',
          week_start: '2025-01-20',
          schedule: '[]',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(existing);

        const input = {
          student_id: 'student-1',
          week_start: '2025-01-20',
          schedule: [
            {
              day: 'tuesday' as const,
              blocks: [
                { start_time: '10:00', end_time: '11:00', subject: 'reading' as SubjectArea },
              ],
            },
          ],
        };

        const result = upsertWeeklySchedule(input);

        expect(result.id).toBe('sched-existing');
        expect(result.schedule).toEqual(input.schedule);
      });
    });

    describe('getWeeklySchedule', () => {
      it('should return schedule with parsed JSON', () => {
        const mockRow = {
          id: 'sched-123',
          student_id: 'student-1',
          week_start: '2025-01-20',
          schedule: '[{"day":"monday","blocks":[]}]',
          created_at: 1735600000,
          updated_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getWeeklySchedule('student-1', '2025-01-20');

        expect(result).not.toBeNull();
        expect(result!.schedule).toHaveLength(1);
        expect(result!.schedule[0].day).toBe('monday');
      });

      it('should return null if not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getWeeklySchedule('student-1', '2025-01-20');

        expect(result).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Platform Credentials Tests
  // ==========================================================================

  describe('Platform Credentials', () => {
    describe('upsertPlatformCredentials', () => {
      it('should upsert credentials', () => {
        const creds: PlatformCredentials = {
          platform: 'canyon_grove',
          username: 'user@example.com',
          encrypted_password: 'encrypted',
          status: 'active',
        };

        upsertPlatformCredentials(creds);

        expect(mockStatement.run).toHaveBeenCalled();
        expect(mockDb.close).toHaveBeenCalled();
      });
    });

    describe('getPlatformCredentials', () => {
      it('should return credentials when found', () => {
        const mockCreds = {
          platform: 'google_classroom',
          username: 'user@gmail.com',
          status: 'active',
        };
        mockStatement.get.mockReturnValueOnce(mockCreds);

        const result = getPlatformCredentials('google_classroom');

        expect(result).toEqual(mockCreds);
      });

      it('should return null when not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getPlatformCredentials('canvas');

        expect(result).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Sync Log Tests
  // ==========================================================================

  describe('Sync Logs', () => {
    describe('recordSyncLog', () => {
      it('should record sync log with id', () => {
        const log = {
          platform: 'lexia' as AssignmentPlatform,
          student_id: 'student-1',
          success: true,
          assignments_found: 10,
          assignments_new: 3,
          assignments_updated: 2,
          synced_at: 1735600000,
        };

        const result = recordSyncLog(log);

        expect(result.id).toBe('mock-id-12345678');
        expect(result.success).toBe(true);
        expect(mockStatement.run).toHaveBeenCalled();
      });

      it('should handle failed sync with error', () => {
        const log = {
          platform: 'zearn' as AssignmentPlatform,
          student_id: 'student-1',
          success: false,
          assignments_found: 0,
          assignments_new: 0,
          assignments_updated: 0,
          error: 'Connection failed',
          synced_at: 1735600000,
        };

        const result = recordSyncLog(log);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection failed');
      });
    });

    describe('getLastSyncLog', () => {
      it('should return most recent sync log', () => {
        const mockRow = {
          id: 'sync-123',
          platform: 'canyon_grove',
          student_id: 'student-1',
          success: 1, // SQLite stores as integer
          assignments_found: 5,
          assignments_new: 2,
          assignments_updated: 1,
          synced_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getLastSyncLog('canyon_grove', 'student-1');

        expect(result).not.toBeNull();
        expect(result!.success).toBe(true); // Should convert to boolean
      });

      it('should convert success to boolean', () => {
        const mockRow = {
          id: 'sync-fail',
          platform: 'canvas',
          student_id: 'student-1',
          success: 0,
          assignments_found: 0,
          assignments_new: 0,
          assignments_updated: 0,
          error: 'Failed',
          synced_at: 1735600000,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getLastSyncLog('canvas', 'student-1');

        expect(result!.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe('Convenience Functions', () => {
    describe('getUpcomingAssignments', () => {
      it('should get assignments due within specified days', () => {
        mockStatement.all.mockReturnValueOnce([
          { id: 'a1', title: 'Due Soon' },
        ]);

        const result = getUpcomingAssignments('student-1', 7);

        expect(result).toHaveLength(1);
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should default to 7 days', () => {
        mockStatement.all.mockReturnValueOnce([]);

        getUpcomingAssignments('student-1');

        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });

    describe('getOverdueAssignments', () => {
      it('should get pending assignments past due date', () => {
        mockStatement.all.mockReturnValueOnce([
          { id: 'a1', title: 'Overdue' },
          { id: 'a2', title: 'Also Overdue' },
        ]);

        const result = getOverdueAssignments('student-1');

        expect(result).toHaveLength(2);
      });
    });

    describe('getWeeklyLessonPlans', () => {
      it('should get lesson plans for a week', () => {
        mockStatement.all.mockReturnValueOnce([
          {
            id: 'p1',
            objectives: '[]',
            activities: '[]',
            resources: null,
          },
        ]);

        const result = getWeeklyLessonPlans('student-1', '2025-01-20');

        expect(result).toHaveLength(1);
      });
    });

    describe('getAssignmentStats', () => {
      it('should return comprehensive statistics', () => {
        // Mock all the count queries
        mockStatement.get
          .mockReturnValueOnce({ count: 50 }) // total
          .mockReturnValueOnce({ count: 20 }) // pending
          .mockReturnValueOnce({ count: 25 }) // completed
          .mockReturnValueOnce({ count: 5 }); // overdue

        mockStatement.all
          .mockReturnValueOnce([
            { subject: 'math', count: 20 },
            { subject: 'reading', count: 15 },
          ]) // by subject
          .mockReturnValueOnce([
            { platform: 'canyon_grove', count: 30 },
            { platform: 'manual', count: 20 },
          ]); // by platform

        const result = getAssignmentStats('student-1');

        expect(result.total).toBe(50);
        expect(result.pending).toBe(20);
        expect(result.completed).toBe(25);
        expect(result.overdue).toBe(5);
        expect(result.by_subject.math).toBe(20);
        expect(result.by_platform.canyon_grove).toBe(30);
        expect(result.completion_rate).toBe(0.5); // 25/50
      });

      it('should handle zero total assignments', () => {
        mockStatement.get
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 })
          .mockReturnValueOnce({ count: 0 });
        mockStatement.all
          .mockReturnValueOnce([])
          .mockReturnValueOnce([]);

        const result = getAssignmentStats('student-1');

        expect(result.total).toBe(0);
        expect(result.completion_rate).toBe(0);
      });
    });
  });

  // ==========================================================================
  // Concepts and Standards Tests
  // ==========================================================================

  describe('Concepts Ontology', () => {
    describe('upsertConcept', () => {
      it('should upsert concept', () => {
        const concept: Concept = {
          id: 'ratio',
          name: 'Ratio',
          definition: 'A comparison of two quantities',
          discipline: 'math',
          layer: 'fundamental',
        };

        upsertConcept(concept);

        expect(mockStatement.run).toHaveBeenCalled();
        expect(mockDb.close).toHaveBeenCalled();
      });
    });

    describe('getConcept', () => {
      it('should return concept when found', () => {
        const mockConcept = {
          id: 'proportion',
          name: 'Proportion',
          definition: 'An equality between two ratios',
          layer: 'derived',
        };
        mockStatement.get.mockReturnValueOnce(mockConcept);

        const result = getConcept('proportion');

        expect(result).toEqual(mockConcept);
      });

      it('should return null when not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getConcept('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('linkStandardToConcept', () => {
      it('should create link between standard and concept', () => {
        const link: StandardConcept = {
          standard_id: '3.NBT.A.1',
          concept_id: 'place-value',
          authenticity_layer: 'direct',
          notes: 'Core concept',
        };

        linkStandardToConcept(link);

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe('getConceptsForStandard', () => {
      it('should return concepts with hydrated data', () => {
        const mockRows = [
          {
            standard_id: '3.NBT.A.1',
            concept_id: 'place-value',
            authenticity_layer: 'direct',
            notes: null,
            concept_name: 'Place Value',
            concept_def: 'Value of digit based on position',
            concept_layer: 'fundamental',
            discipline: 'math',
          },
        ];
        mockStatement.all.mockReturnValueOnce(mockRows);

        const result = getConceptsForStandard('3.NBT.A.1');

        expect(result).toHaveLength(1);
        expect(result[0].concept).toBeDefined();
        expect(result[0].concept!.name).toBe('Place Value');
      });
    });
  });

  // ==========================================================================
  // Standards Engine Tests
  // ==========================================================================

  describe('Standards Engine', () => {
    describe('upsertStandard', () => {
      it('should upsert standard with JSON prerequisites', () => {
        const standard: Standard = {
          id: '3.OA.A.1',
          category: 'math',
          domain: 'Operations and Algebraic Thinking',
          description: 'Interpret products of whole numbers',
          prerequisites: ['2.OA.A.1', '2.NBT.B.5'],
          cluster: 'Represent and solve problems',
        };

        upsertStandard(standard);

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe('getStandard', () => {
      it('should return standard with parsed prerequisites', () => {
        const mockRow = {
          id: '3.OA.A.1',
          category: 'math',
          domain: 'OAT',
          description: 'Test standard',
          prerequisites: '["2.OA.A.1"]',
          cluster: null,
        };
        mockStatement.get.mockReturnValueOnce(mockRow);

        const result = getStandard('3.OA.A.1');

        expect(result).not.toBeNull();
        expect(result!.prerequisites).toEqual(['2.OA.A.1']);
      });

      it('should return null when not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getStandard('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getAllStandards', () => {
      it('should return all standards with parsed prerequisites', () => {
        const mockRows = [
          { id: 's1', prerequisites: '[]' },
          { id: 's2', prerequisites: '["s1"]' },
        ];
        mockStatement.all.mockReturnValueOnce(mockRows);

        const result = getAllStandards();

        expect(result).toHaveLength(2);
        expect(result[1].prerequisites).toEqual(['s1']);
      });
    });
  });

  // ==========================================================================
  // Standard Mastery Tests
  // ==========================================================================

  describe('Standard Mastery', () => {
    describe('getStandardMastery', () => {
      it('should return mastery record when found', () => {
        const mockMastery = {
          student_id: 'student-1',
          standard_id: '3.OA.A.1',
          mastery_level: 80,
          evidence_count: 15,
          status: 'practicing',
          confidence_score: 0.9,
        };
        mockStatement.get.mockReturnValueOnce(mockMastery);

        const result = getStandardMastery('student-1', '3.OA.A.1');

        expect(result).toEqual(mockMastery);
      });

      it('should return null when not found', () => {
        mockStatement.get.mockReturnValueOnce(undefined);

        const result = getStandardMastery('student-1', 'nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('updateStandardMastery', () => {
      it('should upsert mastery record', () => {
        const mastery: StandardMastery = {
          student_id: 'student-1',
          standard_id: '3.NBT.A.1',
          mastery_level: 75,
          evidence_count: 12,
          last_practiced_at: 1735600000,
          status: 'practicing',
          confidence_score: 0.85,
        };

        updateStandardMastery(mastery);

        expect(mockStatement.run).toHaveBeenCalled();
      });

      it('should handle null last_practiced_at', () => {
        const mastery: StandardMastery = {
          student_id: 'student-1',
          standard_id: '3.NBT.A.1',
          mastery_level: 0,
          evidence_count: 0,
          status: 'locked',
          confidence_score: 0,
        };

        updateStandardMastery(mastery);

        expect(mockStatement.run).toHaveBeenCalled();
      });
    });

    describe('getAllStandardMastery', () => {
      it('should return all mastery records for student', () => {
        const mockRows = [
          { student_id: 'student-1', standard_id: 's1', mastery_level: 50 },
          { student_id: 'student-1', standard_id: 's2', mastery_level: 75 },
        ];
        mockStatement.all.mockReturnValueOnce(mockRows);

        const result = getAllStandardMastery('student-1');

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // Database Connection Tests
  // ==========================================================================

  describe('Database Connection', () => {
    it('should create db directory if needed', () => {
      const fs = require('fs');

      createAssignment({
        platform: 'manual',
        student_id: 's1',
        subject: 'math',
        title: 'Test',
        status: 'pending',
      });

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should set WAL journal mode', () => {
      createAssignment({
        platform: 'manual',
        student_id: 's1',
        subject: 'math',
        title: 'Test',
        status: 'pending',
      });

      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should close db after each operation', () => {
      getAssignment('test-id');

      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty arrays in JSON fields', () => {
      const mockRow = {
        id: 'plan-empty',
        student_id: 'student-1',
        subject: 'math',
        topic: 'Empty Plan',
        objectives: '[]',
        activities: '[]',
        resources: '[]',
        duration_minutes: 0,
        status: 'draft',
        created_at: 1735600000,
        updated_at: 1735600000,
      };
      mockStatement.get.mockReturnValueOnce(mockRow);

      const result = getLessonPlan('plan-empty');

      expect(result!.objectives).toEqual([]);
      expect(result!.activities).toEqual([]);
    });

    it('should handle special characters in text fields', () => {
      const input = {
        platform: 'manual' as AssignmentPlatform,
        student_id: 'student-1',
        subject: 'reading' as SubjectArea,
        title: 'Test "quotes" & <special> chars',
        description: "It's a test with 'single quotes'",
        status: 'pending' as AssignmentStatus,
      };

      const result = createAssignment(input);

      expect(result.title).toBe('Test "quotes" & <special> chars');
    });

    it('should handle very long text content', () => {
      const longDescription = 'A'.repeat(10000);
      const input = {
        platform: 'manual' as AssignmentPlatform,
        student_id: 'student-1',
        subject: 'writing' as SubjectArea,
        title: 'Long Assignment',
        description: longDescription,
        status: 'pending' as AssignmentStatus,
      };

      const result = createAssignment(input);

      expect(result.description).toBe(longDescription);
    });

    it('should handle Unicode content', () => {
      const input = {
        platform: 'manual' as AssignmentPlatform,
        student_id: 'student-1',
        subject: 'reading' as SubjectArea,
        title: 'Learn Japanese: ',
        description: '',
        status: 'pending' as AssignmentStatus,
      };

      const result = createAssignment(input);

      expect(result.title).toContain('');
    });
  });

  // ==========================================================================
  // Server-Only Guard Tests
  // ==========================================================================

  describe('Server-Only Guard', () => {
    it('should call ensureServerOnly on module load', () => {
      const { ensureServerOnly } = require('../../../lib/server-only-guard');

      expect(ensureServerOnly).toHaveBeenCalledWith('lib/hyro/education-store');
    });
  });
});
