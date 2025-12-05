/**
 * AI Suggestions Engine Tests
 *
 * Tests for the AI-powered suggestions engine including:
 * - Priority suggestions
 * - Assignment suggestions
 * - Next action suggestions
 * - Daily suggestions generation
 * - Response parsing
 * - Edge cases (Zep unavailable, empty task lists)
 */

import type { UnifiedTask } from '@/lib/pm/types';

// Mock the server-only guard first
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock pm-memory
const mockSearchPMMemories = jest.fn().mockResolvedValue([]);
const mockAddPMMemory = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/pm/pm-memory', () => ({
  searchPMMemories: (...args: unknown[]) => mockSearchPMMemories(...args),
  addPMMemory: (...args: unknown[]) => mockAddPMMemory(...args),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getLifeCharter: () => ({
    owner: 'test',
    version: 1,
    lastUpdated: '2024-01-01',
    global_principles: ['Test principle'],
    escalation_levels: {
      CRITICAL: { triggers: [], response_time: 'immediate' },
      PROPOSE: { triggers: [], response_time: '24h' },
      AUTO_EXECUTE: { triggers: [], response_time: 'async' },
    },
    priority_stack: [],
    coherence_rules: { avoid_fragmentation: [], deadline_rules: [], meeting_rules: [] },
  }),
  getDomain: jest.fn(),
}));

// Mock temporal-memory
jest.mock('@/lib/pm/temporal-memory', () => ({
  getCurrentState: jest.fn().mockReturnValue({
    attributes: { status: 'active' },
  }),
  getCurrentRelationships: jest.fn().mockReturnValue([]),
}));

// Mock integration
const mockGetAllTasks = jest.fn();
jest.mock('@/lib/pm/integration', () => ({
  getAllTasks: () => mockGetAllTasks(),
}));

// Mock AgentInvoker
const mockAgentInvoke = jest.fn();
jest.mock('@/lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: (...args: unknown[]) => mockAgentInvoke(...args),
  },
}));

// Now import the module under test
import {
  suggestTaskPriorityWithAI,
  suggestAssignmentWithAI,
  suggestNextActionsWithAI,
  generateDailySuggestionsWithAI,
  isAISuggestionsEnabled,
} from '@/lib/pm/ai-suggestions';

describe('AI Suggestions Engine', () => {
  const mockTask: UnifiedTask = {
    id: 'task_test_123',
    title: 'Implement user authentication',
    description: 'Add JWT-based auth to the API',
    status: 'pending',
    priority: 'medium',
    source: 'github',
    project_name: 'Platform',
    labels: ['feature', 'auth'],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  };

  const mockTasks: UnifiedTask[] = [
    mockTask,
    {
      id: 'task_2',
      title: 'Fix database connection issue',
      description: 'Connection pool exhaustion',
      status: 'in_progress',
      priority: 'high',
      source: 'motion',
      project_name: 'Platform',
      labels: ['bug'],
      due_date: '2025-01-10',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
    {
      id: 'task_3',
      title: 'Update documentation',
      description: 'API docs need refresh',
      status: 'pending',
      priority: 'low',
      source: 'todoist',
      project_name: 'Docs',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllTasks.mockResolvedValue(mockTasks);
    delete process.env.USE_AI_SUGGESTIONS;
  });

  describe('suggestTaskPriorityWithAI', () => {
    test('should generate priority suggestion for a task', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Set priority to high',
          rationale: 'This task involves security-critical authentication',
          confidence: 0.88,
          suggested_value: 'high',
          alternative_suggestions: ['Consider breaking into subtasks'],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 120,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.suggestion_type).toBe('priority');
      expect(result!.suggestion).toBe('Set priority to high');
      expect(result!.confidence).toBe(0.88);
      expect(result!.ai_powered).toBe(true);
      expect(result!.metadata?.suggested_priority).toBe('high');
      expect(result!.metadata?.current_priority).toBe('medium');
    });

    test('should return null if task not found', async () => {
      const result = await suggestTaskPriorityWithAI('nonexistent_task');

      expect(result).toBeNull();
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    test('should return null if suggested priority matches current', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Keep priority at medium',
          rationale: 'Current priority is appropriate',
          confidence: 0.9,
          suggested_value: 'medium', // Same as current
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).toBeNull();
    });

    test('should use Zep context when available', async () => {
      mockSearchPMMemories.mockResolvedValueOnce([
        { text: 'Similar auth tasks were set to high priority' },
      ]);

      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Set priority to high',
          rationale: 'Based on similar past tasks',
          confidence: 0.92,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 130,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.zep_context_used).toBe(true);
    });

    test('should continue without Zep when search fails', async () => {
      mockSearchPMMemories.mockRejectedValueOnce(new Error('Zep unavailable'));

      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Set priority to high',
          rationale: 'Important feature',
          confidence: 0.75,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.zep_context_used).toBe(false);
    });

    test('should persist suggestion to Zep for learning', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Set priority to high',
          rationale: 'Security feature',
          confidence: 0.85,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await suggestTaskPriorityWithAI('task_test_123');

      expect(mockAddPMMemory).toHaveBeenCalledWith(
        expect.stringContaining('Priority suggestion'),
        'suggestion',
        expect.objectContaining({
          task_id: 'task_test_123',
          suggestion_type: 'priority',
        })
      );
    });

    test('should return null when AI call fails', async () => {
      mockAgentInvoke.mockRejectedValueOnce(new Error('API error'));

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).toBeNull();
    });

    test('should return null when response parsing fails', async () => {
      const mockResponse = {
        content: 'Invalid JSON response',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 50,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).toBeNull();
    });

    test('should handle markdown code block response', async () => {
      const mockResponse = {
        content: '```json\n{"suggestion": "Increase priority", "rationale": "Urgent", "confidence": 0.8, "suggested_value": "critical"}\n```',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.metadata?.suggested_priority).toBe('critical');
    });

    test('should track processing time', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Set to high',
          rationale: 'Test',
          confidence: 0.7,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('suggestAssignmentWithAI', () => {
    test('should generate assignment suggestion', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Assign to James for technical implementation',
          rationale: 'James has expertise in authentication systems',
          confidence: 0.82,
          suggested_value: 'james',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 110,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestAssignmentWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.suggestion_type).toBe('assignment');
      expect(result!.suggestion).toContain('James');
      expect(result!.confidence).toBe(0.82);
      expect(result!.metadata?.suggested_assignee).toBe('james');
    });

    test('should return null if task not found', async () => {
      const result = await suggestAssignmentWithAI('nonexistent_task');

      expect(result).toBeNull();
    });

    test('should include current assignee in metadata', async () => {
      const taskWithAssignee = {
        ...mockTask,
        assignee: 'bob',
      };
      mockGetAllTasks.mockResolvedValueOnce([taskWithAssignee]);

      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Reassign to Alice',
          rationale: 'Better domain expertise',
          confidence: 0.75,
          suggested_value: 'alice',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestAssignmentWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.metadata?.current_assignee).toBe('bob');
      expect(result!.metadata?.suggested_assignee).toBe('alice');
    });

    test('should use Zep for assignment patterns', async () => {
      mockSearchPMMemories.mockResolvedValueOnce([
        { text: 'Auth tasks typically assigned to security team' },
      ]);

      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Assign to security team',
          rationale: 'Historical pattern',
          confidence: 0.88,
          suggested_value: 'security-team',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestAssignmentWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.zep_context_used).toBe(true);
    });

    test('should return null when AI call fails', async () => {
      mockAgentInvoke.mockRejectedValueOnce(new Error('API error'));

      const result = await suggestAssignmentWithAI('task_test_123');

      expect(result).toBeNull();
    });
  });

  describe('suggestNextActionsWithAI', () => {
    test('should generate action suggestions for open tasks', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Work on database fix - deadline approaching',
              rationale: 'Due in 3 days and blocking other work',
              confidence: 0.92,
              target_task_id: 'task_2',
              urgency: 'high',
            },
            {
              suggestion: 'Review authentication implementation',
              rationale: 'Security-critical feature needs attention',
              confidence: 0.78,
              target_task_id: 'task_test_123',
              urgency: 'medium',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 200,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(2);
      expect(results[0].suggestion_type).toBe('action');
      expect(results[0].suggestion).toContain('database fix');
      expect(results[0].confidence).toBe(0.92);
      expect(results[1].suggestion).toContain('authentication');
    });

    test('should return empty array when no open tasks', async () => {
      mockGetAllTasks.mockResolvedValueOnce([
        { ...mockTask, status: 'completed' },
      ]);

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(0);
      expect(mockAgentInvoke).not.toHaveBeenCalled();
    });

    test('should use Zep for work pattern context', async () => {
      mockSearchPMMemories.mockResolvedValueOnce([
        { text: 'User typically works on high-priority items in morning' },
      ]);

      const mockResponse = {
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Focus on high-priority task',
              rationale: 'Based on work patterns',
              confidence: 0.85,
              target_task_id: 'task_2',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 150,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(1);
      expect(results[0].zep_context_used).toBe(true);
    });

    test('should handle invalid response format', async () => {
      const mockResponse = {
        content: JSON.stringify({
          // Missing 'suggestions' array
          suggestion: 'Single suggestion not in array',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(0);
    });

    test('should filter out invalid suggestions', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Valid suggestion',
              rationale: 'Has all required fields',
              confidence: 0.8,
              target_task_id: 'task_1',
            },
            {
              // Missing rationale
              suggestion: 'Invalid suggestion',
              confidence: 0.7,
            },
            {
              // Missing suggestion
              rationale: 'No suggestion text',
              confidence: 0.6,
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 150,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(1);
      expect(results[0].suggestion).toBe('Valid suggestion');
    });

    test('should return empty array when AI call fails', async () => {
      mockAgentInvoke.mockRejectedValueOnce(new Error('API error'));

      const results = await suggestNextActionsWithAI();

      expect(results).toHaveLength(0);
    });

    test('should track processing time', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Test',
              rationale: 'Test',
              confidence: 0.7,
              target_task_id: 'task_1',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const results = await suggestNextActionsWithAI();

      expect(results[0].processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateDailySuggestionsWithAI', () => {
    test('should generate combined daily suggestions', async () => {
      // Mock for action suggestions
      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Work on urgent task',
              rationale: 'Deadline approaching',
              confidence: 0.9,
              target_task_id: 'task_2',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 150,
      });

      // Mocks for priority suggestions (5 tasks max)
      for (let i = 0; i < 3; i++) {
        mockAgentInvoke.mockResolvedValueOnce({
          content: JSON.stringify({
            suggestion: `Adjust priority for task ${i}`,
            rationale: 'Based on analysis',
            confidence: 0.75 + i * 0.05,
            suggested_value: 'high',
          }),
          model: 'gpt-4.1-2025-04-14',
          tokensUsed: 100,
        });
      }

      const results = await generateDailySuggestionsWithAI();

      expect(results.length).toBeGreaterThan(0);
      // Should be sorted by confidence
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
      }
    });

    test('should deduplicate suggestions by target entity', async () => {
      // Action suggestion for task_test_123
      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Action for task_test_123',
              rationale: 'Action reason',
              confidence: 0.8,
              target_task_id: 'task_test_123',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      });

      // Priority suggestion also for task_test_123 (should be deduplicated)
      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestion: 'Priority for task_test_123',
          rationale: 'Priority reason',
          confidence: 0.7,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      });

      // Additional priority suggestions
      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestion: 'Priority for task_2',
          rationale: 'Reason',
          confidence: 0.75,
          suggested_value: 'critical',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      });

      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestion: 'Keep current priority',
          rationale: 'Appropriate',
          confidence: 0.8,
          suggested_value: 'low', // Matches task_3's current priority
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      });

      const results = await generateDailySuggestionsWithAI();

      // Check for deduplication
      const targetIds = results.map(r => `${r.target_entity.type}:${r.target_entity.id}`);
      const uniqueIds = [...new Set(targetIds)];
      expect(targetIds.length).toBe(uniqueIds.length);
    });

    test('should return empty array when all AI calls fail', async () => {
      mockAgentInvoke.mockRejectedValue(new Error('API error'));

      const results = await generateDailySuggestionsWithAI();

      expect(results).toHaveLength(0);
    });

    test('should handle partial failures gracefully', async () => {
      // Action suggestions succeed
      mockAgentInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          suggestions: [
            {
              suggestion: 'Valid action',
              rationale: 'Valid reason',
              confidence: 0.85,
              target_task_id: 'task_1',
            },
          ],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      });

      // Priority suggestions fail
      mockAgentInvoke.mockRejectedValue(new Error('API error'));

      const results = await generateDailySuggestionsWithAI();

      // Should still have action suggestions
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].suggestion_type).toBe('action');
    });
  });

  describe('isAISuggestionsEnabled', () => {
    test('should return true by default', () => {
      const enabled = isAISuggestionsEnabled();

      expect(enabled).toBe(true);
    });

    test('should return false when explicitly disabled', () => {
      process.env.USE_AI_SUGGESTIONS = 'false';

      const enabled = isAISuggestionsEnabled();

      expect(enabled).toBe(false);
    });

    test('should return true for any value except "false"', () => {
      process.env.USE_AI_SUGGESTIONS = 'true';
      expect(isAISuggestionsEnabled()).toBe(true);

      process.env.USE_AI_SUGGESTIONS = '1';
      expect(isAISuggestionsEnabled()).toBe(true);

      process.env.USE_AI_SUGGESTIONS = 'yes';
      expect(isAISuggestionsEnabled()).toBe(true);
    });
  });

  describe('Response Parsing', () => {
    test('should handle JSON with extra whitespace', async () => {
      const mockResponse = {
        content: '  \n  {"suggestion": "Test", "rationale": "Test reason", "confidence": 0.8, "suggested_value": "high"}  \n  ',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.suggestion).toBe('Test');
    });

    test('should default confidence to 0.5 when missing', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Test suggestion',
          rationale: 'Test rationale',
          suggested_value: 'high',
          // confidence missing
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.5);
    });

    test('should return null when required fields missing', async () => {
      const mockResponse = {
        content: JSON.stringify({
          // Missing both suggestion and rationale
          confidence: 0.8,
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await suggestTaskPriorityWithAI('task_test_123');

      expect(result).toBeNull();
    });
  });

  describe('Entity Context Building', () => {
    test('should include task details in prompt', async () => {
      const mockResponse = {
        content: JSON.stringify({
          suggestion: 'Test',
          rationale: 'Test',
          confidence: 0.7,
          suggested_value: 'high',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await suggestTaskPriorityWithAI('task_test_123');

      expect(mockAgentInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent.pm',
        })
      );

      const callArgs = mockAgentInvoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('task_test_123');
      expect(callArgs.userMessage).toContain('Implement user authentication');
      expect(callArgs.userMessage).toContain('Platform');
    });
  });
});
