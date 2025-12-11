/**
 * Feedback API Endpoint
 * Handles submission and retrieval of agent feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeedbackCollector } from '@/lib/learning/feedback-collector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { agentId, responseId, rating } = body;
    if (!agentId || !responseId || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, responseId, rating' },
        { status: 400 }
      );
    }

    // Validate rating value
    const validRatings = ['helpful', 'somewhat_helpful', 'not_helpful'];
    if (!validRatings.includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be one of: helpful, somewhat_helpful, not_helpful' },
        { status: 400 }
      );
    }

    // Optional fields
    const { category, comment, context } = body;

    // Validate category if provided
    if (category) {
      const validCategories = ['accuracy', 'relevance', 'speed', 'tone', 'completeness'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: 'Invalid category. Must be one of: accuracy, relevance, speed, tone, completeness' },
          { status: 400 }
        );
      }
    }

    const collector = getFeedbackCollector();
    const feedbackId = await collector.recordFeedback({
      agentId,
      responseId,
      rating,
      category,
      comment,
      context
    });

    return NextResponse.json({
      success: true,
      feedbackId,
      message: 'Feedback recorded successfully'
    });

  } catch (error) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const period = searchParams.get('period') as 'day' | 'week' | 'month' || 'week';

    const collector = getFeedbackCollector();

    // Get metrics for specific agent or all agents
    if (agentId) {
      const stats = collector.getAgentStats(agentId, period);
      return NextResponse.json({
        agentId,
        period,
        stats
      });
    } else {
      const metrics = collector.getAllAgentMetrics();
      return NextResponse.json({
        metrics,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback data' },
      { status: 500 }
    );
  }
}
