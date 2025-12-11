// @ts-nocheck
/**
 * Tests for Cognitive Synthesis Engine Type Definitions
 *
 * Tests all type definitions, type guards, and helper functions
 * for the cognitive synthesis engine.
 */

import { jest, describe, it, expect } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Import after mocks
import {
  // Type guards
  isWorkingMemoryEvent,
  isUnifiedTask,
  isProactiveAction,
  isSynthesisPattern,
  isSynthesisResult,
  // Helper functions
  createWorkingMemoryEvent,
  createUnifiedTask,
  createProactiveAction,
  // Default configuration
  DEFAULT_SYNTHESIS_CONFIG,
  // Types (for type testing)
  type EventSource,
  type WorkingMemoryEvent,
  type UnifiedTask,
  type UnifiedTaskStatus,
  type UrgencyLevel,
  type ProactiveAction,
  type ProactiveActionType,
  type SynthesisPattern,
  type SynthesisPatternType,
  type SynthesisResult,
  type TaskUpdate,
  type ConfidenceThresholds,
  type SynthesisLoopConfig,
  type UnifiedTaskPartial,
  type EventBufferQuery,
  type TaskQuery,
  type SynthesisMetrics,
} from '../../../lib/cortex/types';

describe('Cognitive Synthesis Engine Types', () => {
  // ==========================================================================
  // Event Source Types Tests
  // ==========================================================================

  describe('EventSource', () => {
    it('should accept valid event sources', () => {
      const validSources: EventSource[] = [
        'limitless',
        'email',
        'imessage',
        'calendar',
        'github',
        'slack',
        'motion',
        'whoop',
      ];
      expect(validSources).toHaveLength(8);
    });
  });

  // ==========================================================================
  // WorkingMemoryEvent Tests
  // ==========================================================================

  describe('WorkingMemoryEvent', () => {
    it('should define a valid event structure', () => {
      const event: WorkingMemoryEvent = {
        id: 'evt-1',
        source: 'email',
        timestamp: '2025-01-15T10:00:00Z',
        content: 'Email content here',
        contentHash: 'hash123',
        processedBySynthesis: false,
      };
      expect(event.id).toBe('evt-1');
      expect(event.processedBySynthesis).toBe(false);
    });

    it('should allow optional fields', () => {
      const event: WorkingMemoryEvent = {
        id: 'evt-2',
        source: 'calendar',
        timestamp: '2025-01-15T10:00:00Z',
        content: 'Meeting at 3pm',
        contentHash: 'hash456',
        processedBySynthesis: true,
        embedding: [0.1, 0.2, 0.3],
        initialClassification: {
          domain: 'work',
          urgency: 'high',
          keywords: ['meeting', 'important'],
        },
        synthesisTaskId: 'task-1',
        metadata: { calendarId: 'cal-123' },
      };
      expect(event.embedding).toHaveLength(3);
      expect(event.initialClassification?.domain).toBe('work');
    });
  });

  // ==========================================================================
  // UnifiedTask Tests
  // ==========================================================================

  describe('UnifiedTask', () => {
    it('should define valid task status values', () => {
      const statuses: UnifiedTaskStatus[] = [
        'synthesizing',
        'ready',
        'approved',
        'executing',
        'completed',
        'dismissed',
      ];
      expect(statuses).toHaveLength(6);
    });

    it('should define valid urgency levels', () => {
      const urgencies: UrgencyLevel[] = [
        'critical',
        'high',
        'medium',
        'low',
        'background',
      ];
      expect(urgencies).toHaveLength(5);
    });

    it('should define a valid task structure', () => {
      const task: UnifiedTask = {
        id: 'task-1',
        title: 'Review proposal',
        description: 'Review and respond to client proposal',
        confidence: 0.85,
        urgency: 'high',
        domain: 'business',
        sourceEvents: ['evt-1', 'evt-2'],
        status: 'ready',
        createdAt: '2025-01-15T10:00:00Z',
        refinementCount: 0,
      };
      expect(task.confidence).toBe(0.85);
      expect(task.sourceEvents).toHaveLength(2);
    });

    it('should allow all optional fields', () => {
      const task: UnifiedTask = {
        id: 'task-2',
        title: 'Complete task',
        description: 'Description',
        confidence: 0.9,
        urgency: 'critical',
        domain: 'work',
        sourceEvents: ['evt-1'],
        status: 'approved',
        createdAt: '2025-01-15T10:00:00Z',
        refinementCount: 3,
        lastRefinedAt: '2025-01-15T12:00:00Z',
        proposedAction: {
          type: 'reply',
          targetAgentId: 'agent.comms',
          payload: { draft: 'Reply text' },
          confidenceRequired: 0.9,
          estimatedImpact: 'high',
          rationale: 'Client is waiting',
          executed: false,
        },
        assignedAgent: 'agent.comms',
        deadline: '2025-01-20T17:00:00Z',
        relatedTasks: ['task-3', 'task-4'],
        metadata: { priority: true },
      };
      expect(task.lastRefinedAt).toBeDefined();
      expect(task.proposedAction?.type).toBe('reply');
      expect(task.assignedAgent).toBe('agent.comms');
    });
  });

  // ==========================================================================
  // ProactiveAction Tests
  // ==========================================================================

  describe('ProactiveAction', () => {
    it('should define valid action types', () => {
      const actionTypes: ProactiveActionType[] = [
        'reply',
        'create_task',
        'schedule',
        'delegate',
        'archive',
        'escalate',
        'research',
        'summarize',
      ];
      expect(actionTypes).toHaveLength(8);
    });

    it('should define a valid action structure', () => {
      const action: ProactiveAction = {
        type: 'reply',
        targetAgentId: 'agent.comms',
        payload: { draftMessage: 'Hello...' },
        confidenceRequired: 0.85,
        estimatedImpact: 'high',
        rationale: 'Client needs response within 24h',
        executed: false,
      };
      expect(action.type).toBe('reply');
      expect(action.executed).toBe(false);
    });

    it('should allow execution result', () => {
      const action: ProactiveAction = {
        type: 'archive',
        targetAgentId: 'agent.inbox',
        payload: { folder: 'archive' },
        confidenceRequired: 0.9,
        estimatedImpact: 'low',
        rationale: 'Newsletter - auto-archive',
        executed: true,
        executedAt: '2025-01-15T10:30:00Z',
        executionResult: {
          success: true,
          message: 'Archived successfully',
          data: { archivedCount: 5 },
        },
      };
      expect(action.executed).toBe(true);
      expect(action.executionResult?.success).toBe(true);
    });
  });

  // ==========================================================================
  // SynthesisPattern Tests
  // ==========================================================================

  describe('SynthesisPattern', () => {
    it('should define valid pattern types', () => {
      const patternTypes: SynthesisPatternType[] = [
        'consolidation',
        'urgency',
        'action',
        'relationship',
        'sequence',
      ];
      expect(patternTypes).toHaveLength(5);
    });

    it('should define a valid pattern structure', () => {
      const pattern: SynthesisPattern = {
        id: 'pat-1',
        patternType: 'consolidation',
        description: 'Meeting emails with calendar events',
        triggerConditions: {
          sources: ['email', 'calendar'],
          keywords: ['meeting', 'schedule'],
          temporalWindow: 3600000,
          minEventCount: 2,
        },
        suggestedBehavior: {
          consolidateEvents: true,
          urgencyOverride: 'high',
        },
        successRate: 0.9,
        usageCount: 25,
        learnedAt: '2025-01-01T00:00:00Z',
      };
      expect(pattern.successRate).toBe(0.9);
      expect(pattern.triggerConditions.sources).toHaveLength(2);
    });

    it('should allow all trigger conditions', () => {
      const pattern: SynthesisPattern = {
        id: 'pat-2',
        patternType: 'action',
        description: 'Complex pattern',
        triggerConditions: {
          sources: ['email'],
          keywords: ['urgent'],
          temporalWindow: 86400000,
          minEventCount: 3,
          customCondition: 'When sender is VIP',
        },
        suggestedBehavior: {},
        successRate: 0.8,
        usageCount: 10,
        learnedAt: '2025-01-01T00:00:00Z',
      };
      expect(pattern.triggerConditions.customCondition).toBeDefined();
    });

    it('should allow all suggested behaviors', () => {
      const pattern: SynthesisPattern = {
        id: 'pat-3',
        patternType: 'urgency',
        description: 'Full behavior pattern',
        triggerConditions: {},
        suggestedBehavior: {
          consolidateEvents: true,
          urgencyOverride: 'critical',
          domainOverride: 'legal',
          proposedActionType: 'escalate',
          customGuidance: 'Always prioritize legal matters',
        },
        successRate: 0.95,
        usageCount: 50,
        learnedAt: '2025-01-01T00:00:00Z',
        lastUsedAt: '2025-01-15T00:00:00Z',
        exampleEvents: ['evt-10', 'evt-11'],
      };
      expect(pattern.suggestedBehavior.domainOverride).toBe('legal');
      expect(pattern.exampleEvents).toHaveLength(2);
    });
  });

  // ==========================================================================
  // SynthesisResult Tests
  // ==========================================================================

  describe('SynthesisResult', () => {
    it('should define a valid result structure', () => {
      const result: SynthesisResult = {
        synthesis_summary: 'Processed 5 events, created 2 tasks',
        unified_tasks: [
          {
            title: 'Task 1',
            description: 'Description 1',
            confidence: 0.85,
            urgency: 'high',
            domain: 'work',
            sourceEvents: ['evt-1'],
          },
        ],
        task_updates: [],
        proposed_actions: [],
        new_patterns: [],
        events_fully_processed: ['evt-1'],
        needs_more_context: ['evt-2'],
      };
      expect(result.unified_tasks).toHaveLength(1);
      expect(result.events_fully_processed).toHaveLength(1);
    });

    it('should allow optional reasoning', () => {
      const result: SynthesisResult = {
        synthesis_summary: 'Summary',
        unified_tasks: [],
        task_updates: [],
        proposed_actions: [],
        new_patterns: [],
        events_fully_processed: [],
        needs_more_context: [],
        reasoning: 'Internal reasoning trace for debugging',
      };
      expect(result.reasoning).toBeDefined();
    });
  });

  // ==========================================================================
  // TaskUpdate Tests
  // ==========================================================================

  describe('TaskUpdate', () => {
    it('should define a valid task update structure', () => {
      const update: TaskUpdate = {
        taskId: 'task-1',
        updates: {
          description: 'Updated description with new context',
          urgency: 'critical',
          confidence: 0.95,
        },
        newSourceEvents: ['evt-5'],
        rationale: 'New email added deadline pressure',
      };
      expect(update.updates.urgency).toBe('critical');
      expect(update.newSourceEvents).toHaveLength(1);
    });

    it('should allow proposed action update', () => {
      const update: TaskUpdate = {
        taskId: 'task-2',
        updates: {
          proposedAction: {
            type: 'reply',
            targetAgentId: 'agent.comms',
            payload: {},
            confidenceRequired: 0.9,
            estimatedImpact: 'high',
            rationale: 'Needs immediate response',
            executed: false,
          },
        },
        newSourceEvents: [],
        rationale: 'Adding action based on follow-up email',
      };
      expect(update.updates.proposedAction?.type).toBe('reply');
    });
  });

  // ==========================================================================
  // Configuration Types Tests
  // ==========================================================================

  describe('Configuration Types', () => {
    describe('ConfidenceThresholds', () => {
      it('should define valid thresholds', () => {
        const thresholds: ConfidenceThresholds = {
          autoExecute: 0.9,
          propose: 0.6,
          refine: 0.4,
        };
        expect(thresholds.autoExecute).toBeGreaterThan(thresholds.propose);
        expect(thresholds.propose).toBeGreaterThan(thresholds.refine);
      });
    });

    describe('SynthesisLoopConfig', () => {
      it('should define a valid config structure', () => {
        const config: SynthesisLoopConfig = {
          intervalMs: 300000,
          minEventsForSynthesis: 3,
          maxEventsPerPass: 50,
          confidenceThresholds: {
            autoExecute: 0.9,
            propose: 0.6,
            refine: 0.4,
          },
          enabled: true,
        };
        expect(config.intervalMs).toBe(300000);
        expect(config.enabled).toBe(true);
      });

      it('should allow optional LLM config', () => {
        const config: SynthesisLoopConfig = {
          intervalMs: 600000,
          minEventsForSynthesis: 5,
          maxEventsPerPass: 100,
          confidenceThresholds: {
            autoExecute: 0.95,
            propose: 0.7,
            refine: 0.5,
          },
          enabled: true,
          llmModel: 'anthropic/claude-opus-4',
          maxTokens: 8000,
          temperature: 0.2,
        };
        expect(config.llmModel).toBe('anthropic/claude-opus-4');
        expect(config.temperature).toBe(0.2);
      });
    });
  });

  // ==========================================================================
  // Utility Types Tests
  // ==========================================================================

  describe('Utility Types', () => {
    describe('UnifiedTaskPartial', () => {
      it('should require id and allow partial fields', () => {
        const partial: UnifiedTaskPartial = {
          id: 'task-1',
          urgency: 'high',
        };
        expect(partial.id).toBe('task-1');
        expect(partial.title).toBeUndefined();
      });
    });

    describe('EventBufferQuery', () => {
      it('should define valid query options', () => {
        const query: EventBufferQuery = {
          source: 'email',
          processedOnly: false,
          startDate: '2025-01-01T00:00:00Z',
          endDate: '2025-01-15T00:00:00Z',
          limit: 100,
          offset: 0,
        };
        expect(query.source).toBe('email');
        expect(query.limit).toBe(100);
      });

      it('should allow partial query', () => {
        const query: EventBufferQuery = {
          limit: 50,
        };
        expect(query.source).toBeUndefined();
      });
    });

    describe('TaskQuery', () => {
      it('should define valid query options', () => {
        const query: TaskQuery = {
          status: 'ready',
          domain: 'work',
          urgency: 'high',
          assignedAgent: 'agent.comms',
          minConfidence: 0.7,
          sortBy: 'urgency',
          sortDirection: 'desc',
          limit: 20,
          offset: 0,
        };
        expect(query.status).toBe('ready');
        expect(query.sortBy).toBe('urgency');
      });

      it('should allow array filters', () => {
        const query: TaskQuery = {
          status: ['ready', 'approved'],
          domain: ['work', 'personal'],
          urgency: ['critical', 'high'],
        };
        expect(Array.isArray(query.status)).toBe(true);
      });
    });

    describe('SynthesisMetrics', () => {
      it('should define valid metrics', () => {
        const metrics: SynthesisMetrics = {
          eventsProcessed: 1000,
          tasksCreated: 150,
          tasksRefined: 75,
          actionsProposed: 200,
          actionsExecuted: 180,
          patternsLearned: 25,
          averageConfidence: 0.82,
          synthesisPassesCompleted: 500,
          lastSynthesisAt: '2025-01-15T10:00:00Z',
          nextSynthesisAt: '2025-01-15T10:05:00Z',
        };
        expect(metrics.eventsProcessed).toBe(1000);
        expect(metrics.averageConfidence).toBeLessThan(1);
      });
    });
  });

  // ==========================================================================
  // Type Guards Tests
  // ==========================================================================

  describe('Type Guards', () => {
    describe('isWorkingMemoryEvent', () => {
      it('should return true for valid event', () => {
        const event: WorkingMemoryEvent = {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:00:00Z',
          content: 'Content',
          contentHash: 'hash',
          processedBySynthesis: false,
        };
        expect(isWorkingMemoryEvent(event)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isWorkingMemoryEvent(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(isWorkingMemoryEvent(undefined)).toBe(false);
      });

      it('should return false for non-object', () => {
        expect(isWorkingMemoryEvent('string')).toBe(false);
        expect(isWorkingMemoryEvent(123)).toBe(false);
        expect(isWorkingMemoryEvent(true)).toBe(false);
      });

      it('should return false for missing required fields', () => {
        expect(isWorkingMemoryEvent({ id: 'evt-1' })).toBe(false);
        expect(isWorkingMemoryEvent({ id: 'evt-1', source: 'email' })).toBe(false);
        expect(
          isWorkingMemoryEvent({
            id: 'evt-1',
            source: 'email',
            timestamp: '2025-01-15T10:00:00Z',
          })
        ).toBe(false);
      });

      it('should return false for wrong field types', () => {
        expect(
          isWorkingMemoryEvent({
            id: 123, // Should be string
            source: 'email',
            timestamp: '2025-01-15T10:00:00Z',
            content: 'Content',
            contentHash: 'hash',
            processedBySynthesis: false,
          })
        ).toBe(false);

        expect(
          isWorkingMemoryEvent({
            id: 'evt-1',
            source: 'email',
            timestamp: '2025-01-15T10:00:00Z',
            content: 'Content',
            contentHash: 'hash',
            processedBySynthesis: 'false', // Should be boolean
          })
        ).toBe(false);
      });
    });

    describe('isUnifiedTask', () => {
      it('should return true for valid task', () => {
        const task: UnifiedTask = {
          id: 'task-1',
          title: 'Task',
          description: 'Description',
          confidence: 0.8,
          urgency: 'medium',
          domain: 'work',
          sourceEvents: ['evt-1'],
          status: 'ready',
          createdAt: '2025-01-15T10:00:00Z',
          refinementCount: 0,
        };
        expect(isUnifiedTask(task)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isUnifiedTask(null)).toBe(false);
      });

      it('should return false for missing required fields', () => {
        expect(isUnifiedTask({ id: 'task-1', title: 'Task' })).toBe(false);
      });

      it('should return false for wrong field types', () => {
        expect(
          isUnifiedTask({
            id: 'task-1',
            title: 'Task',
            description: 'Desc',
            confidence: '0.8', // Should be number
            urgency: 'medium',
            domain: 'work',
            sourceEvents: ['evt-1'],
            status: 'ready',
            createdAt: '2025-01-15T10:00:00Z',
            refinementCount: 0,
          })
        ).toBe(false);

        expect(
          isUnifiedTask({
            id: 'task-1',
            title: 'Task',
            description: 'Desc',
            confidence: 0.8,
            urgency: 'medium',
            domain: 'work',
            sourceEvents: 'evt-1', // Should be array
            status: 'ready',
            createdAt: '2025-01-15T10:00:00Z',
            refinementCount: 0,
          })
        ).toBe(false);
      });
    });

    describe('isProactiveAction', () => {
      it('should return true for valid action', () => {
        const action: ProactiveAction = {
          type: 'reply',
          targetAgentId: 'agent.comms',
          payload: {},
          confidenceRequired: 0.9,
          estimatedImpact: 'high',
          rationale: 'Reason',
          executed: false,
        };
        expect(isProactiveAction(action)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isProactiveAction(null)).toBe(false);
      });

      it('should return false for missing required fields', () => {
        expect(isProactiveAction({ type: 'reply' })).toBe(false);
      });

      it('should return false for wrong payload type', () => {
        expect(
          isProactiveAction({
            type: 'reply',
            targetAgentId: 'agent.comms',
            payload: 'string', // Should be object
            confidenceRequired: 0.9,
            estimatedImpact: 'high',
            rationale: 'Reason',
            executed: false,
          })
        ).toBe(false);
      });
    });

    describe('isSynthesisPattern', () => {
      it('should return true for valid pattern', () => {
        const pattern: SynthesisPattern = {
          id: 'pat-1',
          patternType: 'consolidation',
          description: 'Pattern description',
          triggerConditions: {},
          suggestedBehavior: {},
          successRate: 0.9,
          usageCount: 10,
          learnedAt: '2025-01-01T00:00:00Z',
        };
        expect(isSynthesisPattern(pattern)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isSynthesisPattern(null)).toBe(false);
      });

      it('should return false for missing required fields', () => {
        expect(isSynthesisPattern({ id: 'pat-1', patternType: 'consolidation' })).toBe(false);
      });

      it('should return false for wrong triggerConditions type', () => {
        expect(
          isSynthesisPattern({
            id: 'pat-1',
            patternType: 'consolidation',
            description: 'Desc',
            triggerConditions: 'string', // Should be object
            suggestedBehavior: {},
            successRate: 0.9,
            usageCount: 10,
            learnedAt: '2025-01-01T00:00:00Z',
          })
        ).toBe(false);
      });
    });

    describe('isSynthesisResult', () => {
      it('should return true for valid result', () => {
        const result: SynthesisResult = {
          synthesis_summary: 'Summary',
          unified_tasks: [],
          task_updates: [],
          proposed_actions: [],
          new_patterns: [],
          events_fully_processed: [],
          needs_more_context: [],
        };
        expect(isSynthesisResult(result)).toBe(true);
      });

      it('should return false for null', () => {
        expect(isSynthesisResult(null)).toBe(false);
      });

      it('should return false for missing required arrays', () => {
        expect(
          isSynthesisResult({
            synthesis_summary: 'Summary',
            unified_tasks: [],
            // Missing other arrays
          })
        ).toBe(false);
      });

      it('should return false for wrong array types', () => {
        expect(
          isSynthesisResult({
            synthesis_summary: 'Summary',
            unified_tasks: 'not an array',
            task_updates: [],
            proposed_actions: [],
            new_patterns: [],
            events_fully_processed: [],
            needs_more_context: [],
          })
        ).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Helper Functions Tests
  // ==========================================================================

  describe('Helper Functions', () => {
    describe('createWorkingMemoryEvent', () => {
      it('should create a working memory event', () => {
        const event = createWorkingMemoryEvent('email', 'Test email content');

        expect(event.source).toBe('email');
        expect(event.content).toBe('Test email content');
        expect(event.timestamp).toBeDefined();
        expect(event.processedBySynthesis).toBe(false);
      });

      it('should create event with metadata', () => {
        const metadata = { senderId: 'user-123', subject: 'Test' };
        const event = createWorkingMemoryEvent('email', 'Content', metadata);

        expect(event.metadata).toEqual(metadata);
      });

      it('should use current timestamp', () => {
        const before = new Date().toISOString();
        const event = createWorkingMemoryEvent('calendar', 'Event');
        const after = new Date().toISOString();

        expect(event.timestamp >= before).toBe(true);
        expect(event.timestamp <= after).toBe(true);
      });

      it('should work with all event sources', () => {
        const sources: EventSource[] = [
          'limitless',
          'email',
          'imessage',
          'calendar',
          'github',
          'slack',
          'motion',
          'whoop',
        ];

        sources.forEach((source) => {
          const event = createWorkingMemoryEvent(source, 'Content');
          expect(event.source).toBe(source);
        });
      });
    });

    describe('createUnifiedTask', () => {
      it('should create a unified task', () => {
        const task = createUnifiedTask(
          'Review document',
          'Review and sign the contract',
          'legal',
          'high',
          ['evt-1', 'evt-2'],
          0.85
        );

        expect(task.title).toBe('Review document');
        expect(task.description).toBe('Review and sign the contract');
        expect(task.domain).toBe('legal');
        expect(task.urgency).toBe('high');
        expect(task.sourceEvents).toHaveLength(2);
        expect(task.confidence).toBe(0.85);
      });

      it('should work with all urgency levels', () => {
        const urgencies: UrgencyLevel[] = ['critical', 'high', 'medium', 'low', 'background'];

        urgencies.forEach((urgency) => {
          const task = createUnifiedTask('Task', 'Desc', 'work', urgency, [], 0.5);
          expect(task.urgency).toBe(urgency);
        });
      });
    });

    describe('createProactiveAction', () => {
      it('should create a proactive action with defaults', () => {
        const action = createProactiveAction(
          'reply',
          'agent.comms',
          { draft: 'Hello...' },
          'Client needs response'
        );

        expect(action.type).toBe('reply');
        expect(action.targetAgentId).toBe('agent.comms');
        expect(action.payload).toEqual({ draft: 'Hello...' });
        expect(action.rationale).toBe('Client needs response');
        expect(action.estimatedImpact).toBe('medium'); // default
        expect(action.confidenceRequired).toBe(0.7); // default
        expect(action.executed).toBe(false);
      });

      it('should create action with custom impact and confidence', () => {
        const action = createProactiveAction(
          'escalate',
          'agent.human',
          { priority: 'urgent' },
          'Needs immediate attention',
          'high',
          0.95
        );

        expect(action.estimatedImpact).toBe('high');
        expect(action.confidenceRequired).toBe(0.95);
      });

      it('should work with all action types', () => {
        const actionTypes: ProactiveActionType[] = [
          'reply',
          'create_task',
          'schedule',
          'delegate',
          'archive',
          'escalate',
          'research',
          'summarize',
        ];

        actionTypes.forEach((type) => {
          const action = createProactiveAction(type, 'agent.test', {}, 'Reason');
          expect(action.type).toBe(type);
        });
      });
    });
  });

  // ==========================================================================
  // Default Configuration Tests
  // ==========================================================================

  describe('DEFAULT_SYNTHESIS_CONFIG', () => {
    it('should have valid interval', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG.intervalMs).toBe(300000); // 5 minutes
    });

    it('should have valid event thresholds', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG.minEventsForSynthesis).toBe(3);
      expect(DEFAULT_SYNTHESIS_CONFIG.maxEventsPerPass).toBe(50);
    });

    it('should have valid confidence thresholds', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG.confidenceThresholds.autoExecute).toBe(0.9);
      expect(DEFAULT_SYNTHESIS_CONFIG.confidenceThresholds.propose).toBe(0.6);
      expect(DEFAULT_SYNTHESIS_CONFIG.confidenceThresholds.refine).toBe(0.4);
    });

    it('should be disabled by default', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG.enabled).toBe(false);
    });

    it('should have LLM configuration', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG.llmModel).toContain('anthropic');
      expect(DEFAULT_SYNTHESIS_CONFIG.maxTokens).toBe(4000);
      expect(DEFAULT_SYNTHESIS_CONFIG.temperature).toBe(0.3);
    });

    it('should have ascending confidence thresholds', () => {
      const { refine, propose, autoExecute } = DEFAULT_SYNTHESIS_CONFIG.confidenceThresholds;
      expect(refine).toBeLessThan(propose);
      expect(propose).toBeLessThan(autoExecute);
    });
  });
});
