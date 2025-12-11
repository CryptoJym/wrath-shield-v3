/**
 * HYRO Forge: Trajectory API
 *
 * GET /api/hyro/trajectory - Get trajectory history for student
 * POST /api/hyro/trajectory - Record a trajectory outcome
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
// TODO: Import when forge-meta-learner.ts is available
// import {
//   getTrajectoryHistory,
//   recordTrajectory,
// } from '@/lib/hyro/forge-meta-learner';

export const dynamic = 'force-dynamic';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface RecordTrajectoryRequest {
  student_id: string;
  stat_name: string;
  start_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  end_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  interventions: Array<{
    type: string;
    content_id?: string;
    duration_minutes: number;
  }>;
  duration_hours: number;
  success: boolean;
}

interface TrajectoryHistoryItem {
  id: string;
  student_id: string;
  stat_name: string;
  start_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  end_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  interventions: Array<{
    type: string;
    content_id?: string;
    duration_minutes: number;
  }>;
  duration_hours: number;
  success: boolean;
  created_at: number;
}

// ============================================================================
// GET - Trajectory History
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const userId = currentUserOptional()?.userId || 'default';
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const studentId = searchParams.get('studentId') || userId;
    const statName = searchParams.get('statName');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Validate parameters
    if (!statName) {
      return NextResponse.json(
        { error: 'statName query parameter is required' },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    // TODO: Implement when forge-meta-learner.ts is available
    // const history = await getTrajectoryHistory(studentId, statName, limit);

    // Stub implementation
    const history: TrajectoryHistoryItem[] = [];

    return NextResponse.json({
      student_id: studentId,
      stat_name: statName,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('[Trajectory API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Record Trajectory
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const userId = currentUserOptional()?.userId || 'default';
    const body = await req.json() as RecordTrajectoryRequest;

    // Validate required fields
    const requiredFields = [
      'student_id',
      'stat_name',
      'start_state',
      'end_state',
      'interventions',
      'duration_hours',
    ];

    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate state objects
    const stateFields = ['coherence', 'entropy', 'generativity'];

    for (const field of stateFields) {
      if (!(field in body.start_state)) {
        return NextResponse.json(
          { error: `start_state missing required field: ${field}` },
          { status: 400 }
        );
      }
      if (!(field in body.end_state)) {
        return NextResponse.json(
          { error: `end_state missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate state values (0-1 range)
    for (const field of stateFields) {
      const startValue = body.start_state[field as keyof typeof body.start_state];
      const endValue = body.end_state[field as keyof typeof body.end_state];

      if (startValue < 0 || startValue > 1) {
        return NextResponse.json(
          { error: `start_state.${field} must be between 0 and 1` },
          { status: 400 }
        );
      }

      if (endValue < 0 || endValue > 1) {
        return NextResponse.json(
          { error: `end_state.${field} must be between 0 and 1` },
          { status: 400 }
        );
      }
    }

    // Validate interventions
    if (!Array.isArray(body.interventions) || body.interventions.length === 0) {
      return NextResponse.json(
        { error: 'interventions must be a non-empty array' },
        { status: 400 }
      );
    }

    for (let i = 0; i < body.interventions.length; i++) {
      const intervention = body.interventions[i];

      if (!intervention.type) {
        return NextResponse.json(
          { error: `interventions[${i}] missing required field: type` },
          { status: 400 }
        );
      }

      if (!intervention.duration_minutes || intervention.duration_minutes <= 0) {
        return NextResponse.json(
          { error: `interventions[${i}] must have duration_minutes > 0` },
          { status: 400 }
        );
      }
    }

    // Validate duration
    if (body.duration_hours <= 0) {
      return NextResponse.json(
        { error: 'duration_hours must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate success field exists
    if (typeof body.success !== 'boolean') {
      return NextResponse.json(
        { error: 'success must be a boolean' },
        { status: 400 }
      );
    }

    // TODO: Implement when forge-meta-learner.ts is available
    // const result = await recordTrajectory(body);

    // Stub implementation
    const result = {
      id: `traj_${Date.now()}`,
      student_id: body.student_id,
      stat_name: body.stat_name,
      created_at: Math.floor(Date.now() / 1000),
      pattern_updated: false,
      confidence_score: 0,
    };

    return NextResponse.json({
      ok: true,
      trajectory: result,
    });
  } catch (error) {
    console.error('[Trajectory API] POST Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
