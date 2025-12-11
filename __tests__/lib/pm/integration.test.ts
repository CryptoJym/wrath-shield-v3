// @ts-nocheck
/**
 * Wrath Shield v3 - PM Integration Tests
 *
 * Tests for GitHub-native project management:
 * - Task aggregation from multiple sources
 * - Project aggregation from milestones
 * - Dashboard data generation
 * - Task CRUD operations
 */

// Mock GitHub client
const mockGitHubClient = {
  isConfigured: jest.fn().mockReturnValue(true),
  getIssues: jest.fn().mockResolvedValue([]),
  getMilestones: jest.fn().mockResolvedValue([]),
  getEnabledRepos: jest.fn().mockReturnValue([{ repo_full_name: 'owner/repo' }]),
  createIssue: jest.fn().mockResolvedValue({
    id: 1,
    number: 123,
    title: 'Test Issue',
    body: 'Description',
    state: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: 'https://github.com/owner/repo/issues/123',
    labels: [],
    assignees: [],
  }),
  updateIssue: jest.fn().mockResolvedValue({
    id: 1,
    number: 123,
    title: 'Updated Issue',
    body: 'Updated Description',
    state: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    html_url: 'https://github.com/owner/repo/issues/123',
    labels: [],
    assignees: [],
  }),
};

jest.mock('@/lib/integrations/GitHubClient', () => ({
  __esModule: true,
  default: mockGitHubClient,
}));

// Mock context_requests
jest.mock('@/lib/context_requests', () => ({
  getAllContextRequests: jest.fn().mockReturnValue([]),
}));

// Mock local-task-store
const mockLocalTaskStore = {
  getLocalTasks: jest.fn().mockReturnValue([]),
  createLocalTask: jest.fn().mockReturnValue({
    id: 'local_123',
    title: 'Local Task',
    status: 'pending',
    priority: 'medium',
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  }),
  updateLocalTask: jest.fn().mockReturnValue({
    id: 'local_123',
    title: 'Updated Task',
    status: 'done',
    priority: 'high',
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  }),
  deleteLocalTask: jest.fn().mockReturnValue(true),
  getLocalTask: jest.fn().mockReturnValue(null),
};

jest.mock('@/lib/pm/local-task-store', () => mockLocalTaskStore);

import {
  getAllTasks,
  getAllProjects,
  getPMDashboardData,
  createTask,
  updateTask,
  deleteTask,
  createTaskFromSignal,
} from '@/lib/pm/integration';

describe('PM Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHubClient.isConfigured.mockReturnValue(true);
    mockGitHubClient.getIssues.mockResolvedValue([]);
    mockGitHubClient.getMilestones.mockResolvedValue([]);
    mockLocalTaskStore.getLocalTasks.mockReturnValue([]);
  });

  describe('getAllTasks', () => {
    it('should aggregate tasks from GitHub', async () => {
      mockGitHubClient.getIssues.mockResolvedValueOnce([
        {
          id: 1,
          number: 1,
          title: 'GitHub Issue',
          body: 'Description',
          state: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/owner/repo/issues/1',
          labels: [],
          assignees: [],
          repo_full_name: 'owner/repo',
        },
      ]);

      const tasks = await getAllTasks();

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].source).toBe('github');
    });

    it('should aggregate tasks from local store', async () => {
      mockLocalTaskStore.getLocalTasks.mockReturnValueOnce([
        {
          id: 'local_1',
          title: 'Local Task',
          status: 'pending',
          priority: 'medium',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const tasks = await getAllTasks();

      const localTask = tasks.find(t => t.id.startsWith('local-'));
      expect(localTask).toBeDefined();
    });

    it('should aggregate context requests', async () => {
      const { getAllContextRequests } = require('@/lib/context_requests');
      getAllContextRequests.mockReturnValueOnce([
        {
          id: 'ctx_1',
          event_id: 'evt_1',
          status: 'pending',
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
          event_payload: {
            subject: 'Test Context',
            preview: 'Preview text',
            channel: 'email',
          },
        },
      ]);

      const tasks = await getAllTasks();

      const contextTask = tasks.find(t => t.id.startsWith('context-'));
      expect(contextTask).toBeDefined();
    });

    it('should handle GitHub errors gracefully', async () => {
      mockGitHubClient.getIssues.mockRejectedValueOnce(new Error('API error'));

      const tasks = await getAllTasks();

      expect(Array.isArray(tasks)).toBe(true);
    });

    it('should sort tasks by updated_at', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);

      mockGitHubClient.getIssues.mockResolvedValueOnce([
        { id: 1, number: 1, title: 'Old Issue', state: 'open', created_at: yesterday.toISOString(), updated_at: yesterday.toISOString(), html_url: '', labels: [], assignees: [], repo_full_name: 'o/r' },
        { id: 2, number: 2, title: 'New Issue', state: 'open', created_at: now.toISOString(), updated_at: now.toISOString(), html_url: '', labels: [], assignees: [], repo_full_name: 'o/r' },
      ]);

      const tasks = await getAllTasks();

      if (tasks.length >= 2) {
        const firstDate = new Date(tasks[0].updated_at);
        const secondDate = new Date(tasks[1].updated_at);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    it('should map GitHub priority labels', async () => {
      mockGitHubClient.getIssues.mockResolvedValueOnce([
        { id: 1, number: 1, title: 'Urgent Issue', state: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [{ name: 'urgent' }], assignees: [], repo_full_name: 'o/r' },
        { id: 2, number: 2, title: 'High Priority', state: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [{ name: 'high-priority' }], assignees: [], repo_full_name: 'o/r' },
        { id: 3, number: 3, title: 'Low Priority', state: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [{ name: 'low' }], assignees: [], repo_full_name: 'o/r' },
      ]);

      const tasks = await getAllTasks();

      const urgentTask = tasks.find(t => t.title === 'Urgent Issue');
      const highTask = tasks.find(t => t.title === 'High Priority');
      const lowTask = tasks.find(t => t.title === 'Low Priority');

      expect(urgentTask?.priority).toBe('urgent');
      expect(highTask?.priority).toBe('high');
      expect(lowTask?.priority).toBe('low');
    });

    it('should skip GitHub when not configured', async () => {
      mockGitHubClient.isConfigured.mockReturnValue(false);

      const tasks = await getAllTasks();

      expect(mockGitHubClient.getIssues).not.toHaveBeenCalled();
    });
  });

  describe('getAllProjects', () => {
    it('should fetch GitHub milestones as projects', async () => {
      mockGitHubClient.getMilestones.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Sprint 1',
          body: 'First sprint',
          state: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: 'https://github.com/owner/repo/milestone/1',
        },
      ]);

      const projects = await getAllProjects();

      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].source).toBe('github');
    });

    it('should handle GitHub errors gracefully', async () => {
      mockGitHubClient.getMilestones.mockRejectedValueOnce(new Error('API error'));

      const projects = await getAllProjects();

      expect(Array.isArray(projects)).toBe(true);
    });

    it('should skip GitHub when not configured', async () => {
      mockGitHubClient.isConfigured.mockReturnValue(false);

      const projects = await getAllProjects();

      expect(mockGitHubClient.getMilestones).not.toHaveBeenCalled();
    });
  });

  describe('getPMDashboardData', () => {
    it('should return complete dashboard data', async () => {
      mockGitHubClient.getIssues.mockResolvedValueOnce([
        { id: 1, number: 1, title: 'Task 1', state: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [{ name: 'high' }], assignees: [], repo_full_name: 'o/r' },
        { id: 2, number: 2, title: 'Task 2', state: 'closed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [], assignees: [], repo_full_name: 'o/r' },
      ]);

      const dashboard = await getPMDashboardData();

      expect(dashboard).toHaveProperty('tasks');
      expect(dashboard).toHaveProperty('projects');
      expect(dashboard).toHaveProperty('recent_tasks');
      expect(dashboard).toHaveProperty('recent_projects');
      expect(dashboard).toHaveProperty('integrations');
    });

    it('should calculate task statistics', async () => {
      mockGitHubClient.getIssues.mockResolvedValueOnce([
        { id: 1, number: 1, title: 'Pending', state: 'open', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [], assignees: [], repo_full_name: 'o/r' },
        { id: 2, number: 2, title: 'Done', state: 'closed', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), html_url: '', labels: [], assignees: [], repo_full_name: 'o/r' },
      ]);

      const dashboard = await getPMDashboardData();

      expect(dashboard.tasks.total).toBe(2);
      expect(dashboard.tasks.done).toBe(1);
    });

    it('should include integration status', async () => {
      const dashboard = await getPMDashboardData();

      expect(dashboard.integrations.github.configured).toBe(true);
    });
  });

  describe('createTask', () => {
    it('should create GitHub issue by default', async () => {
      const task = await createTask({
        title: 'New Task',
        description: 'Task description',
      });

      expect(mockGitHubClient.createIssue).toHaveBeenCalled();
      expect(task?.source).toBe('github');
    });

    it('should create local task when source is local', async () => {
      const task = await createTask({
        title: 'Local Task',
        source: 'local',
      });

      expect(mockLocalTaskStore.createLocalTask).toHaveBeenCalled();
      expect(task?.source).toBe('local');
    });

    it('should fallback to local when GitHub not configured', async () => {
      mockGitHubClient.isConfigured.mockReturnValue(false);

      const task = await createTask({
        title: 'Fallback Task',
      });

      expect(mockLocalTaskStore.createLocalTask).toHaveBeenCalled();
    });

    it('should fallback to local when no enabled repos', async () => {
      mockGitHubClient.getEnabledRepos.mockReturnValue([]);

      const task = await createTask({
        title: 'No Repos Task',
      });

      expect(mockLocalTaskStore.createLocalTask).toHaveBeenCalled();
    });

    it('should use specified repo', async () => {
      await createTask({
        title: 'Specific Repo Task',
        repo_full_name: 'custom/repo',
      });

      expect(mockGitHubClient.createIssue).toHaveBeenCalledWith(
        'custom',
        'repo',
        expect.any(Object)
      );
    });
  });

  describe('updateTask', () => {
    it('should update GitHub issue', async () => {
      const task = await updateTask('github-owner__repo-123', {
        status: 'done',
      });

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'owner',
        'repo',
        123,
        expect.objectContaining({ state: 'closed' })
      );
    });

    it('should update local task', async () => {
      await updateTask('local-local_123', {
        status: 'done',
        title: 'Updated Task',
      });

      expect(mockLocalTaskStore.updateLocalTask).toHaveBeenCalled();
    });

    it('should handle invalid GitHub task ID', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const task = await updateTask('github-invalid', { status: 'done' });

      expect(task).toBeNull();

      consoleSpy.mockRestore();
    });

    it('should convert status to GitHub state', async () => {
      await updateTask('github-owner__repo-123', { status: 'in_progress' });

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ state: 'open' })
      );
    });

    it('should warn for context request updates', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await updateTask('context-ctx_123', { status: 'done' });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('read-only')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('deleteTask', () => {
    it('should delete local task', async () => {
      const result = await deleteTask('local-local_123');

      expect(result).toBe(true);
      expect(mockLocalTaskStore.deleteLocalTask).toHaveBeenCalled();
    });

    it('should warn for GitHub delete', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await deleteTask('github-owner__repo-123');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not supported')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createTaskFromSignal', () => {
    it('should create task from signal with triage data', async () => {
      const signal = {
        id: 'sig_123',
        source: 'email',
        signal_type: 'task_request',
        payload: { message: 'Test' },
        confidence: 0.9,
      };

      const triage = {
        action: 'github_issue',
        suggested_title: 'New Task from Signal',
        suggested_labels: ['email', 'task_request'],
        priority: 'high',
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const task = await createTaskFromSignal(signal, triage);

      expect(task).not.toBeNull();
      expect(task?.title).toBe('New Task from Signal');

      consoleSpy.mockRestore();
    });

    it('should create local task for non-github action', async () => {
      const signal = {
        id: 'sig_124',
        source: 'slack',
        signal_type: 'reminder',
        payload: {},
        confidence: 0.8,
      };

      const triage = {
        action: 'local_task',
        suggested_title: 'Local Task from Signal',
        priority: 'medium',
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await createTaskFromSignal(signal, triage);

      expect(mockLocalTaskStore.createLocalTask).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should convert critical to urgent priority', async () => {
      const signal = {
        id: 'sig_125',
        source: 'monitoring',
        signal_type: 'alert',
        payload: {},
        confidence: 1.0,
      };

      const triage = {
        action: 'local_task',
        suggested_title: 'Critical Alert',
        priority: 'critical',
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await createTaskFromSignal(signal, triage);

      expect(mockLocalTaskStore.createLocalTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'urgent' })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Task ID Parsing', () => {
    it('should parse GitHub task ID with owner/repo separator', async () => {
      mockGitHubClient.updateIssue.mockResolvedValueOnce({
        id: 1,
        number: 456,
        title: 'Test',
        state: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_url: '',
        labels: [],
        assignees: [],
      });

      await updateTask('github-my-org__my-repo-456', { title: 'Updated' });

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'my-org',
        'my-repo',
        456,
        expect.any(Object)
      );
    });

    it('should handle hyphenated repo names', async () => {
      mockGitHubClient.updateIssue.mockResolvedValueOnce({
        id: 1,
        number: 789,
        title: 'Test',
        state: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_url: '',
        labels: [],
        assignees: [],
      });

      await updateTask('github-owner__repo-with-hyphens-789', { title: 'Updated' });

      expect(mockGitHubClient.updateIssue).toHaveBeenCalledWith(
        'owner',
        'repo-with-hyphens',
        789,
        expect.any(Object)
      );
    });
  });
});
