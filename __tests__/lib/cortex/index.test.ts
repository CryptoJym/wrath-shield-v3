// @ts-nocheck
/**
 * Tests for Cognitive Synthesis Engine Main Entry Point
 *
 * Tests the Cortex module exports and convenience functions including
 * runSynthesis, getCortexStatus, and isHealthy.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock synthesis-loop
const mockSynthesisLoop = {
  runSynthesisPass: jest.fn(),
  getStatus: jest.fn(() => ({
    running: true,
    intervalMs: 300000,
    lastRunAt: '2025-01-15T10:00:00Z',
    passCount: 5,
    errorCount: 0,
  })),
};

jest.mock('../../../lib/cortex/synthesis-loop', () => ({
  synthesisLoop: mockSynthesisLoop,
  SynthesisLoop: jest.fn(),
  getSynthesisLoop: jest.fn(() => mockSynthesisLoop),
  resetSynthesisLoop: jest.fn(),
}));

// Mock init
const mockCortexHealth = {
  status: 'healthy',
  initialized: true,
  workingMemoryReady: true,
  synthesisLoopRunning: true,
  lastInitialized: '2025-01-15T00:00:00Z',
};

let mockInitialized = true;

jest.mock('../../../lib/cortex/init', () => ({
  getCortexHealth: jest.fn(() => Promise.resolve(mockCortexHealth)),
  initializeCortex: jest.fn(),
  stopSynthesisLoop: jest.fn(),
  resetCortex: jest.fn(),
  isCortexInitialized: jest.fn(() => mockInitialized),
  isSynthesisLoopRunning: jest.fn(() => true),
}));

// Mock working-memory
const mockWorkingMemoryStats = {
  totalEvents: 100,
  unprocessedEvents: 25,
  eventsBySource: { email: 50, calendar: 30, limitless: 20 },
  oldestEventTimestamp: '2025-01-01T00:00:00Z',
  newestEventTimestamp: '2025-01-15T00:00:00Z',
};

const mockWorkingMemory = {
  getStats: jest.fn(() => Promise.resolve(mockWorkingMemoryStats)),
};

jest.mock('../../../lib/cortex/working-memory', () => ({
  getWorkingMemory: jest.fn(() => mockWorkingMemory),
  WorkingMemory: jest.fn(),
  resetWorkingMemory: jest.fn(),
}));

// Mock types
jest.mock('../../../lib/cortex/types', () => ({
  DEFAULT_SYNTHESIS_CONFIG: {
    intervalMs: 300000,
    minEventsForSynthesis: 3,
    maxEventsPerPass: 100,
  },
  createWorkingMemoryEvent: jest.fn(),
  createUnifiedTask: jest.fn(),
  createProactiveAction: jest.fn(),
  isWorkingMemoryEvent: jest.fn(),
  isUnifiedTask: jest.fn(),
  isProactiveAction: jest.fn(),
  isSynthesisPattern: jest.fn(),
  isSynthesisResult: jest.fn(),
}));

// Mock event-ingestor
jest.mock('../../../lib/cortex/event-ingestor', () => ({
  ingestEmail: jest.fn(),
  ingestIMessage: jest.fn(),
  ingestLimitless: jest.fn(),
  ingestCalendar: jest.fn(),
}));

// Mock task-store
jest.mock('../../../lib/cortex/task-store', () => ({
  TaskStore: jest.fn(),
  Consolidator: jest.fn(),
  taskStore: {},
  consolidator: {},
  applySynthesisResult: jest.fn(),
}));

// Mock executor
jest.mock('../../../lib/cortex/executor', () => ({
  ProactiveExecutor: jest.fn(),
  proactiveExecutor: {},
  evaluateAction: jest.fn(),
  executeAction: jest.fn(),
  proposeAction: jest.fn(),
  handleSynthesisActions: jest.fn(),
}));

// Mock pattern-learner
jest.mock('../../../lib/cortex/pattern-learner', () => ({
  PatternLearner: jest.fn(),
  MetaImprover: jest.fn(),
  learnFromSynthesis: jest.fn(),
  learnFromCorrection: jest.fn(),
  getRelevantPatterns: jest.fn(),
  updatePatternSuccess: jest.fn(),
  prunePatterns: jest.fn(),
  default: {},
}));

// Mock synthesis-prompt
jest.mock('../../../lib/cortex/synthesis-prompt', () => ({
  buildSynthesisPrompt: jest.fn(),
  formatEventsForPrompt: jest.fn(),
  formatTasksForPrompt: jest.fn(),
  formatPatternsForPrompt: jest.fn(),
  SYNTHESIS_SYSTEM_PROMPT: 'Mock system prompt',
}));

// Import after mocks
import {
  runSynthesis,
  getCortexStatus,
  isHealthy,
  DEFAULT_SYNTHESIS_CONFIG,
} from '../../../lib/cortex';

describe('Cognitive Synthesis Engine - Main Entry Point', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitialized = true;
  });

  // ==========================================================================
  // Module Exports Tests
  // ==========================================================================

  describe('Module Exports', () => {
    it('should export DEFAULT_SYNTHESIS_CONFIG', () => {
      expect(DEFAULT_SYNTHESIS_CONFIG).toBeDefined();
    });

    it('should export runSynthesis function', () => {
      expect(runSynthesis).toBeDefined();
      expect(typeof runSynthesis).toBe('function');
    });

    it('should export getCortexStatus function', () => {
      expect(getCortexStatus).toBeDefined();
      expect(typeof getCortexStatus).toBe('function');
    });

    it('should export isHealthy function', () => {
      expect(isHealthy).toBeDefined();
      expect(typeof isHealthy).toBe('function');
    });
  });

  // ==========================================================================
  // runSynthesis Tests
  // ==========================================================================

  describe('runSynthesis', () => {
    it('should call synthesisLoop.runSynthesisPass', async () => {
      const mockResult = {
        synthesisId: 'synth-123',
        taskUpdates: [],
        newTasks: [],
        archivedTaskIds: [],
        proactiveActions: [],
        patterns: [],
        synthesizedAt: new Date().toISOString(),
        eventCount: 10,
        processingTimeMs: 500,
      };
      mockSynthesisLoop.runSynthesisPass.mockResolvedValueOnce(mockResult);

      const result = await runSynthesis();

      expect(mockSynthesisLoop.runSynthesisPass).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return null when no synthesis needed', async () => {
      mockSynthesisLoop.runSynthesisPass.mockResolvedValueOnce(null);

      const result = await runSynthesis();

      expect(result).toBeNull();
    });

    it('should propagate errors from synthesis loop', async () => {
      mockSynthesisLoop.runSynthesisPass.mockRejectedValueOnce(
        new Error('Synthesis failed')
      );

      await expect(runSynthesis()).rejects.toThrow('Synthesis failed');
    });
  });

  // ==========================================================================
  // getCortexStatus Tests
  // ==========================================================================

  describe('getCortexStatus', () => {
    it('should return comprehensive status', async () => {
      const status = await getCortexStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('synthesisLoop');
      expect(status).toHaveProperty('workingMemory');
      expect(status).toHaveProperty('health');
    });

    it('should include initialization status', async () => {
      const status = await getCortexStatus();

      expect(status.initialized).toBe(true);
    });

    it('should include synthesis loop status', async () => {
      const status = await getCortexStatus();

      expect(status.synthesisLoop).toBeDefined();
      expect(status.synthesisLoop.running).toBe(true);
      expect(status.synthesisLoop.intervalMs).toBe(300000);
    });

    it('should include working memory stats', async () => {
      const status = await getCortexStatus();

      expect(status.workingMemory).toBeDefined();
      expect(status.workingMemory.totalEvents).toBe(100);
      expect(status.workingMemory.unprocessedEvents).toBe(25);
    });

    it('should include health status', async () => {
      const status = await getCortexStatus();

      expect(status.health).toBe('healthy');
    });

    it('should include error when health has error', async () => {
      const { getCortexHealth } = require('../../../lib/cortex/init');
      getCortexHealth.mockResolvedValueOnce({
        status: 'unhealthy',
        initialized: true,
        error: 'Database connection lost',
      });

      const status = await getCortexStatus();

      expect(status.lastError).toBe('Database connection lost');
    });

    it('should not include lastError when healthy', async () => {
      const status = await getCortexStatus();

      expect(status.lastError).toBeUndefined();
    });
  });

  // ==========================================================================
  // isHealthy Tests
  // ==========================================================================

  describe('isHealthy', () => {
    it('should return true when cortex is initialized', () => {
      mockInitialized = true;

      const result = isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when cortex is not initialized', () => {
      const { isCortexInitialized } = require('../../../lib/cortex/init');
      isCortexInitialized.mockReturnValueOnce(false);

      const result = isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when require fails', () => {
      // Create a scenario where isCortexInitialized throws
      const { isCortexInitialized } = require('../../../lib/cortex/init');
      isCortexInitialized.mockImplementationOnce(() => {
        throw new Error('Module not found');
      });

      const result = isHealthy();

      expect(result).toBe(false);
    });

    it('should be synchronous for quick health checks', () => {
      const result = isHealthy();

      // Should not be a promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(typeof result).toBe('boolean');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should work together for status check and synthesis', async () => {
      // Check status first
      const status = await getCortexStatus();
      expect(status.initialized).toBe(true);
      expect(status.health).toBe('healthy');

      // Quick health check
      expect(isHealthy()).toBe(true);

      // Run synthesis
      mockSynthesisLoop.runSynthesisPass.mockResolvedValueOnce({
        synthesisId: 'synth-test',
        taskUpdates: [],
        newTasks: [],
        archivedTaskIds: [],
        proactiveActions: [],
        patterns: [],
        synthesizedAt: new Date().toISOString(),
        eventCount: 5,
        processingTimeMs: 250,
      });

      const result = await runSynthesis();
      expect(result).toBeDefined();
      expect(result.synthesisId).toBe('synth-test');
    });

    it('should handle unhealthy state', async () => {
      const { isCortexInitialized } = require('../../../lib/cortex/init');
      isCortexInitialized.mockReturnValue(false);

      const { getCortexHealth } = require('../../../lib/cortex/init');
      getCortexHealth.mockResolvedValueOnce({
        status: 'not_initialized',
        initialized: false,
        workingMemoryReady: false,
        synthesisLoopRunning: false,
      });

      // Quick health check returns false
      expect(isHealthy()).toBe(false);

      // Detailed status shows not initialized
      const status = await getCortexStatus();
      expect(status.health).toBe('not_initialized');
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty working memory stats', async () => {
      mockWorkingMemory.getStats.mockResolvedValueOnce({
        totalEvents: 0,
        unprocessedEvents: 0,
        eventsBySource: {},
        oldestEventTimestamp: null,
        newestEventTimestamp: null,
      });

      const status = await getCortexStatus();

      expect(status.workingMemory.totalEvents).toBe(0);
      expect(status.workingMemory.unprocessedEvents).toBe(0);
    });

    it('should handle synthesis returning empty result', async () => {
      mockSynthesisLoop.runSynthesisPass.mockResolvedValueOnce({
        synthesisId: 'synth-empty',
        taskUpdates: [],
        newTasks: [],
        archivedTaskIds: [],
        proactiveActions: [],
        patterns: [],
        synthesizedAt: new Date().toISOString(),
        eventCount: 0,
        processingTimeMs: 50,
      });

      const result = await runSynthesis();

      expect(result).toBeDefined();
      expect(result.eventCount).toBe(0);
      expect(result.taskUpdates).toHaveLength(0);
    });

    it('should handle concurrent status checks', async () => {
      const [status1, status2, status3] = await Promise.all([
        getCortexStatus(),
        getCortexStatus(),
        getCortexStatus(),
      ]);

      expect(status1.initialized).toBe(true);
      expect(status2.initialized).toBe(true);
      expect(status3.initialized).toBe(true);
    });

    it('should handle working memory stats error gracefully', async () => {
      mockWorkingMemory.getStats.mockRejectedValueOnce(
        new Error('Stats unavailable')
      );

      await expect(getCortexStatus()).rejects.toThrow('Stats unavailable');
    });

    it('should handle synthesis loop status with zero pass count', async () => {
      mockSynthesisLoop.getStatus.mockReturnValueOnce({
        running: true,
        intervalMs: 300000,
        lastRunAt: null,
        passCount: 0,
        errorCount: 0,
      });

      const status = await getCortexStatus();

      expect(status.synthesisLoop.passCount).toBe(0);
      expect(status.synthesisLoop.lastRunAt).toBeNull();
    });
  });

  // ==========================================================================
  // Server-Only Guard Tests
  // ==========================================================================

  describe('Server-Only Guard', () => {
    it('should call ensureServerOnly on module load', () => {
      const { ensureServerOnly } = require('../../../lib/server-only-guard');

      // The module was imported, so ensureServerOnly should have been called
      expect(ensureServerOnly).toHaveBeenCalledWith('lib/cortex');
    });
  });
});
