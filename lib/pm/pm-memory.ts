/**
 * PM Agent Memory Module
 *
 * Provides specialized memory operations for the PM (Project Management) agent:
 * - Project organization knowledge
 * - Repo-to-project assignment history
 * - Task patterns and preferences
 * - Cross-repo relationships
 *
 * Uses both private memory (wrath-shield-pm-agent) and can propose
 * organizational policies to the council.
 *
 * ENHANCED (Phase 4): Now includes temporal memory capabilities:
 * - Bi-temporal fact storage (when happened vs when learned)
 * - Historical state queries ("What was the priority last week?")
 * - Entity relationship tracking
 * - Pattern-based predictions
 * - Correction feedback learning
 */

import { ensureServerOnly } from '../server-only-guard';
import {
  addAgentMemory,
  searchAgentMemory,
  searchOrgMemory,
  searchAllMemory,
  proposeOrgMemory,
  type AgentId,
  type ZepSearchResult,
  type OrgCouncilProposal,
} from '../memory/zep';

// Temporal memory imports (Phase 4)
import {
  recordFact,
  recordRelationship,
  getCurrentState,
  getHistoricalState,
  type EntityType,
  type FactSource
} from './temporal-memory';
import { recordCorrection as recordTemporalCorrection } from './correction-feedback';

// Prevent client-side imports
ensureServerOnly('lib/pm/pm-memory');

const PM_AGENT_ID: AgentId = 'pm-agent';

export interface RepoAssignment {
  repoName: string;
  repoFullName: string;
  projectId: string;
  projectName: string;
  rationale: string;
  confidence: number; // 0-1
  source: 'manual' | 'ai_suggested' | 'rule_based';
  assignedAt: string;
  assignedBy?: string;
}

export interface ProjectContext {
  projectId: string;
  projectName: string;
  description?: string;
  domain?: string; // utlyze, vuplicity, personal, etc.
  repos: string[];
  primaryLanguages?: string[];
  teamMembers?: string[];
}

export interface OrganizationRule {
  id: string;
  pattern: string; // Repo name pattern or characteristic
  targetProject: string;
  confidence: number;
  examples: string[];
  createdAt: string;
}

/**
 * Search PM-related memories
 */
export async function searchPMMemory(
  query: string,
  limit: number = 10
): Promise<ZepSearchResult[]> {
  return searchAgentMemory(PM_AGENT_ID, query, limit);
}

/**
 * Get combined PM + org-council context
 */
export async function getPMContext(
  query: string,
  limit: number = 5
): Promise<{ private: ZepSearchResult[]; org: ZepSearchResult[] }> {
  const results = await searchAllMemory(PM_AGENT_ID, query, limit);
  return {
    private: results.agent,
    org: results.org,
  };
}

/**
 * Add PM-related memory
 */
export async function addPMMemory(
  text: string,
  category: 'assignment' | 'project' | 'rule' | 'pattern' | 'decision' | 'sync' | 'suggestion' | 'triage' | 'continuity',
  metadata?: Record<string, any>
): Promise<void> {
  const prefixedText = `[PM - ${category.toUpperCase()}] ${text}`;

  await addAgentMemory(PM_AGENT_ID, prefixedText, {
    domain: 'pm',
    category,
    ...metadata,
  });

  console.log(`[PMMemory] Added ${category}: ${text.substring(0, 50)}...`);
}

/**
 * Record a repo-to-project assignment
 */
export async function recordRepoAssignment(assignment: RepoAssignment): Promise<void> {
  const text = `Repo Assignment: ${assignment.repoFullName} -> ${assignment.projectName}
Rationale: ${assignment.rationale}
Confidence: ${(assignment.confidence * 100).toFixed(0)}%
Source: ${assignment.source}`;

  await addPMMemory(text, 'assignment', {
    repo_name: assignment.repoName,
    repo_full_name: assignment.repoFullName,
    project_id: assignment.projectId,
    project_name: assignment.projectName,
    confidence: assignment.confidence,
    source: assignment.source,
    assigned_by: assignment.assignedBy,
  });

  console.log(`[PMMemory] Recorded assignment: ${assignment.repoFullName} -> ${assignment.projectName}`);
}

/**
 * Record project context
 */
export async function recordProjectContext(context: ProjectContext): Promise<void> {
  const text = `Project Context: ${context.projectName}
${context.description ? `Description: ${context.description}` : ''}
${context.domain ? `Domain: ${context.domain}` : ''}
Repos: ${context.repos.join(', ')}
${context.primaryLanguages?.length ? `Languages: ${context.primaryLanguages.join(', ')}` : ''}
${context.teamMembers?.length ? `Team: ${context.teamMembers.join(', ')}` : ''}`;

  await addPMMemory(text, 'project', {
    project_id: context.projectId,
    project_name: context.projectName,
    domain: context.domain,
    repo_count: context.repos.length,
    languages: context.primaryLanguages,
  });

  console.log(`[PMMemory] Recorded project context: ${context.projectName}`);
}

/**
 * Record an organization rule learned from patterns
 */
export async function recordOrganizationRule(rule: OrganizationRule): Promise<void> {
  const text = `Organization Rule: ${rule.pattern} -> ${rule.targetProject}
Confidence: ${(rule.confidence * 100).toFixed(0)}%
Examples: ${rule.examples.join(', ')}`;

  await addPMMemory(text, 'rule', {
    rule_id: rule.id,
    pattern: rule.pattern,
    target_project: rule.targetProject,
    confidence: rule.confidence,
    example_count: rule.examples.length,
  });

  console.log(`[PMMemory] Recorded organization rule: ${rule.pattern}`);
}

/**
 * Learn from a correction (user fixed an assignment)
 */
export async function learnFromCorrection(
  repoName: string,
  wrongProject: string,
  correctProject: string,
  reason?: string
): Promise<void> {
  const text = `Assignment Correction: ${repoName}
Wrong Assignment: ${wrongProject}
Correct Assignment: ${correctProject}
${reason ? `Reason: ${reason}` : ''}

This should be used to improve future suggestions.`;

  await addPMMemory(text, 'pattern', {
    repo_name: repoName,
    wrong_project: wrongProject,
    correct_project: correctProject,
    type: 'correction',
  });

  console.log(`[PMMemory] Learned from correction: ${repoName}`);
}

/**
 * Suggest project for a repo based on memory
 */
export async function suggestProjectForRepo(
  repoName: string,
  repoDescription?: string,
  repoLanguage?: string
): Promise<{
  suggestions: Array<{ project: string; confidence: number; rationale: string }>;
  memories: ZepSearchResult[];
}> {
  const query = `repo ${repoName} ${repoDescription || ''} ${repoLanguage || ''} project assignment`;
  const memories = await searchPMMemory(query, 10);

  const suggestions: Array<{ project: string; confidence: number; rationale: string }> = [];
  const seenProjects = new Set<string>();

  for (const memory of memories) {
    const projectName = memory.memory.metadata?.project_name || memory.memory.metadata?.target_project;
    if (projectName && !seenProjects.has(projectName)) {
      seenProjects.add(projectName);
      suggestions.push({
        project: projectName,
        confidence: memory.score || 0.5,
        rationale: `Similar to: ${memory.memory.text.split('\n')[0].substring(0, 100)}`,
      });
    }
  }

  return { suggestions: suggestions.slice(0, 5), memories };
}

/**
 * Get organization structure from memory
 */
export async function getOrganizationStructure(): Promise<{
  projects: Map<string, string[]>;
  rules: ZepSearchResult[];
}> {
  const [projectMemories, ruleMemories] = await Promise.all([
    searchPMMemory('project context repos', 20),
    searchPMMemory('organization rule', 10),
  ]);

  const projects = new Map<string, string[]>();

  for (const memory of projectMemories) {
    if (memory.memory.metadata?.category === 'project') {
      const projectName = memory.memory.metadata.project_name;
      // Extract repos from text (simplified parsing)
      const reposMatch = memory.memory.text.match(/Repos: (.+)/);
      if (reposMatch && projectName) {
        projects.set(projectName, reposMatch[1].split(', ').map(r => r.trim()));
      }
    }
  }

  return {
    projects,
    rules: ruleMemories.filter(r => r.memory.metadata?.category === 'rule'),
  };
}

/**
 * Propose an organizational policy to council
 */
export async function proposeOrganizationPolicy(
  policy: string,
  rationale: string,
  affectedProjects: string[]
): Promise<OrgCouncilProposal> {
  const proposalText = `[PM ORGANIZATION POLICY]
Policy: ${policy}

Rationale: ${rationale}

Affected Projects: ${affectedProjects.join(', ')}

Proposed by: PM Agent`;

  const proposal = await proposeOrgMemory(PM_AGENT_ID, proposalText, {
    type: 'organization_policy',
    affected_projects: affectedProjects,
    policy_text: policy,
    rationale,
  });

  // Record in private memory
  await addPMMemory(`Submitted organization policy to council: ${policy}`, 'decision', {
    proposal_id: proposal.id,
    type: 'policy_proposal',
  });

  console.log(`[PMMemory] Proposed organization policy: ${proposal.id}`);
  return proposal;
}

/**
 * Record a sync event
 */
export async function recordSyncEvent(
  source: 'github' | 'motion' | 'local',
  operation: string,
  itemsAffected: number,
  success: boolean,
  details?: string
): Promise<void> {
  const text = `Sync Event: ${source} - ${operation}
Items Affected: ${itemsAffected}
Status: ${success ? 'Success' : 'Failed'}
${details ? `Details: ${details}` : ''}`;

  await addPMMemory(text, 'sync', {
    source,
    operation,
    items_affected: itemsAffected,
    success,
  });
}

/**
 * Get context for repo organization UI
 */
export async function getRepoOrganizationContext(
  repoName: string
): Promise<string> {
  const [assignmentHistory, projectContext, rules] = await Promise.all([
    searchPMMemory(`${repoName} assignment`, 3),
    searchPMMemory(`project ${repoName}`, 3),
    searchPMMemory('organization rule', 5),
  ]);

  const parts: string[] = [];

  parts.push(`### Organization Context for ${repoName}\n`);

  if (assignmentHistory.length > 0) {
    parts.push('#### Assignment History:');
    assignmentHistory.forEach((a, i) => {
      const line = a.memory.text.split('\n')[0].replace('[PM - ASSIGNMENT]', '').trim();
      parts.push(`${i + 1}. ${line}`);
    });
  }

  if (projectContext.length > 0) {
    parts.push('\n#### Related Projects:');
    projectContext.forEach((p, i) => {
      const line = p.memory.text.split('\n')[0].replace('[PM - PROJECT]', '').trim();
      parts.push(`${i + 1}. ${line}`);
    });
  }

  if (rules.length > 0) {
    parts.push('\n#### Organization Rules:');
    rules.forEach((r, i) => {
      const line = r.memory.text.split('\n')[0].replace('[PM - RULE]', '').trim();
      parts.push(`${i + 1}. ${line}`);
    });
  }

  return parts.join('\n');
}

/**
 * Get organizational memory from org-council
 */
export async function getOrganizationalPolicies(
  query: string = 'organization policy project',
  limit: number = 10
): Promise<ZepSearchResult[]> {
  return searchOrgMemory(query, limit);
}

// ============================================================================
// NEW: Temporal Memory Enhancements (Phase 4)
// ============================================================================

/**
 * Record a decision with bi-temporal tracking
 */
export async function recordDecisionWithTemporal(params: {
  entity_type: EntityType;
  entity_id: string;
  attribute: string;
  value: any;
  valid_from?: Date;
  source?: FactSource;
  confidence?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // Record to Zep (semantic memory)
  await addPMMemory(
    `Decision: ${params.entity_type} ${params.entity_id} ${params.attribute} = ${JSON.stringify(params.value)}`,
    'decision',
    { ...params }
  );

  // Record to temporal layer
  await recordFact({
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    attribute: params.attribute,
    value: params.value,
    valid_from: params.valid_from,
    source: params.source || 'manual',
    confidence: params.confidence ?? 1.0,
    metadata: params.metadata
  });

  console.log(`[PMMemory] Recorded temporal decision: ${params.entity_type}/${params.entity_id}.${params.attribute}`);
}

/**
 * Get historical context for an entity at a specific point in time
 */
export async function getHistoricalContext(params: {
  entity_type: EntityType;
  entity_id: string;
  point_in_time?: Date;
}): Promise<Record<string, any>> {
  const state = params.point_in_time
    ? getHistoricalState(params.entity_type, params.entity_id, params.point_in_time)
    : getCurrentState(params.entity_type, params.entity_id);

  return state.attributes;
}

/**
 * Record an entity relationship (e.g., task assigned to person)
 */
export async function recordEntityRelationship(params: {
  from_entity_type: EntityType;
  from_entity_id: string;
  to_entity_type: EntityType;
  to_entity_id: string;
  relationship_type: 'assigned_to' | 'belongs_to' | 'blocks' | 'depends_on' | 'related_to' | 'created_by';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordRelationship({
    from_entity_type: params.from_entity_type,
    from_entity_id: params.from_entity_id,
    to_entity_type: params.to_entity_type,
    to_entity_id: params.to_entity_id,
    relationship_type: params.relationship_type,
    metadata: params.metadata
  });

  console.log(`[PMMemory] Recorded relationship: ${params.from_entity_type}/${params.from_entity_id} --[${params.relationship_type}]--> ${params.to_entity_type}/${params.to_entity_id}`);
}

/**
 * Enhanced correction learning with temporal feedback
 */
export async function learnFromCorrectionWithTemporal(params: {
  repoName: string;
  wrongProject: string;
  correctProject: string;
  reason?: string;
}): Promise<void> {
  // Original Zep logging (keep for backward compatibility)
  await learnFromCorrection(
    params.repoName,
    params.wrongProject,
    params.correctProject,
    params.reason
  );

  // NEW: Record to corrections table for feedback learning
  await recordTemporalCorrection({
    correction_type: 'assignment',
    original_entity_type: 'repo',
    original_entity_id: params.repoName,
    original_value: { project: params.wrongProject },
    corrected_value: { project: params.correctProject },
    context: {
      repo: params.repoName,
      timestamp: new Date().toISOString()
    },
    reason: params.reason
  });

  console.log(`[PMMemory] Recorded temporal correction: ${params.repoName}`);
}

/**
 * Enhanced repo assignment with temporal tracking
 */
export async function recordRepoAssignmentWithTemporal(assignment: RepoAssignment): Promise<void> {
  // Original function (keep for backward compatibility)
  await recordRepoAssignment(assignment);

  // NEW: Record to temporal layer
  await recordFact({
    entity_type: 'project',
    entity_id: assignment.projectId,
    attribute: 'repo_assignment',
    value: {
      repo: assignment.repoFullName,
      rationale: assignment.rationale
    },
    source: assignment.source === 'manual' ? 'manual' : 'ai_suggestion',
    confidence: assignment.confidence,
    metadata: {
      repo_name: assignment.repoName,
      assigned_by: assignment.assignedBy,
      assigned_at: assignment.assignedAt
    }
  });

  // Record relationship: repo belongs_to project
  await recordRelationship({
    from_entity_type: 'project' as EntityType,
    from_entity_id: assignment.repoName,
    to_entity_type: 'project',
    to_entity_id: assignment.projectId,
    relationship_type: 'belongs_to',
    metadata: {
      repo_full_name: assignment.repoFullName
    }
  });
}

// ============================================================================
// NEW: AI Integration Memory Functions (Phase 5 - AI-Powered Triage)
// ============================================================================

/**
 * Search PM memories for AI triage/suggestion context
 * Alias for searchPMMemory with better return type for AI modules
 */
export async function searchPMMemories(
  query: string,
  limit: number = 10
): Promise<Array<{ text: string; score?: number; metadata?: Record<string, unknown> }>> {
  try {
    const results = await searchPMMemory(query, limit);
    return results.map(r => ({
      text: r.memory.text,
      score: r.score,
      metadata: r.memory.metadata,
    }));
  } catch (error) {
    console.warn(`[PM Memory] Search failed (non-fatal):`, error);
    return [];
  }
}

/**
 * Get triage context for a signal
 * Combines private PM memories + org-council policies
 */
export async function getTriageContext(
  signalSource: string,
  signalType: string,
  keywords: string[]
): Promise<{
  privateContext: string;
  orgContext: string;
  combinedContext: string;
}> {
  const query = `triage ${signalSource} ${signalType} ${keywords.join(' ')}`.trim();

  const { private: privateResults, org: orgResults } = await getPMContext(query, 5);

  const privateContext = privateResults.length > 0
    ? 'Past Triage Decisions:\n' + privateResults.map((r, i) => `${i + 1}. ${r.memory.text}`).join('\n')
    : '';

  const orgContext = orgResults.length > 0
    ? 'Organizational Policies:\n' + orgResults.map((r, i) => `${i + 1}. ${r.memory.text}`).join('\n')
    : '';

  const combinedContext = [privateContext, orgContext].filter(Boolean).join('\n\n');

  return { privateContext, orgContext, combinedContext };
}

/**
 * Get suggestion context for pattern analysis
 */
export async function getSuggestionContext(
  entityType: EntityType,
  entityId: string,
  suggestionType: string
): Promise<{
  patterns: string;
  examples: string;
}> {
  const patternQuery = `${suggestionType} patterns ${entityType}`;
  const exampleQuery = `${suggestionType} ${entityType} examples`;

  const [patternResults, exampleResults] = await Promise.all([
    searchPMMemory(patternQuery, 5),
    searchPMMemory(exampleQuery, 5),
  ]);

  const patterns = patternResults.length > 0
    ? patternResults.map(r => r.memory.text).join('\n')
    : '';

  const examples = exampleResults.length > 0
    ? exampleResults.map(r => r.memory.text).join('\n')
    : '';

  return { patterns, examples };
}

/**
 * Record AI triage decision for learning
 */
export async function recordTriageDecision(params: {
  signalId: string;
  signalSource: string;
  signalType: string;
  action: string;
  escalation: string;
  priority: string;
  confidence: number;
  rationale: string;
  aiPowered: boolean;
}): Promise<void> {
  const text = `Triage Decision: Signal ${params.signalId} from ${params.signalSource}/${params.signalType}
Action: ${params.action} | Escalation: ${params.escalation} | Priority: ${params.priority}
Confidence: ${(params.confidence * 100).toFixed(0)}%
AI-Powered: ${params.aiPowered ? 'Yes' : 'No'}
Rationale: ${params.rationale}`;

  await addPMMemory(text, 'decision', {
    signal_id: params.signalId,
    signal_source: params.signalSource,
    signal_type: params.signalType,
    action: params.action,
    escalation: params.escalation,
    priority: params.priority,
    confidence: params.confidence,
    ai_powered: params.aiPowered,
  });
}

/**
 * Record AI suggestion for learning
 */
export async function recordSuggestionFeedback(params: {
  suggestionId: string;
  suggestionType: string;
  entityType: string;
  entityId: string;
  suggestedValue: unknown;
  accepted: boolean;
  userFeedback?: string;
}): Promise<void> {
  const text = `Suggestion Feedback: ${params.suggestionType} for ${params.entityType}/${params.entityId}
Suggested: ${JSON.stringify(params.suggestedValue)}
Outcome: ${params.accepted ? 'Accepted' : 'Rejected'}
${params.userFeedback ? `User Feedback: ${params.userFeedback}` : ''}`;

  await addPMMemory(text, 'pattern', {
    suggestion_id: params.suggestionId,
    suggestion_type: params.suggestionType,
    entity_type: params.entityType,
    entity_id: params.entityId,
    suggested_value: params.suggestedValue,
    accepted: params.accepted,
    feedback: params.userFeedback,
  });

  // If rejected, also record as a correction for learning
  if (!params.accepted) {
    await recordTemporalCorrection({
      correction_type: 'suggestion',
      original_entity_type: params.entityType,
      original_entity_id: params.entityId,
      original_value: { suggestion: params.suggestedValue },
      corrected_value: { rejected: true },
      context: { suggestion_id: params.suggestionId },
      reason: params.userFeedback,
    });
  }
}

export {
  PM_AGENT_ID,
};
