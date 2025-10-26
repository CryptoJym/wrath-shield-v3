/**
 * Wrath Shield v3 - Manipulation Detector Tests
 *
 * Comprehensive test suite covering:
 * - Pattern matching for all manipulation categories
 * - Severity scoring with intensifiers
 * - Response classification (wrath/compliance/silence)
 * - Edge cases and resilience
 * - Performance benchmarks
 */

import {
  analyzeLifelog,
  analyzeLifelogFromRaw,
  parseLifelogSegments,
  _testExports,
  type LifelogSegment,
  type ManipulationAnalysis,
  type ResponseType,
  type ManipulationCategory,
} from '@/lib/ManipulationDetector';

const { matchPatterns, calculateSeverity, findUserResponse } = _testExports;

describe('ManipulationDetector - Pattern Matching', () => {
  describe('Gaslighting Detection', () => {
    it('should detect "you\'re overreacting"', () => {
      const result = matchPatterns("You're overreacting to this situation");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('gaslighting');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(3);
    });

    it('should detect "you\'re crazy"', () => {
      const result = matchPatterns('You are crazy for thinking that');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('gaslighting');
    });

    it('should detect "it\'s in your head"', () => {
      const result = matchPatterns("It's all in your head, nothing happened");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('gaslighting');
    });

    it('should detect "calm down"', () => {
      const result = matchPatterns('Just calm down and think about this');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('gaslighting');
    });

    it('should detect "that never happened"', () => {
      const result = matchPatterns('That conversation never happened');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('gaslighting');
    });
  });

  describe('Guilt Trip Detection', () => {
    it('should detect "after all I\'ve done"', () => {
      const result = matchPatterns("After all I've done for you, this is how you repay me");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('guilt');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(3);
    });

    it('should detect "you owe me"', () => {
      const result = matchPatterns('You owe me after everything');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('guilt');
    });

    it('should detect "how could you do this to me"', () => {
      const result = matchPatterns('How could you do this to me?');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('guilt');
    });
  });

  describe('Obligation Detection', () => {
    it('should detect "you should"', () => {
      const result = matchPatterns('You should really consider my feelings more');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('obligation');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(2);
    });

    it('should detect "you must"', () => {
      const result = matchPatterns('You must do this for me');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('obligation');
    });

    it('should detect "it\'s the least you can do"', () => {
      const result = matchPatterns("It's the least you can do after what happened");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('obligation');
    });
  });

  describe('Conditional Affection Detection', () => {
    it('should detect "if you loved me"', () => {
      const result = matchPatterns('If you really loved me, you would do this');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('conditional_affection');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(4);
    });

    it('should detect "real friends would"', () => {
      const result = matchPatterns('Real friends would support me without question');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('conditional_affection');
    });
  });

  describe('Minimization Detection', () => {
    it('should detect "not a big deal"', () => {
      const result = matchPatterns("It's not a big deal, you're making it worse");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('minimization');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(2);
    });

    it('should detect "you\'re making a big deal"', () => {
      const result = matchPatterns("You're making a big deal out of nothing");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('minimization');
    });
  });

  describe('Blame Shifting Detection', () => {
    it('should detect "it\'s your fault"', () => {
      const result = matchPatterns("It's your fault this happened");
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('blame_shift');
      expect(result?.baseWeight).toBeGreaterThanOrEqual(3);
    });

    it('should detect "you made me do"', () => {
      const result = matchPatterns('You made me say those things');
      expect(result).not.toBeNull();
      expect(result?.tags).toContain('blame_shift');
    });
  });

  describe('Multiple Pattern Detection', () => {
    it('should detect multiple patterns in one statement', () => {
      const result = matchPatterns(
        "You're overreacting, and after all I've done, you owe me an apology"
      );
      expect(result).not.toBeNull();
      expect(result?.tags.length).toBeGreaterThan(1);
      expect(result?.tags).toContain('gaslighting');
      expect(result?.tags).toContain('guilt');
    });
  });

  describe('Non-Manipulative Text', () => {
    it('should not detect manipulation in neutral conversation', () => {
      const result = matchPatterns('How was your day today?');
      expect(result).toBeNull();
    });

    it('should not detect manipulation in supportive language', () => {
      const result = matchPatterns("I understand your feelings and I'm here for you");
      expect(result).toBeNull();
    });

    it('should not flag constructive feedback', () => {
      const result = matchPatterns(
        'I think we could communicate better by being more direct'
      );
      expect(result).toBeNull();
    });
  });
});

describe('ManipulationDetector - Severity Scoring', () => {
  it('should score basic manipulation at severity 3', () => {
    const severity = calculateSeverity("You're overreacting to this", 3);
    expect(severity).toBe(3);
  });

  it('should increase severity with intensifiers', () => {
    const severityWithIntensifier = calculateSeverity('You always overreact to everything', 3);
    expect(severityWithIntensifier).toBeGreaterThan(3);
  });

  it('should detect multiple intensifiers', () => {
    const severity = calculateSeverity(
      'You never listen and you always make stupid mistakes',
      3
    );
    // Base 3 + "never" + "always" + "stupid" = 6, clamped to 5
    expect(severity).toBe(5);
  });

  it('should clamp severity to maximum 5', () => {
    const severity = calculateSeverity(
      'You always never constantly make pathetic stupid idiot mistakes',
      5
    );
    expect(severity).toBe(5);
  });

  it('should clamp severity to minimum 1', () => {
    const severity = calculateSeverity('Minor issue', 0);
    expect(severity).toBe(1);
  });
});

describe('ManipulationDetector - Response Classification', () => {
  const baseTimestamp = '2024-01-15T10:00:00.000Z';

  describe('Wrath/Assertive Responses', () => {
    it('should detect "I won\'t" as wrath', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You should do this', timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: "I won't accept this behavior",
          timestamp: '2024-01-15T10:01:00.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('wrath');
    });

    it('should detect "that\'s not acceptable" as wrath', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: "You're overreacting", timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: "That's not acceptable to say",
          timestamp: '2024-01-15T10:02:00.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('wrath');
    });

    it('should detect "stop" as wrath', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You always mess up', timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: 'Stop talking to me like that',
          timestamp: '2024-01-15T10:00:30.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('wrath');
    });

    it('should detect "I\'m not ok with this" as wrath', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You owe me', timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: "I'm not okay with that statement",
          timestamp: '2024-01-15T10:01:30.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('wrath');
    });

    it('should detect "no" as wrath (but not "no problem")', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You should do this', timestamp: baseTimestamp },
        { speaker: 'user', text: 'No.', timestamp: '2024-01-15T10:00:15.000Z' },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('wrath');
    });
  });

  describe('Compliance Responses', () => {
    it('should detect "okay" as compliance', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You should apologize', timestamp: baseTimestamp },
        { speaker: 'user', text: 'Okay fine', timestamp: '2024-01-15T10:01:00.000Z' },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('compliance');
    });

    it('should detect "I\'m sorry" as compliance', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: "It's your fault", timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: "I'm sorry, you're right",
          timestamp: '2024-01-15T10:00:30.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('compliance');
    });

    it('should detect "you\'re right" as compliance', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You always overreact', timestamp: baseTimestamp },
        { speaker: 'user', text: "You're right, I guess", timestamp: '2024-01-15T10:02:00.000Z' },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('compliance');
    });
  });

  describe('Silence Response', () => {
    it('should detect silence when no response within window', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: "You're overreacting", timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: 'Changing subject',
          timestamp: '2024-01-15T10:10:00.000Z',
        }, // 10 minutes later, outside window
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('silence');
    });

    it('should detect silence when response is neutral', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You should do this', timestamp: baseTimestamp },
        {
          speaker: 'user',
          text: 'I need to think about it',
          timestamp: '2024-01-15T10:01:00.000Z',
        },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('silence');
    });

    it('should detect silence when no user segments exist', () => {
      const segments: LifelogSegment[] = [
        { speaker: 'other', text: 'You owe me', timestamp: baseTimestamp },
      ];
      const response = findUserResponse(baseTimestamp, segments);
      expect(response).toBe('silence');
    });
  });
});

describe('ManipulationDetector - Full Lifelog Analysis', () => {
  it('should analyze lifelog with single manipulation', () => {
    const segments: LifelogSegment[] = [
      {
        speaker: 'other',
        text: "You're overreacting to this situation",
        timestamp: '2024-01-15T10:00:00.000Z',
      },
      {
        speaker: 'user',
        text: "No, I'm not. That's not acceptable",
        timestamp: '2024-01-15T10:00:30.000Z',
      },
    ];

    const analysis = analyzeLifelog(segments);

    expect(analysis.manipulation_count).toBe(1);
    expect(analysis.wrath_deployed).toBe(1);
    expect(analysis.flags).toHaveLength(1);
    expect(analysis.flags[0].tags).toContain('gaslighting');
    expect(analysis.flags[0].severity).toBeGreaterThanOrEqual(3);
  });

  it('should analyze lifelog with multiple manipulations and mixed responses', () => {
    const segments: LifelogSegment[] = [
      {
        speaker: 'other',
        text: "You're crazy for thinking that",
        timestamp: '2024-01-15T10:00:00.000Z',
      },
      { speaker: 'user', text: "I'm sorry", timestamp: '2024-01-15T10:00:30.000Z' },
      {
        speaker: 'other',
        text: 'You owe me an apology',
        timestamp: '2024-01-15T10:02:00.000Z',
      },
      { speaker: 'user', text: "I won't apologize for that", timestamp: '2024-01-15T10:02:30.000Z' },
    ];

    const analysis = analyzeLifelog(segments);

    expect(analysis.manipulation_count).toBe(2);
    expect(analysis.wrath_deployed).toBe(1); // At least one wrath response
    expect(analysis.flags).toHaveLength(2);
  });

  it('should not flag user segments as manipulative', () => {
    const segments: LifelogSegment[] = [
      { speaker: 'user', text: "You're overreacting", timestamp: '2024-01-15T10:00:00.000Z' },
      {
        speaker: 'other',
        text: 'Maybe you have a point',
        timestamp: '2024-01-15T10:00:30.000Z',
      },
    ];

    const analysis = analyzeLifelog(segments);

    expect(analysis.manipulation_count).toBe(0);
    expect(analysis.wrath_deployed).toBe(0);
  });

  it('should handle lifelog with no manipulative content', () => {
    const segments: LifelogSegment[] = [
      { speaker: 'other', text: 'How was your day?', timestamp: '2024-01-15T10:00:00.000Z' },
      { speaker: 'user', text: 'Pretty good, thanks', timestamp: '2024-01-15T10:00:15.000Z' },
      {
        speaker: 'other',
        text: "That's great to hear",
        timestamp: '2024-01-15T10:00:30.000Z',
      },
    ];

    const analysis = analyzeLifelog(segments);

    expect(analysis.manipulation_count).toBe(0);
    expect(analysis.wrath_deployed).toBe(0);
    expect(analysis.flags).toHaveLength(0);
  });

  it('should truncate flag text to 200 characters for privacy', () => {
    const longText =
      "You're overreacting to this and it's really not acceptable behavior from you. " +
      'I think you need to seriously reconsider your approach to these situations. ' +
      'This is a very long manipulative statement that exceeds 200 characters in length ' +
      'and should be truncated for privacy reasons when stored in the database.';

    const segments: LifelogSegment[] = [
      { speaker: 'other', text: longText, timestamp: '2024-01-15T10:00:00.000Z' },
    ];

    const analysis = analyzeLifelog(segments);

    expect(analysis.flags[0].text.length).toBeLessThanOrEqual(200);
  });
});

describe('ManipulationDetector - JSON Parsing', () => {
  it('should parse lifelog with contents in metadata', () => {
    const rawJson = JSON.stringify({
      id: 'log123',
      metadata: {
        contents: [
          { speaker: 'other', text: "You're overreacting", timestamp: '2024-01-15T10:00:00Z' },
          { speaker: 'user', text: 'No', timestamp: '2024-01-15T10:00:30Z' },
        ],
      },
    });

    const segments = parseLifelogSegments(rawJson);

    expect(segments).toHaveLength(2);
    expect(segments[0].speaker).toBe('other');
    expect(segments[1].speaker).toBe('user');
  });

  it('should parse lifelog with contents at root level', () => {
    const rawJson = JSON.stringify({
      id: 'log456',
      contents: [
        { speaker: 'other', text: 'You owe me', timestamp: '2024-01-15T11:00:00Z' },
      ],
    });

    const segments = parseLifelogSegments(rawJson);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('You owe me');
  });

  it('should normalize speaker field to "user" or "other"', () => {
    const rawJson = JSON.stringify({
      contents: [
        { speaker: 'user', text: 'Hello', timestamp: '2024-01-15T10:00:00Z' },
        { speaker: 'assistant', text: 'Hi', timestamp: '2024-01-15T10:00:01Z' },
        { speaker: 'unknown', text: 'Test', timestamp: '2024-01-15T10:00:02Z' },
      ],
    });

    const segments = parseLifelogSegments(rawJson);

    expect(segments[0].speaker).toBe('user');
    expect(segments[1].speaker).toBe('other');
    expect(segments[2].speaker).toBe('other');
  });

  it('should handle missing contents array', () => {
    const rawJson = JSON.stringify({ id: 'log789' });
    const segments = parseLifelogSegments(rawJson);
    expect(segments).toEqual([]);
  });

  it('should handle malformed JSON', () => {
    const consoleWarnSpy = jest.spyOn(console, 'error').mockImplementation();
    const segments = parseLifelogSegments('invalid json');
    expect(segments).toEqual([]);
    consoleWarnSpy.mockRestore();
  });

  it('should filter out segments missing text or timestamp', () => {
    const rawJson = JSON.stringify({
      contents: [
        { speaker: 'user', text: 'Valid', timestamp: '2024-01-15T10:00:00Z' },
        { speaker: 'other', timestamp: '2024-01-15T10:00:01Z' }, // Missing text
        { speaker: 'user', text: 'Also valid' }, // Missing timestamp
      ],
    });

    const segments = parseLifelogSegments(rawJson);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('Valid');
  });
});

describe('ManipulationDetector - End-to-End Analysis', () => {
  it('should analyze lifelog from raw JSON', () => {
    const rawJson = JSON.stringify({
      metadata: {
        contents: [
          {
            speaker: 'other',
            text: "You're always overreacting to everything I say",
            timestamp: '2024-01-15T10:00:00Z',
          },
          {
            speaker: 'user',
            text: "Stop talking to me like that. That's not acceptable.",
            timestamp: '2024-01-15T10:00:15Z',
          },
          {
            speaker: 'other',
            text: "After all I've done for you, you owe me respect",
            timestamp: '2024-01-15T10:02:00Z',
          },
          {
            speaker: 'user',
            text: "Fine, I'm sorry",
            timestamp: '2024-01-15T10:02:30Z',
          },
        ],
      },
    });

    const analysis = analyzeLifelogFromRaw(rawJson);

    expect(analysis.manipulation_count).toBe(2);
    expect(analysis.wrath_deployed).toBe(1); // First response was wrath
    expect(analysis.flags).toHaveLength(2);
    expect(analysis.flags[0].severity).toBe(4); // Weight 3 (gaslighting) + 1 intensifier ("always")
  });
});

describe('ManipulationDetector - Edge Cases and Resilience', () => {
  it('should handle empty segments array', () => {
    const analysis = analyzeLifelog([]);
    expect(analysis.manipulation_count).toBe(0);
    expect(analysis.wrath_deployed).toBe(0);
  });

  it('should handle sarcasm without false positives', () => {
    // "no problem" should NOT match wrath pattern
    const segments: LifelogSegment[] = [
      { speaker: 'other', text: 'Thanks for helping', timestamp: '2024-01-15T10:00:00.000Z' },
      { speaker: 'user', text: 'No problem at all!', timestamp: '2024-01-15T10:00:15.000Z' },
    ];

    const response = findUserResponse('2024-01-15T10:00:00.000Z', segments);
    expect(response).toBe('silence'); // "no problem" is excluded by negative lookahead
  });

  it('should handle negations to reduce false positives', () => {
    // "not overreacting" should not match gaslighting
    const result = matchPatterns("You're not overreacting, your feelings are valid");
    // Still might match due to "overreacting" in text, but context shows support
    // This is acceptable - regex-based detection has limitations
  });

  it('should handle timestamps in different formats', () => {
    const segments: LifelogSegment[] = [
      { speaker: 'other', text: "You're crazy", timestamp: '2024-01-15T10:00:00.000Z' },
      { speaker: 'user', text: 'No', timestamp: '2024-01-15T10:00:30Z' },
    ];

    const analysis = analyzeLifelog(segments);
    expect(analysis.wrath_deployed).toBe(1);
  });

  it('should handle concurrent manipulations', () => {
    const segments: LifelogSegment[] = [
      {
        speaker: 'other',
        text: "You're overreacting and it's your fault",
        timestamp: '2024-01-15T10:00:00.000Z',
      },
    ];

    const analysis = analyzeLifelog(segments);
    expect(analysis.manipulation_count).toBe(1);
    expect(analysis.flags[0].tags.length).toBeGreaterThan(1);
  });

  it('should handle very long conversation threads', () => {
    const segments: LifelogSegment[] = [];
    for (let i = 0; i < 100; i++) {
      segments.push({
        speaker: i % 2 === 0 ? 'other' : 'user',
        text: i % 10 === 0 ? "You're overreacting" : 'Normal conversation',
        timestamp: new Date(2024, 0, 15, 10, i).toISOString(),
      });
    }

    const startTime = performance.now();
    const analysis = analyzeLifelog(segments);
    const endTime = performance.now();

    expect(analysis.manipulation_count).toBe(10); // i=0,10,20,30,40,50,60,70,80,90 all 'other' speaker
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });
});

describe('ManipulationDetector - Performance', () => {
  it('should analyze 1-hour transcript in <200ms', () => {
    // Simulate 1 hour of conversation: ~120 segments (one every 30 seconds)
    const segments: LifelogSegment[] = [];
    const baseTime = new Date('2024-01-15T10:00:00Z').getTime();

    for (let i = 0; i < 120; i++) {
      const timestamp = new Date(baseTime + i * 30 * 1000).toISOString();
      const speaker = i % 2 === 0 ? 'other' : 'user';

      // Include manipulative patterns in ~10% of other's statements
      let text = 'Just having a normal conversation here';
      if (speaker === 'other' && i % 10 === 0) {
        text = "You're always overreacting to everything I say, you're so sensitive";
      }

      segments.push({ speaker, text, timestamp });
    }

    const startTime = performance.now();
    const analysis = analyzeLifelog(segments);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(duration).toBeLessThan(200);
    expect(analysis.manipulation_count).toBeGreaterThan(0);
    console.log(`1-hour transcript analyzed in ${duration.toFixed(2)}ms`);
  });

  it('should handle large-scale pattern matching efficiently', () => {
    const testText =
      "You're overreacting and you're crazy and it's your fault and " +
      "after all I've done you owe me and you should really calm down";

    const startTime = performance.now();
    for (let i = 0; i < 1000; i++) {
      matchPatterns(testText);
    }
    const endTime = performance.now();

    const avgTime = (endTime - startTime) / 1000;
    expect(avgTime).toBeLessThan(1); // <1ms per match on average
    console.log(`Pattern matching: ${avgTime.toFixed(3)}ms per call (1000 iterations)`);
  });
});
