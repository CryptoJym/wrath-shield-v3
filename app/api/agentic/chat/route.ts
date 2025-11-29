import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/agents/AgentInvoker';
import { detectDomain } from '@/lib/agent_bus';

/**
 * Agentic Chat API
 *
 * Now routes through AgentInvoker for Life OS integration.
 * Falls back to external agentic service if configured.
 */
export async function POST(request: NextRequest) {
  try {
    const incoming = await request.json();

    // Normalize payload: support both {query,...} and {messages:[...]} shapes
    let query: string | undefined = typeof incoming?.query === 'string' ? incoming.query : undefined;
    let conversation_history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined = incoming?.conversation_history;
    const user_id: string | undefined = incoming?.user_id || 'default';
    const agentId: string | undefined = incoming?.agent_id;

    if (!query && Array.isArray(incoming?.messages)) {
      const msgs = incoming.messages as Array<{ role: string; content: string }>;
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user' && typeof m?.content === 'string');
      query = lastUser?.content || '';
      conversation_history = msgs
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    }

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    // Use AgentInvoker for Life OS routing
    const useLifeOS = process.env.USE_LIFE_OS_AGENTS !== 'false';

    if (useLifeOS) {
      // Detect domain from content
      const detectedDomain = detectDomain(query);

      // Determine which agent to use (default to orchestrator)
      const targetAgent = agentId || 'agent.orchestrator';

      // Invoke via AgentInvoker
      const response = await invokeAgent({
        agentId: targetAgent,
        userMessage: query,
        context: {
          domainId: detectedDomain || undefined,
          metadata: {
            user_id,
            conversation_history: conversation_history?.slice(-5), // Last 5 messages for context
          },
        },
      });

      return NextResponse.json({
        message: response.content,
        agent_id: response.agentId,
        model: response.model,
        escalation_level: response.escalationLevel,
        should_execute: response.shouldExecute,
        detected_domain: response.detectedDomain,
        request_id: response.requestId,
        latency_ms: response.latencyMs,
        tokens_used: response.tokensUsed,
      });
    }

    // Fallback: proxy to external agentic service
    const base = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
    const payload = { query, conversation_history, user_id };

    const resp = await fetch(`${base}/api/agentic/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    console.error('[Next Agentic Chat] Error:', e);
    return NextResponse.json({ error: 'Agentic chat failed', details: e.message }, { status: 500 });
  }
}
