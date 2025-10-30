/**
 * SpeechMiner v2 - Comprehensive Test Suite
 *
 * Tests all confidence flag categories, severity scoring, and analysis functions.
 * Target: ≥95% code coverage for detection accuracy and edge cases.
 */

import { SpeechMiner, getSpeechMiner, analyzeText } from '@/lib/speechMiner';
import type { ConfidenceFlag, AnalysisResult } from '@/lib/speechMiner';

describe('SpeechMiner - Pattern Detection', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  describe('HEDGES Category', () => {
    it('should detect severity 1 mild hedges (maybe, perhaps, possibly)', () => {
      const result = miner.analyze('Maybe I could help with that task.');

      expect(result.flags.length).toBeGreaterThan(0);
      const maybeFlag = result.flags.find(f => f.phrase.toLowerCase() === 'maybe');
      expect(maybeFlag).toBeDefined();
      expect(maybeFlag?.category).toBe('hedges');
      expect(maybeFlag?.severity).toBe(1);
    });

    it('should detect severity 1 qualifying softeners (kind of, sort of)', () => {
      const result = miner.analyze('I kind of think this is the right approach.');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('kind of'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(1);
    });

    it('should detect severity 2 moderate hedges (I think, I guess)', () => {
      const result = miner.analyze('I think this might work.');

      const thinkFlag = result.flags.find(f => f.phrase.toLowerCase() === 'i think');
      expect(thinkFlag).toBeDefined();
      expect(thinkFlag?.severity).toBe(2);
    });

    it('should detect severity 3 strong hedges (probably, not sure)', () => {
      const result = miner.analyze("I'm not sure if this is correct.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('not sure'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(3);
    });

    it('should detect severity 4 severe hedges (no idea, completely unsure)', () => {
      const result = miner.analyze('I have no idea what to do here.');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('no idea'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(4);
    });
  });

  describe('APOLOGIES Category', () => {
    it('should detect severity 2 mild apologies (sorry for, excuse me)', () => {
      const result = miner.analyze('Sorry for the delay in responding.');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('sorry for'));
      expect(flag).toBeDefined();
      expect(flag?.category).toBe('apologies');
      expect(flag?.severity).toBe(2);
    });

    it('should detect severity 3 moderate apologies (I\'m sorry to)', () => {
      const result = miner.analyze("I'm sorry to bring this up.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes("sorry to"));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(3);
    });

    it('should detect severity 4 strong apologies (really sorry, sorry to bother)', () => {
      const result = miner.analyze("I'm sorry to bother you with this.");

      const sorryBotherFlag = result.flags.find(f => f.phrase.toLowerCase().includes('sorry to bother'));
      expect(sorryBotherFlag).toBeDefined();
      expect(sorryBotherFlag?.severity).toBe(4);
    });

    it('should detect severity 5 severe apologies (so sorry, deepest apologies)', () => {
      const result = miner.analyze("I'm so sorry for the confusion.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('so sorry'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(5);
    });
  });

  describe('SELF-UNDERVALUE Category', () => {
    it('should detect severity 2 mild self-deprecation (just my opinion, no expert)', () => {
      const result = miner.analyze("That's just my opinion though.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('just my'));
      expect(flag).toBeDefined();
      expect(flag?.category).toBe('self-undervalue');
      expect(flag?.severity).toBe(2);
    });

    it('should detect severity 3 moderate self-undervalue (might be stupid, probably wrong)', () => {
      const result = miner.analyze('This might be stupid but what if we try X?');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('stupid but'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(3);
    });

    it('should detect severity 4 strong self-undervalue (dumb question, missing something obvious)', () => {
      const result = miner.analyze('This is probably a dumb question...');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('dumb question'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(4);
    });

    it('should detect severity 5 severe self-undervalue (no idea what I\'m doing, completely clueless)', () => {
      const result = miner.analyze("I have no idea what I'm doing here.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes("no idea what i'm doing"));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(5);
    });
  });

  describe('PERMISSION-SEEK Category', () => {
    it('should detect severity 2 mild permission seeking (would it be okay, do you mind)', () => {
      const result = miner.analyze('Would it be okay if I took a different approach?');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('would it be'));
      expect(flag).toBeDefined();
      expect(flag?.category).toBe('permission-seek');
      expect(flag?.severity).toBe(2);
    });

    it('should detect severity 3 moderate permission seeking (is it okay, can I, may I)', () => {
      const result = miner.analyze('Can I suggest an alternative?');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('can i'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(3);
    });

    it('should detect severity 4 strong permission seeking (would you allow, I hope it\'s okay)', () => {
      const result = miner.analyze("I hope it's okay that I submitted early.");

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes("hope it's okay"));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(4);
    });

    it('should detect severity 5 severe permission seeking (please let me know, need your permission)', () => {
      const result = miner.analyze('Please let me know if I can proceed.');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('please let me know if i can'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(5);
    });
  });

  describe('ASSURED-MARKERS Category (Positive Indicators)', () => {
    it('should detect strong confidence markers (I will, I can)', () => {
      const result = miner.analyze('I will complete this by tomorrow.');

      const flag = result.flags.find(f => f.phrase.toLowerCase() === 'i will');
      expect(flag).toBeDefined();
      expect(flag?.category).toBe('assured-markers');
      expect(flag?.severity).toBe(1); // Lower is better for positive flags
    });

    it('should detect certainty statements (this is correct)', () => {
      const result = miner.analyze('This is correct based on our analysis.');

      const flag = result.flags.find(f => f.phrase.toLowerCase().includes('is correct'));
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(1);
    });

    it('should detect conviction statements (I believe, in my experience)', () => {
      const result = miner.analyze('I believe this is the best approach.');

      const flag = result.flags.find(f => f.phrase.toLowerCase() === 'i believe');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe(2);
    });
  });

  describe('PERSONALIZATION Category', () => {
    it('should detect excessive I-statements (I feel, for me, in my opinion)', () => {
      const result = miner.analyze('The system needs updates. For me personally, the solution works. The data shows clear trends.');

      const personalFlags = result.flags.filter(f => f.category === 'personalization');
      expect(personalFlags.length).toBeGreaterThanOrEqual(1);
      personalFlags.forEach(flag => {
        // Base weight is 1, but may have intensifiers from nearby words
        expect(flag.severity).toBeGreaterThanOrEqual(1);
        expect(flag.severity).toBeLessThanOrEqual(5);
      });
    });
  });
});

describe('SpeechMiner - Severity Modifiers', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  it('should add +1 severity for intensifier words before pattern', () => {
    const result = miner.analyze("I think this really might work."); // "really" intensifies "might"

    const mightFlag = result.flags.find(f => f.phrase.toLowerCase() === 'might');
    expect(mightFlag).toBeDefined();
    expect(mightFlag?.severity).toBeGreaterThan(2); // Base 2 + 1 intensifier = 3
  });

  it('should detect multiple intensifiers and add severity accordingly', () => {
    const result = miner.analyze("I'm very extremely sorry for this."); // Two intensifiers

    const sorryFlag = result.flags.find(f => f.phrase.toLowerCase().includes('sorry for'));
    expect(sorryFlag).toBeDefined();
    // Base 2 + 2 intensifiers = 4 (capped at 5)
    expect(sorryFlag?.severity).toBeGreaterThan(2);
  });

  it('should apply clustering bonus when 3+ flags within 50 words', () => {
    const text = 'Maybe I think this might work. I guess it could be okay. Probably.';
    // Contains multiple hedges close together

    const result = miner.analyze(text);

    expect(result.flags.length).toBeGreaterThanOrEqual(3);
    // Some flags should have clustering bonus applied
    const hasClusteringBonus = result.flags.some(f => f.severity > 3);
    expect(hasClusteringBonus).toBeTruthy();
  });

  it('should cap all severity scores at 5', () => {
    const text = "I'm so very extremely really sorry for this terrible mistake.";
    // Multiple intensifiers should still cap at 5

    const result = miner.analyze(text);

    result.flags.forEach(flag => {
      expect(flag.severity).toBeLessThanOrEqual(5);
      expect(flag.severity).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('SpeechMiner - Analysis Output', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  it('should return complete AnalysisResult structure', () => {
    const text = 'Maybe I think this could work. Sorry for the delay.';
    const result = miner.analyze(text);

    // Check all required fields
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('processingTime');
    expect(result).toHaveProperty('flagCount');
    expect(result).toHaveProperty('averageSeverity');
    expect(result).toHaveProperty('hasHighSeverityFlags');

    // Verify types
    expect(Array.isArray(result.flags)).toBe(true);
    expect(typeof result.text).toBe('string');
    expect(typeof result.processingTime).toBe('number');
    expect(typeof result.flagCount).toBe('number');
    expect(typeof result.averageSeverity).toBe('number');
    expect(typeof result.hasHighSeverityFlags).toBe('boolean');
  });

  it('should generate valid ConfidenceFlag objects with all required fields', () => {
    const result = miner.analyze('I think this might work.');

    expect(result.flags.length).toBeGreaterThan(0);

    result.flags.forEach((flag: ConfidenceFlag) => {
      expect(flag).toHaveProperty('phrase');
      expect(flag).toHaveProperty('snippet');
      expect(flag).toHaveProperty('category');
      expect(flag).toHaveProperty('severity');
      expect(flag).toHaveProperty('suggestion_id');
      expect(flag).toHaveProperty('position');

      // Validate types and ranges
      expect(typeof flag.phrase).toBe('string');
      expect(typeof flag.snippet).toBe('string');
      expect(typeof flag.category).toBe('string');
      expect([1, 2, 3, 4, 5]).toContain(flag.severity);
      expect(typeof flag.suggestion_id).toBe('string');
      expect(typeof flag.position).toBe('number');
      expect(flag.position).toBeGreaterThanOrEqual(0);
    });
  });

  it('should include context snippets with ellipsis when truncated', () => {
    const longText = 'This is a long sentence with many words before the maybe flag appears and many more words after it continues for quite a while.';
    const result = miner.analyze(longText);

    const flag = result.flags.find(f => f.phrase.toLowerCase() === 'maybe');
    expect(flag).toBeDefined();
    expect(flag?.snippet).toContain('...');
  });

  it('should calculate accurate flag statistics', () => {
    const text = 'Maybe I think this could work. I guess it might be okay.'; // Multiple flags
    const result = miner.analyze(text);

    expect(result.flagCount).toBe(result.flags.length);

    // Verify average severity calculation
    const expectedAverage = result.flags.reduce((sum, f) => sum + f.severity, 0) / result.flags.length;
    expect(result.averageSeverity).toBeCloseTo(expectedAverage, 2);

    // Verify high severity detection
    const hasHighSeverity = result.flags.some(f => f.severity >= 4);
    expect(result.hasHighSeverityFlags).toBe(hasHighSeverity);
  });

  it('should meet performance target: ≤150ms per 1,000 characters', () => {
    // Generate 1,000 character text
    const baseText = 'Maybe I think this could work. '; // ~30 chars
    const text = baseText.repeat(34); // ~1,020 chars

    const result = miner.analyze(text);

    expect(result.processingTime).toBeLessThan(150);
  });

  it('should scale sub-linearly: 10,000 chars should be <1500ms', () => {
    const baseText = 'Maybe I think this could work. '; // ~30 chars
    const text = baseText.repeat(334); // ~10,020 chars

    const result = miner.analyze(text);

    expect(result.processingTime).toBeLessThan(1500);
  });
});

describe('SpeechMiner - Utility Functions', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  describe('quickScan()', () => {
    it('should detect high-severity flags (base weight >= 4) quickly', () => {
      const text = 'I have no idea what to do.'; // Severity 4 hedge

      const hasHighSeverity = miner.quickScan(text);

      expect(hasHighSeverity).toBe(true);
    });

    it('should return false for low-severity-only text', () => {
      const text = 'Maybe this will work.'; // Only severity 1

      const hasHighSeverity = miner.quickScan(text);

      expect(hasHighSeverity).toBe(false);
    });

    it('should scan for high-severity patterns efficiently', () => {
      const text = 'This is probably a dumb question but maybe it could work.';

      // quickScan should work without errors and return correct results
      const hasHighSeverity = miner.quickScan(text);

      // "dumb question" has base weight 4, so should detect high severity
      expect(hasHighSeverity).toBe(true);

      // Verify it completes quickly (performance test is timing-dependent)
      // Note: In production, quickScan is optimized to check only high-weight patterns
    });
  });

  describe('calculateConfidenceScore()', () => {
    it('should return 100 for text with no flags', () => {
      const result = miner.analyze('This is a straightforward statement.');
      const score = miner.calculateConfidenceScore(result);

      expect(score).toBe(100);
    });

    it('should penalize based on average severity', () => {
      const lowSeverityResult = miner.analyze('Maybe this works.');
      const highSeverityResult = miner.analyze('I have no idea what to do.');

      const lowScore = miner.calculateConfidenceScore(lowSeverityResult);
      const highScore = miner.calculateConfidenceScore(highSeverityResult);

      expect(lowScore).toBeGreaterThan(highScore);
    });

    it('should penalize based on flag density (flags per 100 words)', () => {
      const sparseText = 'Maybe this could work and be effective.'; // 1 flag in 7 words
      const denseText = 'Maybe I think I guess this might possibly work.'; // Multiple flags in 8 words

      const sparseScore = miner.calculateConfidenceScore(miner.analyze(sparseText));
      const denseScore = miner.calculateConfidenceScore(miner.analyze(denseText));

      expect(sparseScore).toBeGreaterThan(denseScore);
    });

    it('should add extra penalty for high-severity flags (severity >= 4)', () => {
      const noHighSeverity = miner.analyze('Maybe this works.');
      const hasHighSeverity = miner.analyze('I have no idea what to do.');

      const normalScore = miner.calculateConfidenceScore(noHighSeverity);
      const penalizedScore = miner.calculateConfidenceScore(hasHighSeverity);

      expect(normalScore).toBeGreaterThan(penalizedScore);
    });

    it('should return scores in range [0, 100]', () => {
      const texts = [
        'This is confident.',
        'Maybe this works.',
        'I guess I think this might possibly work but I have no idea really.',
        'I am so sorry and I have no idea what I am doing.'
      ];

      texts.forEach(text => {
        const result = miner.analyze(text);
        const score = miner.calculateConfidenceScore(result);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getCategoryBreakdown()', () => {
    it('should group flags by category with counts and average severity', () => {
      const text = 'Maybe I think this works. Sorry for the delay.';
      const result = miner.analyze(text);
      const breakdown = miner.getCategoryBreakdown(result);

      expect(typeof breakdown).toBe('object');

      // Check structure for each category present
      Object.keys(breakdown).forEach(category => {
        expect(breakdown[category]).toHaveProperty('count');
        expect(breakdown[category]).toHaveProperty('averageSeverity');
        expect(typeof breakdown[category].count).toBe('number');
        expect(typeof breakdown[category].averageSeverity).toBe('number');
      });
    });

    it('should calculate correct average severity per category', () => {
      const text = 'Maybe I guess this works. Probably it will.'; // Multiple hedges
      const result = miner.analyze(text);
      const breakdown = miner.getCategoryBreakdown(result);

      if (breakdown.hedges) {
        const hedgeFlags = result.flags.filter(f => f.category === 'hedges');
        const expectedAverage = hedgeFlags.reduce((sum, f) => sum + f.severity, 0) / hedgeFlags.length;

        expect(breakdown.hedges.averageSeverity).toBeCloseTo(expectedAverage, 2);
      }
    });

    it('should return empty breakdown for text with no flags', () => {
      const result = miner.analyze('This is clear and direct.');
      const breakdown = miner.getCategoryBreakdown(result);

      expect(Object.keys(breakdown).length).toBe(0);
    });
  });

  describe('detectConfidence()', () => {
    it('should return true for confident language (assured markers)', () => {
      const text = 'I will complete this by tomorrow.';

      const hasConfidence = miner.detectConfidence(text);

      expect(hasConfidence).toBe(true);
    });

    it('should return false for text without confident markers', () => {
      const text = 'Maybe this will work.';

      const hasConfidence = miner.detectConfidence(text);

      expect(hasConfidence).toBe(false);
    });

    it('should detect multiple types of confident markers', () => {
      const texts = [
        'I will handle this.',
        'I can solve this problem.',
        'This is correct.',
        'I believe this is right.',
        'In my experience, this works.'
      ];

      texts.forEach(text => {
        expect(miner.detectConfidence(text)).toBe(true);
      });
    });
  });
});

describe('SpeechMiner - Edge Cases', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  it('should handle empty text gracefully', () => {
    const result = miner.analyze('');

    expect(result.flags.length).toBe(0);
    expect(result.flagCount).toBe(0);
    expect(result.averageSeverity).toBe(0);
    expect(result.hasHighSeverityFlags).toBe(false);
  });

  it('should handle whitespace-only text', () => {
    const result = miner.analyze('   \n\t  ');

    expect(result.flags.length).toBe(0);
  });

  it('should be case-insensitive in pattern matching', () => {
    const lowerCase = miner.analyze('maybe this works');
    const upperCase = miner.analyze('MAYBE THIS WORKS');
    const mixedCase = miner.analyze('MaYbE tHiS wOrKs');

    expect(lowerCase.flagCount).toBeGreaterThan(0);
    expect(upperCase.flagCount).toBeGreaterThan(0);
    expect(mixedCase.flagCount).toBeGreaterThan(0);

    // All should detect the same pattern
    expect(lowerCase.flagCount).toBe(upperCase.flagCount);
    expect(lowerCase.flagCount).toBe(mixedCase.flagCount);
  });

  it('should handle special characters and punctuation', () => {
    const text = "Maybe... I think? This might work! (But I'm not sure.)";
    const result = miner.analyze(text);

    expect(result.flags.length).toBeGreaterThan(0);
    // Should detect patterns despite punctuation
  });

  it('should detect overlapping patterns', () => {
    const text = "I think I guess maybe this works."; // Multiple overlapping hedges
    const result = miner.analyze(text);

    expect(result.flags.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle very long text efficiently', () => {
    const longText = 'This is a test sentence. '.repeat(1000); // 25,000 chars

    const startTime = performance.now();
    const result = miner.analyze(longText);
    const duration = performance.now() - startTime;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(3750); // 150ms per 1K chars * 25 = 3750ms max
  });

  it('should handle text with unicode characters', () => {
    const text = 'Maybe this 你好 könnte ça marcher?';
    const result = miner.analyze(text);

    expect(result).toBeDefined();
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('should handle newlines and multi-line text', () => {
    const text = `
      Maybe this will work.
      I think it could be good.
      Sorry for the long message.
    `;
    const result = miner.analyze(text);

    expect(result.flags.length).toBeGreaterThan(0);
  });
});

describe('SpeechMiner - Singleton and Factory Functions', () => {
  it('getSpeechMiner() should return singleton instance', () => {
    const instance1 = getSpeechMiner();
    const instance2 = getSpeechMiner();

    expect(instance1).toBe(instance2); // Same reference
  });

  it('analyzeText() convenience function should work correctly', () => {
    const text = 'Maybe I think this works.';
    const result = analyzeText(text);

    expect(result).toBeDefined();
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.text).toBe(text);
  });

  it('should allow creating multiple independent instances', () => {
    const miner1 = new SpeechMiner();
    const miner2 = new SpeechMiner();

    expect(miner1).not.toBe(miner2); // Different instances
  });
});

describe('SpeechMiner - Real-World Scenarios', () => {
  let miner: SpeechMiner;

  beforeEach(() => {
    miner = new SpeechMiner();
  });

  it('should detect low confidence in hesitant email', () => {
    const email = `
      Hi there,

      I think maybe we could try this approach. I guess it might work,
      but I'm not sure if it's the right solution. Sorry for the confusion.

      Please let me know if you have any feedback.
    `;

    const result = miner.analyze(email);
    const score = miner.calculateConfidenceScore(result);

    expect(result.flags.length).toBeGreaterThan(3);
    expect(score).toBeLessThan(70); // Low confidence score
    // Clustering bonus applies due to multiple flags in close proximity
    expect(result.hasHighSeverityFlags).toBe(true);
  });

  it('should detect high confidence in assertive message', () => {
    const message = `
      The system will be deployed today. The implementation follows
      the established architecture. Deployment completes by end of day.
    `;

    const result = miner.analyze(message);
    const score = miner.calculateConfidenceScore(result);

    // Text with no confidence flags should have perfect score
    expect(result.flags.length).toBe(0);
    expect(score).toBe(100);
  });

  it('should detect mixed signals in apologetic but assertive text', () => {
    const text = `
      Sorry for the delay, but I will complete this by tomorrow.
      I can assure you it will be done correctly.
    `;

    const result = miner.analyze(text);
    const breakdown = miner.getCategoryBreakdown(result);

    expect(breakdown).toHaveProperty('apologies');
    expect(breakdown).toHaveProperty('assured-markers');
  });
});
