/**
 * Hyro Recommendations API
 *
 * GET /api/hyro/recommendations - Get daily recommendations
 * POST /api/hyro/recommendations - Update recommendation status (accept/complete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
import {
  getDailyRecommendation,
  updateDailyRecommendation,
  updateLearningItem,
  getLearningItem,
} from '@/lib/hyro/store';
import { generateDailyRecommendations } from '@/lib/hyro/recommender';
import type { TopicCategory } from '@/lib/hyro/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const searchParams = req.nextUrl.searchParams;

    // Parse query params
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const regenerate = searchParams.get('regenerate') === 'true';
    const maxItems = parseInt(searchParams.get('max_items') || '5');
    const targetTime = parseInt(searchParams.get('target_time') || '120');
    const focusTopicsStr = searchParams.get('focus_topics');
    const focusTopics = focusTopicsStr ? focusTopicsStr.split(',') as TopicCategory[] : undefined;

    // Get or generate recommendations
    let recommendations = getDailyRecommendation(user_id, date);

    if (!recommendations || regenerate) {
      recommendations = await generateDailyRecommendations(user_id, {
        max_items: maxItems,
        target_time_minutes: targetTime,
        focus_topics: focusTopics,
      });
    }

    // Enrich with full item details
    const enrichedItems = await Promise.all(
      recommendations.items.map(async (recItem) => {
        const fullItem = getLearningItem(recItem.item_id);
        return {
          ...recItem,
          item: fullItem,
        };
      })
    );

    return NextResponse.json({
      ...recommendations,
      items: enrichedItems,
    });
  } catch (error) {
    console.error('[Hyro Recommendations API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user_id = currentUserOptional()?.userId || 'default';
    const body = await req.json();

    const { recommendation_id, item_id, action } = body;

    if (!recommendation_id || !item_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: recommendation_id, item_id, action' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const recommendations = getDailyRecommendation(user_id, today);

    if (!recommendations || recommendations.id !== recommendation_id) {
      return NextResponse.json(
        { error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'accept':
        // Mark item as accepted (user plans to do it)
        updateLearningItem(item_id, {
          status: 'in_progress',
          started_at: Math.floor(Date.now() / 1000),
        });

        // Update recommendation stats
        updateDailyRecommendation(recommendation_id, {
          accepted_count: recommendations.accepted_count + 1,
        });

        return NextResponse.json({ ok: true, action: 'accepted' });

      case 'complete':
        // Mark item as completed
        updateLearningItem(item_id, {
          status: 'completed',
          progress_percent: 100,
          completed_at: Math.floor(Date.now() / 1000),
        });

        // Update recommendation stats
        updateDailyRecommendation(recommendation_id, {
          completed_count: recommendations.completed_count + 1,
        });

        return NextResponse.json({ ok: true, action: 'completed' });

      case 'skip':
        // Mark item as archived (not interested)
        updateLearningItem(item_id, {
          status: 'archived',
        });

        return NextResponse.json({ ok: true, action: 'skipped' });

      case 'schedule':
        // Schedule for later
        const scheduledFor = body.scheduled_for; // Unix timestamp
        if (!scheduledFor) {
          return NextResponse.json(
            { error: 'scheduled_for timestamp required for schedule action' },
            { status: 400 }
          );
        }

        updateLearningItem(item_id, {
          status: 'scheduled',
          scheduled_for: scheduledFor,
        });

        return NextResponse.json({ ok: true, action: 'scheduled' });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Hyro Recommendations API] POST Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
