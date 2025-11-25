import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createLegalContextRequestIfMissing } from './store';

type SyncStats = { created: number; skipped: number; source: string };

// Check monorepo path first, then home directory
const MONOREPO_DB = path.resolve(process.cwd(), 'packages', 'legal-scrapers', '.data', 'action_items.db');
const HOME_DB = path.resolve(os.homedir(), '.legal_advocate_ai', 'action_items.db');
const DEFAULT_DB = fs.existsSync(MONOREPO_DB) ? MONOREPO_DB : HOME_DB;

function openExternalDb(dbPath: string) {
  return new BetterSqlite3(dbPath, { fileMustExist: true });
}

export function syncFromLegalAdvocate(userId = 'default'): SyncStats {
  const dbPath = process.env.LEGAL_AI_DB_PATH || DEFAULT_DB;
  if (!fs.existsSync(dbPath)) return { created: 0, skipped: 0, source: dbPath };

  const db = openExternalDb(dbPath);
  let created = 0;
  let skipped = 0;

  // attorney requests table -> legal context
  try {
    const reqRows = db
      .prepare(
        `SELECT what_is_needed, requested_by, deadline, requested_date
         FROM requests`
      )
      .all() as any[];

    for (const row of reqRows) {
      const summary = row.what_is_needed || '';
      const contact = row.requested_by || null;
      const due = row.deadline || null;
      const { created: didCreate } = createLegalContextRequestIfMissing({
        user_id: userId,
        contact,
        topic: 'Attorney request',
        source: 'action_items.requests',
        summary,
        due_date: due,
      });
      didCreate ? created++ : skipped++;
    }
  } catch {
    // ignore if table missing
  }

  // deadlines table -> legal context (as FYI tasks)
  try {
    const deadlineRows = db
      .prepare(
        `SELECT action_required, deadline_date, responsible_party
         FROM deadlines`
      )
      .all() as any[];
    for (const row of deadlineRows) {
      const summary = row.action_required || '';
      const contact = row.responsible_party || null;
      const due = row.deadline_date || null;
      const { created: didCreate } = createLegalContextRequestIfMissing({
        user_id: userId,
        contact,
        topic: 'Deadline',
        source: 'action_items.deadlines',
        summary,
        due_date: due,
      });
      didCreate ? created++ : skipped++;
    }
  } catch {
    // ignore if table missing
  }

  db.close();
  return { created, skipped, source: dbPath };
}
