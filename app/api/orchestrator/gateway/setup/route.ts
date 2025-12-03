/**
 * Orchestrator Gateway - Memory Setup Endpoint
 *
 * Provides an interactive flow for configuring memory across:
 * - Org-wide (priorities, principles, key decisions)
 * - Domain-specific (legal contexts, project histories)
 * - Agent configurations (preferences, working patterns)
 *
 * Flow: init → answer → confirm → complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentInvoker } from '@/lib/agents/AgentInvoker';
import {
  proposeOrgMemory,
  addAgentMemory,
  approveOrgProposal,
  type AgentId,
} from '@/lib/memory/zep';
import {
  getLifeCharter,
  getDomains,
  getAgents,
  getDomain,
  getAgent,
} from '@/lib/life-os-config';

// =============================================================================
// Types
// =============================================================================

interface SetupRequest {
  phase: 'init' | 'answer' | 'confirm' | 'complete';
  scope: 'org' | 'domain' | 'agent';
  targetId?: string;
  answers?: Record<string, string>;
  confirmations?: string[];
}

interface SetupQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'confirm';
  options?: string[];
  context?: string;
}

interface SetupProposal {
  id: string;
  text: string;
  targetGraph: string;
  reasoning: string;
}

interface SetupResponse {
  success: boolean;
  phase: string;
  questions?: SetupQuestion[];
  proposals?: SetupProposal[];
  completed?: boolean;
  summary?: string;
  error?: string;
}

// Session storage for multi-step setup
const setupSessions: Map<string, {
  scope: string;
  targetId?: string;
  answers: Record<string, string>;
  proposals: SetupProposal[];
  createdAt: number;
}> = new Map();

// Clean old sessions (older than 30 minutes)
function cleanOldSessions() {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  for (const [sessionId, session] of setupSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      setupSessions.delete(sessionId);
    }
  }
}

// =============================================================================
// Question Generation
// =============================================================================

function generateOrgQuestions(): SetupQuestion[] {
  const charter = getLifeCharter();
  const domains = getDomains();

  return [
    {
      id: 'priorities_correct',
      question: 'Are these life priorities still correct and in the right order?',
      type: 'confirm',
      context: charter.priority_stack.map((p, i) => `${i + 1}. ${p.name} (weight: ${p.weight})`).join('\n'),
    },
    {
      id: 'priority_changes',
      question: 'If priorities need adjustment, what changes should be made?',
      type: 'text',
      context: 'Leave blank if no changes needed.',
    },
    {
      id: 'new_principles',
      question: 'Any new global principles to add?',
      type: 'text',
      context: `Current principles:\n${charter.global_principles.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
    },
    {
      id: 'escalation_adjustments',
      question: 'Should any escalation rules be adjusted?',
      type: 'select',
      options: ['No changes needed', 'Make CRITICAL more sensitive', 'Make CRITICAL less sensitive', 'Adjust PROPOSE triggers'],
    },
    {
      id: 'key_context',
      question: 'What key context should all agents know about right now? (Current projects, urgent matters, important dates)',
      type: 'text',
    },
  ];
}

function generateDomainQuestions(domainId: string): SetupQuestion[] {
  const domain = getDomain(domainId);
  if (!domain) {
    return [{ id: 'error', question: 'Domain not found', type: 'text' }];
  }

  return [
    {
      id: 'domain_active',
      question: `Is the ${domain.name} domain currently active?`,
      type: 'confirm',
      context: domain.description,
    },
    {
      id: 'key_people_current',
      question: 'Are the key people for this domain still current?',
      type: 'confirm',
      context: `Current key people: ${domain.key_people.join(', ')}`,
    },
    {
      id: 'key_people_changes',
      question: 'Any changes to key people? (Add or remove)',
      type: 'text',
    },
    {
      id: 'current_priorities',
      question: 'What are the current priorities for this domain?',
      type: 'text',
    },
    {
      id: 'blockers',
      question: 'Any current blockers or issues in this domain?',
      type: 'text',
    },
    {
      id: 'upcoming_deadlines',
      question: 'Any important upcoming deadlines?',
      type: 'text',
    },
  ];
}

function generateAgentQuestions(agentId: string): SetupQuestion[] {
  const agent = getAgent(agentId);
  if (!agent) {
    return [{ id: 'error', question: 'Agent not found', type: 'text' }];
  }

  return [
    {
      id: 'agent_working',
      question: `Is the ${agent.name} agent working well for you?`,
      type: 'select',
      options: ['Yes, working great', 'Mostly good, minor issues', 'Needs improvement', 'Not using it'],
      context: `Role: ${agent.role}\nDomains: ${agent.domains.join(', ')}`,
    },
    {
      id: 'agent_issues',
      question: 'What issues or improvements would you like?',
      type: 'text',
    },
    {
      id: 'agent_context',
      question: 'Any specific context this agent should know about?',
      type: 'text',
    },
    {
      id: 'agent_preferences',
      question: 'Any preferences for how this agent should behave?',
      type: 'text',
    },
  ];
}

// =============================================================================
// Proposal Generation
// =============================================================================

async function generateProposals(
  scope: string,
  targetId: string | undefined,
  answers: Record<string, string>
): Promise<SetupProposal[]> {
  const proposals: SetupProposal[] = [];

  if (scope === 'org') {
    // Priority changes
    if (answers.priority_changes && answers.priority_changes.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_priorities`,
        text: `Priority Stack Update: ${answers.priority_changes}`,
        targetGraph: 'org-council',
        reasoning: 'User-requested priority adjustment during memory setup',
      });
    }

    // New principles
    if (answers.new_principles && answers.new_principles.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_principles`,
        text: `New Principle: ${answers.new_principles}`,
        targetGraph: 'org-council',
        reasoning: 'User-added global principle during memory setup',
      });
    }

    // Key context
    if (answers.key_context && answers.key_context.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_context`,
        text: `Current Context (${new Date().toISOString().split('T')[0]}): ${answers.key_context}`,
        targetGraph: 'org-council',
        reasoning: 'Current organizational context shared during memory setup',
      });
    }

    // Escalation adjustments
    if (answers.escalation_adjustments && answers.escalation_adjustments !== 'No changes needed') {
      proposals.push({
        id: `prop_${Date.now()}_escalation`,
        text: `Escalation Rule Adjustment Request: ${answers.escalation_adjustments}`,
        targetGraph: 'org-council',
        reasoning: 'User-requested escalation rule change',
      });
    }
  } else if (scope === 'domain' && targetId) {
    const domain = getDomain(targetId);
    if (!domain) return proposals;

    // Key people changes
    if (answers.key_people_changes && answers.key_people_changes.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_people`,
        text: `${domain.name} Key People Update: ${answers.key_people_changes}`,
        targetGraph: 'org-council',
        reasoning: 'Domain personnel change during memory setup',
      });
    }

    // Domain priorities
    if (answers.current_priorities && answers.current_priorities.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_priorities`,
        text: `${domain.name} Current Priorities: ${answers.current_priorities}`,
        targetGraph: domain.default_agent ? `agent:${domain.default_agent}` : 'org-council',
        reasoning: 'Domain priority update during memory setup',
      });
    }

    // Blockers
    if (answers.blockers && answers.blockers.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_blockers`,
        text: `${domain.name} Active Blockers: ${answers.blockers}`,
        targetGraph: domain.default_agent ? `agent:${domain.default_agent}` : 'org-council',
        reasoning: 'Domain blocker captured during memory setup',
      });
    }

    // Upcoming deadlines
    if (answers.upcoming_deadlines && answers.upcoming_deadlines.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_deadlines`,
        text: `${domain.name} Upcoming Deadlines: ${answers.upcoming_deadlines}`,
        targetGraph: domain.default_agent ? `agent:${domain.default_agent}` : 'org-council',
        reasoning: 'Domain deadline captured during memory setup',
      });
    }
  } else if (scope === 'agent' && targetId) {
    const agent = getAgent(targetId);
    if (!agent) return proposals;

    // Agent context
    if (answers.agent_context && answers.agent_context.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_context`,
        text: `Agent Context: ${answers.agent_context}`,
        targetGraph: `agent:${targetId}`,
        reasoning: 'Agent-specific context from user during setup',
      });
    }

    // Agent preferences
    if (answers.agent_preferences && answers.agent_preferences.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_prefs`,
        text: `Agent Preferences: ${answers.agent_preferences}`,
        targetGraph: `agent:${targetId}`,
        reasoning: 'Agent behavior preferences from user during setup',
      });
    }

    // Agent issues
    if (answers.agent_issues && answers.agent_issues.trim()) {
      proposals.push({
        id: `prop_${Date.now()}_issues`,
        text: `Agent Improvement Request: ${answers.agent_issues}`,
        targetGraph: 'org-council',
        reasoning: 'Agent improvement request escalated to council',
      });
    }
  }

  return proposals;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  cleanOldSessions();

  try {
    const body: SetupRequest = await request.json();
    const { phase, scope, targetId, answers, confirmations } = body;

    // Generate session ID based on scope/target
    const sessionId = `setup_${scope}_${targetId || 'global'}`;

    let response: SetupResponse;

    switch (phase) {
      case 'init': {
        // Start new setup session
        setupSessions.set(sessionId, {
          scope,
          targetId,
          answers: {},
          proposals: [],
          createdAt: Date.now(),
        });

        // Generate questions based on scope
        let questions: SetupQuestion[];
        if (scope === 'org') {
          questions = generateOrgQuestions();
        } else if (scope === 'domain') {
          if (!targetId) {
            return NextResponse.json(
              { success: false, error: 'targetId required for domain scope' },
              { status: 400 }
            );
          }
          questions = generateDomainQuestions(targetId);
        } else if (scope === 'agent') {
          if (!targetId) {
            return NextResponse.json(
              { success: false, error: 'targetId required for agent scope' },
              { status: 400 }
            );
          }
          questions = generateAgentQuestions(targetId);
        } else {
          return NextResponse.json(
            { success: false, error: `Unknown scope: ${scope}` },
            { status: 400 }
          );
        }

        response = {
          success: true,
          phase: 'init',
          questions,
        };
        break;
      }

      case 'answer': {
        const session = setupSessions.get(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'No active setup session. Call init first.' },
            { status: 400 }
          );
        }

        // Store answers
        session.answers = { ...session.answers, ...answers };

        // Generate proposals based on answers
        const proposals = await generateProposals(scope, targetId, session.answers);
        session.proposals = proposals;

        response = {
          success: true,
          phase: 'answer',
          proposals,
        };
        break;
      }

      case 'confirm': {
        const session = setupSessions.get(sessionId);
        if (!session) {
          return NextResponse.json(
            { success: false, error: 'No active setup session.' },
            { status: 400 }
          );
        }

        const confirmed = confirmations || session.proposals.map(p => p.id);
        const results: string[] = [];

        for (const proposal of session.proposals) {
          if (!confirmed.includes(proposal.id)) continue;

          if (proposal.targetGraph === 'org-council') {
            // Create org-council proposal
            const orgProposal = await proposeOrgMemory(
              'orchestrator-agent',
              proposal.text,
              { source: 'memory_setup', reasoning: proposal.reasoning }
            );
            // Auto-approve since this is user-driven setup
            await approveOrgProposal(orgProposal.id, 'user-setup');
            results.push(`Org: ${proposal.text.substring(0, 50)}...`);
          } else if (proposal.targetGraph.startsWith('agent:')) {
            // Add to agent memory
            const agentId = proposal.targetGraph.replace('agent:', '') as AgentId;
            await addAgentMemory(agentId, proposal.text, {
              source: 'memory_setup',
              reasoning: proposal.reasoning,
            });
            results.push(`Agent (${agentId}): ${proposal.text.substring(0, 50)}...`);
          }
        }

        response = {
          success: true,
          phase: 'confirm',
          summary: `Confirmed ${results.length} memory entries:\n${results.join('\n')}`,
        };
        break;
      }

      case 'complete': {
        const session = setupSessions.get(sessionId);

        // Clean up session
        setupSessions.delete(sessionId);

        response = {
          success: true,
          phase: 'complete',
          completed: true,
          summary: session
            ? `Memory setup completed for ${scope}${targetId ? ` (${targetId})` : ''}. ${session.proposals.length} entries processed.`
            : 'Setup session completed.',
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown phase: ${phase}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Gateway Setup] Error:', error);
    return NextResponse.json(
      {
        success: false,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
