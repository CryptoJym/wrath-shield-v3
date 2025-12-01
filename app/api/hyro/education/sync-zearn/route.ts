import { NextRequest, NextResponse } from 'next/server';
import {
  recordProgress,
  recordAssignment,
  addEducationMemory,
} from '@/lib/hyro/education-memory';

/**
 * Sync Comprehensive Zearn Data to ZEP Memory
 *
 * POST /api/hyro/education/sync-zearn
 *
 * Stores full Zearn history in ZEP education memory graph
 */

export async function POST(request: NextRequest) {
  try {
    const results = {
      progressRecords: 0,
      assignmentRecords: 0,
      errors: [] as string[],
    };

    // Record overall progress summary (VERIFIED from visual screenshot analysis 2025-12-01)
    try {
      await recordProgress(
        'Math (Zearn)',
        `Comprehensive Zearn progress as of 2025-12-01: 192 total lesson badges earned across 11 missions (G5 M1-6 and G6 M1-5). Grade 5: 136/136 badges (100% COMPLETE). Grade 6: 56/72 badges (78%). Overall: 92% completion. G6 M3 has 2 skipped lessons. Currently working on G6 Mission 5 "Arithmetic in Base Ten" - Lesson 1 of 15 started (7%). Pace status: ON TRACK.`,
        {
          platform: 'zearn',
          totalBadges: 192,
          totalPossible: 208,
          overallPercent: 92,
          grade5Percent: 100,
          grade6Percent: 78,
          currentMission: 'G6 M5',
          currentLesson: 1,
          dueDate: '2025-12-20',
          paceStatus: 'on_track',
        }
      );
      results.progressRecords++;
    } catch (e) {
      results.errors.push(`Progress summary: ${e}`);
    }

    // Record each completed G6 mission (VERIFIED from screenshots 2025-12-01)
    const completedMissions = [
      { grade: 'G6', mission: 1, name: 'Area and Surface Area', badges: 15, total: 15, percent: 100 },
      { grade: 'G6', mission: 2, name: 'Introducing Ratios', badges: 14, total: 14, percent: 100 },
      { grade: 'G6', mission: 3, name: 'Unit Rates and Percentages', badges: 12, total: 14, percent: 86, note: '2 lessons skipped' },
      { grade: 'G6', mission: 4, name: 'Dividing Fractions', badges: 14, total: 14, percent: 100 },
    ];

    for (const m of completedMissions) {
      try {
        await recordProgress(
          'Math (Zearn)',
          `Completed ${m.grade} Mission ${m.mission} "${m.name}" - ${m.badges}/${m.total} badges (${m.percent}% complete)`,
          {
            platform: 'zearn',
            grade: m.grade,
            mission: m.mission,
            missionName: m.name,
            badgesEarned: m.badges,
            badgesTotal: m.total,
            percentComplete: m.percent,
            status: 'complete',
          }
        );
        results.progressRecords++;
      } catch (e) {
        results.errors.push(`${m.grade} M${m.mission}: ${e}`);
      }
    }

    // Record G5 completed missions (VERIFIED 100% complete from screenshots 2025-12-01)
    const g5Missions = [
      { grade: 'G5', mission: 1, name: 'Place Value with Decimal Fractions', badges: 16, total: 16, percent: 100 },
      { grade: 'G5', mission: 2, name: 'Base Ten Operations', badges: 29, total: 29, percent: 100 },
      { grade: 'G5', mission: 3, name: 'Add and Subtract Fractions', badges: 16, total: 16, percent: 100 },
      { grade: 'G5', mission: 4, name: 'Multiply and Divide Fractions and Decimals', badges: 32, total: 32, percent: 100 },
      { grade: 'G5', mission: 5, name: 'Volume, Area, and Shapes', badges: 19, total: 19, percent: 100 },
      { grade: 'G5', mission: 6, name: 'The Coordinate Plane', badges: 24, total: 24, percent: 100 },
    ];

    for (const m of g5Missions) {
      try {
        await recordProgress(
          'Math (Zearn)',
          `${m.grade} Mission ${m.mission} "${m.name}" - ${m.badges}/${m.total} badges (${m.percent}% complete)`,
          {
            platform: 'zearn',
            grade: m.grade,
            mission: m.mission,
            missionName: m.name,
            badgesEarned: m.badges,
            badgesTotal: m.total,
            percentComplete: m.percent,
            status: 'partial',
          }
        );
        results.progressRecords++;
      } catch (e) {
        results.errors.push(`${m.grade} M${m.mission}: ${e}`);
      }
    }

    // Record current assignment
    try {
      await recordAssignment({
        platform: 'Zearn Math',
        subject: 'Math',
        title: 'G6 Mission 5: Arithmetic in Base Ten',
        dueDate: '2025-12-20',
        status: 'in_progress',
        notes: 'Current lesson: 1 of 15 (1 badge earned, 1 in progress). All G5 missions and G6 M1-4 complete. Class: SJ Tuesday 6 25-26.',
      });
      results.assignmentRecords++;
    } catch (e) {
      results.errors.push(`Current assignment: ${e}`);
    }

    // Record a learning observation (VERIFIED 2025-12-01)
    try {
      await addEducationMemory(
        'Hyro has COMPLETED all Grade 5 math missions (136 badges, 100%). G6 progress: M1-M2-M4 at 100%, M3 at 86% (2 skipped), M5 just started (1/15). Total: 192/208 badges (92% overall). Excellent foundation - ready to complete G6 M5.',
        'note',
        {
          platform: 'zearn',
          observation_type: 'progress_analysis',
          date: '2025-12-01',
          verified: true,
        }
      );
    } catch (e) {
      results.errors.push(`Observation: ${e}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Zearn data synced to ZEP education memory',
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[SyncZearn] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Zearn data', details: String(error) },
      { status: 500 }
    );
  }
}
