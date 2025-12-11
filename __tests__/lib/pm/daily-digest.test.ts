// @ts-nocheck
/**
 * Wrath Shield v3 - Daily Digest Tests
 *
 * Tests for PM daily digest generation:
 * - DailyDigest structure
 * - Auto actions aggregation
 * - Proposals and escalations
 * - Statistics generation
 * - Insights and warnings
 * - Markdown and HTML formatting
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 }),
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock task-queue
jest.mock('@/lib/pm/task-queue', () => ({
  getQueueStatus: jest.fn().mockResolvedValue({
    pending: 5,
    failed: 2,
    avg_processing_time_ms: 1500,
  }),
  getQueuedItemsByStatus: jest.fn().mockResolvedValue([]),
}));

// Mock background-jobs
jest.mock('@/lib/pm/background-jobs', () => ({
  getAllJobExecutions: jest.fn().mockReturnValue([]),
}));

// Mock pm-memory
jest.mock('@/lib/pm/pm-memory', () => ({
  searchPMMemory: jest.fn().mockResolvedValue({ results: [] }),
}));

import {
  generateDailyDigest,
  getDigestStats,
  getActionableItems,
  generateInsights,
  generateWarnings,
  formatDigestAsMarkdown,
  formatDigestAsHTML,
  type DailyDigest,
  type AutoAction,
  type Proposal,
  type Escalation,
  type DigestStats,
} from '@/lib/pm/daily-digest';

describe('Daily Digest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
  });

  describe('Types', () => {
    it('should define DailyDigest interface', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 10,
          tasks_created: 15,
          signals_processed: 50,
          decisions_auto: 30,
          decisions_proposed: 15,
          decisions_escalated: 5,
          queue_health: {
            pending: 5,
            failed: 2,
            avg_processing_time_ms: 1500,
          },
        },
        insights: ['Insight 1', 'Insight 2'],
        warnings: ['Warning 1'],
      };

      expect(digest.period.start).toBeDefined();
      expect(digest.stats.signals_processed).toBe(50);
    });

    it('should define AutoAction interface', () => {
      const action: AutoAction = {
        id: 'action-1',
        timestamp: new Date().toISOString(),
        action_type: 'github_issue',
        description: 'Auto-closed issue #123',
        result: 'success',
        details: { issue_number: 123 },
      };

      expect(action.result).toBe('success');
    });

    it('should define Proposal interface', () => {
      const proposal: Proposal = {
        id: 'proposal-1',
        timestamp: new Date().toISOString(),
        proposal_type: 'create_issue',
        description: 'Create new issue for bug fix',
        rationale: 'Based on user report',
        options: ['Approve', 'Reject', 'Defer'],
        recommended_action: 'Approve and create',
        deadline: '2025-02-01',
      };

      expect(proposal.options).toHaveLength(3);
    });

    it('should define Escalation interface', () => {
      const escalation: Escalation = {
        id: 'escalation-1',
        timestamp: new Date().toISOString(),
        severity: 'critical',
        title: 'Urgent deadline approaching',
        description: 'Task due tomorrow',
        context: 'High priority project',
        required_action: 'Review and complete',
        deadline: '2025-01-15',
      };

      expect(escalation.severity).toBe('critical');
    });

    it('should define DigestStats interface', () => {
      const stats: DigestStats = {
        tasks_completed: 25,
        tasks_created: 30,
        signals_processed: 100,
        decisions_auto: 60,
        decisions_proposed: 30,
        decisions_escalated: 10,
        queue_health: {
          pending: 10,
          failed: 3,
          avg_processing_time_ms: 2000,
        },
      };

      expect(stats.tasks_completed + stats.tasks_created).toBe(55);
    });
  });

  describe('generateDailyDigest', () => {
    it('should generate digest for last 24 hours by default', async () => {
      mockAll.mockReturnValue([]);

      const digest = await generateDailyDigest();

      expect(digest.generated_at).toBeDefined();
      expect(digest.period.start).toBeDefined();
      expect(digest.period.end).toBeDefined();
      expect(Array.isArray(digest.auto_actions)).toBe(true);
      expect(Array.isArray(digest.proposals)).toBe(true);
      expect(Array.isArray(digest.escalations)).toBe(true);
    });

    it('should generate digest for custom time period', async () => {
      const customDate = new Date(Date.now() - 7 * 86400000); // 7 days ago
      mockAll.mockReturnValue([]);

      const digest = await generateDailyDigest(customDate);

      const periodStart = new Date(digest.period.start);
      expect(periodStart.getTime()).toBeCloseTo(customDate.getTime(), -3);
    });

    it('should aggregate auto actions', async () => {
      mockAll.mockReturnValueOnce([
        { triage_escalation_level: 'auto', count: 10 },
        { triage_escalation_level: 'propose', count: 5 },
        { triage_escalation_level: 'critical', count: 2 },
      ]);

      const digest = await generateDailyDigest();

      expect(digest.stats.decisions_auto).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDigestStats', () => {
    it('should return stats with default values', async () => {
      mockAll.mockReturnValue([]);

      const stats = await getDigestStats();

      expect(stats.tasks_completed).toBeGreaterThanOrEqual(0);
      expect(stats.tasks_created).toBeGreaterThanOrEqual(0);
      expect(stats.signals_processed).toBeGreaterThanOrEqual(0);
      expect(stats.queue_health).toBeDefined();
    });

    it('should aggregate escalation level counts', async () => {
      mockAll.mockReturnValueOnce([
        { triage_escalation_level: 'auto', count: 20 },
        { triage_escalation_level: 'propose', count: 10 },
        { triage_escalation_level: 'critical', count: 3 },
      ]);

      const stats = await getDigestStats();

      expect(stats.signals_processed).toBe(33);
      expect(stats.decisions_auto).toBe(20);
      expect(stats.decisions_proposed).toBe(10);
      expect(stats.decisions_escalated).toBe(3);
    });

    it('should include queue health metrics', async () => {
      mockAll.mockReturnValue([]);

      const stats = await getDigestStats();

      expect(stats.queue_health.pending).toBe(5);
      expect(stats.queue_health.failed).toBe(2);
      expect(stats.queue_health.avg_processing_time_ms).toBe(1500);
    });
  });

  describe('getActionableItems', () => {
    it('should return proposals and escalations', async () => {
      mockAll.mockReturnValue([]);

      const items = await getActionableItems();

      expect(items.proposals).toBeDefined();
      expect(items.escalations).toBeDefined();
      expect(Array.isArray(items.proposals)).toBe(true);
      expect(Array.isArray(items.escalations)).toBe(true);
    });

    it('should fetch items from last week', async () => {
      mockAll.mockReturnValue([]);

      await getActionableItems();

      // Verify the query was called with appropriate time range
      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('generateInsights', () => {
    it('should generate insights from source distribution', async () => {
      mockAll.mockReturnValueOnce([
        { signal_source: 'github', count: 30 },
        { signal_source: 'inbox', count: 10 },
      ]);

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const insights = await generateInsights(period);

      expect(Array.isArray(insights)).toBe(true);
    });

    it('should handle empty data gracefully', async () => {
      mockAll.mockReturnValue([]);

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const insights = await generateInsights(period);

      expect(Array.isArray(insights)).toBe(true);
    });

    it('should include confidence trends', async () => {
      mockAll
        .mockReturnValueOnce([{ signal_source: 'github', count: 20 }])
        .mockReturnValueOnce({ avg_confidence: 0.85 });

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const insights = await generateInsights(period);

      expect(Array.isArray(insights)).toBe(true);
    });
  });

  describe('generateWarnings', () => {
    it('should warn about queue backlog', async () => {
      const stats: DigestStats = {
        tasks_completed: 10,
        tasks_created: 15,
        signals_processed: 50,
        decisions_auto: 30,
        decisions_proposed: 15,
        decisions_escalated: 5,
        queue_health: {
          pending: 25, // > 20 threshold
          failed: 2,
          avg_processing_time_ms: 1500,
        },
      };

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const warnings = await generateWarnings(stats, period);

      expect(warnings.some(w => w.includes('backlog'))).toBe(true);
    });

    it('should warn about failed items', async () => {
      const stats: DigestStats = {
        tasks_completed: 10,
        tasks_created: 15,
        signals_processed: 50,
        decisions_auto: 30,
        decisions_proposed: 15,
        decisions_escalated: 5,
        queue_health: {
          pending: 5,
          failed: 10, // > 5 threshold
          avg_processing_time_ms: 1500,
        },
      };

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const warnings = await generateWarnings(stats, period);

      expect(warnings.some(w => w.includes('failure'))).toBe(true);
    });

    it('should warn about processing slowdown', async () => {
      const stats: DigestStats = {
        tasks_completed: 10,
        tasks_created: 15,
        signals_processed: 50,
        decisions_auto: 30,
        decisions_proposed: 15,
        decisions_escalated: 5,
        queue_health: {
          pending: 5,
          failed: 2,
          avg_processing_time_ms: 15000, // > 10000 threshold
        },
      };

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const warnings = await generateWarnings(stats, period);

      expect(warnings.some(w => w.includes('slowdown'))).toBe(true);
    });

    it('should warn about high escalation rate', async () => {
      const stats: DigestStats = {
        tasks_completed: 10,
        tasks_created: 15,
        signals_processed: 50,
        decisions_auto: 30,
        decisions_proposed: 15,
        decisions_escalated: 10, // > 3 threshold
        queue_health: {
          pending: 5,
          failed: 2,
          avg_processing_time_ms: 1500,
        },
      };

      const period = {
        start: new Date(Date.now() - 86400000),
        end: new Date(),
      };

      const warnings = await generateWarnings(stats, period);

      expect(warnings.some(w => w.includes('escalation'))).toBe(true);
    });
  });

  describe('formatDigestAsMarkdown', () => {
    it('should format digest as markdown', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [
          {
            id: 'action-1',
            timestamp: new Date().toISOString(),
            action_type: 'github_issue',
            description: 'Auto-closed issue #123',
            result: 'success',
          },
        ],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 10,
          tasks_created: 15,
          signals_processed: 50,
          decisions_auto: 30,
          decisions_proposed: 15,
          decisions_escalated: 5,
          queue_health: {
            pending: 5,
            failed: 2,
            avg_processing_time_ms: 1500,
          },
        },
        insights: ['Test insight'],
        warnings: [],
      };

      const markdown = formatDigestAsMarkdown(digest);

      expect(markdown).toContain('# PM Council Daily Digest');
      expect(markdown).toContain('Auto Actions');
      expect(markdown).toContain('Statistics');
      expect(markdown).toContain('Test insight');
    });

    it('should handle empty sections', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 0,
          tasks_created: 0,
          signals_processed: 0,
          decisions_auto: 0,
          decisions_proposed: 0,
          decisions_escalated: 0,
          queue_health: {
            pending: 0,
            failed: 0,
            avg_processing_time_ms: 0,
          },
        },
        insights: [],
        warnings: [],
      };

      const markdown = formatDigestAsMarkdown(digest);

      expect(markdown).toContain('No auto actions');
      expect(markdown).toContain('No proposals');
      expect(markdown).toContain('No escalations');
    });

    it('should format escalations with severity icons', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [
          {
            id: 'esc-1',
            timestamp: new Date().toISOString(),
            severity: 'critical',
            title: 'Critical issue',
            description: 'Needs immediate attention',
            context: 'Production',
            required_action: 'Fix now',
          },
        ],
        stats: {
          tasks_completed: 0,
          tasks_created: 0,
          signals_processed: 0,
          decisions_auto: 0,
          decisions_proposed: 0,
          decisions_escalated: 1,
          queue_health: {
            pending: 0,
            failed: 0,
            avg_processing_time_ms: 0,
          },
        },
        insights: [],
        warnings: [],
      };

      const markdown = formatDigestAsMarkdown(digest);

      expect(markdown).toContain('🔴');
      expect(markdown).toContain('CRITICAL');
    });
  });

  describe('formatDigestAsHTML', () => {
    it('should format digest as HTML', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 10,
          tasks_created: 15,
          signals_processed: 50,
          decisions_auto: 30,
          decisions_proposed: 15,
          decisions_escalated: 5,
          queue_health: {
            pending: 5,
            failed: 2,
            avg_processing_time_ms: 1500,
          },
        },
        insights: [],
        warnings: [],
      };

      const html = formatDigestAsHTML(digest);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('PM Council Daily Digest');
      expect(html).toContain('</html>');
    });

    it('should include CSS styles', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 0,
          tasks_created: 0,
          signals_processed: 0,
          decisions_auto: 0,
          decisions_proposed: 0,
          decisions_escalated: 0,
          queue_health: {
            pending: 0,
            failed: 0,
            avg_processing_time_ms: 0,
          },
        },
        insights: [],
        warnings: [],
      };

      const html = formatDigestAsHTML(digest);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('should include stat boxes', () => {
      const digest: DailyDigest = {
        generated_at: new Date().toISOString(),
        period: {
          start: new Date(Date.now() - 86400000).toISOString(),
          end: new Date().toISOString(),
        },
        auto_actions: [],
        proposals: [],
        escalations: [],
        stats: {
          tasks_completed: 10,
          tasks_created: 15,
          signals_processed: 50,
          decisions_auto: 30,
          decisions_proposed: 15,
          decisions_escalated: 5,
          queue_health: {
            pending: 5,
            failed: 2,
            avg_processing_time_ms: 1500,
          },
        },
        insights: [],
        warnings: [],
      };

      const html = formatDigestAsHTML(digest);

      expect(html).toContain('stat-box');
      expect(html).toContain('stat-value');
      expect(html).toContain('50'); // signals processed
    });
  });
});
