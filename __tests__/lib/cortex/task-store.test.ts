// @ts-nocheck
/**
 * Task Store & Consolidator - High Fidelity Tests
 *
 * Tests TaskStore CRUD operations, Consolidator similarity/merge logic,
 * and applySynthesisResult integration.
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import {
  TaskStore,
  Consolidator,
  applySynthesisResult,
} from '../../../lib/cortex/task-store';
import {
  createMockUnifiedTask,
  createMockSynthesisResult,
  createMockProactiveAction,
} from '../../helpers/cortex-test-utils';

jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('TaskStore - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-task-store');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  let taskStore: TaskStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    Database.resetInstance();
    const db = Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    // Create unified_tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS unified_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        confidence REAL DEFAULT 0.5,
        urgency TEXT,
        domain TEXT,
        source_events_json TEXT,
        proposed_action_json TEXT,
        status TEXT DEFAULT 'synthesizing',
        last_refined_at INTEGER,
        refinement_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    taskStore = new TaskStore();
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('createTask', () => {
    it('should create a task and return it with ID', async () => {
      const task = await taskStore.createTask({
        title: 'Test Task',
        description: 'Test description',
        confidence: 0.8,
        urgency: 'medium',
        domain: 'productivity',
        sourceEvents: ['event-1', 'event-2'],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^task_/);
      expect(task.title).toBe('Test Task');
      expect(task.confidence).toBe(0.8);
    });

    it('should store sourceEvents as JSON', async () => {
      const sourceEvents = ['evt-a', 'evt-b', 'evt-c'];
      const task = await taskStore.createTask({
        title: 'JSON Test',
        confidence: 0.5,
        urgency: 'low',
        sourceEvents,
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const retrieved = await taskStore.getTask(task.id);
      expect(retrieved?.sourceEvents).toEqual(sourceEvents);
    });

    it('should store proposedAction as JSON', async () => {
      const action = createMockProactiveAction({
        type: 'create_task',
        payload: { title: 'Sub-task' },
      });

      const task = await taskStore.createTask({
        title: 'Action Test',
        confidence: 0.9,
        urgency: 'high',
        sourceEvents: [],
        proposedAction: action,
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const retrieved = await taskStore.getTask(task.id);
      expect(retrieved?.proposedAction?.type).toBe('create_task');
    });
  });

  describe('getTask', () => {
    it('should return null for non-existent ID', async () => {
      const result = await taskStore.getTask('non-existent-id');
      expect(result).toBeNull();
    });

    it('should retrieve task by ID', async () => {
      const created = await taskStore.createTask({
        title: 'Retrieve Test',
        confidence: 0.7,
        urgency: 'medium',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const retrieved = await taskStore.getTask(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Retrieve Test');
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const task = await taskStore.createTask({
        title: 'Original Title',
        confidence: 0.5,
        urgency: 'low',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const updated = await taskStore.updateTask(task.id, {
        title: 'Updated Title',
        confidence: 0.8,
        urgency: 'high',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.confidence).toBe(0.8);
      expect(updated.urgency).toBe('high');
    });

    it('should increment refinementCount', async () => {
      const task = await taskStore.createTask({
        title: 'Refine Test',
        confidence: 0.5,
        urgency: 'medium',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const updated = await taskStore.updateTask(task.id, {
        refinementCount: 1,
        lastRefinedAt: new Date().toISOString(),
      });

      expect(updated.refinementCount).toBe(1);
      expect(updated.lastRefinedAt).toBeDefined();
    });

    it('should throw if no fields provided', async () => {
      const task = await taskStore.createTask({
        title: 'No Update Test',
        confidence: 0.5,
        urgency: 'low',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      await expect(taskStore.updateTask(task.id, {})).rejects.toThrow('No valid update fields');
    });
  });

  describe('getTasks', () => {
    beforeEach(async () => {
      // Create test tasks
      await taskStore.createTask({
        title: 'Task A',
        confidence: 0.9,
        urgency: 'critical',
        domain: 'finance',
        sourceEvents: [],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
      await taskStore.createTask({
        title: 'Task B',
        confidence: 0.5,
        urgency: 'low',
        domain: 'personal',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
      await taskStore.createTask({
        title: 'Task C',
        confidence: 0.7,
        urgency: 'medium',
        domain: 'finance',
        sourceEvents: [],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
    });

    it('should filter by status', async () => {
      const ready = await taskStore.getTasks({ status: 'ready' });
      expect(ready.length).toBe(2);
      expect(ready.every(t => t.status === 'ready')).toBe(true);
    });

    it('should filter by domain', async () => {
      const finance = await taskStore.getTasks({ domain: 'finance' });
      expect(finance.length).toBe(2);
    });

    it('should filter by urgency', async () => {
      const critical = await taskStore.getTasks({ urgency: 'critical' });
      expect(critical.length).toBe(1);
      expect(critical[0].title).toBe('Task A');
    });

    it('should filter by minConfidence', async () => {
      const highConf = await taskStore.getTasks({ minConfidence: 0.7 });
      expect(highConf.length).toBe(2);
    });

    it('should support limit and offset', async () => {
      const page1 = await taskStore.getTasks({ limit: 2 });
      expect(page1.length).toBe(2);

      const page2 = await taskStore.getTasks({ limit: 2, offset: 2 });
      expect(page2.length).toBe(1);
    });

    it('should sort by confidence ASC', async () => {
      const sorted = await taskStore.getTasks({
        sortBy: 'confidence',
        sortDirection: 'asc',
      });
      expect(sorted[0].confidence).toBeLessThanOrEqual(sorted[1].confidence);
    });
  });

  describe('getTasksNeedingRefinement', () => {
    it('should return tasks with confidence < 0.7', async () => {
      await taskStore.createTask({
        title: 'Low Confidence',
        confidence: 0.4,
        urgency: 'medium',
        sourceEvents: [],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
      await taskStore.createTask({
        title: 'High Confidence',
        confidence: 0.9,
        urgency: 'medium',
        sourceEvents: [],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const needsRefinement = await taskStore.getTasksNeedingRefinement();
      expect(needsRefinement.length).toBe(1);
      expect(needsRefinement[0].title).toBe('Low Confidence');
    });
  });

  describe('getTasksBySourceEvent', () => {
    it('should find tasks containing event ID', async () => {
      await taskStore.createTask({
        title: 'Has Event',
        confidence: 0.8,
        urgency: 'medium',
        sourceEvents: ['evt-123', 'evt-456'],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
      await taskStore.createTask({
        title: 'No Event',
        confidence: 0.8,
        urgency: 'medium',
        sourceEvents: ['evt-789'],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const found = await taskStore.getTasksBySourceEvent('evt-123');
      expect(found.length).toBe(1);
      expect(found[0].title).toBe('Has Event');
    });
  });

  describe('archiveTask', () => {
    it('should set status to dismissed', async () => {
      const task = await taskStore.createTask({
        title: 'To Archive',
        confidence: 0.5,
        urgency: 'low',
        sourceEvents: [],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      await taskStore.archiveTask(task.id);

      const archived = await taskStore.getTask(task.id);
      expect(archived?.status).toBe('dismissed');
    });
  });
});

describe('Consolidator - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-consolidator');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  let taskStore: TaskStore;
  let consolidator: Consolidator;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    Database.resetInstance();
    const db = Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    db.exec(`
      CREATE TABLE IF NOT EXISTS unified_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        confidence REAL DEFAULT 0.5,
        urgency TEXT,
        domain TEXT,
        source_events_json TEXT,
        proposed_action_json TEXT,
        status TEXT DEFAULT 'synthesizing',
        last_refined_at INTEGER,
        refinement_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    taskStore = new TaskStore();
    consolidator = new Consolidator(taskStore);
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('shouldMerge', () => {
    it('should merge tasks with >80% title similarity', () => {
      // Jaccard similarity: intersection/union
      // "review invoice from vendor today" has 5 words
      // "review invoice from vendor now" has 5 words
      // Intersection: 4 (review, invoice, from, vendor), Union: 6
      // Similarity: 4/6 = 0.67 - NOT enough

      // Need very similar titles. Let's use identical titles to ensure >0.8:
      const a = createMockUnifiedTask({ title: 'Review the vendor invoice for approval' });
      const b = createMockUnifiedTask({ title: 'Review the vendor invoice for payment' });
      // Words: "review the vendor invoice for approval/payment"
      // Intersection: 5 (review, the, vendor, invoice, for)
      // Union: 7 (+ approval, payment)
      // Similarity: 5/7 = 0.71 - still not enough!

      // Use nearly identical:
      const c = createMockUnifiedTask({ title: 'Pay vendor invoice today' });
      const d = createMockUnifiedTask({ title: 'Pay vendor invoice now' });
      // Intersection: 3 (pay, vendor, invoice), Union: 5
      // Similarity: 3/5 = 0.6 - NOT enough

      // The only way to get >0.8 is very high overlap:
      const e = createMockUnifiedTask({ title: 'Review the quarterly vendor invoice payment' });
      const f = createMockUnifiedTask({ title: 'Review the quarterly vendor invoice' });
      // Words e: review, the, quarterly, vendor, invoice, payment (6)
      // Words f: review, the, quarterly, vendor, invoice (5)
      // Intersection: 5, Union: 6, Similarity: 5/6 = 0.833 > 0.8 ✓

      expect(consolidator.shouldMerge(e, f)).toBe(true);
    });

    it('should NOT merge tasks with different titles', () => {
      const a = createMockUnifiedTask({ title: 'Schedule meeting with Bob' });
      const b = createMockUnifiedTask({ title: 'Review annual budget report' });

      expect(consolidator.shouldMerge(a, b)).toBe(false);
    });

    it('should merge tasks with high description similarity and event overlap', () => {
      // Description similarity >0.7 AND event overlap >0.3
      const a = createMockUnifiedTask({
        title: 'Task A',
        description: 'Need to review the Q4 financial report before Monday',
        sourceEvents: ['evt-1', 'evt-2', 'evt-3'],
      });
      const b = createMockUnifiedTask({
        title: 'Task B',
        description: 'Need to review the Q4 financial report before Tuesday',
        sourceEvents: ['evt-2', 'evt-3', 'evt-4'],
      });
      // Description words a: need, to, review, the, q4, financial, report, before, monday (9)
      // Description words b: need, to, review, the, q4, financial, report, before, tuesday (9)
      // Intersection: 8, Union: 10, Similarity: 8/10 = 0.8 > 0.7 ✓
      // Event overlap: {evt-2, evt-3} in both. Intersection: 2, Union: 4, Overlap: 0.5 > 0.3 ✓

      expect(consolidator.shouldMerge(a, b)).toBe(true);
    });
  });

  describe('findDuplicates', () => {
    it('should group similar tasks', () => {
      // Need >0.8 Jaccard similarity
      const tasks = [
        createMockUnifiedTask({ id: '1', title: 'Review quarterly vendor invoice payment report' }),
        createMockUnifiedTask({ id: '2', title: 'Review quarterly vendor invoice payment' }),
        // Words 1: review, quarterly, vendor, invoice, payment, report (6)
        // Words 2: review, quarterly, vendor, invoice, payment (5)
        // Intersection: 5, Union: 6, Similarity: 5/6 = 0.833 > 0.8 ✓
        createMockUnifiedTask({ id: '3', title: 'Schedule dentist appointment' }),
      ];

      const groups = consolidator.findDuplicates(tasks);

      expect(groups.length).toBe(1);
      expect(groups[0].length).toBe(2);
      expect(groups[0].map(t => t.id).sort()).toEqual(['1', '2']);
    });

    it('should return empty for no duplicates', () => {
      const tasks = [
        createMockUnifiedTask({ id: '1', title: 'Task one unique' }),
        createMockUnifiedTask({ id: '2', title: 'Different task two' }),
        createMockUnifiedTask({ id: '3', title: 'Another thing three' }),
      ];

      const groups = consolidator.findDuplicates(tasks);
      expect(groups.length).toBe(0);
    });
  });

  describe('mergeTaskGroup', () => {
    it('should merge tasks into one with highest confidence', async () => {
      const task1 = await taskStore.createTask({
        title: 'Pay invoice',
        confidence: 0.6,
        urgency: 'medium',
        sourceEvents: ['evt-1'],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });
      const task2 = await taskStore.createTask({
        title: 'Pay the invoice',
        confidence: 0.9,
        urgency: 'high',
        sourceEvents: ['evt-2'],
        status: 'synthesizing',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const merged = await consolidator.mergeTaskGroup([task1, task2]);

      expect(merged.title).toBe('Pay the invoice'); // From higher confidence
      expect(merged.confidence).toBe(0.9);
      expect(merged.urgency).toBe('high'); // Highest urgency
      expect(merged.sourceEvents).toContain('evt-1');
      expect(merged.sourceEvents).toContain('evt-2');

      // Original tasks should be archived
      const t1 = await taskStore.getTask(task1.id);
      const t2 = await taskStore.getTask(task2.id);
      expect(t1?.status).toBe('dismissed');
      expect(t2?.status).toBe('dismissed');
    });

    it('should return single task unchanged', async () => {
      const task = await taskStore.createTask({
        title: 'Single Task',
        confidence: 0.8,
        urgency: 'medium',
        sourceEvents: [],
        status: 'ready',
        refinementCount: 0,
        createdAt: new Date().toISOString(),
      });

      const result = await consolidator.mergeTaskGroup([task]);
      expect(result.id).toBe(task.id);
    });

    it('should throw for empty group', async () => {
      await expect(consolidator.mergeTaskGroup([])).rejects.toThrow('Cannot merge empty task group');
    });
  });
});

describe('applySynthesisResult', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-apply-synthesis');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  let taskStore: TaskStore;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    Database.resetInstance();
    const db = Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    db.exec(`
      CREATE TABLE IF NOT EXISTS unified_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        confidence REAL DEFAULT 0.5,
        urgency TEXT,
        domain TEXT,
        source_events_json TEXT,
        proposed_action_json TEXT,
        status TEXT DEFAULT 'synthesizing',
        last_refined_at INTEGER,
        refinement_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    taskStore = new TaskStore();
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  it('should create new tasks from synthesis result', async () => {
    const result = createMockSynthesisResult({
      unified_tasks: [
        {
          title: 'New Task 1',
          description: 'Description 1',
          confidence: 0.8,
          urgency: 'high',
          domain: 'finance',
          sourceEvents: ['evt-1'],
        },
        {
          title: 'New Task 2',
          description: 'Description 2',
          confidence: 0.6,
          urgency: 'medium',
          domain: 'productivity',
          sourceEvents: ['evt-2'],
        },
      ],
    });

    const summary = await applySynthesisResult(result, taskStore);

    expect(summary.tasksCreated).toBe(2);
    const tasks = await taskStore.getTasks({});
    expect(tasks.length).toBe(2);
  });

  it('should apply task updates', async () => {
    // Create existing task
    const existing = await taskStore.createTask({
      title: 'Existing Task',
      confidence: 0.5,
      urgency: 'low',
      sourceEvents: ['evt-old'],
      status: 'synthesizing',
      refinementCount: 0,
      createdAt: new Date().toISOString(),
    });

    const result = createMockSynthesisResult({
      task_updates: [
        {
          taskId: existing.id,
          updates: {
            confidence: 0.8,
            urgency: 'high',
          },
          newSourceEvents: ['evt-new'],
          rationale: 'More context available',
        },
      ],
    });

    const summary = await applySynthesisResult(result, taskStore);

    expect(summary.tasksUpdated).toBe(1);
    const updated = await taskStore.getTask(existing.id);
    expect(updated?.confidence).toBe(0.8);
    expect(updated?.urgency).toBe('high');
    expect(updated?.sourceEvents).toContain('evt-old');
    expect(updated?.sourceEvents).toContain('evt-new');
    expect(updated?.refinementCount).toBe(1);
  });

  it('should return summary with counts', async () => {
    const result = createMockSynthesisResult({
      unified_tasks: [
        { title: 'Task', confidence: 0.8, urgency: 'medium', domain: 'general', sourceEvents: [] },
      ],
      task_updates: [],
      proposed_actions: [],
    });

    const summary = await applySynthesisResult(result, taskStore);

    expect(summary.tasksCreated).toBe(1);
    expect(summary.tasksUpdated).toBe(0);
    expect(summary.summary).toContain('1 tasks created');
  });
});
