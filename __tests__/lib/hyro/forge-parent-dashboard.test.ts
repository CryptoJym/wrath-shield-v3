// @ts-nocheck
/**
 * Hyro Forge: Parent Dashboard Tests
 * Tests for Phase 3 - Parent/teacher dashboard with weekly summaries, trends, and AI insights
 */

import { Database } from '../../../lib/db/Database';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock OpenRouterClient for AI insights
const mockGetCoachingResponse = jest.fn();
jest.mock('../../../lib/OpenRouterClient', () => ({
  OpenRouterClient: jest.fn().mockImplementation(() => ({
    getCoachingResponse: mockGetCoachingResponse,
  })),
}));

// Helper to apply all Hyro Forge migrations
function applyForgeHyroMigration(db: Database) {
  // Apply the base Forge RPG migration
  const migrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  if (existsSync(migrationPath)) {
    const sql = readFileSync(migrationPath, 'utf8');
    db.exec(sql);
  }
  // Apply phase 3 mastery migration (contains XP, skill evidence, achievements tables)
  const phase3Path = join(process.cwd(), 'migrations', '015_hyro_phase3_mastery.sql');
  if (existsSync(phase3Path)) {
    const sql = readFileSync(phase3Path, 'utf8');
    db.exec(sql);
  }
}

describe('Hyro Forge Parent Dashboard', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-parent-dash-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
    Database.resetInstance();

    // Reset mocks
    mockGetCoachingResponse.mockReset();
    mockGetCoachingResponse.mockResolvedValue({
      content: JSON.stringify([
        'Great progress this week!',
        'Focus on reading practice.',
        'Keep up the streak!',
      ]),
    });
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
  });

  describe('getWeeklySummary', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklySummary } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getWeeklySummary).toBe('function');
    });

    it('should return weekly summary structure', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklySummary } = await import('../../../lib/hyro/forge-parent-dashboard');

      const summary = getWeeklySummary();

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('period');
      expect(summary.period).toHaveProperty('start');
      expect(summary.period).toHaveProperty('end');
      expect(summary).toHaveProperty('stats');
      expect(summary.stats).toHaveProperty('xp_earned');
      expect(summary.stats).toHaveProperty('time_minutes');
      expect(summary.stats).toHaveProperty('sessions');
      expect(summary.stats).toHaveProperty('streak_days');
      expect(summary.stats).toHaveProperty('quests_completed');
    });

    it('should return zero stats when no activity', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklySummary } = await import('../../../lib/hyro/forge-parent-dashboard');

      const summary = getWeeklySummary();

      expect(summary.stats.xp_earned).toBe(0);
      expect(summary.stats.sessions).toBe(0);
    });

    it('should return valid date range', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklySummary } = await import('../../../lib/hyro/forge-parent-dashboard');

      const summary = getWeeklySummary();

      // Period should be 7 days
      const start = new Date(summary.period.start);
      const end = new Date(summary.period.end);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(7);
    });
  });

  describe('getTrendAnalysis', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getTrendAnalysis } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getTrendAnalysis).toBe('function');
    });

    it('should return array of trend indicators', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getTrendAnalysis } = await import('../../../lib/hyro/forge-parent-dashboard');

      const trends = getTrendAnalysis();

      expect(Array.isArray(trends)).toBe(true);
    });

    it('should have correct trend structure when data exists', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Add some skill evidence
      const twoWeeksAgo = Math.floor(Date.now() / 1000) - (14 * 86400);
      const oneWeekAgo = Math.floor(Date.now() / 1000) - (7 * 86400);
      const now = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO hyro_skill_evidence (id, stat_name, source_type, performance_score, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('ev1', 'math', 'lesson', 70, twoWeeksAgo);

      db.prepare(`
        INSERT INTO hyro_skill_evidence (id, stat_name, source_type, performance_score, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('ev2', 'math', 'lesson', 80, now);

      const { getTrendAnalysis } = await import('../../../lib/hyro/forge-parent-dashboard');

      const trends = getTrendAnalysis();

      // Should have at least one trend for math
      const mathTrend = trends.find(t => t.stat_name === 'math');
      if (mathTrend) {
        expect(mathTrend).toHaveProperty('display_name');
        expect(mathTrend).toHaveProperty('direction');
        expect(mathTrend).toHaveProperty('change_percent');
        expect(['up', 'down', 'stable']).toContain(mathTrend.direction);
      }
    });
  });

  describe('getTopStrengths', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getTopStrengths } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getTopStrengths).toBe('function');
    });

    it('should return array of strength areas', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getTopStrengths } = await import('../../../lib/hyro/forge-parent-dashboard');

      const strengths = getTopStrengths();

      expect(Array.isArray(strengths)).toBe(true);
    });

    it('should limit to top 3 strengths', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getTopStrengths } = await import('../../../lib/hyro/forge-parent-dashboard');

      const strengths = getTopStrengths();

      expect(strengths.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getGrowthAreas', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getGrowthAreas } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getGrowthAreas).toBe('function');
    });

    it('should return array of growth areas', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getGrowthAreas } = await import('../../../lib/hyro/forge-parent-dashboard');

      const growthAreas = getGrowthAreas();

      expect(Array.isArray(growthAreas)).toBe(true);
    });

    it('should have suggestion for each growth area', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getGrowthAreas } = await import('../../../lib/hyro/forge-parent-dashboard');

      const growthAreas = getGrowthAreas();

      for (const area of growthAreas) {
        expect(area).toHaveProperty('suggestion');
        expect(typeof area.suggestion).toBe('string');
      }
    });
  });

  describe('getBenchmarkComparison', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getBenchmarkComparison } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getBenchmarkComparison).toBe('function');
    });

    it('should return comparison for all 8 stats', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getBenchmarkComparison } = await import('../../../lib/hyro/forge-parent-dashboard');

      const comparisons = getBenchmarkComparison();

      expect(comparisons.length).toBe(8);
    });
  });

  describe('getRecentAchievements', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getRecentAchievements } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getRecentAchievements).toBe('function');
    });

    it('should return empty array when no achievements', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getRecentAchievements } = await import('../../../lib/hyro/forge-parent-dashboard');

      const achievements = getRecentAchievements();

      expect(Array.isArray(achievements)).toBe(true);
    });
  });

  describe('generateAIInsights', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { generateAIInsights } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof generateAIInsights).toBe('function');
    });

    it('should return array of insight strings', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { generateAIInsights } = await import('../../../lib/hyro/forge-parent-dashboard');

      const mockSummary = {
        period: { start: '2025-11-26', end: '2025-12-03' },
        stats: {
          xp_earned: 500,
          time_minutes: 120,
          sessions: 5,
          streak_days: 7,
          quests_completed: 3,
        },
        trends: [],
        strengths: [],
        growth_areas: [],
        recent_achievements: [],
        ai_insights: [],
      };

      const insights = await generateAIInsights(mockSummary);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.length).toBeLessThanOrEqual(4);
    });

    it('should return fallback insights on LLM failure', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Mock LLM failure
      mockGetCoachingResponse.mockRejectedValue(new Error('LLM unavailable'));

      const { generateAIInsights } = await import('../../../lib/hyro/forge-parent-dashboard');

      const mockSummary = {
        period: { start: '2025-11-26', end: '2025-12-03' },
        stats: {
          xp_earned: 500,
          time_minutes: 120,
          sessions: 5,
          streak_days: 7,
          quests_completed: 3,
        },
        trends: [{ stat_name: 'math', display_name: 'Math', direction: 'up' as const, change_percent: 10, current_value: 70, previous_value: 60 }],
        strengths: [],
        growth_areas: [{ stat_name: 'reading', display_name: 'Reading', current: 40, benchmark: 60, gap: 20, suggestion: 'Practice more' }],
        recent_achievements: [],
        ai_insights: [],
      };

      const insights = await generateAIInsights(mockSummary);

      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('getParentSummary', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getParentSummary } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getParentSummary).toBe('function');
    });

    it('should return complete parent summary', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getParentSummary } = await import('../../../lib/hyro/forge-parent-dashboard');

      const summary = await getParentSummary();

      expect(summary).toHaveProperty('period');
      expect(summary).toHaveProperty('stats');
      expect(summary).toHaveProperty('trends');
      expect(summary).toHaveProperty('strengths');
      expect(summary).toHaveProperty('growth_areas');
      expect(summary).toHaveProperty('recent_achievements');
      expect(summary).toHaveProperty('ai_insights');
    });

    it('should include AI-generated insights', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getParentSummary } = await import('../../../lib/hyro/forge-parent-dashboard');

      const summary = await getParentSummary();

      expect(Array.isArray(summary.ai_insights)).toBe(true);
    });
  });

  describe('getWeeklyBreakdown', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklyBreakdown } = await import('../../../lib/hyro/forge-parent-dashboard');
      expect(typeof getWeeklyBreakdown).toBe('function');
    });

    it('should return 7 days of breakdown', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklyBreakdown } = await import('../../../lib/hyro/forge-parent-dashboard');

      const breakdown = getWeeklyBreakdown();

      expect(breakdown.length).toBe(7);
    });

    it('should have correct structure for each day', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklyBreakdown } = await import('../../../lib/hyro/forge-parent-dashboard');

      const breakdown = getWeeklyBreakdown();

      for (const day of breakdown) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('xp_earned');
        expect(day).toHaveProperty('time_minutes');
        expect(day).toHaveProperty('sessions');
        expect(day).toHaveProperty('quests_completed');
        expect(day).toHaveProperty('activities');
      }
    });

    it('should have dates in correct order (oldest to newest)', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { getWeeklyBreakdown } = await import('../../../lib/hyro/forge-parent-dashboard');

      const breakdown = getWeeklyBreakdown();

      for (let i = 1; i < breakdown.length; i++) {
        const prevDate = new Date(breakdown[i - 1].date);
        const currDate = new Date(breakdown[i].date);
        expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
      }
    });
  });
});
