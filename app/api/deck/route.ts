/**
 * Wrath Shield v3 - Deck API Route
 *
 * Manages daily deck tasks (Word, Action, Body) and UIX gating enforcement.
 *
 * GATING RULES:
 * - UIX < 70 for 2 consecutive days = deck locked
 * - Requires stomping 3 flags to unlock
 * - Tasks are reset daily
 *
 * Combined API target: <200ms response time
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  getTotalUIXScore,
  getTweaksLastNHours,
  getPendingFlags,
  getSetting,
  insertSettings,
  insertTweaks,
  updateFlagStatus,
} from '@/lib/db/queries';
import type { SettingInput } from '@/lib/db/types';

/**
 * Daily task structure
 */
interface DailyTask {
  category: 'word' | 'action' | 'body';
  title: string;
  description: string;
  completed: boolean;
}

/**
 * Gating state
 */
interface GatingState {
  is_gated: boolean;
  uix_score: number;
  consecutive_low_days: number;
  flags_stomped: number;
  flags_required: number;
  reason: string | null;
}

/**
 * GET /api/deck response
 */
interface DeckResponse {
  tasks: DailyTask[];
  gating: GatingState;
  today_date: string;
}

/**
 * POST /api/deck request
 */
interface DeckRequest {
  action: 'complete_task' | 'stomp_flag';
  task_category?: 'word' | 'action' | 'body';
  flag_id?: string;
}

/**
 * GET /api/deck
 * Returns today's tasks and gating state
 */
export async function GET(request: NextRequest): Promise<NextResponse<DeckResponse>> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get current task completion state
    const tasks = await getDailyTasks(today);

    // Calculate gating state
    const gating = await calculateGatingState();

    return NextResponse.json({
      tasks,
      gating,
      today_date: today,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=0' },
    });
  } catch (error) {
    console.error('[Deck API] GET Error:', error);
    return NextResponse.json({
      tasks: [],
      gating: {
        is_gated: false,
        uix_score: 0,
        consecutive_low_days: 0,
        flags_stomped: 0,
        flags_required: 3,
        reason: null,
      },
      today_date: new Date().toISOString().split('T')[0],
    }, { status: 500 });
  }
}

/**
 * POST /api/deck
 * Complete tasks or stomp flags
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: DeckRequest = await request.json();

    // Validate action
    if (!body.action || !['complete_task', 'stomp_flag'].includes(body.action)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Must be complete_task or stomp_flag.',
      }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    if (body.action === 'complete_task') {
      return handleCompleteTask(body, today);
    } else {
      return await handleStompFlag(body, today);
    }
  } catch (error) {
    console.error('[Deck API] POST Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error during deck operation',
    }, { status: 500 });
  }
}

/**
 * Get daily tasks with completion state
 */
async function getDailyTasks(date: string): Promise<DailyTask[]> {
  const taskState = getSetting(`deck_tasks_${date}`);

  // Default tasks for each category
  const defaultTasks: DailyTask[] = [
    {
      category: 'word',
      title: 'Mindful Communication',
      description: 'Speak one truth that feels uncomfortable but necessary',
      completed: false,
    },
    {
      category: 'action',
      title: 'Boundary Enforcement',
      description: 'Say "no" to one request that compromises your values',
      completed: false,
    },
    {
      category: 'body',
      title: 'Physical Grounding',
      description: 'Complete 10 minutes of intentional movement or breathwork',
      completed: false,
    },
  ];

  if (!taskState) {
    return defaultTasks;
  }

  try {
    const savedTasks = JSON.parse(taskState.value_enc);
    return defaultTasks.map((task, idx) => ({
      ...task,
      completed: savedTasks[idx]?.completed || false,
    }));
  } catch {
    return defaultTasks;
  }
}

/**
 * Calculate gating state based on UIX score
 */
async function calculateGatingState(): Promise<GatingState> {
  const totalUIX = getTotalUIXScore();

  // Get UIX scores from last 48 hours (2 days)
  const recentTweaks = getTweaksLastNHours(48);

  // Calculate daily UIX averages
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 24 * 3600;
  const twoDaysAgo = now - 48 * 3600;

  const yesterday = recentTweaks.filter(t => t.created_at >= oneDayAgo && t.created_at < now);
  const dayBeforeYesterday = recentTweaks.filter(t => t.created_at >= twoDaysAgo && t.created_at < oneDayAgo);

  const yesterdayUIX = yesterday.reduce((sum, t) => sum + t.delta_uix, 0);
  const dayBeforeUIX = dayBeforeYesterday.reduce((sum, t) => sum + t.delta_uix, 0);

  // Count consecutive low days
  let consecutiveLowDays = 0;
  if (yesterdayUIX < 70) consecutiveLowDays++;
  if (dayBeforeUIX < 70 && consecutiveLowDays > 0) consecutiveLowDays++;

  // Check if gated
  const isGated = consecutiveLowDays >= 2;

  // If gated, check how many flags have been stomped
  let flagsStomped = 0;
  if (isGated) {
    const stompedSetting = getSetting('deck_flags_stomped');
    if (stompedSetting) {
      try {
        flagsStomped = parseInt(stompedSetting.value_enc, 10) || 0;
      } catch {
        flagsStomped = 0;
      }
    }
  }

  return {
    is_gated: isGated && flagsStomped < 3,
    uix_score: totalUIX,
    consecutive_low_days: consecutiveLowDays,
    flags_stomped: flagsStomped,
    flags_required: 3,
    reason: isGated && flagsStomped < 3
      ? `UIX < 70 for ${consecutiveLowDays} days. Stomp ${3 - flagsStomped} more flags to unlock.`
      : null,
  };
}

/**
 * Handle task completion
 */
function handleCompleteTask(body: DeckRequest, date: string): NextResponse {
  if (!body.task_category) {
    return NextResponse.json({
      success: false,
      message: 'task_category is required for complete_task action',
    }, { status: 400 });
  }

  if (!['word', 'action', 'body'].includes(body.task_category)) {
    return NextResponse.json({
      success: false,
      message: 'Invalid task_category. Must be word, action, or body.',
    }, { status: 400 });
  }

  // Get current task state
  const taskState = getSetting(`deck_tasks_${date}`);
  let tasks: { category: string; completed: boolean }[] = [
    { category: 'word', completed: false },
    { category: 'action', completed: false },
    { category: 'body', completed: false },
  ];

  if (taskState) {
    try {
      tasks = JSON.parse(taskState.value_enc);
    } catch {
      // Use defaults
    }
  }

  // Mark task as completed
  const taskIdx = tasks.findIndex(t => t.category === body.task_category);
  if (taskIdx !== -1) {
    tasks[taskIdx].completed = true;
  }

  // Save updated state
  insertSettings([{
    key: `deck_tasks_${date}`,
    value_enc: JSON.stringify(tasks),
  }]);

  return NextResponse.json({
    success: true,
    message: `Task "${body.task_category}" marked as completed`,
    tasks_completed: tasks.filter(t => t.completed).length,
    total_tasks: tasks.length,
  }, {
    status: 200,
    headers: { 'Cache-Control': 'private, max-age=0' },
  });
}

/**
 * Handle flag stomping
 */
async function handleStompFlag(body: DeckRequest, date: string): Promise<NextResponse> {
  if (!body.flag_id) {
    return NextResponse.json({
      success: false,
      message: 'flag_id is required for stomp_flag action',
    }, { status: 400 });
  }

  // Check if gated
  const gating = await calculateGatingState();
  if (!gating.is_gated) {
    return NextResponse.json({
      success: false,
      message: 'Deck is not gated. No need to stomp flags.',
    }, { status: 400 });
  }

  // Verify flag exists and is pending
  const pendingFlags = getPendingFlags();
  const flag = pendingFlags.find(f => f.id === body.flag_id);

  if (!flag) {
    return NextResponse.json({
      success: false,
      message: `Flag ${body.flag_id} not found or already resolved`,
    }, { status: 404 });
  }

  // Create tweak record for the stomp
  const now = Math.floor(Date.now() / 1000);

  insertTweaks([{
    id: randomUUID(),
    flag_id: flag.id,
    assured_text: `[Deck Unlock] Flag stomped: ${flag.original_text}`,
    action_type: 'stomp',
    context: null,
    delta_uix: flag.severity * 15, // 15 UIX per severity point
    user_notes: null,
    created_at: now,
  }]);

  // Mark flag as resolved
  updateFlagStatus(flag.id, 'resolved');

  // Increment stomped count
  const stompedSetting = getSetting('deck_flags_stomped');
  let stompedCount = 0;
  if (stompedSetting) {
    try {
      stompedCount = parseInt(stompedSetting.value_enc, 10) || 0;
    } catch {
      stompedCount = 0;
    }
  }

  stompedCount++;

  insertSettings([{
    key: 'deck_flags_stomped',
    value_enc: stompedCount.toString(),
  }]);

  // Check if unlocked
  const unlocked = stompedCount >= 3;

  if (unlocked) {
    // Reset stomp counter for next gate
    insertSettings([{
      key: 'deck_flags_stomped',
      value_enc: '0',
    }]);
  }

  return NextResponse.json({
    success: true,
    message: unlocked
      ? 'Deck unlocked! All 3 flags stomped.'
      : `Flag stomped. ${3 - stompedCount} more to unlock.`,
    flags_stomped: stompedCount,
    flags_required: 3,
    unlocked,
  }, {
    status: 200,
    headers: { 'Cache-Control': 'private, max-age=0' },
  });
}
