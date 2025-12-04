/**
 * Orchestrator Memory Module
 *
 * Provides specialized memory operations for the Orchestrator agent with:
 * - Direct access to private orchestrator graph (wrath-shield-orchestrator-agent)
 * - Read access to org-council graph (wrath-shield-org-council)
 * - Ability to propose organizational policies to council
 * - Decision logging and rationale tracking
 *
 * The Orchestrator is the "power interface" for the system, coordinating
 * all other agents and maintaining organizational coherence.
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  addAgentMemory,
  searchAgentMemory,
  searchOrgMemory,
  searchAllMemory,
  proposeOrgMemory,
  getPendingOrgProposals,
  getAllOrgProposals,
  getProposalCounts,
  getUnreadNotifications,
  getUnreadNotificationCount,
  type AgentId,
  type ZepSearchResult,
  type OrgCouncilProposal,
} from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/agents/orchestrator-memory');

const ORCHESTRATOR_AGENT_ID: AgentId = 'orchestrator-agent';

export interface OrchestratorDecision {
  id: string;
  timestamp: string;
  type: 'routing' | 'escalation' | 'coordination' | 'policy' | 'delegation';
  description: string;
  targetAgents?: string[];
  rationale: string;
  escalationLevel?: 'AUTO_EXECUTE' | 'PROPOSE' | 'CRITICAL';
  outcome?: string;
  metadata?: Record<string, any>;
}

export interface CouncilStatus {
  pendingProposals: number;
  recentApprovals: OrgCouncilProposal[];
  unreadNotifications: number;
  orchestratorProposals: OrgCouncilProposal[];
}

/**
 * Get combined context from both private and org-council graphs
 */
export async function getOrchestratorContext(
  query: string,
  limit: number = 5
): Promise<{ private: ZepSearchResult[]; org: ZepSearchResult[] }> {
  const results = await searchAllMemory(ORCHESTRATOR_AGENT_ID, query, limit);
  return {
    private: results.agent,
    org: results.org,
  };
}

/**
 * Get orchestrator's private memory only
 */
export async function getPrivateMemory(
  query: string,
  limit: number = 10
): Promise<ZepSearchResult[]> {
  return searchAgentMemory(ORCHESTRATOR_AGENT_ID, query, limit);
}

/**
 * Get organizational knowledge (council-approved)
 */
export async function getOrganizationalMemory(
  query: string,
  limit: number = 10
): Promise<ZepSearchResult[]> {
  return searchOrgMemory(query, limit);
}

/**
 * Record an orchestrator decision to private memory
 */
export async function recordOrchestratorDecision(
  decision: Omit<OrchestratorDecision, 'id' | 'timestamp'>
): Promise<string> {
  const id = `decision_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();

  const fullDecision: OrchestratorDecision = {
    id,
    timestamp,
    ...decision,
  };

  const text = `[ORCHESTRATOR DECISION] ${decision.type.toUpperCase()}
Description: ${decision.description}
${decision.targetAgents?.length ? `Target Agents: ${decision.targetAgents.join(', ')}` : ''}
Rationale: ${decision.rationale}
${decision.escalationLevel ? `Escalation: ${decision.escalationLevel}` : ''}
${decision.outcome ? `Outcome: ${decision.outcome}` : ''}`;

  await addAgentMemory(ORCHESTRATOR_AGENT_ID, text, {
    type: 'decision',
    decision_id: id,
    decision_type: decision.type,
    escalation_level: decision.escalationLevel,
    target_agents: decision.targetAgents,
    ...decision.metadata,
  });

  console.log(`[OrchestratorMemory] Recorded decision: ${id}`);
  return id;
}

/**
 * Record a routing decision (which agent handled what)
 */
export async function recordRoutingDecision(
  request: string,
  targetAgents: string[],
  rationale: string,
  metadata?: Record<string, any>
): Promise<string> {
  return recordOrchestratorDecision({
    type: 'routing',
    description: `Routed request to agents: ${targetAgents.join(', ')}`,
    targetAgents,
    rationale,
    metadata: { original_request: request, ...metadata },
  });
}

/**
 * Record an escalation decision
 */
export async function recordEscalationDecision(
  description: string,
  escalationLevel: 'AUTO_EXECUTE' | 'PROPOSE' | 'CRITICAL',
  rationale: string,
  metadata?: Record<string, any>
): Promise<string> {
  return recordOrchestratorDecision({
    type: 'escalation',
    description,
    rationale,
    escalationLevel,
    metadata,
  });
}

/**
 * Add general knowledge to orchestrator's private memory
 */
export async function learnFromInteraction(
  knowledge: string,
  category: 'pattern' | 'preference' | 'context' | 'observation',
  metadata?: Record<string, any>
): Promise<void> {
  const text = `[${category.toUpperCase()}] ${knowledge}`;

  await addAgentMemory(ORCHESTRATOR_AGENT_ID, text, {
    type: 'learning',
    category,
    ...metadata,
  });

  console.log(`[OrchestratorMemory] Added learning: ${category}`);
}

/**
 * Propose an organizational policy to the council
 */
export async function proposeOrchestratorPolicy(
  policy: string,
  rationale: string,
  category: 'routing' | 'escalation' | 'coordination' | 'governance',
  metadata?: Record<string, any>
): Promise<OrgCouncilProposal> {
  const proposalText = `[POLICY PROPOSAL - ${category.toUpperCase()}]
Policy: ${policy}

Rationale: ${rationale}

Proposed by: Orchestrator Agent`;

  const proposal = await proposeOrgMemory(ORCHESTRATOR_AGENT_ID, proposalText, {
    type: 'policy_proposal',
    category,
    policy_text: policy,
    rationale,
    ...metadata,
  });

  // Also record this in private memory
  await addAgentMemory(ORCHESTRATOR_AGENT_ID,
    `Submitted policy proposal to council: ${policy}`, {
    type: 'proposal_submitted',
    proposal_id: proposal.id,
    category,
  });

  console.log(`[OrchestratorMemory] Submitted policy proposal: ${proposal.id}`);
  return proposal;
}

/**
 * Get current council status for orchestrator awareness
 */
export function getCouncilStatus(): CouncilStatus {
  const counts = getProposalCounts();
  const pendingProposals = getPendingOrgProposals();
  const recentApprovals = getAllOrgProposals('approved', 5);
  const unreadCount = getUnreadNotificationCount('orchestrator-agent');

  // Filter to just orchestrator's proposals
  const orchestratorProposals = pendingProposals.filter(
    p => p.proposedBy === ORCHESTRATOR_AGENT_ID
  );

  return {
    pendingProposals: counts.pending,
    recentApprovals,
    unreadNotifications: unreadCount,
    orchestratorProposals,
  };
}

/**
 * Get orchestrator's notifications from council
 */
export function getOrchestratorNotifications() {
  return getUnreadNotifications('orchestrator-agent');
}

/**
 * Record a coordination action between agents
 */
export async function recordCoordinationAction(
  action: string,
  involvedAgents: string[],
  outcome: string,
  metadata?: Record<string, any>
): Promise<string> {
  return recordOrchestratorDecision({
    type: 'coordination',
    description: action,
    targetAgents: involvedAgents,
    rationale: `Coordinated action between ${involvedAgents.join(', ')}`,
    outcome,
    metadata,
  });
}

/**
 * Record a delegation to another agent
 */
export async function recordDelegation(
  task: string,
  targetAgent: string,
  rationale: string,
  metadata?: Record<string, any>
): Promise<string> {
  return recordOrchestratorDecision({
    type: 'delegation',
    description: `Delegated task to ${targetAgent}: ${task}`,
    targetAgents: [targetAgent],
    rationale,
    metadata,
  });
}

/**
 * Search for similar past decisions
 */
export async function findSimilarDecisions(
  query: string,
  limit: number = 5
): Promise<ZepSearchResult[]> {
  const results = await searchAgentMemory(ORCHESTRATOR_AGENT_ID, query, limit * 2);
  // Filter to only decision-type memories
  return results.filter(r => r.memory.metadata?.type === 'decision').slice(0, limit);
}

/**
 * Get context summary for system prompt injection
 */
export async function getContextForSystemPrompt(
  currentRequest: string
): Promise<string> {
  const [contextResults, councilStatus] = await Promise.all([
    getOrchestratorContext(currentRequest, 3),
    Promise.resolve(getCouncilStatus()),
  ]);

  const parts: string[] = [];

  if (contextResults.private.length > 0) {
    parts.push('### Relevant Orchestrator Memory:');
    contextResults.private.forEach((r, i) => {
      parts.push(`[${i + 1}] ${r.memory.text}`);
    });
  }

  if (contextResults.org.length > 0) {
    parts.push('\n### Organizational Knowledge:');
    contextResults.org.forEach((r, i) => {
      parts.push(`[${i + 1}] ${r.memory.text}`);
    });
  }

  if (councilStatus.pendingProposals > 0) {
    parts.push(`\n### Council Status: ${councilStatus.pendingProposals} pending proposal(s)`);
  }

  if (councilStatus.unreadNotifications > 0) {
    parts.push(`### Unread Notifications: ${councilStatus.unreadNotifications}`);
  }

  return parts.join('\n');
}

export {
  ORCHESTRATOR_AGENT_ID,
};
