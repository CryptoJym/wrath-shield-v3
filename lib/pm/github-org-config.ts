/**
 * GitHub Organization Configuration
 *
 * Manages multi-organization support for the GitHub-native PM system.
 * Supports:
 * - Multiple GitHub organizations (Utlyze, CryptoJym, NewReward, etc.)
 * - Repository hierarchy mapping (subprojects vs standalone)
 * - Organization-level settings and permissions
 */

import { getDatabase } from '@/lib/db/Database';

export interface GitHubOrg {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  parent_org_id: string | null; // For org hierarchy (e.g., NewReward under Utlyze)
  is_primary: boolean;
  enabled: boolean;
  settings: OrgSettings;
  created_at: number;
  updated_at: number;
}

export interface OrgSettings {
  auto_sync: boolean;
  sync_interval_minutes: number;
  default_project_template?: string;
  labels_to_sync?: string[];
  issue_prefix?: string;
}

export interface RepoHierarchy {
  id: string;
  repo_full_name: string;
  org_id: string;
  parent_repo_id: string | null; // For subprojects
  hierarchy_type: 'root' | 'subproject' | 'standalone';
  domain: string | null; // Business domain (e.g., "R&D", "Sales", "Legal")
  project_name: string | null;
  enabled: boolean;
  settings: RepoSettings;
  created_at: number;
  updated_at: number;
}

export interface RepoSettings {
  sync_issues: boolean;
  sync_prs: boolean;
  sync_milestones: boolean;
  auto_create_issues: boolean;
  issue_labels?: string[];
}

interface OrgRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  parent_org_id: string | null;
  is_primary: number;
  enabled: number;
  settings: string;
  created_at: number;
  updated_at: number;
}

interface RepoHierarchyRow {
  id: string;
  repo_full_name: string;
  org_id: string;
  parent_repo_id: string | null;
  hierarchy_type: string;
  domain: string | null;
  project_name: string | null;
  enabled: number;
  settings: string;
  created_at: number;
  updated_at: number;
}

function ensureTables(): void {
  const db = getDatabase().getRawDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS github_orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      parent_org_id TEXT REFERENCES github_orgs(id),
      is_primary INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS repo_hierarchy (
      id TEXT PRIMARY KEY,
      repo_full_name TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL REFERENCES github_orgs(id),
      parent_repo_id TEXT REFERENCES repo_hierarchy(id),
      hierarchy_type TEXT DEFAULT 'standalone' CHECK (hierarchy_type IN ('root', 'subproject', 'standalone')),
      domain TEXT,
      project_name TEXT,
      enabled INTEGER DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_repo_hierarchy_org ON repo_hierarchy(org_id);
    CREATE INDEX IF NOT EXISTS idx_repo_hierarchy_parent ON repo_hierarchy(parent_repo_id);
    CREATE INDEX IF NOT EXISTS idx_repo_hierarchy_domain ON repo_hierarchy(domain);
  `);
}

function rowToOrg(row: OrgRow): GitHubOrg {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    parent_org_id: row.parent_org_id,
    is_primary: row.is_primary === 1,
    enabled: row.enabled === 1,
    settings: JSON.parse(row.settings || '{}'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToRepoHierarchy(row: RepoHierarchyRow): RepoHierarchy {
  return {
    id: row.id,
    repo_full_name: row.repo_full_name,
    org_id: row.org_id,
    parent_repo_id: row.parent_repo_id,
    hierarchy_type: row.hierarchy_type as RepoHierarchy['hierarchy_type'],
    domain: row.domain,
    project_name: row.project_name,
    enabled: row.enabled === 1,
    settings: JSON.parse(row.settings || '{}'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============= Organization CRUD =============

export function createOrg(params: {
  name: string;
  display_name: string;
  description?: string;
  parent_org_id?: string;
  is_primary?: boolean;
  settings?: Partial<OrgSettings>;
}): GitHubOrg {
  ensureTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const id = `org_${params.name}_${now}`;

  const defaultSettings: OrgSettings = {
    auto_sync: true,
    sync_interval_minutes: 15,
    ...params.settings,
  };

  db.prepare(`
    INSERT INTO github_orgs (id, name, display_name, description, parent_org_id, is_primary, settings, created_at, updated_at)
    VALUES (@id, @name, @display_name, @description, @parent_org_id, @is_primary, @settings, @created_at, @updated_at)
  `).run({
    id,
    name: params.name,
    display_name: params.display_name,
    description: params.description || null,
    parent_org_id: params.parent_org_id || null,
    is_primary: params.is_primary ? 1 : 0,
    settings: JSON.stringify(defaultSettings),
    created_at: now,
    updated_at: now,
  });

  return getOrg(id)!;
}

export function getOrg(id: string): GitHubOrg | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM github_orgs WHERE id = ?').get(id) as OrgRow | undefined;
  return row ? rowToOrg(row) : null;
}

export function getOrgByName(name: string): GitHubOrg | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM github_orgs WHERE name = ?').get(name) as OrgRow | undefined;
  return row ? rowToOrg(row) : null;
}

export function getAllOrgs(options?: { enabled_only?: boolean }): GitHubOrg[] {
  ensureTables();
  const db = getDatabase().getRawDb();

  let sql = 'SELECT * FROM github_orgs';
  if (options?.enabled_only) {
    sql += ' WHERE enabled = 1';
  }
  sql += ' ORDER BY is_primary DESC, display_name ASC';

  const rows = db.prepare(sql).all() as OrgRow[];
  return rows.map(rowToOrg);
}

export function getPrimaryOrg(): GitHubOrg | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM github_orgs WHERE is_primary = 1 LIMIT 1').get() as OrgRow | undefined;
  return row ? rowToOrg(row) : null;
}

export function updateOrg(id: string, updates: Partial<Omit<GitHubOrg, 'id' | 'created_at'>>): GitHubOrg | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const setClauses: string[] = ['updated_at = @updated_at'];
  const params: Record<string, unknown> = { id, updated_at: now };

  if (updates.name !== undefined) {
    setClauses.push('name = @name');
    params.name = updates.name;
  }
  if (updates.display_name !== undefined) {
    setClauses.push('display_name = @display_name');
    params.display_name = updates.display_name;
  }
  if (updates.description !== undefined) {
    setClauses.push('description = @description');
    params.description = updates.description;
  }
  if (updates.parent_org_id !== undefined) {
    setClauses.push('parent_org_id = @parent_org_id');
    params.parent_org_id = updates.parent_org_id;
  }
  if (updates.is_primary !== undefined) {
    setClauses.push('is_primary = @is_primary');
    params.is_primary = updates.is_primary ? 1 : 0;
  }
  if (updates.enabled !== undefined) {
    setClauses.push('enabled = @enabled');
    params.enabled = updates.enabled ? 1 : 0;
  }
  if (updates.settings !== undefined) {
    setClauses.push('settings = @settings');
    params.settings = JSON.stringify(updates.settings);
  }

  db.prepare(`UPDATE github_orgs SET ${setClauses.join(', ')} WHERE id = @id`).run(params);
  return getOrg(id);
}

export function deleteOrg(id: string): boolean {
  ensureTables();
  const db = getDatabase().getRawDb();
  const result = db.prepare('DELETE FROM github_orgs WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============= Repository Hierarchy CRUD =============

export function createRepoHierarchy(params: {
  repo_full_name: string;
  org_id: string;
  parent_repo_id?: string;
  hierarchy_type?: RepoHierarchy['hierarchy_type'];
  domain?: string;
  project_name?: string;
  settings?: Partial<RepoSettings>;
}): RepoHierarchy {
  ensureTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const id = `repo_${params.repo_full_name.replace('/', '_')}_${now}`;

  const defaultSettings: RepoSettings = {
    sync_issues: true,
    sync_prs: true,
    sync_milestones: true,
    auto_create_issues: true,
    ...params.settings,
  };

  db.prepare(`
    INSERT INTO repo_hierarchy (id, repo_full_name, org_id, parent_repo_id, hierarchy_type, domain, project_name, settings, created_at, updated_at)
    VALUES (@id, @repo_full_name, @org_id, @parent_repo_id, @hierarchy_type, @domain, @project_name, @settings, @created_at, @updated_at)
  `).run({
    id,
    repo_full_name: params.repo_full_name,
    org_id: params.org_id,
    parent_repo_id: params.parent_repo_id || null,
    hierarchy_type: params.hierarchy_type || 'standalone',
    domain: params.domain || null,
    project_name: params.project_name || null,
    settings: JSON.stringify(defaultSettings),
    created_at: now,
    updated_at: now,
  });

  return getRepoHierarchy(id)!;
}

export function getRepoHierarchy(id: string): RepoHierarchy | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM repo_hierarchy WHERE id = ?').get(id) as RepoHierarchyRow | undefined;
  return row ? rowToRepoHierarchy(row) : null;
}

export function getRepoHierarchyByName(repo_full_name: string): RepoHierarchy | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM repo_hierarchy WHERE repo_full_name = ?').get(repo_full_name) as RepoHierarchyRow | undefined;
  return row ? rowToRepoHierarchy(row) : null;
}

export function getReposByOrg(org_id: string, options?: { enabled_only?: boolean }): RepoHierarchy[] {
  ensureTables();
  const db = getDatabase().getRawDb();

  let sql = 'SELECT * FROM repo_hierarchy WHERE org_id = ?';
  if (options?.enabled_only) {
    sql += ' AND enabled = 1';
  }
  sql += ' ORDER BY hierarchy_type, repo_full_name';

  const rows = db.prepare(sql).all(org_id) as RepoHierarchyRow[];
  return rows.map(rowToRepoHierarchy);
}

export function getReposByDomain(domain: string): RepoHierarchy[] {
  ensureTables();
  const db = getDatabase().getRawDb();
  const rows = db.prepare('SELECT * FROM repo_hierarchy WHERE domain = ? AND enabled = 1').all(domain) as RepoHierarchyRow[];
  return rows.map(rowToRepoHierarchy);
}

export function getSubprojects(parent_repo_id: string): RepoHierarchy[] {
  ensureTables();
  const db = getDatabase().getRawDb();
  const rows = db.prepare('SELECT * FROM repo_hierarchy WHERE parent_repo_id = ? AND enabled = 1').all(parent_repo_id) as RepoHierarchyRow[];
  return rows.map(rowToRepoHierarchy);
}

export function getRootProjects(): RepoHierarchy[] {
  ensureTables();
  const db = getDatabase().getRawDb();
  const rows = db.prepare("SELECT * FROM repo_hierarchy WHERE hierarchy_type = 'root' AND enabled = 1").all() as RepoHierarchyRow[];
  return rows.map(rowToRepoHierarchy);
}

export function getAllRepoHierarchy(options?: { enabled_only?: boolean }): RepoHierarchy[] {
  ensureTables();
  const db = getDatabase().getRawDb();

  let sql = 'SELECT * FROM repo_hierarchy';
  if (options?.enabled_only) {
    sql += ' WHERE enabled = 1';
  }
  sql += ' ORDER BY org_id, hierarchy_type, repo_full_name';

  const rows = db.prepare(sql).all() as RepoHierarchyRow[];
  return rows.map(rowToRepoHierarchy);
}

export function updateRepoHierarchy(id: string, updates: Partial<Omit<RepoHierarchy, 'id' | 'created_at'>>): RepoHierarchy | null {
  ensureTables();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);

  const setClauses: string[] = ['updated_at = @updated_at'];
  const params: Record<string, unknown> = { id, updated_at: now };

  if (updates.org_id !== undefined) {
    setClauses.push('org_id = @org_id');
    params.org_id = updates.org_id;
  }
  if (updates.parent_repo_id !== undefined) {
    setClauses.push('parent_repo_id = @parent_repo_id');
    params.parent_repo_id = updates.parent_repo_id;
  }
  if (updates.hierarchy_type !== undefined) {
    setClauses.push('hierarchy_type = @hierarchy_type');
    params.hierarchy_type = updates.hierarchy_type;
  }
  if (updates.domain !== undefined) {
    setClauses.push('domain = @domain');
    params.domain = updates.domain;
  }
  if (updates.project_name !== undefined) {
    setClauses.push('project_name = @project_name');
    params.project_name = updates.project_name;
  }
  if (updates.enabled !== undefined) {
    setClauses.push('enabled = @enabled');
    params.enabled = updates.enabled ? 1 : 0;
  }
  if (updates.settings !== undefined) {
    setClauses.push('settings = @settings');
    params.settings = JSON.stringify(updates.settings);
  }

  db.prepare(`UPDATE repo_hierarchy SET ${setClauses.join(', ')} WHERE id = @id`).run(params);
  return getRepoHierarchy(id);
}

export function deleteRepoHierarchy(id: string): boolean {
  ensureTables();
  const db = getDatabase().getRawDb();
  const result = db.prepare('DELETE FROM repo_hierarchy WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============= Utility Functions =============

/**
 * Get the full hierarchy tree for an organization
 */
export function getOrgHierarchyTree(org_id: string): {
  org: GitHubOrg;
  repos: {
    root: RepoHierarchy[];
    standalone: RepoHierarchy[];
    byParent: Record<string, RepoHierarchy[]>;
  };
} | null {
  const org = getOrg(org_id);
  if (!org) return null;

  const allRepos = getReposByOrg(org_id, { enabled_only: true });

  const root: RepoHierarchy[] = [];
  const standalone: RepoHierarchy[] = [];
  const byParent: Record<string, RepoHierarchy[]> = {};

  for (const repo of allRepos) {
    if (repo.hierarchy_type === 'root') {
      root.push(repo);
    } else if (repo.hierarchy_type === 'standalone') {
      standalone.push(repo);
    } else if (repo.parent_repo_id) {
      if (!byParent[repo.parent_repo_id]) {
        byParent[repo.parent_repo_id] = [];
      }
      byParent[repo.parent_repo_id].push(repo);
    }
  }

  return { org, repos: { root, standalone, byParent } };
}

/**
 * Initialize default organizations based on user config
 */
export function initializeDefaultOrgs(): void {
  ensureTables();

  // Check if orgs already exist
  const existing = getAllOrgs();
  if (existing.length > 0) {
    console.log('[GitHub Org Config] Organizations already configured');
    return;
  }

  // Create Utlyze as primary org
  const utlyze = createOrg({
    name: 'Utlyze',
    display_name: 'Utlyze',
    description: 'R&D, Solution Stream, Kahoa, High Desert Water Solutions',
    is_primary: true,
    settings: {
      auto_sync: true,
      sync_interval_minutes: 15,
    },
  });

  // Create NewReward under Utlyze
  createOrg({
    name: 'NewReward',
    display_name: 'NewReward',
    description: 'Lead gen and sales gen platform',
    parent_org_id: utlyze.id,
    is_primary: false,
    settings: {
      auto_sync: true,
      sync_interval_minutes: 30,
    },
  });

  // Create CryptoJym (legacy, to be migrated)
  createOrg({
    name: 'CryptoJym',
    display_name: 'CryptoJym',
    description: 'Legacy org - projects migrating to Utlyze',
    is_primary: false,
    settings: {
      auto_sync: true,
      sync_interval_minutes: 60, // Less frequent since migrating
    },
  });

  console.log('[GitHub Org Config] Default organizations initialized');
}

/**
 * Get organization statistics
 */
export function getOrgStats(): {
  total_orgs: number;
  enabled_orgs: number;
  total_repos: number;
  enabled_repos: number;
  repos_by_type: Record<string, number>;
  repos_by_domain: Record<string, number>;
} {
  ensureTables();
  const db = getDatabase().getRawDb();

  const orgs = getAllOrgs();
  const repos = getAllRepoHierarchy();

  const stats = {
    total_orgs: orgs.length,
    enabled_orgs: orgs.filter(o => o.enabled).length,
    total_repos: repos.length,
    enabled_repos: repos.filter(r => r.enabled).length,
    repos_by_type: {} as Record<string, number>,
    repos_by_domain: {} as Record<string, number>,
  };

  for (const repo of repos) {
    stats.repos_by_type[repo.hierarchy_type] = (stats.repos_by_type[repo.hierarchy_type] || 0) + 1;
    if (repo.domain) {
      stats.repos_by_domain[repo.domain] = (stats.repos_by_domain[repo.domain] || 0) + 1;
    }
  }

  return stats;
}
