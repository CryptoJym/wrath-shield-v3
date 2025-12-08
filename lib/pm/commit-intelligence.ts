/**
 * Commit Intelligence Layer
 *
 * Analyzes GitHub commits and generates actionable progress summaries.
 * Inspired by "Tongue & Quill" military-style bullet statements.
 *
 * Features:
 * - Commit analysis and categorization
 * - Automatic progress bullet generation
 * - Impact assessment
 * - Ambiguity surfacing for PM review
 */

import { getDatabase } from '@/lib/db/Database';
import githubClient from '@/lib/integrations/GitHubClient';
import { recordEvent } from './temporal-context';
import crypto from 'crypto';

export interface CommitAnalysis {
  id: string;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  authored_at: string;
  category: CommitCategory;
  impact_level: ImpactLevel;
  bullet_statement: string;
  related_issues: string[];
  ambiguities: string[];
  metadata: Record<string, unknown>;
  analyzed_at: number;
}

export type CommitCategory =
  | 'feature' // New functionality
  | 'enhancement' // Improvement to existing
  | 'bugfix' // Bug resolution
  | 'refactor' // Code restructuring
  | 'docs' // Documentation
  | 'test' // Tests
  | 'chore' // Maintenance
  | 'security' // Security-related
  | 'performance' // Performance improvement
  | 'unknown'; // Could not categorize

export type ImpactLevel =
  | 'critical' // Major feature or breaking change
  | 'high' // Significant improvement
  | 'medium' // Standard progress
  | 'low' // Minor change
  | 'trivial'; // Housekeeping

interface CommitRow {
  id: string;
  repo_full_name: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  authored_at: string;
  category: string;
  impact_level: string;
  bullet_statement: string;
  related_issues: string;
  ambiguities: string;
  metadata: string;
  analyzed_at: number;
}

// Conventional commit patterns
const COMMIT_PATTERNS: Record<CommitCategory, RegExp[]> = {
  feature: [/^feat[(:]/i, /^add[(:]/i, /^new[(:]/i, /implement/i],
  enhancement: [/^enhance/i, /^improve/i, /^update[(:]/i, /^upgrade/i],
  bugfix: [/^fix[(:]/i, /^bug[(:]/i, /^hotfix/i, /^patch/i],
  refactor: [/^refactor/i, /^restructure/i, /^reorganize/i, /^clean/i],
  docs: [/^docs?[(:]/i, /^readme/i, /^documentation/i],
  test: [/^test[(:]/i, /^spec/i, /^coverage/i],
  chore: [/^chore[(:]/i, /^build[(:]/i, /^ci[(:]/i, /^deps/i],
  security: [/^security/i, /^vuln/i, /^cve/i, /^auth/i],
  performance: [/^perf[(:]/i, /^optim/i, /^speed/i, /^cache/i],
  unknown: [],
};

// Impact indicators
const IMPACT_INDICATORS = {
  critical: ['breaking', 'major', 'critical', 'v1', 'v2', 'launch', 'release'],
  high: ['complete', 'finish', 'implement', 'integrate', 'deploy'],
  medium: ['add', 'update', 'improve', 'fix', 'enhance'],
  low: ['tweak', 'adjust', 'minor', 'small'],
  trivial: ['typo', 'lint', 'format', 'whitespace', 'comment'],
};

function ensureTable(): void {
  const db = getDatabase().getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS commit_analysis (
      id TEXT PRIMARY KEY,
      repo_full_name TEXT NOT NULL,
      commit_sha TEXT NOT NULL UNIQUE,
      commit_message TEXT NOT NULL,
      author TEXT NOT NULL,
      authored_at TEXT NOT NULL,
      category TEXT NOT NULL,
      impact_level TEXT NOT NULL,
      bullet_statement TEXT NOT NULL,
      related_issues TEXT,
      ambiguities TEXT,
      metadata TEXT,
      analyzed_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_commit_repo ON commit_analysis(repo_full_name);
    CREATE INDEX IF NOT EXISTS idx_commit_category ON commit_analysis(category);
    CREATE INDEX IF NOT EXISTS idx_commit_impact ON commit_analysis(impact_level);
    CREATE INDEX IF NOT EXISTS idx_commit_authored ON commit_analysis(authored_at);
  `);
}

function rowToAnalysis(row: CommitRow): CommitAnalysis {
  return {
    id: row.id,
    repo_full_name: row.repo_full_name,
    commit_sha: row.commit_sha,
    commit_message: row.commit_message,
    author: row.author,
    authored_at: row.authored_at,
    category: row.category as CommitCategory,
    impact_level: row.impact_level as ImpactLevel,
    bullet_statement: row.bullet_statement,
    related_issues: JSON.parse(row.related_issues || '[]'),
    ambiguities: JSON.parse(row.ambiguities || '[]'),
    metadata: JSON.parse(row.metadata || '{}'),
    analyzed_at: row.analyzed_at,
  };
}

/**
 * Categorize a commit message
 */
function categorizeCommit(message: string): CommitCategory {
  const lowerMessage = message.toLowerCase();

  for (const [category, patterns] of Object.entries(COMMIT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerMessage)) {
        return category as CommitCategory;
      }
    }
  }

  return 'unknown';
}

/**
 * Assess impact level of a commit
 */
function assessImpact(message: string, filesChanged?: number): ImpactLevel {
  const lowerMessage = message.toLowerCase();

  for (const [level, indicators] of Object.entries(IMPACT_INDICATORS)) {
    for (const indicator of indicators) {
      if (lowerMessage.includes(indicator)) {
        return level as ImpactLevel;
      }
    }
  }

  // Use file count as secondary indicator
  if (filesChanged !== undefined) {
    if (filesChanged > 20) return 'high';
    if (filesChanged > 10) return 'medium';
    if (filesChanged > 3) return 'low';
  }

  return 'medium';
}

/**
 * Extract issue references from commit message
 */
function extractIssueRefs(message: string): string[] {
  const patterns = [
    /#(\d+)/g, // #123
    /(?:fixes?|closes?|resolves?)\s+#?(\d+)/gi, // fixes #123
    /(?:GH-|gh-)(\d+)/g, // GH-123
  ];

  const issues: Set<string> = new Set();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      issues.add(`#${match[1]}`);
    }
  }

  return Array.from(issues);
}

/**
 * Identify ambiguities that may need PM clarification
 */
function identifyAmbiguities(message: string, category: CommitCategory): string[] {
  const ambiguities: string[] = [];

  // Vague commit messages
  if (message.length < 20) {
    ambiguities.push('Commit message too brief - consider adding context');
  }

  // Unknown category
  if (category === 'unknown') {
    ambiguities.push('Could not determine commit type - manual review recommended');
  }

  // Potential scope creep indicators
  const scopeIndicators = ['also', 'additionally', 'plus', 'and also', 'while at it'];
  for (const indicator of scopeIndicators) {
    if (message.toLowerCase().includes(indicator)) {
      ambiguities.push('Multiple changes in single commit - may need decomposition');
      break;
    }
  }

  // WIP or incomplete indicators
  const wipIndicators = ['wip', 'todo', 'fixme', 'hack', 'temp', 'xxx'];
  for (const indicator of wipIndicators) {
    if (message.toLowerCase().includes(indicator)) {
      ambiguities.push('Contains work-in-progress marker - follow-up needed');
      break;
    }
  }

  return ambiguities;
}

/**
 * Generate a "Tongue & Quill" style bullet statement
 *
 * Format: ACTION--IMPACT--RESULT
 * Example: "Implemented JWT authentication--secured all API endpoints--reduced vulnerability surface by 80%"
 */
function generateBulletStatement(
  message: string,
  category: CommitCategory,
  impact: ImpactLevel,
  repoName: string
): string {
  // Extract the main action from the commit message
  let action = message.split('\n')[0].trim();

  // Remove conventional commit prefix
  action = action.replace(/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+?\))?:\s*/i, '');

  // Capitalize first letter
  action = action.charAt(0).toUpperCase() + action.slice(1);

  // Generate impact statement based on category
  const impactStatements: Record<CommitCategory, string> = {
    feature: 'expanded platform capabilities',
    enhancement: 'improved user experience',
    bugfix: 'increased system reliability',
    refactor: 'improved code maintainability',
    docs: 'enhanced project documentation',
    test: 'strengthened test coverage',
    chore: 'maintained development infrastructure',
    security: 'enhanced security posture',
    performance: 'optimized system performance',
    unknown: 'progressed project development',
  };

  // Generate result statement based on impact level
  const resultStatements: Record<ImpactLevel, string> = {
    critical: 'major milestone achieved',
    high: 'significant progress toward objectives',
    medium: 'steady advancement on deliverables',
    low: 'incremental improvements made',
    trivial: 'maintained code quality standards',
  };

  return `${action}--${impactStatements[category]}--${resultStatements[impact]}`;
}

/**
 * Analyze a single commit
 */
export function analyzeCommit(params: {
  repo_full_name: string;
  commit_sha: string;
  commit_message: string;
  author: string;
  authored_at: string;
  files_changed?: number;
}): CommitAnalysis {
  ensureTable();
  const db = getDatabase().getRawDb();
  const now = Math.floor(Date.now() / 1000);
  const id = `analysis_${params.commit_sha.substring(0, 8)}_${now}`;

  const category = categorizeCommit(params.commit_message);
  const impact = assessImpact(params.commit_message, params.files_changed);
  const relatedIssues = extractIssueRefs(params.commit_message);
  const ambiguities = identifyAmbiguities(params.commit_message, category);
  const bulletStatement = generateBulletStatement(
    params.commit_message,
    category,
    impact,
    params.repo_full_name
  );

  const metadata: Record<string, unknown> = {
    files_changed: params.files_changed,
    analysis_version: '1.0',
  };

  db.prepare(`
    INSERT OR REPLACE INTO commit_analysis (
      id, repo_full_name, commit_sha, commit_message, author, authored_at,
      category, impact_level, bullet_statement, related_issues, ambiguities,
      metadata, analyzed_at
    ) VALUES (
      @id, @repo_full_name, @commit_sha, @commit_message, @author, @authored_at,
      @category, @impact_level, @bullet_statement, @related_issues, @ambiguities,
      @metadata, @analyzed_at
    )
  `).run({
    id,
    repo_full_name: params.repo_full_name,
    commit_sha: params.commit_sha,
    commit_message: params.commit_message,
    author: params.author,
    authored_at: params.authored_at,
    category,
    impact_level: impact,
    bullet_statement: bulletStatement,
    related_issues: JSON.stringify(relatedIssues),
    ambiguities: JSON.stringify(ambiguities),
    metadata: JSON.stringify(metadata),
    analyzed_at: now,
  });

  return getCommitAnalysis(params.commit_sha)!;
}

/**
 * Get commit analysis by SHA
 */
export function getCommitAnalysis(sha: string): CommitAnalysis | null {
  ensureTable();
  const db = getDatabase().getRawDb();
  const row = db.prepare('SELECT * FROM commit_analysis WHERE commit_sha = ?').get(sha) as CommitRow | undefined;
  return row ? rowToAnalysis(row) : null;
}

/**
 * Get recent commit analyses
 */
export function getRecentAnalyses(options?: {
  repo_full_name?: string;
  category?: CommitCategory;
  impact_level?: ImpactLevel;
  limit?: number;
  since?: string; // ISO date string
}): CommitAnalysis[] {
  ensureTable();
  const db = getDatabase().getRawDb();

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options?.repo_full_name) {
    conditions.push('repo_full_name = @repo_full_name');
    params.repo_full_name = options.repo_full_name;
  }
  if (options?.category) {
    conditions.push('category = @category');
    params.category = options.category;
  }
  if (options?.impact_level) {
    conditions.push('impact_level = @impact_level');
    params.impact_level = options.impact_level;
  }
  if (options?.since) {
    conditions.push('authored_at >= @since');
    params.since = options.since;
  }

  let sql = 'SELECT * FROM commit_analysis';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY authored_at DESC';

  if (options?.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
  }

  const rows = db.prepare(sql).all(params) as CommitRow[];
  return rows.map(rowToAnalysis);
}

/**
 * Get commits with ambiguities that need PM review
 */
export function getAmbiguousCommits(options?: {
  repo_full_name?: string;
  limit?: number;
}): CommitAnalysis[] {
  ensureTable();
  const db = getDatabase().getRawDb();

  let sql = "SELECT * FROM commit_analysis WHERE ambiguities != '[]'";
  const params: Record<string, unknown> = {};

  if (options?.repo_full_name) {
    sql += ' AND repo_full_name = @repo_full_name';
    params.repo_full_name = options.repo_full_name;
  }

  sql += ' ORDER BY analyzed_at DESC';

  if (options?.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
  }

  const rows = db.prepare(sql).all(params) as CommitRow[];
  return rows.map(rowToAnalysis);
}

/**
 * Generate a project progress report from commits
 */
export function generateProgressReport(options: {
  repo_full_name?: string;
  since?: string;
  until?: string;
}): {
  period: { start: string; end: string };
  summary: {
    total_commits: number;
    by_category: Record<CommitCategory, number>;
    by_impact: Record<ImpactLevel, number>;
    ambiguities_count: number;
  };
  bullet_statements: { text: string; project: string; repo: string }[];
  top_contributors: { author: string; commits: number }[];
  needs_attention: string[];
} {
  ensureTable();
  const db = getDatabase().getRawDb();

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options.repo_full_name) {
    conditions.push('repo_full_name = @repo_full_name');
    params.repo_full_name = options.repo_full_name;
  }
  if (options.since) {
    conditions.push('authored_at >= @since');
    params.since = options.since;
  }
  if (options.until) {
    conditions.push('authored_at <= @until');
    params.until = options.until;
  }

  let sql = 'SELECT * FROM commit_analysis';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY authored_at DESC';

  const rows = db.prepare(sql).all(params) as CommitRow[];
  const analyses = rows.map(rowToAnalysis);

  // Calculate summary statistics
  const byCategory: Record<string, number> = {};
  const byImpact: Record<string, number> = {};
  const authorCounts: Record<string, number> = {};
  const bulletStatements: { text: string; project: string; repo: string }[] = [];
  const needsAttention: string[] = [];
  let ambiguitiesCount = 0;

  for (const analysis of analyses) {
    byCategory[analysis.category] = (byCategory[analysis.category] || 0) + 1;
    byImpact[analysis.impact_level] = (byImpact[analysis.impact_level] || 0) + 1;
    authorCounts[analysis.author] = (authorCounts[analysis.author] || 0) + 1;

    // Only include high-impact bullet statements with project context
    if (['critical', 'high', 'medium'].includes(analysis.impact_level)) {
      const repoParts = analysis.repo_full_name.split('/');
      bulletStatements.push({
        text: analysis.bullet_statement,
        project: repoParts[1] || analysis.repo_full_name,
        repo: analysis.repo_full_name,
      });
    }

    if (analysis.ambiguities.length > 0) {
      ambiguitiesCount++;
      needsAttention.push(`${analysis.commit_sha.substring(0, 7)}: ${analysis.ambiguities[0]}`);
    }
  }

  // Sort contributors by commit count (filtering out bots)
  const topContributors = Object.entries(authorCounts)
    .map(([author, commits]) => ({ author, commits }))
    .filter(c => !c.author.toLowerCase().includes('[bot]') &&
      !c.author.toLowerCase().includes('github-actions') &&
      c.author !== 'unknown')
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5);

  return {
    period: {
      start: options.since || analyses[analyses.length - 1]?.authored_at || new Date().toISOString(),
      end: options.until || analyses[0]?.authored_at || new Date().toISOString(),
    },
    summary: {
      total_commits: analyses.length,
      by_category: byCategory as Record<CommitCategory, number>,
      by_impact: byImpact as Record<ImpactLevel, number>,
      ambiguities_count: ambiguitiesCount,
    },
    bullet_statements: bulletStatements.slice(0, 10), // Top 10
    top_contributors: topContributors,
    needs_attention: needsAttention.slice(0, 5), // Top 5 issues
  };
}

/**
 * Analyze recent commits from GitHub
 */
export async function analyzeRecentCommits(options?: {
  repo_full_name?: string;
  since?: string;
  limit?: number;
}): Promise<{
  analyzed: number;
  skipped: number;
  errors: string[];
}> {
  if (!githubClient.isConfigured()) {
    return { analyzed: 0, skipped: 0, errors: ['GitHub not configured'] };
  }

  const enabledRepos = githubClient.getEnabledRepos();
  const reposToAnalyze = options?.repo_full_name
    ? enabledRepos.filter(r => r.repo_full_name === options.repo_full_name)
    : enabledRepos;

  let analyzed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const repo of reposToAnalyze) {
    try {
      const [owner, repoName] = repo.repo_full_name.split('/');
      const commits = await githubClient.getCommits(owner, repoName, {
        since: options?.since,
        limit: options?.limit || 50,
      });

      for (const commit of commits) {
        // Check if already analyzed
        const existing = getCommitAnalysis(commit.sha);
        if (existing) {
          skipped++;
          continue;
        }

        analyzeCommit({
          repo_full_name: repo.repo_full_name,
          commit_sha: commit.sha,
          commit_message: commit.commit.message,
          author: commit.commit.author?.name || commit.author?.login || 'unknown',
          authored_at: commit.commit.author?.date || new Date().toISOString(),
          files_changed: commit.stats?.total,
        });

        analyzed++;
      }
    } catch (error) {
      errors.push(`${repo.repo_full_name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Record temporal event for grounding
  if (analyzed > 0) {
    recordEvent({
      event_type: 'commit_analysis',
      event_key: 'batch',
      metadata: {
        analyzed,
        skipped,
        errors: errors.length,
        repos: reposToAnalyze.length,
      },
    });
  }

  return { analyzed, skipped, errors };
}

// ============================================================================
// PHASE 2E: GitHub Commit → PM Task Bridge
// ============================================================================

/**
 * Task update result from commit processing
 */
export interface TaskUpdateResult {
  closed_issues: number[];
  referenced_issues: number[];
  errors: string[];
  metadata: {
    commit_sha: string;
    repo: string;
    close_keywords_found: string[];
  };
}

/**
 * TODO item extracted from commit diff
 */
export interface TodoItem {
  id: string;
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX';
  file_path: string;
  line_number: number;
  content: string;
  context_before: string[];
  context_after: string[];
  commit_sha: string;
  commit_message: string;
  author: string;
  created_at: string;
}

/**
 * Progress update from commit activity
 */
export interface ProgressUpdate {
  issue_number: number;
  activity_type: 'mention' | 'wip' | 'progress';
  commit_sha: string;
  commit_message: string;
  commit_author: string;
  commit_date: string;
  confidence: number;
  suggested_action: 'add_comment' | 'update_labels' | 'notify' | 'none';
}

/**
 * Batch processing result
 */
export interface BatchResult {
  total_commits: number;
  issues_closed: number;
  todos_extracted: number;
  progress_updates: number;
  errors: string[];
  processing_time_ms: number;
  metadata: {
    repo: string;
    processed_at: string;
    batch_id: string;
  };
}

/**
 * Parse commit message for issue references with close keywords
 */
function parseIssueReferencesWithKeywords(message: string): {
  close: number[];
  reference: number[];
} {
  const closePatterns = [
    /(?:closes?|close|closed)\s+#(\d+)/gi,
    /(?:fixes?|fix|fixed)\s+#(\d+)/gi,
    /(?:resolves?|resolve|resolved)\s+#(\d+)/gi,
  ];

  const closeIssues: Set<number> = new Set();
  const allIssues = extractIssueRefs(message);

  // Find issues with close keywords
  for (const pattern of closePatterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      closeIssues.add(parseInt(match[1]));
    }
  }

  // Separate close vs reference
  const close = Array.from(closeIssues);
  const reference = allIssues
    .map(ref => parseInt(ref.replace('#', '')))
    .filter(num => !closeIssues.has(num));

  return { close, reference };
}

/**
 * Process a commit for task updates (auto-close issues, track references)
 *
 * Called by webhook when push is received.
 * Parses commit message for "Closes #X", "Fixes #X", "Resolves #X" and auto-closes GitHub issues.
 */
export async function processCommitForTaskUpdates(
  commitSha: string,
  commitMessage: string,
  repoFullName: string
): Promise<TaskUpdateResult> {
  const result: TaskUpdateResult = {
    closed_issues: [],
    referenced_issues: [],
    errors: [],
    metadata: {
      commit_sha: commitSha,
      repo: repoFullName,
      close_keywords_found: [],
    },
  };

  try {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      result.errors.push('Invalid repository format');
      return result;
    }

    const { close, reference } = parseIssueReferencesWithKeywords(commitMessage);
    result.referenced_issues = reference;

    // Track which keywords were found
    if (close.length > 0) {
      const lowerMessage = commitMessage.toLowerCase();
      if (/closes?|closed/i.test(lowerMessage)) result.metadata.close_keywords_found.push('closes');
      if (/fixes?|fixed/i.test(lowerMessage)) result.metadata.close_keywords_found.push('fixes');
      if (/resolves?|resolved/i.test(lowerMessage)) result.metadata.close_keywords_found.push('resolves');
    }

    // Process each issue to close
    for (const issueNum of close) {
      try {
        // Close the issue
        await githubClient.closeIssue(owner, repo, issueNum);

        // Add comment with commit reference
        const shortSha = commitSha.substring(0, 7);
        await githubClient.addIssueComment(
          owner,
          repo,
          issueNum,
          `Automatically closed by commit ${shortSha}\n\n${commitMessage}`
        );

        result.closed_issues.push(issueNum);

        // Enqueue completion signal to PM task queue
        const { enqueueSignal } = await import('./task-queue');
        await enqueueSignal({
          id: `commit-closes-${repoFullName}-${issueNum}-${Date.now()}`,
          source: 'github',
          signal_type: 'commit',
          payload: {
            action: 'closes_issue',
            issue_number: issueNum,
            commit_sha: commitSha,
            commit_message: commitMessage,
            repository: repoFullName,
          },
          timestamp: Date.now(),
          confidence: 0.95,
        });

        console.log(`[Commit Intelligence] Auto-closed issue #${issueNum} from commit ${shortSha}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to close issue #${issueNum}: ${errorMsg}`);
        console.error(`[Commit Intelligence] Error closing issue #${issueNum}:`, error);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Processing error: ${errorMsg}`);
  }

  return result;
}

/**
 * Extract TODO/FIXME comments from commit diff
 *
 * Fetches the commit diff via GitHub API and parses added lines for TODO markers.
 * Creates task signals for each TODO found.
 */
export async function extractTodosFromCommit(
  commitSha: string,
  repoFullName: string
): Promise<TodoItem[]> {
  const todos: TodoItem[] = [];

  try {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      console.error('[Commit Intelligence] Invalid repository format');
      return todos;
    }

    // Fetch commit details with diff
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(`[Commit Intelligence] Failed to fetch commit ${commitSha}: ${response.statusText}`);
      return todos;
    }

    const commitData = await response.json();
    const files = commitData.files || [];
    const commitMessage = commitData.commit?.message || '';
    const author = commitData.commit?.author?.name || 'unknown';
    const createdAt = commitData.commit?.author?.date || new Date().toISOString();

    // TODO patterns to detect
    const todoPatterns = [
      { type: 'TODO' as const, regex: /^[+\s]*\/\/\s*TODO:?\s*(.+)$/i },
      { type: 'FIXME' as const, regex: /^[+\s]*\/\/\s*FIXME:?\s*(.+)$/i },
      { type: 'HACK' as const, regex: /^[+\s]*\/\/\s*HACK:?\s*(.+)$/i },
      { type: 'XXX' as const, regex: /^[+\s]*\/\/\s*XXX:?\s*(.+)$/i },
    ];

    // Process each file in the diff
    for (const file of files) {
      const filePath = file.filename;
      const patch = file.patch;

      if (!patch) continue; // Binary file or no changes

      const lines = patch.split('\n');
      let currentLineNumber = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track line numbers (added lines start with +)
        if (line.startsWith('+')) {
          currentLineNumber++;

          // Check each TODO pattern
          for (const pattern of todoPatterns) {
            const match = pattern.regex.exec(line);
            if (match) {
              const content = match[1].trim();

              // Extract context (2 lines before and after)
              const contextBefore: string[] = [];
              const contextAfter: string[] = [];

              for (let j = Math.max(0, i - 2); j < i; j++) {
                contextBefore.push(lines[j].replace(/^[+\-\s]/, ''));
              }
              for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
                contextAfter.push(lines[j].replace(/^[+\-\s]/, ''));
              }

              const todoItem: TodoItem = {
                id: `todo_${commitSha.substring(0, 8)}_${currentLineNumber}`,
                type: pattern.type,
                file_path: filePath,
                line_number: currentLineNumber,
                content,
                context_before: contextBefore,
                context_after: contextAfter,
                commit_sha: commitSha,
                commit_message: commitMessage,
                author,
                created_at: createdAt,
              };

              todos.push(todoItem);

              // Enqueue task signal for this TODO
              try {
                const { enqueueSignal } = await import('./task-queue');
                await enqueueSignal({
                  id: `todo-${commitSha.substring(0, 8)}-${currentLineNumber}-${Date.now()}`,
                  source: 'github',
                  signal_type: 'task',
                  payload: {
                    action: 'todo_found',
                    todo_type: pattern.type,
                    file_path: filePath,
                    line_number: currentLineNumber,
                    content,
                    commit_sha: commitSha,
                    repository: repoFullName,
                    suggested_title: `[${pattern.type}] ${content.substring(0, 50)}`,
                    suggested_labels: ['todo-from-code', pattern.type.toLowerCase()],
                  },
                  timestamp: Date.now(),
                  confidence: 0.8,
                });
              } catch (error) {
                console.error('[Commit Intelligence] Failed to enqueue TODO signal:', error);
              }

              break; // Only match first pattern per line
            }
          }
        } else if (line.startsWith('@@')) {
          // Parse hunk header to get line number
          const hunkMatch = /@@ -\d+,?\d* \+(\d+),?\d* @@/.exec(line);
          if (hunkMatch) {
            currentLineNumber = parseInt(hunkMatch[1]) - 1;
          }
        }
      }
    }

    console.log(`[Commit Intelligence] Extracted ${todos.length} TODOs from commit ${commitSha.substring(0, 7)}`);
  } catch (error) {
    console.error('[Commit Intelligence] Error extracting TODOs:', error);
  }

  return todos;
}

/**
 * Update task progress based on recent commit activity
 *
 * Analyzes recent commits for issue references and WIP markers.
 * Does NOT close issues - just tracks progress.
 */
export async function updateTaskProgressFromCommits(
  repoFullName: string,
  since?: Date
): Promise<ProgressUpdate[]> {
  const updates: ProgressUpdate[] = [];

  try {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      console.error('[Commit Intelligence] Invalid repository format');
      return updates;
    }

    // Fetch recent commits
    const commits = await githubClient.getCommits(owner, repo, {
      since: since?.toISOString(),
      limit: 50,
    });

    // Track activity by issue number
    const issueActivity: Map<number, ProgressUpdate[]> = new Map();

    for (const commit of commits) {
      const message = commit.commit.message;
      const lowerMessage = message.toLowerCase();

      // Check for WIP indicators
      const isWip = /\bwip\b|work in progress|in progress/i.test(message);

      // Check for progress markers
      const hasProgressMarker = /progress on|working on|continued work/i.test(message);

      // Extract issue references
      const issueRefs = extractIssueRefs(message).map(ref => parseInt(ref.replace('#', '')));

      for (const issueNum of issueRefs) {
        let activityType: 'mention' | 'wip' | 'progress' = 'mention';
        let confidence = 0.5;
        let suggestedAction: 'add_comment' | 'update_labels' | 'notify' | 'none' = 'none';

        if (isWip) {
          activityType = 'wip';
          confidence = 0.9;
          suggestedAction = 'update_labels'; // Add "in-progress" label
        } else if (hasProgressMarker) {
          activityType = 'progress';
          confidence = 0.85;
          suggestedAction = 'add_comment'; // Summarize progress
        }

        const update: ProgressUpdate = {
          issue_number: issueNum,
          activity_type: activityType,
          commit_sha: commit.sha,
          commit_message: message,
          commit_author: commit.commit.author?.name || commit.author?.login || 'unknown',
          commit_date: commit.commit.author?.date || new Date().toISOString(),
          confidence,
          suggested_action: suggestedAction,
        };

        if (!issueActivity.has(issueNum)) {
          issueActivity.set(issueNum, []);
        }
        issueActivity.get(issueNum)!.push(update);
      }
    }

    // Aggregate updates (group multiple commits per issue)
    for (const [issueNum, activities] of issueActivity) {
      if (activities.length > 0) {
        // Use most recent activity
        const latest = activities[0];

        // If multiple commits, upgrade to add_comment
        if (activities.length > 2 && latest.suggested_action === 'none') {
          latest.suggested_action = 'add_comment';
        }

        updates.push(latest);

        // Optionally add comment on GitHub issue
        if (latest.suggested_action === 'add_comment') {
          try {
            const summaryText = `Recent activity (${activities.length} commits):\n${activities.map(a => `- ${a.commit_sha.substring(0, 7)}: ${a.commit_message.split('\n')[0]}`).join('\n')}`;
            await githubClient.addIssueComment(owner, repo, issueNum, summaryText);
          } catch (error) {
            console.error(`[Commit Intelligence] Failed to add comment to issue #${issueNum}:`, error);
          }
        }
      }
    }

    console.log(`[Commit Intelligence] Found ${updates.length} progress updates in ${repoFullName}`);
  } catch (error) {
    console.error('[Commit Intelligence] Error updating task progress:', error);
  }

  return updates;
}

/**
 * Process a batch of commits from a push event
 *
 * Efficiently processes multiple commits with batched operations.
 * Called by GitHub webhook handler.
 */
export async function processCommitBatch(
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    timestamp: string;
  }>,
  repoFullName: string
): Promise<BatchResult> {
  const startTime = Date.now();
  const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const result: BatchResult = {
    total_commits: commits.length,
    issues_closed: 0,
    todos_extracted: 0,
    progress_updates: 0,
    errors: [],
    processing_time_ms: 0,
    metadata: {
      repo: repoFullName,
      processed_at: new Date().toISOString(),
      batch_id: batchId,
    },
  };

  console.log(`[Commit Intelligence] Processing batch ${batchId}: ${commits.length} commits from ${repoFullName}`);

  try {
    // Process each commit sequentially to avoid rate limits
    for (const commit of commits) {
      try {
        // 1. Process for task updates (auto-close)
        const taskResult = await processCommitForTaskUpdates(
          commit.sha,
          commit.message,
          repoFullName
        );
        result.issues_closed += taskResult.closed_issues.length;
        result.errors.push(...taskResult.errors);

        // 2. Extract TODOs from diff
        const todos = await extractTodosFromCommit(commit.sha, repoFullName);
        result.todos_extracted += todos.length;

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Commit ${commit.sha.substring(0, 7)}: ${errorMsg}`);
      }
    }

    // 3. Update task progress from entire batch (single operation)
    const progressUpdates = await updateTaskProgressFromCommits(repoFullName);
    result.progress_updates = progressUpdates.length;

    // Record to PM memory
    try {
      const { addPMMemory } = await import('./pm-memory');
      await addPMMemory(
        `Processed ${commits.length} commits: ${result.issues_closed} issues closed, ${result.todos_extracted} TODOs found, ${result.progress_updates} progress updates`,
        'sync',
        {
          batch_id: batchId,
          repo: repoFullName,
          stats: {
            total_commits: result.total_commits,
            issues_closed: result.issues_closed,
            todos_extracted: result.todos_extracted,
            progress_updates: result.progress_updates,
          },
        }
      );
    } catch (memoryError) {
      console.warn('[Commit Intelligence] Failed to record to PM memory:', memoryError);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Batch processing error: ${errorMsg}`);
  }

  result.processing_time_ms = Date.now() - startTime;
  console.log(`[Commit Intelligence] Batch ${batchId} complete in ${result.processing_time_ms}ms`);

  return result;
}
