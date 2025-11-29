/**
 * Agent Activity API Endpoint
 *
 * Provides access to agent activity logs from the AgentInvoker.
 *
 * GET /api/agents/activity - List recent agent activity
 * GET /api/agents/activity?agentId=agent.legal - Filter by agent
 * GET /api/agents/activity?escalations=true - Get blocked escalations
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentInvoker, type AgentActivity } from '@/lib/agents';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agents/activity
 * Returns agent activity logs with optional filtering
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId');
    const escalationsOnly = searchParams.get('escalations') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let activities: AgentActivity[];

    if (escalationsOnly) {
      // Get pending escalations (blocked items)
      activities = agentInvoker.getPendingEscalations();
    } else if (agentId) {
      // Filter by specific agent
      activities = agentInvoker.getAgentActivity(agentId, limit);
    } else {
      // Get all recent activity
      activities = agentInvoker.getRecentActivity(limit);
    }

    // Calculate statistics
    const stats = {
      total: activities.length,
      executed: activities.filter((a) => a.wasExecuted).length,
      blocked: activities.filter((a) => !a.wasExecuted).length,
      by_escalation_level: {
        CRITICAL: activities.filter((a) => a.escalationLevel === 'CRITICAL').length,
        PROPOSE: activities.filter((a) => a.escalationLevel === 'PROPOSE').length,
        AUTO_EXECUTE: activities.filter((a) => a.escalationLevel === 'AUTO_EXECUTE').length,
      },
      by_agent: {} as Record<string, number>,
      avg_latency_ms:
        activities.length > 0
          ? Math.round(activities.reduce((sum, a) => sum + a.latencyMs, 0) / activities.length)
          : 0,
      total_tokens: activities.reduce((sum, a) => sum + a.tokensUsed, 0),
    };

    // Count by agent
    for (const activity of activities) {
      stats.by_agent[activity.agentId] = (stats.by_agent[activity.agentId] || 0) + 1;
    }

    return NextResponse.json({
      activities,
      stats,
      filters: {
        agentId: agentId || null,
        escalationsOnly,
        limit,
      },
    });
  } catch (error) {
    console.error('[Activity API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
