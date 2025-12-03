import { NextRequest, NextResponse } from 'next/server';
import { invokeAgent } from '@/lib/agents/AgentInvoker';
import {
  getOrchestratorContext,
  recordOrchestratorDecision,
} from '@/lib/agents/orchestrator-memory';
import {
  parseActionFromResponse,
  executePMAction,
  type PMAction,
} from '@/lib/pm/pm-actions';

/**
 * Agent Chat API
 *
 * Unified chat endpoint for all agents with memory context.
 * Each agent gets its own private memory context plus optional
 * orchestrator (system) context for cross-domain awareness.
 *
 * For PM agent, responses can include executable actions that
 * will be parsed and optionally executed.
 *
 * POST /api/agents/chat
 * {
 *   message: string;
 *   agentId: string;
 *   domain?: string;
 *   includeOrchestratorContext?: boolean;
 *   autoExecuteActions?: boolean; // For PM agent, auto-execute parsed actions
 *   history?: Array<{ role: 'user' | 'assistant'; content: string }>;
 * }
 */

interface ChatRequest {
  message: string;
  agentId: string;
  domain?: string;
  includeOrchestratorContext?: boolean;
  autoExecuteActions?: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// Map domains to helpful context prefixes
const DOMAIN_CONTEXTS: Record<string, string> = {
  finance: `You are helping with financial matters. Focus on transactions, expenses, reimbursements, and budgeting.`,
  pm: `You are helping with project management. Focus on tasks, repos, GitHub projects, and organization.`,
  education: `You are helping with education for Hyro. Focus on lesson plans, assignments, learning progress, and curriculum.`,
  legal: `You are helping with legal matters. Be careful and precise. Focus on compliance, FCRA, and legal strategy.`,
  comms: `You are helping with communications. Focus on emails, messages, contacts, and follow-ups.`,
  hyro: `You are helping with Hyro's education and recommendations. Focus on learning and daily recommendations.`,
};

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const {
      message,
      agentId,
      domain,
      includeOrchestratorContext = true,
      autoExecuteActions = false,
      history = [],
    } = body;

    if (!message || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, agentId' },
        { status: 400 }
      );
    }

    // Build context from various sources
    const contextParts: string[] = [];

    // Add domain-specific context
    if (domain && DOMAIN_CONTEXTS[domain]) {
      contextParts.push(DOMAIN_CONTEXTS[domain]);
    }

    // Add orchestrator (system) context if requested
    if (includeOrchestratorContext) {
      try {
        const orchestratorContext = await getOrchestratorContext(message, 3);

        if (orchestratorContext.org.length > 0) {
          contextParts.push('\n### Organizational Context (from system memory):');
          for (const mem of orchestratorContext.org.slice(0, 3)) {
            contextParts.push(`- ${mem.memory.text.split('\n')[0].substring(0, 200)}`);
          }
        }
      } catch (error) {
        console.warn('[AgentChat] Failed to fetch orchestrator context:', error);
      }
    }

    // Build the full prompt
    let fullPrompt = message;
    if (contextParts.length > 0) {
      fullPrompt = `${contextParts.join('\n')}\n\n### User Query:\n${message}`;
    }

    // Build conversation history for context
    const conversationHistory = history.slice(-6); // Last 6 messages for context

    // Invoke the agent with memory context
    const result = await invokeAgent({
      agentId,
      userMessage: fullPrompt,
      context: {
        domainId: domain,
        metadata: {
          domain,
          source: 'agent-chat-widget',
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Record this interaction in orchestrator memory if it seems significant
    if (result.content && result.content.length > 100) {
      try {
        await recordOrchestratorDecision({
          type: 'delegation',
          description: `Chat interaction with ${agentId}`,
          targetAgents: [agentId],
          rationale: message.substring(0, 100),
          escalationLevel: 'auto',
          metadata: {
            domain,
            responseLength: result.content.length,
          },
        });
      } catch (error) {
        // Don't fail if memory recording fails
        console.warn('[AgentChat] Failed to record interaction:', error);
      }
    }

    // For PM agent, parse and optionally execute actions from response
    let actionResult = null;
    let parsedAction: PMAction | null = null;

    if (agentId === 'agent.pm' && result.content) {
      parsedAction = parseActionFromResponse(result.content);

      if (parsedAction && autoExecuteActions) {
        try {
          actionResult = await executePMAction(parsedAction);
          console.log('[AgentChat] PM action executed:', actionResult);
        } catch (actionError) {
          console.warn('[AgentChat] PM action execution failed:', actionError);
          actionResult = {
            success: false,
            error: String(actionError),
          };
        }
      }
    }

    return NextResponse.json({
      response: result.content,
      agentId,
      domain,
      escalationLevel: result.escalationLevel,
      timestamp: new Date().toISOString(),
      // PM-specific: include action info if present
      action: parsedAction
        ? {
            parsed: parsedAction,
            executed: autoExecuteActions,
            result: actionResult,
          }
        : null,
    });
  } catch (error) {
    console.error('[AgentChat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/chat?agentId=X&action=context
 *
 * Get memory context for an agent without sending a message.
 * Useful for understanding what the agent knows about a topic.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const action = searchParams.get('action') || 'info';
    const query = searchParams.get('query');

    if (action === 'info') {
      // Return info about available agents
      return NextResponse.json({
        agents: [
          { id: 'agent.orchestrator.interface', name: 'Orchestrator', domain: '*' },
          { id: 'agent.finance', name: 'Finance Analyst', domain: 'finance' },
          { id: 'agent.pm', name: 'Project Maestro', domain: 'pm' },
          { id: 'agent.hyro', name: 'Hyro Education', domain: 'education' },
          { id: 'agent.legal', name: 'Legal Advocate', domain: 'legal' },
          { id: 'agent.comms', name: 'Inbox Steward', domain: 'comms' },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'context' && agentId && query) {
      // Get memory context for a query
      const context = await getOrchestratorContext(query, 5);

      return NextResponse.json({
        agentId,
        query,
        context: {
          private: context.private.map(r => ({
            text: r.memory.text.substring(0, 300),
            score: r.score,
          })),
          org: context.org.map(r => ({
            text: r.memory.text.substring(0, 300),
            score: r.score,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: 'Invalid action or missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('[AgentChat] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent info', details: String(error) },
      { status: 500 }
    );
  }
}
