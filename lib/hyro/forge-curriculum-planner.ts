/**
 * HYRO FORGE: Curriculum Planning System
 * Semester-long curriculum planning with prerequisite graphs and adaptive replanning
 */

import { getDatabase } from '@/lib/db/Database';
import { randomUUID } from 'crypto';
import { StatName, STAT_NAMES } from './forge-types';

// ============================================================================
// TYPES
// ============================================================================

export type CurriculumPlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface LearningGoal {
  stat_name: StatName;
  target_level: number;
  priority: 'high' | 'medium' | 'low';
  description?: string;
}

export interface CurriculumPlan {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  goals: LearningGoal[];
  status: CurriculumPlanStatus;
  total_milestones: number;
  completed_milestones: number;
  progress_percent: number;
  created_at: number;
  updated_at: number;
}

export interface CurriculumMilestone {
  id: string;
  plan_id: string;
  student_id: string;
  title: string;
  week_number: number;
  stat_name: StatName;
  target_level: number;
  depends_on: string[];
  status: MilestoneStatus;
  sort_order: number;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

export interface PrerequisiteGraph {
  nodes: PrerequisiteNode[];
  edges: PrerequisiteEdge[];
}

export interface PrerequisiteNode {
  id: string;
  concept_name: string;
  stat_name: StatName;
  difficulty_level: number;
  depth: number;
}

export interface PrerequisiteEdge {
  from: string;
  to: string;
  weight: number;
}

export interface LearningPath {
  ordered_milestones: CurriculumMilestone[];
  estimated_weeks: number;
  critical_path: string[];
}

export interface ProgressUpdate {
  completed_standards: string[];
  current_performance: number;
}

export interface AdaptedPlan {
  plan_id: string;
  changes: string[];
  new_end_date?: string;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export function initializeCurriculumTables(): void {
  const db = getDatabase();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS hyro_curriculum_plans (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL DEFAULT 'hyro',
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      goals_json TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total_milestones INTEGER DEFAULT 0,
      completed_milestones INTEGER DEFAULT 0,
      progress_percent REAL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE INDEX IF NOT EXISTS idx_curriculum_plans_student ON hyro_curriculum_plans(student_id);
    CREATE INDEX IF NOT EXISTS idx_curriculum_plans_status ON hyro_curriculum_plans(status);

    CREATE TABLE IF NOT EXISTS hyro_curriculum_milestones (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      student_id TEXT NOT NULL DEFAULT 'hyro',
      title TEXT NOT NULL,
      week_number INTEGER NOT NULL,
      stat_name TEXT NOT NULL,
      target_level REAL NOT NULL,
      depends_on_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'pending',
      sort_order INTEGER DEFAULT 0,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (plan_id) REFERENCES hyro_curriculum_plans(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_milestones_plan ON hyro_curriculum_milestones(plan_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_status ON hyro_curriculum_milestones(status);
    CREATE INDEX IF NOT EXISTS idx_milestones_week ON hyro_curriculum_milestones(week_number);
  `);
}

// ============================================================================
// CURRICULUM PLANNING
// ============================================================================

export function planSemesterCurriculum(params: {
  student_id?: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  goals: LearningGoal[];
}): CurriculumPlan {
  const db = getDatabase();
  const studentId = params.student_id || 'hyro';
  const planId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  
  const startMs = new Date(params.start_date).getTime();
  const endMs = new Date(params.end_date).getTime();
  const totalWeeks = Math.ceil((endMs - startMs) / (7 * 24 * 60 * 60 * 1000));
  
  const sortedGoals = [...params.goals].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  const milestones: CurriculumMilestone[] = [];
  let sortOrder = 0;
  
  for (const goal of sortedGoals) {
    const weeksForGoal = goal.priority === 'high' 
      ? Math.ceil(totalWeeks * 0.4)
      : goal.priority === 'medium'
        ? Math.ceil(totalWeeks * 0.35)
        : Math.ceil(totalWeeks * 0.25);
    
    const levelIncrement = goal.target_level / weeksForGoal;
    
    for (let week = 1; week <= weeksForGoal; week++) {
      const milestoneId = randomUUID();
      const milestone: CurriculumMilestone = {
        id: milestoneId,
        plan_id: planId,
        student_id: studentId,
        title: `${goal.stat_name}: Level ${(levelIncrement * week).toFixed(1)}`,
        week_number: week,
        stat_name: goal.stat_name,
        target_level: levelIncrement * week,
        depends_on: week > 1 ? [milestones[milestones.length - 1]?.id].filter(Boolean) : [],
        status: 'pending',
        sort_order: sortOrder++,
        started_at: null,
        completed_at: null,
        created_at: now,
      };
      milestones.push(milestone);
    }
  }
  
  const insertPlan = db.prepare(`
    INSERT INTO hyro_curriculum_plans 
    (id, student_id, title, description, start_date, end_date, goals_json, status, total_milestones, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `);
  
  insertPlan.run(planId, studentId, params.title, params.description || null, params.start_date, params.end_date, JSON.stringify(params.goals), milestones.length, now, now);
  
  const insertMilestone = db.prepare(`
    INSERT INTO hyro_curriculum_milestones
    (id, plan_id, student_id, title, week_number, stat_name, target_level, depends_on_json, status, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);
  
  for (const m of milestones) {
    insertMilestone.run(m.id, m.plan_id, m.student_id, m.title, m.week_number, m.stat_name, m.target_level, JSON.stringify(m.depends_on), m.sort_order, m.created_at);
  }
  
  return {
    id: planId,
    student_id: studentId,
    title: params.title,
    description: params.description || null,
    start_date: params.start_date,
    end_date: params.end_date,
    goals: params.goals,
    status: 'draft',
    total_milestones: milestones.length,
    completed_milestones: 0,
    progress_percent: 0,
    created_at: now,
    updated_at: now,
  };
}

export function getCurriculumPlan(planId: string): CurriculumPlan | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM hyro_curriculum_plans WHERE id = ?`).get(planId) as any;
  if (!row) return null;
  
  return {
    id: row.id,
    student_id: row.student_id,
    title: row.title,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    goals: JSON.parse(row.goals_json),
    status: row.status,
    total_milestones: row.total_milestones,
    completed_milestones: row.completed_milestones,
    progress_percent: row.progress_percent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getStudentCurriculumPlans(studentId: string = 'hyro'): CurriculumPlan[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM hyro_curriculum_plans WHERE student_id = ? ORDER BY created_at DESC`).all(studentId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    student_id: row.student_id,
    title: row.title,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    goals: JSON.parse(row.goals_json),
    status: row.status,
    total_milestones: row.total_milestones,
    completed_milestones: row.completed_milestones,
    progress_percent: row.progress_percent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// ============================================================================
// PREREQUISITE GRAPH
// ============================================================================

export function buildPrerequisiteGraph(milestones: CurriculumMilestone[]): PrerequisiteGraph {
  const nodes: PrerequisiteNode[] = [];
  const edges: PrerequisiteEdge[] = [];
  const nodeMap = new Map<string, PrerequisiteNode>();
  
  for (const m of milestones) {
    const node: PrerequisiteNode = {
      id: m.id,
      concept_name: m.title,
      stat_name: m.stat_name,
      difficulty_level: m.target_level,
      depth: 0,
    };
    nodes.push(node);
    nodeMap.set(m.id, node);
  }
  
  for (const m of milestones) {
    for (const depId of m.depends_on) {
      if (nodeMap.has(depId)) {
        edges.push({ from: depId, to: m.id, weight: 1 });
      }
    }
  }
  
  const inDegree = new Map<string, number>();
  for (const node of nodes) inDegree.set(node.id, 0);
  for (const edge of edges) inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
      const node = nodeMap.get(id);
      if (node) node.depth = 0;
    }
  }
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodeMap.get(currentId)!;
    
    for (const edge of edges) {
      if (edge.from === currentId) {
        const targetNode = nodeMap.get(edge.to);
        if (targetNode) {
          targetNode.depth = Math.max(targetNode.depth, currentNode.depth + 1);
          inDegree.set(edge.to, (inDegree.get(edge.to) || 1) - 1);
          if (inDegree.get(edge.to) === 0) queue.push(edge.to);
        }
      }
    }
  }
  
  return { nodes, edges };
}

export function getOptimalLearningPath(planId: string): LearningPath {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM hyro_curriculum_milestones WHERE plan_id = ? ORDER BY sort_order`).all(planId) as any[];
  
  const milestones: CurriculumMilestone[] = rows.map(row => ({
    id: row.id,
    plan_id: row.plan_id,
    student_id: row.student_id,
    title: row.title,
    week_number: row.week_number,
    stat_name: row.stat_name,
    target_level: row.target_level,
    depends_on: JSON.parse(row.depends_on_json || '[]'),
    status: row.status,
    sort_order: row.sort_order,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  }));
  
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const milestoneMap = new Map<string, CurriculumMilestone>();
  
  for (const m of milestones) {
    graph.set(m.id, []);
    inDegree.set(m.id, 0);
    milestoneMap.set(m.id, m);
  }
  
  for (const m of milestones) {
    for (const depId of m.depends_on) {
      if (graph.has(depId)) {
        graph.get(depId)!.push(m.id);
        inDegree.set(m.id, (inDegree.get(m.id) || 0) + 1);
      }
    }
  }
  
  const queue: string[] = [];
  const sorted: CurriculumMilestone[] = [];
  const criticalPath: string[] = [];
  
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentMilestone = milestoneMap.get(currentId)!;
    sorted.push(currentMilestone);
    
    if (currentMilestone.depends_on.length === 0 || currentMilestone.depends_on.some(d => criticalPath.includes(d))) {
      criticalPath.push(currentId);
    }
    
    for (const neighbor of graph.get(currentId) || []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 1) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }
  
  const maxWeek = Math.max(...sorted.map(m => m.week_number), 0);
  return { ordered_milestones: sorted, estimated_weeks: maxWeek, critical_path: criticalPath };
}

// ============================================================================
// ADAPTIVE REPLANNING
// ============================================================================

export function adaptCurriculumPlan(planId: string, progress: ProgressUpdate): AdaptedPlan {
  const db = getDatabase();
  const changes: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  const plan = getCurriculumPlan(planId);
  if (!plan) throw new Error(`Plan not found: ${planId}`);
  
  const pendingMilestones = db.prepare(`SELECT * FROM hyro_curriculum_milestones WHERE plan_id = ? AND status = 'pending' ORDER BY sort_order`).all(planId) as any[];
  
  if (progress.current_performance >= 90) {
    changes.push('Student performing above expectations - accelerating pace');
    const toSkip = Math.floor(pendingMilestones.length * 0.2);
    for (let i = 0; i < toSkip && i < pendingMilestones.length; i += 2) {
      db.prepare(`UPDATE hyro_curriculum_milestones SET status = 'skipped', completed_at = ? WHERE id = ?`).run(now, pendingMilestones[i].id);
      changes.push(`Skipped milestone: ${pendingMilestones[i].title}`);
    }
  } else if (progress.current_performance < 60) {
    changes.push('Student needs additional support - adding review milestones');
    changes.push('Consider adding prerequisite review sessions');
  }
  
  const completedCount = db.prepare(`SELECT COUNT(*) as count FROM hyro_curriculum_milestones WHERE plan_id = ? AND status IN ('completed', 'skipped')`).get(planId) as { count: number };
  const totalCount = db.prepare(`SELECT COUNT(*) as count FROM hyro_curriculum_milestones WHERE plan_id = ?`).get(planId) as { count: number };
  const progressPercent = totalCount.count > 0 ? (completedCount.count / totalCount.count) * 100 : 0;
  
  db.prepare(`UPDATE hyro_curriculum_plans SET completed_milestones = ?, progress_percent = ?, updated_at = ? WHERE id = ?`).run(completedCount.count, progressPercent, now, planId);
  
  return { plan_id: planId, changes };
}

// ============================================================================
// MILESTONE MANAGEMENT
// ============================================================================

export function getPlanMilestones(planId: string): CurriculumMilestone[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM hyro_curriculum_milestones WHERE plan_id = ? ORDER BY sort_order`).all(planId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    plan_id: row.plan_id,
    student_id: row.student_id,
    title: row.title,
    week_number: row.week_number,
    stat_name: row.stat_name,
    target_level: row.target_level,
    depends_on: JSON.parse(row.depends_on_json || '[]'),
    status: row.status,
    sort_order: row.sort_order,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  }));
}

export function updateMilestoneStatus(milestoneId: string, status: MilestoneStatus): CurriculumMilestone | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  
  const updates: Record<string, any> = { status };
  if (status === 'in_progress') updates.started_at = now;
  else if (status === 'completed' || status === 'skipped') updates.completed_at = now;
  
  db.prepare(`UPDATE hyro_curriculum_milestones SET status = ?, started_at = COALESCE(?, started_at), completed_at = COALESCE(?, completed_at) WHERE id = ?`).run(status, updates.started_at || null, updates.completed_at || null, milestoneId);
  
  const milestone = db.prepare(`SELECT plan_id FROM hyro_curriculum_milestones WHERE id = ?`).get(milestoneId) as any;
  if (milestone) {
    const completedCount = db.prepare(`SELECT COUNT(*) as count FROM hyro_curriculum_milestones WHERE plan_id = ? AND status IN ('completed', 'skipped')`).get(milestone.plan_id) as { count: number };
    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM hyro_curriculum_milestones WHERE plan_id = ?`).get(milestone.plan_id) as { count: number };
    const progressPercent = totalCount.count > 0 ? (completedCount.count / totalCount.count) * 100 : 0;
    db.prepare(`UPDATE hyro_curriculum_plans SET completed_milestones = ?, progress_percent = ?, updated_at = ? WHERE id = ?`).run(completedCount.count, progressPercent, now, milestone.plan_id);
  }
  
  const row = db.prepare(`SELECT * FROM hyro_curriculum_milestones WHERE id = ?`).get(milestoneId) as any;
  if (!row) return null;
  
  return {
    id: row.id,
    plan_id: row.plan_id,
    student_id: row.student_id,
    title: row.title,
    week_number: row.week_number,
    stat_name: row.stat_name,
    target_level: row.target_level,
    depends_on: JSON.parse(row.depends_on_json || '[]'),
    status: row.status,
    sort_order: row.sort_order,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  };
}

export function getCurrentWeekMilestones(planId: string): CurriculumMilestone[] {
  const db = getDatabase();
  const plan = getCurriculumPlan(planId);
  if (!plan) return [];
  
  const startMs = new Date(plan.start_date).getTime();
  const nowMs = Date.now();
  const currentWeek = Math.ceil((nowMs - startMs) / (7 * 24 * 60 * 60 * 1000));
  
  const rows = db.prepare(`SELECT * FROM hyro_curriculum_milestones WHERE plan_id = ? AND week_number = ? ORDER BY sort_order`).all(planId, currentWeek) as any[];
  
  return rows.map(row => ({
    id: row.id,
    plan_id: row.plan_id,
    student_id: row.student_id,
    title: row.title,
    week_number: row.week_number,
    stat_name: row.stat_name,
    target_level: row.target_level,
    depends_on: JSON.parse(row.depends_on_json || '[]'),
    status: row.status,
    sort_order: row.sort_order,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  }));
}

export function activateCurriculumPlan(planId: string): CurriculumPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE hyro_curriculum_plans SET status = 'active', updated_at = ? WHERE id = ?`).run(now, planId);
  return getCurriculumPlan(planId);
}

export function archiveCurriculumPlan(planId: string): CurriculumPlan | null {
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`UPDATE hyro_curriculum_plans SET status = 'archived', updated_at = ? WHERE id = ?`).run(now, planId);
  return getCurriculumPlan(planId);
}
