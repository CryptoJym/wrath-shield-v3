/**
 * Assured Word Engine (AWE) v1 - Integration Test Suite
 *
 * Tests Personal Phrase Bank integration with seed map,
 * learning mechanism, and suggestion generation.
 */

import {
  getAssuredWordEngine,
  getSuggestion,
  type AWESuggestion,
  type PhraseMapping,
} from '@/lib/assuredWordEngine';

describe('Assured Word Engine - Personal Phrase Bank Integration', () => {
  let awe: ReturnType<typeof getAssuredWordEngine>;

  beforeEach(() => {
    awe = getAssuredWordEngine();
    // Clear personal phrase bank before each test for isolation
    awe.clearPersonalPhraseBank();
  });

  describe('Seed Map Lookups', () => {
    it('should retrieve seed phrase suggestion for "maybe"', () => {
      const suggestion = awe.getSuggestion('maybe');

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('maybe');
      expect(suggestion?.category).toBe('hedges');
      expect(suggestion?.assured_alt).toBe('I will');
      expect(suggestion?.options).toEqual(['I will', 'I decide', "I'm proceeding"]);
      expect(suggestion?.lift_score).toBeCloseTo(0.18, 2);
    });

    it('should retrieve seed phrase suggestion for "I guess"', () => {
      const suggestion = awe.getSuggestion('I guess');

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('I guess');
      expect(suggestion?.category).toBe('hedges');
      expect(suggestion?.assured_alt).toBe('I know');
      expect(suggestion?.lift_score).toBeCloseTo(0.16, 2);
    });

    it('should retrieve seed phrase suggestion for "sorry for bothering"', () => {
      const suggestion = awe.getSuggestion('sorry for bothering');

      expect(suggestion).toBeDefined();
      expect(suggestion?.category).toBe('apologies');
      expect(suggestion?.assured_alt).toBe('Thank you for your time');
    });

    it('should handle case-insensitive lookups', () => {
      const lower = awe.getSuggestion('maybe');
      const upper = awe.getSuggestion('MAYBE');
      const mixed = awe.getSuggestion('Maybe');

      expect(lower).toBeDefined();
      expect(upper).toBeDefined();
      expect(mixed).toBeDefined();
      expect(lower?.assured_alt).toBe(upper?.assured_alt);
      expect(lower?.assured_alt).toBe(mixed?.assured_alt);
    });

    it('should return null for unknown phrases', () => {
      const suggestion = awe.getSuggestion('definitely not a phrase');

      expect(suggestion).toBeNull();
    });
  });

  describe('Personal Phrase Bank Integration', () => {
    it('should add personal phrase mapping', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'hopefully',
        canonical: 'hedge_hopefully',
        category: 'hedges',
        context_tags: ['email'],
        assured_alt: 'I expect',
        options: ['I expect', 'I anticipate', 'I plan'],
        lift_score: 0.15,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const suggestion = awe.getSuggestion('hopefully');
      expect(suggestion).toBeDefined();
      expect(suggestion?.assured_alt).toBe('I expect');
      expect(suggestion?.category).toBe('hedges');
    });

    it('should prioritize personal phrase bank over seed map', () => {
      // Add personal override for "maybe"
      const personalMapping: PhraseMapping = {
        phrase: 'maybe',
        canonical: 'hedge_maybe_personal',
        category: 'hedges',
        context_tags: ['work', 'personal'],
        assured_alt: 'I decide',
        options: ['I decide', 'I choose', 'I commit'],
        lift_score: 0.20,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const suggestion = awe.getSuggestion('maybe');
      expect(suggestion?.assured_alt).toBe('I decide');
      expect(suggestion?.lift_score).toBeCloseTo(0.20, 2);
    });

    it('should merge multiple personal phrase mappings', () => {
      const mappings: PhraseMapping[] = [
        {
          phrase: 'hopefully',
          canonical: 'hedge_hopefully',
          category: 'hedges',
          context_tags: ['email'],
          assured_alt: 'I expect',
          options: ['I expect', 'I anticipate', 'I plan'],
          lift_score: 0.15,
          enabled: true,
        },
        {
          phrase: 'kind of worried',
          canonical: 'self_undervalue_worried',
          category: 'self-undervalue',
          context_tags: ['self-talk'],
          assured_alt: 'I honor my concern',
          options: ['I honor my concern', 'I acknowledge this', 'I respect my feelings'],
          lift_score: 0.12,
          enabled: true,
        },
      ];

      awe.mergePersonalPhraseBank(mappings);

      const hopefully = awe.getSuggestion('hopefully');
      const worried = awe.getSuggestion('kind of worried');

      expect(hopefully?.assured_alt).toBe('I expect');
      expect(worried?.assured_alt).toBe('I honor my concern');
    });

    it('should respect enabled/disabled state', () => {
      const disabledMapping: PhraseMapping = {
        phrase: 'disabled phrase',
        canonical: 'test_disabled',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test',
        options: ['test'],
        lift_score: 0.1,
        enabled: false,
      };

      awe.addPersonalMapping(disabledMapping);

      const suggestion = awe.getSuggestion('disabled phrase');
      expect(suggestion).toBeNull();
    });

    it('should toggle phrase enabled state', () => {
      const mapping: PhraseMapping = {
        phrase: 'test phrase',
        canonical: 'test_toggle',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test alt',
        options: ['test alt'],
        lift_score: 0.1,
        enabled: true,
      };

      awe.addPersonalMapping(mapping);

      // Initially enabled
      let suggestion = awe.getSuggestion('test phrase');
      expect(suggestion).toBeDefined();

      // Disable
      awe.setMappingEnabled('test phrase', false);
      suggestion = awe.getSuggestion('test phrase');
      expect(suggestion).toBeNull();

      // Re-enable
      awe.setMappingEnabled('test phrase', true);
      suggestion = awe.getSuggestion('test phrase');
      expect(suggestion).toBeDefined();
    });
  });

  describe('Partial Phrase Matching', () => {
    it('should match "maybe" in "maybe we should"', () => {
      const suggestion = awe.getSuggestion('maybe we should');

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('maybe');
    });

    it('should match "I guess" in "I guess that works"', () => {
      const suggestion = awe.getSuggestion('I guess that works');

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('I guess');
    });

    it('should prioritize exact matches over partial matches', () => {
      // Add a phrase that contains another phrase
      const longMapping: PhraseMapping = {
        phrase: 'I guess not',
        canonical: 'hedge_guess_not',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'I decide no',
        options: ['I decide no'],
        lift_score: 0.2,
        enabled: true,
      };

      awe.addPersonalMapping(longMapping);

      // Exact match should be prioritized
      const exactMatch = awe.getSuggestion('I guess not');
      expect(exactMatch?.assured_alt).toBe('I decide no');

      // Partial match should fall back to seed phrase
      const partialMatch = awe.getSuggestion('I guess');
      expect(partialMatch?.assured_alt).toBe('I know');
    });
  });

  describe('Learning Mechanism (assured_fit)', () => {
    it('should update assured_fit for seed phrase', () => {
      awe.updateAssuredFit('maybe', 8);

      const suggestion = awe.getSuggestion('maybe');
      expect(suggestion).toBeDefined();

      // fit=8 → fitMultiplier = 0.5 + (8/10)*0.5 = 0.9
      // lift_score = 0.18 * 0.9 = 0.162
      expect(suggestion?.lift_score).toBeCloseTo(0.162, 3);
    });

    it('should update assured_fit for personal phrase', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'hopefully',
        canonical: 'hedge_hopefully',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'I expect',
        options: ['I expect'],
        lift_score: 0.15,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);
      awe.updateAssuredFit('hopefully', 10);

      const suggestion = awe.getSuggestion('hopefully');

      // fit=10 → fitMultiplier = 0.5 + (10/10)*0.5 = 1.0
      // lift_score = 0.15 * 1.0 = 0.15 (unchanged at max)
      expect(suggestion?.lift_score).toBeCloseTo(0.15, 3);
    });

    it('should apply fit scaling correctly (fit=5 → 1.0x)', () => {
      awe.updateAssuredFit('I guess', 5);

      const suggestion = awe.getSuggestion('I guess');

      // fit=5 → fitMultiplier = 0.5 + (5/10)*0.5 = 0.75
      // lift_score = 0.16 * 0.75 = 0.12
      expect(suggestion?.lift_score).toBeCloseTo(0.12, 3);
    });

    it('should apply fit scaling correctly (fit=1 → 0.5x)', () => {
      awe.updateAssuredFit('maybe', 1);

      const suggestion = awe.getSuggestion('maybe');

      // fit=1 → fitMultiplier = 0.5 + (1/10)*0.5 = 0.55
      // lift_score = 0.18 * 0.55 = 0.099
      expect(suggestion?.lift_score).toBeCloseTo(0.099, 3);
    });

    it('should throw error for invalid assured_fit range', () => {
      expect(() => awe.updateAssuredFit('maybe', 0)).toThrow('assured_fit must be between 1 and 10');
      expect(() => awe.updateAssuredFit('maybe', 11)).toThrow('assured_fit must be between 1 and 10');
      expect(() => awe.updateAssuredFit('maybe', -5)).toThrow('assured_fit must be between 1 and 10');
    });

    it('should copy seed phrase to personal bank when updating assured_fit', () => {
      // Update assured_fit on seed phrase
      awe.updateAssuredFit('maybe', 8);

      // Add a different personal override for the same phrase
      const personalMapping: PhraseMapping = {
        phrase: 'maybe',
        canonical: 'hedge_maybe_override',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'I choose',
        options: ['I choose'],
        lift_score: 0.25,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      // Personal mapping should now have priority with its own assured_fit
      const suggestion = awe.getSuggestion('maybe');
      expect(suggestion?.assured_alt).toBe('I choose');

      // Should use the personal mapping's lift_score, not the seed with fit
      expect(suggestion?.lift_score).toBeCloseTo(0.25, 3);
    });
  });

  describe('getAllMappings()', () => {
    it('should return all seed mappings', () => {
      const mappings = awe.getAllMappings();

      expect(mappings.length).toBeGreaterThanOrEqual(6); // 6 seed phrases from PRD
      expect(mappings.some(m => m.phrase === 'maybe')).toBe(true);
      expect(mappings.some(m => m.phrase === 'I guess')).toBe(true);
    });

    it('should merge personal mappings with seed mappings', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'new phrase',
        canonical: 'test_new',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test',
        options: ['test'],
        lift_score: 0.1,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const mappings = awe.getAllMappings();
      expect(mappings.some(m => m.phrase === 'new phrase')).toBe(true);
      expect(mappings.some(m => m.phrase === 'maybe')).toBe(true);
    });

    it('should override seed mappings with personal mappings by canonical ID', () => {
      // Add personal mapping with same canonical as seed phrase
      const personalOverride: PhraseMapping = {
        phrase: 'maybe',
        canonical: 'hedge_maybe', // Same canonical as seed
        category: 'hedges',
        context_tags: ['custom'],
        assured_alt: 'Custom alternative',
        options: ['Custom alternative'],
        lift_score: 0.99,
        enabled: true,
        assured_fit: 10,
      };

      awe.addPersonalMapping(personalOverride);

      const mappings = awe.getAllMappings();
      const maybeMapping = mappings.find(m => m.canonical === 'hedge_maybe');

      expect(maybeMapping?.assured_alt).toBe('Custom alternative');
      expect(maybeMapping?.lift_score).toBeCloseTo(0.99, 2);
      expect(maybeMapping?.assured_fit).toBe(10);
    });
  });

  describe('getMappingsByCategory()', () => {
    it('should filter by hedges category', () => {
      const hedges = awe.getMappingsByCategory('hedges');

      expect(hedges.length).toBeGreaterThan(0);
      expect(hedges.every(m => m.category === 'hedges')).toBe(true);
      expect(hedges.some(m => m.phrase === 'maybe')).toBe(true);
      expect(hedges.some(m => m.phrase === 'I guess')).toBe(true);
    });

    it('should filter by apologies category', () => {
      const apologies = awe.getMappingsByCategory('apologies');

      expect(apologies.length).toBeGreaterThan(0);
      expect(apologies.every(m => m.category === 'apologies')).toBe(true);
      expect(apologies.some(m => m.phrase === 'sorry for bothering')).toBe(true);
    });

    it('should include personal mappings in category filter', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'hopefully',
        canonical: 'hedge_hopefully',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'I expect',
        options: ['I expect'],
        lift_score: 0.15,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const hedges = awe.getMappingsByCategory('hedges');
      expect(hedges.some(m => m.phrase === 'hopefully')).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getAssuredWordEngine();
      const instance2 = getAssuredWordEngine();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across calls', () => {
      const instance1 = getAssuredWordEngine();

      const personalMapping: PhraseMapping = {
        phrase: 'singleton test',
        canonical: 'test_singleton',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test',
        options: ['test'],
        lift_score: 0.1,
        enabled: true,
      };

      instance1.addPersonalMapping(personalMapping);

      const instance2 = getAssuredWordEngine();
      const suggestion = instance2.getSuggestion('singleton test');

      expect(suggestion).toBeDefined();
      expect(suggestion?.assured_alt).toBe('test');
    });
  });

  describe('Convenience Function (getSuggestion)', () => {
    it('should work via convenience function', () => {
      const suggestion = getSuggestion('maybe');

      expect(suggestion).toBeDefined();
      expect(suggestion?.assured_alt).toBe('I will');
    });

    it('should use singleton instance', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'convenience test',
        canonical: 'test_convenience',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test alt',
        options: ['test alt'],
        lift_score: 0.1,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const suggestion = getSuggestion('convenience test');
      expect(suggestion?.assured_alt).toBe('test alt');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      const suggestion = awe.getSuggestion('');
      expect(suggestion).toBeNull();
    });

    it('should handle whitespace-only string', () => {
      const suggestion = awe.getSuggestion('   \n\t  ');
      expect(suggestion).toBeNull();
    });

    it('should trim input before lookup', () => {
      const suggestion = awe.getSuggestion('  maybe  ');

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('maybe');
    });

    it('should handle very long phrases', () => {
      const longPhrase = 'maybe ' + 'word '.repeat(100);
      const suggestion = awe.getSuggestion(longPhrase);

      expect(suggestion).toBeDefined();
      expect(suggestion?.original_phrase).toBe('maybe');
    });

    it('should clear personal phrase bank', () => {
      const mapping: PhraseMapping = {
        phrase: 'test clear',
        canonical: 'test_clear',
        category: 'hedges',
        context_tags: [],
        assured_alt: 'test',
        options: ['test'],
        lift_score: 0.1,
        enabled: true,
      };

      awe.addPersonalMapping(mapping);
      expect(awe.getSuggestion('test clear')).toBeDefined();

      awe.clearPersonalPhraseBank();
      expect(awe.getSuggestion('test clear')).toBeNull();
    });

    it('should preserve seed map after clearing personal bank', () => {
      awe.clearPersonalPhraseBank();

      const suggestion = awe.getSuggestion('maybe');
      expect(suggestion).toBeDefined();
      expect(suggestion?.assured_alt).toBe('I will');
    });
  });

  describe('Context Tags', () => {
    it('should preserve context tags in suggestions', () => {
      const suggestion = awe.getSuggestion('maybe');

      expect(suggestion?.context_tags).toContain('work');
      expect(suggestion?.context_tags).toContain('co-parent');
      expect(suggestion?.context_tags).toContain('planning');
    });

    it('should support custom context tags in personal mappings', () => {
      const personalMapping: PhraseMapping = {
        phrase: 'custom context',
        canonical: 'test_context',
        category: 'hedges',
        context_tags: ['email', 'urgent', 'client'],
        assured_alt: 'test',
        options: ['test'],
        lift_score: 0.1,
        enabled: true,
      };

      awe.addPersonalMapping(personalMapping);

      const suggestion = awe.getSuggestion('custom context');
      expect(suggestion?.context_tags).toEqual(['email', 'urgent', 'client']);
    });
  });
});
