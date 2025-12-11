// @ts-nocheck
/**
 * Tests for Decision Queue System
 *
 * Tests the decision queue that manages items requiring human decision
 * when the LLM cannot determine appropriate action.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock database
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => ({
    getRawDb: () => mockDb,
  })),
}));

// Import after mocks
import {
  DecisionQueue,
  getDecisionQueue,
  resetDecisionQueue,
  escalateToDecision,
  type DecisionReason,
  type DecisionStatus,
  type DecisionOption,
  type PendingDecision,
  type CreateDecisionInput,
  type ResolveDecisionInput,
} from '../../../lib/cortex/decision-queue';

describe('Decision Queue System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDecisionQueue();
  });

  afterEach(() => {
    resetDecisionQueue();
  });

  // ==========================================================================
  // Type Definitions Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    describe('DecisionReason', () => {
      it('should accept valid decision reasons', () => {
        const validReasons: DecisionReason[] = [
          'ambiguous_intent',
          'conflicting_priorities',
          'missing_context',
          'multiple_options',
          'unclear_expectations',
          'no_precedent',
          'irreversible_action',
          'low_confidence',
          'other',
        ];
        expect(validReasons).toHaveLength(9);
      });
    });

    describe('DecisionStatus', () => {
      it('should accept valid decision statuses', () => {
        const validStatuses: DecisionStatus[] = [
          'pending',
          'presented',
          'resolved',
          'expired',
          'auto_resolved',
        ];
        expect(validStatuses).toHaveLength(5);
      });
    });

    describe('DecisionOption', () => {
      it('should define a valid decision option structure', () => {
        const option: DecisionOption = {
          id: 'opt-1',
          label: 'Accept offer',
          description: 'Accept the business offer and proceed',
          action: 'accept_offer',
          confidence: 0.8,
          recommended: true,
          payload: { offerId: '123' },
        };
        expect(option.id).toBe('opt-1');
        expect(option.confidence).toBe(0.8);
        expect(option.recommended).toBe(true);
      });

      it('should allow option without optional fields', () => {
        const option: DecisionOption = {
          id: 'opt-2',
          label: 'Decline',
          description: 'Decline the offer',
          action: 'decline',
          confidence: 0.6,
        };
        expect(option.payload).toBeUndefined();
        expect(option.recommended).toBeUndefined();
      });
    });

    describe('PendingDecision', () => {
      it('should define a valid pending decision structure', () => {
        const decision: PendingDecision = {
          id: 'dec-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          status: 'pending',
          domain: 'business',
          reason: 'multiple_options',
          priority: 'high',
          title: 'Contract Decision',
          summary: 'Need to decide on contract terms',
          context: 'Client offered two options...',
          sourceEventIds: ['evt-1', 'evt-2'],
          options: [],
        };
        expect(decision.status).toBe('pending');
        expect(decision.priority).toBe('high');
      });

      it('should include resolution fields when resolved', () => {
        const decision: PendingDecision = {
          id: 'dec-2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          status: 'resolved',
          domain: 'personal',
          reason: 'ambiguous_intent',
          priority: 'medium',
          title: 'Resolved Decision',
          summary: 'This was resolved',
          context: 'Context here',
          sourceEventIds: [],
          options: [],
          resolvedAt: '2025-01-02T00:00:00Z',
          resolvedBy: 'user',
          selectedOptionId: 'opt-1',
          userFeedback: 'Good suggestion',
        };
        expect(decision.resolvedBy).toBe('user');
        expect(decision.userFeedback).toBe('Good suggestion');
      });
    });

    describe('CreateDecisionInput', () => {
      it('should define valid creation input', () => {
        const input: CreateDecisionInput = {
          domain: 'work',
          reason: 'conflicting_priorities',
          priority: 'critical',
          title: 'Urgent Decision',
          summary: 'Need immediate attention',
          context: 'Two meetings at same time',
          sourceEventIds: ['evt-1'],
          options: [
            { label: 'Option A', description: 'Do A', action: 'do_a', confidence: 0.7 },
            { label: 'Option B', description: 'Do B', action: 'do_b', confidence: 0.5 },
          ],
          llmAnalysis: 'LLM thinks option A is better',
          metadata: { urgency: 'high' },
        };
        expect(input.options).toHaveLength(2);
        expect(input.priority).toBe('critical');
      });

      it('should allow minimal creation input', () => {
        const input: CreateDecisionInput = {
          domain: 'personal',
          reason: 'other',
          title: 'Simple Decision',
          summary: 'Basic summary',
          context: 'Basic context',
          options: [{ label: 'Only Option', description: 'Desc', action: 'act', confidence: 1.0 }],
        };
        expect(input.priority).toBeUndefined();
        expect(input.sourceEventIds).toBeUndefined();
      });
    });

    describe('ResolveDecisionInput', () => {
      it('should define valid resolution input', () => {
        const input: ResolveDecisionInput = {
          decisionId: 'dec-1',
          selectedOptionId: 'opt-1',
          userFeedback: 'This was the right choice',
        };
        expect(input.decisionId).toBe('dec-1');
      });

      it('should allow resolution without feedback', () => {
        const input: ResolveDecisionInput = {
          decisionId: 'dec-2',
          selectedOptionId: 'opt-2',
        };
        expect(input.userFeedback).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // DecisionQueue Class Tests
  // ==========================================================================

  describe('DecisionQueue Class', () => {
    let queue: DecisionQueue;

    beforeEach(() => {
      queue = new DecisionQueue();
    });

    describe('constructor', () => {
      it('should create decision queue and ensure table exists', () => {
        expect(mockDb.exec).toHaveBeenCalled();
        const execCall = mockDb.exec.mock.calls[0][0];
        expect(execCall).toContain('CREATE TABLE IF NOT EXISTS pending_decisions');
        expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_pd_status');
        expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_pd_domain');
        expect(execCall).toContain('CREATE INDEX IF NOT EXISTS idx_pd_priority');
      });
    });

    describe('addDecision', () => {
      it('should add a new pending decision', async () => {
        const input: CreateDecisionInput = {
          domain: 'business',
          reason: 'multiple_options',
          priority: 'high',
          title: 'Contract Terms',
          summary: 'Decide on contract terms',
          context: 'Client sent two proposals',
          options: [
            { label: 'Accept A', description: 'Accept proposal A', action: 'accept_a', confidence: 0.8 },
            { label: 'Accept B', description: 'Accept proposal B', action: 'accept_b', confidence: 0.6 },
          ],
        };

        const id = await queue.addDecision(input);

        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should use default priority when not specified', async () => {
        const input: CreateDecisionInput = {
          domain: 'personal',
          reason: 'ambiguous_intent',
          title: 'Test Decision',
          summary: 'Summary',
          context: 'Context',
          options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
        };

        await queue.addDecision(input);
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should store sourceEventIds and metadata', async () => {
        const input: CreateDecisionInput = {
          domain: 'work',
          reason: 'irreversible_action',
          title: 'Important Action',
          summary: 'Summary',
          context: 'Context',
          sourceEventIds: ['evt-1', 'evt-2', 'evt-3'],
          options: [{ label: 'Proceed', description: 'Do it', action: 'proceed', confidence: 0.9 }],
          llmAnalysis: 'This is a significant action',
          metadata: { source: 'email', importance: 'high' },
        };

        const id = await queue.addDecision(input);
        expect(id).toBeDefined();
      });
    });

    describe('getPendingDecisions', () => {
      it('should get all pending decisions without filters', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'dec-1',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
              status: 'pending',
              domain: 'business',
              reason: 'multiple_options',
              priority: 'medium',
              title: 'Test',
              summary: 'Summary',
              context: 'Context',
              options_json: '[]',
            },
          ]),
        });

        const decisions = await queue.getPendingDecisions();
        expect(Array.isArray(decisions)).toBe(true);
      });

      it('should filter by status', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getPendingDecisions({ status: 'pending' });
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should filter by domain', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getPendingDecisions({ domain: 'business' });
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should filter by priority', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getPendingDecisions({ priority: 'critical' });
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should apply limit', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getPendingDecisions({ limit: 10 });
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should combine multiple filters', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getPendingDecisions({
          status: 'pending',
          domain: 'work',
          priority: 'high',
          limit: 5,
        });
        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });

    describe('getDecision', () => {
      it('should get a decision by ID', async () => {
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({
            id: 'dec-1',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            status: 'pending',
            domain: 'business',
            reason: 'multiple_options',
            priority: 'medium',
            title: 'Test Decision',
            summary: 'Summary',
            context: 'Context',
            options_json: '[{"id":"opt-1","label":"Option 1","description":"Desc","action":"act","confidence":0.8}]',
            source_event_ids_json: '["evt-1"]',
          })),
        });

        const decision = await queue.getDecision('dec-1');
        expect(decision).toBeDefined();
        expect(decision?.id).toBe('dec-1');
      });

      it('should return null for non-existent decision', async () => {
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => null),
        });

        const decision = await queue.getDecision('non-existent');
        expect(decision).toBeNull();
      });
    });

    describe('resolveDecision', () => {
      it('should resolve a pending decision', async () => {
        // Mock for resolve
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(() => ({ changes: 1 })),
        });
        // Mock for getDecision in learnFromResolution
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({
            id: 'dec-1',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            status: 'resolved',
            domain: 'business',
            reason: 'multiple_options',
            priority: 'medium',
            title: 'Test',
            summary: 'Summary',
            context: 'Context',
            options_json: '[{"id":"opt-1","label":"Option 1","description":"Desc","action":"act","confidence":0.8}]',
            selected_option_id: 'opt-1',
          })),
        });

        const input: ResolveDecisionInput = {
          decisionId: 'dec-1',
          selectedOptionId: 'opt-1',
          userFeedback: 'Good choice',
        };

        await expect(queue.resolveDecision(input)).resolves.not.toThrow();
      });

      it('should throw error for already resolved decision', async () => {
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(() => ({ changes: 0 })),
        });

        const input: ResolveDecisionInput = {
          decisionId: 'already-resolved',
          selectedOptionId: 'opt-1',
        };

        await expect(queue.resolveDecision(input)).rejects.toThrow(
          'Decision already-resolved not found or already resolved'
        );
      });
    });

    describe('markAsPresented', () => {
      it('should mark decisions as presented', async () => {
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(),
        });

        await queue.markAsPresented(['dec-1', 'dec-2', 'dec-3']);
        expect(mockDb.prepare).toHaveBeenCalled();
      });

      it('should do nothing for empty array', async () => {
        await queue.markAsPresented([]);
        // Should not call prepare for update
      });
    });

    describe('autoResolveStale', () => {
      it('should auto-resolve stale decisions with default max age', async () => {
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(() => ({ changes: 3 })),
        });

        const count = await queue.autoResolveStale();
        expect(count).toBe(3);
      });

      it('should auto-resolve with custom max age', async () => {
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(() => ({ changes: 5 })),
        });

        const count = await queue.autoResolveStale(14);
        expect(count).toBe(5);
      });

      it('should return 0 when no stale decisions', async () => {
        mockDb.prepare.mockReturnValueOnce({
          run: jest.fn(() => ({ changes: 0 })),
        });

        const count = await queue.autoResolveStale();
        expect(count).toBe(0);
      });
    });

    describe('getStats', () => {
      it('should return decision statistics', async () => {
        // Mock status counts
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            { status: 'pending', count: 10 },
            { status: 'resolved', count: 50 },
            { status: 'expired', count: 5 },
          ]),
        });
        // Mock domain counts
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            { domain: 'business', count: 6 },
            { domain: 'personal', count: 4 },
          ]),
        });
        // Mock priority counts
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            { priority: 'critical', count: 2 },
            { priority: 'high', count: 3 },
            { priority: 'medium', count: 5 },
          ]),
        });
        // Mock avg resolution time
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ avg_ms: 86400000 })),
        });

        const stats = await queue.getStats();

        expect(stats.total).toBe(65);
        expect(stats.pending).toBe(10);
        expect(stats.resolved).toBe(50);
        expect(stats.expired).toBe(5);
        expect(stats.byDomain).toEqual({ business: 6, personal: 4 });
        expect(stats.byPriority).toEqual({ critical: 2, high: 3, medium: 5 });
        expect(stats.avgResolutionTimeMs).toBe(86400000);
      });

      it('should handle empty stats', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });
        mockDb.prepare.mockReturnValueOnce({
          get: jest.fn(() => ({ avg_ms: null })),
        });

        const stats = await queue.getStats();

        expect(stats.total).toBe(0);
        expect(stats.pending).toBe(0);
        expect(stats.avgResolutionTimeMs).toBeNull();
      });
    });

    describe('getForDailyDigest', () => {
      it('should get pending decisions for daily digest', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'dec-1',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
              status: 'pending',
              domain: 'business',
              reason: 'multiple_options',
              priority: 'high',
              title: 'Important Decision',
              summary: 'Summary',
              context: 'Context',
              options_json: '[]',
            },
          ]),
        });

        const decisions = await queue.getForDailyDigest();
        expect(Array.isArray(decisions)).toBe(true);
      });
    });

    describe('getResolvedDecisions', () => {
      it('should get resolved decisions with default limit', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => [
            {
              id: 'dec-1',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-02T00:00:00Z',
              status: 'resolved',
              domain: 'business',
              reason: 'multiple_options',
              priority: 'medium',
              title: 'Resolved',
              summary: 'Summary',
              context: 'Context',
              options_json: '[]',
              resolved_at: '2025-01-02T00:00:00Z',
              resolved_by: 'user',
            },
          ]),
        });

        const decisions = await queue.getResolvedDecisions();
        expect(Array.isArray(decisions)).toBe(true);
      });

      it('should get resolved decisions with custom limit', async () => {
        mockDb.prepare.mockReturnValueOnce({
          all: jest.fn(() => []),
        });

        await queue.getResolvedDecisions(50);
        expect(mockDb.prepare).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Singleton Pattern Tests
  // ==========================================================================

  describe('Singleton Pattern', () => {
    beforeEach(() => {
      resetDecisionQueue();
    });

    describe('getDecisionQueue', () => {
      it('should return same instance on multiple calls', () => {
        const instance1 = getDecisionQueue();
        const instance2 = getDecisionQueue();
        expect(instance1).toBe(instance2);
      });

      it('should create new instance after reset', () => {
        const instance1 = getDecisionQueue();
        resetDecisionQueue();
        const instance2 = getDecisionQueue();
        expect(instance1).not.toBe(instance2);
      });
    });

    describe('resetDecisionQueue', () => {
      it('should reset singleton instance', () => {
        const instance1 = getDecisionQueue();
        resetDecisionQueue();
        const instance2 = getDecisionQueue();
        expect(instance1).not.toBe(instance2);
      });
    });
  });

  // ==========================================================================
  // Helper Functions Tests
  // ==========================================================================

  describe('Helper Functions', () => {
    describe('escalateToDecision', () => {
      it('should escalate to decision queue', async () => {
        resetDecisionQueue();

        const decisionId = await escalateToDecision(
          ['evt-1', 'evt-2'],
          'business',
          {
            title: 'Escalated Decision',
            summary: 'Need human input',
            context: 'Complex situation',
            options: [
              { label: 'Option A', description: 'Do A', action: 'do_a', confidence: 0.6 },
              { label: 'Option B', description: 'Do B', action: 'do_b', confidence: 0.4 },
            ],
            reason: 'low_confidence',
            llmAnalysis: 'Not confident enough to decide',
          }
        );

        expect(decisionId).toBeDefined();
        expect(typeof decisionId).toBe('string');
      });

      it('should escalate with minimal analysis', async () => {
        resetDecisionQueue();

        const decisionId = await escalateToDecision(
          [],
          'personal',
          {
            title: 'Simple Escalation',
            summary: 'Summary',
            context: 'Context',
            options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
            reason: 'other',
          }
        );

        expect(decisionId).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Row Conversion Tests
  // ==========================================================================

  describe('Row Conversion', () => {
    it('should convert database row to PendingDecision', async () => {
      const queue = new DecisionQueue();

      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => ({
          id: 'dec-1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'pending',
          domain: 'business',
          reason: 'multiple_options',
          priority: 'high',
          title: 'Test Decision',
          summary: 'This is a summary',
          context: 'This is the context',
          source_event_ids_json: '["evt-1", "evt-2"]',
          options_json: '[{"id":"opt-1","label":"Option 1","description":"Desc","action":"act","confidence":0.8,"recommended":true}]',
          llm_analysis: 'LLM says do this',
          resolved_at: null,
          resolved_by: null,
          selected_option_id: null,
          user_feedback: null,
          metadata_json: '{"key":"value"}',
        })),
      });

      const decision = await queue.getDecision('dec-1');

      expect(decision).not.toBeNull();
      expect(decision?.id).toBe('dec-1');
      expect(decision?.createdAt).toBe('2025-01-01T00:00:00Z');
      expect(decision?.status).toBe('pending');
      expect(decision?.domain).toBe('business');
      expect(decision?.reason).toBe('multiple_options');
      expect(decision?.priority).toBe('high');
      expect(decision?.title).toBe('Test Decision');
      expect(decision?.sourceEventIds).toEqual(['evt-1', 'evt-2']);
      expect(decision?.options).toHaveLength(1);
      expect(decision?.options[0].id).toBe('opt-1');
      expect(decision?.options[0].recommended).toBe(true);
      expect(decision?.llmAnalysis).toBe('LLM says do this');
      expect(decision?.metadata).toEqual({ key: 'value' });
    });

    it('should handle null optional fields', async () => {
      const queue = new DecisionQueue();

      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => ({
          id: 'dec-2',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'pending',
          domain: 'personal',
          reason: 'other',
          priority: 'low',
          title: 'Minimal Decision',
          summary: 'Summary',
          context: 'Context',
          source_event_ids_json: null,
          options_json: '[]',
          llm_analysis: null,
          resolved_at: null,
          resolved_by: null,
          selected_option_id: null,
          user_feedback: null,
          metadata_json: null,
        })),
      });

      const decision = await queue.getDecision('dec-2');

      expect(decision?.sourceEventIds).toEqual([]);
      expect(decision?.options).toEqual([]);
      expect(decision?.llmAnalysis).toBeUndefined();
      expect(decision?.resolvedAt).toBeUndefined();
      expect(decision?.metadata).toBeUndefined();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle decision with many options', async () => {
      const queue = new DecisionQueue();
      const manyOptions: Omit<DecisionOption, 'id'>[] = [];
      for (let i = 0; i < 20; i++) {
        manyOptions.push({
          label: `Option ${i}`,
          description: `Description for option ${i}`,
          action: `action_${i}`,
          confidence: Math.random(),
        });
      }

      const input: CreateDecisionInput = {
        domain: 'business',
        reason: 'multiple_options',
        title: 'Many Options Decision',
        summary: 'Has 20 options',
        context: 'Complex scenario',
        options: manyOptions,
      };

      const id = await queue.addDecision(input);
      expect(id).toBeDefined();
    });

    it('should handle very long context', async () => {
      const queue = new DecisionQueue();
      const longContext = 'A'.repeat(10000);

      const input: CreateDecisionInput = {
        domain: 'business',
        reason: 'missing_context',
        title: 'Long Context Decision',
        summary: 'Very long context',
        context: longContext,
        options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
      };

      const id = await queue.addDecision(input);
      expect(id).toBeDefined();
    });

    it('should handle special characters in title and summary', async () => {
      const queue = new DecisionQueue();

      const input: CreateDecisionInput = {
        domain: 'personal',
        reason: 'other',
        title: "Decision with 'quotes' and \"double quotes\" and émojis 🎉",
        summary: 'Summary with newlines\nand\ttabs',
        context: 'Context with <html> and &amp; entities',
        options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
      };

      const id = await queue.addDecision(input);
      expect(id).toBeDefined();
    });

    it('should handle all priority levels', async () => {
      const queue = new DecisionQueue();
      const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = [
        'critical',
        'high',
        'medium',
        'low',
      ];

      for (const priority of priorities) {
        const input: CreateDecisionInput = {
          domain: 'business',
          reason: 'other',
          priority,
          title: `${priority} priority decision`,
          summary: 'Summary',
          context: 'Context',
          options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
        };

        const id = await queue.addDecision(input);
        expect(id).toBeDefined();
      }
    });

    it('should handle all decision reasons', async () => {
      const queue = new DecisionQueue();
      const reasons: DecisionReason[] = [
        'ambiguous_intent',
        'conflicting_priorities',
        'missing_context',
        'multiple_options',
        'unclear_expectations',
        'no_precedent',
        'irreversible_action',
        'low_confidence',
        'other',
      ];

      for (const reason of reasons) {
        const input: CreateDecisionInput = {
          domain: 'business',
          reason,
          title: `${reason} decision`,
          summary: 'Summary',
          context: 'Context',
          options: [{ label: 'Option', description: 'Desc', action: 'act', confidence: 0.5 }],
        };

        const id = await queue.addDecision(input);
        expect(id).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Learning from Resolution Tests
  // ==========================================================================

  describe('Learning from Resolution', () => {
    it('should learn when user selects non-recommended option', async () => {
      const queue = new DecisionQueue();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Mock for resolve
      mockDb.prepare.mockReturnValueOnce({
        run: jest.fn(() => ({ changes: 1 })),
      });
      // Mock for getDecision in learnFromResolution
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => ({
          id: 'dec-1',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'resolved',
          domain: 'business',
          reason: 'multiple_options',
          priority: 'medium',
          title: 'Test',
          summary: 'Summary',
          context: 'Context',
          options_json: JSON.stringify([
            { id: 'opt-1', label: 'Recommended', description: 'Desc', action: 'act1', confidence: 0.9, recommended: true },
            { id: 'opt-2', label: 'Not Recommended', description: 'Desc', action: 'act2', confidence: 0.5, recommended: false },
          ]),
          selected_option_id: 'opt-2',
        })),
      });

      await queue.resolveDecision({
        decisionId: 'dec-1',
        selectedOptionId: 'opt-2',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Learning: User chose')
      );

      consoleSpy.mockRestore();
    });
  });
});
