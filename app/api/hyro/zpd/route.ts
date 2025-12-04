/**
 * HYRO FORGE: ZPD (Zone of Proximal Development) API
 *
 * GET  /api/hyro/zpd - Get ZPD state, recommendations, velocity
 */

import { NextRequest, NextResponse } from 'next/server';
import { StatName, STAT_NAMES } from '@/lib/hyro/forge-types';
import {
  getZPDState,
  getAllZPDStates,
  getContentRecommendation,
  getLearningVelocity,
  getAllLearningVelocities,
  detectFlowState,
} from '@/lib/hyro/forge-zpd-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'all';
    const statName = searchParams.get('stat') as StatName | null;

    switch (action) {
      case 'all': {
        // Get ZPD states for all stats
        const states = getAllZPDStates();
        const velocities = getAllLearningVelocities();
        return NextResponse.json({
          success: true,
          data: { states, velocities },
        });
      }

      case 'state': {
        // Get ZPD state for a specific stat
        if (!statName || !STAT_NAMES.includes(statName)) {
          return NextResponse.json(
            { success: false, error: 'Valid stat name required' },
            { status: 400 }
          );
        }

        const state = getZPDState(statName);
        return NextResponse.json({ success: true, data: state });
      }

      case 'recommendation': {
        // Get content recommendation for a stat
        if (!statName || !STAT_NAMES.includes(statName)) {
          return NextResponse.json(
            { success: false, error: 'Valid stat name required' },
            { status: 400 }
          );
        }

        const recommendation = getContentRecommendation(statName);
        return NextResponse.json({ success: true, data: recommendation });
      }

      case 'velocity': {
        // Get learning velocity
        if (statName && STAT_NAMES.includes(statName)) {
          const velocity = getLearningVelocity(statName);
          return NextResponse.json({ success: true, data: velocity });
        }

        const velocities = getAllLearningVelocities();
        return NextResponse.json({ success: true, data: velocities });
      }

      case 'flow': {
        // Detect flow state for a stat
        if (!statName || !STAT_NAMES.includes(statName)) {
          return NextResponse.json(
            { success: false, error: 'Valid stat name required' },
            { status: 400 }
          );
        }

        const flowState = detectFlowState(statName);
        return NextResponse.json({ success: true, data: flowState });
      }

      case 'overview': {
        // Get a comprehensive overview for the parent dashboard
        const states = getAllZPDStates();
        const velocities = getAllLearningVelocities();

        const overview = states.map((state) => {
          const velocity = velocities.find((v) => v.stat_name === state.stat_name);
          const flowState = detectFlowState(state.stat_name);

          return {
            stat_name: state.stat_name,
            current_level: state.current_level,
            optimal_difficulty: state.optimal_difficulty,
            trend: state.trend,
            adjustment_needed: state.adjustment_needed,
            scaffolding_recommended: state.scaffolding_recommended,
            in_flow: flowState.in_flow,
            weekly_growth: velocity?.weekly_growth || 0,
            days_to_benchmark: velocity?.estimated_days_to_benchmark,
          };
        });

        return NextResponse.json({ success: true, data: overview });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[ZPD API] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
