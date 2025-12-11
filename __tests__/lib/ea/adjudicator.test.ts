/**
 * Adjudicator Tests - High Fidelity
 *
 * Tests for the adjudicator module that routes incoming items
 * to the correct domain agent or disposition.
 *
 * Tests:
 * - adjudicateItem function with various inputs
 * - Preference model integration
 * - Memory context integration
 * - LLM response parsing
 * - Error handling scenarios
 */

import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

// Mock server-only-guard first
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock agent invoker
const mockInvoke = jest.fn();
jest.mock('../../../lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: mockInvoke,
  },
}));

// Mock PM memory
const mockSearchPMMemories = jest.fn();
const mockAddPMMemory = jest.fn();
jest.mock('../../../lib/pm/pm-memory', () => ({
  searchPMMemories: (...args: any[]) => mockSearchPMMemories(...args),
  addPMMemory: (...args: any[]) => mockAddPMMemory(...args),
}));

// Mock preference model
const mockLoadPreferences = jest.fn();
const mockComputeUrgency = jest.fn();
jest.mock('../../../lib/ea/preference-model', () => ({
  loadPreferences: () => mockLoadPreferences(),
  computeUrgency: (...args: any[]) => mockComputeUrgency(...args),
}));

import { adjudicateItem, type AdjudicationResult } from '../../../lib/ea/adjudicator';

// Test directory
const TEST_DIR = join(process.cwd(), '.data', 'test', 'adjudicator-test');

describe('Adjudicator - High Fidelity', () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockLoadPreferences.mockResolvedValue({
      priority_contacts: [],
      current_focus_domain: null,
      corrections_count: 0,
    });

    mockComputeUrgency.mockResolvedValue({
      level: 'medium',
      score: 0.5,
      suggestedAction: 'route',
      factors: [],
      reasoning: 'Default urgency',
    });

    mockSearchPMMemories.mockResolvedValue([]);
    mockAddPMMemory.mockResolvedValue({ id: 'mem-123' });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  // ============================================================================
  // Basic Adjudication Tests
  // ============================================================================

  describe('basic adjudication', () => {
    it('should adjudicate an email and return structured result', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'finance',
          priority: 'high',
          action: 'route',
          target_agent: 'agent.finance',
          reasoning: 'Invoice detected, amount > $500',
          suggested_tags: ['invoice', 'urgent'],
        }),
      });

      const result = await adjudicateItem(
        'Invoice #1234 from Acme Corp. Amount due: $750. Payment due by end of week.',
        'email'
      );

      expect(result.domain).toBe('finance');
      expect(result.priority).toBe('high');
      expect(result.action).toBe('route');
      expect(result.target_agent).toBe('agent.finance');
      expect(result.reasoning).toContain('Invoice');
    });

    it('should handle markdown-wrapped JSON response', async () => {
      mockInvoke.mockResolvedValue({
        content: '```json\n{"domain":"legal","priority":"critical","action":"flag","reasoning":"Contract deadline approaching","suggested_tags":["contract"]}\n```',
      });

      const result = await adjudicateItem(
        'Contract renewal deadline is tomorrow. Please review and sign.',
        'email'
      );

      expect(result.domain).toBe('legal');
      expect(result.priority).toBe('critical');
      expect(result.action).toBe('flag');
    });

    it('should use hint to guide domain routing', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'health',
          priority: 'medium',
          action: 'route',
          target_agent: 'agent.health',
          reasoning: 'User indicated health domain',
          suggested_tags: ['appointment'],
        }),
      });

      const result = await adjudicateItem(
        'Your appointment is confirmed for next Tuesday.',
        'email',
        'Health' // UI hint
      );

      expect(result.domain).toBe('health');
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('User suggests: Health'),
        })
      );
    });

    it('should handle archive action', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'low',
          action: 'archive',
          reasoning: 'Newsletter, no action needed',
          suggested_tags: ['newsletter', 'marketing'],
        }),
      });

      const result = await adjudicateItem(
        'Weekly newsletter from company XYZ with latest updates.',
        'email'
      );

      expect(result.action).toBe('archive');
      // Archive actions should NOT save to memory
      expect(mockAddPMMemory).not.toHaveBeenCalled();
    });

    it('should save non-archive decisions to memory', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'finance',
          priority: 'high',
          action: 'route',
          target_agent: 'agent.finance',
          reasoning: 'Invoice needs payment',
          suggested_tags: ['invoice'],
        }),
      });

      await adjudicateItem('Pay this invoice', 'email');

      // Wait for async memory save
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAddPMMemory).toHaveBeenCalledWith(
        expect.stringContaining('Adjudicated'),
        'decision',
        expect.objectContaining({ source: 'email' })
      );
    });
  });

  // ============================================================================
  // Preference Model Integration Tests
  // ============================================================================

  describe('preference model integration', () => {
    it('should include preference context in prompt when available', async () => {
      mockComputeUrgency.mockResolvedValue({
        level: 'critical',
        score: 0.95,
        suggestedAction: 'escalate',
        factors: [{ description: 'From priority contact' }],
        reasoning: 'CEO email requires immediate attention',
      });

      mockLoadPreferences.mockResolvedValue({
        priority_contacts: [{ identifier: 'ceo@company.com' }],
        current_focus_domain: 'finance',
        corrections_count: 15,
      });

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'critical',
          action: 'flag',
          reasoning: 'Priority contact',
          suggested_tags: ['ceo'],
        }),
      });

      await adjudicateItem('Meeting request from CEO', 'email');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('Computed Urgency: critical'),
        })
      );
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('15 past corrections'),
        })
      );
    });

    it('should continue if preference model fails', async () => {
      mockLoadPreferences.mockRejectedValue(new Error('Preferences unavailable'));

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'medium',
          action: 'route',
          target_agent: 'agent.pm',
          reasoning: 'Fallback routing',
          suggested_tags: [],
        }),
      });

      const result = await adjudicateItem('Some content', 'message');

      expect(result.domain).toBe('general');
      expect(result.action).toBe('route');
    });
  });

  // ============================================================================
  // Memory Context Tests
  // ============================================================================

  describe('memory context integration', () => {
    it('should include memory context in prompt when available', async () => {
      mockSearchPMMemories.mockResolvedValue([
        { text: 'Route invoices over $500 to finance agent' },
        { text: 'Legal documents should be flagged for review' },
      ]);

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'finance',
          priority: 'high',
          action: 'route',
          target_agent: 'agent.finance',
          reasoning: 'Based on past routing rules',
          suggested_tags: ['invoice'],
        }),
      });

      await adjudicateItem('Invoice for $1000', 'email');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('Route invoices over $500'),
        })
      );
    });

    it('should continue if memory search fails', async () => {
      mockSearchPMMemories.mockRejectedValue(new Error('Zep unavailable'));

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'medium',
          action: 'route',
          reasoning: 'Default routing',
          suggested_tags: [],
        }),
      });

      const result = await adjudicateItem('Some content', 'email');

      expect(result.domain).toBe('general');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should return fallback result on JSON parse error', async () => {
      mockInvoke.mockResolvedValue({
        content: 'This is not valid JSON at all',
      });

      const result = await adjudicateItem('Some content', 'email');

      expect(result.domain).toBe('general');
      expect(result.priority).toBe('medium');
      expect(result.action).toBe('flag');
      expect(result.reasoning).toContain('failed to produce structured output');
      expect(result.suggested_tags).toContain('error');
    });

    it('should return system error result on agent invocation failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Agent timeout'));

      const result = await adjudicateItem('Some content', 'email');

      expect(result.domain).toBe('system');
      expect(result.priority).toBe('high');
      expect(result.action).toBe('flag');
      expect(result.reasoning).toContain('System Error');
      expect(result.suggested_tags).toContain('system_error');
    });

    it('should handle truncated JSON response gracefully', async () => {
      mockInvoke.mockResolvedValue({
        content: '{"domain":"finance","priority":', // Truncated
      });

      const result = await adjudicateItem('Invoice', 'email');

      // Should fallback to error result
      expect(result.action).toBe('flag');
      expect(result.suggested_tags).toContain('error');
    });
  });

  // ============================================================================
  // Agent Invocation Tests
  // ============================================================================

  describe('agent invocation', () => {
    it('should invoke with correct agent ID and model', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'medium',
          action: 'archive',
          reasoning: 'Test',
          suggested_tags: [],
        }),
      });

      await adjudicateItem('Test content', 'email');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent.ea',
          providerOverride: 'openai',
          modelOverride: 'gpt-5.1',
          context: expect.objectContaining({
            skipMemory: true,
            metadata: { op: 'adjudication' },
          }),
        })
      );
    });

    it('should include source in prompt', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'low',
          action: 'archive',
          reasoning: 'Test',
          suggested_tags: [],
        }),
      });

      await adjudicateItem('Message content', 'imessage');

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.stringContaining('ITEM SOURCE: imessage'),
        })
      );
    });

    it('should truncate very long content', async () => {
      const longContent = 'A'.repeat(3000); // 3000 chars

      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'medium',
          action: 'flag',
          reasoning: 'Long content',
          suggested_tags: [],
        }),
      });

      await adjudicateItem(longContent, 'email');

      // Content should be truncated to 2000 chars
      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: expect.not.stringContaining('A'.repeat(2100)),
        })
      );
    });
  });

  // ============================================================================
  // Action Types Tests
  // ============================================================================

  describe('action types', () => {
    it('should handle route action', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'legal',
          priority: 'high',
          action: 'route',
          target_agent: 'agent.legal',
          reasoning: 'Contract requires legal review',
          suggested_tags: ['contract', 'review'],
        }),
      });

      const result = await adjudicateItem('Please review this contract', 'email');

      expect(result.action).toBe('route');
      expect(result.target_agent).toBe('agent.legal');
    });

    it('should handle reply action', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'medium',
          action: 'reply',
          reasoning: 'Quick response needed',
          suggested_tags: ['respond'],
        }),
      });

      const result = await adjudicateItem('Can you confirm attendance?', 'email');

      expect(result.action).toBe('reply');
    });

    it('should handle flag action', async () => {
      mockInvoke.mockResolvedValue({
        content: JSON.stringify({
          domain: 'general',
          priority: 'critical',
          action: 'flag',
          reasoning: 'Ambiguous - needs human review',
          suggested_tags: ['review', 'unclear'],
        }),
      });

      const result = await adjudicateItem('Unclear message needs attention', 'message');

      expect(result.action).toBe('flag');
    });
  });

  // ============================================================================
  // Priority Levels Tests
  // ============================================================================

  describe('priority levels', () => {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;

    for (const priority of priorities) {
      it(`should handle ${priority} priority`, async () => {
        mockInvoke.mockResolvedValue({
          content: JSON.stringify({
            domain: 'general',
            priority,
            action: 'route',
            reasoning: `${priority} priority item`,
            suggested_tags: [],
          }),
        });

        const result = await adjudicateItem('Test', 'email');

        expect(result.priority).toBe(priority);
      });
    }
  });

  // ============================================================================
  // Domain Routing Tests
  // ============================================================================

  describe('domain routing', () => {
    const domains = [
      { domain: 'finance', agent: 'agent.finance' },
      { domain: 'legal', agent: 'agent.legal' },
      { domain: 'health', agent: 'agent.health' },
      { domain: 'general', agent: 'agent.pm' },
    ];

    for (const { domain, agent } of domains) {
      it(`should route ${domain} items to ${agent}`, async () => {
        mockInvoke.mockResolvedValue({
          content: JSON.stringify({
            domain,
            priority: 'medium',
            action: 'route',
            target_agent: agent,
            reasoning: `Routing to ${domain}`,
            suggested_tags: [domain],
          }),
        });

        const result = await adjudicateItem(`${domain} related content`, 'email');

        expect(result.domain).toBe(domain);
        expect(result.target_agent).toBe(agent);
      });
    }
  });
});
