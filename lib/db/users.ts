import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), '.data', 'users.db');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  primary_email TEXT,
  aliases TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
`;

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.exec(schema);
  return db;
}

export type UserRecord = {
  user_id: string;
  username?: string;
  primary_email?: string;
  aliases?: string[];
};

export function upsertUser(user: UserRecord) {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (user_id, username, primary_email, aliases)
     VALUES (@user_id, @username, @primary_email, @aliases)
     ON CONFLICT(user_id) DO UPDATE SET
       username=excluded.username,
       primary_email=excluded.primary_email,
       aliases=excluded.aliases,
       updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')`
  ).run({
    user_id: user.user_id,
    username: user.username ?? null,
    primary_email: user.primary_email ?? null,
    aliases: user.aliases ? JSON.stringify(user.aliases) : null,
  });
  db.close();
}

export function getUser(user_id: string): UserRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user_id) as any;
  db.close();
  if (!row) return null;
  return {
    user_id: row.user_id,
    username: row.username || undefined,
    primary_email: row.primary_email || undefined,
    aliases: row.aliases ? JSON.parse(row.aliases) : undefined,
  };
}
