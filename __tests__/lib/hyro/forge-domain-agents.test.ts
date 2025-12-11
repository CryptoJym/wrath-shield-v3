// @ts-nocheck
/**
 * Tests for HYRO FORGE: Domain-Specific Agent Prompts
 *
 * Tests the expert persona system for each assessment domain,
 * including agent configurations, prompt building, and evaluation guidance.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import after any mocks
import {
  getDomainAgent,
  getAllDomainAgents,
  buildAgentSystemPrompt,
  buildAgentEvaluationPrompt,
} from '../../../lib/hyro/forge-domain-agents';
import type { DomainAgentConfig } from '../../../lib/hyro/forge-domain-agents';

describe('HYRO FORGE: Domain-Specific Agent Prompts', () => {
  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('DomainAgentConfig Type', () => {
    it('should define agent config structure', () => {
      const agent = getDomainAgent('math');

      expect(agent).toHaveProperty('stat');
      expect(agent).toHaveProperty('displayName');
      expect(agent).toHaveProperty('emoji');
      expect(agent).toHaveProperty('expertPersona');
      expect(agent).toHaveProperty('assessmentPhilosophy');
      expect(agent).toHaveProperty('qualityCriteria');
      expect(agent).toHaveProperty('strandContexts');
      expect(agent).toHaveProperty('difficultyMarkers');
      expect(agent).toHaveProperty('commonMisconceptions');
      expect(agent).toHaveProperty('evaluationGuidance');
      expect(agent).toHaveProperty('partialCreditGuidelines');
      expect(agent).toHaveProperty('mcPromptTemplate');
      expect(agent).toHaveProperty('shortAnswerPromptTemplate');
      expect(agent).toHaveProperty('extendedResponseTemplate');
    });

    it('should have difficulty markers for all tiers', () => {
      const agent = getDomainAgent('math');

      expect(agent.difficultyMarkers).toHaveProperty('foundation');
      expect(agent.difficultyMarkers).toHaveProperty('bridge');
      expect(agent.difficultyMarkers).toHaveProperty('power');
      expect(agent.difficultyMarkers).toHaveProperty('horizon');

      expect(Array.isArray(agent.difficultyMarkers.foundation)).toBe(true);
      expect(Array.isArray(agent.difficultyMarkers.bridge)).toBe(true);
      expect(Array.isArray(agent.difficultyMarkers.power)).toBe(true);
      expect(Array.isArray(agent.difficultyMarkers.horizon)).toBe(true);
    });
  });

  // ==========================================================================
  // getDomainAgent Tests
  // ==========================================================================

  describe('getDomainAgent', () => {
    it('should return math agent for "math" stat', () => {
      const agent = getDomainAgent('math');

      expect(agent.stat).toBe('math');
      expect(agent.displayName).toBe('Mathematics');
      expect(agent.emoji).toBe('🔢');
    });

    it('should return reading agent for "reading" stat', () => {
      const agent = getDomainAgent('reading');

      expect(agent.stat).toBe('reading');
      expect(agent.displayName).toBe('Reading Comprehension');
      expect(agent.emoji).toBe('📚');
    });

    it('should return writing agent for "writing" stat', () => {
      const agent = getDomainAgent('writing');

      expect(agent.stat).toBe('writing');
      expect(agent.displayName).toBe('Writing');
      expect(agent.emoji).toBe('✍️');
    });

    it('should return science agent for "science" stat', () => {
      const agent = getDomainAgent('science');

      expect(agent.stat).toBe('science');
      expect(agent.displayName).toBe('Science');
      expect(agent.emoji).toBe('🔬');
    });

    it('should return coding agent for "coding" stat', () => {
      const agent = getDomainAgent('coding');

      expect(agent.stat).toBe('coding');
      expect(agent.displayName).toBe('Coding & Computer Science');
      expect(agent.emoji).toBe('💻');
    });

    it('should return critical thinking agent', () => {
      const agent = getDomainAgent('critical_thinking');

      expect(agent.stat).toBe('critical_thinking');
      expect(agent.displayName).toBe('Critical Thinking');
      expect(agent.emoji).toBe('🧠');
    });

    it('should return social studies agent', () => {
      const agent = getDomainAgent('social_studies');

      expect(agent.stat).toBe('social_studies');
      expect(agent.displayName).toBe('Social Studies');
      expect(agent.emoji).toBe('🌍');
    });

    it('should return financial literacy agent', () => {
      const agent = getDomainAgent('financial_literacy');

      expect(agent.stat).toBe('financial_literacy');
      expect(agent.displayName).toBe('Financial Literacy');
      expect(agent.emoji).toBe('💰');
    });

    it('should return study skills agent', () => {
      const agent = getDomainAgent('study_skills');

      expect(agent.stat).toBe('study_skills');
      expect(agent.displayName).toBe('Study Skills');
      expect(agent.emoji).toBe('📖');
    });

    it('should return technology agent', () => {
      const agent = getDomainAgent('technology');

      expect(agent.stat).toBe('technology');
      expect(agent.displayName).toBe('Technology');
      expect(agent.emoji).toBe('🖥️');
    });

    it('should return problem solving agent', () => {
      const agent = getDomainAgent('problem_solving');

      expect(agent.stat).toBe('problem_solving');
      expect(agent.displayName).toBe('Problem Solving');
      expect(agent.emoji).toBe('🧩');
    });

    it('should throw error for unknown stat', () => {
      expect(() => getDomainAgent('unknown_stat' as any)).toThrow(
        'No domain agent configured for stat: unknown_stat'
      );
    });
  });

  // ==========================================================================
  // getAllDomainAgents Tests
  // ==========================================================================

  describe('getAllDomainAgents', () => {
    it('should return all 11 domain agents', () => {
      const agents = getAllDomainAgents();

      expect(agents).toHaveLength(11);
    });

    it('should return all core stats', () => {
      const agents = getAllDomainAgents();
      const stats = agents.map(a => a.stat);

      expect(stats).toContain('math');
      expect(stats).toContain('reading');
      expect(stats).toContain('writing');
      expect(stats).toContain('science');
      expect(stats).toContain('coding');
      expect(stats).toContain('critical_thinking');
      expect(stats).toContain('social_studies');
      expect(stats).toContain('financial_literacy');
      expect(stats).toContain('study_skills');
      expect(stats).toContain('technology');
      expect(stats).toContain('problem_solving');
    });

    it('should return unique agents', () => {
      const agents = getAllDomainAgents();
      const stats = agents.map(a => a.stat);
      const uniqueStats = new Set(stats);

      expect(uniqueStats.size).toBe(agents.length);
    });
  });

  // ==========================================================================
  // Math Agent Tests
  // ==========================================================================

  describe('Math Agent', () => {
    let agent: DomainAgentConfig;

    beforeEach(() => {
      agent = getDomainAgent('math');
    });

    it('should have Dr. Ada expert persona', () => {
      expect(agent.expertPersona).toContain('Dr. Ada');
      expect(agent.expertPersona).toContain('mathematics assessment specialist');
    });

    it('should have strand contexts for math topics', () => {
      expect(agent.strandContexts['Arithmetic & Number Sense']).toBeDefined();
      expect(agent.strandContexts['Algebra I (Foundations)']).toBeDefined();
      expect(agent.strandContexts['Geometry & Spatial Reasoning']).toBeDefined();
      expect(agent.strandContexts['Calculus I (Differential)']).toBeDefined();
    });

    it('should have common misconceptions', () => {
      expect(agent.commonMisconceptions.length).toBeGreaterThan(0);
      expect(agent.commonMisconceptions).toContain(
        'Distributing exponents over addition: (a+b)^2 = a^2 + b^2'
      );
    });

    it('should have quality criteria', () => {
      expect(agent.qualityCriteria.length).toBeGreaterThan(0);
      expect(agent.qualityCriteria).toContain(
        'Mathematical accuracy (calculations, notation, terminology)'
      );
    });

    it('should have MC prompt template with placeholders', () => {
      expect(agent.mcPromptTemplate).toContain('{{strand}}');
      expect(agent.mcPromptTemplate).toContain('{{tier}}');
      expect(agent.mcPromptTemplate).toContain('{{difficulty}}');
    });
  });

  // ==========================================================================
  // Reading Agent Tests
  // ==========================================================================

  describe('Reading Agent', () => {
    let agent: DomainAgentConfig;

    beforeEach(() => {
      agent = getDomainAgent('reading');
    });

    it('should have Professor Lexia expert persona', () => {
      expect(agent.expertPersona).toContain('Professor Lexia');
      expect(agent.expertPersona).toContain('reading comprehension specialist');
    });

    it('should have comprehension levels in philosophy', () => {
      expect(agent.assessmentPhilosophy).toContain('LITERAL');
      expect(agent.assessmentPhilosophy).toContain('INFERENTIAL');
      expect(agent.assessmentPhilosophy).toContain('CRITICAL');
      expect(agent.assessmentPhilosophy).toContain('CONNECTIVE');
    });

    it('should have strand contexts for reading skills', () => {
      expect(agent.strandContexts['Key Ideas & Details']).toBeDefined();
      expect(agent.strandContexts['Craft & Structure']).toBeDefined();
      expect(agent.strandContexts['Literary Theory & Criticism']).toBeDefined();
    });
  });

  // ==========================================================================
  // Science Agent Tests
  // ==========================================================================

  describe('Science Agent', () => {
    let agent: DomainAgentConfig;

    beforeEach(() => {
      agent = getDomainAgent('science');
    });

    it('should have Dr. Empirica expert persona', () => {
      expect(agent.expertPersona).toContain('Dr. Empirica');
      expect(agent.expertPersona).toContain('science assessment specialist');
    });

    it('should mention NGSS principles', () => {
      expect(agent.expertPersona).toContain('NGSS');
    });

    it('should have common science misconceptions', () => {
      expect(agent.commonMisconceptions).toContain('Heavier objects fall faster');
      expect(agent.commonMisconceptions).toContain('Seasons caused by distance from sun');
    });

    it('should have strand contexts for science domains', () => {
      expect(agent.strandContexts['Physical Sciences (Newtonian)']).toBeDefined();
      expect(agent.strandContexts['Life Sciences (Cellular)']).toBeDefined();
      expect(agent.strandContexts['Quantum Mechanics']).toBeDefined();
    });
  });

  // ==========================================================================
  // Coding Agent Tests
  // ==========================================================================

  describe('Coding Agent', () => {
    let agent: DomainAgentConfig;

    beforeEach(() => {
      agent = getDomainAgent('coding');
    });

    it('should have Professor Syntax expert persona', () => {
      expect(agent.expertPersona).toContain('Professor Syntax');
      expect(agent.expertPersona).toContain('computer science education specialist');
    });

    it('should have common coding misconceptions', () => {
      expect(agent.commonMisconceptions).toContain('Off-by-one errors in loops');
      expect(agent.commonMisconceptions).toContain('Confusing pass-by-value vs pass-by-reference');
    });

    it('should have strand contexts for CS topics', () => {
      expect(agent.strandContexts['Algorithms & Logic']).toBeDefined();
      expect(agent.strandContexts['Data Structures']).toBeDefined();
      expect(agent.strandContexts['Distributed Systems']).toBeDefined();
    });
  });

  // ==========================================================================
  // Critical Thinking Agent Tests
  // ==========================================================================

  describe('Critical Thinking Agent', () => {
    let agent: DomainAgentConfig;

    beforeEach(() => {
      agent = getDomainAgent('critical_thinking');
    });

    it('should have Dr. Logos expert persona', () => {
      expect(agent.expertPersona).toContain('Dr. Logos');
      expect(agent.expertPersona).toContain('critical thinking and reasoning specialist');
    });

    it('should have strand contexts for reasoning topics', () => {
      expect(agent.strandContexts['Analysis & Evaluation']).toBeDefined();
      expect(agent.strandContexts['Logic & Reasoning (Formal)']).toBeDefined();
      expect(agent.strandContexts['Cognitive Bias Mitigation']).toBeDefined();
      expect(agent.strandContexts['Epistemology & Truth']).toBeDefined();
    });
  });

  // ==========================================================================
  // buildAgentSystemPrompt Tests
  // ==========================================================================

  describe('buildAgentSystemPrompt', () => {
    it('should build system prompt with all components', () => {
      const prompt = buildAgentSystemPrompt(
        'math',
        'Algebra I (Foundations)',
        'Bridge',
        0.65,
        'fluidity'
      );

      expect(prompt).toContain('Dr. Ada');
      expect(prompt).toContain('ASSESSMENT PHILOSOPHY');
      expect(prompt).toContain('QUALITY CRITERIA');
      expect(prompt).toContain('CURRENT TASK');
      expect(prompt).toContain('DIFFICULTY MARKERS');
      expect(prompt).toContain('COMMON MISCONCEPTIONS');
    });

    it('should include strand context', () => {
      const prompt = buildAgentSystemPrompt(
        'math',
        'Algebra I (Foundations)',
        'Bridge',
        0.65,
        'fluidity'
      );

      expect(prompt).toContain('Algebra I (Foundations)');
      expect(prompt).toContain('Linear equations');
    });

    it('should include difficulty with 2 decimal places', () => {
      const prompt = buildAgentSystemPrompt(
        'reading',
        'Key Ideas & Details',
        'Foundation',
        0.333333,
        'coherence'
      );

      expect(prompt).toContain('0.33');
    });

    it('should include tier-specific difficulty markers', () => {
      const foundationPrompt = buildAgentSystemPrompt(
        'math',
        'Arithmetic & Number Sense',
        'Foundation',
        0.25,
        'coherence'
      );

      expect(foundationPrompt).toContain('FOUNDATION');
      expect(foundationPrompt).toContain('Single-step calculations');
    });

    it('should include manifold cognitive focus', () => {
      const prompt = buildAgentSystemPrompt(
        'science',
        'Physical Sciences (Newtonian)',
        'Power',
        0.75,
        'entropy_intuition'
      );

      expect(prompt).toContain('Cognitive Focus: entropy_intuition');
    });

    it('should use strand name as context if not in strandContexts', () => {
      const prompt = buildAgentSystemPrompt(
        'math',
        'Unknown Strand',
        'Foundation',
        0.5,
        'coherence'
      );

      expect(prompt).toContain('Context: Unknown Strand');
    });

    it('should include up to 3 misconceptions', () => {
      const prompt = buildAgentSystemPrompt(
        'math',
        'Algebra I (Foundations)',
        'Bridge',
        0.5,
        'fluidity'
      );

      // Should contain some misconceptions but not all
      const misconceptionSection = prompt.split('COMMON MISCONCEPTIONS TO PROBE:')[1];
      const bulletPoints = misconceptionSection.split('•').length - 1;

      expect(bulletPoints).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // buildAgentEvaluationPrompt Tests
  // ==========================================================================

  describe('buildAgentEvaluationPrompt', () => {
    it('should build evaluation prompt with persona and guidance', () => {
      const prompt = buildAgentEvaluationPrompt('math');

      expect(prompt).toContain('Dr. Ada');
      expect(prompt).toContain('EVALUATION GUIDANCE');
      expect(prompt).toContain('PARTIAL CREDIT GUIDELINES');
    });

    it('should include stat-specific evaluation guidance', () => {
      const mathPrompt = buildAgentEvaluationPrompt('math');
      expect(mathPrompt).toContain('computational accuracy');

      const readingPrompt = buildAgentEvaluationPrompt('reading');
      expect(readingPrompt).toContain('textual evidence');

      const sciencePrompt = buildAgentEvaluationPrompt('science');
      expect(sciencePrompt).toContain('scientific accuracy');
    });

    it('should include partial credit guidelines', () => {
      const prompt = buildAgentEvaluationPrompt('coding');

      expect(prompt).toContain('70-90%');
      expect(prompt).toContain('syntax errors');
    });
  });

  // ==========================================================================
  // Agent Content Validation Tests
  // ==========================================================================

  describe('Agent Content Validation', () => {
    it('should have non-empty expert personas for all agents', () => {
      const agents = getAllDomainAgents();

      for (const agent of agents) {
        expect(agent.expertPersona.length).toBeGreaterThan(20);
      }
    });

    it('should have quality criteria for all agents', () => {
      const agents = getAllDomainAgents();

      for (const agent of agents) {
        expect(agent.qualityCriteria.length).toBeGreaterThan(0);
      }
    });

    it('should have at least one strand context for all agents', () => {
      const agents = getAllDomainAgents();

      for (const agent of agents) {
        expect(Object.keys(agent.strandContexts).length).toBeGreaterThan(0);
      }
    });

    it('should have common misconceptions for all agents', () => {
      const agents = getAllDomainAgents();

      for (const agent of agents) {
        expect(agent.commonMisconceptions.length).toBeGreaterThan(0);
      }
    });

    it('should have all prompt templates for all agents', () => {
      const agents = getAllDomainAgents();

      for (const agent of agents) {
        expect(agent.mcPromptTemplate.length).toBeGreaterThan(0);
        expect(agent.shortAnswerPromptTemplate.length).toBeGreaterThan(0);
        expect(agent.extendedResponseTemplate.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle case sensitivity in stat names', () => {
      // The function expects lowercase stat names as per StatName type
      expect(() => getDomainAgent('MATH' as any)).toThrow();
      expect(() => getDomainAgent('Math' as any)).toThrow();
    });

    it('should handle all tier cases in buildAgentSystemPrompt', () => {
      const tiers = ['Foundation', 'Bridge', 'Power', 'Horizon'] as const;

      for (const tier of tiers) {
        const prompt = buildAgentSystemPrompt('math', 'Arithmetic', tier, 0.5, 'coherence');
        expect(prompt).toContain(tier.toUpperCase());
      }
    });

    it('should handle all manifold dimensions', () => {
      const dimensions = [
        'coherence',
        'fluidity',
        'elasticity',
        'gradient_awareness',
        'entropy_intuition',
        'non_dual_resolution',
        'generativity',
      ] as const;

      for (const dim of dimensions) {
        const prompt = buildAgentSystemPrompt('math', 'Arithmetic', 'Foundation', 0.5, dim);
        expect(prompt).toContain(`Cognitive Focus: ${dim}`);
      }
    });

    it('should handle difficulty at boundary values', () => {
      const minDifficultyPrompt = buildAgentSystemPrompt(
        'math', 'Arithmetic', 'Foundation', 0, 'coherence'
      );
      expect(minDifficultyPrompt).toContain('0.00');

      const maxDifficultyPrompt = buildAgentSystemPrompt(
        'math', 'Arithmetic', 'Horizon', 1, 'generativity'
      );
      expect(maxDifficultyPrompt).toContain('1.00');
    });
  });
});
