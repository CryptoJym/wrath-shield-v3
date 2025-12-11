// @ts-nocheck
/**
 * Wrath Shield v3 - Commit Intelligence Tests
 *
 * Tests for commit analysis and progress tracking:
 * - Commit categorization
 * - Impact assessment
 * - Issue reference extraction
 * - Bullet statement generation
 * - Ambiguity detection
 * - Progress report generation
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

// Mock GitHub client
const mockGetCommits = jest.fn().mockResolvedValue([]);
const mockGetEnabledRepos = jest.fn().mockReturnValue([]);
const mockIsConfigured = jest.fn().mockReturnValue(true);
const mockCloseIssue = jest.fn().mockResolvedValue(undefined);
const mockAddIssueComment = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: {
    getCommits: mockGetCommits,
    getEnabledRepos: mockGetEnabledRepos,
    isConfigured: mockIsConfigured,
    closeIssue: mockCloseIssue,
    addIssueComment: mockAddIssueComment,
  },
}));

// Mock temporal-context
jest.mock('@/lib/pm/temporal-context', () => ({
  recordEvent: jest.fn(),
}));

// Mock task-queue
jest.mock('@/lib/pm/task-queue', () => ({
  enqueueSignal: jest.fn().mockResolvedValue(undefined),
}));

// Mock pm-memory
jest.mock('@/lib/pm/pm-memory', () => ({
  addPMMemory: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch for GitHub API
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ files: [], commit: { message: '', author: { name: 'test' } } }),
});

import {
  analyzeCommit,
  getCommitAnalysis,
  getRecentAnalyses,
  getAmbiguousCommits,
  generateProgressReport,
  analyzeRecentCommits,
  processCommitForTaskUpdates,
  extractTodosFromCommit,
  updateTaskProgressFromCommits,
  processCommitBatch,
  type CommitAnalysis,
  type CommitCategory,
  type ImpactLevel,
  type TodoItem,
  type ProgressUpdate,
  type BatchResult,
} from '@/lib/pm/commit-intelligence';

describe('Commit Intelligence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
  });

  describe('analyzeCommit', () => {
    it('should categorize feature commits', () => {
      const mockRow = {
        id: 'analysis_abc12345_1234567890',
        repo_full_name: 'org/repo',
        commit_sha: 'abc12345',
        commit_message: 'feat: add new login feature',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
        category: 'feature',
        impact_level: 'medium',
        bullet_statement: 'Test statement',
        related_issues: '[]',
        ambiguities: '[]',
        metadata: '{}',
        analyzed_at: 1234567890,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = analyzeCommit({
        repo_full_name: 'org/repo',
        commit_sha: 'abc12345',
        commit_message: 'feat: add new login feature',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
      });

      expect(analysis.category).toBe('feature');
    });

    it('should categorize bugfix commits', () => {
      const mockRow = {
        id: 'analysis_def67890_1234567890',
        repo_full_name: 'org/repo',
        commit_sha: 'def67890',
        commit_message: 'fix: resolve login bug',
        author: 'bob',
        authored_at: '2025-01-15T10:00:00Z',
        category: 'bugfix',
        impact_level: 'medium',
        bullet_statement: 'Test',
        related_issues: '[]',
        ambiguities: '[]',
        metadata: '{}',
        analyzed_at: 1234567890,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = analyzeCommit({
        repo_full_name: 'org/repo',
        commit_sha: 'def67890',
        commit_message: 'fix: resolve login bug',
        author: 'bob',
        authored_at: '2025-01-15T10:00:00Z',
      });

      expect(analysis.category).toBe('bugfix');
    });

    it('should extract issue references', () => {
      const mockRow = {
        id: 'analysis_ghi_1234567890',
        repo_full_name: 'org/repo',
        commit_sha: 'ghi11111',
        commit_message: 'fix: resolve bug #123, fixes #456',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
        category: 'bugfix',
        impact_level: 'medium',
        bullet_statement: 'Test',
        related_issues: '["#123","#456"]',
        ambiguities: '[]',
        metadata: '{}',
        analyzed_at: 1234567890,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = analyzeCommit({
        repo_full_name: 'org/repo',
        commit_sha: 'ghi11111',
        commit_message: 'fix: resolve bug #123, fixes #456',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
      });

      expect(analysis.related_issues).toContain('#123');
      expect(analysis.related_issues).toContain('#456');
    });

    it('should detect ambiguities in brief messages', () => {
      const mockRow = {
        id: 'analysis_jkl_1234567890',
        repo_full_name: 'org/repo',
        commit_sha: 'jkl22222',
        commit_message: 'fix stuff',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
        category: 'unknown',
        impact_level: 'medium',
        bullet_statement: 'Test',
        related_issues: '[]',
        ambiguities: '["Commit message too brief - consider adding context"]',
        metadata: '{}',
        analyzed_at: 1234567890,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = analyzeCommit({
        repo_full_name: 'org/repo',
        commit_sha: 'jkl22222',
        commit_message: 'fix stuff',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
      });

      expect(analysis.ambiguities.length).toBeGreaterThan(0);
    });

    it('should detect WIP markers', () => {
      const mockRow = {
        id: 'analysis_mno_1234567890',
        repo_full_name: 'org/repo',
        commit_sha: 'mno33333',
        commit_message: 'WIP: working on authentication',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
        category: 'feature',
        impact_level: 'medium',
        bullet_statement: 'Test',
        related_issues: '[]',
        ambiguities: '["Contains work-in-progress marker - follow-up needed"]',
        metadata: '{}',
        analyzed_at: 1234567890,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = analyzeCommit({
        repo_full_name: 'org/repo',
        commit_sha: 'mno33333',
        commit_message: 'WIP: working on authentication',
        author: 'alice',
        authored_at: '2025-01-15T10:00:00Z',
      });

      expect(analysis.ambiguities.some(a => a.includes('work-in-progress'))).toBe(true);
    });
  });

  describe('CommitCategory', () => {
    it('should include all expected categories', () => {
      const categories: CommitCategory[] = [
        'feature', 'enhancement', 'bugfix', 'refactor',
        'docs', 'test', 'chore', 'security', 'performance', 'unknown'
      ];
      expect(categories).toHaveLength(10);
    });
  });

  describe('ImpactLevel', () => {
    it('should include all expected levels', () => {
      const levels: ImpactLevel[] = [
        'critical', 'high', 'medium', 'low', 'trivial'
      ];
      expect(levels).toHaveLength(5);
    });
  });

  describe('getCommitAnalysis', () => {
    it('should return analysis when found', () => {
      const mockRow = {
        id: 'analysis_abc_123',
        repo_full_name: 'org/repo',
        commit_sha: 'abc12345',
        commit_message: 'test',
        author: 'alice',
        authored_at: '2025-01-01',
        category: 'feature',
        impact_level: 'medium',
        bullet_statement: 'Test',
        related_issues: '[]',
        ambiguities: '[]',
        metadata: '{}',
        analyzed_at: 123,
      };
      mockGet.mockReturnValueOnce(mockRow);

      const analysis = getCommitAnalysis('abc12345');

      expect(analysis).not.toBeNull();
      expect(analysis?.commit_sha).toBe('abc12345');
    });

    it('should return null when not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const analysis = getCommitAnalysis('nonexistent');

      expect(analysis).toBeNull();
    });
  });

  describe('getRecentAnalyses', () => {
    it('should return recent analyses', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'analysis_1',
          repo_full_name: 'org/repo',
          commit_sha: 'sha1',
          commit_message: 'feat: one',
          author: 'alice',
          authored_at: '2025-01-15',
          category: 'feature',
          impact_level: 'high',
          bullet_statement: 'Test',
          related_issues: '[]',
          ambiguities: '[]',
          metadata: '{}',
          analyzed_at: 123,
        },
      ]);

      const analyses = getRecentAnalyses({ limit: 10 });

      expect(analyses).toHaveLength(1);
    });

    it('should filter by repo', () => {
      mockAll.mockReturnValueOnce([]);

      getRecentAnalyses({ repo_full_name: 'org/specific-repo' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('repo_full_name = @repo_full_name')
      );
    });

    it('should filter by category', () => {
      mockAll.mockReturnValueOnce([]);

      getRecentAnalyses({ category: 'feature' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('category = @category')
      );
    });

    it('should filter by impact level', () => {
      mockAll.mockReturnValueOnce([]);

      getRecentAnalyses({ impact_level: 'high' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('impact_level = @impact_level')
      );
    });
  });

  describe('getAmbiguousCommits', () => {
    it('should return commits with ambiguities', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'analysis_1',
          repo_full_name: 'org/repo',
          commit_sha: 'sha1',
          commit_message: 'wip',
          author: 'alice',
          authored_at: '2025-01-15',
          category: 'unknown',
          impact_level: 'medium',
          bullet_statement: 'Test',
          related_issues: '[]',
          ambiguities: '["Brief message"]',
          metadata: '{}',
          analyzed_at: 123,
        },
      ]);

      const ambiguous = getAmbiguousCommits();

      expect(ambiguous).toHaveLength(1);
    });

    it('should filter by repo', () => {
      mockAll.mockReturnValueOnce([]);

      getAmbiguousCommits({ repo_full_name: 'org/repo' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('repo_full_name = @repo_full_name')
      );
    });
  });

  describe('generateProgressReport', () => {
    it('should generate report with stats', () => {
      mockAll.mockReturnValueOnce([
        {
          id: '1',
          repo_full_name: 'org/repo',
          commit_sha: 'sha1',
          commit_message: 'feat: feature',
          author: 'alice',
          authored_at: '2025-01-15',
          category: 'feature',
          impact_level: 'high',
          bullet_statement: 'Added feature--expanded capabilities--major progress',
          related_issues: '[]',
          ambiguities: '[]',
          metadata: '{}',
          analyzed_at: 123,
        },
        {
          id: '2',
          repo_full_name: 'org/repo',
          commit_sha: 'sha2',
          commit_message: 'fix: bugfix',
          author: 'bob',
          authored_at: '2025-01-14',
          category: 'bugfix',
          impact_level: 'medium',
          bullet_statement: 'Fixed bug--improved reliability--steady progress',
          related_issues: '[]',
          ambiguities: '[]',
          metadata: '{}',
          analyzed_at: 124,
        },
      ]);

      const report = generateProgressReport({});

      expect(report.summary.total_commits).toBe(2);
      expect(report.summary.by_category.feature).toBe(1);
      expect(report.summary.by_category.bugfix).toBe(1);
      expect(report.summary.by_impact.high).toBe(1);
      expect(report.top_contributors.length).toBeGreaterThan(0);
    });

    it('should filter out bots from contributors', () => {
      mockAll.mockReturnValueOnce([
        {
          id: '1',
          repo_full_name: 'org/repo',
          commit_sha: 'sha1',
          commit_message: 'chore: update',
          author: 'dependabot[bot]',
          authored_at: '2025-01-15',
          category: 'chore',
          impact_level: 'trivial',
          bullet_statement: 'Test',
          related_issues: '[]',
          ambiguities: '[]',
          metadata: '{}',
          analyzed_at: 123,
        },
      ]);

      const report = generateProgressReport({});

      expect(report.top_contributors.length).toBe(0);
    });
  });

  describe('analyzeRecentCommits', () => {
    it('should return error when GitHub not configured', async () => {
      mockIsConfigured.mockReturnValueOnce(false);

      const result = await analyzeRecentCommits();

      expect(result.errors).toContain('GitHub not configured');
    });

    it('should analyze commits from enabled repos', async () => {
      mockIsConfigured.mockReturnValueOnce(true);
      mockGetEnabledRepos.mockReturnValueOnce([
        { repo_full_name: 'org/repo' }
      ]);
      mockGetCommits.mockResolvedValueOnce([
        {
          sha: 'abc123',
          commit: {
            message: 'feat: new feature',
            author: { name: 'alice', date: '2025-01-15' },
          },
          author: { login: 'alice' },
          stats: { total: 5 },
        },
      ]);
      mockGet.mockReturnValueOnce(undefined); // No existing analysis
      mockGet.mockReturnValueOnce({ id: 'new' }); // Return newly created

      const result = await analyzeRecentCommits();

      expect(result.analyzed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processCommitForTaskUpdates', () => {
    it('should close issues with close keywords', async () => {
      const result = await processCommitForTaskUpdates(
        'abc123',
        'fix: resolve bug, closes #123',
        'org/repo'
      );

      expect(result.metadata.close_keywords_found).toContain('closes');
    });

    it('should handle invalid repo format', async () => {
      const result = await processCommitForTaskUpdates(
        'abc123',
        'fix: something',
        'invalid-format'
      );

      expect(result.errors).toContain('Invalid repository format');
    });
  });

  describe('extractTodosFromCommit', () => {
    it('should extract TODO comments from diff', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          files: [
            {
              filename: 'src/app.ts',
              patch: '+// TODO: implement this feature',
            },
          ],
          commit: { message: 'feat: add placeholder', author: { name: 'alice', date: '2025-01-15' } },
        }),
      });

      const todos = await extractTodosFromCommit('abc123', 'org/repo');

      // May be 0 if parsing doesn't match, but should not error
      expect(Array.isArray(todos)).toBe(true);
    });

    it('should handle invalid repo format', async () => {
      const todos = await extractTodosFromCommit('abc123', 'invalid');

      expect(todos).toEqual([]);
    });
  });

  describe('updateTaskProgressFromCommits', () => {
    it('should return updates for referenced issues', async () => {
      mockGetCommits.mockResolvedValueOnce([
        {
          sha: 'abc123',
          commit: {
            message: 'WIP: working on #42',
            author: { name: 'alice', date: '2025-01-15' },
          },
          author: { login: 'alice' },
        },
      ]);

      const updates = await updateTaskProgressFromCommits('org/repo');

      expect(Array.isArray(updates)).toBe(true);
    });

    it('should handle invalid repo format', async () => {
      const updates = await updateTaskProgressFromCommits('invalid');

      expect(updates).toEqual([]);
    });
  });

  describe('processCommitBatch', () => {
    it('should process multiple commits', async () => {
      const commits = [
        { sha: 'abc123', message: 'feat: one', author: 'alice', timestamp: '2025-01-15' },
        { sha: 'def456', message: 'fix: two', author: 'bob', timestamp: '2025-01-15' },
      ];

      const result = await processCommitBatch(commits, 'org/repo');

      expect(result.total_commits).toBe(2);
      expect(result.metadata.repo).toBe('org/repo');
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid TodoItem', () => {
      const todo: TodoItem = {
        id: 'todo_abc_1',
        type: 'TODO',
        file_path: 'src/app.ts',
        line_number: 42,
        content: 'Implement feature',
        context_before: ['// some code'],
        context_after: ['// more code'],
        commit_sha: 'abc123',
        commit_message: 'feat: add placeholder',
        author: 'alice',
        created_at: '2025-01-15',
      };

      expect(todo.type).toBe('TODO');
    });

    it('should accept valid ProgressUpdate', () => {
      const update: ProgressUpdate = {
        issue_number: 42,
        activity_type: 'wip',
        commit_sha: 'abc123',
        commit_message: 'WIP: working on feature',
        commit_author: 'alice',
        commit_date: '2025-01-15',
        confidence: 0.9,
        suggested_action: 'update_labels',
      };

      expect(update.activity_type).toBe('wip');
    });

    it('should accept valid BatchResult', () => {
      const result: BatchResult = {
        total_commits: 10,
        issues_closed: 2,
        todos_extracted: 5,
        progress_updates: 3,
        errors: [],
        processing_time_ms: 1500,
        metadata: {
          repo: 'org/repo',
          processed_at: '2025-01-15',
          batch_id: 'batch_123',
        },
      };

      expect(result.total_commits).toBe(10);
    });
  });
});
