/**
 * Example API Route using Meta-Learner
 * 
 * This shows how to integrate the meta-learning system into Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMetaLearner,
  recordLearningTrajectory,
  getPatternStatistics,
  getTrajectoryHistory,
  StateVector,
  Intervention,
  TrajectoryPlan,
} from '@/lib/hyro/forge-meta-learner';

// ============================================================================
// GET /api/hyro/meta-learner/stats
// Get meta-learning statistics
// ============================================================================

export async function GET_Stats(request: NextRequest) {
  try {
    const stats = getPatternStatistics();
    
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[API] Meta-learner stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/hyro/meta-learner/recommend
// Get recommended trajectory for a student
// ============================================================================

export async function POST_Recommend(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      statName,
      targetState,
      currentState,
    } = body;
    
    if (!studentId || !statName || !targetState) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const learner = getMetaLearner();
    
    const plan = learner.recommendTrajectory(
      studentId,
      statName,
      targetState as StateVector,
      currentState as StateVector | undefined
    );
    
    return NextResponse.json({
      success: true,
      data: { plan },
    });
  } catch (error) {
    console.error('[API] Recommend trajectory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to recommend trajectory' },
      { status: 500 }
    );
  }
}
