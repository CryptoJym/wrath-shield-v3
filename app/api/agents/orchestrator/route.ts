import { NextRequest, NextResponse } from 'next/server';
import {
  getOrchestratorContext,
  getPrivateMemory,
  getOrganizationalMemory,
  getCouncilStatus,
  getOrchestratorNotifications,
  recordOrchestratorDecision,
  learnFromInteraction,
  proposeOrchestratorPolicy,
} from '@/lib/agents/orchestrator-memory';
import {
  webSearch,
  conductResearch,
  factCheck,
  findPreviousResearch,
} from '@/lib/agents/orchestrator-research';

/**
 * Orchestrator Agent API
 *
 * Provides endpoints for:
 * - Status and council information
 * - Research operations
 * - Memory operations
 * - Policy proposals
 */

/**
 * GET /api/agents/orchestrator
 *
 * Get orchestrator status including:
 * - Council status (pending proposals, notifications)
 * - Recent memory context
 * - Agent health
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status': {
        const councilStatus = getCouncilStatus();
        const notifications = getOrchestratorNotifications();

        return NextResponse.json({
          agent: 'orchestrator-interface',
          status: 'active',
          council: {
            pendingProposals: councilStatus.pendingProposals,
            orchestratorProposals: councilStatus.orchestratorProposals.length,
            recentApprovals: councilStatus.recentApprovals.length,
          },
          notifications: {
            unread: councilStatus.unreadNotifications,
            items: notifications.slice(0, 5),
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'memory': {
        const query = searchParams.get('query') || 'recent activity';
        const limit = parseInt(searchParams.get('limit') || '10');
        const context = await getOrchestratorContext(query, limit);

        return NextResponse.json({
          query,
          results: {
            private: context.private.map((r) => ({
              text: r.memory.text.substring(0, 500),
              score: r.score,
              metadata: r.memory.metadata,
            })),
            org: context.org.map((r) => ({
              text: r.memory.text.substring(0, 500),
              score: r.score,
              metadata: r.memory.metadata,
            })),
          },
          timestamp: new Date().toISOString(),
        });
      }

      case 'previous-research': {
        const topic = searchParams.get('topic') || '';
        if (!topic) {
          return NextResponse.json({ error: 'Missing topic parameter' }, { status: 400 });
        }
        const research = await findPreviousResearch(topic, 5);
        return NextResponse.json({
          topic,
          results: research.map((r) => ({
            text: r.memory.text.substring(0, 500),
            score: r.score,
            metadata: r.memory.metadata,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[OrchestratorAPI] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get orchestrator status', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/orchestrator
 *
 * Perform orchestrator operations:
 * - research: Conduct web research and synthesis
 * - search: Quick web search
 * - fact-check: Verify a claim
 * - propose: Propose policy to org-council
 * - learn: Record a learning from interaction
 * - decision: Record a routing/coordination decision
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    switch (action) {
      case 'research': {
        const { topic, options } = body;
        if (!topic) {
          return NextResponse.json({ error: 'Missing topic for research' }, { status: 400 });
        }
        const summary = await conductResearch(topic, options);
        return NextResponse.json({
          action: 'research',
          topic,
          summary: {
            synthesis: summary.synthesis,
            confidence: summary.confidence,
            resultCount: summary.results.length,
            sources: summary.sources,
          },
          timestamp: summary.timestamp,
        });
      }

      case 'search': {
        const { query, maxResults } = body;
        if (!query) {
          return NextResponse.json({ error: 'Missing query for search' }, { status: 400 });
        }
        const results = await webSearch(query, { maxResults: maxResults || 5 });
        return NextResponse.json({
          action: 'search',
          query,
          results,
          timestamp: new Date().toISOString(),
        });
      }

      case 'fact-check': {
        const { claim } = body;
        if (!claim) {
          return NextResponse.json({ error: 'Missing claim for fact-check' }, { status: 400 });
        }
        const result = await factCheck(claim);
        return NextResponse.json({
          action: 'fact-check',
          claim,
          result,
          timestamp: new Date().toISOString(),
        });
      }

      case 'propose': {
        const { policy, rationale, category } = body;
        if (!policy || !rationale) {
          return NextResponse.json(
            { error: 'Missing policy or rationale for proposal' },
            { status: 400 }
          );
        }
        const proposal = await proposeOrchestratorPolicy(
          policy,
          rationale,
          category || 'governance',
          body.metadata
        );
        return NextResponse.json({
          action: 'propose',
          proposalId: proposal.id,
          status: proposal.status,
          timestamp: new Date().toISOString(),
        });
      }

      case 'learn': {
        const { knowledge, category } = body;
        if (!knowledge) {
          return NextResponse.json({ error: 'Missing knowledge for learning' }, { status: 400 });
        }
        await learnFromInteraction(
          knowledge,
          category || 'observation',
          body.metadata
        );
        return NextResponse.json({
          action: 'learn',
          recorded: true,
          timestamp: new Date().toISOString(),
        });
      }

      case 'decision': {
        const { type, description, targetAgents, rationale } = body;
        if (!type || !description || !rationale) {
          return NextResponse.json(
            { error: 'Missing required fields for decision (type, description, rationale)' },
            { status: 400 }
          );
        }
        const decisionId = await recordOrchestratorDecision({
          type,
          description,
          targetAgents,
          rationale,
          escalationLevel: body.escalationLevel,
          outcome: body.outcome,
          metadata: body.metadata,
        });
        return NextResponse.json({
          action: 'decision',
          decisionId,
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[OrchestratorAPI] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to execute orchestrator action', details: String(error) },
      { status: 500 }
    );
  }
}
