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
} from '@/lib/hyro/forge-quest-generator';
import { getDatabase } from '@/lib/db/Database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const questId = searchParams.get('id');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    // Get specific quest
    if (questId) {
      const db = getDatabase();
      const quest = db.prepare(`SELECT * FROM hyro_quests WHERE id = ?`).get(questId);
      if (!quest) {
        return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
      }
      return NextResponse.json({ quest });
    }

    // Get active quests
    if (action === 'active') {
      const quests = getActiveQuests();
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get quests due today
    if (action === 'due-today') {
      const quests = getQuestsDueToday();
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get overdue quests
    if (action === 'overdue') {
      const quests = getOverdueQuests();
      return NextResponse.json({ quests, count: quests.length });
    }

    // Get quests by platform
    if (platform) {
      const quests = getQuestsByPlatform(platform, status || undefined);
      return NextResponse.json({ quests, platform, count: quests.length });
    }

    // Get quest generation stats
    if (action === 'stats') {
      const stats = getQuestGenerationStats();
      return NextResponse.json(stats);
    }

    // Get all quest generators
    if (action === 'generators') {
      const generators = getAllQuestGenerators();
      return NextResponse.json({ generators });
    }

    // Default: get all active quests
    const quests = getActiveQuests();
    const dueToday = getQuestsDueToday();
    const overdue = getOverdueQuests();

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
    const body = await request.json();
    const { action } = body;

    // Generate quest from single assignment
    if (action === 'generate') {
      const { assignment } = body as { assignment: AssignmentInput };
      if (!assignment || !assignment.platform || !assignment.platform_id || !assignment.title) {
        return NextResponse.json(
          { error: 'assignment with platform, platform_id, and title is required' },
          { status: 400 }
        );
      }

      const result = generateQuestFromAssignment(assignment);
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

      const result = generateQuestsFromAssignments(assignments);

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

      const quest = startQuest(quest_id);
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

      const result = completeQuest(quest_id);
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

      const result = syncQuestCompletion(platform, platform_id, score);
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
