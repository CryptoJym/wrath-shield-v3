/**
 * GitHub Integration Client
 *
 * Provides integration with GitHub for:
 * - Fetching all repositories for a user
 * - Fetching issues (tasks) across multiple repos
 * - Mapping repos to projects
 * - Creating/updating issues
 * - Syncing task state
 */

import { safeConfig } from '@/lib/safe-config';
import { getDatabase } from '@/lib/db/Database';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  language: string | null;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string;
  archived?: boolean;
  stargazers_count?: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  milestone?: {
    id: number;
    title: string;
    description: string | null;
    state: 'open' | 'closed';
    due_on: string | null;
  };
  // Extended fields for multi-repo support
  repo_name?: string;
  repo_full_name?: string;
  project_id?: string;
}

export interface GitHubProject {
  id: number;
  name: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubTaskSummary {
  total: number;
  open: number;
  closed: number;
  by_label: Record<string, number>;
  by_milestone: Record<string, number>;
  by_assignee: Record<string, number>;
  by_repo: Record<string, number>;
}

export interface RepoProjectMapping {
  repo_full_name: string;
  project_id: string | null;
  project_name: string | null;
  enabled: boolean;
  last_synced_at: number | null;
  // Extended metadata for repo identification
  purpose?: string | null; // What is this repo for?
  domain?: string | null; // R&D, Sales, Legal, etc.
  priority?: 'high' | 'medium' | 'low' | null;
}

class GitHubClient {
  private token: string | null;
  private username: string | null;
  private baseUrl = 'https://api.github.com';

  constructor() {
    this.token = safeConfig('GITHUB_ACCESS_TOKEN', '');
    this.username = safeConfig('GITHUB_USERNAME', '');
  }

  /**
   * Check if GitHub is configured (token-level, not repo-level)
   */
  isConfigured(): boolean {
    return !!(this.token && this.username);
  }

  /**
   * Get the configured username
   */
  getUsername(): string | null {
    return this.username;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.token) {
      throw new Error('GitHub not configured. Set GITHUB_ACCESS_TOKEN in environment.');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // Repository Management
  // ============================================================================

  /**
   * Fetch all repositories for the configured user
   */
  async getRepos(options?: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    limit?: number;
  }): Promise<GitHubRepo[]> {
    if (!this.username) {
      throw new Error('GitHub username not configured. Set GITHUB_USERNAME in environment.');
    }

    const params = new URLSearchParams({
      type: options?.type || 'all',
      sort: options?.sort || 'updated',
      direction: options?.direction || 'desc',
      per_page: String(options?.limit || 100),
    });

    const endpoint = `/users/${this.username}/repos?${params}`;
    return this.fetch<GitHubRepo[]>(endpoint);
  }

  /**
   * Get repo-to-project mappings from local database
   */
  getRepoMappings(): RepoProjectMapping[] {
    try {
      const db = getDatabase().getRawDb();

      // Ensure extended columns exist
      try {
        db.exec(`
          ALTER TABLE github_repo_mappings ADD COLUMN purpose TEXT;
          ALTER TABLE github_repo_mappings ADD COLUMN domain TEXT;
          ALTER TABLE github_repo_mappings ADD COLUMN priority TEXT DEFAULT 'medium';
        `);
      } catch {
        // Columns already exist
      }

      const rows = db.prepare(`
        SELECT repo_full_name, project_id, project_name, enabled, last_synced_at,
               purpose, domain, priority
        FROM github_repo_mappings
        ORDER BY repo_full_name
      `).all() as RepoProjectMapping[];
      return rows;
    } catch {
      // Table might not exist yet
      return [];
    }
  }

  /**
   * Save or update a repo-to-project mapping
   */
  setRepoMapping(mapping: RepoProjectMapping): void {
    const db = getDatabase().getRawDb();

    // Ensure table exists with all columns
    db.exec(`
      CREATE TABLE IF NOT EXISTS github_repo_mappings (
        repo_full_name TEXT PRIMARY KEY,
        project_id TEXT,
        project_name TEXT,
        enabled INTEGER DEFAULT 1,
        last_synced_at INTEGER,
        purpose TEXT,
        domain TEXT,
        priority TEXT DEFAULT 'medium'
      )
    `);

    // Ensure extended columns exist (for existing tables)
    try {
      db.exec(`
        ALTER TABLE github_repo_mappings ADD COLUMN purpose TEXT;
        ALTER TABLE github_repo_mappings ADD COLUMN domain TEXT;
        ALTER TABLE github_repo_mappings ADD COLUMN priority TEXT DEFAULT 'medium';
      `);
    } catch {
      // Columns already exist
    }

    db.prepare(`
      INSERT INTO github_repo_mappings (repo_full_name, project_id, project_name, enabled, last_synced_at, purpose, domain, priority)
      VALUES (@repo_full_name, @project_id, @project_name, @enabled, @last_synced_at, @purpose, @domain, @priority)
      ON CONFLICT(repo_full_name) DO UPDATE SET
        project_id = @project_id,
        project_name = @project_name,
        enabled = @enabled,
        last_synced_at = @last_synced_at,
        purpose = @purpose,
        domain = @domain,
        priority = @priority
    `).run({
      repo_full_name: mapping.repo_full_name,
      project_id: mapping.project_id,
      project_name: mapping.project_name,
      enabled: mapping.enabled ? 1 : 0,
      last_synced_at: mapping.last_synced_at,
      purpose: mapping.purpose || null,
      domain: mapping.domain || null,
      priority: mapping.priority || 'medium',
    });
  }

  /**
   * Get unmapped repos (repos without a project assignment)
   */
  async getUnmappedRepos(): Promise<GitHubRepo[]> {
    const repos = await this.getRepos();
    const mappings = this.getRepoMappings();
    const mappedNames = new Set(mappings.map(m => m.repo_full_name));

    return repos.filter(repo => !mappedNames.has(repo.full_name));
  }

  /**
   * Get enabled repos (repos with project mapping and enabled=true)
   */
  getEnabledRepos(): RepoProjectMapping[] {
    return this.getRepoMappings().filter(m => m.enabled);
  }

  // ============================================================================
  // Issue Management (Multi-Repo)
  // ============================================================================

  /**
   * Fetch issues from a specific repository
   */
  async getRepoIssues(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all';
      labels?: string[];
      assignee?: string;
      limit?: number;
    }
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams({
      state: options?.state || 'open',
      per_page: String(options?.limit || 100),
    });

    if (options?.labels?.length) {
      params.set('labels', options.labels.join(','));
    }
    if (options?.assignee) {
      params.set('assignee', options.assignee);
    }

    const endpoint = `/repos/${owner}/${repo}/issues?${params}`;
    const issues = await this.fetch<GitHubIssue[]>(endpoint);

    // Filter out pull requests and add repo info
    return issues
      .filter((issue: any) => !issue.pull_request)
      .map(issue => ({
        ...issue,
        repo_name: repo,
        repo_full_name: `${owner}/${repo}`,
      }));
  }

  /**
   * Fetch all issues from all enabled repositories
   */
  async getAllIssues(options?: {
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  }): Promise<GitHubIssue[]> {
    const enabledRepos = this.getEnabledRepos();

    if (enabledRepos.length === 0) {
      // Fallback: if no mappings yet, get issues from all repos with open issues
      const repos = await this.getRepos();
      const reposWithIssues = repos.filter(r => r.open_issues_count > 0).slice(0, 10);

      const allIssues: GitHubIssue[] = [];
      for (const repo of reposWithIssues) {
        try {
          const [owner, repoName] = repo.full_name.split('/');
          const issues = await this.getRepoIssues(owner, repoName, options);
          allIssues.push(...issues);
        } catch (error) {
          console.error(`[GitHub] Failed to fetch issues from ${repo.full_name}:`, error);
        }
      }
      return allIssues;
    }

    // Fetch from enabled repos with project mapping
    const allIssues: GitHubIssue[] = [];
    for (const mapping of enabledRepos) {
      try {
        const [owner, repoName] = mapping.repo_full_name.split('/');
        const issues = await this.getRepoIssues(owner, repoName, options);

        // Add project info to each issue
        allIssues.push(...issues.map(issue => ({
          ...issue,
          project_id: mapping.project_id || undefined,
        })));
      } catch (error) {
        console.error(`[GitHub] Failed to fetch issues from ${mapping.repo_full_name}:`, error);
      }
    }

    return allIssues;
  }

  /**
   * Fetch issues (compatibility method - fetches from all enabled repos)
   */
  async getIssues(options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    assignee?: string;
    milestone?: string;
    limit?: number;
  }): Promise<GitHubIssue[]> {
    return this.getAllIssues(options);
  }

  /**
   * Get a single issue by repo and number
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}`;
    const issue = await this.fetch<GitHubIssue>(endpoint);
    return {
      ...issue,
      repo_name: repo,
      repo_full_name: `${owner}/${repo}`,
    };
  }

  /**
   * Create a new issue in a specific repository
   */
  async createIssue(
    owner: string,
    repo: string,
    params: {
      title: string;
      body?: string;
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    }
  ): Promise<GitHubIssue> {
    const endpoint = `/repos/${owner}/${repo}/issues`;
    const issue = await this.fetch<GitHubIssue>(endpoint, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return {
      ...issue,
      repo_name: repo,
      repo_full_name: `${owner}/${repo}`,
    };
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    params: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
      milestone?: number;
    }
  ): Promise<GitHubIssue> {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}`;
    const issue = await this.fetch<GitHubIssue>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(params),
    });
    return {
      ...issue,
      repo_name: repo,
      repo_full_name: `${owner}/${repo}`,
    };
  }

  /**
   * Add a comment to an issue
   */
  async addIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ id: number; html_url: string; body: string }> {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    const comment = await this.fetch<{ id: number; html_url: string; body: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return comment;
  }

  /**
   * Close an issue
   */
  async closeIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue(owner, repo, issueNumber, { state: 'closed' });
  }

  /**
   * Reopen an issue
   */
  async reopenIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue(owner, repo, issueNumber, { state: 'open' });
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get task summary statistics across all enabled repos
   */
  async getTaskSummary(): Promise<GitHubTaskSummary> {
    const issues = await this.getAllIssues({ state: 'all', limit: 100 });

    const summary: GitHubTaskSummary = {
      total: issues.length,
      open: 0,
      closed: 0,
      by_label: {},
      by_milestone: {},
      by_assignee: {},
      by_repo: {},
    };

    for (const issue of issues) {
      if (issue.state === 'open') summary.open++;
      if (issue.state === 'closed') summary.closed++;

      if (issue.repo_full_name) {
        summary.by_repo[issue.repo_full_name] = (summary.by_repo[issue.repo_full_name] || 0) + 1;
      }

      for (const label of issue.labels || []) {
        summary.by_label[label.name] = (summary.by_label[label.name] || 0) + 1;
      }

      if (issue.milestone) {
        const milestoneName = issue.milestone.title;
        summary.by_milestone[milestoneName] = (summary.by_milestone[milestoneName] || 0) + 1;
      }

      for (const assignee of issue.assignees || []) {
        const assigneeName = assignee.login;
        summary.by_assignee[assigneeName] = (summary.by_assignee[assigneeName] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * Get repository milestones (used as projects/epics)
   */
  async getMilestones(
    options?: { state?: 'open' | 'closed' | 'all' }
  ): Promise<GitHubProject[]> {
    const enabledRepos = this.getEnabledRepos();
    const allMilestones: GitHubProject[] = [];

    // If no enabled repos, try to get milestones from repos with open issues
    const reposToCheck = enabledRepos.length > 0
      ? enabledRepos.map(r => r.repo_full_name)
      : (await this.getRepos()).filter(r => r.open_issues_count > 0).slice(0, 5).map(r => r.full_name);

    for (const repoFullName of reposToCheck) {
      try {
        const [owner, repo] = repoFullName.split('/');
        const milestones = await this.getRepoMilestones(owner, repo, options);
        allMilestones.push(...milestones);
      } catch (error) {
        console.error(`[GitHub] Failed to fetch milestones from ${repoFullName}:`, error);
      }
    }

    return allMilestones;
  }

  /**
   * Get milestones from a specific repository
   */
  async getRepoMilestones(
    owner: string,
    repo: string,
    options?: { state?: 'open' | 'closed' | 'all' }
  ): Promise<GitHubProject[]> {
    const params = new URLSearchParams({
      state: options?.state || 'open',
      per_page: '100',
    });

    const endpoint = `/repos/${owner}/${repo}/milestones?${params}`;
    const milestones = await this.fetch<any[]>(endpoint);

    return milestones.map((m) => ({
      id: m.id,
      name: m.title,
      body: m.description,
      state: m.state,
      html_url: m.html_url,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  /**
   * Get commits from a repository
   */
  async getCommits(
    owner: string,
    repo: string,
    options?: {
      since?: string; // ISO date string
      until?: string;
      limit?: number;
      sha?: string; // Branch or commit SHA
    }
  ): Promise<GitHubCommit[]> {
    const params = new URLSearchParams({
      per_page: String(options?.limit || 30),
    });

    if (options?.since) {
      params.append('since', options.since);
    }
    if (options?.until) {
      params.append('until', options.until);
    }
    if (options?.sha) {
      params.append('sha', options.sha);
    }

    const endpoint = `/repos/${owner}/${repo}/commits?${params}`;
    const commits = await this.fetch<any[]>(endpoint);

    return commits.map((c) => ({
      sha: c.sha,
      commit: {
        message: c.commit.message,
        author: c.commit.author ? {
          name: c.commit.author.name,
          email: c.commit.author.email,
          date: c.commit.author.date,
        } : null,
        committer: c.commit.committer ? {
          name: c.commit.committer.name,
          email: c.commit.committer.email,
          date: c.commit.committer.date,
        } : null,
      },
      author: c.author ? {
        login: c.author.login,
        avatar_url: c.author.avatar_url,
      } : null,
      html_url: c.html_url,
      stats: c.stats,
    }));
  }
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    } | null;
    committer: {
      name: string;
      email: string;
      date: string;
    } | null;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
}

// Singleton instance
const githubClient = new GitHubClient();
export default githubClient;
