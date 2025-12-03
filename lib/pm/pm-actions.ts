/**
 * PM Actions Module
 *
 * Executes classification, hierarchy, and maintenance actions
 * that the PM Agent can trigger via chat or automation.
 *
 * These actions directly mutate the database and can trigger
 * dashboard refreshes via WebSocket or polling.
 */

import { ensureServerOnly } from '../server-only-guard';
import githubClient from '../integrations/GitHubClient';
import {
  createRepoHierarchy,
  updateRepoHierarchy,
  getRepoHierarchyByName,
  getAllRepoHierarchy,
  getOrgByName,
  createOrg,
  getAllOrgs,
  type RepoHierarchy,
  type GitHubOrg,
} from './github-org-config';
import { getDatabase } from '../db/Database';
import {
  recordRepoAssignment,
  addPMMemory,
  learnFromCorrection,
} from './pm-memory';

ensureServerOnly('lib/pm/pm-actions');

// ============= Types =============

export type PMActionType =
  // Classification
  | 'assign_business_unit'
  | 'classify_as_root_project'
  | 'classify_as_sub_project'
  | 'mark_as_orphan'
  // Domain
  | 'set_domain'
  | 'reclassify_domain'
  // Hierarchy
  | 'set_parent'
  | 'remove_parent'
  | 'promote_orphan_to_project'
  | 'demote_root_to_subproject'
  | 'merge_projects'
  // Maintenance
  | 'archive_project'
  | 'unarchive_project'
  | 'create_clarity_task'
  | 'update_project_dashboard'
  | 'set_purpose';

export interface PMAction {
  action: PMActionType;
  repo_full_name: string;
  params?: Record<string, unknown>;
  rationale?: string;
  confidence?: number;
  escalation_level?: 'auto' | 'propose' | 'critical';
}

export interface PMActionResult {
  success: boolean;
  action: PMActionType;
  repo_full_name: string;
  message: string;
  changes?: Record<string, unknown>;
  requires_approval?: boolean;
  error?: string;
}

// ============= Organization Structure from Taxonomy =============

// Actual business units under Utlyze
const BUSINESS_UNITS = [
  'vuplicity',
  'newreward',
  'hdws',
] as const;

// Partner companies (cross-lateral with Utlyze)
const PARTNER_COMPANIES = [
  'kahoa',
  'solutionstream',
] as const;

// Special categories (NOT business units)
const SPECIAL_CATEGORIES = {
  umbrella: 'utlyze',        // Parent org
  rd_division: 'rd',         // R&D division - orphan holding pen
  legacy_personal: 'cryptojym', // Legacy/personal repos
} as const;

// All valid assignment targets
const VALID_ASSIGNMENTS = [
  'utlyze',      // Umbrella - for core Utlyze repos
  ...BUSINESS_UNITS,
  ...PARTNER_COMPANIES,
  'rd',          // R&D division for research/orphans
  'cryptojym',   // Legacy personal
] as const;

type ValidAssignment = typeof VALID_ASSIGNMENTS[number];

const DOMAINS = [
  'product-core',
  'infrastructure',
  'internal-tools',
  'client-delivery',
  'research-experiments',
  'growth-marketing',
  'operations',
  'personal',
  'archived',
] as const;

type Domain = typeof DOMAINS[number];

// ============= Action Executors =============

/**
 * Execute a PM action
 */
export async function executePMAction(action: PMAction): Promise<PMActionResult> {
  const { action: actionType, repo_full_name, params, rationale, escalation_level } = action;

  // Check if action requires approval
  if (escalation_level === 'propose' || escalation_level === 'critical') {
    return {
      success: false,
      action: actionType,
      repo_full_name,
      message: `Action requires ${escalation_level === 'critical' ? 'immediate' : ''} approval`,
      requires_approval: true,
    };
  }

  try {
    switch (actionType) {
      case 'assign_business_unit':
        return await assignBusinessUnit(repo_full_name, params?.business_unit as string, rationale);

      case 'classify_as_root_project':
        return await classifyAsRootProject(repo_full_name, rationale);

      case 'classify_as_sub_project':
        return await classifyAsSubProject(
          repo_full_name,
          params?.parent_repo as string,
          rationale
        );

      case 'mark_as_orphan':
        return await markAsOrphan(repo_full_name, rationale);

      case 'set_domain':
        return await setDomain(repo_full_name, params?.domain as string, rationale);

      case 'reclassify_domain':
        return await reclassifyDomain(
          repo_full_name,
          params?.old_domain as string,
          params?.new_domain as string,
          rationale
        );

      case 'set_parent':
        return await setParent(repo_full_name, params?.parent_id as string, rationale);

      case 'remove_parent':
        return await removeParent(repo_full_name, rationale);

      case 'promote_orphan_to_project':
        return await promoteOrphanToProject(repo_full_name, params?.business_unit as string, rationale);

      case 'demote_root_to_subproject':
        return await demoteRootToSubproject(repo_full_name, params?.parent_repo as string, rationale);

      case 'archive_project':
        return await archiveProject(repo_full_name, rationale);

      case 'unarchive_project':
        return await unarchiveProject(repo_full_name, rationale);

      case 'create_clarity_task':
        return await createClarityTask(repo_full_name, params?.question as string);

      case 'set_purpose':
        return await setPurpose(repo_full_name, params?.purpose as string, rationale);

      case 'update_project_dashboard':
        return await updateProjectDashboard(repo_full_name);

      default:
        return {
          success: false,
          action: actionType,
          repo_full_name,
          message: `Unknown action type: ${actionType}`,
          error: 'UNKNOWN_ACTION',
        };
    }
  } catch (error) {
    console.error(`[PM Actions] Error executing ${actionType}:`, error);
    return {
      success: false,
      action: actionType,
      repo_full_name,
      message: `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`,
      error: String(error),
    };
  }
}

/**
 * Execute multiple PM actions in batch
 */
export async function executePMActionBatch(actions: PMAction[]): Promise<PMActionResult[]> {
  const results: PMActionResult[] = [];

  for (const action of actions) {
    const result = await executePMAction(action);
    results.push(result);

    // Stop on critical failure
    if (!result.success && action.escalation_level === 'critical') {
      break;
    }
  }

  return results;
}

// ============= Individual Action Implementations =============

async function assignBusinessUnit(
  repoFullName: string,
  targetUnit: string,
  rationale?: string
): Promise<PMActionResult> {
  if (!VALID_ASSIGNMENTS.includes(targetUnit as ValidAssignment)) {
    return {
      success: false,
      action: 'assign_business_unit',
      repo_full_name: repoFullName,
      message: `Invalid assignment target: ${targetUnit}. Valid: ${VALID_ASSIGNMENTS.join(', ')}`,
      error: 'INVALID_TARGET',
    };
  }

  // Get or create org
  let org = getOrgByName(targetUnit);
  if (!org) {
    // Create the org if it doesn't exist
    org = createOrg({
      name: targetUnit,
      display_name: targetUnit.charAt(0).toUpperCase() + targetUnit.slice(1),
      description: `Auto-created for ${targetUnit}`,
    });
  }

  // Get or create repo hierarchy
  let hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, { org_id: org.id });
  } else {
    createRepoHierarchy({
      repo_full_name: repoFullName,
      org_id: org.id,
      hierarchy_type: 'standalone',
    });
  }

  // Also update the mapping
  const existingMapping = githubClient.getRepoMappings().find(m => m.repo_full_name === repoFullName);
  githubClient.setRepoMapping({
    repo_full_name: repoFullName,
    project_id: existingMapping?.project_id || null,
    project_name: existingMapping?.project_name || targetUnit,
    enabled: true,
    last_synced_at: Math.floor(Date.now() / 1000),
  });

  // Persist to Zep memory for autonomous agent learning
  try {
    await recordRepoAssignment({
      repoName: repoFullName.split('/')[1],
      repoFullName,
      projectId: org.id,
      projectName: targetUnit,
      rationale: rationale || `Auto-assigned to ${targetUnit}`,
      confidence: 0.85,
      source: 'rule_based',
      assignedAt: new Date().toISOString(),
    });
  } catch (memoryError) {
    console.warn('[PM Actions] Failed to persist to memory:', memoryError);
    // Don't fail the action if memory persistence fails
  }

  return {
    success: true,
    action: 'assign_business_unit',
    repo_full_name: repoFullName,
    message: `Assigned ${repoFullName} to: ${targetUnit}`,
    changes: { target: targetUnit, rationale },
  };
}

async function classifyAsRootProject(
  repoFullName: string,
  rationale?: string
): Promise<PMActionResult> {
  let hierarchy = getRepoHierarchyByName(repoFullName);

  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      hierarchy_type: 'root',
      parent_repo_id: null,
    });
  } else {
    // Need an org - default to utlyze
    const defaultOrg = getAllOrgs()[0];
    if (!defaultOrg) {
      return {
        success: false,
        action: 'classify_as_root_project',
        repo_full_name: repoFullName,
        message: 'No organizations configured. Please create one first.',
        error: 'NO_ORG',
      };
    }

    createRepoHierarchy({
      repo_full_name: repoFullName,
      org_id: defaultOrg.id,
      hierarchy_type: 'root',
    });
  }

  return {
    success: true,
    action: 'classify_as_root_project',
    repo_full_name: repoFullName,
    message: `Classified ${repoFullName} as ROOT project`,
    changes: { hierarchy_type: 'root', rationale },
  };
}

async function classifyAsSubProject(
  repoFullName: string,
  parentRepo: string,
  rationale?: string
): Promise<PMActionResult> {
  const parentHierarchy = getRepoHierarchyByName(parentRepo);
  if (!parentHierarchy) {
    return {
      success: false,
      action: 'classify_as_sub_project',
      repo_full_name: repoFullName,
      message: `Parent repo not found: ${parentRepo}`,
      error: 'PARENT_NOT_FOUND',
    };
  }

  let hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      hierarchy_type: 'subproject',
      parent_repo_id: parentHierarchy.id,
      org_id: parentHierarchy.org_id,
    });
  } else {
    createRepoHierarchy({
      repo_full_name: repoFullName,
      org_id: parentHierarchy.org_id,
      hierarchy_type: 'subproject',
      parent_repo_id: parentHierarchy.id,
    });
  }

  return {
    success: true,
    action: 'classify_as_sub_project',
    repo_full_name: repoFullName,
    message: `Classified ${repoFullName} as sub-project of ${parentRepo}`,
    changes: { hierarchy_type: 'subproject', parent: parentRepo, rationale },
  };
}

async function markAsOrphan(
  repoFullName: string,
  rationale?: string
): Promise<PMActionResult> {
  // Orphans go to R&D division (the orphan holding pen)
  let rdOrg = getOrgByName('rd');
  if (!rdOrg) {
    rdOrg = createOrg({
      name: 'rd',
      display_name: 'R&D Division',
      description: 'Research & Development - orphan holding pen for unclear experiments',
    });
  }

  let hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      hierarchy_type: 'standalone',
      org_id: rdOrg.id,
      domain: 'research-experiments',
      parent_repo_id: null,
    });
  } else {
    createRepoHierarchy({
      repo_full_name: repoFullName,
      org_id: rdOrg.id,
      hierarchy_type: 'standalone',
      domain: 'research-experiments',
    });
  }

  // Create clarity task
  await createClarityTask(repoFullName, 'What is the purpose of this repo?');

  // Persist to Zep memory
  try {
    await addPMMemory(
      `Orphan detected: ${repoFullName} - placed in R&D division for clarity. ${rationale || 'No clear business unit match.'}`,
      'decision',
      {
        repo_full_name: repoFullName,
        action: 'mark_as_orphan',
        placement: 'rd',
        domain: 'research-experiments',
      }
    );
  } catch (memoryError) {
    console.warn('[PM Actions] Failed to persist orphan to memory:', memoryError);
  }

  return {
    success: true,
    action: 'mark_as_orphan',
    repo_full_name: repoFullName,
    message: `Marked ${repoFullName} as ORPHAN in R&D division. Clarity task created.`,
    changes: { hierarchy_type: 'orphan', domain: 'research-experiments', rationale },
  };
}

async function setDomain(
  repoFullName: string,
  domain: string,
  rationale?: string
): Promise<PMActionResult> {
  if (!DOMAINS.includes(domain as Domain)) {
    return {
      success: false,
      action: 'set_domain',
      repo_full_name: repoFullName,
      message: `Invalid domain: ${domain}. Valid: ${DOMAINS.join(', ')}`,
      error: 'INVALID_DOMAIN',
    };
  }

  let hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, { domain });
  } else {
    const defaultOrg = getAllOrgs()[0];
    if (!defaultOrg) {
      return {
        success: false,
        action: 'set_domain',
        repo_full_name: repoFullName,
        message: 'No organizations configured',
        error: 'NO_ORG',
      };
    }
    createRepoHierarchy({
      repo_full_name: repoFullName,
      org_id: defaultOrg.id,
      domain,
    });
  }

  // Also update mapping
  const existingMapping = githubClient.getRepoMappings().find(m => m.repo_full_name === repoFullName);
  githubClient.setRepoMapping({
    repo_full_name: repoFullName,
    project_id: existingMapping?.project_id || null,
    project_name: existingMapping?.project_name || null,
    enabled: existingMapping?.enabled ?? true,
    last_synced_at: Math.floor(Date.now() / 1000),
    domain,
  });

  // Persist domain classification to Zep memory
  try {
    await addPMMemory(
      `Domain set: ${repoFullName} -> ${domain}. ${rationale || ''}`,
      'pattern',
      {
        repo_full_name: repoFullName,
        domain,
        action: 'set_domain',
      }
    );
  } catch (memoryError) {
    console.warn('[PM Actions] Failed to persist domain to memory:', memoryError);
  }

  return {
    success: true,
    action: 'set_domain',
    repo_full_name: repoFullName,
    message: `Set domain for ${repoFullName} to: ${domain}`,
    changes: { domain, rationale },
  };
}

async function reclassifyDomain(
  repoFullName: string,
  oldDomain: string,
  newDomain: string,
  rationale?: string
): Promise<PMActionResult> {
  const result = await setDomain(repoFullName, newDomain, rationale);
  if (result.success) {
    result.changes = { old_domain: oldDomain, new_domain: newDomain, rationale };
    result.message = `Reclassified ${repoFullName} from ${oldDomain} to ${newDomain}`;
  }
  return result;
}

async function setParent(
  repoFullName: string,
  parentId: string,
  rationale?: string
): Promise<PMActionResult> {
  const hierarchy = getRepoHierarchyByName(repoFullName);
  if (!hierarchy) {
    return {
      success: false,
      action: 'set_parent',
      repo_full_name: repoFullName,
      message: `Repo not found in hierarchy: ${repoFullName}`,
      error: 'NOT_FOUND',
    };
  }

  updateRepoHierarchy(hierarchy.id, {
    parent_repo_id: parentId,
    hierarchy_type: 'subproject',
  });

  return {
    success: true,
    action: 'set_parent',
    repo_full_name: repoFullName,
    message: `Set parent for ${repoFullName} to: ${parentId}`,
    changes: { parent_id: parentId, rationale },
  };
}

async function removeParent(
  repoFullName: string,
  rationale?: string
): Promise<PMActionResult> {
  const hierarchy = getRepoHierarchyByName(repoFullName);
  if (!hierarchy) {
    return {
      success: false,
      action: 'remove_parent',
      repo_full_name: repoFullName,
      message: `Repo not found in hierarchy: ${repoFullName}`,
      error: 'NOT_FOUND',
    };
  }

  updateRepoHierarchy(hierarchy.id, {
    parent_repo_id: null,
    hierarchy_type: 'standalone',
  });

  return {
    success: true,
    action: 'remove_parent',
    repo_full_name: repoFullName,
    message: `Removed parent from ${repoFullName}, now standalone`,
    changes: { rationale },
  };
}

async function promoteOrphanToProject(
  repoFullName: string,
  businessUnit: string,
  rationale?: string
): Promise<PMActionResult> {
  // First assign to business unit
  const assignResult = await assignBusinessUnit(repoFullName, businessUnit, rationale);
  if (!assignResult.success) return assignResult;

  // Then classify as root
  return await classifyAsRootProject(repoFullName, rationale);
}

async function demoteRootToSubproject(
  repoFullName: string,
  parentRepo: string,
  rationale?: string
): Promise<PMActionResult> {
  return await classifyAsSubProject(repoFullName, parentRepo, rationale);
}

async function archiveProject(
  repoFullName: string,
  rationale?: string
): Promise<PMActionResult> {
  const hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      domain: 'archived',
      enabled: false,
    });
  }

  // Also update mapping
  const existingMapping = githubClient.getRepoMappings().find(m => m.repo_full_name === repoFullName);
  if (existingMapping) {
    githubClient.setRepoMapping({
      ...existingMapping,
      enabled: false,
      domain: 'archived',
      last_synced_at: Math.floor(Date.now() / 1000),
    });
  }

  return {
    success: true,
    action: 'archive_project',
    repo_full_name: repoFullName,
    message: `Archived ${repoFullName}`,
    changes: { archived: true, rationale },
  };
}

async function unarchiveProject(
  repoFullName: string,
  rationale?: string
): Promise<PMActionResult> {
  const hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      domain: null, // Will need to be reclassified
      enabled: true,
    });
  }

  const existingMapping = githubClient.getRepoMappings().find(m => m.repo_full_name === repoFullName);
  if (existingMapping) {
    githubClient.setRepoMapping({
      ...existingMapping,
      enabled: true,
      domain: undefined,
      last_synced_at: Math.floor(Date.now() / 1000),
    });
  }

  return {
    success: true,
    action: 'unarchive_project',
    repo_full_name: repoFullName,
    message: `Unarchived ${repoFullName}. Needs domain reclassification.`,
    changes: { archived: false, rationale },
  };
}

async function createClarityTask(
  repoFullName: string,
  question?: string
): Promise<PMActionResult> {
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  // Ensure tasks table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_clarity_tasks (
      id TEXT PRIMARY KEY,
      repo_full_name TEXT NOT NULL,
      question TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      answer TEXT,
      created_at INTEGER,
      resolved_at INTEGER
    )
  `);

  const taskId = `clarity_${repoFullName.replace('/', '_')}_${now}`;
  const defaultQuestion = question || `What is the purpose and business unit for ${repoFullName}?`;

  db.prepare(`
    INSERT INTO pm_clarity_tasks (id, repo_full_name, question, status, created_at)
    VALUES (@id, @repo_full_name, @question, 'pending', @created_at)
  `).run({
    id: taskId,
    repo_full_name: repoFullName,
    question: defaultQuestion,
    created_at: now,
  });

  return {
    success: true,
    action: 'create_clarity_task',
    repo_full_name: repoFullName,
    message: `Created clarity task: "${defaultQuestion}"`,
    changes: { task_id: taskId, question: defaultQuestion },
  };
}

async function setPurpose(
  repoFullName: string,
  purpose: string,
  rationale?: string
): Promise<PMActionResult> {
  const hierarchy = getRepoHierarchyByName(repoFullName);
  if (hierarchy) {
    updateRepoHierarchy(hierarchy.id, {
      project_name: purpose, // Using project_name field for purpose
    });
  }

  // Also update mapping
  const existingMapping = githubClient.getRepoMappings().find(m => m.repo_full_name === repoFullName);
  githubClient.setRepoMapping({
    repo_full_name: repoFullName,
    project_id: existingMapping?.project_id || null,
    project_name: existingMapping?.project_name || null,
    enabled: existingMapping?.enabled ?? true,
    last_synced_at: Math.floor(Date.now() / 1000),
    purpose,
  });

  return {
    success: true,
    action: 'set_purpose',
    repo_full_name: repoFullName,
    message: `Set purpose for ${repoFullName}: "${purpose}"`,
    changes: { purpose, rationale },
  };
}

async function updateProjectDashboard(
  repoFullName: string
): Promise<PMActionResult> {
  // This action just signals that the dashboard should refresh
  // In a real implementation, this might push to a WebSocket or invalidate a cache
  return {
    success: true,
    action: 'update_project_dashboard',
    repo_full_name: repoFullName,
    message: `Dashboard update triggered for ${repoFullName}`,
    changes: { refresh_requested: true },
  };
}

// ============= Query Helpers =============

/**
 * Get pending clarity tasks
 */
export function getPendingClarityTasks(): Array<{
  id: string;
  repo_full_name: string;
  question: string;
  created_at: number;
}> {
  try {
    const db = getDatabase().getRawDb();
    const rows = db.prepare(`
      SELECT id, repo_full_name, question, created_at
      FROM pm_clarity_tasks
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).all() as Array<{
      id: string;
      repo_full_name: string;
      question: string;
      created_at: number;
    }>;
    return rows;
  } catch {
    return [];
  }
}

/**
 * Resolve a clarity task
 */
export function resolveClarityTask(taskId: string, answer: string): boolean {
  try {
    const db = getDatabase().getRawDb();
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE pm_clarity_tasks
      SET status = 'resolved', answer = @answer, resolved_at = @resolved_at
      WHERE id = @id
    `).run({ id: taskId, answer, resolved_at: now });
    return result.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Parse action from PM agent response
 */
export function parseActionFromResponse(response: string): PMAction | null {
  // Look for action patterns in the response
  const actionPatterns = [
    { pattern: /assign_business_unit\(["']?([^,"']+)["']?,\s*["']?([^)"']+)["']?\)/i, action: 'assign_business_unit' as PMActionType },
    { pattern: /classify_as_root_project\(["']?([^)"']+)["']?\)/i, action: 'classify_as_root_project' as PMActionType },
    { pattern: /classify_as_sub_project\(["']?([^,"']+)["']?,\s*["']?([^)"']+)["']?\)/i, action: 'classify_as_sub_project' as PMActionType },
    { pattern: /mark_as_orphan\(["']?([^)"']+)["']?\)/i, action: 'mark_as_orphan' as PMActionType },
    { pattern: /set_domain\(["']?([^,"']+)["']?,\s*["']?([^)"']+)["']?\)/i, action: 'set_domain' as PMActionType },
    { pattern: /set_parent\(["']?([^,"']+)["']?,\s*["']?([^)"']+)["']?\)/i, action: 'set_parent' as PMActionType },
    { pattern: /archive_project\(["']?([^)"']+)["']?\)/i, action: 'archive_project' as PMActionType },
  ];

  for (const { pattern, action } of actionPatterns) {
    const match = response.match(pattern);
    if (match) {
      const repo_full_name = match[1];
      let params: Record<string, unknown> = {};

      if (action === 'assign_business_unit') {
        params = { business_unit: match[2] };
      } else if (action === 'classify_as_sub_project') {
        params = { parent_repo: match[2] };
      } else if (action === 'set_domain') {
        params = { domain: match[2] };
      } else if (action === 'set_parent') {
        params = { parent_id: match[2] };
      }

      return { action, repo_full_name, params };
    }
  }

  return null;
}
