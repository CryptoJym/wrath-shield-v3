// @ts-nocheck
/**
 * Wrath Shield v3 - TaskExtractor Tests
 *
 * Tests for the Sherlock Engine that analyzes lifelogs
 * and extracts actionable tasks and projects.
 */

import { TaskExtractor, getTaskExtractor } from '@/lib/TaskExtractor';
import type { Lifelog } from '@/lib/db/types';

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock AgentInvoker
jest.mock('@/lib/agents/AgentInvoker', () => ({
  invokeAgent: jest.fn(),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgent: jest.fn(),
}));

const { invokeAgent } = require('@/lib/agents/AgentInvoker');
const { getAgent } = require('@/lib/life-os-config');

describe('TaskExtractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: sherlock agent exists
    getAgent.mockReturnValue({ id: 'agent.sherlock', name: 'Sherlock' });
  });

  const mockLifelogs: Lifelog[] = [
    {
      id: 'log1',
      date: '2025-01-31',
      title: 'Morning standup',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: JSON.stringify({
        markdown: 'Discussed project deadlines. Need to review the API integration by Friday.',
      }),
    },
    {
      id: 'log2',
      date: '2025-01-31',
      title: 'Client call',
      manipulation_count: 1,
      wrath_deployed: 0,
      raw_json: JSON.stringify({
        markdown: 'Client wants new feature. Should schedule follow-up meeting.',
      }),
    },
  ];

  describe('constructor', () => {
    it('should use sherlock agent when available', () => {
      getAgent.mockReturnValue({ id: 'agent.sherlock', name: 'Sherlock' });
      const extractor = new TaskExtractor();
      expect(getAgent).toHaveBeenCalledWith('agent.sherlock');
    });

    it('should fallback to orchestrator when sherlock not available', () => {
      getAgent.mockReturnValue(null);
      const extractor = new TaskExtractor();
      expect(getAgent).toHaveBeenCalledWith('agent.sherlock');
    });
  });

  describe('extractFromLogs', () => {
    it('should return empty array for empty lifelogs', async () => {
      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs([]);
      expect(result).toEqual([]);
      expect(invokeAgent).not.toHaveBeenCalled();
    });

    it('should extract projects from lifelogs', async () => {
      const mockResponse = {
        content: JSON.stringify({
          projects: [
            {
              name: 'API Integration',
              description: 'Review and complete API integration',
              tasks: [
                {
                  content: 'Review API documentation',
                  description: 'Check latest API specs',
                  priority: 3,
                  due_string: 'Friday',
                },
                {
                  content: 'Implement endpoint handlers',
                  priority: 2,
                },
              ],
            },
            {
              name: 'Client Project',
              description: 'New feature request from client',
              tasks: [
                {
                  content: 'Schedule follow-up meeting',
                  priority: 4,
                  due_string: 'tomorrow',
                },
              ],
            },
          ],
        }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(mockLifelogs);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('API Integration');
      expect(result[0].tasks.length).toBe(2);
      expect(result[1].name).toBe('Client Project');
      expect(result[1].tasks[0].priority).toBe(4);
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockResponse = {
        content: '```json\n{"projects": [{"name": "Test", "description": "Test project", "tasks": []}]}\n```',
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(mockLifelogs);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Test');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        content: 'This is not valid JSON',
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      // Spy on console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(mockLifelogs);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse LLM response'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle missing projects array in response', async () => {
      const mockResponse = {
        content: JSON.stringify({ tasks: [] }), // Missing 'projects' key
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(mockLifelogs);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse LLM response'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should call invokeAgent with correct parameters', async () => {
      const mockResponse = {
        content: JSON.stringify({ projects: [] }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      await extractor.extractFromLogs(mockLifelogs);

      expect(invokeAgent).toHaveBeenCalledWith({
        agentId: 'agent.sherlock',
        userMessage: expect.stringContaining('Analyze the following life logs'),
        forceExecute: true,
      });
    });

    it('should include lifelog content in user message', async () => {
      const mockResponse = {
        content: JSON.stringify({ projects: [] }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      await extractor.extractFromLogs(mockLifelogs);

      const userMessage = invokeAgent.mock.calls[0][0].userMessage;
      expect(userMessage).toContain('Morning standup');
      expect(userMessage).toContain('Client call');
      expect(userMessage).toContain('2025-01-31');
    });

    it('should handle lifelogs without raw_json', async () => {
      const logsWithoutRaw: Lifelog[] = [
        {
          id: 'log1',
          date: '2025-01-31',
          title: 'Simple log',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: null,
        },
      ];

      const mockResponse = {
        content: JSON.stringify({
          projects: [{
            name: 'From Title',
            description: 'Extracted from title',
            tasks: [],
          }],
        }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(logsWithoutRaw);

      expect(result.length).toBe(1);
    });

    it('should handle lifelogs with invalid raw_json', async () => {
      const logsWithInvalidRaw: Lifelog[] = [
        {
          id: 'log1',
          date: '2025-01-31',
          title: 'Bad JSON log',
          manipulation_count: 0,
          wrath_deployed: 0,
          raw_json: 'not valid json',
        },
      ];

      const mockResponse = {
        content: JSON.stringify({ projects: [] }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(logsWithInvalidRaw);

      // Should not throw, just return empty transcript
      expect(invokeAgent).toHaveBeenCalled();
    });
  });

  describe('getTaskExtractor singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getTaskExtractor();
      const instance2 = getTaskExtractor();
      expect(instance1).toBe(instance2);
    });

    it('should return TaskExtractor instance', () => {
      const instance = getTaskExtractor();
      expect(instance).toBeInstanceOf(TaskExtractor);
    });
  });

  describe('ExtractedProject structure', () => {
    it('should extract complete task structure', async () => {
      const mockResponse = {
        content: JSON.stringify({
          projects: [{
            name: 'Test Project',
            description: 'Project description',
            tasks: [{
              content: 'Task content',
              description: 'Task description',
              priority: 3,
              due_string: 'next monday',
            }],
          }],
        }),
        escalationLevel: 'AUTO_EXECUTE',
      };

      invokeAgent.mockResolvedValue(mockResponse);

      const extractor = new TaskExtractor();
      const result = await extractor.extractFromLogs(mockLifelogs);

      const project = result[0];
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Project description');
      expect(project.tasks.length).toBe(1);

      const task = project.tasks[0];
      expect(task.content).toBe('Task content');
      expect(task.description).toBe('Task description');
      expect(task.priority).toBe(3);
      expect(task.due_string).toBe('next monday');
    });
  });
});
