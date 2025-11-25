/**
 * PM Agent Sync
 * Bi-directional synchronization between GitHub and Motion
 */

import { randomUUID } from 'crypto';
import { MotionClient, MotionTask, MotionProject } from './motion-client';
import { PMAgentStore, SyncState, ProjectMapping } from './store';
import {
  GitHubIssue,
  determineSyncDirection,
  githubIssueToMotionTask,
  motionTaskToGithubIssue,
  generateMotionUpdate,
  generateGithubUpdate,
} from './mapper';

export interface SyncConfig {
  dryRun?: boolean;
  projectFilter?: string; // Only sync specific project
  forceDirection?: 'motion_to_github' | 'github_to_motion';
  verbose?: boolean;
}

export interface SyncResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  stats: {
    tasksProcessed: number;
    created: number;
    updated: number;
    closed: number;
    skipped: number;
    errors: number;
  };
  errors: Array<{ entity: string; error: string }>;
}

export class PMAgentSync {
  private motion: MotionClient;
  private store: PMAgentStore;
  private githubToken: string;
  private dryRun: boolean;
  private verbose: boolean;

  constructor(options: {
    motionClient?: MotionClient;
    store?: PMAgentStore;
    githubToken?: string;
    dryRun?: boolean;
    verbose?: boolean;
  } = {}) {
    this.motion = options.motionClient || new MotionClient();
    this.store = options.store || new PMAgentStore();
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN || '';
    this.dryRun = options.dryRun ?? false;
    this.verbose = options.verbose ?? false;
  }

  private log(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      console.log(`[PMAgentSync] ${message}`, ...args);
    }
  }

  /**
   * Run a full sync cycle
   */
  async runSync(config: SyncConfig = {}): Promise<SyncResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const dryRun = config.dryRun ?? this.dryRun;

    const stats = {
      tasksProcessed: 0,
      created: 0,
      updated: 0,
      closed: 0,
      skipped: 0,
      errors: 0,
    };
    const errors: Array<{ entity: string; error: string }> = [];

    this.log(`Starting sync run ${runId} (dryRun: ${dryRun})`);

    try {
      // Get all enabled project mappings
      let mappings = this.store.getAllProjectMappings(true);

      // Filter by project if specified
      if (config.projectFilter) {
        mappings = mappings.filter(m =>
          m.motion_project_name.toLowerCase().includes(config.projectFilter!.toLowerCase())
        );
      }

      this.log(`Found ${mappings.length} project mappings to sync`);

      // Process each project mapping
      for (const mapping of mappings) {
        this.log(`Syncing project: ${mapping.motion_project_name}`);

        try {
          const projectStats = await this.syncProject(mapping, runId, {
            ...config,
            dryRun,
          });

          stats.tasksProcessed += projectStats.processed;
          stats.created += projectStats.created;
          stats.updated += projectStats.updated;
          stats.closed += projectStats.closed;
          stats.skipped += projectStats.skipped;
          stats.errors += projectStats.errors;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ entity: mapping.motion_project_name, error: errorMsg });
          stats.errors++;

          this.store.logSync({
            sync_run_id: runId,
            entity_type: 'project',
            motion_id: mapping.motion_project_id,
            github_ref: `${mapping.github_owner}/${mapping.github_repo}`,
            action: 'error',
            status: 'error',
            error_message: errorMsg,
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ entity: 'sync', error: errorMsg });
    }

    const completedAt = new Date().toISOString();

    this.log(`Sync run ${runId} completed`, stats);

    return {
      runId,
      startedAt,
      completedAt,
      stats,
      errors,
    };
  }

  /**
   * Sync a single project
   */
  private async syncProject(
    mapping: ProjectMapping,
    runId: string,
    config: SyncConfig
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    closed: number;
    skipped: number;
    errors: number;
  }> {
    const stats = { processed: 0, created: 0, updated: 0, closed: 0, skipped: 0, errors: 0 };

    // Fetch Motion tasks for this project
    const motionResult = await this.motion.getTasks({ projectId: mapping.motion_project_id });
    const motionTasks = motionResult.tasks;

    // Fetch GitHub issues for this repo
    const githubIssues = await this.fetchGitHubIssues(mapping.github_owner, mapping.github_repo);

    this.log(`Found ${motionTasks.length} Motion tasks, ${githubIssues.length} GitHub issues`);

    // Create maps for quick lookup
    const motionById = new Map(motionTasks.map(t => [t.id, t]));
    const githubByNumber = new Map(githubIssues.map(i => [i.number, i]));

    // Get existing sync states
    const syncStates = this.store.getAllSyncStates().filter(
      s => s.github_owner === mapping.github_owner && s.github_repo === mapping.github_repo
    );
    const syncByMotionId = new Map(syncStates.map(s => [s.motion_id, s]));

    // Process Motion tasks
    for (const task of motionTasks) {
      stats.processed++;

      try {
        const result = await this.processMotionTask(
          task,
          mapping,
          runId,
          syncByMotionId.get(task.id),
          githubByNumber,
          config
        );

        switch (result.action) {
          case 'created': stats.created++; break;
          case 'updated': stats.updated++; break;
          case 'closed': stats.closed++; break;
          case 'skipped': stats.skipped++; break;
          case 'error': stats.errors++; break;
        }
      } catch (error) {
        stats.errors++;
        this.store.logSync({
          sync_run_id: runId,
          entity_type: 'task',
          motion_id: task.id,
          github_ref: null,
          action: 'error',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Process GitHub issues that aren't linked to Motion tasks
    for (const issue of githubIssues) {
      // Skip if already processed (has a sync state with this issue)
      const existingSync = syncStates.find(
        s => s.github_issue_number === issue.number
      );
      if (existingSync) continue;

      // Only process open issues
      if (issue.state === 'closed') continue;

      stats.processed++;

      try {
        const result = await this.processGitHubIssue(
          issue,
          mapping,
          runId,
          config
        );

        switch (result.action) {
          case 'created': stats.created++; break;
          case 'skipped': stats.skipped++; break;
          case 'error': stats.errors++; break;
        }
      } catch (error) {
        stats.errors++;
        this.store.logSync({
          sync_run_id: runId,
          entity_type: 'issue',
          motion_id: null,
          github_ref: `#${issue.number}`,
          action: 'error',
          status: 'error',
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return stats;
  }

  /**
   * Process a Motion task - sync to GitHub if needed
   */
  private async processMotionTask(
    task: MotionTask,
    mapping: ProjectMapping,
    runId: string,
    existingSync: SyncState | undefined,
    githubIssues: Map<number, GitHubIssue>,
    config: SyncConfig
  ): Promise<{ action: 'created' | 'updated' | 'closed' | 'skipped' | 'error' }> {
    // If we have an existing sync, check if GitHub issue still exists
    if (existingSync?.github_issue_number) {
      const issue = githubIssues.get(existingSync.github_issue_number);

      if (!issue) {
        // Issue was deleted, skip
        this.store.logSync({
          sync_run_id: runId,
          entity_type: 'task',
          motion_id: task.id,
          github_ref: `#${existingSync.github_issue_number}`,
          action: 'skip',
          status: 'skipped',
          details: { reason: 'GitHub issue no longer exists' },
        });
        return { action: 'skipped' };
      }

      // Determine sync direction
      const direction = config.forceDirection || determineSyncDirection(
        task.updatedAt,
        issue.updated_at,
        existingSync.last_motion_update,
        existingSync.last_github_update
      );

      if (direction === 'no_change') {
        this.store.logSync({
          sync_run_id: runId,
          entity_type: 'task',
          motion_id: task.id,
          github_ref: `#${issue.number}`,
          action: 'skip',
          status: 'skipped',
          details: { reason: 'No changes detected' },
        });
        return { action: 'skipped' };
      }

      if (direction === 'motion_wins' || direction === 'conflict') {
        // Push Motion changes to GitHub
        const updates = generateGithubUpdate(issue, task);
        if (updates && !config.dryRun) {
          await this.updateGitHubIssue(mapping.github_owner, mapping.github_repo, issue.number, updates);
        }

        this.store.upsertSyncState({
          motion_id: task.id,
          github_repo: mapping.github_repo,
          github_owner: mapping.github_owner,
          github_issue_number: issue.number,
          last_motion_update: task.updatedAt,
          last_github_update: new Date().toISOString(),
        });

        this.store.logSync({
          sync_run_id: runId,
          entity_type: 'task',
          motion_id: task.id,
          github_ref: `#${issue.number}`,
          action: updates?.state === 'closed' ? 'close' : 'update',
          status: 'success',
          details: { direction, updates },
        });

        return { action: updates?.state === 'closed' ? 'closed' : 'updated' };
      }

      // GitHub wins - update Motion task
      const motionUpdates = generateMotionUpdate(task, issue);
      if (motionUpdates && !config.dryRun) {
        await this.motion.updateTask(task.id, motionUpdates);
      }

      this.store.upsertSyncState({
        motion_id: task.id,
        github_repo: mapping.github_repo,
        github_owner: mapping.github_owner,
        github_issue_number: issue.number,
        last_motion_update: new Date().toISOString(),
        last_github_update: issue.updated_at,
      });

      this.store.logSync({
        sync_run_id: runId,
        entity_type: 'task',
        motion_id: task.id,
        github_ref: `#${issue.number}`,
        action: 'update',
        status: 'success',
        details: { direction: 'github_wins', updates: motionUpdates },
      });

      return { action: 'updated' };
    }

    // No existing sync - create new GitHub issue
    if (task.status === 'Completed' || task.status === 'Canceled') {
      // Don't create issues for completed tasks
      this.store.logSync({
        sync_run_id: runId,
        entity_type: 'task',
        motion_id: task.id,
        github_ref: null,
        action: 'skip',
        status: 'skipped',
        details: { reason: 'Task already completed' },
      });
      return { action: 'skipped' };
    }

    const { data: issueData, warnings } = motionTaskToGithubIssue(task, {
      owner: mapping.github_owner,
      repo: mapping.github_repo,
      full_name: `${mapping.github_owner}/${mapping.github_repo}`,
    });

    let createdIssue: GitHubIssue | null = null;
    if (!config.dryRun) {
      createdIssue = await this.createGitHubIssue(
        mapping.github_owner,
        mapping.github_repo,
        issueData
      );
    }

    const issueNumber = createdIssue?.number || 999;

    this.store.upsertSyncState({
      motion_id: task.id,
      github_repo: mapping.github_repo,
      github_owner: mapping.github_owner,
      github_issue_number: issueNumber,
      last_motion_update: task.updatedAt,
      last_github_update: new Date().toISOString(),
    });

    this.store.logSync({
      sync_run_id: runId,
      entity_type: 'task',
      motion_id: task.id,
      github_ref: `#${issueNumber}`,
      action: 'create',
      status: 'success',
      details: { warnings, dryRun: config.dryRun },
    });

    return { action: 'created' };
  }

  /**
   * Process a GitHub issue - create Motion task if needed
   */
  private async processGitHubIssue(
    issue: GitHubIssue,
    mapping: ProjectMapping,
    runId: string,
    config: SyncConfig
  ): Promise<{ action: 'created' | 'skipped' | 'error' }> {
    // Convert GitHub issue to Motion task
    const { data: taskData, warnings } = githubIssueToMotionTask(issue, mapping.motion_project_id);

    let createdTask: MotionTask | null = null;
    if (!config.dryRun) {
      createdTask = await this.motion.createTask(taskData);
    }

    const motionId = createdTask?.id || `mock-${issue.number}`;

    this.store.upsertSyncState({
      motion_id: motionId,
      github_repo: mapping.github_repo,
      github_owner: mapping.github_owner,
      github_issue_number: issue.number,
      last_motion_update: new Date().toISOString(),
      last_github_update: issue.updated_at,
    });

    this.store.logSync({
      sync_run_id: runId,
      entity_type: 'issue',
      motion_id: motionId,
      github_ref: `#${issue.number}`,
      action: 'create',
      status: 'success',
      details: { warnings, dryRun: config.dryRun },
    });

    return { action: 'created' };
  }

  // ============================================================
  // GitHub API Methods
  // ============================================================

  private async fetchGitHubIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    if (!this.githubToken || this.dryRun) {
      return this.getMockGitHubIssues();
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const issues = await response.json();
    // Filter out pull requests (they also appear in issues endpoint)
    return issues.filter((i: any) => !i.pull_request);
  }

  private async createGitHubIssue(
    owner: string,
    repo: string,
    data: { title: string; body: string; labels: string[] }
  ): Promise<GitHubIssue> {
    if (!this.githubToken) {
      throw new Error('GitHub token not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async updateGitHubIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    data: { state?: 'open' | 'closed'; title?: string; labels?: string[] }
  ): Promise<GitHubIssue> {
    if (!this.githubToken) {
      throw new Error('GitHub token not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private getMockGitHubIssues(): GitHubIssue[] {
    const now = new Date().toISOString();
    return [
      {
        id: 1,
        node_id: 'I_1',
        number: 1,
        title: 'Update README',
        body: 'Need to update the README with new setup instructions',
        state: 'open',
        labels: [{ name: 'documentation' }],
        assignees: [],
        milestone: null,
        created_at: now,
        updated_at: now,
        closed_at: null,
        html_url: 'https://github.com/example/repo/issues/1',
      },
      {
        id: 2,
        node_id: 'I_2',
        number: 2,
        title: 'Fix login bug',
        body: 'Users cannot login with SSO',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'priority: high' }],
        assignees: [{ login: 'developer' }],
        milestone: null,
        created_at: now,
        updated_at: now,
        closed_at: null,
        html_url: 'https://github.com/example/repo/issues/2',
      },
    ];
  }

  /**
   * Initialize project mappings from JSON file
   */
  async initializeMappings(mappingsPath: string): Promise<number> {
    const fs = await import('fs').then(m => m.promises);
    const content = await fs.readFile(mappingsPath, 'utf-8');
    const json = JSON.parse(content);
    return this.store.importMappingsFromJSON(json);
  }
}

export default PMAgentSync;
