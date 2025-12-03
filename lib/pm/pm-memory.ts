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
  category: 'assignment' | 'project' | 'rule' | 'pattern' | 'decision' | 'sync',
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

export {
  PM_AGENT_ID,
};
