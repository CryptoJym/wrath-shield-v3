/**
 * Repository Organizer
 *
 * AI-powered intelligent repository organization:
 * - Suggests project assignments for unorganized repos
 * - Learns from corrections to improve over time
 * - Maintains organization rules in memory
 * - Integrates with GitHub Projects v2
 */

import { ensureServerOnly } from '../server-only-guard';
import githubClient, { GitHubRepo, RepoProjectMapping } from '../integrations/GitHubClient';
import githubProjectsClient, { ProjectV2 } from '../integrations/GitHubProjectsClient';
import {
  recordRepoAssignment,
  recordProjectContext,
  recordOrganizationRule,
  learnFromCorrection,
  suggestProjectForRepo,
  getOrganizationStructure,
  recordSyncEvent,
  type RepoAssignment,
  type ProjectContext,
  type OrganizationRule,
} from './pm-memory';
import OpenRouterClient from '../OpenRouterClient';

ensureServerOnly('lib/pm/repo-organizer');

// Types

export interface RepoOrganizationSuggestion {
  repo: GitHubRepo;
  suggestions: Array<{
    project: ProjectV2 | { id: string; title: string };
    confidence: number;
    rationale: string;
    source: 'memory' | 'ai' | 'rule';
  }>;
  autoAssignable: boolean; // True if confidence > threshold
}

export interface OrganizationAction {
  action: 'assign' | 'skip' | 'create_project';
  repoFullName: string;
  projectId?: string;
  projectName?: string;
  rationale?: string;
}

export interface OrganizationResult {
  success: boolean;
  reposProcessed: number;
  reposAssigned: number;
  reposSkipped: number;
  newProjectsCreated: number;
  errors: string[];
}

// Configuration

const CONFIDENCE_THRESHOLD = 0.7; // Auto-assign if confidence >= 70%
const MAX_SUGGESTIONS = 3;

// Organization Rules (can be extended from memory)

const DEFAULT_RULES: OrganizationRule[] = [
  {
    id: 'rule-vuplicity',
    pattern: 'vuplicity|fcra|background-check|screening',
    targetProject: 'Vuplicity',
    confidence: 0.9,
    examples: ['vuplicity-api', 'fcra-compliance-checker'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-utlyze',
    pattern: 'utlyze|managed-intelligence|ai-platform',
    targetProject: 'Utlyze Core',
    confidence: 0.9,
    examples: ['utlyze-dashboard', 'ai-orchestration'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-reward',
    pattern: 'reward|incentive|points',
    targetProject: 'Reward',
    confidence: 0.85,
    examples: ['reward-engine', 'points-api'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-personal',
    pattern: 'personal|home|family|private',
    targetProject: 'Personal',
    confidence: 0.8,
    examples: ['home-automation', 'family-calendar'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rule-wrath-shield',
    pattern: 'wrath-shield|life-os',
    targetProject: 'Life OS',
    confidence: 0.95,
    examples: ['wrath-shield-v3', 'life-os-config'],
    createdAt: new Date().toISOString(),
  },
];

// Functions

/**
 * Get organization suggestions for unorganized repos
 */
export async function getOrganizationSuggestions(
  limit: number = 20
): Promise<RepoOrganizationSuggestion[]> {
  // Get unorganized repos
  const unmappedRepos = await githubClient.getUnmappedRepos();
  const reposToProcess = unmappedRepos.slice(0, limit);

  if (reposToProcess.length === 0) {
    return [];
  }

  // Get available projects
  const projects = await githubProjectsClient.getAllProjects();
  const projectMap = new Map(projects.map(p => [p.title.toLowerCase(), p]));

  // Get organization structure from memory
  const { rules: memoryRules } = await getOrganizationStructure();

  // Combine default rules with memory rules
  const allRules = [...DEFAULT_RULES];
  for (const mr of memoryRules) {
    const ruleData = mr.memory.metadata;
    if (ruleData?.pattern && ruleData?.target_project) {
      allRules.push({
        id: ruleData.rule_id || `memory-${Date.now()}`,
        pattern: ruleData.pattern,
        targetProject: ruleData.target_project,
        confidence: ruleData.confidence || 0.7,
        examples: [],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Generate suggestions for each repo
  const suggestions: RepoOrganizationSuggestion[] = [];

  for (const repo of reposToProcess) {
    const repoSuggestions: RepoOrganizationSuggestion['suggestions'] = [];

    // 1. Check rule-based matches
    for (const rule of allRules) {
      const pattern = new RegExp(rule.pattern, 'i');
      if (pattern.test(repo.name) || pattern.test(repo.description || '')) {
        const project = projectMap.get(rule.targetProject.toLowerCase());
        repoSuggestions.push({
          project: project || { id: '', title: rule.targetProject },
          confidence: rule.confidence,
          rationale: `Matches rule: "${rule.pattern}"`,
          source: 'rule',
        });
      }
    }

    // 2. Check memory-based suggestions
    const memorySuggestions = await suggestProjectForRepo(
      repo.name,
      repo.description || undefined,
      repo.language || undefined
    );

    for (const ms of memorySuggestions.suggestions) {
      // Don't duplicate rule-based suggestions
      if (!repoSuggestions.some(s =>
        (s.project as any).title?.toLowerCase() === ms.project.toLowerCase()
      )) {
        const project = projectMap.get(ms.project.toLowerCase());
        repoSuggestions.push({
          project: project || { id: '', title: ms.project },
          confidence: ms.confidence,
          rationale: ms.rationale,
          source: 'memory',
        });
      }
    }

    // 3. If no good suggestions, use AI
    if (repoSuggestions.length === 0 || repoSuggestions[0].confidence < 0.5) {
      try {
        const aiSuggestion = await getAISuggestion(repo, projects);
        if (aiSuggestion) {
          repoSuggestions.push(aiSuggestion);
        }
      } catch (error) {
        console.warn(`[RepoOrganizer] AI suggestion failed for ${repo.name}:`, error);
      }
    }

    // Sort by confidence and limit
    repoSuggestions.sort((a, b) => b.confidence - a.confidence);
    const topSuggestions = repoSuggestions.slice(0, MAX_SUGGESTIONS);

    suggestions.push({
      repo,
      suggestions: topSuggestions,
      autoAssignable: topSuggestions.length > 0 && topSuggestions[0].confidence >= CONFIDENCE_THRESHOLD,
    });
  }

  return suggestions;
}

/**
 * Get AI-powered suggestion for a repo
 */
async function getAISuggestion(
  repo: GitHubRepo,
  projects: ProjectV2[]
): Promise<RepoOrganizationSuggestion['suggestions'][0] | null> {
  const projectList = projects.map(p => `- ${p.title}: ${p.shortDescription || 'No description'}`).join('\n');

  const prompt = `You are a project organization assistant. Given a GitHub repository, suggest which project it should be assigned to.

Repository:
- Name: ${repo.name}
- Full name: ${repo.full_name}
- Description: ${repo.description || 'No description'}
- Language: ${repo.language || 'Unknown'}
- Last updated: ${repo.updated_at}

Available Projects:
${projectList}

Respond with JSON only:
{
  "projectTitle": "exact project title from the list above",
  "confidence": 0.0-1.0,
  "rationale": "brief explanation"
}

If no project is a good fit, respond with:
{
  "projectTitle": null,
  "confidence": 0,
  "rationale": "why no project fits"
}`;

  try {
    const llm = new OpenRouterClient();
    const response = await llm.chat([{ role: 'user', content: prompt }]);

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);
    if (!result.projectTitle) return null;

    const project = projects.find(p =>
      p.title.toLowerCase() === result.projectTitle.toLowerCase()
    );

    return {
      project: project || { id: '', title: result.projectTitle },
      confidence: Math.min(0.8, result.confidence), // Cap AI confidence
      rationale: result.rationale,
      source: 'ai',
    };
  } catch (error) {
    console.warn('[RepoOrganizer] AI suggestion parse error:', error);
    return null;
  }
}

/**
 * Apply organization actions
 */
export async function applyOrganizationActions(
  actions: OrganizationAction[]
): Promise<OrganizationResult> {
  const result: OrganizationResult = {
    success: true,
    reposProcessed: actions.length,
    reposAssigned: 0,
    reposSkipped: 0,
    newProjectsCreated: 0,
    errors: [],
  };

  for (const action of actions) {
    try {
      switch (action.action) {
        case 'assign':
          if (!action.projectId && !action.projectName) {
            result.errors.push(`${action.repoFullName}: No project specified`);
            continue;
          }

          // Save mapping to local database
          githubClient.setRepoMapping({
            repo_full_name: action.repoFullName,
            project_id: action.projectId || null,
            project_name: action.projectName || null,
            enabled: true,
            last_synced_at: Math.floor(Date.now() / 1000),
          });

          // Record in memory for learning
          await recordRepoAssignment({
            repoName: action.repoFullName.split('/')[1],
            repoFullName: action.repoFullName,
            projectId: action.projectId || '',
            projectName: action.projectName || '',
            rationale: action.rationale || 'Manual assignment',
            confidence: 1.0, // Manual assignments are 100% confident
            source: 'manual',
            assignedAt: new Date().toISOString(),
          });

          result.reposAssigned++;
          break;

        case 'skip':
          result.reposSkipped++;
          break;

        case 'create_project':
          // TODO: Implement project creation via GraphQL
          result.errors.push(`${action.repoFullName}: Project creation not yet implemented`);
          break;
      }
    } catch (error) {
      result.errors.push(`${action.repoFullName}: ${error instanceof Error ? error.message : String(error)}`);
      result.success = false;
    }
  }

  // Record sync event
  await recordSyncEvent(
    'github',
    'organization',
    result.reposAssigned,
    result.success,
    `Processed ${result.reposProcessed} repos, assigned ${result.reposAssigned}, skipped ${result.reposSkipped}`
  );

  return result;
}

/**
 * Auto-organize repos that have high-confidence suggestions
 */
export async function autoOrganizeRepos(): Promise<OrganizationResult> {
  const suggestions = await getOrganizationSuggestions(50);
  const autoAssignable = suggestions.filter(s => s.autoAssignable);

  const actions: OrganizationAction[] = autoAssignable.map(s => ({
    action: 'assign',
    repoFullName: s.repo.full_name,
    projectId: (s.suggestions[0].project as ProjectV2).id || '',
    projectName: (s.suggestions[0].project as ProjectV2).title || (s.suggestions[0].project as any).title,
    rationale: `Auto-assigned: ${s.suggestions[0].rationale} (${(s.suggestions[0].confidence * 100).toFixed(0)}% confidence)`,
  }));

  return applyOrganizationActions(actions);
}

/**
 * Learn from a user correction
 */
export async function learnFromUserCorrection(
  repoFullName: string,
  wrongProjectName: string,
  correctProjectName: string,
  reason?: string
): Promise<void> {
  const repoName = repoFullName.split('/')[1];

  // Record the correction in memory
  await learnFromCorrection(repoName, wrongProjectName, correctProjectName, reason);

  // If the correction reveals a pattern, create a rule
  if (reason && reason.length > 10) {
    // Extract potential pattern from repo name or reason
    const words = repoName.split(/[-_]/).filter(w => w.length > 2);
    const significantWord = words.find(w =>
      !['app', 'api', 'web', 'client', 'server', 'service'].includes(w.toLowerCase())
    );

    if (significantWord) {
      await recordOrganizationRule({
        id: `learned-${Date.now()}`,
        pattern: significantWord.toLowerCase(),
        targetProject: correctProjectName,
        confidence: 0.6, // Start with moderate confidence
        examples: [repoName],
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Update the mapping
  githubClient.setRepoMapping({
    repo_full_name: repoFullName,
    project_id: null, // Will need to look up the correct project ID
    project_name: correctProjectName,
    enabled: true,
    last_synced_at: Math.floor(Date.now() / 1000),
  });
}

/**
 * Get organization status
 */
export async function getOrganizationStatus(): Promise<{
  totalRepos: number;
  organizedRepos: number;
  unorganizedRepos: number;
  projectCounts: Record<string, number>;
  recentAssignments: RepoProjectMapping[];
}> {
  const repos = await githubClient.getRepos();
  const mappings = githubClient.getRepoMappings();
  const mappedNames = new Set(mappings.map(m => m.repo_full_name));

  const projectCounts: Record<string, number> = {};
  for (const mapping of mappings) {
    if (mapping.project_name) {
      projectCounts[mapping.project_name] = (projectCounts[mapping.project_name] || 0) + 1;
    }
  }

  // Get recent assignments (last 10)
  const recentAssignments = mappings
    .filter(m => m.last_synced_at)
    .sort((a, b) => (b.last_synced_at || 0) - (a.last_synced_at || 0))
    .slice(0, 10);

  return {
    totalRepos: repos.length,
    organizedRepos: mappings.filter(m => m.project_name).length,
    unorganizedRepos: repos.filter(r => !mappedNames.has(r.full_name)).length,
    projectCounts,
    recentAssignments,
  };
}

/**
 * Sync project context from GitHub Projects to memory
 */
export async function syncProjectsToMemory(): Promise<void> {
  const projects = await githubProjectsClient.getAllProjects();

  for (const project of projects) {
    try {
      const items = await githubProjectsClient.getAllProjectItems(project.id);

      // Extract repos from items
      const repos = new Set<string>();
      for (const item of items) {
        if (item.content.repository?.nameWithOwner) {
          repos.add(item.content.repository.nameWithOwner);
        }
      }

      // Determine domain from project title
      let domain: string | undefined;
      if (project.title.toLowerCase().includes('vuplicity')) domain = 'vuplicity';
      else if (project.title.toLowerCase().includes('utlyze')) domain = 'utlyze';
      else if (project.title.toLowerCase().includes('reward')) domain = 'reward';
      else if (project.title.toLowerCase().includes('personal')) domain = 'personal';

      // Record project context
      await recordProjectContext({
        projectId: project.id,
        projectName: project.title,
        description: project.shortDescription || undefined,
        domain,
        repos: Array.from(repos),
      });
    } catch (error) {
      console.warn(`[RepoOrganizer] Failed to sync project ${project.title}:`, error);
    }
  }

  await recordSyncEvent(
    'github',
    'projects_sync',
    projects.length,
    true,
    `Synced ${projects.length} projects to memory`
  );
}
