import { NextRequest, NextResponse } from 'next/server';
import {
  listAssignments,
  createAssignment,
  updateAssignment,
  getAssignment,
  deleteAssignment,
  listLessonPlans,
  createLessonPlan,
  updateLessonPlan,
  getLessonPlan,
  getWeeklySchedule,
  upsertWeeklySchedule,
  getUpcomingAssignments,
  getOverdueAssignments,
  getAssignmentStats,
  type Assignment,
  type LessonPlan,
} from '@/lib/hyro/education-store';
import {
  searchEducationMemory,
  getLessonPlanningContext,
  getWeeklyContext,
  recordLessonPlan as recordLessonPlanToMemory,
  learnFromFeedback,
} from '@/lib/hyro/education-memory';
import {
  syncPlatformAssignments,
  getPlatformStatus,
  getConfiguredPlatforms,
  isPlatformConfigured,
  type PlatformType,
} from '@/lib/hyro/education-scraper';

/**
 * Education API
 *
 * GET /api/hyro/education?action=...
 *   - assignments: List assignments (with filters)
 *   - lesson-plans: List lesson plans
 *   - upcoming: Get upcoming assignments
 *   - overdue: Get overdue assignments
 *   - stats: Get assignment statistics
 *   - weekly-schedule: Get weekly schedule
 *   - memory-search: Search education memories
 *   - lesson-context: Get context for lesson planning
 *
 * POST /api/hyro/education
 *   - create-assignment: Create new assignment
 *   - update-assignment: Update existing assignment
 *   - delete-assignment: Delete assignment
 *   - create-lesson-plan: Create lesson plan
 *   - update-lesson-plan: Update lesson plan
 *   - save-weekly-schedule: Save weekly schedule
 *   - record-feedback: Record lesson feedback
 */

const DEFAULT_STUDENT_ID = 'hyro';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'assignments';
    const studentId = searchParams.get('studentId') || DEFAULT_STUDENT_ID;

    switch (action) {
      case 'assignments': {
        const status = searchParams.get('status') as any;
        const subject = searchParams.get('subject') as any;
        const platform = searchParams.get('platform') as any;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

        const assignments = listAssignments({
          student_id: studentId,
          status,
          subject,
          platform,
          limit,
        });

        return NextResponse.json({
          action: 'assignments',
          studentId,
          count: assignments.length,
          assignments,
          timestamp: new Date().toISOString(),
        });
      }

      case 'lesson-plans': {
        const status = searchParams.get('status') as any;
        const subject = searchParams.get('subject') as any;
        const scheduledAfter = searchParams.get('scheduledAfter') || undefined;
        const scheduledBefore = searchParams.get('scheduledBefore') || undefined;

        const plans = listLessonPlans({
          student_id: studentId,
          status,
          subject,
          scheduled_after: scheduledAfter,
          scheduled_before: scheduledBefore,
        });

        return NextResponse.json({
          action: 'lesson-plans',
          studentId,
          count: plans.length,
          lessonPlans: plans,
          timestamp: new Date().toISOString(),
        });
      }

      case 'upcoming': {
        const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 7;
        const assignments = getUpcomingAssignments(studentId, days);

        return NextResponse.json({
          action: 'upcoming',
          studentId,
          days,
          count: assignments.length,
          assignments,
          timestamp: new Date().toISOString(),
        });
      }

      case 'overdue': {
        const assignments = getOverdueAssignments(studentId);

        return NextResponse.json({
          action: 'overdue',
          studentId,
          count: assignments.length,
          assignments,
          timestamp: new Date().toISOString(),
        });
      }

      case 'stats': {
        const stats = getAssignmentStats(studentId);

        return NextResponse.json({
          action: 'stats',
          studentId,
          stats,
          timestamp: new Date().toISOString(),
        });
      }

      case 'weekly-schedule': {
        const weekStart = searchParams.get('weekStart');
        if (!weekStart) {
          // Default to current week (Monday)
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(now.setDate(diff));
          const defaultWeekStart = monday.toISOString().split('T')[0];

          const schedule = getWeeklySchedule(studentId, defaultWeekStart);
          return NextResponse.json({
            action: 'weekly-schedule',
            studentId,
            weekStart: defaultWeekStart,
            schedule,
            timestamp: new Date().toISOString(),
          });
        }

        const schedule = getWeeklySchedule(studentId, weekStart);
        return NextResponse.json({
          action: 'weekly-schedule',
          studentId,
          weekStart,
          schedule,
          timestamp: new Date().toISOString(),
        });
      }

      case 'memory-search': {
        const query = searchParams.get('query');
        if (!query) {
          return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
        }

        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
        const results = await searchEducationMemory(query, limit);

        return NextResponse.json({
          action: 'memory-search',
          query,
          count: results.length,
          results: results.map(r => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      case 'lesson-context': {
        const subject = searchParams.get('subject');
        const topic = searchParams.get('topic');
        if (!subject || !topic) {
          return NextResponse.json({ error: 'Missing subject or topic parameter' }, { status: 400 });
        }

        const context = await getLessonPlanningContext(subject, topic);

        return NextResponse.json({
          action: 'lesson-context',
          subject,
          topic,
          context,
          timestamp: new Date().toISOString(),
        });
      }

      case 'weekly-context': {
        const weekStart = searchParams.get('weekStart');
        const weekEnd = searchParams.get('weekEnd');
        if (!weekStart || !weekEnd) {
          return NextResponse.json({ error: 'Missing weekStart or weekEnd parameter' }, { status: 400 });
        }

        const context = await getWeeklyContext(weekStart, weekEnd);

        return NextResponse.json({
          action: 'weekly-context',
          weekStart,
          weekEnd,
          assignments: context.assignments.length,
          lessonPlans: context.lessonPlans.length,
          patterns: context.patterns.length,
          data: context,
          timestamp: new Date().toISOString(),
        });
      }

      case 'assignment': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const assignment = getAssignment(id);
        if (!assignment) {
          return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json({
          action: 'assignment',
          assignment,
          timestamp: new Date().toISOString(),
        });
      }

      case 'lesson-plan': {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const plan = getLessonPlan(id);
        if (!plan) {
          return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
        }

        return NextResponse.json({
          action: 'lesson-plan',
          lessonPlan: plan,
          timestamp: new Date().toISOString(),
        });
      }

      case 'platform-status': {
        const platform = searchParams.get('platform') as PlatformType | null;

        if (platform) {
          const status = getPlatformStatus(platform);
          return NextResponse.json({
            action: 'platform-status',
            platform,
            ...status,
            timestamp: new Date().toISOString(),
          });
        }

        // Return all platform statuses
        const platforms: PlatformType[] = ['canyon_grove', 'google_classroom', 'canvas', 'lexia', 'zearn'];
        const statuses = platforms.map(p => ({
          platform: p,
          ...getPlatformStatus(p),
        }));

        return NextResponse.json({
          action: 'platform-status',
          platforms: statuses,
          configured: getConfiguredPlatforms(),
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[EducationAPI] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get education data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const studentId = body.studentId || DEFAULT_STUDENT_ID;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'create-assignment': {
        const { platform, subject, title, description, dueDate, assignedDate, status, url } = body;

        if (!platform || !subject || !title) {
          return NextResponse.json(
            { error: 'Missing required fields: platform, subject, title' },
            { status: 400 }
          );
        }

        const assignment = createAssignment({
          platform,
          student_id: studentId,
          subject,
          title,
          description,
          due_date: dueDate ? Math.floor(new Date(dueDate).getTime() / 1000) : undefined,
          assigned_date: assignedDate ? Math.floor(new Date(assignedDate).getTime() / 1000) : undefined,
          status: status || 'pending',
          url,
        });

        return NextResponse.json({
          action: 'create-assignment',
          assignment,
          timestamp: new Date().toISOString(),
        });
      }

      case 'update-assignment': {
        const { id, ...updates } = body;
        if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        // Convert date strings to timestamps
        if (updates.dueDate) {
          updates.due_date = Math.floor(new Date(updates.dueDate).getTime() / 1000);
          delete updates.dueDate;
        }
        if (updates.assignedDate) {
          updates.assigned_date = Math.floor(new Date(updates.assignedDate).getTime() / 1000);
          delete updates.assignedDate;
        }

        const assignment = updateAssignment(id, updates);
        if (!assignment) {
          return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        return NextResponse.json({
          action: 'update-assignment',
          assignment,
          timestamp: new Date().toISOString(),
        });
      }

      case 'delete-assignment': {
        const { id } = body;
        if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const deleted = deleteAssignment(id);
        return NextResponse.json({
          action: 'delete-assignment',
          deleted,
          timestamp: new Date().toISOString(),
        });
      }

      case 'create-lesson-plan': {
        const { subject, topic, objectives, activities, durationMinutes, scheduledDate, scheduledTime, resources, notes } = body;

        if (!subject || !topic || !objectives || !activities || !durationMinutes) {
          return NextResponse.json(
            { error: 'Missing required fields: subject, topic, objectives, activities, durationMinutes' },
            { status: 400 }
          );
        }

        const plan = createLessonPlan({
          student_id: studentId,
          subject,
          topic,
          objectives,
          activities,
          duration_minutes: durationMinutes,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          status: 'draft',
          resources,
          notes,
        });

        // Record to memory
        await recordLessonPlanToMemory({
          id: plan.id,
          subject,
          topic,
          objectives,
          activities,
          duration: durationMinutes,
          status: 'draft',
          notes,
          resources,
        });

        return NextResponse.json({
          action: 'create-lesson-plan',
          lessonPlan: plan,
          timestamp: new Date().toISOString(),
        });
      }

      case 'update-lesson-plan': {
        const { id, ...updates } = body;
        if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        // Rename fields if needed
        if (updates.durationMinutes !== undefined) {
          updates.duration_minutes = updates.durationMinutes;
          delete updates.durationMinutes;
        }
        if (updates.scheduledDate !== undefined) {
          updates.scheduled_date = updates.scheduledDate;
          delete updates.scheduledDate;
        }
        if (updates.scheduledTime !== undefined) {
          updates.scheduled_time = updates.scheduledTime;
          delete updates.scheduledTime;
        }
        if (updates.effectivenessRating !== undefined) {
          updates.effectiveness_rating = updates.effectivenessRating;
          delete updates.effectivenessRating;
        }

        const plan = updateLessonPlan(id, updates);
        if (!plan) {
          return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
        }

        return NextResponse.json({
          action: 'update-lesson-plan',
          lessonPlan: plan,
          timestamp: new Date().toISOString(),
        });
      }

      case 'save-weekly-schedule': {
        const { weekStart, schedule, notes } = body;
        if (!weekStart || !schedule) {
          return NextResponse.json(
            { error: 'Missing required fields: weekStart, schedule' },
            { status: 400 }
          );
        }

        const savedSchedule = upsertWeeklySchedule({
          student_id: studentId,
          week_start: weekStart,
          schedule,
          notes,
        });

        return NextResponse.json({
          action: 'save-weekly-schedule',
          schedule: savedSchedule,
          timestamp: new Date().toISOString(),
        });
      }

      case 'record-feedback': {
        const { lessonPlanId, feedback, effectiveness, adjustments } = body;
        if (!lessonPlanId || !feedback || !effectiveness) {
          return NextResponse.json(
            { error: 'Missing required fields: lessonPlanId, feedback, effectiveness' },
            { status: 400 }
          );
        }

        await learnFromFeedback(lessonPlanId, feedback, effectiveness, adjustments);

        // Also update the lesson plan
        updateLessonPlan(lessonPlanId, {
          effectiveness_rating: effectiveness === 'very_effective' ? 5 :
                               effectiveness === 'effective' ? 4 :
                               effectiveness === 'neutral' ? 3 :
                               effectiveness === 'ineffective' ? 2 : 1,
          feedback,
          status: 'completed',
        });

        return NextResponse.json({
          action: 'record-feedback',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'sync-platform': {
        const { platform } = body;
        if (!platform) {
          return NextResponse.json(
            { error: 'Missing required field: platform' },
            { status: 400 }
          );
        }

        // Validate platform
        const validPlatforms: PlatformType[] = ['canyon_grove', 'google_classroom', 'canvas', 'lexia', 'zearn'];
        if (!validPlatforms.includes(platform)) {
          return NextResponse.json(
            { error: `Invalid platform. Valid options: ${validPlatforms.join(', ')}` },
            { status: 400 }
          );
        }

        // Check if configured
        if (!isPlatformConfigured(platform)) {
          return NextResponse.json({
            action: 'sync-platform',
            platform,
            success: false,
            error: `Platform ${platform} is not configured. Set ${platform.toUpperCase()}_USERNAME and ${platform.toUpperCase()}_PASSWORD environment variables.`,
            timestamp: new Date().toISOString(),
          });
        }

        // Sync assignments
        const result = await syncPlatformAssignments(platform as PlatformType, studentId);

        return NextResponse.json({
          action: 'sync-platform',
          platform,
          studentId,
          ...result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'sync-all-platforms': {
        const configuredPlatforms = getConfiguredPlatforms();

        if (configuredPlatforms.length === 0) {
          return NextResponse.json({
            action: 'sync-all-platforms',
            success: false,
            error: 'No platforms are configured. Set platform credentials in environment variables.',
            platforms: [],
            timestamp: new Date().toISOString(),
          });
        }

        const results: Array<{
          platform: PlatformType;
          success: boolean;
          newCount: number;
          updatedCount: number;
          totalFound: number;
          error?: string;
        }> = [];

        for (const platform of configuredPlatforms) {
          const result = await syncPlatformAssignments(platform, studentId);
          results.push({ platform, ...result });
        }

        const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
        const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
        const totalFound = results.reduce((sum, r) => sum + r.totalFound, 0);
        const allSuccess = results.every(r => r.success);

        return NextResponse.json({
          action: 'sync-all-platforms',
          success: allSuccess,
          platforms: results,
          summary: {
            platformsSynced: configuredPlatforms.length,
            totalNewAssignments: totalNew,
            totalUpdatedAssignments: totalUpdated,
            totalAssignmentsFound: totalFound,
          },
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[EducationAPI] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute education action', details: String(error) },
      { status: 500 }
    );
  }
}
