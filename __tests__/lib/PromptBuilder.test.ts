/**
 * Wrath Shield v3 - PromptBuilder Tests
 *
 * Comprehensive test suite for prompt construction with gating and style rules
 */

import {
  constructCoachingPrompt,
  buildUserMessage,
  type ChatMessage,
  type ConstructedPrompt,
} from '@/lib/PromptBuilder';
import type { CoachingContext } from '@/lib/CoachingEngine';
import type { Recovery, Cycle, Sleep, Lifelog } from '@/lib/db/types';

describe('PromptBuilder', () => {
  const mockRecovery: Recovery = {
    id: 'rec_1',
    date: '2025-01-31',
    score: 78,
    hrv: 65,
    rhr: 55,
    spo2: 97,
    skin_temp: 36.5,
  };

  const mockCycle: Cycle = {
    id: 'cycle_1',
    date: '2025-01-31',
    strain: 12.4,
    kilojoules: 8500,
    avg_hr: 125,
    max_hr: 165,
  };

  const mockSleep: Sleep = {
    id: 'sleep_1',
    date: '2025-01-31',
    performance: 85,
    rem_min: 95,
    sws_min: 75,
    light_min: 180,
    awake_min: 15,
    respiration: 14.5,
    sleep_debt_min: -20,
  };

  const mockLifelog: Lifelog = {
    id: 'lifelog_1',
    date: '2025-01-31',
    title: 'Morning conversation',
    manipulation_count: 2,
    wrath_deployed: 1,
    raw_json: JSON.stringify({ segments: [{ text: 'test' }] }),
  };

  const mockContext: CoachingContext = {
    dailyContext: {
      date: '2025-01-31',
      recovery: mockRecovery,
      cycle: mockCycle,
      sleep: mockSleep,
      lifelogs: [mockLifelog],
      totalManipulations: 2,
      wrathDeployed: true,
    },
    relevantMemories: [
      {
        id: 'mem_1',
        text: 'Low recovery requires rest and boundary protection',
        score: 0.95,
      },
    ],
    anchors: [
      {
        id: 'anchor_1',
        text: 'I will not tolerate manipulation',
        category: 'boundaries',
        date: '2025-01-20',
      },
    ],
    query: 'high recovery manipulation',
  };

  describe('constructCoachingPrompt', () => {
    it('should construct complete prompt with all sections', () => {
      const prompt = constructCoachingPrompt(mockContext);

      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[1].role).toBe('user');
      expect(prompt.temperature).toBe(0.7);
      expect(prompt.max_tokens).toBe(500);
    });

    it('should include system prompt with coach persona', () => {
      const prompt = constructCoachingPrompt(mockContext);

      const systemMessage = prompt.messages[0];
      expect(systemMessage.content).toContain('relentless confidence coach');
      expect(systemMessage.content).toContain('unbending resolve');
      expect(systemMessage.content).toContain('Recovery is non-negotiable');
    });

    it('should include user message with formatted context', () => {
      const prompt = constructCoachingPrompt(mockContext);

      const userMessage = prompt.messages[1];
      expect(userMessage.content).toContain('Daily Coaching Brief - 2025-01-31');
      expect(userMessage.content).toContain('WHOOP Metrics');
      expect(userMessage.content).toContain('Manipulation Detection');
    });

    it('should set metadata correctly', () => {
      const prompt = constructCoachingPrompt(mockContext);

      expect(prompt.metadata.date).toBe('2025-01-31');
      expect(prompt.metadata.has_whoop_data).toBe(true);
      expect(prompt.metadata.has_manipulations).toBe(true);
      expect(prompt.metadata.wrath_deployed).toBe(true);
      expect(prompt.metadata.memory_count).toBe(1);
      expect(prompt.metadata.anchor_count).toBe(1);
    });

    it('should handle context with no WHOOP data', () => {
      const noWhoopContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: null,
          cycle: null,
          sleep: null,
        },
      };

      const prompt = constructCoachingPrompt(noWhoopContext);

      expect(prompt.metadata.has_whoop_data).toBe(false);
      expect(prompt.messages[1].content).not.toContain('WHOOP Metrics');
    });

    it('should handle context with no manipulations', () => {
      const noManipulationContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          totalManipulations: 0,
          wrathDeployed: false,
        },
      };

      const prompt = constructCoachingPrompt(noManipulationContext);

      expect(prompt.metadata.has_manipulations).toBe(false);
      expect(prompt.metadata.wrath_deployed).toBe(false);
    });

    it('should handle minimal context (no memories or anchors)', () => {
      const minimalContext: CoachingContext = {
        dailyContext: {
          date: '2025-01-31',
          recovery: null,
          cycle: null,
          sleep: null,
          lifelogs: [],
          totalManipulations: 0,
          wrathDeployed: false,
        },
        relevantMemories: [],
        anchors: [],
        query: 'daily coaching',
      };

      const prompt = constructCoachingPrompt(minimalContext);

      expect(prompt.messages).toHaveLength(2);
      expect(prompt.metadata.memory_count).toBe(0);
      expect(prompt.metadata.anchor_count).toBe(0);
      expect(prompt.messages[1].content).toContain('Daily Coaching Brief');
    });
  });

  describe('buildUserMessage', () => {
    it('should include date header', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('# Daily Coaching Brief - 2025-01-31');
    });

    it('should format WHOOP metrics with classification', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('**WHOOP Metrics (Today):**');
      expect(message).toContain('Recovery: 78% [HIGH]');
      expect(message).toContain('Strain: 12.4 [MODERATE]');
      expect(message).toContain('Sleep: 85%');
    });

    it('should format manipulation detection section', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('**Manipulation Detection (Today):**');
      expect(message).toContain('Total Interactions: 1');
      expect(message).toContain('Manipulative Attempts: 2');
      expect(message).toContain('✓ Assertive boundaries deployed');
    });

    it('should format relevant memories section', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('**Relevant Context:**');
      expect(message).toContain('1. Low recovery requires rest and boundary protection');
    });

    it('should format anchors section', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('**Core Principles (Your Anchors):**');
      expect(message).toContain('- I will not tolerate manipulation');
    });

    it('should include coaching request', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('**Coaching Request:**');
      expect(message).toContain('Provide a brief coaching summary (3-5 key points)');
      expect(message).toContain('What the metrics reveal about readiness and resilience');
      expect(message).toContain('Patterns of manipulation and boundary enforcement');
      expect(message).toContain('Specific actions to maintain or improve unbending resolve');
    });

    it('should gate out WHOOP section when no data exists', () => {
      const noWhoopContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: null,
          cycle: null,
          sleep: null,
        },
      };

      const message = buildUserMessage(noWhoopContext);

      expect(message).not.toContain('**WHOOP Metrics (Today):**');
    });

    it('should gate out manipulation section when no lifelogs exist', () => {
      const noLifelogsContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          lifelogs: [],
          totalManipulations: 0,
          wrathDeployed: false,
        },
      };

      const message = buildUserMessage(noLifelogsContext);

      expect(message).not.toContain('**Manipulation Detection (Today):**');
    });

    it('should gate out memories section when no memories exist', () => {
      const noMemoriesContext: CoachingContext = {
        ...mockContext,
        relevantMemories: [],
      };

      const message = buildUserMessage(noMemoriesContext);

      expect(message).not.toContain('**Relevant Context:**');
    });

    it('should gate out anchors section when no anchors exist', () => {
      const noAnchorsContext: CoachingContext = {
        ...mockContext,
        anchors: [],
      };

      const message = buildUserMessage(noAnchorsContext);

      expect(message).not.toContain('**Core Principles (Your Anchors):**');
    });
  });

  describe('WHOOP Metrics Formatting', () => {
    it('should classify high recovery correctly', () => {
      const highRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 85 },
        },
      };

      const message = buildUserMessage(highRecoveryContext);

      expect(message).toContain('Recovery: 85% [HIGH]');
    });

    it('should classify medium recovery correctly', () => {
      const mediumRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 55 },
        },
      };

      const message = buildUserMessage(mediumRecoveryContext);

      expect(message).toContain('Recovery: 55% [MEDIUM]');
    });

    it('should classify low recovery correctly', () => {
      const lowRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 35 },
        },
      };

      const message = buildUserMessage(lowRecoveryContext);

      expect(message).toContain('Recovery: 35% [LOW]');
    });

    it('should classify light strain correctly', () => {
      const lightStrainContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: { ...mockCycle, strain: 8.5 },
        },
      };

      const message = buildUserMessage(lightStrainContext);

      expect(message).toContain('Strain: 8.5 [LIGHT]');
    });

    it('should classify overdrive strain correctly', () => {
      const overdriveStrainContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: { ...mockCycle, strain: 16.7 },
        },
      };

      const message = buildUserMessage(overdriveStrainContext);

      expect(message).toContain('Strain: 16.7 [OVERDRIVE]');
    });

    it('should handle partial WHOOP data (recovery only)', () => {
      const recoveryOnlyContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: null,
          sleep: null,
        },
      };

      const message = buildUserMessage(recoveryOnlyContext);

      expect(message).toContain('**WHOOP Metrics (Today):**');
      expect(message).toContain('Recovery: 78% [HIGH]');
      expect(message).not.toContain('Strain:');
      expect(message).not.toContain('Sleep:');
    });

    it('should handle null WHOOP metric scores', () => {
      const nullScoresContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: null },
          cycle: { ...mockCycle, strain: null },
          sleep: { ...mockSleep, performance: null },
        },
      };

      const message = buildUserMessage(nullScoresContext);

      expect(message).not.toContain('**WHOOP Metrics (Today):**');
    });

    it('should round fractional recovery scores', () => {
      const fractionalRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 77.89 },
        },
      };

      const message = buildUserMessage(fractionalRecoveryContext);

      expect(message).toContain('Recovery: 78% [HIGH]');
    });

    it('should format strain to 1 decimal place', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toMatch(/Strain: 12\.4 \[MODERATE\]/);
    });
  });

  describe('Manipulation Detection Formatting', () => {
    it('should show warning when no wrath deployed', () => {
      const noWrathContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          totalManipulations: 3,
          wrathDeployed: false,
        },
      };

      const message = buildUserMessage(noWrathContext);

      expect(message).toContain('⚠ No wrath deployed - compliance or silence');
    });

    it('should show clean interactions when no manipulations', () => {
      const cleanContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          totalManipulations: 0,
          wrathDeployed: false,
        },
      };

      const message = buildUserMessage(cleanContext);

      expect(message).toContain('Response: Clean interactions');
    });

    it('should show total interactions count', () => {
      const multiLifelogContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          lifelogs: [mockLifelog, { ...mockLifelog, id: 'lifelog_2' }],
        },
      };

      const message = buildUserMessage(multiLifelogContext);

      expect(message).toContain('Total Interactions: 2');
    });
  });

  describe('Memories and Anchors Formatting', () => {
    it('should format multiple memories with numbering', () => {
      const multiMemoryContext: CoachingContext = {
        ...mockContext,
        relevantMemories: [
          { id: 'mem_1', text: 'First memory', score: 0.95 },
          { id: 'mem_2', text: 'Second memory', score: 0.88 },
          { id: 'mem_3', text: 'Third memory', score: 0.75 },
        ],
      };

      const message = buildUserMessage(multiMemoryContext);

      expect(message).toContain('1. First memory');
      expect(message).toContain('2. Second memory');
      expect(message).toContain('3. Third memory');
    });

    it('should format multiple anchors', () => {
      const multiAnchorContext: CoachingContext = {
        ...mockContext,
        anchors: [
          {
            id: 'anchor_1',
            text: 'I will not tolerate manipulation',
            category: 'boundaries',
            date: '2025-01-20',
          },
          {
            id: 'anchor_2',
            text: 'Recovery is non-negotiable',
            category: 'recovery',
            date: '2025-01-21',
          },
        ],
      };

      const message = buildUserMessage(multiAnchorContext);

      expect(message).toContain('- I will not tolerate manipulation');
      expect(message).toContain('- Recovery is non-negotiable');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lifelog array', () => {
      const emptyLifelogsContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          lifelogs: [],
        },
      };

      const message = buildUserMessage(emptyLifelogsContext);

      expect(message).not.toContain('**Manipulation Detection (Today):**');
    });

    it('should handle very high recovery (100%)', () => {
      const maxRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 100 },
        },
      };

      const message = buildUserMessage(maxRecoveryContext);

      expect(message).toContain('Recovery: 100% [HIGH]');
    });

    it('should handle very low recovery (0%)', () => {
      const minRecoveryContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          recovery: { ...mockRecovery, score: 0 },
        },
      };

      const message = buildUserMessage(minRecoveryContext);

      expect(message).toContain('Recovery: 0% [LOW]');
    });

    it('should handle very high strain (21.0)', () => {
      const maxStrainContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          cycle: { ...mockCycle, strain: 21.0 },
        },
      };

      const message = buildUserMessage(maxStrainContext);

      expect(message).toContain('Strain: 21.0 [OVERDRIVE]');
    });

    it('should handle many manipulations (50)', () => {
      const manyManipulationsContext: CoachingContext = {
        ...mockContext,
        dailyContext: {
          ...mockContext.dailyContext,
          totalManipulations: 50,
        },
      };

      const message = buildUserMessage(manyManipulationsContext);

      expect(message).toContain('Manipulative Attempts: 50');
    });

    it('should handle completely empty context', () => {
      const emptyContext: CoachingContext = {
        dailyContext: {
          date: '2025-01-31',
          recovery: null,
          cycle: null,
          sleep: null,
          lifelogs: [],
          totalManipulations: 0,
          wrathDeployed: false,
        },
        relevantMemories: [],
        anchors: [],
        query: 'daily coaching',
      };

      const message = buildUserMessage(emptyContext);

      // Should still have header and coaching request
      expect(message).toContain('# Daily Coaching Brief - 2025-01-31');
      expect(message).toContain('**Coaching Request:**');
      // Should NOT have any data sections
      expect(message).not.toContain('**WHOOP Metrics');
      expect(message).not.toContain('**Manipulation Detection');
      expect(message).not.toContain('**Relevant Context');
      expect(message).not.toContain('**Core Principles');
    });
  });

  describe('Message Structure', () => {
    it('should use proper markdown formatting', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toContain('# Daily Coaching Brief');
      expect(message).toMatch(/\*\*WHOOP Metrics/);
      expect(message).toMatch(/\*\*Manipulation Detection/);
      expect(message).toMatch(/\*\*Relevant Context/);
      expect(message).toMatch(/\*\*Core Principles/);
    });

    it('should separate sections with blank lines', () => {
      const message = buildUserMessage(mockContext);

      // Sections should be separated by double newlines
      expect(message).toMatch(/\n\n\*\*WHOOP Metrics/);
      expect(message).toMatch(/\n\n\*\*Manipulation Detection/);
    });

    it('should end with coaching request', () => {
      const message = buildUserMessage(mockContext);

      expect(message).toMatch(/unbending resolve$/);
    });
  });
});
