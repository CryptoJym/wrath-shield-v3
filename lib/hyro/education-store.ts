/**
 * Education Data Store
 *
 * SQLite-based storage for education data:
 * - Assignments from external platforms (Canyon Grove, etc.)
 * - Lesson plans (created or imported)
 * - Weekly schedules
 * - Progress tracking
 */

import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ensureServerOnly } from '../server-only-guard';

ensureServerOnly('lib/hyro/education-store');

const dbPath = path.resolve(process.cwd(), '.data', 'hyro', 'education.db');

// Types
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type AssignmentPlatform = 'canyon_grove' | 'google_classroom' | 'canvas' | 'lexia' | 'zearn' | 'manual' | 'other';
export type SubjectArea = 'math' | 'reading' | 'writing' | 'science' | 'social_studies' | 'art' | 'music' | 'pe' | 'other';

export interface Assignment {
  id: string;
  platform: AssignmentPlatform;
  platform_id?: string; // External ID from the platform
  student_id: string;
  subject: SubjectArea;
  title: string;
  description?: string;
  due_date?: number; // Unix timestamp
  assigned_date?: number;
  status: AssignmentStatus;
  score?: number;
  max_score?: number;
  url?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
  synced_at?: number;
}

export interface LessonPlan {
  id: string;
  student_id: string;
  subject: SubjectArea;
  topic: string;
  objectives: string[]; // JSON array
  activities: LessonActivity[]; // JSON array
  duration_minutes: number;
  scheduled_date?: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:MM
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'archived';
  resources?: LessonResource[]; // JSON array
  notes?: string;
  effectiveness_rating?: number; // 1-5
  feedback?: string;
  created_at: number;
  updated_at: number;
}

export interface LessonActivity {
  name: string;
  duration_minutes: number;
  type: 'instruction' | 'practice' | 'assessment' | 'discussion' | 'project' | 'game' | 'break';
  description?: string;
  materials?: string[];
}

export interface LessonResource {
  title: string;
  type: 'video' | 'worksheet' | 'website' | 'book' | 'game' | 'app' | 'other';
  url?: string;
  notes?: string;
}

export interface WeeklySchedule {
  id: string;
  student_id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  schedule: DaySchedule[]; // JSON array
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface DaySchedule {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  blocks: ScheduleBlock[];
}

export interface ScheduleBlock {
  start_time: string; // HH:MM
  end_time: string;
  subject: SubjectArea;
  activity?: string;
  lesson_plan_id?: string;
  assignment_id?: string;
}

export interface PlatformCredentials {
  platform: AssignmentPlatform;
  username?: string;
  encrypted_password?: string;
  cookies?: string; // JSON - encrypted session cookies
  last_login_at?: number;
  status: 'active' | 'expired' | 'error';
  error_message?: string;
}

export interface SyncLog {
  id: string;
  platform: AssignmentPlatform;
  student_id: string;
  success: boolean;
  assignments_found: number;
  assignments_new: number;
  assignments_updated: number;
  error?: string;
  synced_at: number;
}

export interface Standard {
  id: string;
  category: string;
  domain: string;
  description: string;
  prerequisites: string[];
  cluster?: string;
}

export interface StandardMastery {
  student_id: string;
  standard_id: string;
  mastery_level: number;
  evidence_count: number;
  last_practiced_at?: number;
  status: 'locked' | 'unlocked' | 'practicing' | 'mastered';
  confidence_score: number;
}

export interface Concept {
  id: string;
  name: string;
  definition: string;
  discipline?: string;
  layer: 'fundamental' | 'derived' | 'heuristic';
}

export interface StandardConcept {
  standard_id: string;
  concept_id: string;
  authenticity_layer: 'direct' | 'approximation' | 'special_case';
  notes?: string;
  // Hydrated fields
  concept?: Concept;
}

// Schema
const schema = `
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_id TEXT,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date INTEGER,
  assigned_date INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  score REAL,
  max_score REAL,
  url TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_platform ON assignments(platform, platform_id);

CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  objectives TEXT NOT NULL, -- JSON array
  activities TEXT NOT NULL, -- JSON array
  duration_minutes INTEGER NOT NULL,
  scheduled_date TEXT,
  scheduled_time TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  resources TEXT, -- JSON array
  notes TEXT,
  effectiveness_rating INTEGER,
  feedback TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_student ON lesson_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_date ON lesson_plans(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject ON lesson_plans(subject);

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  week_start TEXT NOT NULL, -- YYYY-MM-DD
  schedule TEXT NOT NULL, -- JSON array
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(student_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_student ON weekly_schedules(student_id);

CREATE TABLE IF NOT EXISTS platform_credentials (
  platform TEXT PRIMARY KEY,
  username TEXT,
  encrypted_password TEXT,
  cookies TEXT,
  last_login_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  student_id TEXT NOT NULL,
  success INTEGER NOT NULL,
  assignments_found INTEGER DEFAULT 0,
  assignments_new INTEGER DEFAULT 0,
  assignments_updated INTEGER DEFAULT 0,
  error TEXT,
  synced_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON sync_logs(platform, synced_at DESC);

CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT NOT NULL,
  prerequisites TEXT, -- JSON array
  cluster TEXT
);
CREATE INDEX IF NOT EXISTS idx_standards_domain ON standards(domain);

CREATE TABLE IF NOT EXISTS standard_mastery (
  student_id TEXT NOT NULL,
  standard_id TEXT NOT NULL,
  mastery_level REAL DEFAULT 0, -- 0-100
  evidence_count INTEGER DEFAULT 0,
  last_practiced_at INTEGER,
  status TEXT DEFAULT 'locked', -- locked, unlocked, practicing, mastered
  confidence_score REAL DEFAULT 0,
  PRIMARY KEY (student_id, standard_id)
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  discipline TEXT, -- physics, math, philosophy
  layer TEXT NOT NULL DEFAULT 'fundamental' -- fundamental, derived, heuristic
);

CREATE TABLE IF NOT EXISTS standard_concepts (
  standard_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  authenticity_layer TEXT NOT NULL DEFAULT 'direct', -- direct, approximation, special_case
  notes TEXT,
  PRIMARY KEY (standard_id, concept_id)
);
`;

function getDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// ============================================================================
// Assignments CRUD
// ============================================================================

export function createAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Assignment {
  const db = getDb();
  const id = generateId();
  const timestamp = now();

  const newAssignment: Assignment = {
    ...assignment,
    id,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.prepare(`
    INSERT INTO assignments (
      id, platform, platform_id, student_id, subject, title, description,
      due_date, assigned_date, status, score, max_score, url, notes,
      created_at, updated_at, synced_at
    ) VALUES (
      @id, @platform, @platform_id, @student_id, @subject, @title, @description,
      @due_date, @assigned_date, @status, @score, @max_score, @url, @notes,
      @created_at, @updated_at, @synced_at
    )
  `).run({
    ...newAssignment,
    platform_id: newAssignment.platform_id || null,
    description: newAssignment.description || null,
    due_date: newAssignment.due_date || null,
    assigned_date: newAssignment.assigned_date || null,
    score: newAssignment.score || null,
    max_score: newAssignment.max_score || null,
    url: newAssignment.url || null,
    notes: newAssignment.notes || null,
    synced_at: newAssignment.synced_at || null,
  });

  db.close();
  return newAssignment;
}

export function updateAssignment(
  id: string,
  updates: Partial<Omit<Assignment, 'id' | 'created_at'>>
): Assignment | null {
  const db = getDb();
  const existing = getAssignment(id);
  if (!existing) {
    db.close();
    return null;
  }

  const merged: Assignment = { ...existing, ...updates, updated_at: now() };

  db.prepare(`
    UPDATE assignments SET
      platform = @platform,
      platform_id = @platform_id,
      student_id = @student_id,
      subject = @subject,
      title = @title,
      description = @description,
      due_date = @due_date,
      assigned_date = @assigned_date,
      status = @status,
      score = @score,
      max_score = @max_score,
      url = @url,
      notes = @notes,
      updated_at = @updated_at,
      synced_at = @synced_at
    WHERE id = @id
  `).run({
    ...merged,
    platform_id: merged.platform_id || null,
    description: merged.description || null,
    due_date: merged.due_date || null,
    assigned_date: merged.assigned_date || null,
    score: merged.score || null,
    max_score: merged.max_score || null,
    url: merged.url || null,
    notes: merged.notes || null,
    synced_at: merged.synced_at || null,
  });

  db.close();
  return merged;
}

export function getAssignment(id: string): Assignment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as Assignment | undefined;
  db.close();
  return row || null;
}

export function getAssignmentByPlatformId(platform: AssignmentPlatform, platformId: string): Assignment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assignments WHERE platform = ? AND platform_id = ?').get(platform, platformId) as Assignment | undefined;
  db.close();
  return row || null;
}

export function listAssignments(options?: {
  student_id?: string;
  platform?: AssignmentPlatform;
  status?: AssignmentStatus;
  subject?: SubjectArea;
  due_before?: number;
  due_after?: number;
  limit?: number;
  offset?: number;
}): Assignment[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (options?.student_id) {
    where.push('student_id = ?');
    params.push(options.student_id);
  }
  if (options?.platform) {
    where.push('platform = ?');
    params.push(options.platform);
  }
  if (options?.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (options?.subject) {
    where.push('subject = ?');
    params.push(options.subject);
  }
  if (options?.due_before) {
    where.push('due_date <= ?');
    params.push(options.due_before);
  }
  if (options?.due_after) {
    where.push('due_date >= ?');
    params.push(options.due_after);
  }

  let sql = `SELECT * FROM assignments`;
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY due_date ASC NULLS LAST, updated_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.prepare(sql).all(...params) as Assignment[];
  db.close();
  return rows;
}

export function deleteAssignment(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
  db.close();
  return result.changes > 0;
}

// ============================================================================
// Lesson Plans CRUD
// ============================================================================

export function createLessonPlan(plan: Omit<LessonPlan, 'id' | 'created_at' | 'updated_at'>): LessonPlan {
  const db = getDb();
  const id = generateId();
  const timestamp = now();

  const newPlan: LessonPlan = {
    ...plan,
    id,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.prepare(`
    INSERT INTO lesson_plans (
      id, student_id, subject, topic, objectives, activities, duration_minutes,
      scheduled_date, scheduled_time, status, resources, notes,
      effectiveness_rating, feedback, created_at, updated_at
    ) VALUES (
      @id, @student_id, @subject, @topic, @objectives, @activities, @duration_minutes,
      @scheduled_date, @scheduled_time, @status, @resources, @notes,
      @effectiveness_rating, @feedback, @created_at, @updated_at
    )
  `).run({
    ...newPlan,
    objectives: JSON.stringify(newPlan.objectives),
    activities: JSON.stringify(newPlan.activities),
    resources: newPlan.resources ? JSON.stringify(newPlan.resources) : null,
    scheduled_date: newPlan.scheduled_date || null,
    scheduled_time: newPlan.scheduled_time || null,
    notes: newPlan.notes || null,
    effectiveness_rating: newPlan.effectiveness_rating || null,
    feedback: newPlan.feedback || null,
  });

  db.close();
  return newPlan;
}

export function updateLessonPlan(
  id: string,
  updates: Partial<Omit<LessonPlan, 'id' | 'created_at'>>
): LessonPlan | null {
  const db = getDb();
  const existing = getLessonPlan(id);
  if (!existing) {
    db.close();
    return null;
  }

  const merged: LessonPlan = { ...existing, ...updates, updated_at: now() };

  db.prepare(`
    UPDATE lesson_plans SET
      student_id = @student_id,
      subject = @subject,
      topic = @topic,
      objectives = @objectives,
      activities = @activities,
      duration_minutes = @duration_minutes,
      scheduled_date = @scheduled_date,
      scheduled_time = @scheduled_time,
      status = @status,
      resources = @resources,
      notes = @notes,
      effectiveness_rating = @effectiveness_rating,
      feedback = @feedback,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    ...merged,
    objectives: JSON.stringify(merged.objectives),
    activities: JSON.stringify(merged.activities),
    resources: merged.resources ? JSON.stringify(merged.resources) : null,
    scheduled_date: merged.scheduled_date || null,
    scheduled_time: merged.scheduled_time || null,
    notes: merged.notes || null,
    effectiveness_rating: merged.effectiveness_rating || null,
    feedback: merged.feedback || null,
  });

  db.close();
  return merged;
}

export function getLessonPlan(id: string): LessonPlan | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM lesson_plans WHERE id = ?').get(id) as any;
  db.close();

  if (!row) return null;

  return {
    ...row,
    objectives: JSON.parse(row.objectives),
    activities: JSON.parse(row.activities),
    resources: row.resources ? JSON.parse(row.resources) : undefined,
  };
}

export function listLessonPlans(options?: {
  student_id?: string;
  subject?: SubjectArea;
  status?: LessonPlan['status'];
  scheduled_after?: string;
  scheduled_before?: string;
  limit?: number;
}): LessonPlan[] {
  const db = getDb();
  const where: string[] = [];
  const params: any[] = [];

  if (options?.student_id) {
    where.push('student_id = ?');
    params.push(options.student_id);
  }
  if (options?.subject) {
    where.push('subject = ?');
    params.push(options.subject);
  }
  if (options?.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (options?.scheduled_after) {
    where.push('scheduled_date >= ?');
    params.push(options.scheduled_after);
  }
  if (options?.scheduled_before) {
    where.push('scheduled_date <= ?');
    params.push(options.scheduled_before);
  }

  let sql = `SELECT * FROM lesson_plans`;
  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }
  sql += ' ORDER BY scheduled_date ASC NULLS LAST, created_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(sql).all(...params) as any[];
  db.close();

  return rows.map(row => ({
    ...row,
    objectives: JSON.parse(row.objectives),
    activities: JSON.parse(row.activities),
    resources: row.resources ? JSON.parse(row.resources) : undefined,
  }));
}

// ============================================================================
// Weekly Schedules
// ============================================================================

export function upsertWeeklySchedule(schedule: Omit<WeeklySchedule, 'id' | 'created_at' | 'updated_at'>): WeeklySchedule {
  const db = getDb();
  const timestamp = now();

  // Check if schedule exists for this week
  const existing = db.prepare(
    'SELECT * FROM weekly_schedules WHERE student_id = ? AND week_start = ?'
  ).get(schedule.student_id, schedule.week_start) as any;

  if (existing) {
    // Update existing
    const merged: WeeklySchedule = {
      ...existing,
      ...schedule,
      schedule: JSON.parse(existing.schedule),
      updated_at: timestamp,
    };
    merged.schedule = schedule.schedule; // Use new schedule

    db.prepare(`
      UPDATE weekly_schedules SET
        schedule = @schedule,
        notes = @notes,
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: merged.id,
      schedule: JSON.stringify(merged.schedule),
      notes: merged.notes || null,
      updated_at: timestamp,
    });

    db.close();
    return merged;
  }

  // Create new
  const id = generateId();
  const newSchedule: WeeklySchedule = {
    ...schedule,
    id,
    created_at: timestamp,
    updated_at: timestamp,
  };

  db.prepare(`
    INSERT INTO weekly_schedules (id, student_id, week_start, schedule, notes, created_at, updated_at)
    VALUES (@id, @student_id, @week_start, @schedule, @notes, @created_at, @updated_at)
  `).run({
    ...newSchedule,
    schedule: JSON.stringify(newSchedule.schedule),
    notes: newSchedule.notes || null,
  });

  db.close();
  return newSchedule;
}

export function getWeeklySchedule(studentId: string, weekStart: string): WeeklySchedule | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM weekly_schedules WHERE student_id = ? AND week_start = ?'
  ).get(studentId, weekStart) as any;
  db.close();

  if (!row) return null;

  return {
    ...row,
    schedule: JSON.parse(row.schedule),
  };
}

// ============================================================================
// Platform Credentials
// ============================================================================

export function upsertPlatformCredentials(creds: PlatformCredentials): void {
  const db = getDb();

  db.prepare(`
    INSERT INTO platform_credentials (platform, username, encrypted_password, cookies, last_login_at, status, error_message)
    VALUES (@platform, @username, @encrypted_password, @cookies, @last_login_at, @status, @error_message)
    ON CONFLICT(platform) DO UPDATE SET
      username = @username,
      encrypted_password = @encrypted_password,
      cookies = @cookies,
      last_login_at = @last_login_at,
      status = @status,
      error_message = @error_message
  `).run({
    platform: creds.platform,
    username: creds.username || null,
    encrypted_password: creds.encrypted_password || null,
    cookies: creds.cookies || null,
    last_login_at: creds.last_login_at || null,
    status: creds.status,
    error_message: creds.error_message || null,
  });

  db.close();
}

export function getPlatformCredentials(platform: AssignmentPlatform): PlatformCredentials | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM platform_credentials WHERE platform = ?').get(platform) as PlatformCredentials | undefined;
  db.close();
  return row || null;
}

// ============================================================================
// Sync Logs
// ============================================================================

export function recordSyncLog(log: Omit<SyncLog, 'id'>): SyncLog {
  const db = getDb();
  const id = generateId();

  const newLog: SyncLog = { ...log, id };

  db.prepare(`
    INSERT INTO sync_logs (id, platform, student_id, success, assignments_found, assignments_new, assignments_updated, error, synced_at)
    VALUES (@id, @platform, @student_id, @success, @assignments_found, @assignments_new, @assignments_updated, @error, @synced_at)
  `).run({
    ...newLog,
    success: newLog.success ? 1 : 0,
    error: newLog.error || null,
  });

  db.close();
  return newLog;
}

export function getLastSyncLog(platform: AssignmentPlatform, studentId: string): SyncLog | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM sync_logs WHERE platform = ? AND student_id = ? ORDER BY synced_at DESC LIMIT 1'
  ).get(platform, studentId) as any;
  db.close();

  if (!row) return null;

  return {
    ...row,
    success: !!row.success,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function getUpcomingAssignments(studentId: string, days: number = 7): Assignment[] {
  const now_ts = now();
  const future = now_ts + (days * 24 * 60 * 60);

  return listAssignments({
    student_id: studentId,
    status: 'pending',
    due_after: now_ts,
    due_before: future,
  });
}

export function getOverdueAssignments(studentId: string): Assignment[] {
  const now_ts = now();

  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM assignments
    WHERE student_id = ? AND status = 'pending' AND due_date < ?
    ORDER BY due_date ASC
  `).all(studentId, now_ts) as Assignment[];
  db.close();

  return rows;
}

export function getWeeklyLessonPlans(studentId: string, weekStart: string): LessonPlan[] {
  // Calculate week end (7 days from start)
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  const weekEnd = endDate.toISOString().split('T')[0];

  return listLessonPlans({
    student_id: studentId,
    scheduled_after: weekStart,
    scheduled_before: weekEnd,
  });
}

export function getAssignmentStats(studentId: string): {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  by_subject: Record<SubjectArea, number>;
  by_platform: Record<AssignmentPlatform, number>;
  completion_rate: number;
} {
  const db = getDb();
  const now_ts = now();

  const total = db.prepare('SELECT COUNT(*) as count FROM assignments WHERE student_id = ?').get(studentId) as { count: number };
  const pending = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE student_id = ? AND status = 'pending'").get(studentId) as { count: number };
  const completed = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE student_id = ? AND status = 'completed'").get(studentId) as { count: number };
  const overdue = db.prepare("SELECT COUNT(*) as count FROM assignments WHERE student_id = ? AND status = 'pending' AND due_date < ?").get(studentId, now_ts) as { count: number };

  const bySubject = db.prepare('SELECT subject, COUNT(*) as count FROM assignments WHERE student_id = ? GROUP BY subject').all(studentId) as { subject: SubjectArea; count: number }[];
  const byPlatform = db.prepare('SELECT platform, COUNT(*) as count FROM assignments WHERE student_id = ? GROUP BY platform').all(studentId) as { platform: AssignmentPlatform; count: number }[];

  db.close();

  const subjectMap: Record<SubjectArea, number> = {} as any;
  for (const row of bySubject) {
    subjectMap[row.subject] = row.count;
  }

  const platformMap: Record<AssignmentPlatform, number> = {} as any;
  for (const row of byPlatform) {
    platformMap[row.platform] = row.count;
  }

  return {
    total: total.count,
    pending: pending.count,
    completed: completed.count,
    overdue: overdue.count,
    by_subject: subjectMap,
    by_platform: platformMap,
    completion_rate: total.count > 0 ? completed.count / total.count : 0,
  };
}

// ============================================================================
// Concepts Ontology (Phase 6)
// ============================================================================

export function upsertConcept(concept: Concept): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO concepts (id, name, definition, discipline, layer)
    VALUES (@id, @name, @definition, @discipline, @layer)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      definition = @definition,
      discipline = @discipline,
      layer = @layer
  `).run(concept);
  db.close();
}

export function linkStandardToConcept(link: StandardConcept): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO standard_concepts (standard_id, concept_id, authenticity_layer, notes)
    VALUES (@standard_id, @concept_id, @authenticity_layer, @notes)
    ON CONFLICT(standard_id, concept_id) DO UPDATE SET
      authenticity_layer = @authenticity_layer,
      notes = @notes
  `).run(link);
  db.close();
}

export function getConceptsForStandard(standardId: string): StandardConcept[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sc.*, c.name as concept_name, c.definition as concept_def, c.layer as concept_layer, c.discipline
    FROM standard_concepts sc
    JOIN concepts c ON sc.concept_id = c.id
    WHERE sc.standard_id = ?
  `).all(standardId) as any[];
  db.close();

  return rows.map(row => ({
    standard_id: row.standard_id,
    concept_id: row.concept_id,
    authenticity_layer: row.authenticity_layer,
    notes: row.notes,
    concept: {
      id: row.concept_id,
      name: row.concept_name,
      definition: row.concept_def,
      layer: row.concept_layer,
      discipline: row.discipline
    }
  }));
}

export function getConcept(id: string): Concept | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM concepts WHERE id = ?').get(id) as Concept | undefined;
  db.close();
  return row || null;
}

// ============================================================================
// Standards Engine
// ============================================================================

export function upsertStandard(standard: Standard): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO standards(id, category, domain, description, prerequisites, cluster)
    VALUES(@id, @category, @domain, @description, @prerequisites, @cluster)
    ON CONFLICT(id) DO UPDATE SET
    category = @category,
      domain = @domain,
      description = @description,
      prerequisites = @prerequisites,
      cluster = @cluster
        `).run({
    ...standard,
    prerequisites: JSON.stringify(standard.prerequisites),
  });
  db.close();
}

export function getStandard(id: string): Standard | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM standards WHERE id = ?').get(id) as any;
  db.close();
  if (!row) return null;
  return {
    ...row,
    prerequisites: JSON.parse(row.prerequisites),
  };
}

export function getAllStandards(): Standard[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM standards').all() as any[];
  db.close();
  return rows.map(row => ({
    ...row,
    prerequisites: JSON.parse(row.prerequisites),
  }));
}

export function getStandardMastery(studentId: string, standardId: string): StandardMastery | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM standard_mastery WHERE student_id = ? AND standard_id = ?').get(studentId, standardId) as any;
  db.close();
  return row || null;
}

export function updateStandardMastery(mastery: StandardMastery): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO standard_mastery(
          student_id, standard_id, mastery_level, evidence_count,
          last_practiced_at, status, confidence_score
        ) VALUES(
          @student_id, @standard_id, @mastery_level, @evidence_count,
          @last_practiced_at, @status, @confidence_score
        )
    ON CONFLICT(student_id, standard_id) DO UPDATE SET
    mastery_level = @mastery_level,
      evidence_count = @evidence_count,
      last_practiced_at = @last_practiced_at,
      status = @status,
      confidence_score = @confidence_score
        `).run({
    ...mastery,
    last_practiced_at: mastery.last_practiced_at || null,
  });
  db.close();
}

export function getAllStandardMastery(studentId: string): StandardMastery[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM standard_mastery WHERE student_id = ?').all(studentId) as StandardMastery[];
  db.close();
  return rows;
}
