/**
 * HYRO FORGE: Stats API
 * GET /api/hyro/forge/stats - Get spider graph data
 * POST /api/hyro/forge/stats - Update a stat value
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSpiderGraphData,
  getAllStatsWithTrend,
  updateStat,
  getStatHistory,
} from '@/lib/hyro/forge-stats';
import type { StatName } from '@/lib/hyro/forge-types';
import { getStudentIdFromRequest } from '@/lib/hyro/student-auth';

export async function GET(request: NextRequest) {
  try {
    const studentId = await getStudentIdFromRequest();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'spider';
    const statName = searchParams.get('stat') as StatName | null;
    const historyDays = parseInt(searchParams.get('history_days') || '30', 10);

    // If requesting history for a specific stat
    if (statName && searchParams.get('history') === 'true') {
      const history = getStatHistory(statName, historyDays, studentId);
      return NextResponse.json({
        success: true,
        data: {
          stat_name: statName,
          history,
        },
      });
    }

    // Spider graph format (for Recharts RadarChart)
    if (format === 'spider') {
      const spiderData = getSpiderGraphData(studentId);
      return NextResponse.json({
        success: true,
        data: spiderData,
      });
    }

    // Full stats with trend information
    const stats = getAllStatsWithTrend(studentId);
    return NextResponse.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('[Forge Stats API] Error:', error);
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
    const { stat_name, value, reason, session_id } = body;

    if (!stat_name || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'stat_name and value are required' },
        { status: 400 }
      );
    }

    const validStats: StatName[] = [
      'math',
      'reading',
      'science',
      'coding',
      'study_skills',
      'critical_thinking',
      'technology',
      'problem_solving',
    ];

    if (!validStats.includes(stat_name)) {
      return NextResponse.json(
        { success: false, error: `Invalid stat_name. Must be one of: ${validStats.join(', ')}` },
        { status: 400 }
      );
    }

    const result = updateStat(
      stat_name as StatName,
      value,
      reason || 'manual_update',
      session_id,
      studentId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Forge Stats API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
