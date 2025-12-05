/**
 * HYRO FORGE: XP API
 * GET /api/hyro/forge/xp - Get XP summary and history
 * POST /api/hyro/forge/xp - Award XP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  awardXP,
  getXPSummary,
  getRecentXP,
  getLevelProgress,
  updateStreak,
} from '@/lib/hyro/forge-xp';
import { getCharacter } from '@/lib/hyro/forge-stats';
import type { XPSource } from '@/lib/hyro/forge-types';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';

export async function GET(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';
    const historyLimit = parseInt(searchParams.get('limit') || '20', 10);

    const character = getCharacter();
    if (!character) {
      return NextResponse.json(
        { success: false, error: 'Character not initialized' },
        { status: 404 }
      );
    }

    const summary = getXPSummary(studentId);
    const levelProgress = getLevelProgress(character.total_xp);

    const response: Record<string, unknown> = {
      success: true,
      data: {
        total_xp: character.total_xp,
        level: character.level,
        title: character.title,
        level_progress: levelProgress,
        summary,
        streak: {
          current: character.current_streak,
          longest: character.longest_streak,
        },
      },
    };

    if (includeHistory) {
      const history = getRecentXP(studentId, historyLimit);
      (response.data as Record<string, unknown>).history = history;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Forge XP API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const body = await request.json();
    const { action } = body;

    // Handle streak update action
    if (action === 'update_streak') {
      const streakResult = updateStreak(studentId);
      return NextResponse.json({
        success: true,
        data: streakResult,
      });
    }

    // Handle XP award
    const { amount, source, source_id, multiplier, notes } = body;

    if (!amount || !source) {
      return NextResponse.json(
        { success: false, error: 'amount and source are required' },
        { status: 400 }
      );
    }

    const validSources: XPSource[] = [
      'quest',
      'daily',
      'streak',
      'achievement',
      'srs',
      'intel',
      'reflection',
      'bonus',
    ];

    if (!validSources.includes(source)) {
      return NextResponse.json(
        { success: false, error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    const result = awardXP(
      studentId,
      amount,
      source as XPSource,
      source_id,
      multiplier || 1.0,
      notes
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Forge XP API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
