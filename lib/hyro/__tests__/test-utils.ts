/**
 * Test utilities for Hyro Forge Phase 3 tests
 * Provides in-memory database setup and teardown
 */

import BetterSqlite3 from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// Store the original getDatabase function
let mockDb: BetterSqlite3.Database | null = null;

/**
 * Create an in-memory test database with Phase 3 schema
 */
export function createTestDatabase(): BetterSqlite3.Database {
  const db = new BetterSqlite3(':memory:');

  // Apply required migrations
  const migrationsDir = resolve(process.cwd(), 'migrations');
  const migrationFiles = [
    '001_wrath_shield_core.sql',
    '010_hyro_forge.sql',
    '015_hyro_phase3_mastery.sql',
  ];

  for (const file of migrationFiles) {
    const path = join(migrationsDir, file);
    if (existsSync(path)) {
      const sql = readFileSync(path, 'utf8');
      try {
        db.exec(sql);
      } catch (e) {
        // Ignore errors from CREATE TABLE IF NOT EXISTS conflicts
      }
    }
  }

  // Initialize hyro_character for XP tests
  db.exec(`
    INSERT OR IGNORE INTO hyro_character (id, display_name, title, level, total_xp)
    VALUES ('hyro', 'Hyro', 'Apprentice Forger', 1, 0)
  `);

  mockDb = db;
  return db;
}

/**
 * Get the mock database
 */
export function getMockDb(): BetterSqlite3.Database | null {
  return mockDb;
}

/**
 * Clean up the test database
 */
export function cleanupTestDatabase(): void {
  if (mockDb) {
    mockDb.close();
    mockDb = null;
  }
}

/**
 * Create mock database wrapper matching the Database class interface
 */
export function createMockDatabaseWrapper(db: BetterSqlite3.Database) {
  return {
    prepare: (sql: string) => db.prepare(sql),
    exec: (sql: string) => db.exec(sql),
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
    getRawDb: () => db,
    close: () => db.close(),
  };
}

/**
 * Helper to advance time for testing time-based features
 */
export function advanceTime(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds;
}

/**
 * Helper to get timestamp for days ago
 */
export function daysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - (days * 86400);
}
