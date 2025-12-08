/**
 * HYRO FORGE: Quest System API
 * Quest management, generation from assignments, and completion
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateQuestFromAssignment,
  generateQuestsFromAssignments,
  completeQuest,
  startQuest,
  syncQuestCompletion,
  getActiveQuests,
  getQuestsDueToday,
  getOverdueQuests,
  getQuestsByPlatform,
  getQuestGenerationStats,
  getAllQuestGenerators,
  createQuestGenerator,
  AssignmentInput,
  // Stat-based quest generation
  generateDailyQuestsFromGoals,
  generateWeeklyQuestsFromGoals,
  getRecommendedQuests,
  acceptChallengeQuest,
  getQuestPoolTemplates,
  getWeakestStats,
} from '@/lib/hyro/forge-quest-generator';
import { getDatabase } from '@/lib/db/Database';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';

export async function GET(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const questId = searchParams.get('id');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    // Get specific quest
    if (questId) {
      const db = getDatabase();
      const quest = db.prepare(`SELECT * FROM hyro_quests WHERE id = ? AND student_id = ?`).get(questId, studentId);
      if (!quest) {
        return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
      }
      return NextResponse.json({ quest });
    }

    // Get active quests
    if (action === 'active') {
      const db = getDatabase();
      const quests = db.prepare(`
        SELECT * FROM hyro_quests
        WHERE student_id = ? AND status IN ('available', 'in_progress')
        ORDER BY priority DESC, due_date ASC
      `).all(studentId);
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get quests due today
    if (action === 'due-today') {
      const db = getDatabase();
      const today = new Date();
      const startOfDay = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
      const endOfDay = startOfDay + 86400;
      const quests = db.prepare(`
        SELECT * FROM hyro_quests
        WHERE student_id = ? AND status != 'completed'
        AND due_date >= ? AND due_date < ?
        ORDER BY due_date ASC
      `).all(studentId, startOfDay, endOfDay);
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get overdue quests
    if (action === 'overdue') {
      const db = getDatabase();
      const now = Math.floor(Date.now() / 1000);
      const quests = db.prepare(`
        SELECT * FROM hyro_quests
        WHERE student_id = ? AND status != 'completed' AND due_date < ?
        ORDER BY due_date ASC
      `).all(studentId, now);
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get quests by platform
    if (platform) {
      const db = getDatabase();
      let query = `SELECT * FROM hyro_quests WHERE student_id = ? AND platform = ?`;
      const params: any[] = [studentId, platform];
      if (status) {
        query += ` AND status = ?`;
        params.push(status);
      }
      query += ` ORDER BY due_date ASC`;
      const quests = db.prepare(query).all(...params);
      return NextResponse.json({ quests, platform, count: quests.length });
    }

    // Get quest generation stats
    if (action === 'stats') {
      const db = getDatabase();
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
          SUM(xp_reward) as total_xp_available,
          platform
        FROM hyro_quests
        WHERE student_id = ?
        GROUP BY platform
      `).all(studentId);
      return NextResponse.json(stats);
    }

    // Get all quest generators
    if (action === 'generators') {
      const generators = getAllQuestGenerators();
      return NextResponse.json({ generators });
    }

    // Get recommended quests based on student goals/stats
    if (action === 'recommended') {
      const recommended = getRecommendedQuests(studentId);
      return NextResponse.json({
        ...recommended,
        weakest_stats: getWeakestStats(studentId, 3),
        message: 'Quests personalized based on your stats',
      });
    }

    // Get quest pool templates
    if (action === 'pool') {
      const questType = (searchParams.get('type') || 'daily') as 'daily' | 'weekly' | 'challenge';
      const stat = searchParams.get('stat') || undefined;
      const templates = getQuestPoolTemplates(questType, stat, 20);
      return NextResponse.json({ templates, quest_type: questType, stat });
    }

    // Default: get all active quests
    const db = getDatabase();
    const quests = db.prepare(`
      SELECT * FROM hyro_quests
      WHERE student_id = ? AND status IN ('available', 'in_progress')
      ORDER BY priority DESC, due_date ASC
    `).all(studentId);

    const today = new Date();
    const startOfDay = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000);
    const endOfDay = startOfDay + 86400;
    const dueToday = db.prepare(`
      SELECT * FROM hyro_quests
      WHERE student_id = ? AND status != 'completed'
      AND due_date >= ? AND due_date < ?
      ORDER BY due_date ASC
    `).all(studentId, startOfDay, endOfDay);

    const now = Math.floor(Date.now() / 1000);
    const overdue = db.prepare(`
      SELECT * FROM hyro_quests
      WHERE student_id = ? AND status != 'completed' AND due_date < ?
      ORDER BY due_date ASC
    `).all(studentId, now);

    return NextResponse.json({
      active: quests,
      due_today: dueToday,
      overdue: overdue,
      summary: {
        active_count: quests.length,
        due_today_count: dueToday.length,
        overdue_count: overdue.length,
      },
    });
  } catch (error) {
    console.error('Quests GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const body = await request.json();
    const { action } = body;

    // Generate daily quests (standards-based)
    if (action === 'generate-daily') {
      const { generateDailyStandardsQuests } = await import('@/lib/hyro/forge-quest-generator');
      const quests = await generateDailyStandardsQuests(studentId);

      return NextResponse.json({
        success: true,
        quests,
        message: `Generated ${quests.length} daily quests`
      });
    }

    // Generate quest from single assignment
    if (action === 'generate') {
      const { assignment } = body as { assignment: AssignmentInput };
      if (!assignment || !assignment.platform || !assignment.platform_id || !assignment.title) {
        return NextResponse.json(
          { error: 'assignment with platform, platform_id, and title is required' },
          { status: 400 }
        );
      }

      const result = generateQuestFromAssignment(studentId, assignment);
      if (!result) {
        return NextResponse.json(
          { error: 'Quest already exists for this assignment', already_exists: true },
          { status: 409 }
        );
      }

      return NextResponse.json({
        ...result,
        message: `Quest generated: ${result.quest.title} (+${result.xp_reward} XP)`,
      });
    }

    // Generate quests from multiple assignments (batch)
    if (action === 'generate-batch') {
      const { assignments } = body as { assignments: AssignmentInput[] };
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return NextResponse.json(
          { error: 'assignments array is required' },
          { status: 400 }
        );
      }

      const result = generateQuestsFromAssignments(studentId, assignments);

      return NextResponse.json({
        generated: result.generated.length,
        skipped: result.skipped.length,
        quests: result.generated.map(r => ({
          id: r.quest.id,
          title: r.quest.title,
          xp_reward: r.xp_reward,
          platform: r.quest.platform,
        })),
        skipped_ids: result.skipped,
        message: `Generated ${result.generated.length} quests (${result.skipped.length} skipped)`,
      });
    }

    // Start a quest
    if (action === 'start') {
      const { quest_id } = body;
      if (!quest_id) {
        return NextResponse.json(
          { error: 'quest_id is required' },
          { status: 400 }
        );
      }

      const quest = startQuest(studentId, quest_id);
      if (!quest) {
        return NextResponse.json(
          { error: 'Quest not found or already started' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        quest,
        message: `Quest started: ${quest.title}`,
      });
    }

    // Complete a quest
    if (action === 'complete') {
      const { quest_id } = body;
      if (!quest_id) {
        return NextResponse.json(
          { error: 'quest_id is required' },
          { status: 400 }
        );
      }

      const result = completeQuest(studentId, quest_id);
      if (!result) {
        return NextResponse.json(
          { error: 'Quest not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...result,
        message: result.xp_earned > 0
          ? `Quest completed! +${result.xp_earned} XP`
          : 'Quest was already completed',
      });
    }

    // Sync quest completion from platform
    if (action === 'sync-completion') {
      const { platform, platform_id, score } = body;
      if (!platform || !platform_id) {
        return NextResponse.json(
          { error: 'platform and platform_id are required' },
          { status: 400 }
        );
      }

      const result = syncQuestCompletion(studentId, platform, platform_id, score);
      if (!result) {
        return NextResponse.json(
          { error: 'Quest not found for this platform assignment' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ...result,
        message: result.xp_earned > 0
          ? `Quest synced and completed! +${result.xp_earned} XP`
          : 'Quest was already completed',
      });
    }

    // Create new quest generator
    if (action === 'create-generator') {
      const { platform, assignment_type, quest_template, xp_formula } = body;
      if (!platform || !quest_template || !xp_formula) {
        return NextResponse.json(
          { error: 'platform, quest_template, and xp_formula are required' },
          { status: 400 }
        );
      }

      const generator = createQuestGenerator({
        platform,
        assignment_type,
        quest_template,
        xp_formula,
      });

      return NextResponse.json({
        generator,
        message: `Quest generator created for ${platform}`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Quests POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process quest action' },
      { status: 500 }
    );
  }
}
