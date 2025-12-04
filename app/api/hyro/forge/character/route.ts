/**
 * HYRO FORGE: Character API
 * GET /api/hyro/forge/character - Get full character sheet
 */

import { NextResponse } from 'next/server';
import { getCharacterSheet, calculatePowerLevel } from '@/lib/hyro/forge-stats';
import { getLevelProgress, getXPSummary } from '@/lib/hyro/forge-xp';

export async function GET() {
  try {
    const characterSheet = getCharacterSheet();

    if (!characterSheet) {
      return NextResponse.json(
        { success: false, error: 'Character not initialized' },
        { status: 404 }
      );
    }

    const levelProgress = getLevelProgress(characterSheet.total_xp);
    const xpSummary = getXPSummary();
    const powerLevel = calculatePowerLevel();

    return NextResponse.json({
      success: true,
      data: {
        character: {
          id: characterSheet.id,
          display_name: characterSheet.display_name,
          title: characterSheet.title,
          level: characterSheet.level,
          total_xp: characterSheet.total_xp,
          current_streak: characterSheet.current_streak,
          longest_streak: characterSheet.longest_streak,
          last_session_at: characterSheet.last_session_at,
          avatar_url: characterSheet.avatar_url,
        },
        level_progress: levelProgress,
        xp_summary: xpSummary,
        power_level: powerLevel,
        stats: characterSheet.stats,
        recent_achievements: characterSheet.recent_achievements,
        active_quests: characterSheet.active_quests,
      },
    });
  } catch (error) {
    console.error('[Forge Character API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
