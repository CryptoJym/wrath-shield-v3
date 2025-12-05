/**
 * PM Dashboard API
 *
 * GET /api/pm/dashboard - Returns complete PM dashboard data
 *
 * Enhanced with council activity summary for the cognitive prosthesis paradigm.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPMDashboardData } from '@/lib/pm/integration';
import { getActionableItems, getDigestStats } from '@/lib/pm/daily-digest';
import { generateDailySuggestions } from '@/lib/pm/predictive-suggestions';
import { getAccuracyMetrics } from '@/lib/pm/correction-feedback';
import { getQueueStatus } from '@/lib/pm/task-queue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get existing dashboard data
    const dashboardData = await getPMDashboardData();

    // Get council activity data
    const { proposals, escalations } = await getActionableItems();

    // Get digest stats for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats = await getDigestStats(today);

    // Get suggestions
    let suggestionsCount = 0;
    try {
      const suggestions = await generateDailySuggestions();
      // Only count active suggestions (not expired)
      const now = new Date();
      suggestionsCount = suggestions.filter(s => {
        if (s.metadata?.expires_at) {
          return new Date(s.metadata.expires_at) > now;
        }
        return true;
      }).length;
    } catch (error) {
      console.warn('[PM Dashboard] Failed to get suggestions:', error);
    }

    // Get accuracy metrics
    let accuracyRate = 0;
    try {
      const metrics = await getAccuracyMetrics();
      accuracyRate = metrics.accuracy_rate || 0;
    } catch (error) {
      console.warn('[PM Dashboard] Failed to get accuracy:', error);
    }

    // Get queue status
    const queueStatus = await getQueueStatus();

    // Build council activity summary
    const council = {
      auto_actions_today: stats.decisions_auto || 0,
      pending_proposals: proposals.length,
      active_escalations: escalations.length,
      suggestions_available: suggestionsCount,
      accuracy_rate: Math.round(accuracyRate * 100) / 100,
    };

    // Build needs attention summary
    const needs_attention = {
      critical_escalations: escalations.filter(e => e.severity === 'critical').length,
      pending_proposals: proposals.length,
      failed_queue_items: queueStatus.failed,
    };

    return NextResponse.json({
      ok: true,
      ...dashboardData,
      council,
      needs_attention,
    });
  } catch (error) {
    console.error('[PM Dashboard API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
