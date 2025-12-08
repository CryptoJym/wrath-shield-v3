/**
 * Agent Health API
 *
 * Provides real-time health status for all agents.
 *
 * GET /api/agents/health
 *   - Returns squad health summary with all agents
 *   - Query params:
 *     - agentId: Optional, filter to specific agent
 *     - quick: Optional, skip memory latency check for faster response
 *
 * Response:
 * {
 *   timestamp: string,
 *   squadHealthScore: number,
 *   agents: AgentHealthMetrics[],
 *   activeAgents: number,
 *   idleAgents: number,
 *   degradedAgents: number,
 *   offlineAgents: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSquadHealth,
  getAgentHealth,
  getQuickAgentHealth,
  type AgentHealthMetrics,
  type SquadHealthSummary,
} from '@/lib/agents/health';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const quick = searchParams.get('quick') === 'true';

    // Single agent health check
    if (agentId) {
      if (quick) {
        const health = getQuickAgentHealth(agentId);
        return NextResponse.json({
          ok: true,
          timestamp: new Date().toISOString(),
          agent: health,
        });
      }

      const health = await getAgentHealth(agentId);
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        agent: health,
      });
    }

    // Full squad health
    const squadHealth = await getSquadHealth();

    return NextResponse.json({
      ok: true,
      ...squadHealth,
    });
  } catch (error) {
    console.error('[API:agents/health] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch agent health',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
