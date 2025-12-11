/**
 * HYRO Forge: Trajectory Patterns API
 *
 * GET /api/hyro/trajectory/patterns - Get learned trajectory patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
// TODO: Import when forge-meta-learner.ts is available
// import { getLearnedPatterns } from '@/lib/hyro/forge-meta-learner';

export const dynamic = 'force-dynamic';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface TrajectoryPattern {
  id: string;
  stat_name: string;
  start_state_range: {
    coherence: { min: number; max: number };
    entropy: { min: number; max: number };
    generativity: { min: number; max: number };
  };
  target_state_range: {
    coherence: { min: number; max: number };
    entropy: { min: number; max: number };
    generativity: { min: number; max: number };
  };
  intervention_sequence: Array<{
    type: string;
    avg_duration_minutes: number;
    description: string;
  }>;
  success_rate: number;
  sample_count: number;
  avg_duration_hours: number;
  confidence: number;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// GET - Learned Patterns
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const statName = searchParams.get('statName');
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.5');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Validate parameters
    if (minConfidence < 0 || minConfidence > 1) {
      return NextResponse.json(
        { error: 'minConfidence must be between 0 and 1' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // TODO: Implement when forge-meta-learner.ts is available
    // const patterns = await getLearnedPatterns({
    //   statName: statName || undefined,
    //   minConfidence,
    //   limit,
    // });

    // Stub implementation
    const patterns: TrajectoryPattern[] = [];

    return NextResponse.json({
      patterns,
      count: patterns.length,
      filters: {
        stat_name: statName || 'all',
        min_confidence: minConfidence,
        limit,
      },
    });
  } catch (error) {
    console.error('[Trajectory Patterns API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
