// @ts-nocheck
/**
 * Tests for Cognitive Synthesis Engine Initialization
 *
 * Tests the Cortex initialization system including Working Memory
 * initialization, Synthesis Loop management, and health checking.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock working memory
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
}));

// Import after mocks
import {
  initializeCortex,
  stopSynthesisLoop,
  getCortexHealth,
  resetCortex,
  isCortexInitialized,
  isSynthesisLoopRunning,
  type CortexInitConfig,
} from '../../../lib/cortex/init';

describe('Cognitive Synthesis Engine Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetCortex();
  });

  afterEach(() => {
    resetCortex();
    jest.useRealTimers();
  });

  // ==========================================================================
  // Type Definitions Tests
  // ==========================================================================

  describe('CortexInitConfig', () => {
    it('should allow empty config', () => {
      const config: CortexInitConfig = {};
      expect(config).toBeDefined();
    });

    it('should allow working memory config', () => {
      const config: CortexInitConfig = {
        workingMemory: {
          maxEvents: 1000,
          maxAgeMs: 86400000,
        },
      };
      expect(config.workingMemory).toBeDefined();
    });

    it('should allow synthesis loop config', () => {
      const config: CortexInitConfig = {
        startSynthesisLoop: true,
        synthesisIntervalMs: 600000,
        minEventsForSynthesis: 5,
      };
      expect(config.startSynthesisLoop).toBe(true);
      expect(config.synthesisIntervalMs).toBe(600000);
    });

    it('should allow full config', () => {
      const config: CortexInitConfig = {
        workingMemory: { maxEvents: 500 },
        startSynthesisLoop: true,
        synthesisIntervalMs: 300000,
        minEventsForSynthesis: 3,
      };
      expect(Object.keys(config)).toHaveLength(4);
    });
  });

  // ==========================================================================
  // initializeCortex Tests
  // ==========================================================================

  describe('initializeCortex', () => {
    it('should initialize without config', async () => {
      await initializeCortex();

      expect(isCortexInitialized()).toBe(true);
      expect(mockWorkingMemory.getStats).toHaveBeenCalled();
    });

    it('should initialize with empty config', async () => {
      await initializeCortex({});

      expect(isCortexInitialized()).toBe(true);
    });

    it('should not start synthesis loop by default', async () => {
      await initializeCortex();

      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should start synthesis loop when configured', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await initializeCortex();
      const firstCallCount = mockWorkingMemory.getStats.mock.calls.length;

      await initializeCortex();
      const secondCallCount = mockWorkingMemory.getStats.mock.calls.length;

      // Should not call getStats again for working memory stats
      // (may be called once more for checking if should run synthesis)
      expect(secondCallCount - firstCallCount).toBeLessThanOrEqual(1);
    });

    it('should use default synthesis interval', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should use custom synthesis interval', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        synthesisIntervalMs: 600000,
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should use custom min events for synthesis', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        minEventsForSynthesis: 10,
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should throw error on initialization failure', async () => {
      mockWorkingMemory.getStats.mockRejectedValueOnce(new Error('DB connection failed'));
      resetCortex();

      await expect(initializeCortex()).rejects.toThrow('Cortex initialization failed');
    });
  });

  // ==========================================================================
  // stopSynthesisLoop Tests
  // ==========================================================================

  describe('stopSynthesisLoop', () => {
    it('should stop running synthesis loop', async () => {
      await initializeCortex({ startSynthesisLoop: true });
      expect(isSynthesisLoopRunning()).toBe(true);

      stopSynthesisLoop();

      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should handle stopping when not running', () => {
      expect(() => stopSynthesisLoop()).not.toThrow();
      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should handle multiple stop calls', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      stopSynthesisLoop();
      stopSynthesisLoop();
      stopSynthesisLoop();

      expect(isSynthesisLoopRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // getCortexHealth Tests
  // ==========================================================================

  describe('getCortexHealth', () => {
    it('should return not_initialized status when not initialized', async () => {
      const health = await getCortexHealth();

      expect(health.status).toBe('not_initialized');
      expect(health.initialized).toBe(false);
      expect(health.workingMemoryReady).toBe(false);
      expect(health.synthesisLoopRunning).toBe(false);
    });

    it('should return healthy status when initialized', async () => {
      await initializeCortex();

      const health = await getCortexHealth();

      expect(health.status).toBe('healthy');
      expect(health.initialized).toBe(true);
      expect(health.workingMemoryReady).toBe(true);
    });

    it('should include working memory stats when healthy', async () => {
      await initializeCortex();

      const health = await getCortexHealth();

      expect(health.workingMemoryStats).toBeDefined();
      expect(health.workingMemoryStats.totalEvents).toBe(100);
      expect(health.workingMemoryStats.unprocessedEvents).toBe(25);
    });

    it('should include synthesis loop status', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      const health = await getCortexHealth();

      expect(health.synthesisLoopRunning).toBe(true);
    });

    it('should include last initialized timestamp', async () => {
      await initializeCortex();

      const health = await getCortexHealth();

      expect(health.lastInitialized).toBeDefined();
      expect(typeof health.lastInitialized).toBe('string');
    });

    it('should return unhealthy status on error', async () => {
      await initializeCortex();
      mockWorkingMemory.getStats.mockRejectedValueOnce(new Error('Connection lost'));

      const health = await getCortexHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Connection lost');
    });
  });

  // ==========================================================================
  // resetCortex Tests
  // ==========================================================================

  describe('resetCortex', () => {
    it('should reset initialized state', async () => {
      await initializeCortex();
      expect(isCortexInitialized()).toBe(true);

      resetCortex();

      expect(isCortexInitialized()).toBe(false);
    });

    it('should stop synthesis loop', async () => {
      await initializeCortex({ startSynthesisLoop: true });
      expect(isSynthesisLoopRunning()).toBe(true);

      resetCortex();

      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should allow reinitialization after reset', async () => {
      await initializeCortex();
      resetCortex();

      await initializeCortex();

      expect(isCortexInitialized()).toBe(true);
    });
  });

  // ==========================================================================
  // isCortexInitialized Tests
  // ==========================================================================

  describe('isCortexInitialized', () => {
    it('should return false initially', () => {
      expect(isCortexInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await initializeCortex();

      expect(isCortexInitialized()).toBe(true);
    });

    it('should return false after reset', async () => {
      await initializeCortex();
      resetCortex();

      expect(isCortexInitialized()).toBe(false);
    });
  });

  // ==========================================================================
  // isSynthesisLoopRunning Tests
  // ==========================================================================

  describe('isSynthesisLoopRunning', () => {
    it('should return false initially', () => {
      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should return false when initialized without loop', async () => {
      await initializeCortex();

      expect(isSynthesisLoopRunning()).toBe(false);
    });

    it('should return true when loop is started', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should return false after stopping loop', async () => {
      await initializeCortex({ startSynthesisLoop: true });
      stopSynthesisLoop();

      expect(isSynthesisLoopRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // Synthesis Loop Behavior Tests
  // ==========================================================================

  describe('Synthesis Loop Behavior', () => {
    it('should run synthesis when enough events are pending', async () => {
      mockWorkingMemory.getStats.mockResolvedValue({
        ...mockWorkingMemoryStats,
        unprocessedEvents: 10, // More than default min of 3
      });

      await initializeCortex({ startSynthesisLoop: true });

      // Run pending timers
      await jest.runOnlyPendingTimersAsync();

      // Should have checked stats multiple times (init + synthesis)
      expect(mockWorkingMemory.getStats.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip synthesis when not enough events', async () => {
      mockWorkingMemory.getStats.mockResolvedValue({
        ...mockWorkingMemoryStats,
        unprocessedEvents: 1, // Less than default min of 3
      });

      await initializeCortex({ startSynthesisLoop: true });

      // Should still function without errors
      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should handle synthesis loop errors gracefully', async () => {
      await initializeCortex({ startSynthesisLoop: true });

      // Make getStats fail for the next synthesis run
      mockWorkingMemory.getStats.mockRejectedValueOnce(new Error('Temporary failure'));

      // Run pending timers - should not throw
      await jest.runOnlyPendingTimersAsync();

      // Loop should still be running
      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should not start second loop if already running', async () => {
      await initializeCortex({ startSynthesisLoop: true });
      const firstStatus = isSynthesisLoopRunning();

      // Reset and try to start again without proper reset
      // This simulates attempting to start loop when already running
      await initializeCortex({ startSynthesisLoop: true });

      expect(firstStatus).toBe(true);
      expect(isSynthesisLoopRunning()).toBe(true);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should initialize, run, and stop synthesis loop', async () => {
      // Initialize with synthesis loop
      await initializeCortex({
        startSynthesisLoop: true,
        synthesisIntervalMs: 1000,
        minEventsForSynthesis: 5,
      });

      expect(isCortexInitialized()).toBe(true);
      expect(isSynthesisLoopRunning()).toBe(true);

      // Check health
      const health = await getCortexHealth();
      expect(health.status).toBe('healthy');

      // Stop loop
      stopSynthesisLoop();
      expect(isSynthesisLoopRunning()).toBe(false);

      // Health should still be healthy
      const healthAfterStop = await getCortexHealth();
      expect(healthAfterStop.status).toBe('healthy');
      expect(healthAfterStop.synthesisLoopRunning).toBe(false);

      // Reset
      resetCortex();
      expect(isCortexInitialized()).toBe(false);

      // Health should show not initialized
      const healthAfterReset = await getCortexHealth();
      expect(healthAfterReset.status).toBe('not_initialized');
    });

    it('should work with minimal configuration', async () => {
      await initializeCortex();

      const health = await getCortexHealth();

      expect(health.status).toBe('healthy');
      expect(health.initialized).toBe(true);
      expect(health.workingMemoryReady).toBe(true);
      expect(health.synthesisLoopRunning).toBe(false);
    });

    it('should work with full configuration', async () => {
      await initializeCortex({
        workingMemory: { maxEvents: 2000 },
        startSynthesisLoop: true,
        synthesisIntervalMs: 120000,
        minEventsForSynthesis: 10,
      });

      const health = await getCortexHealth();

      expect(health.status).toBe('healthy');
      expect(health.initialized).toBe(true);
      expect(health.workingMemoryReady).toBe(true);
      expect(health.synthesisLoopRunning).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero events in working memory', async () => {
      mockWorkingMemory.getStats.mockResolvedValueOnce({
        ...mockWorkingMemoryStats,
        totalEvents: 0,
        unprocessedEvents: 0,
        eventsBySource: {},
      });

      await initializeCortex();

      expect(isCortexInitialized()).toBe(true);
    });

    it('should handle very large event counts', async () => {
      mockWorkingMemory.getStats.mockResolvedValueOnce({
        ...mockWorkingMemoryStats,
        totalEvents: 1000000,
        unprocessedEvents: 500000,
      });

      await initializeCortex();

      expect(isCortexInitialized()).toBe(true);
    });

    it('should handle very short synthesis interval', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        synthesisIntervalMs: 100,
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should handle very long synthesis interval', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        synthesisIntervalMs: 3600000, // 1 hour
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should handle min events for synthesis of zero', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        minEventsForSynthesis: 0,
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });

    it('should handle high min events for synthesis', async () => {
      await initializeCortex({
        startSynthesisLoop: true,
        minEventsForSynthesis: 1000,
      });

      expect(isSynthesisLoopRunning()).toBe(true);
    });
  });
});
