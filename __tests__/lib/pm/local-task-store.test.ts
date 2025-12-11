// @ts-nocheck
/**
 * Wrath Shield v3 - Local Task Store Tests
 *
 * Tests for SQLite-based local task persistence:
 * - CRUD operations
 * - Query and filtering
 * - Stats aggregation
 * - Search functionality
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockRun = jest.fn().mockReturnValue({ changes: 1 });
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: mockRun,
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

import {
  createLocalTask,
  getLocalTask,
  updateLocalTask,
  deleteLocalTask,
  getLocalTasks,
  getLocalTaskStats,
  searchLocalTasks,
  type LocalTask,
} from '@/lib/pm/local-task-store';

describe('Local Task Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockRun.mockReturnValue({ changes: 1 });
  });

  describe('createLocalTask', () => {
    it('should create task with minimal params', () => {
      const mockRow = {
        id: 'local_123',
        title: 'Test Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '[]',
        metadata: '{}',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        user_id: 'default',
      };
      mockGet.mockReturnValueOnce(mockRow);

      const task = createLocalTask({ title: 'Test Task' });

      expect(mockExec).toHaveBeenCalled(); // Table creation
      expect(mockPrepare).toHaveBeenCalled(); // Insert
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
    });

    it('should create task with all params', () => {
      const mockRow = {
        id: 'local_123',
        title: 'Full Task',
        description: 'Description here',
        status: 'in_progress',
        priority: 'high',
        project_id: 'proj-1',
        project_name: 'Project 1',
        assignee: 'alice',
        due_date: '2025-02-01',
        labels: '["urgent","feature"]',
        metadata: '{"source":"test"}',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
        user_id: 'user-1',
      };
      mockGet.mockReturnValueOnce(mockRow);

      const task = createLocalTask({
        title: 'Full Task',
        description: 'Description here',
        status: 'in_progress',
        priority: 'high',
        project_id: 'proj-1',
        project_name: 'Project 1',
        assignee: 'alice',
        due_date: '2025-02-01',
        labels: ['urgent', 'feature'],
        metadata: { source: 'test' },
        user_id: 'user-1',
      });

      expect(task.title).toBe('Full Task');
      expect(task.status).toBe('in_progress');
      expect(task.labels).toEqual(['urgent', 'feature']);
      expect(task.metadata).toEqual({ source: 'test' });
    });
  });

  describe('getLocalTask', () => {
    it('should return task when found', () => {
      const mockRow = {
        id: 'local_123',
        title: 'Found Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '[]',
        metadata: '{}',
        created_at: 1000,
        updated_at: 1000,
        user_id: 'default',
      };
      mockGet.mockReturnValueOnce(mockRow);

      const task = getLocalTask('local_123');

      expect(task).not.toBeNull();
      expect(task?.id).toBe('local_123');
      expect(task?.title).toBe('Found Task');
    });

    it('should return null when not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const task = getLocalTask('nonexistent');

      expect(task).toBeNull();
    });
  });

  describe('updateLocalTask', () => {
    it('should update task fields', () => {
      const mockRow = {
        id: 'local_123',
        title: 'Updated Title',
        description: 'New description',
        status: 'done',
        priority: 'low',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '[]',
        metadata: '{}',
        created_at: 1000,
        updated_at: 2000,
        user_id: 'default',
      };
      mockGet.mockReturnValueOnce(mockRow);

      const task = updateLocalTask('local_123', {
        title: 'Updated Title',
        description: 'New description',
        status: 'done',
        priority: 'low',
      });

      expect(task?.title).toBe('Updated Title');
      expect(task?.status).toBe('done');
    });

    it('should allow setting fields to null', () => {
      const mockRow = {
        id: 'local_123',
        title: 'Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '[]',
        metadata: '{}',
        created_at: 1000,
        updated_at: 2000,
        user_id: 'default',
      };
      mockGet.mockReturnValueOnce(mockRow);

      const task = updateLocalTask('local_123', {
        project_id: null,
        assignee: null,
      });

      expect(task?.project_id).toBeNull();
      expect(task?.assignee).toBeNull();
    });

    it('should return null when task not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const task = updateLocalTask('nonexistent', { title: 'New' });

      expect(task).toBeNull();
    });
  });

  describe('deleteLocalTask', () => {
    it('should return true when deleted', () => {
      mockRun.mockReturnValueOnce({ changes: 1 });

      const result = deleteLocalTask('local_123');

      expect(result).toBe(true);
    });

    it('should return false when not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0 });

      const result = deleteLocalTask('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getLocalTasks', () => {
    it('should return all tasks without filters', () => {
      const mockRows = [
        {
          id: 'local_1',
          title: 'Task 1',
          description: null,
          status: 'pending',
          priority: 'high',
          project_id: null,
          project_name: null,
          assignee: null,
          due_date: null,
          labels: '[]',
          metadata: '{}',
          created_at: 1000,
          updated_at: 1000,
          user_id: 'default',
        },
        {
          id: 'local_2',
          title: 'Task 2',
          description: null,
          status: 'done',
          priority: 'low',
          project_id: null,
          project_name: null,
          assignee: null,
          due_date: null,
          labels: '[]',
          metadata: '{}',
          created_at: 1000,
          updated_at: 1000,
          user_id: 'default',
        },
      ];
      mockAll.mockReturnValueOnce(mockRows);

      const tasks = getLocalTasks();

      expect(tasks).toHaveLength(2);
    });

    it('should filter by status', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTasks({ status: 'pending' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('status = @status')
      );
    });

    it('should filter by priority', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTasks({ priority: 'high' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('priority = @priority')
      );
    });

    it('should filter by project_id', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTasks({ project_id: 'proj-1' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('project_id = @project_id')
      );
    });

    it('should filter by user_id', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTasks({ user_id: 'user-1' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('user_id = @user_id')
      );
    });

    it('should support pagination', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTasks({ limit: 10, offset: 20 });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT @limit')
      );
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET @offset')
      );
    });
  });

  describe('getLocalTaskStats', () => {
    it('should return stats grouped by status', () => {
      mockAll.mockReturnValueOnce([
        { status: 'pending', count: 5 },
        { status: 'in_progress', count: 3 },
        { status: 'done', count: 10 },
      ]);

      const stats = getLocalTaskStats();

      expect(stats.total).toBe(18);
      expect(stats.pending).toBe(5);
      expect(stats.in_progress).toBe(3);
      expect(stats.done).toBe(10);
    });

    it('should filter by user_id', () => {
      mockAll.mockReturnValueOnce([]);

      getLocalTaskStats('user-1');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?')
      );
    });

    it('should return zeros for missing statuses', () => {
      mockAll.mockReturnValueOnce([]);

      const stats = getLocalTaskStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.backlog).toBe(0);
    });
  });

  describe('searchLocalTasks', () => {
    it('should search by title and description', () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'local_1',
          title: 'Bug fix for login',
          description: null,
          status: 'pending',
          priority: 'high',
          project_id: null,
          project_name: null,
          assignee: null,
          due_date: null,
          labels: '[]',
          metadata: '{}',
          created_at: 1000,
          updated_at: 1000,
          user_id: 'default',
        },
      ]);

      const tasks = searchLocalTasks('bug');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('title LIKE @query OR description LIKE @query')
      );
      expect(tasks).toHaveLength(1);
    });

    it('should filter by user_id', () => {
      mockAll.mockReturnValueOnce([]);

      searchLocalTasks('query', { user_id: 'user-1' });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('user_id = @user_id')
      );
    });

    it('should support limit', () => {
      mockAll.mockReturnValueOnce([]);

      searchLocalTasks('query', { limit: 5 });

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT @limit')
      );
    });
  });

  describe('Type Definitions', () => {
    it('should parse labels correctly', () => {
      mockGet.mockReturnValueOnce({
        id: 'local_1',
        title: 'Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '["bug","urgent"]',
        metadata: '{}',
        created_at: 1000,
        updated_at: 1000,
        user_id: 'default',
      });

      const task = getLocalTask('local_1');

      expect(Array.isArray(task?.labels)).toBe(true);
      expect(task?.labels).toEqual(['bug', 'urgent']);
    });

    it('should parse metadata correctly', () => {
      mockGet.mockReturnValueOnce({
        id: 'local_1',
        title: 'Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: '[]',
        metadata: '{"source":"api","version":1}',
        created_at: 1000,
        updated_at: 1000,
        user_id: 'default',
      });

      const task = getLocalTask('local_1');

      expect(task?.metadata).toEqual({ source: 'api', version: 1 });
    });

    it('should handle null labels and metadata', () => {
      mockGet.mockReturnValueOnce({
        id: 'local_1',
        title: 'Task',
        description: null,
        status: 'pending',
        priority: 'medium',
        project_id: null,
        project_name: null,
        assignee: null,
        due_date: null,
        labels: null,
        metadata: null,
        created_at: 1000,
        updated_at: 1000,
        user_id: 'default',
      });

      const task = getLocalTask('local_1');

      expect(task?.labels).toEqual([]);
      expect(task?.metadata).toEqual({});
    });
  });
});
