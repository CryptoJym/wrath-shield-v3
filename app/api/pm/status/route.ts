/**
 * PM Status API
 *
 * GET /api/pm/status - Returns PM agent status summary
 * Aggregates data from context-requests (PM-routed items), relationships, and events
 */

import { NextResponse } from 'next/server';
import {
  getRoutingStats,
  getPendingCountByTarget,
  getAllContextRequests,
} from '@/lib/context_requests';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = getRoutingStats();
    const pendingByTarget = getPendingCountByTarget();

    // Get all PM-specific requests (not limited to get accurate metrics)
    let allPmRequests = getAllContextRequests({
      target: 'pm',
    });

    // No seed data in production - if no real requests exist, that's the actual state

    const now = Math.floor(Date.now() / 1000);

    // Calculate detailed metrics
    const pmPending = allPmRequests.filter((r: any) => r.status === 'pending').length;
    const pmProcessing = allPmRequests.filter((r: any) => r.status === 'processing').length;
    const pmDone = allPmRequests.filter((r: any) => r.status === 'done').length;
    const pmFailed = allPmRequests.filter((r: any) => r.status === 'failed').length;
    const totalPmItems = allPmRequests.length;

    // Calculate overdue items (pending > 24 hours)
    const overdueItems = allPmRequests.filter((r: any) =>
      r.status === 'pending' && (now - r.created_at) > 86400
    ).length;

    // Calculate average age of pending items (in hours)
    const pendingItems = allPmRequests.filter((r: any) => r.status === 'pending');
    const avgPendingAge = pendingItems.length > 0
      ? Math.round(pendingItems.reduce((sum: number, r: any) => sum + (now - r.created_at), 0) / pendingItems.length / 3600)
      : 0;

    // Calculate resolution rate (done / total, excluding failed)
    const resolutionRate = (totalPmItems - pmFailed) > 0
      ? Math.round((pmDone / (totalPmItems - pmFailed)) * 100)
      : 100;

    // Enhanced health score calculation
    // Factors:
    // - Resolution rate (40% weight)
    // - Overdue items penalty (30% weight)
    // - Pending items ratio (20% weight)
    // - Average pending age (10% weight)
    let healthScore = 100;

    // Resolution rate component (0-40 points)
    healthScore = resolutionRate * 0.4;

    // Overdue penalty (0-30 points deduction)
    const overdueRatio = totalPmItems > 0 ? overdueItems / totalPmItems : 0;
    healthScore -= overdueRatio * 30;

    // Pending items ratio penalty (0-20 points deduction)
    const pendingRatio = totalPmItems > 0 ? pmPending / totalPmItems : 0;
    if (pendingRatio > 0.5) healthScore -= 20;
    else if (pendingRatio > 0.3) healthScore -= 10;

    // Average pending age penalty (0-10 points deduction)
    if (avgPendingAge > 48) healthScore -= 10; // > 2 days
    else if (avgPendingAge > 24) healthScore -= 5; // > 1 day

    // Clamp between 0-100
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    // Determine status color based on health score and critical factors
    let statusColor: 'green' | 'yellow' | 'red' = 'green';
    if (overdueItems > 3 || healthScore < 50 || pmPending > 10) {
      statusColor = 'red';
    } else if (overdueItems > 0 || healthScore < 75 || pmPending > 5) {
      statusColor = 'yellow';
    }

    return NextResponse.json({
      ok: true,
      agent: 'pm',
      status: statusColor,
      health_score: healthScore,
      pending: pmPending,
      processing: pmProcessing,
      resolved: pmDone,
      failed: pmFailed,
      total_routed: totalPmItems,
      overdue: overdueItems,
      avg_pending_age_hours: avgPendingAge,
      resolution_rate: resolutionRate,
      recent_items: allPmRequests.slice(0, 10).map((r: any) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        event_subject: r.event_payload?.subject,
        channel: r.event_payload?.channel,
      })),
      routing_summary: {
        total: stats.total,
        by_status: stats.by_status,
        pending_by_target: pendingByTarget,
      },
    });
  } catch (error) {
    console.error('[PM Status API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
