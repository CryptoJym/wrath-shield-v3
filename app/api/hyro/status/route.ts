/**
 * Hyro Agent Status API
 *
 * GET /api/hyro/status - Returns Hyro agent health and statistics
 */

import { NextResponse } from 'next/server';
import { currentUserOptional } from '@/lib/auth/user';
import {
  listLearningItems,
  getLearningProgress,
  getDailyRecommendation,
  listCrawlerConfigs,
} from '@/lib/hyro/store';
import type { HyroAgentStatus } from '@/lib/hyro/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user_id = currentUserOptional()?.userId || 'default';

    // Get learning items and progress
    const progress = getLearningProgress(user_id);
    const pendingItems = listLearningItems({ user_id, status: 'pending', limit: 100 });
    const recentItems = listLearningItems({ user_id, limit: 5 });

    // Get today's recommendations
    const today = new Date().toISOString().split('T')[0];
    const todayRecs = getDailyRecommendation(user_id, today);

    // Get crawler configs
    const crawlers = listCrawlerConfigs();
    const activeCrawlers = crawlers.filter(c => c.enabled);

    // Calculate health score
    // Factors: recent activity, completion rate, active sources
    let healthScore = 50; // Base score

    // Boost for recent activity
    if (progress.last_activity_at) {
      const daysSinceActivity = (Date.now() / 1000 - progress.last_activity_at) / (60 * 60 * 24);
      if (daysSinceActivity < 1) healthScore += 30;
      else if (daysSinceActivity < 3) healthScore += 20;
      else if (daysSinceActivity < 7) healthScore += 10;
    }

    // Boost for completion rate
    if (progress.total_items > 0) {
      const completionRate = progress.completed_items / progress.total_items;
      healthScore += completionRate * 20;
    }

    // Boost for active sources
    if (activeCrawlers.length > 0) {
      healthScore += Math.min(20, activeCrawlers.length * 4);
    }

    // Penalize for stale sources
    const now = Math.floor(Date.now() / 1000);
    const staleCrawlers = crawlers.filter(c => c.enabled && c.last_sync_at && (now - c.last_sync_at) > 7 * 24 * 60 * 60);
    healthScore -= staleCrawlers.length * 5;

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine status color
    let statusColor: 'green' | 'yellow' | 'red' = 'green';
    if (healthScore < 40 || activeCrawlers.length === 0) {
      statusColor = 'red';
    } else if (healthScore < 65 || pendingItems.length === 0) {
      statusColor = 'yellow';
    }

    // Get last sync time
    const lastSync = crawlers
      .filter(c => c.last_sync_at)
      .sort((a, b) => (b.last_sync_at || 0) - (a.last_sync_at || 0))[0]?.last_sync_at;

    const lastSyncISO = lastSync
      ? new Date(lastSync * 1000).toISOString()
      : new Date().toISOString();

    // Last recommendation time
    const lastRecISO = todayRecs
      ? new Date(todayRecs.created_at * 1000).toISOString()
      : new Date().toISOString();

    // Items completed today
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const completedToday = listLearningItems({ user_id, status: 'completed', limit: 100 })
      .filter(i => (i.completed_at || 0) >= todayStart).length;

    const status: HyroAgentStatus = {
      ok: statusColor !== 'red',
      agent: 'hyro',
      status: statusColor,
      health_score: Math.round(healthScore),
      pending_items: pendingItems.length,
      recommendations_today: todayRecs?.items.length || 0,
      items_completed_today: completedToday,
      last_sync: lastSyncISO,
      last_recommendation: lastRecISO,
      total_sources: crawlers.length,
      active_sources: activeCrawlers.length,
      total_learning_items: progress.total_items,
      recent_items: recentItems.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        updated_at: i.updated_at,
      })),
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Hyro Status API] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        agent: 'hyro',
        status: 'red',
        health_score: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
