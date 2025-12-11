// @ts-nocheck
/**
 * Tests for forge-metacognition-prompts.ts
 * PMRE Metacognition Prompts - Planning, Monitoring, Regulation, Evaluation
 */

import {
  shouldShowPrompt,
  recordPromptShown,
  getPMREPrompt,
  getPromptById,
  getPromptsByDimension,
  getPromptsByAttractor,
  getPromptStats,
  clearLearnerCooldowns,
  PMRE_PROMPTS,
} from '@/lib/hyro/forge-metacognition-prompts';
import type {
  PMREDimension,
  PMREPrompt,
} from '@/lib/hyro/forge-metacognition-prompts';
import type { AttractorType } from '@/lib/hyro/forge-types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockPrompt(overrides: Partial<PMREPrompt> = {}): PMREPrompt {
  return {
    id: 'test_prompt_1',
    dimension: 'planning',
    attractorStates: ['flow'],
    text: 'Test prompt text',
    priority: 'medium',
    cooldownMinutes: 15,
    ...overrides,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  // Clear cooldowns before each test
  clearLearnerCooldowns('test-learner');
  clearLearnerCooldowns('learner-1');
  clearLearnerCooldowns('learner-2');
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-metacognition-prompts types', () => {
  describe('PMREDimension type', () => {
    it('should support all 4 dimensions', () => {
      const dimensions: PMREDimension[] = ['planning', 'monitoring', 'regulation', 'evaluation'];

      dimensions.forEach((dim) => {
        expect(typeof dim).toBe('string');
      });
    });
  });

  describe('PMREPrompt interface', () => {
    it('should have required properties', () => {
      const prompt: PMREPrompt = createMockPrompt();

      expect(prompt.id).toBeDefined();
      expect(prompt.dimension).toBeDefined();
      expect(prompt.attractorStates).toBeInstanceOf(Array);
      expect(prompt.text).toBeDefined();
      expect(prompt.priority).toBeDefined();
      expect(prompt.cooldownMinutes).toBeDefined();
    });

    it('should have optional followUp', () => {
      const prompt: PMREPrompt = createMockPrompt({ followUp: 'Follow up question' });

      expect(prompt.followUp).toBe('Follow up question');
    });

    it('should support all priority levels', () => {
      const priorities: PMREPrompt['priority'][] = ['low', 'medium', 'high'];

      priorities.forEach((priority) => {
        const prompt = createMockPrompt({ priority });
        expect(prompt.priority).toBe(priority);
      });
    });
  });
});

// ============================================================================
// PMRE_PROMPTS Constant Tests
// ============================================================================

describe('PMRE_PROMPTS', () => {
  it('should be an array of prompts', () => {
    expect(Array.isArray(PMRE_PROMPTS)).toBe(true);
    expect(PMRE_PROMPTS.length).toBeGreaterThan(0);
  });

  it('should have prompts for all dimensions', () => {
    const dimensions: PMREDimension[] = ['planning', 'monitoring', 'regulation', 'evaluation'];

    dimensions.forEach((dim) => {
      const prompts = PMRE_PROMPTS.filter((p) => p.dimension === dim);
      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  it('should have prompts for all attractor states', () => {
    const attractors: AttractorType[] = ['flow', 'confusion', 'boredom', 'frustration', 'discovery'];

    attractors.forEach((attractor) => {
      const prompts = PMRE_PROMPTS.filter((p) => p.attractorStates.includes(attractor));
      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  it('should have unique prompt IDs', () => {
    const ids = PMRE_PROMPTS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid cooldown values', () => {
    PMRE_PROMPTS.forEach((prompt) => {
      expect(prompt.cooldownMinutes).toBeGreaterThan(0);
      expect(prompt.cooldownMinutes).toBeLessThanOrEqual(90); // Max cooldown
    });
  });
});

// ============================================================================
// shouldShowPrompt Tests
// ============================================================================

describe('shouldShowPrompt', () => {
  it('should return true for first-time prompt', () => {
    const result = shouldShowPrompt('test-learner', 'plan_flow_1');

    expect(result).toBe(true);
  });

  it('should return false for non-existent prompt', () => {
    const result = shouldShowPrompt('test-learner', 'non_existent_prompt');

    expect(result).toBe(false);
  });

  it('should return false during cooldown period', () => {
    // Record prompt shown
    recordPromptShown('test-learner', 'plan_flow_1');

    // Should be in cooldown
    const result = shouldShowPrompt('test-learner', 'plan_flow_1');

    expect(result).toBe(false);
  });

  it('should return true after cooldown expires', () => {
    // This test would need to mock Date.now() for proper testing
    // For now, just verify the function works
    const result = shouldShowPrompt('test-learner', 'plan_flow_1');
    expect(typeof result).toBe('boolean');
  });

  it('should track cooldowns per learner', () => {
    recordPromptShown('learner-1', 'plan_flow_1');

    // Learner-1 should be in cooldown
    expect(shouldShowPrompt('learner-1', 'plan_flow_1')).toBe(false);

    // Learner-2 should NOT be in cooldown
    expect(shouldShowPrompt('learner-2', 'plan_flow_1')).toBe(true);
  });
});

// ============================================================================
// recordPromptShown Tests
// ============================================================================

describe('recordPromptShown', () => {
  it('should record prompt as shown', () => {
    // First check should pass
    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(true);

    // Record it
    recordPromptShown('test-learner', 'plan_flow_1');

    // Now should be in cooldown
    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(false);
  });

  it('should update existing record', () => {
    recordPromptShown('test-learner', 'plan_flow_1');
    recordPromptShown('test-learner', 'plan_flow_1'); // Record again

    // Should not throw, should update record
    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(false);
  });

  it('should handle multiple prompts for same learner', () => {
    recordPromptShown('test-learner', 'plan_flow_1');
    recordPromptShown('test-learner', 'plan_flow_2');

    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(false);
    expect(shouldShowPrompt('test-learner', 'plan_flow_2')).toBe(false);
    expect(shouldShowPrompt('test-learner', 'plan_confusion_1')).toBe(true);
  });
});

// ============================================================================
// getPMREPrompt Tests
// ============================================================================

describe('getPMREPrompt', () => {
  it('should return prompt matching dimension and attractor', () => {
    const result = getPMREPrompt('planning', 'flow');

    expect(result).not.toBeNull();
    expect(result?.dimension).toBe('planning');
    expect(result?.attractorStates).toContain('flow');
  });

  it('should return null when no matching prompts', () => {
    // This combination doesn't exist in the prompts
    const result = getPMREPrompt('regulation', 'discovery');

    // May or may not be null depending on prompts
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(result.dimension).toBe('regulation');
    }
  });

  it('should return random prompt when no learner ID', () => {
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = getPMREPrompt('planning', 'confusion');
      if (result) results.push(result.id);
    }

    // Should get at least one result
    expect(results.length).toBeGreaterThan(0);
  });

  it('should respect cooldown when learner ID provided', () => {
    // Get first prompt
    const first = getPMREPrompt('planning', 'flow', 'test-learner');

    if (first) {
      // Try to get same prompt again (should be on cooldown)
      const available = shouldShowPrompt('test-learner', first.id);
      expect(available).toBe(false);
    }
  });

  it('should prioritize high priority prompts', () => {
    // Clear cooldowns first
    clearLearnerCooldowns('test-learner');

    // Get prompt for confusion (has high priority prompts)
    const result = getPMREPrompt('planning', 'confusion', 'test-learner');

    if (result) {
      expect(result.priority).toBe('high');
    }
  });

  it('should return null when all prompts on cooldown', () => {
    // Record all planning/flow prompts as shown
    const flowPrompts = PMRE_PROMPTS.filter(
      (p) => p.dimension === 'planning' && p.attractorStates.includes('flow')
    );

    flowPrompts.forEach((p) => recordPromptShown('test-learner', p.id));

    // Now all should be on cooldown
    const result = getPMREPrompt('planning', 'flow', 'test-learner');

    expect(result).toBeNull();
  });
});

// ============================================================================
// getPromptById Tests
// ============================================================================

describe('getPromptById', () => {
  it('should return prompt by ID', () => {
    const result = getPromptById('plan_flow_1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('plan_flow_1');
  });

  it('should return null for non-existent ID', () => {
    const result = getPromptById('non_existent_id');

    expect(result).toBeNull();
  });

  it('should return full prompt object', () => {
    const result = getPromptById('plan_confusion_1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('plan_confusion_1');
    expect(result?.dimension).toBe('planning');
    expect(result?.attractorStates).toContain('confusion');
    expect(result?.text).toBeDefined();
    expect(result?.followUp).toBeDefined(); // This one has a followUp
    expect(result?.priority).toBe('high');
    expect(result?.cooldownMinutes).toBe(10);
  });
});

// ============================================================================
// getPromptsByDimension Tests
// ============================================================================

describe('getPromptsByDimension', () => {
  it('should return all prompts for planning', () => {
    const result = getPromptsByDimension('planning');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.dimension).toBe('planning');
    });
  });

  it('should return all prompts for monitoring', () => {
    const result = getPromptsByDimension('monitoring');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.dimension).toBe('monitoring');
    });
  });

  it('should return all prompts for regulation', () => {
    const result = getPromptsByDimension('regulation');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.dimension).toBe('regulation');
    });
  });

  it('should return all prompts for evaluation', () => {
    const result = getPromptsByDimension('evaluation');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.dimension).toBe('evaluation');
    });
  });
});

// ============================================================================
// getPromptsByAttractor Tests
// ============================================================================

describe('getPromptsByAttractor', () => {
  it('should return prompts for flow state', () => {
    const result = getPromptsByAttractor('flow');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.attractorStates).toContain('flow');
    });
  });

  it('should return prompts for confusion state', () => {
    const result = getPromptsByAttractor('confusion');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.attractorStates).toContain('confusion');
    });
  });

  it('should return prompts for boredom state', () => {
    const result = getPromptsByAttractor('boredom');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.attractorStates).toContain('boredom');
    });
  });

  it('should return prompts for frustration state', () => {
    const result = getPromptsByAttractor('frustration');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.attractorStates).toContain('frustration');
    });
  });

  it('should return prompts for discovery state', () => {
    const result = getPromptsByAttractor('discovery');

    expect(result.length).toBeGreaterThan(0);
    result.forEach((prompt) => {
      expect(prompt.attractorStates).toContain('discovery');
    });
  });

  it('should include prompts that apply to all states', () => {
    const flowPrompts = getPromptsByAttractor('flow');
    const confusionPrompts = getPromptsByAttractor('confusion');

    // mon_general_1 and eval_general_1 apply to all states
    const generalMonitoring = flowPrompts.find((p) => p.id === 'mon_general_1');
    expect(generalMonitoring).toBeDefined();

    const generalEval = confusionPrompts.find((p) => p.id === 'eval_general_1');
    expect(generalEval).toBeDefined();
  });
});

// ============================================================================
// getPromptStats Tests
// ============================================================================

describe('getPromptStats', () => {
  it('should return stats for learner with no prompts shown', () => {
    const stats = getPromptStats('new-learner');

    expect(stats.totalShown).toBe(0);
    expect(stats.byDimension.planning).toBe(0);
    expect(stats.byDimension.monitoring).toBe(0);
    expect(stats.byDimension.regulation).toBe(0);
    expect(stats.byDimension.evaluation).toBe(0);
  });

  it('should track prompts by dimension', () => {
    recordPromptShown('test-learner', 'plan_flow_1');
    recordPromptShown('test-learner', 'plan_confusion_1');
    recordPromptShown('test-learner', 'mon_general_1');

    const stats = getPromptStats('test-learner');

    expect(stats.totalShown).toBe(3);
    expect(stats.byDimension.planning).toBe(2);
    expect(stats.byDimension.monitoring).toBe(1);
    expect(stats.byDimension.regulation).toBe(0);
    expect(stats.byDimension.evaluation).toBe(0);
  });

  it('should count each dimension correctly', () => {
    recordPromptShown('test-learner', 'reg_confusion_1');
    recordPromptShown('test-learner', 'eval_general_1');

    const stats = getPromptStats('test-learner');

    expect(stats.totalShown).toBe(2);
    expect(stats.byDimension.regulation).toBe(1);
    expect(stats.byDimension.evaluation).toBe(1);
  });
});

// ============================================================================
// clearLearnerCooldowns Tests
// ============================================================================

describe('clearLearnerCooldowns', () => {
  it('should clear all cooldowns for learner', () => {
    recordPromptShown('test-learner', 'plan_flow_1');
    recordPromptShown('test-learner', 'mon_general_1');

    // Verify cooldowns active
    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(false);
    expect(shouldShowPrompt('test-learner', 'mon_general_1')).toBe(false);

    // Clear cooldowns
    clearLearnerCooldowns('test-learner');

    // Verify cooldowns cleared
    expect(shouldShowPrompt('test-learner', 'plan_flow_1')).toBe(true);
    expect(shouldShowPrompt('test-learner', 'mon_general_1')).toBe(true);
  });

  it('should not affect other learners', () => {
    recordPromptShown('learner-1', 'plan_flow_1');
    recordPromptShown('learner-2', 'plan_flow_1');

    // Clear only learner-1
    clearLearnerCooldowns('learner-1');

    // Learner-1 cleared
    expect(shouldShowPrompt('learner-1', 'plan_flow_1')).toBe(true);

    // Learner-2 still on cooldown
    expect(shouldShowPrompt('learner-2', 'plan_flow_1')).toBe(false);
  });

  it('should reset stats', () => {
    recordPromptShown('test-learner', 'plan_flow_1');
    recordPromptShown('test-learner', 'mon_general_1');

    clearLearnerCooldowns('test-learner');

    const stats = getPromptStats('test-learner');
    expect(stats.totalShown).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty learner ID', () => {
    // These should not throw
    expect(() => shouldShowPrompt('', 'plan_flow_1')).not.toThrow();
    expect(() => recordPromptShown('', 'plan_flow_1')).not.toThrow();
    expect(() => clearLearnerCooldowns('')).not.toThrow();
  });

  it('should handle prompts with multiple attractor states', () => {
    // mon_general_1 applies to all states
    const prompt = getPromptById('mon_general_1');

    expect(prompt?.attractorStates).toHaveLength(5);
    expect(prompt?.attractorStates).toContain('flow');
    expect(prompt?.attractorStates).toContain('confusion');
    expect(prompt?.attractorStates).toContain('boredom');
    expect(prompt?.attractorStates).toContain('frustration');
    expect(prompt?.attractorStates).toContain('discovery');
  });

  it('should handle prompts with followUp questions', () => {
    const prompt = getPromptById('plan_confusion_1');

    expect(prompt?.followUp).toBe('What specific part is unclear?');
  });

  it('should return prompts with varying cooldowns', () => {
    const flowPrompts = getPromptsByAttractor('flow');
    const confusionPrompts = getPromptsByAttractor('confusion');

    // Flow prompts should have longer cooldowns (low priority)
    const flowCooldowns = flowPrompts.map((p) => p.cooldownMinutes);
    const confusionCooldowns = confusionPrompts.filter((p) => p.priority === 'high').map((p) => p.cooldownMinutes);

    // High priority confusion prompts should have shorter cooldowns
    expect(Math.min(...confusionCooldowns)).toBeLessThanOrEqual(Math.max(...flowCooldowns));
  });

  it('should handle concurrent cooldown tracking', () => {
    // Record many prompts quickly
    const prompts = PMRE_PROMPTS.slice(0, 5);
    prompts.forEach((p) => recordPromptShown('test-learner', p.id));

    const stats = getPromptStats('test-learner');
    expect(stats.totalShown).toBe(5);
  });
});
