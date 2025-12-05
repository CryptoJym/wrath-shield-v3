/**
 * AI Triage Engine Tests
 *
 * Tests for the core AI-powered triage engine including:
 * - Response parsing (JSON, markdown code blocks)
 * - Prompt construction
 * - Main triage function
 * - Batch triage
 * - Configuration helpers
 * - Edge cases (Zep unavailable, AgentInvoker failures)
 */

import type { IncomingSignal } from '@/lib/pm/task-queue';

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
    global_principles: [
      'Family first',
      'Legal compliance is non-negotiable',
      'Security before convenience',
    ],
    escalation_levels: {
      CRITICAL: {
        description: 'Immediate attention required',
        triggers: ['legal threat', 'security breach', 'family emergency'],
        response_time: 'immediate',
      },
      PROPOSE: {
        description: 'Needs approval',
        triggers: ['new project', 'bulk operation', 'budget change'],
        response_time: '24h',
      },
      AUTO_EXECUTE: {
        description: 'Auto execute',
        triggers: ['routine sync', 'low-risk operation'],
        response_time: 'async',
      },
    },
    priority_stack: [],
    coherence_rules: {
      avoid_fragmentation: [],
      deadline_rules: [],
      meeting_rules: [],
    },
  }),
  getDomain: jest.fn(),
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
  triageSignalWithAI,
  triageSignalsBatch,
  getAITriageConfidenceThreshold,
  isAITriageEnabled,
} from '@/lib/pm/ai-triage';

describe('AI Triage Engine', () => {
  const mockSignal: IncomingSignal = {
    id: 'signal_test_123',
    source: 'github',
    signal_type: 'task',
    payload: {
      title: 'Fix critical bug in authentication',
      description: 'Users cannot log in due to session timeout',
      action: 'opened',
      labels: ['bug', 'critical'],
    },
    timestamp: Math.floor(Date.now() / 1000),
    confidence: 0.85,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD;
    delete process.env.USE_AI_TRIAGE;
  });

  describe('triageSignalWithAI', () => {
    test('should successfully triage a signal with valid AI response', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'github_issue',
          escalation_level: 'critical',
          priority: 'critical',
          confidence: 0.92,
          rationale: 'Critical authentication bug blocking user access',
          suggested_title: 'Fix authentication session timeout',
          suggested_labels: ['bug', 'critical', 'auth'],
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 150,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.action).toBe('github_issue');
      expect(result!.escalation_level).toBe('critical');
      expect(result!.priority).toBe('critical');
      expect(result!.confidence).toBe(0.92);
      expect(result!.metadata?.ai_powered).toBe(true);
      expect(result!.model_used).toBe('gpt-4.1-2025-04-14');
      expect(result!.metadata?.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    test('should handle markdown code block response', async () => {
      const mockResponse = {
        content: '```json\n{"action": "local_task", "escalation_level": "auto", "priority": "medium", "confidence": 0.75, "rationale": "Routine task"}\n```',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.action).toBe('local_task');
      expect(result!.escalation_level).toBe('auto');
    });

    test('should handle code block without json annotation', async () => {
      const mockResponse = {
        content: '```\n{"action": "defer", "escalation_level": "propose", "priority": "low", "confidence": 0.55, "rationale": "Low confidence signal"}\n```',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.action).toBe('defer');
    });

    test('should use Zep context when available', async () => {
      mockSearchPMMemories.mockResolvedValueOnce([
        { text: 'Similar issue was triaged as critical last week' },
        { text: 'Auth bugs typically need immediate attention' },
      ]);

      const mockResponse = {
        content: JSON.stringify({
          action: 'github_issue',
          escalation_level: 'critical',
          priority: 'critical',
          confidence: 0.95,
          rationale: 'Critical auth bug matching historical pattern',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 200,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.zep_context_used).toBe(true);
      expect(mockSearchPMMemories).toHaveBeenCalled();
    });

    test('should continue without Zep when search fails', async () => {
      mockSearchPMMemories.mockRejectedValueOnce(new Error('Zep connection failed'));

      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Standard task without historical context',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.zep_context_used).toBe(false);
    });

    test('should persist decision to Zep for learning', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'github_issue',
          escalation_level: 'propose',
          priority: 'high',
          confidence: 0.85,
          rationale: 'Important feature request',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 120,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await triageSignalWithAI(mockSignal);

      expect(mockAddPMMemory).toHaveBeenCalledWith(
        expect.stringContaining('Triaged signal'),
        'decision',
        expect.objectContaining({
          signal_id: mockSignal.id,
          action: 'github_issue',
        })
      );
    });

    test('should continue when Zep persistence fails', async () => {
      mockAddPMMemory.mockRejectedValueOnce(new Error('Zep write failed'));

      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.8,
          rationale: 'Standard task',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      // Should still return result even if persistence failed
      expect(result).not.toBeNull();
      expect(result!.action).toBe('local_task');
    });

    test('should return null when AgentInvoker fails', async () => {
      mockAgentInvoke.mockRejectedValueOnce(new Error('OpenAI API error'));

      const result = await triageSignalWithAI(mockSignal);

      expect(result).toBeNull();
    });

    test('should return null when response cannot be parsed', async () => {
      const mockResponse = {
        content: 'This is not valid JSON at all',
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 50,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).toBeNull();
    });

    test('should return null when required fields are missing', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          // missing escalation_level and priority
          confidence: 0.5,
          rationale: 'Incomplete response',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 80,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).toBeNull();
    });

    test('should return null for invalid action type', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'invalid_action_type',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Invalid action',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 80,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).toBeNull();
    });

    test('should return null for invalid escalation level', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'invalid_level',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Invalid escalation',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 80,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).toBeNull();
    });

    test('should default confidence to 0.5 when not a number', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 'high', // String instead of number
          rationale: 'Non-numeric confidence',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 80,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.5);
    });

    test('should handle all valid action types', async () => {
      const actions = ['github_issue', 'local_task', 'defer', 'ignore', 'escalate'];

      for (const action of actions) {
        mockAgentInvoke.mockResolvedValueOnce({
          content: JSON.stringify({
            action,
            escalation_level: 'auto',
            priority: 'medium',
            confidence: 0.7,
            rationale: `Testing ${action}`,
          }),
          model: 'gpt-4.1-2025-04-14',
          tokensUsed: 80,
        });

        const result = await triageSignalWithAI(mockSignal);

        expect(result).not.toBeNull();
        expect(result!.action).toBe(action);
      }
    });

    test('should handle all valid escalation levels', async () => {
      const escalations = ['auto', 'propose', 'critical'];

      for (const escalation of escalations) {
        mockAgentInvoke.mockResolvedValueOnce({
          content: JSON.stringify({
            action: 'local_task',
            escalation_level: escalation,
            priority: 'medium',
            confidence: 0.7,
            rationale: `Testing ${escalation}`,
          }),
          model: 'gpt-4.1-2025-04-14',
          tokensUsed: 80,
        });

        const result = await triageSignalWithAI(mockSignal);

        expect(result).not.toBeNull();
        expect(result!.escalation_level).toBe(escalation);
      }
    });

    test('should include optional fields when provided', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'github_issue',
          escalation_level: 'propose',
          priority: 'high',
          confidence: 0.88,
          rationale: 'Full response with all optional fields',
          suggested_title: 'Refactor auth module',
          suggested_labels: ['enhancement', 'security'],
          assigned_project: 'platform',
          due_date: '2025-01-15',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 150,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.suggested_title).toBe('Refactor auth module');
      expect(result!.suggested_labels).toEqual(['enhancement', 'security']);
      expect(result!.assigned_project).toBe('platform');
      expect(result!.due_date).toBe('2025-01-15');
    });

    test('should track processing time', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Timing test',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(mockSignal);

      expect(result).not.toBeNull();
      expect(result!.metadata?.processing_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('triageSignalsBatch', () => {
    test('should triage multiple signals in parallel batches', async () => {
      const signals: IncomingSignal[] = [
        { ...mockSignal, id: 'signal_1' },
        { ...mockSignal, id: 'signal_2' },
        { ...mockSignal, id: 'signal_3' },
        { ...mockSignal, id: 'signal_4' },
        { ...mockSignal, id: 'signal_5' },
      ];

      for (let i = 0; i < 5; i++) {
        mockAgentInvoke.mockResolvedValueOnce({
          content: JSON.stringify({
            action: 'local_task',
            escalation_level: 'auto',
            priority: 'medium',
            confidence: 0.7 + i * 0.02,
            rationale: `Batch signal ${i + 1}`,
          }),
          model: 'gpt-4.1-2025-04-14',
          tokensUsed: 100,
        });
      }

      const results = await triageSignalsBatch(signals);

      expect(results.size).toBe(5);
      expect(results.get('signal_1')).not.toBeNull();
      expect(results.get('signal_2')).not.toBeNull();
      expect(results.get('signal_3')).not.toBeNull();
      expect(results.get('signal_4')).not.toBeNull();
      expect(results.get('signal_5')).not.toBeNull();
    });

    test('should handle partial failures in batch', async () => {
      const signals: IncomingSignal[] = [
        { ...mockSignal, id: 'signal_success' },
        { ...mockSignal, id: 'signal_fail' },
      ];

      mockAgentInvoke
        .mockResolvedValueOnce({
          content: JSON.stringify({
            action: 'local_task',
            escalation_level: 'auto',
            priority: 'medium',
            confidence: 0.8,
            rationale: 'Success',
          }),
          model: 'gpt-4.1-2025-04-14',
          tokensUsed: 100,
        })
        .mockRejectedValueOnce(new Error('API error'));

      const results = await triageSignalsBatch(signals);

      expect(results.get('signal_success')).not.toBeNull();
      expect(results.get('signal_fail')).toBeNull();
    });

    test('should handle empty batch', async () => {
      const results = await triageSignalsBatch([]);

      expect(results.size).toBe(0);
    });
  });

  describe('getAITriageConfidenceThreshold', () => {
    test('should return default threshold of 0.6', () => {
      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0.6);
    });

    test('should return custom threshold from environment', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = '0.75';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0.75);
    });

    test('should return default for invalid threshold', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = 'invalid';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0.6);
    });

    test('should return default for out-of-range threshold (negative)', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = '-0.5';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0.6);
    });

    test('should return default for out-of-range threshold (>1)', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = '1.5';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0.6);
    });

    test('should accept threshold at boundary (0)', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = '0';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(0);
    });

    test('should accept threshold at boundary (1)', () => {
      process.env.AI_TRIAGE_CONFIDENCE_THRESHOLD = '1';

      const threshold = getAITriageConfidenceThreshold();

      expect(threshold).toBe(1);
    });
  });

  describe('isAITriageEnabled', () => {
    test('should return true by default', () => {
      const enabled = isAITriageEnabled();

      expect(enabled).toBe(true);
    });

    test('should return false when explicitly disabled', () => {
      process.env.USE_AI_TRIAGE = 'false';

      const enabled = isAITriageEnabled();

      expect(enabled).toBe(false);
    });

    test('should return true for any value except "false"', () => {
      process.env.USE_AI_TRIAGE = 'true';
      expect(isAITriageEnabled()).toBe(true);

      process.env.USE_AI_TRIAGE = '1';
      expect(isAITriageEnabled()).toBe(true);

      process.env.USE_AI_TRIAGE = 'yes';
      expect(isAITriageEnabled()).toBe(true);
    });
  });

  describe('Prompt Construction', () => {
    test('should include signal details in AgentInvoker call', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Test',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await triageSignalWithAI(mockSignal);

      expect(mockAgentInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent.pm',
          providerOverride: 'openai',
          modelOverride: 'gpt-4.1-2025-04-14',
        })
      );

      const callArgs = mockAgentInvoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain(mockSignal.id);
      expect(callArgs.userMessage).toContain(mockSignal.source);
      expect(callArgs.userMessage).toContain(mockSignal.signal_type);
    });

    test('should include Life Charter context', async () => {
      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Test',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await triageSignalWithAI(mockSignal);

      const callArgs = mockAgentInvoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('CRITICAL');
      expect(callArgs.userMessage).toContain('PROPOSE');
      expect(callArgs.userMessage).toContain('AUTO_EXECUTE');
      expect(callArgs.userMessage).toContain('legal threat');
      expect(callArgs.userMessage).toContain('Family first');
    });

    test('should include Zep context when memories found', async () => {
      mockSearchPMMemories.mockResolvedValueOnce([
        { text: 'Historical memory 1' },
        { text: 'Historical memory 2' },
      ]);

      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.7,
          rationale: 'Test',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      await triageSignalWithAI(mockSignal);

      const callArgs = mockAgentInvoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('Historical Context from Memory');
      expect(callArgs.userMessage).toContain('Historical memory 1');
    });
  });

  describe('Signal Types', () => {
    test('should handle github source signals', async () => {
      const githubSignal: IncomingSignal = {
        id: 'gh_signal_1',
        source: 'github',
        signal_type: 'task',
        payload: {
          repository: 'test/repo',
          action: 'opened',
          title: 'New issue',
        },
        timestamp: Math.floor(Date.now() / 1000),
        confidence: 0.9,
      };

      const mockResponse = {
        content: JSON.stringify({
          action: 'github_issue',
          escalation_level: 'auto',
          priority: 'medium',
          confidence: 0.85,
          rationale: 'GitHub issue',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(githubSignal);

      expect(result).not.toBeNull();
      expect(result!.action).toBe('github_issue');
    });

    test('should handle inbox source signals', async () => {
      const inboxSignal: IncomingSignal = {
        id: 'inbox_signal_1',
        source: 'inbox',
        signal_type: 'task',
        payload: {
          from: 'client@example.com',
          subject: 'Urgent request',
          body: 'Please handle ASAP',
        },
        timestamp: Math.floor(Date.now() / 1000),
        confidence: 0.8,
      };

      const mockResponse = {
        content: JSON.stringify({
          action: 'local_task',
          escalation_level: 'propose',
          priority: 'high',
          confidence: 0.88,
          rationale: 'Urgent client request',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(inboxSignal);

      expect(result).not.toBeNull();
      expect(result!.priority).toBe('high');
    });

    test('should handle comms source signals', async () => {
      const commsSignal: IncomingSignal = {
        id: 'comms_signal_1',
        source: 'comms',
        signal_type: 'follow_up',
        payload: {
          contact: 'John Doe',
          channel: 'email',
          last_contact: '2025-01-01',
        },
        timestamp: Math.floor(Date.now() / 1000),
        confidence: 0.75,
      };

      const mockResponse = {
        content: JSON.stringify({
          action: 'defer',
          escalation_level: 'auto',
          priority: 'low',
          confidence: 0.65,
          rationale: 'Low priority follow-up',
        }),
        model: 'gpt-4.1-2025-04-14',
        tokensUsed: 100,
      };

      mockAgentInvoke.mockResolvedValueOnce(mockResponse);

      const result = await triageSignalWithAI(commsSignal);

      expect(result).not.toBeNull();
      expect(result!.action).toBe('defer');
    });
  });
});
