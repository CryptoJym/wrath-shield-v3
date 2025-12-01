import { NextRequest, NextResponse } from 'next/server';
import {
  recordAssignment,
  recordProgress,
  recordResource,
  addEducationMemory,
  type AssignmentContext,
} from '@/lib/hyro/education-memory';
import { createAssignment } from '@/lib/hyro/education-store';

/**
 * Education Data Sync API
 *
 * POST /api/hyro/education/sync
 * Receives scraped education data and stores it in ZEP memory
 */

interface ZearnLesson {
  title: string;
  lessonNumber?: number;
  status: string;
  type: string;
}

interface ZearnActivity {
  name: string;
  status: string;
}

interface ZearnProgress {
  studentName?: string;
  classInfo?: string;
  lessonsCompleted?: number;
  lessonsUnlocked?: number;
  activitiesCompleted?: number;
}

interface BoostResource {
  text: string;
  href: string;
}

interface BoostActivity {
  title: string;
  description?: string;
}

interface ScrapedData {
  zearn?: {
    lessons?: ZearnLesson[];
    progress?: ZearnProgress;
    completedWork?: ZearnActivity[];
  };
  boost?: {
    resources?: BoostResource[];
    activities?: BoostActivity[];
  };
  syncedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scrapedData: ScrapedData = body.data || body;

    const results = {
      zearnLessons: 0,
      zearnProgress: false,
      zearnActivities: 0,
      boostResources: 0,
      boostActivities: 0,
      errors: [] as string[],
    };

    // Process Zearn data
    if (scrapedData.zearn) {
      // Store lessons as assignments
      if (scrapedData.zearn.lessons && scrapedData.zearn.lessons.length > 0) {
        for (const lesson of scrapedData.zearn.lessons) {
          try {
            const assignmentContext: AssignmentContext = {
              platform: 'Zearn Math',
              subject: 'Math',
              title: lesson.title,
              status: lesson.status === 'completed' ? 'completed' :
                      lesson.status === 'in_progress' ? 'in_progress' : 'pending',
              notes: `Lesson ${lesson.lessonNumber || ''} - ${lesson.type}`,
            };

            await recordAssignment(assignmentContext);

            // Also create in the SQLite store
            createAssignment({
              platform: 'zearn',
              student_id: 'hyro',
              subject: 'math',
              title: lesson.title,
              description: `Zearn Math ${lesson.type} - Lesson ${lesson.lessonNumber || ''}`,
              status: lesson.status === 'completed' ? 'completed' :
                      lesson.status === 'in_progress' ? 'in_progress' : 'pending',
            });

            results.zearnLessons++;
          } catch (err) {
            results.errors.push(`Failed to record lesson: ${lesson.title}`);
          }
        }
      }

      // Store progress metrics
      if (scrapedData.zearn.progress) {
        try {
          const p = scrapedData.zearn.progress;
          await recordProgress(
            'Zearn Math',
            `Student: ${p.studentName || 'Hyro'}, Class: ${p.classInfo || 'Unknown'}, ` +
            `Lessons Completed: ${p.lessonsCompleted || 0}, ` +
            `Lessons Unlocked: ${p.lessonsUnlocked || 0}, ` +
            `Activities Completed: ${p.activitiesCompleted || 0}`,
            {
              studentName: p.studentName,
              classInfo: p.classInfo,
              lessonsCompleted: p.lessonsCompleted,
              lessonsUnlocked: p.lessonsUnlocked,
              activitiesCompleted: p.activitiesCompleted,
              syncedAt: scrapedData.syncedAt,
            }
          );
          results.zearnProgress = true;
        } catch (err) {
          results.errors.push('Failed to record Zearn progress');
        }
      }

      // Store completed activities
      if (scrapedData.zearn.completedWork && scrapedData.zearn.completedWork.length > 0) {
        for (const activity of scrapedData.zearn.completedWork) {
          try {
            await addEducationMemory(
              `Zearn Activity Completed: ${activity.name}`,
              'assignment',
              {
                platform: 'Zearn Math',
                activityName: activity.name,
                status: activity.status,
                completedAt: scrapedData.syncedAt,
              }
            );
            results.zearnActivities++;
          } catch (err) {
            results.errors.push(`Failed to record activity: ${activity.name}`);
          }
        }
      }
    }

    // Process Boost data
    if (scrapedData.boost) {
      // Store resources
      if (scrapedData.boost.resources && scrapedData.boost.resources.length > 0) {
        for (const resource of scrapedData.boost.resources) {
          try {
            await recordResource(
              {
                title: resource.text,
                type: 'website',
                url: resource.href,
              },
              'Boost Resources'
            );
            results.boostResources++;
          } catch (err) {
            results.errors.push(`Failed to record resource: ${resource.text}`);
          }
        }
      }

      // Store activities
      if (scrapedData.boost.activities && scrapedData.boost.activities.length > 0) {
        for (const activity of scrapedData.boost.activities) {
          try {
            await addEducationMemory(
              `Boost Activity: ${activity.title}${activity.description ? ' - ' + activity.description : ''}`,
              'resource',
              {
                platform: 'Canyon Grove Boost',
                activityTitle: activity.title,
                description: activity.description,
                syncedAt: scrapedData.syncedAt,
              }
            );
            results.boostActivities++;
          } catch (err) {
            results.errors.push(`Failed to record Boost activity: ${activity.title}`);
          }
        }
      }
    }

    // Create a summary memory entry
    const summary = `Education Sync Summary (${new Date().toLocaleDateString()}):
- Zearn: ${results.zearnLessons} lessons, ${results.zearnActivities} activities
- Boost: ${results.boostResources} resources, ${results.boostActivities} activities
- Progress recorded: ${results.zearnProgress}`;

    await addEducationMemory(summary, 'note', {
      type: 'sync_summary',
      syncedAt: scrapedData.syncedAt,
      results,
    });

    return NextResponse.json({
      success: true,
      message: 'Education data synced to ZEP memory',
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[EducationSync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync education data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hyro/education/sync
 * Returns info about the sync endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/hyro/education/sync',
    method: 'POST',
    description: 'Sync scraped education data to ZEP memory',
    expectedPayload: {
      data: {
        zearn: {
          lessons: '[{ title, lessonNumber, status, type }]',
          progress: '{ studentName, classInfo, lessonsCompleted, lessonsUnlocked, activitiesCompleted }',
          completedWork: '[{ name, status }]',
        },
        boost: {
          resources: '[{ text, href }]',
          activities: '[{ title, description }]',
        },
        syncedAt: 'ISO date string',
      },
    },
  });
}
