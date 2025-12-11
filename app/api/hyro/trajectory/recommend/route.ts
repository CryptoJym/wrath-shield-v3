/**
 * HYRO Forge: Trajectory Recommendation API
 *
 * GET /api/hyro/trajectory/recommend - Get recommended trajectory for student
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
// TODO: Import when forge-meta-learner.ts is available
// import {
//   recommendTrajectory,
//   getCurrentState,
// } from '@/lib/hyro/forge-meta-learner';

export const dynamic = 'force-dynamic';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

interface TrajectoryRecommendation {
  student_id: string;
  stat_name: string;
  current_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  target_state: {
    coherence: number;
    entropy: number;
    generativity: number;
  };
  recommended_interventions: Array<{
    type: string;
    duration_minutes: number;
    description: string;
  }>;
  estimated_duration_hours: number;
  confidence: number;
}

// ============================================================================
// GET - Recommend Trajectory
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const userId = currentUserOptional()?.userId || 'default';
    const searchParams = req.nextUrl.searchParams;

    // Parse query parameters
    const studentId = searchParams.get('studentId') || userId;
    const statName = searchParams.get('statName');
    const targetCoherence = searchParams.get('targetCoherence');
    const targetEntropy = searchParams.get('targetEntropy');
    const targetGenerativity = searchParams.get('targetGenerativity');

    // Validate required parameters
    if (!statName) {
      return NextResponse.json(
        { error: 'statName query parameter is required' },
        { status: 400 }
      );
    }

    // Parse and validate target state values
    let targetState: {
      coherence: number;
      entropy: number;
      generativity: number;
    } | undefined;

    if (targetCoherence || targetEntropy || targetGenerativity) {
      // If any target is provided, all must be provided
      if (!targetCoherence || !targetEntropy || !targetGenerativity) {
        return NextResponse.json(
          {
            error:
              'All target state values must be provided (targetCoherence, targetEntropy, targetGenerativity)',
          },
          { status: 400 }
        );
      }

      const coherence = parseFloat(targetCoherence);
      const entropy = parseFloat(targetEntropy);
      const generativity = parseFloat(targetGenerativity);

      // Validate ranges
      if (
        isNaN(coherence) ||
        coherence < 0 ||
        coherence > 1 ||
        isNaN(entropy) ||
        entropy < 0 ||
        entropy > 1 ||
        isNaN(generativity) ||
        generativity < 0 ||
        generativity > 1
      ) {
        return NextResponse.json(
          { error: 'All target state values must be between 0 and 1' },
          { status: 400 }
        );
      }

      targetState = {
        coherence,
        entropy,
        generativity,
      };
    }

    // TODO: Implement when forge-meta-learner.ts is available
    // const currentState = await getCurrentState(studentId, statName);
    // const recommendation = await recommendTrajectory(
    //   studentId,
    //   statName,
    //   targetState
    // );

    // Stub implementation
    const currentState = {
      coherence: 0.5,
      entropy: 0.6,
      generativity: 0.4,
    };

    const recommendation: TrajectoryRecommendation = {
      student_id: studentId,
      stat_name: statName,
      current_state: currentState,
      target_state: targetState || {
        coherence: 0.7,
        entropy: 0.5,
        generativity: 0.6,
      },
      recommended_interventions: [
        {
          type: 'practice',
          duration_minutes: 30,
          description:
            'Complete 3-5 practice problems to build foundational coherence',
        },
        {
          type: 'exploration',
          duration_minutes: 20,
          description: 'Explore related concepts to increase generativity',
        },
        {
          type: 'review',
          duration_minutes: 15,
          description: 'Review and consolidate to reduce entropy',
        },
      ],
      estimated_duration_hours: 1.08,
      confidence: 0.0,
    };

    return NextResponse.json(recommendation);
  } catch (error) {
    console.error('[Trajectory Recommend API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
