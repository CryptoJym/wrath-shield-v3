/**
 * Wrath Shield v3 - Database Connection and Migration Tests
 */

import { Database, getDatabase } from '../../../lib/db/Database';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('Database Connection and Migrations', () => {
  const testDbPath = join(process.cwd(), '.data', 'test.db');
  const testMigrationsPath = join(process.cwd(), '.data', 'test-migrations');

  beforeEach(() => {
    // Clean up test database and migrations
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(testMigrationsPath)) {
      rmSync(testMigrationsPath, { recursive: true });
    }

    // Create test migrations directory
    mkdirSync(testMigrationsPath, { recursive: true });

    // Reset singleton instance
    Database.resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    Database.resetInstance();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    if (existsSync(testMigrationsPath)) {
      rmSync(testMigrationsPath, { recursive: true });
    }
  });

  describe('Database Initialization', () => {
    it('should create database file on initialization', () => {
      expect(existsSync(testDbPath)).toBe(false);

      const db = Database.getInstance(testDbPath, testMigrationsPath);

      expect(existsSync(testDbPath)).toBe(true);
      expect(db).toBeInstanceOf(Database);
    });

    it('should return same instance on subsequent calls (singleton)', () => {
      const db1 = Database.getInstance(testDbPath, testMigrationsPath);
      const db2 = Database.getInstance(testDbPath, testMigrationsPath);

      expect(db1).toBe(db2);
    });

    it('should configure WAL mode and foreign keys', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      const rawDb = db.getRawDb();

      const journalMode = rawDb.pragma('journal_mode', { simple: true });
      const foreignKeys = rawDb.pragma('foreign_keys', { simple: true });

      expect(journalMode).toBe('wal');
      expect(foreignKeys).toBe(1);
    });
  });

  describe('Migration Runner', () => {
    it('should apply migration files in alphabetical order', () => {
      // Create test migrations
      writeFileSync(
        join(testMigrationsPath, '001_initial.sql'),
        `
          CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
          INSERT INTO migrations (name) VALUES ('001_initial') ON CONFLICT DO NOTHING;
        `
      );
      writeFileSync(
        join(testMigrationsPath, '002_add_email.sql'),
        `
          ALTER TABLE users ADD COLUMN email TEXT;
          INSERT INTO migrations (name) VALUES ('002_add_email') ON CONFLICT DO NOTHING;
        `
      );

      // Initialize database (should run migrations)
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      // Verify both migrations were applied
      const migrations = db
        .prepare('SELECT name FROM migrations ORDER BY name')
        .all();

      expect(migrations).toHaveLength(2);
      expect(migrations[0]).toHaveProperty('name', '001_initial');
      expect(migrations[1]).toHaveProperty('name', '002_add_email');

      // Verify table structure
      const tableInfo = db
        .prepare("PRAGMA table_info(users)")
        .all();

      expect(tableInfo).toHaveLength(3); // id, name, email
    });

    it('should not re-apply already applied migrations', () => {
      // Create migration
      writeFileSync(
        join(testMigrationsPath, '001_initial.sql'),
        `
          CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
          INSERT INTO migrations (name) VALUES ('001_initial') ON CONFLICT DO NOTHING;
        `
      );

      // Initialize database first time
      const db1 = Database.getInstance(testDbPath, testMigrationsPath);
      db1.close();

      // Reset instance and re-initialize (should not re-apply migration)
      Database.resetInstance();
      const db2 = Database.getInstance(testDbPath, testMigrationsPath);

      // Should still have only one migration record
      const migrations = db2
        .prepare('SELECT name FROM migrations')
        .all();

      expect(migrations).toHaveLength(1);
    });

    it('should skip migrations if directory does not exist', () => {
      const nonExistentPath = join(process.cwd(), '.data', 'no-migrations');

      // Should not throw error
      expect(() => {
        Database.getInstance(testDbPath, nonExistentPath);
      }).not.toThrow();
    });

    it('should throw error on invalid SQL in migration', () => {
      writeFileSync(
        join(testMigrationsPath, '001_broken.sql'),
        `
          CREATE INVALID SYNTAX HERE;
          INSERT INTO migrations (name) VALUES ('001_broken') ON CONFLICT DO NOTHING;
        `
      );

      expect(() => {
        Database.getInstance(testDbPath, testMigrationsPath);
      }).toThrow('Migration failed: 001_broken');
    });
  });

  describe('Database Operations', () => {
    beforeEach(() => {
      // Create a simple migration for testing
      writeFileSync(
        join(testMigrationsPath, '001_test_table.sql'),
        `
          CREATE TABLE test_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value INTEGER
          );
          INSERT INTO migrations (name) VALUES ('001_test_table') ON CONFLICT DO NOTHING;
        `
      );
    });

    it('should execute raw SQL with exec()', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      db.exec("INSERT INTO test_data (name, value) VALUES ('test', 123)");

      const result = db.prepare('SELECT * FROM test_data').get();
      expect(result).toMatchObject({ name: 'test', value: 123 });
    });

    it('should prepare and execute parameterized queries', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      const insert = db.prepare('INSERT INTO test_data (name, value) VALUES (?, ?)');
      insert.run('test1', 100);
      insert.run('test2', 200);

      const select = db.prepare('SELECT * FROM test_data WHERE value > ?');
      const results = select.all(150);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ name: 'test2', value: 200 });
    });

    it('should execute transactions with automatic rollback on error', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      const insert = db.prepare('INSERT INTO test_data (name, value) VALUES (?, ?)');

      // Transaction that succeeds
      db.transaction(() => {
        insert.run('tx1', 1);
        insert.run('tx2', 2);
      });

      let count = db.prepare('SELECT COUNT(*) as count FROM test_data').get() as { count: number };
      expect(count.count).toBe(2);

      // Transaction that fails (should rollback)
      try {
        db.transaction(() => {
          insert.run('tx3', 3);
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Expected error
      }

      count = db.prepare('SELECT COUNT(*) as count FROM test_data').get() as { count: number };
      expect(count.count).toBe(2); // Should still be 2, not 3
    });
  });

  describe('Singleton Management', () => {
    it('should close database connection on close()', () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);

      db.close();

      // Attempting to use closed database should throw
      expect(() => {
        db.exec('SELECT 1');
      }).toThrow();
    });

    it('should reset instance on resetInstance()', () => {
      const db1 = Database.getInstance(testDbPath, testMigrationsPath);

      Database.resetInstance();

      const db2 = Database.getInstance(testDbPath, testMigrationsPath);

      // Should be different instances
      expect(db1).not.toBe(db2);
    });

    it('getDatabase() should return singleton instance', () => {
      // Mock default paths for getDatabase()
      const db1 = getDatabase();
      const db2 = getDatabase();

      expect(db1).toBe(db2);
    });
  });
});
