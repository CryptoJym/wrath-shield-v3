/**
 * Semantic Learning Bridge API
 *
 * GET: Get learning statistics and recent insights
 * POST: Trigger a manual learning cycle
 */

import { NextResponse } from 'next/server';
import {
  getSemanticLearningBridge,
  triggerLearningCycle,
} from '@/lib/learning/semantic-learning-bridge';

// GET /api/cortex/learning - Get learning stats
export async function GET() {
  try {
    const bridge = getSemanticLearningBridge();
    const stats = bridge.getStats();
    const recentInsights = bridge.getRecentInsights(10);

    return NextResponse.json({
      success: true,
      stats,
      recentInsights,
    });
  } catch (error) {
    console.error('[API/Learning] GET failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/cortex/learning - Trigger a learning cycle
export async function POST() {
  try {
    const startTime = Date.now();
    const insights = await triggerLearningCycle();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      insightsGenerated: insights.length,
      insightsApplied: insights.filter((i) => i.applied).length,
      durationMs,
      insights,
    });
  } catch (error) {
    console.error('[API/Learning] POST failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
