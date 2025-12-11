// @ts-nocheck
/**
 * Tests for HYRO FORGE: Educational AI Prompts
 *
 * Tests the age-appropriate system prompts for evaluating 10-year-old responses,
 * Socratic questioning, and constructive feedback systems.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Import after any mocks
import {
  getEvaluationSystemPrompt,
  getFollowUpPrompt,
  buildEducationalContext,
  getMisconceptionPrompt,
  getConfidenceCalibrationPrompt,
  FEEDBACK_TEMPLATES,
  AGE_APPROPRIATE_TERMS,
} from '../../../lib/hyro/forge-educational-prompts';
import type { EducationalEvaluationRequest } from '../../../lib/hyro/forge-educational-prompts';

describe('HYRO FORGE: Educational AI Prompts', () => {
  // ==========================================================================
  // getEvaluationSystemPrompt Tests
  // ==========================================================================

  describe('getEvaluationSystemPrompt', () => {
    it('should include core educational principles', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('EDUCATIONAL CONTEXT');
      expect(prompt).toContain('10 years old');
      expect(prompt).toContain('Socratic inquiry');
    });

    it('should include content safety guidelines', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('CONTENT SAFETY');
      expect(prompt).toContain('age-appropriate');
      expect(prompt).toContain('Never shame or discourage');
    });

    it('should include scoring rubric', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('SCORING RUBRIC (0-100)');
      expect(prompt).toContain('EVIDENCE USE (0-25 points)');
      expect(prompt).toContain('REASONING (0-25 points)');
      expect(prompt).toContain('ANALYSIS DEPTH (0-25 points)');
      expect(prompt).toContain('CONNECTION (0-25 points)');
    });

    it('should include depth rating guidance', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('DEPTH RATING');
      expect(prompt).toContain('surface');
      expect(prompt).toContain('moderate');
      expect(prompt).toContain('deep');
    });

    it('should include JSON output format', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('valid JSON');
      expect(prompt).toContain('"score"');
      expect(prompt).toContain('"feedback"');
      expect(prompt).toContain('"strengths"');
      expect(prompt).toContain('"growth_areas"');
      expect(prompt).toContain('"depth_rating"');
      expect(prompt).toContain('"rubric_scores"');
    });

    it('should include type-specific guidance for analysis', () => {
      const prompt = getEvaluationSystemPrompt('analysis');

      expect(prompt).toContain('PROMPT TYPE: ANALYSIS');
      expect(prompt).toContain('character motivations');
      expect(prompt).toContain('textual evidence');
    });

    it('should include type-specific guidance for connection', () => {
      const prompt = getEvaluationSystemPrompt('connection');

      expect(prompt).toContain('PROMPT TYPE: CONNECTION');
      expect(prompt).toContain('own life experiences');
      expect(prompt).toContain('real-world events');
    });

    it('should include type-specific guidance for prediction', () => {
      const prompt = getEvaluationSystemPrompt('prediction');

      expect(prompt).toContain('PROMPT TYPE: PREDICTION');
      expect(prompt).toContain('predictions');
      expect(prompt).toContain('character patterns');
    });

    it('should include type-specific guidance for creation', () => {
      const prompt = getEvaluationSystemPrompt('creation');

      expect(prompt).toContain('PROMPT TYPE: CREATION');
      expect(prompt).toContain('creativity');
      expect(prompt).toContain('originality');
    });

    it('should include type-specific guidance for meta', () => {
      const prompt = getEvaluationSystemPrompt('meta');

      expect(prompt).toContain('PROMPT TYPE: METACOGNITION');
      expect(prompt).toContain('learning process');
      expect(prompt).toContain('Self-awareness');
    });

    it('should handle unknown prompt type with general evaluation', () => {
      const prompt = getEvaluationSystemPrompt('unknown' as any);

      expect(prompt).toContain('GENERAL EVALUATION');
    });
  });

  // ==========================================================================
  // getFollowUpPrompt Tests
  // ==========================================================================

  describe('getFollowUpPrompt', () => {
    it('should include educational principles', () => {
      const prompt = getFollowUpPrompt(
        'Why did the character make that choice?',
        'I think they were scared.',
        60,
        'analysis'
      );

      expect(prompt).toContain('EDUCATIONAL CONTEXT');
      expect(prompt).toContain('10-year-old');
    });

    it('should include original question and response', () => {
      const originalPrompt = 'Why did the character make that choice?';
      const studentResponse = 'I think they were scared.';

      const prompt = getFollowUpPrompt(originalPrompt, studentResponse, 60, 'analysis');

      expect(prompt).toContain('ORIGINAL QUESTION');
      expect(prompt).toContain(originalPrompt);
      expect(prompt).toContain("STUDENT'S RESPONSE");
      expect(prompt).toContain(studentResponse);
    });

    it('should include evaluation score', () => {
      const prompt = getFollowUpPrompt('Question?', 'Response', 75, 'analysis');

      expect(prompt).toContain('EVALUATION SCORE: 75/100');
    });

    it('should include tone guidelines', () => {
      const prompt = getFollowUpPrompt('Question?', 'Response', 60, 'analysis');

      expect(prompt).toContain('TONE GUIDELINES');
      expect(prompt).toContain('conversational');
      expect(prompt).toContain('Age-appropriate');
    });

    it('should include JSON output format for follow-up', () => {
      const prompt = getFollowUpPrompt('Question?', 'Response', 60, 'analysis');

      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('"follow_up"');
      expect(prompt).toContain('"follow_up_type"');
    });

    it('should provide affirm guidance for high scores (80+)', () => {
      const prompt = getFollowUpPrompt('Question?', 'Great response!', 85, 'analysis');

      expect(prompt).toContain('Celebrates their insight');
      expect(prompt).toContain('Type: "affirm"');
    });

    it('should provide probe_deeper guidance for good scores (60-79)', () => {
      const prompt = getFollowUpPrompt('Question?', 'Good response', 65, 'analysis');

      expect(prompt).toContain('Probes deeper');
      expect(prompt).toContain('Type: "probe_deeper"');
    });

    it('should provide redirect guidance for moderate scores (40-59)', () => {
      const prompt = getFollowUpPrompt('Question?', 'Basic response', 45, 'analysis');

      expect(prompt).toContain('Gently redirects');
      expect(prompt).toContain('Type: "redirect"');
    });

    it('should provide supportive guidance for low scores (<40)', () => {
      const prompt = getFollowUpPrompt('Question?', 'Struggling response', 25, 'analysis');

      expect(prompt).toContain('Provides scaffolding');
      expect(prompt).toContain('Type: "redirect"');
    });
  });

  // ==========================================================================
  // buildEducationalContext Tests
  // ==========================================================================

  describe('buildEducationalContext', () => {
    it('should include child name when provided', () => {
      const context = buildEducationalContext({
        childName: 'Alex',
      });

      expect(context).toContain('STUDENT: Alex');
    });

    it('should include current stats when provided', () => {
      const context = buildEducationalContext({
        currentStats: {
          reading: 75,
          math: 68,
        },
      });

      expect(context).toContain('CURRENT SKILL LEVELS');
      expect(context).toContain('reading: 75/100');
      expect(context).toContain('math: 68/100');
    });

    it('should include recent patterns when provided', () => {
      const context = buildEducationalContext({
        recentPatterns: [
          'Strong in character analysis',
          'Working on making predictions',
        ],
      });

      expect(context).toContain('RECENT LEARNING PATTERNS');
      expect(context).toContain('1. Strong in character analysis');
      expect(context).toContain('2. Working on making predictions');
    });

    it('should include book context when provided', () => {
      const context = buildEducationalContext({
        bookContext: 'Currently reading Charlotte\'s Web',
      });

      expect(context).toContain('BOOK CONTEXT');
      expect(context).toContain("Charlotte's Web");
    });

    it('should combine all parameters', () => {
      const context = buildEducationalContext({
        childName: 'Jordan',
        currentStats: { reading: 80 },
        recentPatterns: ['Making progress'],
        bookContext: 'Harry Potter',
      });

      expect(context).toContain('STUDENT: Jordan');
      expect(context).toContain('CURRENT SKILL LEVELS');
      expect(context).toContain('RECENT LEARNING PATTERNS');
      expect(context).toContain('BOOK CONTEXT');
    });

    it('should return empty string for empty params', () => {
      const context = buildEducationalContext({});

      expect(context).toBe('');
    });

    it('should skip empty stats object', () => {
      const context = buildEducationalContext({
        currentStats: {},
      });

      expect(context).not.toContain('CURRENT SKILL LEVELS');
    });

    it('should skip empty patterns array', () => {
      const context = buildEducationalContext({
        recentPatterns: [],
      });

      expect(context).not.toContain('RECENT LEARNING PATTERNS');
    });
  });

  // ==========================================================================
  // getMisconceptionPrompt Tests
  // ==========================================================================

  describe('getMisconceptionPrompt', () => {
    it('should include educational principles', () => {
      const prompt = getMisconceptionPrompt(
        ['Misconception 1', 'Misconception 2'],
        'Student response here'
      );

      expect(prompt).toContain('EDUCATIONAL CONTEXT');
    });

    it('should list misconceptions', () => {
      const misconceptions = [
        'Characters always tell the truth',
        'The protagonist is always good',
      ];

      const prompt = getMisconceptionPrompt(misconceptions, 'Response');

      expect(prompt).toContain('COMMON MISCONCEPTIONS FOR THIS QUESTION');
      expect(prompt).toContain('1. Characters always tell the truth');
      expect(prompt).toContain('2. The protagonist is always good');
    });

    it('should include student response', () => {
      const response = 'I think the main character never lies.';
      const prompt = getMisconceptionPrompt(['Misconception'], response);

      expect(prompt).toContain("STUDENT'S RESPONSE");
      expect(prompt).toContain(response);
    });

    it('should include JSON output format', () => {
      const prompt = getMisconceptionPrompt(['Misconception'], 'Response');

      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('"has_misconception"');
      expect(prompt).toContain('"misconception_detected"');
      expect(prompt).toContain('"gentle_correction"');
    });
  });

  // ==========================================================================
  // getConfidenceCalibrationPrompt Tests
  // ==========================================================================

  describe('getConfidenceCalibrationPrompt', () => {
    it('should include educational principles', () => {
      const prompt = getConfidenceCalibrationPrompt('Response', 75);

      expect(prompt).toContain('EDUCATIONAL CONTEXT');
    });

    it('should include student response', () => {
      const response = 'I definitely know this is correct!';
      const prompt = getConfidenceCalibrationPrompt(response, 60);

      expect(prompt).toContain("STUDENT'S RESPONSE");
      expect(prompt).toContain(response);
    });

    it('should include actual evaluation score', () => {
      const prompt = getConfidenceCalibrationPrompt('Response', 82);

      expect(prompt).toContain('ACTUAL EVALUATION SCORE: 82/100');
    });

    it('should include confidence indicators to consider', () => {
      const prompt = getConfidenceCalibrationPrompt('Response', 70);

      expect(prompt).toContain('Consider:');
      expect(prompt).toContain('Response length');
      expect(prompt).toContain('definitive language');
      expect(prompt).toContain('hedging');
    });

    it('should include JSON output format', () => {
      const prompt = getConfidenceCalibrationPrompt('Response', 70);

      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('"estimated_confidence"');
      expect(prompt).toContain('"calibration_assessment"');
      expect(prompt).toContain('"coaching_note"');
    });

    it('should include calibration assessment options', () => {
      const prompt = getConfidenceCalibrationPrompt('Response', 70);

      expect(prompt).toContain('well_calibrated');
      expect(prompt).toContain('over_confident');
      expect(prompt).toContain('under_confident');
    });
  });

  // ==========================================================================
  // FEEDBACK_TEMPLATES Tests
  // ==========================================================================

  describe('FEEDBACK_TEMPLATES', () => {
    it('should have exceptional templates', () => {
      expect(FEEDBACK_TEMPLATES.exceptional).toBeDefined();
      expect(FEEDBACK_TEMPLATES.exceptional.length).toBeGreaterThan(0);
    });

    it('should have strong templates', () => {
      expect(FEEDBACK_TEMPLATES.strong).toBeDefined();
      expect(FEEDBACK_TEMPLATES.strong.length).toBeGreaterThan(0);
    });

    it('should have moderate templates', () => {
      expect(FEEDBACK_TEMPLATES.moderate).toBeDefined();
      expect(FEEDBACK_TEMPLATES.moderate.length).toBeGreaterThan(0);
    });

    it('should have developing templates', () => {
      expect(FEEDBACK_TEMPLATES.developing).toBeDefined();
      expect(FEEDBACK_TEMPLATES.developing.length).toBeGreaterThan(0);
    });

    it('should have {strength} placeholder in templates', () => {
      for (const level of ['exceptional', 'strong', 'moderate'] as const) {
        const hasStrengthPlaceholder = FEEDBACK_TEMPLATES[level].some(
          t => t.includes('{strength}')
        );
        expect(hasStrengthPlaceholder).toBe(true);
      }
    });

    it('should have {growth} placeholder in moderate and developing', () => {
      const moderateHasGrowth = FEEDBACK_TEMPLATES.moderate.some(
        t => t.includes('{growth}')
      );
      const developingHasGrowth = FEEDBACK_TEMPLATES.developing.some(
        t => t.includes('{growth}')
      );

      expect(moderateHasGrowth).toBe(true);
      expect(developingHasGrowth).toBe(true);
    });

    it('should use encouraging language', () => {
      const allTemplates = [
        ...FEEDBACK_TEMPLATES.exceptional,
        ...FEEDBACK_TEMPLATES.strong,
        ...FEEDBACK_TEMPLATES.moderate,
        ...FEEDBACK_TEMPLATES.developing,
      ];

      const encouragingWords = ['Great', 'Good', 'Nice', 'Wow', 'Excellent'];
      const hasEncouraging = allTemplates.some(
        t => encouragingWords.some(w => t.includes(w))
      );

      expect(hasEncouraging).toBe(true);
    });
  });

  // ==========================================================================
  // AGE_APPROPRIATE_TERMS Tests
  // ==========================================================================

  describe('AGE_APPROPRIATE_TERMS', () => {
    it('should have academic to kid-friendly mappings', () => {
      expect(AGE_APPROPRIATE_TERMS['analysis']).toBe('thinking carefully about');
      expect(AGE_APPROPRIATE_TERMS['synthesis']).toBe('putting ideas together');
      expect(AGE_APPROPRIATE_TERMS['inference']).toBe('figuring out');
    });

    it('should have literary term mappings', () => {
      expect(AGE_APPROPRIATE_TERMS['metaphor']).toBe('comparison');
      expect(AGE_APPROPRIATE_TERMS['protagonist']).toBe('main character');
      expect(AGE_APPROPRIATE_TERMS['antagonist']).toBe('character causing problems');
    });

    it('should have story element mappings', () => {
      expect(AGE_APPROPRIATE_TERMS['conflict']).toBe('problem');
      expect(AGE_APPROPRIATE_TERMS['resolution']).toBe('how it got solved');
      expect(AGE_APPROPRIATE_TERMS['theme']).toBe('big idea');
    });

    it('should have evidence/support mappings', () => {
      expect(AGE_APPROPRIATE_TERMS['evidence']).toBe('examples from the book');
      expect(AGE_APPROPRIATE_TERMS['perspective']).toBe('point of view');
    });

    it('should have character analysis mappings', () => {
      expect(AGE_APPROPRIATE_TERMS['characterization']).toBe('what the character is like');
      expect(AGE_APPROPRIATE_TERMS['motivation']).toBe('why they did it');
    });

    it('should use simpler language in all mappings', () => {
      for (const [academic, simple] of Object.entries(AGE_APPROPRIATE_TERMS)) {
        // Simple terms should generally be shorter or use common words
        expect(simple.length).toBeGreaterThan(0);
        // Should not contain overly complex words
        expect(simple).not.toContain('synthesis');
        expect(simple).not.toContain('inference');
        expect(simple).not.toContain('characterization');
      }
    });
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('EducationalEvaluationRequest Type', () => {
    it('should define evaluation request structure', () => {
      const request: EducationalEvaluationRequest = {
        prompt: 'Why did the character do that?',
        promptType: 'analysis',
        studentResponse: 'Because they were scared.',
      };

      expect(request.prompt).toBeDefined();
      expect(request.promptType).toBeDefined();
      expect(request.studentResponse).toBeDefined();
    });

    it('should accept optional parameters', () => {
      const request: EducationalEvaluationRequest = {
        prompt: 'Question?',
        promptType: 'connection',
        studentResponse: 'Answer',
        rubric: { key: 'value' },
        bookContext: 'Book info',
        childName: 'Student',
        currentStats: { reading: 75 },
        recentPatterns: ['Pattern 1'],
      };

      expect(request.rubric).toBeDefined();
      expect(request.bookContext).toBeDefined();
      expect(request.childName).toBeDefined();
      expect(request.currentStats).toBeDefined();
      expect(request.recentPatterns).toBeDefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty student response in follow-up', () => {
      const prompt = getFollowUpPrompt('Question?', '', 0, 'analysis');

      expect(prompt).toContain("STUDENT'S RESPONSE");
    });

    it('should handle very long responses', () => {
      const longResponse = 'A '.repeat(1000);
      const prompt = getFollowUpPrompt('Question?', longResponse, 50, 'analysis');

      expect(prompt).toContain(longResponse);
    });

    it('should handle special characters in prompts', () => {
      const prompt = getFollowUpPrompt(
        'What\'s the "main" idea?',
        'It\'s about <friendship>',
        70,
        'analysis'
      );

      expect(prompt).toContain("What's");
      expect(prompt).toContain('"main"');
    });

    it('should handle score boundary values', () => {
      // Score 0
      const zeroPrompt = getFollowUpPrompt('Q?', 'R', 0, 'analysis');
      expect(zeroPrompt).toContain('Provides scaffolding');

      // Score 100
      const perfectPrompt = getFollowUpPrompt('Q?', 'R', 100, 'analysis');
      expect(perfectPrompt).toContain('Celebrates their insight');
    });

    it('should handle all prompt types in evaluation', () => {
      const types = ['analysis', 'connection', 'prediction', 'creation', 'meta'] as const;

      for (const type of types) {
        const prompt = getEvaluationSystemPrompt(type);
        expect(prompt.length).toBeGreaterThan(100);
      }
    });

    it('should handle misconceptions with empty array', () => {
      const prompt = getMisconceptionPrompt([], 'Response');

      expect(prompt).toContain('COMMON MISCONCEPTIONS');
    });
  });
});
