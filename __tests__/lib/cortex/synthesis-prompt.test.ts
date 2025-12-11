// @ts-nocheck
/**
 * Tests for Synthesis Prompt Builder
 *
 * Tests the prompt construction system for the cognitive synthesis engine
 * that processes events from multiple sources into unified tasks.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Import after mocks
import {
  SYNTHESIS_SYSTEM_PROMPT,
  formatEventsForPrompt,
  formatTasksForPrompt,
  formatPatternsForPrompt,
  buildSynthesisPrompt,
  type SynthesisContext,
} from '../../../lib/cortex/synthesis-prompt';

import type {
  WorkingMemoryEvent,
  UnifiedTask,
  SynthesisPattern,
} from '../../../lib/cortex/types';

describe('Synthesis Prompt Builder', () => {
  // ==========================================================================
  // System Prompt Tests
  // ==========================================================================

  describe('SYNTHESIS_SYSTEM_PROMPT', () => {
    it('should be defined and non-empty', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toBeDefined();
      expect(SYNTHESIS_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('should describe the Synthesis Cortex role', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('Synthesis Cortex');
    });

    it('should mention holistic thinking guidelines', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('HOLISTICALLY');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('NOT LINEARLY');
    });

    it('should mention event consolidation', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('CONSOLIDATE');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('related events');
    });

    it('should mention confidence thresholds', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('AUTO_EXECUTE');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('confidence');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('0.85');
    });

    it('should mention learned patterns', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('LEARNED PATTERNS');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('preferences');
    });

    it('should mention JSON output format', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('JSON');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('SynthesisResult');
    });

    it('should list event sources', () => {
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('Limitless');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('email');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('iMessage');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('calendar');
      expect(SYNTHESIS_SYSTEM_PROMPT).toContain('GitHub');
    });
  });

  // ==========================================================================
  // SynthesisContext Tests
  // ==========================================================================

  describe('SynthesisContext', () => {
    it('should allow empty context', () => {
      const context: SynthesisContext = {};
      expect(context).toBeDefined();
    });

    it('should allow current focus domain', () => {
      const context: SynthesisContext = {
        currentFocusDomain: 'finance',
      };
      expect(context.currentFocusDomain).toBe('finance');
    });

    it('should allow priority contacts', () => {
      const context: SynthesisContext = {
        priorityContacts: ['John Smith', 'Jane Doe'],
      };
      expect(context.priorityContacts).toHaveLength(2);
    });

    it('should allow recent corrections', () => {
      const context: SynthesisContext = {
        recentCorrections: ['Should not auto-archive meeting notes'],
      };
      expect(context.recentCorrections).toHaveLength(1);
    });

    it('should allow all fields', () => {
      const context: SynthesisContext = {
        currentFocusDomain: 'legal',
        priorityContacts: ['Attorney'],
        recentCorrections: ['Be more careful with legal documents'],
      };
      expect(context.currentFocusDomain).toBe('legal');
      expect(context.priorityContacts).toHaveLength(1);
      expect(context.recentCorrections).toHaveLength(1);
    });
  });

  // ==========================================================================
  // formatEventsForPrompt Tests
  // ==========================================================================

  describe('formatEventsForPrompt', () => {
    it('should handle empty events array', () => {
      const result = formatEventsForPrompt([]);
      expect(result).toBe('No events in buffer.');
    });

    it('should format single event', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Hello, this is a test email message.',
          contentHash: 'hash123',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('EVENTS IN WORKING MEMORY (1 total)');
      expect(result).toContain('[1]');
      expect(result).toContain('EMAIL');
      expect(result).toContain('PENDING');
      expect(result).toContain('Hello, this is a test email message');
    });

    it('should format multiple events', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Email content',
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
        {
          id: 'evt-2',
          source: 'calendar',
          timestamp: '2025-01-15T11:00:00Z',
          content: 'Calendar event',
          contentHash: 'hash2',
          processedBySynthesis: true,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('EVENTS IN WORKING MEMORY (2 total)');
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('EMAIL');
      expect(result).toContain('CALENDAR');
      expect(result).toContain('○ PENDING');
      expect(result).toContain('✓ PROCESSED');
    });

    it('should include event classification when available', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Important email',
          contentHash: 'hash1',
          processedBySynthesis: false,
          initialClassification: {
            domain: 'finance',
            urgency: 'high',
            keywords: ['payment', 'urgent'],
          },
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('[FINANCE]');
      expect(result).toContain('[HIGH]');
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(200);
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: longContent,
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('...');
      // Should not contain the full 200 characters
      expect(result.indexOf(longContent)).toBe(-1);
    });

    it('should show event ID', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'unique-event-id-123',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Content',
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('ID: unique-event-id-123');
    });

    it('should handle unclassified events', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:30:00Z',
          content: 'Content',
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('[UNCLASSIFIED]');
    });
  });

  // ==========================================================================
  // formatTasksForPrompt Tests
  // ==========================================================================

  describe('formatTasksForPrompt', () => {
    it('should handle empty tasks array', () => {
      const result = formatTasksForPrompt([]);
      expect(result).toBe('No existing tasks.');
    });

    it('should format single task', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Follow up on client proposal',
          description: 'Client sent proposal, need to review and respond',
          confidence: 0.85,
          urgency: 'high',
          domain: 'business',
          sourceEvents: ['evt-1', 'evt-2'],
          status: 'ready',
          createdAt: '2025-01-15T09:00:00Z',
          refinementCount: 2,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('EXISTING TASKS (1 total)');
      expect(result).toContain('[1]');
      expect(result).toContain('READY');
      expect(result).toContain('BUSINESS');
      expect(result).toContain('85%');
      expect(result).toContain('task-1');
      expect(result).toContain('Follow up on client proposal');
      expect(result).toContain('HIGH');
      expect(result).toContain('2 events');
      expect(result).toContain('Refinements: 2');
    });

    it('should format task with deadline', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Submit report',
          description: 'Monthly report due',
          confidence: 0.9,
          urgency: 'critical',
          domain: 'work',
          sourceEvents: ['evt-1'],
          status: 'approved',
          createdAt: '2025-01-15T09:00:00Z',
          deadline: '2025-01-20T17:00:00Z',
          refinementCount: 0,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('Deadline:');
      expect(result).toContain('Jan');
      expect(result).toContain('20');
    });

    it('should format task with proposed action', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Reply to email',
          description: 'Need to respond to client',
          confidence: 0.8,
          urgency: 'medium',
          domain: 'business',
          sourceEvents: ['evt-1'],
          status: 'ready',
          createdAt: '2025-01-15T09:00:00Z',
          refinementCount: 1,
          proposedAction: {
            type: 'reply',
            targetAgentId: 'agent.comms',
            payload: { draft: 'Draft reply...' },
            confidenceRequired: 0.9,
            estimatedImpact: 'high',
            rationale: 'Client is waiting for response',
            executed: false,
          },
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('Action: reply');
      expect(result).toContain('agent.comms');
    });

    it('should format task with last refined date', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Test task',
          description: 'Description',
          confidence: 0.7,
          urgency: 'low',
          domain: 'personal',
          sourceEvents: ['evt-1'],
          status: 'synthesizing',
          createdAt: '2025-01-10T09:00:00Z',
          lastRefinedAt: '2025-01-15T14:30:00Z',
          refinementCount: 3,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('Last Refined:');
      expect(result).not.toContain('Never');
    });

    it('should show Never for task without refinement', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'New task',
          description: 'Just created',
          confidence: 0.6,
          urgency: 'medium',
          domain: 'work',
          sourceEvents: ['evt-1'],
          status: 'synthesizing',
          createdAt: '2025-01-15T09:00:00Z',
          refinementCount: 0,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('Last Refined: Never');
    });

    it('should truncate long descriptions', () => {
      const longDescription = 'A'.repeat(250);
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Task',
          description: longDescription,
          confidence: 0.7,
          urgency: 'medium',
          domain: 'work',
          sourceEvents: ['evt-1'],
          status: 'ready',
          createdAt: '2025-01-15T09:00:00Z',
          refinementCount: 0,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('...');
    });
  });

  // ==========================================================================
  // formatPatternsForPrompt Tests
  // ==========================================================================

  describe('formatPatternsForPrompt', () => {
    it('should handle empty patterns array', () => {
      const result = formatPatternsForPrompt([]);
      expect(result).toBe('No learned patterns yet.');
    });

    it('should format single pattern', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'consolidation',
          description: 'Combine meeting emails with calendar events',
          triggerConditions: {
            sources: ['email', 'calendar'],
            keywords: ['meeting', 'schedule'],
          },
          suggestedBehavior: {
            consolidateEvents: true,
            urgencyOverride: 'high',
          },
          successRate: 0.85,
          usageCount: 10,
          learnedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('LEARNED PATTERNS (1 total)');
      expect(result).toContain('[1]');
      expect(result).toContain('CONSOLIDATION');
      expect(result).toContain('Success Rate: 85%');
      expect(result).toContain('10 uses');
      expect(result).toContain('Combine meeting emails');
    });

    it('should format pattern with single use', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'urgency',
          description: 'New pattern',
          triggerConditions: {},
          suggestedBehavior: {},
          successRate: 1.0,
          usageCount: 1,
          learnedAt: '2025-01-15T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('1 use');
      expect(result).not.toContain('1 uses');
    });

    it('should format trigger conditions', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'action',
          description: 'Auto-archive newsletters',
          triggerConditions: {
            sources: ['email'],
            keywords: ['newsletter', 'unsubscribe'],
            temporalWindow: 3600000, // 1 hour
            minEventCount: 3,
            customCondition: 'Multiple newsletter emails in short time',
          },
          suggestedBehavior: {
            proposedActionType: 'archive',
          },
          successRate: 0.95,
          usageCount: 50,
          learnedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('Sources: email');
      expect(result).toContain('Keywords: newsletter, unsubscribe');
      expect(result).toContain('Within: 60 minutes');
      expect(result).toContain('Min Events: 3');
      expect(result).toContain('Condition: Multiple newsletter');
    });

    it('should format suggested behaviors', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'consolidation',
          description: 'Meeting preparation pattern',
          triggerConditions: {},
          suggestedBehavior: {
            consolidateEvents: true,
            urgencyOverride: 'critical',
            domainOverride: 'work',
            proposedActionType: 'create_task',
            customGuidance: 'Create preparation task with checklist',
          },
          successRate: 0.9,
          usageCount: 20,
          learnedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('Consolidate related events');
      expect(result).toContain('Override urgency → critical');
      expect(result).toContain('Override domain → work');
      expect(result).toContain('Suggest action: create_task');
      expect(result).toContain('Guidance: Create preparation task');
    });

    it('should format multiple patterns', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'consolidation',
          description: 'Pattern 1',
          triggerConditions: {},
          suggestedBehavior: {},
          successRate: 0.8,
          usageCount: 5,
          learnedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'pat-2',
          patternType: 'urgency',
          description: 'Pattern 2',
          triggerConditions: {},
          suggestedBehavior: {},
          successRate: 0.9,
          usageCount: 10,
          learnedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('LEARNED PATTERNS (2 total)');
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('Pattern 1');
      expect(result).toContain('Pattern 2');
    });
  });

  // ==========================================================================
  // buildSynthesisPrompt Tests
  // ==========================================================================

  describe('buildSynthesisPrompt', () => {
    const sampleEvents: WorkingMemoryEvent[] = [
      {
        id: 'evt-1',
        source: 'email',
        timestamp: '2025-01-15T10:00:00Z',
        content: 'Important meeting follow-up needed',
        contentHash: 'hash1',
        processedBySynthesis: false,
      },
    ];

    const sampleTasks: UnifiedTask[] = [
      {
        id: 'task-1',
        title: 'Existing task',
        description: 'Description',
        confidence: 0.8,
        urgency: 'medium',
        domain: 'work',
        sourceEvents: ['evt-0'],
        status: 'ready',
        createdAt: '2025-01-14T00:00:00Z',
        refinementCount: 1,
      },
    ];

    const samplePatterns: SynthesisPattern[] = [
      {
        id: 'pat-1',
        patternType: 'consolidation',
        description: 'Test pattern',
        triggerConditions: {},
        suggestedBehavior: {},
        successRate: 0.9,
        usageCount: 5,
        learnedAt: '2025-01-01T00:00:00Z',
      },
    ];

    it('should build prompt with header', () => {
      const prompt = buildSynthesisPrompt([], [], []);

      expect(prompt).toContain('COGNITIVE SYNTHESIS REQUEST');
    });

    it('should include events section', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], []);

      expect(prompt).toContain('EVENTS IN WORKING MEMORY');
      expect(prompt).toContain('Important meeting follow-up');
    });

    it('should include tasks section when provided', () => {
      const prompt = buildSynthesisPrompt([], sampleTasks, []);

      expect(prompt).toContain('EXISTING TASKS');
      expect(prompt).toContain('Existing task');
    });

    it('should include patterns section when provided', () => {
      const prompt = buildSynthesisPrompt([], [], samplePatterns);

      expect(prompt).toContain('LEARNED PATTERNS');
      expect(prompt).toContain('Test pattern');
    });

    it('should include synthesis instructions', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], []);

      expect(prompt).toContain('SYNTHESIS INSTRUCTIONS');
      expect(prompt).toContain('STEP 1: HOLISTIC SCAN');
      expect(prompt).toContain('STEP 2: SYNTHESIZE UNIFIED TASKS');
      expect(prompt).toContain('STEP 3: REFINE EXISTING TASKS');
      expect(prompt).toContain('STEP 4: PROPOSE ACTIONS');
      expect(prompt).toContain('STEP 5: IDENTIFY NEW PATTERNS');
    });

    it('should include JSON output schema', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], []);

      expect(prompt).toContain('REQUIRED JSON OUTPUT');
      expect(prompt).toContain('synthesis_summary');
      expect(prompt).toContain('unified_tasks');
      expect(prompt).toContain('task_updates');
      expect(prompt).toContain('proposed_actions');
      expect(prompt).toContain('new_patterns');
      expect(prompt).toContain('events_fully_processed');
      expect(prompt).toContain('needs_more_context');
    });

    it('should include critical reminders', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], []);

      expect(prompt).toContain('CRITICAL REMINDERS');
      expect(prompt).toContain('holistically');
      expect(prompt).toContain('Consolidate');
      expect(prompt).toContain('auto-execute');
      expect(prompt).toContain('learned patterns');
    });

    it('should end with BEGIN SYNTHESIS NOW', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], []);

      expect(prompt).toContain('BEGIN SYNTHESIS NOW');
    });

    describe('with context', () => {
      it('should include current focus domain', () => {
        const context: SynthesisContext = {
          currentFocusDomain: 'finance',
        };

        const prompt = buildSynthesisPrompt(sampleEvents, [], [], context);

        expect(prompt).toContain('USER CONTEXT');
        expect(prompt).toContain('Current Focus Domain: FINANCE');
      });

      it('should include priority contacts', () => {
        const context: SynthesisContext = {
          priorityContacts: ['John Smith', 'Jane Doe', 'Bob Wilson'],
        };

        const prompt = buildSynthesisPrompt(sampleEvents, [], [], context);

        expect(prompt).toContain('Priority Contacts:');
        expect(prompt).toContain('John Smith');
        expect(prompt).toContain('Jane Doe');
        expect(prompt).toContain('Bob Wilson');
      });

      it('should truncate long priority contacts list', () => {
        const context: SynthesisContext = {
          priorityContacts: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        };

        const prompt = buildSynthesisPrompt(sampleEvents, [], [], context);

        expect(prompt).toContain('(+3 more)');
      });

      it('should include recent corrections', () => {
        const context: SynthesisContext = {
          recentCorrections: [
            'Should not auto-archive client emails',
            'Legal documents are always high priority',
          ],
        };

        const prompt = buildSynthesisPrompt(sampleEvents, [], [], context);

        expect(prompt).toContain('Recent Corrections');
        expect(prompt).toContain('auto-archive');
        expect(prompt).toContain('Legal documents');
      });

      it('should include all context elements', () => {
        const context: SynthesisContext = {
          currentFocusDomain: 'legal',
          priorityContacts: ['Attorney Jones'],
          recentCorrections: ['Be careful with contracts'],
        };

        const prompt = buildSynthesisPrompt(sampleEvents, [], [], context);

        expect(prompt).toContain('LEGAL');
        expect(prompt).toContain('Attorney Jones');
        expect(prompt).toContain('Be careful with contracts');
      });
    });

    it('should combine all sections correctly', () => {
      const context: SynthesisContext = {
        currentFocusDomain: 'work',
      };

      const prompt = buildSynthesisPrompt(
        sampleEvents,
        sampleTasks,
        samplePatterns,
        context
      );

      // Check order of sections
      const headerIndex = prompt.indexOf('COGNITIVE SYNTHESIS REQUEST');
      const contextIndex = prompt.indexOf('USER CONTEXT');
      const eventsIndex = prompt.indexOf('EVENTS IN WORKING MEMORY');
      const tasksIndex = prompt.indexOf('EXISTING TASKS');
      const patternsIndex = prompt.indexOf('LEARNED PATTERNS');
      const instructionsIndex = prompt.indexOf('SYNTHESIS INSTRUCTIONS');
      const jsonIndex = prompt.indexOf('REQUIRED JSON OUTPUT');

      expect(headerIndex).toBeLessThan(contextIndex);
      expect(contextIndex).toBeLessThan(eventsIndex);
      expect(eventsIndex).toBeLessThan(tasksIndex);
      expect(tasksIndex).toBeLessThan(patternsIndex);
      expect(patternsIndex).toBeLessThan(instructionsIndex);
      expect(instructionsIndex).toBeLessThan(jsonIndex);
    });

    it('should handle empty context', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], [], {});

      expect(prompt).not.toContain('USER CONTEXT');
    });

    it('should skip tasks section when empty', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, [], samplePatterns);

      expect(prompt).not.toContain('EXISTING TASKS');
      expect(prompt).toContain('LEARNED PATTERNS');
    });

    it('should skip patterns section when empty', () => {
      const prompt = buildSynthesisPrompt(sampleEvents, sampleTasks, []);

      expect(prompt).toContain('EXISTING TASKS');
      expect(prompt).not.toContain('LEARNED PATTERNS');
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle events with special characters in content', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:00:00Z',
          content: "Content with 'quotes', \"double quotes\", <html>, and émojis 🎉",
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      expect(result).toContain('quotes');
      expect(result).toContain('html');
    });

    it('should handle events with newlines in content', () => {
      const events: WorkingMemoryEvent[] = [
        {
          id: 'evt-1',
          source: 'email',
          timestamp: '2025-01-15T10:00:00Z',
          content: 'Line 1\nLine 2\nLine 3',
          contentHash: 'hash1',
          processedBySynthesis: false,
        },
      ];

      const result = formatEventsForPrompt(events);

      // Newlines should be replaced with spaces
      expect(result).toContain('Line 1 Line 2 Line 3');
    });

    it('should handle tasks with minimum required fields', () => {
      const tasks: UnifiedTask[] = [
        {
          id: 'task-1',
          title: 'Minimal',
          description: 'Desc',
          confidence: 0.5,
          urgency: 'low',
          domain: 'personal',
          sourceEvents: [],
          status: 'synthesizing',
          createdAt: '2025-01-15T00:00:00Z',
          refinementCount: 0,
        },
      ];

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('Minimal');
      expect(result).toContain('0 events');
    });

    it('should handle pattern with empty trigger conditions', () => {
      const patterns: SynthesisPattern[] = [
        {
          id: 'pat-1',
          patternType: 'sequence',
          description: 'Empty conditions',
          triggerConditions: {},
          suggestedBehavior: {},
          successRate: 0.5,
          usageCount: 1,
          learnedAt: '2025-01-15T00:00:00Z',
        },
      ];

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('Triggers: None');
      expect(result).toContain('Behavior: None');
    });

    it('should handle very large number of events', () => {
      const events: WorkingMemoryEvent[] = [];
      for (let i = 0; i < 100; i++) {
        events.push({
          id: `evt-${i}`,
          source: 'email',
          timestamp: '2025-01-15T10:00:00Z',
          content: `Event ${i} content`,
          contentHash: `hash${i}`,
          processedBySynthesis: false,
        });
      }

      const result = formatEventsForPrompt(events);

      expect(result).toContain('EVENTS IN WORKING MEMORY (100 total)');
      expect(result).toContain('[100]');
    });

    it('should handle all event sources', () => {
      const sources = ['limitless', 'email', 'imessage', 'calendar', 'github', 'slack', 'motion', 'whoop'];

      const events: WorkingMemoryEvent[] = sources.map((source, i) => ({
        id: `evt-${i}`,
        source: source as any,
        timestamp: '2025-01-15T10:00:00Z',
        content: `Content from ${source}`,
        contentHash: `hash${i}`,
        processedBySynthesis: false,
      }));

      const result = formatEventsForPrompt(events);

      expect(result).toContain('LIMITLESS');
      expect(result).toContain('EMAIL');
      expect(result).toContain('IMESSAGE');
      expect(result).toContain('CALENDAR');
      expect(result).toContain('GITHUB');
      expect(result).toContain('SLACK');
      expect(result).toContain('MOTION');
      expect(result).toContain('WHOOP');
    });

    it('should handle all urgency levels', () => {
      const urgencyLevels = ['critical', 'high', 'medium', 'low', 'background'];

      const tasks: UnifiedTask[] = urgencyLevels.map((urgency, i) => ({
        id: `task-${i}`,
        title: `${urgency} task`,
        description: 'Description',
        confidence: 0.8,
        urgency: urgency as any,
        domain: 'work',
        sourceEvents: [],
        status: 'ready',
        createdAt: '2025-01-15T00:00:00Z',
        refinementCount: 0,
      }));

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('CRITICAL');
      expect(result).toContain('HIGH');
      expect(result).toContain('MEDIUM');
      expect(result).toContain('LOW');
      expect(result).toContain('BACKGROUND');
    });

    it('should handle all task statuses', () => {
      const statuses = ['synthesizing', 'ready', 'approved', 'executing', 'completed', 'dismissed'];

      const tasks: UnifiedTask[] = statuses.map((status, i) => ({
        id: `task-${i}`,
        title: `${status} task`,
        description: 'Description',
        confidence: 0.8,
        urgency: 'medium',
        domain: 'work',
        sourceEvents: [],
        status: status as any,
        createdAt: '2025-01-15T00:00:00Z',
        refinementCount: 0,
      }));

      const result = formatTasksForPrompt(tasks);

      expect(result).toContain('SYNTHESIZING');
      expect(result).toContain('READY');
      expect(result).toContain('APPROVED');
      expect(result).toContain('EXECUTING');
      expect(result).toContain('COMPLETED');
      expect(result).toContain('DISMISSED');
    });

    it('should handle all pattern types', () => {
      const patternTypes = ['consolidation', 'urgency', 'action', 'relationship', 'sequence'];

      const patterns: SynthesisPattern[] = patternTypes.map((type, i) => ({
        id: `pat-${i}`,
        patternType: type as any,
        description: `${type} pattern`,
        triggerConditions: {},
        suggestedBehavior: {},
        successRate: 0.8,
        usageCount: 5,
        learnedAt: '2025-01-15T00:00:00Z',
      }));

      const result = formatPatternsForPrompt(patterns);

      expect(result).toContain('CONSOLIDATION');
      expect(result).toContain('URGENCY');
      expect(result).toContain('ACTION');
      expect(result).toContain('RELATIONSHIP');
      expect(result).toContain('SEQUENCE');
    });
  });
});
