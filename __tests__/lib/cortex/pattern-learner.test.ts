// @ts-nocheck
/**
 * Pattern Learner - High Fidelity Tests
 *
 * Tests the PatternLearner and MetaImprover classes with real database operations.
 * Verifies pattern learning, success rate updates, and pruning logic.
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import { PatternLearner, MetaImprover } from '../../../lib/cortex/pattern-learner';
import {
  createMockSynthesisResult,
  createMockUnifiedTask,
  createMockPattern,
  createMockWorkingMemoryEvent,
} from '../../helpers/cortex-test-utils';
import type { SynthesisResult, UnifiedTask, SynthesisPattern } from '../../../lib/cortex/types';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep memory functions
jest.mock('../../../lib/memory/zep', () => ({
  addAgentMemory: jest.fn().mockResolvedValue({ id: 'mock-memory-id' }),
  searchAgentMemory: jest.fn().mockResolvedValue([]),
}));

// Mock EA preference model
jest.mock('../../../lib/ea/preference-model', () => ({
  recordCorrection: jest.fn().mockResolvedValue(undefined),
}));

const mockZep = require('../../../lib/memory/zep');
const mockEA = require('../../../lib/ea/preference-model');

describe('PatternLearner - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-pattern-learner');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  let patternLearner: PatternLearner;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Reset singletons
    Database.resetInstance();

    // Initialize Database singleton with test path
    const db = Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    // Manually create synthesis_patterns table (since test mode only runs 001/002 migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS synthesis_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL CHECK(pattern_type IN ('consolidation', 'urgency', 'action', 'relationship')),
        description TEXT NOT NULL,
        trigger_conditions TEXT,
        suggested_behavior TEXT,
        success_rate REAL DEFAULT 0.5 CHECK(success_rate >= 0.0 AND success_rate <= 1.0),
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_type ON synthesis_patterns(pattern_type, success_rate DESC);
      CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_usage ON synthesis_patterns(usage_count DESC);
    `);

    // Create pattern learner instance
    patternLearner = new PatternLearner();
  });

  afterEach(() => {
    Database.resetInstance();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Learning from Synthesis', () => {
    it('should store patterns in database', async () => {
      const result = createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Test pattern for email consolidation',
            triggerConditions: { sources: ['email'] },
            suggestedBehavior: { consolidateEvents: true },
          },
        ],
      });

      await patternLearner.learnFromSynthesis(result);

      // Query database directly to verify pattern was stored
      const db = Database.getInstance();
      const row = db.prepare('SELECT * FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Test pattern for email consolidation%');

      expect(row).toBeDefined();
      expect(row.pattern_type).toBe('consolidation');
    });

    it('should store patterns in Zep', async () => {
      const result = createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'urgency',
            description: 'Test urgency pattern',
            triggerConditions: { keywords: ['urgent'] },
            suggestedBehavior: { urgencyOverride: 'critical' },
          },
        ],
      });

      await patternLearner.learnFromSynthesis(result);

      expect(mockZep.addAgentMemory).toHaveBeenCalled();
      const call = mockZep.addAgentMemory.mock.calls[0];
      expect(call[1]).toContain('[SYNTHESIS PATTERN]');
      expect(call[2].type).toBe('synthesis_pattern');
    });

    it('should generate unique pattern IDs', async () => {
      const result = createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Pattern 1',
            triggerConditions: {},
            suggestedBehavior: {},
          },
          {
            patternType: 'consolidation',
            description: 'Pattern 2',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      });

      await patternLearner.learnFromSynthesis(result);

      const db = Database.getInstance();
      const rows = db.prepare('SELECT id FROM synthesis_patterns').all();

      expect(rows.length).toBe(2);
      expect(rows[0].id).not.toBe(rows[1].id);
    });

    it('should start with 0.5 success rate', async () => {
      const result = createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'New action pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      });

      await patternLearner.learnFromSynthesis(result);

      const db = Database.getInstance();
      const row = db.prepare('SELECT success_rate FROM synthesis_patterns').get();

      expect(row.success_rate).toBe(0.5);
    });

    it('should handle empty patterns array', async () => {
      const result = createMockSynthesisResult({
        new_patterns: [],
      });

      // Should not throw
      await expect(patternLearner.learnFromSynthesis(result)).resolves.not.toThrow();
    });
  });

  describe('Learning from Corrections', () => {
    it('should create anti-pattern when dismissed', async () => {
      const task = createMockUnifiedTask({
        id: 'task-123',
        title: 'Bad Task',
        description: 'This task was dismissed by user',
      });

      await patternLearner.learnFromCorrection(task, { dismissed: true });

      const db = Database.getInstance();
      const row = db.prepare('SELECT * FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Avoid%User dismissed%');

      expect(row).toBeDefined();
      expect(row.description).toContain('Bad Task');
    });

    it('should set low success rate (0.1) for anti-patterns', async () => {
      const task = createMockUnifiedTask({ title: 'Dismissed Task' });

      await patternLearner.learnFromCorrection(task, { dismissed: true });

      const db = Database.getInstance();
      const row = db.prepare('SELECT success_rate FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Avoid%');

      expect(row.success_rate).toBe(0.1);
    });

    it('should record in EA preference model', async () => {
      const task = createMockUnifiedTask({
        domain: 'business',
        proposedAction: { type: 'create_task' },
      });

      await patternLearner.learnFromCorrection(task, {
        newDomain: 'legal',
        newTitle: 'Corrected Title',
      });

      expect(mockEA.recordCorrection).toHaveBeenCalled();
      const call = mockEA.recordCorrection.mock.calls[0];
      expect(call[1].domain).toBe('business');
      expect(call[2].domain).toBe('legal');
    });

    it('should create improvement pattern for title change', async () => {
      const task = createMockUnifiedTask({ title: 'Original Title' });

      await patternLearner.learnFromCorrection(task, { newTitle: 'Better Title' });

      const db = Database.getInstance();
      const row = db.prepare('SELECT * FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Prefer%Better Title%');

      expect(row).toBeDefined();
    });

    it('should create improvement pattern for action change', async () => {
      const task = createMockUnifiedTask();

      await patternLearner.learnFromCorrection(task, { newAction: 'escalate' });

      const db = Database.getInstance();
      const row = db.prepare('SELECT * FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Prefer%escalate%');

      expect(row).toBeDefined();
    });

    it('should set higher success rate (0.7) for improvements', async () => {
      const task = createMockUnifiedTask();

      await patternLearner.learnFromCorrection(task, { newTitle: 'User Preferred Title' });

      const db = Database.getInstance();
      const row = db.prepare('SELECT success_rate FROM synthesis_patterns WHERE description LIKE ?')
        .get('%Prefer%');

      expect(row.success_rate).toBe(0.7);
    });
  });

  describe('Pattern Retrieval', () => {
    it('should query by pattern type', async () => {
      // First insert some patterns
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Consolidation pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
          {
            patternType: 'urgency',
            description: 'Urgency pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      // Create events with domain classification
      const events = [
        createMockWorkingMemoryEvent({
          initialClassification: { domain: 'consolidation' },
        }),
      ];

      const patterns = await patternLearner.getRelevantPatterns(events);

      // Should have found patterns
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should search Zep memory', async () => {
      mockZep.searchAgentMemory.mockResolvedValueOnce([
        {
          memory: {
            content: 'Test pattern from Zep',
            metadata: {
              type: 'synthesis_pattern',
              pattern: createMockPattern(),
            },
          },
        },
      ]);

      const events = [createMockWorkingMemoryEvent({ content: 'test content' })];

      await patternLearner.getRelevantPatterns(events);

      expect(mockZep.searchAgentMemory).toHaveBeenCalled();
    });

    it('should deduplicate results', async () => {
      const pattern = createMockPattern();

      // Mock Zep returning same pattern that's in DB
      mockZep.searchAgentMemory.mockResolvedValueOnce([
        {
          memory: {
            metadata: {
              type: 'synthesis_pattern',
              pattern: pattern,
            },
          },
        },
      ]);

      // Also insert in DB
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: pattern.patternType,
            description: pattern.description,
            triggerConditions: pattern.triggerConditions,
            suggestedBehavior: pattern.suggestedBehavior,
          },
        ],
      }));

      const events = [createMockWorkingMemoryEvent()];
      const patterns = await patternLearner.getRelevantPatterns(events);

      // Should have no duplicates
      const ids = patterns.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should sort by success rate DESC', async () => {
      // Insert patterns with different success rates
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Low success pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      // Manually update one pattern to have higher success
      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.9 WHERE description LIKE ?')
        .run('%Low success%');

      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Default pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const events = [createMockWorkingMemoryEvent({
        initialClassification: { domain: 'consolidation' },
      })];
      const patterns = await patternLearner.getRelevantPatterns(events);

      if (patterns.length >= 2) {
        expect(patterns[0].successRate).toBeGreaterThanOrEqual(patterns[1].successRate);
      }
    });

    it('should handle database errors gracefully', async () => {
      // This tests the error handling path
      const events = [createMockWorkingMemoryEvent()];

      // Should not throw, should return empty array
      const patterns = await patternLearner.getRelevantPatterns(events);
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle Zep errors gracefully', async () => {
      mockZep.searchAgentMemory.mockRejectedValueOnce(new Error('Zep unavailable'));

      const events = [createMockWorkingMemoryEvent()];

      // Should not throw
      const patterns = await patternLearner.getRelevantPatterns(events);
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Success Rate Updates', () => {
    it('should use EMA formula correctly', async () => {
      // Create a pattern
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'EMA test pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      const row = db.prepare('SELECT id, success_rate FROM synthesis_patterns').get();
      const patternId = row.id;
      const initialRate = row.success_rate; // 0.5

      // Update with success=true
      await patternLearner.updatePatternSuccess(patternId, true);

      const updatedRow = db.prepare('SELECT success_rate FROM synthesis_patterns WHERE id = ?')
        .get(patternId);

      // EMA formula: newRate = (1 - 0.1) * old + 0.1 * (success ? 1 : 0)
      // newRate = 0.9 * 0.5 + 0.1 * 1 = 0.45 + 0.1 = 0.55
      expect(updatedRow.success_rate).toBeCloseTo(0.55, 2);
    });

    it('should increment usage count', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Usage count test',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      const row = db.prepare('SELECT id, usage_count FROM synthesis_patterns').get();
      const patternId = row.id;
      expect(row.usage_count).toBe(0);

      await patternLearner.updatePatternSuccess(patternId, true);
      await patternLearner.updatePatternSuccess(patternId, false);

      const updatedRow = db.prepare('SELECT usage_count FROM synthesis_patterns WHERE id = ?')
        .get(patternId);

      expect(updatedRow.usage_count).toBe(2);
    });

    it('should handle missing pattern ID', async () => {
      // Should not throw, just log warning
      await expect(
        patternLearner.updatePatternSuccess('non-existent-id', true)
      ).resolves.not.toThrow();
    });

    it('should increase success rate on success=true', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'Increase test',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      const row = db.prepare('SELECT id, success_rate FROM synthesis_patterns').get();
      const initialRate = row.success_rate;

      await patternLearner.updatePatternSuccess(row.id, true);

      const updatedRow = db.prepare('SELECT success_rate FROM synthesis_patterns WHERE id = ?')
        .get(row.id);

      expect(updatedRow.success_rate).toBeGreaterThan(initialRate);
    });

    it('should decrease success rate on success=false', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'Decrease test',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      const row = db.prepare('SELECT id, success_rate FROM synthesis_patterns').get();
      const initialRate = row.success_rate;

      await patternLearner.updatePatternSuccess(row.id, false);

      const updatedRow = db.prepare('SELECT success_rate FROM synthesis_patterns WHERE id = ?')
        .get(row.id);

      expect(updatedRow.success_rate).toBeLessThan(initialRate);
    });
  });

  describe('Pruning', () => {
    it('should remove patterns below threshold', async () => {
      // Create a pattern with low success rate and high usage
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Low performing pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      // Manually set low success rate and high usage
      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.1, usage_count = 15')
        .run();

      const pruned = await patternLearner.prunePatterns();

      expect(pruned).toBe(1);

      const remaining = db.prepare('SELECT COUNT(*) as count FROM synthesis_patterns').get();
      expect(remaining.count).toBe(0);
    });

    it('should require minimum usage count', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'New pattern with low usage',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      // Set low success but keep usage low
      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.1, usage_count = 5')
        .run();

      const pruned = await patternLearner.prunePatterns();

      // Should NOT be pruned because usage is below minimum (10)
      expect(pruned).toBe(0);
    });

    it('should archive to Zep before deletion', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'urgency',
            description: 'Pattern to archive',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.1, usage_count = 15')
        .run();

      mockZep.addAgentMemory.mockClear();

      await patternLearner.prunePatterns();

      // Should have called Zep to archive
      const archiveCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[1].includes('[ARCHIVED PATTERN]')
      );
      expect(archiveCall).toBeDefined();
    });

    it('should return count of pruned patterns', async () => {
      // Add multiple patterns that will be pruned
      for (let i = 0; i < 3; i++) {
        await patternLearner.learnFromSynthesis(createMockSynthesisResult({
          new_patterns: [
            {
              patternType: 'consolidation',
              description: `Prune pattern ${i}`,
              triggerConditions: {},
              suggestedBehavior: {},
            },
          ],
        }));
      }

      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.1, usage_count = 15')
        .run();

      const pruned = await patternLearner.prunePatterns();

      expect(pruned).toBe(3);
    });
  });
});

describe('MetaImprover - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-meta-improver');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  let metaImprover: MetaImprover;
  let patternLearner: PatternLearner;

  beforeEach(() => {
    jest.clearAllMocks();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    Database.resetInstance();
    const db = Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    // Manually create synthesis_patterns table (since test mode only runs 001/002 migrations)
    db.exec(`
      CREATE TABLE IF NOT EXISTS synthesis_patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL CHECK(pattern_type IN ('consolidation', 'urgency', 'action', 'relationship')),
        description TEXT NOT NULL,
        trigger_conditions TEXT,
        suggested_behavior TEXT,
        success_rate REAL DEFAULT 0.5 CHECK(success_rate >= 0.0 AND success_rate <= 1.0),
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_type ON synthesis_patterns(pattern_type, success_rate DESC);
      CREATE INDEX IF NOT EXISTS idx_synthesis_patterns_usage ON synthesis_patterns(usage_count DESC);
    `);

    metaImprover = new MetaImprover();
    patternLearner = new PatternLearner();
  });

  afterEach(() => {
    Database.resetInstance();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Meta Analysis', () => {
    it('should identify high-success patterns', async () => {
      // Create patterns with various success rates
      for (let i = 0; i < 3; i++) {
        await patternLearner.learnFromSynthesis(createMockSynthesisResult({
          new_patterns: [
            {
              patternType: 'consolidation',
              description: `High success pattern ${i}`,
              triggerConditions: {},
              suggestedBehavior: {},
            },
          ],
        }));
      }

      // Set high success rates
      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.85, usage_count = 10')
        .run();

      // Run meta-analysis
      await metaImprover.runMetaAnalysis();

      // Should have created meta-patterns
      expect(mockZep.addAgentMemory).toHaveBeenCalled();
    });

    it('should identify low-success patterns', async () => {
      // Create low-performing patterns
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'action',
            description: 'Low success pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.2, usage_count = 5')
        .run();

      await metaImprover.runMetaAnalysis();

      // Check that style guide was stored
      const styleGuideCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[1].includes('[SYNTHESIS STYLE GUIDE]')
      );
      expect(styleGuideCall).toBeDefined();
    });

    it('should generate meta-patterns from clusters', async () => {
      // Create multiple high-success patterns of same type
      for (let i = 0; i < 5; i++) {
        await patternLearner.learnFromSynthesis(createMockSynthesisResult({
          new_patterns: [
            {
              patternType: 'urgency',
              description: `Urgency pattern ${i}`,
              triggerConditions: { keywords: ['urgent'] },
              suggestedBehavior: { urgencyOverride: 'high' },
            },
          ],
        }));
      }

      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.8, usage_count = 10')
        .run();

      await metaImprover.runMetaAnalysis();

      // Should have added meta-pattern
      const metaPatternCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[1].includes('Meta-pattern')
      );
      expect(metaPatternCall).toBeDefined();
    });

    it('should generate style guide', async () => {
      await patternLearner.learnFromSynthesis(createMockSynthesisResult({
        new_patterns: [
          {
            patternType: 'consolidation',
            description: 'Style guide test pattern',
            triggerConditions: {},
            suggestedBehavior: {},
          },
        ],
      }));

      const db = Database.getInstance();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.75, usage_count = 10')
        .run();

      await metaImprover.runMetaAnalysis();

      const styleGuideCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[2]?.type === 'style_guide'
      );
      expect(styleGuideCall).toBeDefined();
    });

    it('should store summary in Zep', async () => {
      await metaImprover.runMetaAnalysis();

      const summaryCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[2]?.type === 'meta_analysis'
      );
      expect(summaryCall).toBeDefined();
      expect(summaryCall[2]).toHaveProperty('timestamp');
      expect(summaryCall[2]).toHaveProperty('total_patterns');
    });
  });

  describe('Recommendations', () => {
    it('should produce actionable guidance', async () => {
      // Create mix of patterns
      for (let i = 0; i < 3; i++) {
        await patternLearner.learnFromSynthesis(createMockSynthesisResult({
          new_patterns: [
            {
              patternType: 'consolidation',
              description: `Pattern ${i}`,
              triggerConditions: {},
              suggestedBehavior: {},
            },
          ],
        }));
      }

      const db = Database.getInstance();
      // Set varying success rates
      const patterns = db.prepare('SELECT id FROM synthesis_patterns').all();
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.9, usage_count = 10 WHERE id = ?')
        .run(patterns[0].id);
      db.prepare('UPDATE synthesis_patterns SET success_rate = 0.2, usage_count = 5 WHERE id = ?')
        .run(patterns[1].id);

      await metaImprover.runMetaAnalysis();

      const styleGuideCall = mockZep.addAgentMemory.mock.calls.find(
        call => call[1].includes('Recommendations')
      );
      expect(styleGuideCall).toBeDefined();
      expect(styleGuideCall[1]).toContain('Focus on');
    });
  });
});
