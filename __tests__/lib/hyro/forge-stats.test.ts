// @ts-nocheck
/**
 * Hyro Forge: Stats System Tests
 * Tests for character profile, stats management, and spider graph data
 */

import { Database } from '../../../lib/db/Database';
import {
  getCharacter,
  getCharacterSheet,
  getAllStats,
  getStat,
  getAllStatsWithTrend,
  updateStat,
  applyStatModifier,
  clearStatModifiers,
  getSpiderGraphData,
  getStatHistory,
  calculatePowerLevel,
} from '../../../lib/hyro/forge-stats';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Helper to apply Hyro Forge migration manually (since test mode only applies 001, 002)
function applyForgeHyroMigration(db: Database) {
  const migrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  db.exec(sql);
}

describe('Hyro Forge Stats System', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-stats-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
    Database.resetInstance();
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
  });

  describe('Character Profile', () => {
    it('should return character profile from seed data', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const character = getCharacter();

      expect(character).not.toBeNull();
      expect(character?.id).toBe('hyro');
      expect(character?.display_name).toBe('Hyro');
      expect(character?.level).toBe(1);
      expect(character?.total_xp).toBe(0);
    });

    it('should return full character sheet with stats', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const sheet = getCharacterSheet();

      expect(sheet).not.toBeNull();
      expect(sheet?.stats).toBeDefined();
      expect(sheet?.stats.length).toBe(8); // 8 core stats
      expect(sheet?.xp_to_next_level).toBeDefined();
      expect(sheet?.xp_progress_percent).toBeDefined();
    });
  });

  describe('Stats Management', () => {
    it('should return all 8 core stats', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const stats = getAllStats();

      expect(stats.length).toBe(8);

      const statNames = stats.map(s => s.stat_name);
      expect(statNames).toContain('math');
      expect(statNames).toContain('reading');
      expect(statNames).toContain('science');
      expect(statNames).toContain('coding');
      expect(statNames).toContain('study_skills');
      expect(statNames).toContain('critical_thinking');
      expect(statNames).toContain('technology');
      expect(statNames).toContain('problem_solving');
    });

    it('should get single stat by name', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const mathStat = getStat('math');

      expect(mathStat).not.toBeNull();
      expect(mathStat?.stat_name).toBe('math');
      expect(mathStat?.display_name).toBe('Mathematics');
    });

    it('should return null for non-existent stat', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const fakeStat = getStat('fake_stat' as any);

      expect(fakeStat).toBeNull();
    });

    it('should return stats with trend data', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const statsWithTrend = getAllStatsWithTrend();

      expect(statsWithTrend.length).toBe(8);
      expect(statsWithTrend[0]).toHaveProperty('trend');
      expect(statsWithTrend[0]).toHaveProperty('change_7d');
      expect(statsWithTrend[0]).toHaveProperty('benchmark');
      expect(['up', 'down', 'stable']).toContain(statsWithTrend[0].trend);
    });
  });

  describe('Stat Updates', () => {
    it('should update stat value', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const initialStat = getStat('math');
      const result = updateStat('math', 50, 'Test update');

      expect(result.stat_name).toBe('math');
      expect(result.previous_value).toBe(initialStat?.current_value);
      expect(result.new_value).toBe(50);
      expect(result.change).toBe(50 - (initialStat?.current_value || 0));

      // Verify stat was updated
      const updatedStat = getStat('math');
      expect(updatedStat?.current_value).toBe(50);
    });

    it('should clamp stat value between 1 and 100', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Try to set above 100
      const resultHigh = updateStat('math', 150, 'Over max');
      expect(resultHigh.new_value).toBe(100);

      // Try to set below 1
      const resultLow = updateStat('reading', -10, 'Under min');
      expect(resultLow.new_value).toBe(1);
    });

    it('should record stat history on update', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      updateStat('math', 55, 'Test history');

      const history = getStatHistory('math', 7);

      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].value).toBe(55);
      expect(history[history.length - 1].change_reason).toBe('Test history');
    });

    it('should throw error for non-existent stat', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      expect(() => {
        updateStat('fake_stat' as any, 50, 'Test');
      }).toThrow('Stat not found: fake_stat');
    });
  });

  describe('Stat Modifiers', () => {
    it('should apply temporary modifier to stat', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      applyStatModifier('math', 5);

      const stat = getStat('math');
      expect(stat?.modifier).toBe(5);
    });

    it('should clear all modifiers', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      applyStatModifier('math', 5);
      applyStatModifier('reading', 3);

      clearStatModifiers();

      const mathStat = getStat('math');
      const readingStat = getStat('reading');

      expect(mathStat?.modifier).toBe(0);
      expect(readingStat?.modifier).toBe(0);
    });
  });

  describe('Spider Graph Data', () => {
    it('should return properly formatted spider graph data', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const graphData = getSpiderGraphData();

      expect(graphData.stats).toBeDefined();
      expect(graphData.stats.length).toBe(8);
      expect(graphData.meta).toBeDefined();
      expect(graphData.meta.level).toBeDefined();
      expect(graphData.meta.total_xp).toBeDefined();

      // Check stat structure
      const firstStat = graphData.stats[0];
      expect(firstStat).toHaveProperty('name');
      expect(firstStat).toHaveProperty('displayName');
      expect(firstStat).toHaveProperty('value');
      expect(firstStat).toHaveProperty('benchmark');
      expect(firstStat).toHaveProperty('fullMark');
      expect(firstStat.fullMark).toBe(100);
    });

    it('should include modifier in value calculation', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const initialData = getSpiderGraphData();
      const mathInitial = initialData.stats.find(s => s.name === 'math');

      applyStatModifier('math', 10);

      const modifiedData = getSpiderGraphData();
      const mathModified = modifiedData.stats.find(s => s.name === 'math');

      expect(mathModified?.value).toBe((mathInitial?.value || 0) + 10);
    });
  });

  describe('Power Level Calculation', () => {
    it('should calculate power level as average of all stats', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const power = calculatePowerLevel();

      expect(power.power_level).toBeGreaterThan(0);
      expect(power.power_level).toBeLessThanOrEqual(100);
      expect(power.rank).toBeDefined();
      expect(power.strongest_stat).toBeDefined();
      expect(power.weakest_stat).toBeDefined();
    });

    it('should identify correct rank based on power level', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Set all stats to 85 for Legendary rank test
      const stats = getAllStats();
      for (const stat of stats) {
        updateStat(stat.stat_name as any, 85, 'Power test');
      }

      const power = calculatePowerLevel();
      expect(power.rank).toBe('Legendary');
    });

    it('should identify strongest and weakest stats', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Set specific values
      updateStat('math', 90, 'Strongest');
      updateStat('reading', 10, 'Weakest');

      const power = calculatePowerLevel();

      expect(power.strongest_stat).toBe('Mathematics');
      expect(power.weakest_stat).toBe('Reading & Language Arts');
    });
  });
});
