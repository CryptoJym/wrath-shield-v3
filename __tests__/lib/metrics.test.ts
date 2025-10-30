/**
 * Tests for UIX Metrics Calculation (lib/metrics.ts)
 */

import { calculateUIXMetrics, getPreviousUIXScore } from '../../lib/metrics';
import type { Tweak, Flag } from '../../lib/db/types';

describe('UIX Metrics Calculation', () => {
  const now = Math.floor(Date.now() / 1000);

  /**
   * Test Data Factories
   */
  function createTweak(overrides: Partial<Tweak> = {}): Tweak {
    return {
      id: 'tweak-1',
      flag_id: 'flag-1',
      assured_text: 'Confident response',
      action_type: 'rewrite',
      context: null,
      delta_uix: 15,
      user_notes: null,
      created_at: now - 3600, // 1 hour ago
      updated_at: now - 3600,
      ...overrides,
    };
  }

  function createFlag(overrides: Partial<Flag> = {}): Flag {
    return {
      id: 'flag-1',
      status: 'pending',
      original_text: 'I feel like you always do this',
      detected_at: now - 7200, // 2 hours ago
      severity: 3,
      manipulation_type: 'gaslighting',
      created_at: now - 7200,
      updated_at: now - 7200,
      ...overrides,
    };
  }

  describe('Basic Metrics Calculation', () => {
    it('should calculate metrics with all pillars', () => {
      const tweaks = [
        createTweak({ action_type: 'rewrite', delta_uix: 20 }), // Word pillar
        createTweak({
          id: 'tweak-2',
          action_type: 'escalate',
          delta_uix: 10,
        }), // Action pillar
      ];
      const flags = [createFlag({ status: 'resolved' })];

      const metrics = calculateUIXMetrics(tweaks, flags, null, 75);

      expect(metrics.overall_score).toBeGreaterThan(0);
      expect(metrics.pillars.word).toBeGreaterThan(0);
      expect(metrics.pillars.action).toBeGreaterThan(0);
      expect(metrics.pillars.body).toBe(75); // From recovery score
      expect(metrics.open_flags).toBe(0); // Flag is resolved
    });

    it('should handle no tweaks gracefully', () => {
      const tweaks: Tweak[] = [];
      const flags: Flag[] = [];

      const metrics = calculateUIXMetrics(tweaks, flags, null, null);

      expect(metrics.overall_score).toBe(50); // Base score
      expect(metrics.pillars.word).toBe(0);
      expect(metrics.pillars.action).toBe(0);
      expect(metrics.pillars.body).toBe(50); // Default when no recovery
    });

    it('should handle null recovery score', () => {
      const tweaks = [createTweak({ delta_uix: 30 })];
      const flags: Flag[] = [];

      const metrics = calculateUIXMetrics(tweaks, flags, null, null);

      expect(metrics.pillars.body).toBe(50); // Default baseline
    });
  });

  describe('Recency Weighting (72h Decay)', () => {
    it('should give full weight to recent tweaks', () => {
      const recentTweak = createTweak({
        created_at: now - 60, // 1 minute ago
        delta_uix: 20,
      });

      const metrics = calculateUIXMetrics([recentTweak], [], null, null);

      // Recent tweaks should contribute close to full delta_uix
      expect(metrics.pillars.word).toBeCloseTo(20, 0);
    });

    it('should decay tweaks older than 72 hours', () => {
      const oldTweak = createTweak({
        created_at: now - 73 * 3600, // 73 hours ago
        delta_uix: 20,
      });

      const metrics = calculateUIXMetrics([oldTweak], [], null, null);

      // Old tweaks should contribute 0
      expect(metrics.pillars.word).toBe(0);
    });

    it('should apply linear decay between 0 and 72 hours', () => {
      const midAgeTweak = createTweak({
        created_at: now - 36 * 3600, // 36 hours ago (halfway)
        delta_uix: 20,
      });

      const metrics = calculateUIXMetrics([midAgeTweak], [], null, null);

      // Halfway through decay period = ~50% weight
      expect(metrics.pillars.word).toBeGreaterThan(8);
      expect(metrics.pillars.word).toBeLessThan(12);
    });

    it('should calculate average recency factor', () => {
      const tweaks = [
        createTweak({ created_at: now - 60, delta_uix: 10 }), // Recent
        createTweak({
          id: 'tweak-2',
          created_at: now - 36 * 3600,
          delta_uix: 10,
        }), // Mid-age
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, null);

      // Average recency should be between 0.5 and 1.0
      expect(metrics.penalties.recency_factor).toBeGreaterThan(0.5);
      expect(metrics.penalties.recency_factor).toBeLessThan(1.0);
    });
  });

  describe('Pillar Classification', () => {
    it('should classify rewrite tweaks as Word pillar', () => {
      const tweaks = [
        createTweak({ action_type: 'rewrite', delta_uix: 25 }),
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, null);

      expect(metrics.pillars.word).toBeGreaterThan(0);
      expect(metrics.pillars.action).toBe(0);
    });

    it('should classify escalate tweaks as Action pillar', () => {
      const tweaks = [
        createTweak({ action_type: 'escalate', delta_uix: 5 }),
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, null);

      expect(metrics.pillars.word).toBe(0);
      expect(metrics.pillars.action).toBeGreaterThan(0);
    });

    it('should ignore dismiss tweaks', () => {
      const tweaks = [createTweak({ action_type: 'dismiss', delta_uix: 0 })];

      const metrics = calculateUIXMetrics(tweaks, [], null, null);

      expect(metrics.pillars.word).toBe(0);
      expect(metrics.pillars.action).toBe(0);
    });

    it('should use recovery score for Body pillar', () => {
      const metrics = calculateUIXMetrics([], [], null, 82);

      expect(metrics.pillars.body).toBe(82);
    });
  });

  describe('Open Flag Penalties', () => {
    it('should apply -1 penalty per open flag', () => {
      const flags = [
        createFlag({ id: 'flag-1', status: 'pending' }),
        createFlag({ id: 'flag-2', status: 'pending' }),
        createFlag({ id: 'flag-3', status: 'pending' }),
      ];

      const metrics = calculateUIXMetrics([], flags, null, null);

      expect(metrics.open_flags).toBe(3);
      expect(metrics.penalties.open_flags_penalty).toBe(3);
      // Base score 50 - 3 penalty = 47
      expect(metrics.overall_score).toBe(47);
    });

    it('should not penalize resolved flags', () => {
      const flags = [
        createFlag({ status: 'resolved' }),
        createFlag({ id: 'flag-2', status: 'dismissed' }),
      ];

      const metrics = calculateUIXMetrics([], flags, null, null);

      expect(metrics.open_flags).toBe(0);
      expect(metrics.penalties.open_flags_penalty).toBe(0);
    });

    it('should handle many open flags (clamping)', () => {
      const flags = Array.from({ length: 100 }, (_, i) =>
        createFlag({ id: `flag-${i}`, status: 'pending' })
      );

      const metrics = calculateUIXMetrics([], flags, null, null);

      // Score should clamp to 0, not go negative
      expect(metrics.overall_score).toBe(0);
    });
  });

  describe('Weighted Overall Score', () => {
    it('should calculate weighted average of pillars', () => {
      const tweaks = [
        createTweak({ action_type: 'rewrite', delta_uix: 40 }), // Word
        createTweak({
          id: 'tweak-2',
          action_type: 'escalate',
          delta_uix: 20,
        }), // Action
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, 60); // Body

      // Expected: word(40)*0.4 + action(20)*0.4 + body(60)*0.2
      // = 16 + 8 + 12 = 36
      expect(metrics.overall_score).toBeCloseTo(36, 0);
    });

    it('should clamp score to 0-100 range', () => {
      const tweaks = [
        createTweak({ delta_uix: 150, action_type: 'rewrite' }),
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, 100);

      expect(metrics.overall_score).toBeLessThanOrEqual(100);
      expect(metrics.overall_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Delta Calculation', () => {
    it('should calculate positive delta from previous score', () => {
      const tweaks = [createTweak({ delta_uix: 50 })];

      const metrics = calculateUIXMetrics(tweaks, [], 30, 70);

      expect(metrics.delta).toBeGreaterThan(0);
      expect(metrics.overall_score).toBeGreaterThan(30);
    });

    it('should calculate negative delta from previous score', () => {
      const flags = [
        createFlag({ status: 'pending' }),
        createFlag({ id: 'flag-2', status: 'pending' }),
        createFlag({ id: 'flag-3', status: 'pending' }),
      ]; // -3 penalty

      const metrics = calculateUIXMetrics([], flags, 60, 50);

      expect(metrics.delta).toBeLessThan(0);
      expect(metrics.overall_score).toBeLessThan(60);
    });

    it('should handle null previous score (no delta)', () => {
      const metrics = calculateUIXMetrics([], [], null, null);

      expect(metrics.delta).toBe(0);
    });
  });

  describe('Top Fixes Suggestions', () => {
    it('should suggest top 2 highest severity flags', () => {
      const flags = [
        createFlag({ id: 'flag-1', severity: 2, status: 'pending' }),
        createFlag({ id: 'flag-2', severity: 5, status: 'pending' }),
        createFlag({ id: 'flag-3', severity: 4, status: 'pending' }),
        createFlag({ id: 'flag-4', severity: 1, status: 'pending' }),
      ];

      const metrics = calculateUIXMetrics([], flags, null, null);

      expect(metrics.top_fixes).toHaveLength(2);
      expect(metrics.top_fixes[0].flag_id).toBe('flag-2'); // Severity 5
      expect(metrics.top_fixes[0].suggested_lift).toBe(25); // 5 * 5
      expect(metrics.top_fixes[1].flag_id).toBe('flag-3'); // Severity 4
      expect(metrics.top_fixes[1].suggested_lift).toBe(20); // 4 * 5
    });

    it('should handle fewer than 2 open flags', () => {
      const flags = [createFlag({ severity: 3, status: 'pending' })];

      const metrics = calculateUIXMetrics([], flags, null, null);

      expect(metrics.top_fixes).toHaveLength(1);
      expect(metrics.top_fixes[0].suggested_lift).toBe(15); // 3 * 5
    });

    it('should not suggest resolved flags', () => {
      const flags = [
        createFlag({ severity: 5, status: 'resolved' }),
        createFlag({ id: 'flag-2', severity: 2, status: 'pending' }),
      ];

      const metrics = calculateUIXMetrics([], flags, null, null);

      expect(metrics.top_fixes).toHaveLength(1);
      expect(metrics.top_fixes[0].flag_id).toBe('flag-2');
    });
  });

  describe('Previous UIX Score (Historical)', () => {
    it('should calculate historical score from 24-96h window', async () => {
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const tweaks = [
        createTweak({ created_at: twoDaysAgo, delta_uix: 20 }), // Historical
        createTweak({ id: 'tweak-2', created_at: now - 3600, delta_uix: 30 }), // Recent (excluded)
      ];

      const previousScore = await getPreviousUIXScore(tweaks, [], null);

      // Should only consider the historical tweak
      expect(previousScore).toBeGreaterThan(0);
      expect(previousScore).toBeLessThan(30); // Shouldn't include recent tweak
    });

    it('should handle no historical tweaks', async () => {
      const tweaks = [createTweak({ created_at: now - 3600, delta_uix: 30 })]; // Too recent

      const previousScore = await getPreviousUIXScore(tweaks, [], null);

      // No historical tweaks = base score
      expect(previousScore).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high recovery score', () => {
      const metrics = calculateUIXMetrics([], [], null, 150); // Over 100

      expect(metrics.pillars.body).toBe(100); // Clamped
    });

    it('should handle zero delta_uix tweaks', () => {
      const tweaks = [createTweak({ delta_uix: 0, action_type: 'dismiss' })];

      const metrics = calculateUIXMetrics(tweaks, [], null, null);

      expect(metrics.overall_score).toBe(50); // Base score unchanged
    });

    it('should handle mixed tweak types', () => {
      const tweaks = [
        createTweak({ action_type: 'rewrite', delta_uix: 20 }),
        createTweak({
          id: 'tweak-2',
          action_type: 'escalate',
          delta_uix: 10,
        }),
        createTweak({ id: 'tweak-3', action_type: 'dismiss', delta_uix: 0 }),
      ];

      const metrics = calculateUIXMetrics(tweaks, [], null, 70);

      // Should include rewrite and escalate, ignore dismiss
      expect(metrics.pillars.word).toBe(20); // From rewrite tweak
      expect(metrics.pillars.action).toBe(10); // From escalate tweak
      expect(metrics.pillars.body).toBe(70); // From recovery
      // Weighted: 20*0.4 + 10*0.4 + 70*0.2 = 8 + 4 + 14 = 26
      expect(metrics.overall_score).toBe(26);
    });

    it('should handle future timestamps gracefully', () => {
      const futureTweak = createTweak({
        created_at: now + 3600, // 1 hour in future
        delta_uix: 20,
      });

      const metrics = calculateUIXMetrics([futureTweak], [], null, null);

      // Future tweaks get full weight (decay factor = 1.0)
      expect(metrics.pillars.word).toBe(20);
    });
  });

  describe('Rounding and Precision', () => {
    it('should round all scores to integers', () => {
      const tweaks = [createTweak({ delta_uix: 17 })]; // Odd number

      const metrics = calculateUIXMetrics(tweaks, [], 33, 67);

      expect(Number.isInteger(metrics.overall_score)).toBe(true);
      expect(Number.isInteger(metrics.pillars.word)).toBe(true);
      expect(Number.isInteger(metrics.pillars.action)).toBe(true);
      expect(Number.isInteger(metrics.pillars.body)).toBe(true);
      expect(Number.isInteger(metrics.delta)).toBe(true);
    });
  });
});
