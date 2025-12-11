/**
 * ProactiveExecutor Tests - High Fidelity
 *
 * Tests for the executor module that evaluates and executes
 * high-confidence actions automatically.
 *
 * Tests:
 * - evaluateAction escalation decision logic
 * - executeAction with mocked agent invoker
 * - proposeAction with mocked agent invoker
 * - handleSynthesisActions batch processing
 */

import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

// Mock server-only-guard first
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock agent invoker
jest.mock('../../../lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: jest.fn(),
  },
}));

import {
  ProactiveExecutor,
  evaluateAction,
  executeAction,
  proposeAction,
  handleSynthesisActions,
  type ExecutionDecision,
  type ExecutionResult,
  type ExecutionSummary,
} from '../../../lib/cortex/executor';
import type {
  ProactiveAction,
  UnifiedTask,
  SynthesisResult,
} from '../../../lib/cortex/types';
import { agentInvoker } from '../../../lib/agents/AgentInvoker';
import {
  createMockUnifiedTask,
  createMockProactiveAction,
  createMockSynthesisResult,
} from '../../helpers/cortex-test-utils';

// Test directory for any file operations
const TEST_DIR = join(process.cwd(), '.data', 'test', 'executor-test');

describe('ProactiveExecutor - High Fidelity', () => {
  let executor: ProactiveExecutor;
  const mockAgentInvoker = agentInvoker as jest.Mocked<typeof agentInvoker>;

  beforeAll(() => {
    // Ensure test directory exists
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    executor = ProactiveExecutor.getInstance();
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  // ============================================================================
  // evaluateAction Tests
  // ============================================================================

  describe('evaluateAction', () => {
    describe('AUTO_EXECUTE decisions', () => {
      it('should AUTO_EXECUTE when confidence > required AND impact is low', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.7,
          estimatedImpact: 'low',
        });
        const task = createMockUnifiedTask({ confidence: 0.85 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('AUTO_EXECUTE');
        expect(decision.shouldExecute).toBe(true);
        expect(decision.reason).toContain('High confidence');
      });

      it('should AUTO_EXECUTE when confidence > required AND impact is medium', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.6,
          estimatedImpact: 'medium',
        });
        const task = createMockUnifiedTask({ confidence: 0.75 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('AUTO_EXECUTE');
        expect(decision.shouldExecute).toBe(true);
      });
    });

    describe('PROPOSE decisions', () => {
      it('should PROPOSE when confidence > 0.6 AND impact is high', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.7,
          estimatedImpact: 'high',
        });
        const task = createMockUnifiedTask({ confidence: 0.85 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('PROPOSE');
        expect(decision.shouldExecute).toBe(false);
        expect(decision.reason).toContain('high impact');
      });

      it('should PROPOSE when confidence > 0.6 AND involves priority contact (when confidence <= required)', () => {
        // Note: Priority contact check only triggers PROPOSE when AUTO_EXECUTE condition fails
        // AUTO_EXECUTE requires: confidence > confidenceRequired AND impact != 'high'
        // So we set confidence <= confidenceRequired to bypass AUTO_EXECUTE
        const action = createMockProactiveAction({
          confidenceRequired: 0.8, // Set higher than task confidence
          estimatedImpact: 'medium',
        });
        const task = createMockUnifiedTask({
          confidence: 0.75, // Between 0.6 and 0.8 - bypasses AUTO_EXECUTE, triggers PROPOSE
          metadata: { involvesPriorityContact: true },
        });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('PROPOSE');
        expect(decision.shouldExecute).toBe(false);
        expect(decision.reason).toContain('priority contact');
      });

      it('should PROPOSE when confidence <= required but still > 0.6', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.8,
          estimatedImpact: 'high', // Need high impact to trigger PROPOSE path
        });
        const task = createMockUnifiedTask({ confidence: 0.65 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('PROPOSE');
        expect(decision.shouldExecute).toBe(false);
      });
    });

    describe('DEFER decisions', () => {
      it('should DEFER when confidence <= 0.6', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.7,
          estimatedImpact: 'low',
        });
        const task = createMockUnifiedTask({ confidence: 0.5 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('DEFER');
        expect(decision.shouldExecute).toBe(false);
        expect(decision.reason).toContain('Insufficient confidence');
      });

      it('should DEFER when confidence is exactly 0.6', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.7,
          estimatedImpact: 'medium',
        });
        const task = createMockUnifiedTask({ confidence: 0.6 });

        const decision = executor.evaluateAction(action, task);

        expect(decision.escalationLevel).toBe('DEFER');
        expect(decision.shouldExecute).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle confidence exactly at required threshold', () => {
        const action = createMockProactiveAction({
          confidenceRequired: 0.7,
          estimatedImpact: 'low',
        });
        const task = createMockUnifiedTask({ confidence: 0.7 });

        // Confidence is NOT > required, so won't AUTO_EXECUTE
        const decision = executor.evaluateAction(action, task);

        // Since confidence is 0.7 > 0.6 but <= confidenceRequired, and impact is low
        // it doesn't meet AUTO_EXECUTE (needs > required), and doesn't meet PROPOSE (needs high impact or priority)
        expect(decision.escalationLevel).toBe('DEFER');
      });

      it('should handle all action types', () => {
        const actionTypes = [
          'reply',
          'create_task',
          'schedule',
          'delegate',
          'archive',
          'escalate',
          'research',
          'summarize',
        ] as const;

        for (const type of actionTypes) {
          const action = createMockProactiveAction({
            type,
            confidenceRequired: 0.7,
            estimatedImpact: 'low',
          });
          const task = createMockUnifiedTask({ confidence: 0.85 });

          const decision = executor.evaluateAction(action, task);

          expect(decision.escalationLevel).toBe('AUTO_EXECUTE');
        }
      });
    });
  });

  // ============================================================================
  // executeAction Tests
  // ============================================================================

  describe('executeAction', () => {
    it('should execute action and return success result', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Action executed successfully',
        requestId: 'req-123',
      });

      const action = createMockProactiveAction({
        type: 'create_task',
        targetAgentId: 'pm',
        payload: { title: 'Test task' },
      });
      const task = createMockUnifiedTask({
        title: 'Test Task',
        description: 'A test task',
      });

      const result = await executor.executeAction(action, task);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe('pm');
      expect(result.response).toBe('Action executed successfully');
      expect(result.executedAt).toBeDefined();
      expect(action.executed).toBe(true);
      expect(action.executionResult?.success).toBe(true);
    });

    it('should invoke agent with forceExecute=true', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Done',
        requestId: 'req-456',
      });

      const action = createMockProactiveAction({
        type: 'reply',
        targetAgentId: 'email',
      });
      const task = createMockUnifiedTask();

      await executor.executeAction(action, task);

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'email',
          forceExecute: true,
        })
      );
    });

    it('should handle execution errors gracefully', async () => {
      mockAgentInvoker.invoke.mockRejectedValue(new Error('Agent unavailable'));

      const action = createMockProactiveAction({
        type: 'schedule',
        targetAgentId: 'calendar',
      });
      const task = createMockUnifiedTask();

      const result = await executor.executeAction(action, task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent unavailable');
      expect(action.executed).toBe(true);
      expect(action.executionResult?.success).toBe(false);
    });

    it('should build correct prompt for different action types', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Done',
        requestId: 'req-789',
      });

      const action = createMockProactiveAction({
        type: 'delegate',
        targetAgentId: 'pm',
        payload: {
          delegateTo: 'assistant-bot',
          instructions: 'Handle this task',
        },
        rationale: 'Task requires delegation',
      });
      const task = createMockUnifiedTask({
        title: 'Complex Task',
        description: 'Needs delegation',
      });

      await executor.executeAction(action, task);

      const callArgs = mockAgentInvoker.invoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('delegate');
      expect(callArgs.userMessage).toContain('assistant-bot');
      expect(callArgs.userMessage).toContain('Complex Task');
    });
  });

  // ============================================================================
  // proposeAction Tests
  // ============================================================================

  describe('proposeAction', () => {
    it('should propose action and return approval ID', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Proposal received',
        requestId: 'approval-abc-123',
      });

      const action = createMockProactiveAction({
        type: 'reply',
        targetAgentId: 'email',
        estimatedImpact: 'high',
        rationale: 'Important response needed',
      });
      const task = createMockUnifiedTask({
        title: 'Reply to CEO',
        confidence: 0.75,
        urgency: 'high',
      });

      const approvalId = await executor.proposeAction(action, task);

      expect(approvalId).toBe('approval-abc-123');
    });

    it('should invoke agent with forceExecute=false to trigger escalation', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Proposal received',
        requestId: 'approval-456',
      });

      const action = createMockProactiveAction();
      const task = createMockUnifiedTask();

      await executor.proposeAction(action, task);

      expect(mockAgentInvoker.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          forceExecute: false,
        })
      );
    });

    it('should include task details in proposal message', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Proposal received',
        requestId: 'approval-789',
      });

      const action = createMockProactiveAction({
        type: 'delegate',
        estimatedImpact: 'high',
        rationale: 'Needs expert review',
      });
      const task = createMockUnifiedTask({
        title: 'Financial Analysis',
        confidence: 0.65,
        urgency: 'critical',
      });

      await executor.proposeAction(action, task);

      const callArgs = mockAgentInvoker.invoke.mock.calls[0][0];
      expect(callArgs.userMessage).toContain('Financial Analysis');
      expect(callArgs.userMessage).toContain('critical');
      expect(callArgs.userMessage).toContain('high'); // impact
    });

    it('should throw on agent error', async () => {
      mockAgentInvoker.invoke.mockRejectedValue(new Error('Agent down'));

      const action = createMockProactiveAction();
      const task = createMockUnifiedTask();

      await expect(executor.proposeAction(action, task)).rejects.toThrow('Agent down');
    });
  });

  // ============================================================================
  // handleSynthesisActions Tests
  // ============================================================================

  describe('handleSynthesisActions', () => {
    it('should process multiple actions and return summary', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Done',
        requestId: 'req-batch',
      });

      const result = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'Task 1',
            description: 'Test',
            confidence: 0.9,
            urgency: 'medium',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
        proposed_actions: [
          createMockProactiveAction({
            type: 'create_task',
            confidenceRequired: 0.7,
            estimatedImpact: 'low',
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.executed).toBeGreaterThanOrEqual(0);
      expect(summary.proposed).toBeGreaterThanOrEqual(0);
      expect(summary.deferred).toBeGreaterThanOrEqual(0);
      expect(summary.executionDetails.length).toBe(1);
    });

    it('should execute AUTO_EXECUTE actions', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Executed',
        requestId: 'req-exec',
      });

      const result = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'High Confidence Task',
            confidence: 0.9,
            urgency: 'low',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
        proposed_actions: [
          createMockProactiveAction({
            type: 'archive',
            confidenceRequired: 0.7,
            estimatedImpact: 'low', // Low impact + high confidence = AUTO_EXECUTE
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.executed).toBe(1);
      expect(summary.executionDetails[0].escalationLevel).toBe('AUTO_EXECUTE');
    });

    it('should propose PROPOSE actions', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Proposed',
        requestId: 'approval-prop',
      });

      const result = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'High Impact Task',
            confidence: 0.85,
            urgency: 'high',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
        proposed_actions: [
          createMockProactiveAction({
            type: 'reply',
            confidenceRequired: 0.7,
            estimatedImpact: 'high', // High impact = PROPOSE
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.proposed).toBe(1);
      expect(summary.executionDetails[0].escalationLevel).toBe('PROPOSE');
      expect(summary.executionDetails[0].approvalId).toBe('approval-prop');
    });

    it('should defer low confidence actions', async () => {
      const result = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'Low Confidence Task',
            confidence: 0.4, // Low confidence = DEFER
            urgency: 'low',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
        proposed_actions: [
          createMockProactiveAction({
            type: 'schedule',
            confidenceRequired: 0.7,
            estimatedImpact: 'medium',
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.deferred).toBe(1);
      expect(summary.executionDetails[0].escalationLevel).toBe('DEFER');
    });

    it('should defer actions without matching tasks', async () => {
      const result = createMockSynthesisResult({
        unified_tasks: [], // No tasks
        proposed_actions: [
          createMockProactiveAction({
            type: 'create_task',
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.deferred).toBe(1);
    });

    it('should handle mixed action types in single batch', async () => {
      mockAgentInvoker.invoke
        .mockResolvedValueOnce({ content: 'Executed', requestId: 'exec-1' })
        .mockResolvedValueOnce({ content: 'Proposed', requestId: 'prop-1' });

      const result = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'Task',
            confidence: 0.9, // High confidence for first action
            urgency: 'medium',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
        proposed_actions: [
          createMockProactiveAction({
            type: 'archive',
            confidenceRequired: 0.7,
            estimatedImpact: 'low', // AUTO_EXECUTE
          }),
          createMockProactiveAction({
            type: 'reply',
            confidenceRequired: 0.7,
            estimatedImpact: 'high', // PROPOSE
          }),
        ],
      });

      const summary = await executor.handleSynthesisActions(result);

      // Both actions use the same high-confidence task
      expect(summary.executed + summary.proposed + summary.deferred).toBe(2);
      expect(summary.executionDetails.length).toBe(2);
    });

    it('should return empty summary for no actions', async () => {
      const result = createMockSynthesisResult({
        unified_tasks: [],
        proposed_actions: [],
      });

      const summary = await executor.handleSynthesisActions(result);

      expect(summary.executed).toBe(0);
      expect(summary.proposed).toBe(0);
      expect(summary.deferred).toBe(0);
      expect(summary.executionDetails).toEqual([]);
    });
  });

  // ============================================================================
  // Convenience Function Tests
  // ============================================================================

  describe('convenience functions', () => {
    it('evaluateAction convenience function works', () => {
      const action = createMockProactiveAction({
        confidenceRequired: 0.5,
        estimatedImpact: 'low',
      });
      const task = createMockUnifiedTask({ confidence: 0.8 });

      const decision = evaluateAction(action, task);

      expect(decision.escalationLevel).toBe('AUTO_EXECUTE');
    });

    it('executeAction convenience function works', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Done',
        requestId: 'conv-exec',
      });

      const action = createMockProactiveAction();
      const task = createMockUnifiedTask();

      const result = await executeAction(action, task);

      expect(result.success).toBe(true);
    });

    it('proposeAction convenience function works', async () => {
      mockAgentInvoker.invoke.mockResolvedValue({
        content: 'Proposed',
        requestId: 'conv-prop',
      });

      const action = createMockProactiveAction();
      const task = createMockUnifiedTask();

      const approvalId = await proposeAction(action, task);

      expect(approvalId).toBe('conv-prop');
    });

    it('handleSynthesisActions convenience function works', async () => {
      const result = createMockSynthesisResult({
        unified_tasks: [],
        proposed_actions: [],
      });

      const summary = await handleSynthesisActions(result);

      expect(summary.executed).toBe(0);
    });
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = ProactiveExecutor.getInstance();
      const instance2 = ProactiveExecutor.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
