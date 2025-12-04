/**
 * API Route: GET /api/hyro/parent/insights
 * Returns AI-generated insights for parent dashboard
 */

import { NextResponse } from 'next/server';
import { getParentSummary, generateAIInsights } from '@/lib/hyro/forge-parent-dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getParentSummary();
    const insights = await generateAIInsights(summary);

    return NextResponse.json({
      success: true,
      data: {
        insights,
        summary_stats: {
          xp_earned: summary.stats.xp_earned,
          sessions: summary.stats.sessions,
          streak: summary.stats.streak_days,
        },
      },
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate insights',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to regenerate insights with custom context
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { period_days } = body;

    // For now, just use default week
    // Could extend to support custom period
    const summary = await getParentSummary();
    const insights = await generateAIInsights(summary);

    return NextResponse.json({
      success: true,
      data: { insights },
    });
  } catch (error) {
    console.error('Error regenerating insights:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate insights',
      },
      { status: 500 }
    );
  }
}
