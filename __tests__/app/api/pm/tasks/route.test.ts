/**
 * PM Tasks API Route Tests
 * Tests for /api/pm/tasks endpoint (GET, POST, PATCH)
 */

import { GET, POST, PATCH } from '@/app/api/pm/tasks/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/pm/integration', () => ({
  getAllTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
}));

const { getAllTasks, createTask, updateTask } = require('@/lib/pm/integration');

describe('PM Tasks API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Implement feature X',
      description: 'Build the feature',
      priority: 'high',
      status: 'in_progress',
      source: 'github',
      project_id: 'proj-1',
    },
    {
      id: 'task-2',
      title: 'Review PR #123',
      description: 'Code review needed',
      priority: 'medium',
      status: 'pending',
      source: 'motion',
      project_id: 'proj-2',
    },
    {
      id: 'task-3',
      title: 'Update docs',
      description: 'Documentation updates',
      priority: 'low',
      status: 'done',
      source: 'local',
      project_id: null,
    },
  ];

  describe('GET /api/pm/tasks', () => {
    it('should return all tasks with count and sources', async () => {
      getAllTasks.mockResolvedValue(mockTasks);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.count).toBe(3);
      expect(data.tasks).toEqual(mockTasks);
      expect(data.sources).toMatchObject({
        github: 1,
        motion: 1,
        local: 1,
      });
    });

    it('should handle empty tasks array', async () => {
      getAllTasks.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks');
      const response = await GET(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.count).toBe(0);
      expect(data.tasks).toEqual([]);
      expect(data.sources).toMatchObject({
        github: 0,
        motion: 0,
        local: 0,
      });
    });

    it('should return 500 on error', async () => {
      getAllTasks.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/pm/tasks');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should count tasks by source correctly', async () => {
      const tasksWithSameSources = [
        { ...mockTasks[0], source: 'github' },
        { ...mockTasks[1], source: 'github' },
        { ...mockTasks[2], source: 'motion' },
      ];
      getAllTasks.mockResolvedValue(tasksWithSameSources);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks');
      const response = await GET(request);
      const data = await response.json();

      expect(data.sources.github).toBe(2);
      expect(data.sources.motion).toBe(1);
      expect(data.sources.local).toBe(0);
    });
  });

  describe('POST /api/pm/tasks', () => {
    it('should create a new task successfully', async () => {
      const newTask = {
        id: 'task-new',
        title: 'New task',
        description: 'Task description',
        priority: 'high',
        status: 'pending',
        source: 'local',
        project_id: 'proj-1',
      };

      createTask.mockResolvedValue(newTask);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New task',
          description: 'Task description',
          priority: 'high',
          source: 'local',
          project_id: 'proj-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.task).toEqual(newTask);
      expect(createTask).toHaveBeenCalledWith({
        title: 'New task',
        description: 'Task description',
        priority: 'high',
        source: 'local',
        project_id: 'proj-1',
      });
    });

    it('should return 400 when title is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Task without title',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain('title');
    });

    it('should handle createTask returning null', async () => {
      createTask.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'New task' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Failed to create task');
    });

    it('should return 500 on database error', async () => {
      createTask.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'New task' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should create task with minimal required fields', async () => {
      const minimalTask = {
        id: 'task-minimal',
        title: 'Minimal task',
        status: 'pending',
        source: 'local',
      };

      createTask.mockResolvedValue(minimalTask);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'Minimal task' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.ok).toBe(true);
      expect(data.task.title).toBe('Minimal task');
    });
  });

  describe('PATCH /api/pm/tasks', () => {
    it('should update task successfully', async () => {
      const updatedTask = {
        ...mockTasks[0],
        status: 'done',
        title: 'Updated title',
      };

      updateTask.mockResolvedValue(updatedTask);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'task-1',
          status: 'done',
          title: 'Updated title',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.task).toEqual(updatedTask);
      expect(updateTask).toHaveBeenCalledWith('task-1', {
        status: 'done',
        title: 'Updated title',
        description: undefined,
        priority: undefined,
      });
    });

    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'done',
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain('id');
    });

    it('should handle updateTask returning null', async () => {
      updateTask.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'task-1', status: 'done' }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Failed to update task');
    });

    it('should return 500 on database error', async () => {
      updateTask.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'task-1', status: 'done' }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should update only provided fields', async () => {
      const updatedTask = { ...mockTasks[0], status: 'done' };
      updateTask.mockResolvedValue(updatedTask);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'task-1',
          status: 'done',
        }),
      });

      await PATCH(request);

      expect(updateTask).toHaveBeenCalledWith('task-1', {
        status: 'done',
        title: undefined,
        description: undefined,
        priority: undefined,
      });
    });

    it('should update all fields when provided', async () => {
      const updatedTask = {
        ...mockTasks[0],
        status: 'done',
        title: 'New title',
        description: 'New description',
        priority: 'low',
      };
      updateTask.mockResolvedValue(updatedTask);

      const request = new NextRequest('http://localhost:3000/api/pm/tasks', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'task-1',
          status: 'done',
          title: 'New title',
          description: 'New description',
          priority: 'low',
        }),
      });

      await PATCH(request);

      expect(updateTask).toHaveBeenCalledWith('task-1', {
        status: 'done',
        title: 'New title',
        description: 'New description',
        priority: 'low',
      });
    });
  });
});
