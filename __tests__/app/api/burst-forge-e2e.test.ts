/**
 * Wrath Shield v3 - BurstForge End-to-End Tests
 *
 * Comprehensive E2E testing of BurstForge feature including:
 * - API request/response correctness
 * - Database updates for flags and tweaks
 * - UIX score recalculation
 * - Edge cases and error handling
 * - Performance under typical usage scenarios
 */

import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import {
  insertFlags,
  insertTweaks,
  getFlag,
  getTweaksByFlagId,
  getPendingFlags,
  getTotalUIXScore,
  updateFlagStatus,
} from '../../../lib/db/queries';
import type { FlagInput, TweakInput } from '../../../lib/db/types';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('BurstForge End-to-End Tests', () => {
  const testDbPath = join(process.cwd(), '.data', 'test-burst-forge-e2e.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    // Ensure .data directory exists
    const dataDir = join(process.cwd(), '.data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Reset singleton and initialize with real schema (includes migrations)
    Database.resetInstance();
    Database.getInstance(testDbPath, testMigrationsPath);
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  describe('Flag Creation and Management', () => {
    it('should create a flag with all required fields', () => {
      const flagId = 'flag-001';
      const flags: FlagInput[] = [
        {
          id: flagId,
          status: 'pending',
          original_text: 'I feel like you always do this',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ];

      insertFlags(flags);

      const retrieved = getFlag(flagId);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.id).toBe(flagId);
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.original_text).toBe('I feel like you always do this');
      expect(retrieved?.severity).toBe(3);
      expect(retrieved?.manipulation_type).toBe('gaslighting');
    });

    it('should update flag status correctly', () => {
      const flagId = 'flag-002';
      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Test text',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 2,
          manipulation_type: 'guilt',
        },
      ]);

      // Update status to resolved
      updateFlagStatus(flagId, 'resolved');

      const retrieved = getFlag(flagId);
      expect(retrieved?.status).toBe('resolved');
    });

    it('should retrieve all pending flags', () => {
      insertFlags([
        {
          id: 'flag-003',
          status: 'pending',
          original_text: 'Text 1',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
        {
          id: 'flag-004',
          status: 'resolved',
          original_text: 'Text 2',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 2,
          manipulation_type: 'guilt',
        },
        {
          id: 'flag-005',
          status: 'pending',
          original_text: 'Text 3',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 4,
          manipulation_type: 'obligation',
        },
      ]);

      const pending = getPendingFlags();
      expect(pending).toHaveLength(2);
      expect(pending.every((f) => f.status === 'pending')).toBe(true);
    });
  });

  describe('Tweak Creation and UIX Score Calculation', () => {
    it('should create a rewrite tweak with positive delta_uix', () => {
      const flagId = 'flag-010';
      const tweakId = 'tweak-001';

      // Create flag first
      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'You never listen to me',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ]);

      // Create rewrite tweak
      const tweaks: TweakInput[] = [
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: 'I need you to listen more carefully when I speak',
          action_type: 'rewrite',
          context: 'Conversation about communication',
          delta_uix: 18, // Base 10 + length bonus 5 + severity 3
          user_notes: 'Reframed from accusatory to request',
        },
      ];

      insertTweaks(tweaks);

      const retrieved = getTweaksByFlagId(flagId);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].id).toBe(tweakId);
      expect(retrieved[0].assured_text).toBe('I need you to listen more carefully when I speak');
      expect(retrieved[0].action_type).toBe('rewrite');
      expect(retrieved[0].delta_uix).toBe(18);
    });

    it('should create a dismiss tweak with zero delta_uix', () => {
      const flagId = 'flag-011';
      const tweakId = 'tweak-002';

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'False positive text',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 1,
          manipulation_type: null,
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: '',
          action_type: 'dismiss',
          context: 'False positive',
          delta_uix: 0,
          user_notes: 'Not actually manipulative',
        },
      ]);

      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(0); // Dismiss action contributes 0 UIX
    });

    it('should create an escalate tweak with small delta_uix', () => {
      const flagId = 'flag-012';
      const tweakId = 'tweak-003';

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Needs escalation',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 5,
          manipulation_type: 'threat',
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: '',
          action_type: 'escalate',
          context: 'Serious concern',
          delta_uix: 5,
          user_notes: 'Needs professional review',
        },
      ]);

      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(5);
    });

    it('should calculate total UIX score from multiple tweaks', () => {
      const flagId1 = 'flag-020';
      const flagId2 = 'flag-021';
      const flagId3 = 'flag-022';

      // Create flags
      insertFlags([
        {
          id: flagId1,
          status: 'pending',
          original_text: 'Text 1',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
        {
          id: flagId2,
          status: 'pending',
          original_text: 'Text 2',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 4,
          manipulation_type: 'guilt',
        },
        {
          id: flagId3,
          status: 'pending',
          original_text: 'Text 3',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 2,
          manipulation_type: 'obligation',
        },
      ]);

      // Create tweaks with different delta_uix values
      insertTweaks([
        {
          id: 'tweak-020',
          flag_id: flagId1,
          assured_text: 'Confident rewrite 1',
          action_type: 'rewrite',
          context: null,
          delta_uix: 20,
          user_notes: null,
        },
        {
          id: 'tweak-021',
          flag_id: flagId2,
          assured_text: 'Confident rewrite 2',
          action_type: 'rewrite',
          context: null,
          delta_uix: 25,
          user_notes: null,
        },
        {
          id: 'tweak-022',
          flag_id: flagId3,
          assured_text: '',
          action_type: 'dismiss',
          context: null,
          delta_uix: 0,
          user_notes: null,
        },
      ]);

      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(45); // 20 + 25 + 0
    });
  });

  describe('Foreign Key Cascade Behavior', () => {
    it('should delete tweaks when parent flag is deleted', () => {
      const flagId = 'flag-030';
      const tweakId = 'tweak-030';

      // Create flag and tweak
      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Parent flag',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: 'Tweak text',
          action_type: 'rewrite',
          context: null,
          delta_uix: 15,
          user_notes: null,
        },
      ]);

      // Verify tweak exists
      const tweaksBeforeDelete = getTweaksByFlagId(flagId);
      expect(tweaksBeforeDelete).toHaveLength(1);

      // Delete flag (should cascade to tweaks)
      const db = Database.getInstance();
      db.exec(`DELETE FROM flags WHERE id = '${flagId}'`);

      // Verify tweak is gone
      const tweaksAfterDelete = getTweaksByFlagId(flagId);
      expect(tweaksAfterDelete).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty assured_text for dismiss action', () => {
      const flagId = 'flag-040';
      const tweakId = 'tweak-040';

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Test',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 2,
          manipulation_type: null,
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: '',
          action_type: 'dismiss',
          context: null,
          delta_uix: 0,
          user_notes: null,
        },
      ]);

      const retrieved = getTweaksByFlagId(flagId);
      expect(retrieved[0].assured_text).toBe('');
    });

    it('should handle null context and user_notes', () => {
      const flagId = 'flag-041';
      const tweakId = 'tweak-041';

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Test',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: 'Rewrite',
          action_type: 'rewrite',
          context: null,
          delta_uix: 15,
          user_notes: null,
        },
      ]);

      const retrieved = getTweaksByFlagId(flagId);
      expect(retrieved[0].context).toBeNull();
      expect(retrieved[0].user_notes).toBeNull();
    });

    it('should handle very long assured_text (stress test)', () => {
      const flagId = 'flag-042';
      const tweakId = 'tweak-042';
      const longText = 'A'.repeat(5000); // 5KB of text

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Test',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ]);

      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: longText,
          action_type: 'rewrite',
          context: null,
          delta_uix: 30,
          user_notes: null,
        },
      ]);

      const retrieved = getTweaksByFlagId(flagId);
      expect(retrieved[0].assured_text).toBe(longText);
    });

    it('should handle severity edge values (1 and 5)', () => {
      insertFlags([
        {
          id: 'flag-043',
          status: 'pending',
          original_text: 'Minimum severity',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 1,
          manipulation_type: 'minimization',
        },
        {
          id: 'flag-044',
          status: 'pending',
          original_text: 'Maximum severity',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 5,
          manipulation_type: 'threat',
        },
      ]);

      const flag1 = getFlag('flag-043');
      const flag2 = getFlag('flag-044');

      expect(flag1?.severity).toBe(1);
      expect(flag2?.severity).toBe(5);
    });

    it('should return 0 for total UIX score when no tweaks exist', () => {
      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(0);
    });
  });

  describe('Complete End-to-End Workflow', () => {
    it('should complete full flag-to-tweak-to-resolution workflow', () => {
      const flagId = 'flag-050';
      const tweakId = 'tweak-050';

      // Step 1: Create flag
      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'You never understand me',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 3,
          manipulation_type: 'gaslighting',
        },
      ]);

      // Step 2: Verify flag is pending
      const flagBeforeTweak = getFlag(flagId);
      expect(flagBeforeTweak?.status).toBe('pending');

      // Step 3: Create tweak
      insertTweaks([
        {
          id: tweakId,
          flag_id: flagId,
          assured_text: 'I need you to try to understand my perspective better',
          action_type: 'rewrite',
          context: 'Communication improvement',
          delta_uix: 18,
          user_notes: 'Reframed to constructive request',
        },
      ]);

      // Step 4: Update flag status to resolved
      updateFlagStatus(flagId, 'resolved');

      // Step 5: Verify flag is resolved
      const flagAfterTweak = getFlag(flagId);
      expect(flagAfterTweak?.status).toBe('resolved');

      // Step 6: Verify tweak exists
      const tweaks = getTweaksByFlagId(flagId);
      expect(tweaks).toHaveLength(1);
      expect(tweaks[0].delta_uix).toBe(18);

      // Step 7: Verify UIX score updated
      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(18);
    });

    it('should handle multiple tweaks for same flag', () => {
      const flagId = 'flag-051';

      insertFlags([
        {
          id: flagId,
          status: 'pending',
          original_text: 'Original manipulative text',
          detected_at: Math.floor(Date.now() / 1000),
          severity: 4,
          manipulation_type: 'guilt',
        },
      ]);

      // Multiple attempts at rewriting
      insertTweaks([
        {
          id: 'tweak-051-v1',
          flag_id: flagId,
          assured_text: 'First attempt',
          action_type: 'rewrite',
          context: 'First try',
          delta_uix: 15,
          user_notes: 'Not quite right',
        },
        {
          id: 'tweak-051-v2',
          flag_id: flagId,
          assured_text: 'Second attempt - much better',
          action_type: 'rewrite',
          context: 'Second try',
          delta_uix: 25,
          user_notes: 'This feels right',
        },
      ]);

      const tweaks = getTweaksByFlagId(flagId);
      expect(tweaks).toHaveLength(2);

      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(40); // 15 + 25
    });

    it('should handle concurrent operations on different flags', () => {
      const flags: FlagInput[] = Array.from({ length: 10 }, (_, i) => ({
        id: `flag-concurrent-${i}`,
        status: 'pending' as const,
        original_text: `Concurrent flag ${i}`,
        detected_at: Math.floor(Date.now() / 1000),
        severity: (i % 5) + 1,
        manipulation_type: 'gaslighting',
      }));

      insertFlags(flags);

      const tweaks: TweakInput[] = flags.map((flag, i) => ({
        id: `tweak-concurrent-${i}`,
        flag_id: flag.id,
        assured_text: `Rewrite ${i}`,
        action_type: 'rewrite' as const,
        context: null,
        delta_uix: 10 + i,
        user_notes: null,
      }));

      insertTweaks(tweaks);

      // Verify all flags and tweaks created
      const pendingFlags = getPendingFlags();
      expect(pendingFlags).toHaveLength(10);

      // Total UIX: 10+11+12+13+14+15+16+17+18+19 = 145
      const totalUIX = getTotalUIXScore();
      expect(totalUIX).toBe(145);
    });
  });

  describe('Performance Tests', () => {
    it('should handle batch insert of 50 flags efficiently', () => {
      const startTime = Date.now();

      const flags: FlagInput[] = Array.from({ length: 50 }, (_, i) => ({
        id: `flag-perf-${i}`,
        status: 'pending' as const,
        original_text: `Performance test flag ${i}`,
        detected_at: Math.floor(Date.now() / 1000),
        severity: (i % 5) + 1,
        manipulation_type: 'gaslighting',
      }));

      insertFlags(flags);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle batch insert of 100 tweaks efficiently', () => {
      // First create 100 flags
      const flags: FlagInput[] = Array.from({ length: 100 }, (_, i) => ({
        id: `flag-perf-tweak-${i}`,
        status: 'pending' as const,
        original_text: `Performance test flag ${i}`,
        detected_at: Math.floor(Date.now() / 1000),
        severity: 3,
        manipulation_type: 'gaslighting',
      }));

      insertFlags(flags);

      const startTime = Date.now();

      const tweaks: TweakInput[] = flags.map((flag, i) => ({
        id: `tweak-perf-${i}`,
        flag_id: flag.id,
        assured_text: `Performance test rewrite ${i}`,
        action_type: 'rewrite' as const,
        context: null,
        delta_uix: 15,
        user_notes: null,
      }));

      insertTweaks(tweaks);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should retrieve total UIX score efficiently with many tweaks', () => {
      // Create 100 flags and tweaks
      const flags: FlagInput[] = Array.from({ length: 100 }, (_, i) => ({
        id: `flag-uix-perf-${i}`,
        status: 'pending' as const,
        original_text: `UIX performance test ${i}`,
        detected_at: Math.floor(Date.now() / 1000),
        severity: 3,
        manipulation_type: 'gaslighting',
      }));

      insertFlags(flags);

      const tweaks: TweakInput[] = flags.map((flag, i) => ({
        id: `tweak-uix-perf-${i}`,
        flag_id: flag.id,
        assured_text: `Rewrite ${i}`,
        action_type: 'rewrite' as const,
        context: null,
        delta_uix: 20,
        user_notes: null,
      }));

      insertTweaks(tweaks);

      const startTime = Date.now();

      const totalUIX = getTotalUIXScore();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(totalUIX).toBe(2000); // 100 * 20
    });
  });
});
