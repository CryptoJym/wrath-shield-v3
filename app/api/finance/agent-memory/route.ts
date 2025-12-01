import { NextRequest, NextResponse } from 'next/server';
import {
  searchAgentMemory,
  addAgentMemory,
  proposeOrgMemory,
  searchOrgMemory,
  getPendingOrgProposals,
  type AgentId,
} from '@/lib/memory/zep';

const FINANCE_AGENT_ID: AgentId = 'finance-agent';

/**
 * Finance Agent Memory API
 *
 * Provides direct access to the Finance Agent's Zep memory:
 * - GET: Retrieve agent's memories (private + org-council)
 * - POST: Add new memory or propose org-level knowledge
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query') || '';
  const type = searchParams.get('type') || 'all'; // 'private', 'org', 'all', 'proposals'
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    if (type === 'proposals') {
      // Get pending council proposals
      const proposals = getPendingOrgProposals();
      const financeProposals = proposals.filter(p => p.proposedBy === FINANCE_AGENT_ID);
      return NextResponse.json({
        type: 'proposals',
        proposals: financeProposals,
        total: financeProposals.length,
      });
    }

    // Search for memories
    let privateMemories: any[] = [];
    let orgMemories: any[] = [];

    if (type === 'private' || type === 'all') {
      privateMemories = await searchAgentMemory(FINANCE_AGENT_ID, query || '*', limit);
    }

    if (type === 'org' || type === 'all') {
      orgMemories = await searchOrgMemory(query || 'finance expense reimbursement', limit);
    }

    return NextResponse.json({
      type,
      query: query || null,
      private: {
        memories: privateMemories.map(r => ({
          id: r.memory.id,
          text: r.memory.text,
          score: r.score,
          createdAt: r.memory.createdAt,
          metadata: r.memory.metadata,
        })),
        count: privateMemories.length,
      },
      org: {
        memories: orgMemories.map(r => ({
          id: r.memory.id,
          text: r.memory.text,
          score: r.score,
          createdAt: r.memory.createdAt,
          metadata: r.memory.metadata,
        })),
        count: orgMemories.length,
      },
      agentId: FINANCE_AGENT_ID,
    });
  } catch (error) {
    console.error('[Finance Agent Memory] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve agent memory', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, text, metadata, isOrgKnowledge } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing required field: text' }, { status: 400 });
    }

    if (action === 'learn' || action === 'add') {
      // Add to agent's private memory (learning from corrections/notes)
      await addAgentMemory(FINANCE_AGENT_ID, text, {
        source: 'user_correction',
        action,
        timestamp: new Date().toISOString(),
        ...metadata,
      });

      return NextResponse.json({
        success: true,
        action: 'added_to_private_memory',
        agentId: FINANCE_AGENT_ID,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      });
    }

    if (action === 'propose' || isOrgKnowledge) {
      // Propose to org-council graph (requires approval)
      const proposal = await proposeOrgMemory(FINANCE_AGENT_ID, text, {
        source: 'finance_agent',
        type: 'rule_proposal',
        timestamp: new Date().toISOString(),
        ...metadata,
      });

      return NextResponse.json({
        success: true,
        action: 'proposed_to_council',
        proposalId: proposal.id,
        status: proposal.status,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        message: 'Proposal submitted to council for review',
      });
    }

    return NextResponse.json({ error: 'Unknown action. Use: learn, add, or propose' }, { status: 400 });
  } catch (error) {
    console.error('[Finance Agent Memory] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add agent memory', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
