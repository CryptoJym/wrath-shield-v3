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
  bullet_statements: string[];
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
  const bulletStatements: string[] = [];
  const needsAttention: string[] = [];
  let ambiguitiesCount = 0;

  for (const analysis of analyses) {
    byCategory[analysis.category] = (byCategory[analysis.category] || 0) + 1;
    byImpact[analysis.impact_level] = (byImpact[analysis.impact_level] || 0) + 1;
    authorCounts[analysis.author] = (authorCounts[analysis.author] || 0) + 1;

    // Only include high-impact bullet statements
    if (['critical', 'high', 'medium'].includes(analysis.impact_level)) {
      bulletStatements.push(analysis.bullet_statement);
    }

    if (analysis.ambiguities.length > 0) {
      ambiguitiesCount++;
      needsAttention.push(`${analysis.commit_sha.substring(0, 7)}: ${analysis.ambiguities[0]}`);
    }
  }

  // Sort contributors by commit count
  const topContributors = Object.entries(authorCounts)
    .map(([author, commits]) => ({ author, commits }))
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
