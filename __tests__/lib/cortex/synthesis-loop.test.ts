// @ts-nocheck
/**
 * Synthesis Loop - High Fidelity Tests
 *
 * Tests the SynthesisLoop class including:
 * - Start/stop lifecycle management
 * - Synthesis pass execution
 * - LLM invocation with retry logic
 * - JSON response parsing (clean, markdown-wrapped, malformed)
 * - Working memory integration
 * - Singleton management
 */

import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Database } from '../../../lib/db/Database';
import { resetWorkingMemory, getWorkingMemory } from '../../../lib/cortex/working-memory';
import {
  SynthesisLoop,
  getSynthesisLoop,
  resetSynthesisLoop,
} from '../../../lib/cortex/synthesis-loop';
import {
  createMockWorkingMemoryEvent,
  createMockSynthesisResult,
  createMockLLMResponse,
  createMockLLMResponseWithMarkdown,
} from '../../helpers/cortex-test-utils';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock the agent invoker to avoid actual LLM calls
const mockInvoke = jest.fn();
jest.mock('../../../lib/agents/AgentInvoker', () => ({
  agentInvoker: {
    invoke: (...args: any[]) => mockInvoke(...args),
  },
}));

describe('Synthesis Loop - High Fidelity', () => {
  const TEST_DIR = join(process.cwd(), '.data', 'test-synthesis-loop');
  const TEST_DB_PATH = join(TEST_DIR, 'test.db');
  const MIGRATIONS_PATH = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Reset singletons
    Database.resetInstance();
    resetWorkingMemory();
    resetSynthesisLoop();

    // Initialize Database singleton with test path
    Database.getInstance(TEST_DB_PATH, MIGRATIONS_PATH);

    // Reset mock
    mockInvoke.mockReset();
  });

  afterEach(() => {
    // Stop any running loops
    resetSynthesisLoop();
    resetWorkingMemory();
    Database.resetInstance();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Lifecycle Management', () => {
    it('should initialize with default config', () => {
      const loop = new SynthesisLoop();
      const status = loop.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.lastSynthesisAt).toBeNull();
      expect(status.taskCount).toBe(0);
    });

    it('should start and set isRunning to true', () => {
      const loop = new SynthesisLoop({ intervalMs: 60000 });

      loop.start();
      const status = loop.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.nextSynthesisAt).not.toBeNull();

      loop.stop(); // Clean up
    });

    it('should stop and set isRunning to false', () => {
      const loop = new SynthesisLoop({ intervalMs: 60000 });

      loop.start();
      expect(loop.getStatus().isRunning).toBe(true);

      loop.stop();
      const status = loop.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.nextSynthesisAt).toBeNull();
    });

    it('should ignore duplicate start() calls', () => {
      const loop = new SynthesisLoop({ intervalMs: 60000 });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      loop.start();
      loop.start(); // Should warn and return

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already running')
      );

      loop.stop();
      consoleSpy.mockRestore();
    });

    it('should ignore stop() when not running', () => {
      const loop = new SynthesisLoop();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      loop.stop(); // Not running

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not running')
      );

      consoleSpy.mockRestore();
    });

    it('should accept custom config', () => {
      const loop = new SynthesisLoop({
        intervalMs: 10000,
        minEventsForSynthesis: 5,
        maxEventsPerPass: 100,
      });

      // Config is internal, but we can verify behavior through synthesis pass
      expect(loop.getStatus().isRunning).toBe(false);
    });
  });

  describe('Synthesis Pass - Minimum Events', () => {
    it('should skip synthesis when events < minEventsForSynthesis', async () => {
      const loop = new SynthesisLoop({
        minEventsForSynthesis: 5,
      });

      // Add only 2 events (less than threshold)
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Event 1' }));
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Event 2' }));

      const result = await loop.runSynthesisPass();

      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should proceed when events >= minEventsForSynthesis', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Test synthesis',
        events_fully_processed: [],
      });
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({
        minEventsForSynthesis: 3,
      });

      // Add 3 events (meets threshold)
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Event 1' }));
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Event 2' }));
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Event 3' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('Synthesis Pass - Event Processing', () => {
    it('should fetch unprocessed events up to maxEventsPerPass', async () => {
      const synthesisResult = createMockSynthesisResult({
        events_fully_processed: [],
      });
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({
        minEventsForSynthesis: 2,
        maxEventsPerPass: 3,
      });

      // Add 5 events
      const wm = getWorkingMemory();
      for (let i = 0; i < 5; i++) {
        await wm.addEvent(createMockWorkingMemoryEvent({ content: `Event ${i}` }));
      }

      await loop.runSynthesisPass();

      // Verify the prompt contains events
      expect(mockInvoke).toHaveBeenCalled();
      const invokeCall = mockInvoke.mock.calls[0][0];
      expect(invokeCall.userMessage).toContain('[Event 1]');
    });

    it('should mark events as processed based on LLM response', async () => {
      const loop = new SynthesisLoop({
        minEventsForSynthesis: 3,
      });

      const wm = getWorkingMemory();

      // Add events and capture actual IDs
      const eventId1 = await wm.addEvent({
        source: 'email',
        content: 'Process me 1',
        timestamp: new Date().toISOString(),
      });
      const eventId2 = await wm.addEvent({
        source: 'email',
        content: 'Process me 2',
        timestamp: new Date().toISOString(),
      });
      const eventId3 = await wm.addEvent({
        source: 'email',
        content: 'Keep me unprocessed',
        timestamp: new Date().toISOString(),
      });

      // Create synthesis result with actual event IDs
      const synthesisResult = createMockSynthesisResult({
        events_fully_processed: [eventId1!, eventId2!],
      });
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      await loop.runSynthesisPass();

      // Check that events were marked as processed
      const unprocessed = await wm.getUnprocessed(10);
      expect(unprocessed.length).toBe(1);
      expect(unprocessed[0].id).toBe(eventId3);
    });
  });

  describe('LLM Invocation with Retry', () => {
    it('should succeed on first attempt', async () => {
      const synthesisResult = createMockSynthesisResult();
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const synthesisResult = createMockSynthesisResult();
      mockInvoke
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue({
          content: JSON.stringify(synthesisResult),
          tokensUsed: { total: 100 },
          latencyMs: 500,
        });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    }, 15000); // Longer timeout for retries

    it('should throw after max retries exhausted', async () => {
      mockInvoke.mockRejectedValue(new Error('Persistent failure'));

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      await expect(loop.runSynthesisPass()).rejects.toThrow(
        'Failed to invoke LLM after 3 attempts'
      );
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should pass correct parameters to agentInvoker', async () => {
      const synthesisResult = createMockSynthesisResult();
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test event' }));

      await loop.runSynthesisPass();

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent.orchestrator',
          forceExecute: true,
          context: expect.objectContaining({
            skipMemory: true,
            metadata: expect.objectContaining({
              type: 'synthesis',
            }),
          }),
        })
      );
    });
  });

  describe('JSON Response Parsing', () => {
    it('should parse clean JSON response', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Clean JSON test',
        unified_tasks: [
          {
            title: 'Test Task',
            description: 'Description',
            confidence: 0.8,
            urgency: 'medium',
            domain: 'general',
            sourceEvents: ['evt-1'],
          },
        ],
      });

      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.synthesis_summary).toBe('Clean JSON test');
      expect(result?.unified_tasks).toHaveLength(1);
    });

    it('should strip markdown code blocks from response', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Markdown wrapped test',
      });

      mockInvoke.mockResolvedValue({
        content: createMockLLMResponseWithMarkdown(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.synthesis_summary).toBe('Markdown wrapped test');
    });

    it('should handle ```json code blocks', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'JSON code block test',
      });

      const wrappedResponse = '```json\n' + JSON.stringify(synthesisResult) + '\n```';

      mockInvoke.mockResolvedValue({
        content: wrappedResponse,
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.synthesis_summary).toBe('JSON code block test');
    });

    it('should handle plain ``` code blocks', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Plain code block test',
      });

      const wrappedResponse = '```\n' + JSON.stringify(synthesisResult) + '\n```';

      mockInvoke.mockResolvedValue({
        content: wrappedResponse,
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.synthesis_summary).toBe('Plain code block test');
    });

    it('should return null for malformed JSON', async () => {
      mockInvoke.mockResolvedValue({
        content: '{invalid json content',
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await loop.runSynthesisPass();
      consoleSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should return null for missing required fields', async () => {
      // Missing unified_tasks, task_updates, etc.
      const incompleteResult = {
        synthesis_summary: 'Incomplete',
        // Missing required arrays
      };

      mockInvoke.mockResolvedValue({
        content: JSON.stringify(incompleteResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await loop.runSynthesisPass();
      consoleSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should handle whitespace around JSON', async () => {
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Whitespace test',
      });

      mockInvoke.mockResolvedValue({
        content: '\n\n  ' + JSON.stringify(synthesisResult) + '  \n\n',
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.synthesis_summary).toBe('Whitespace test');
    });
  });

  describe('Prompt Building', () => {
    it('should include events in prompt', async () => {
      const synthesisResult = createMockSynthesisResult();
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();

      // addEvent returns the actual ID used in the database
      const eventId = await wm.addEvent({
        source: 'email',
        content: JSON.stringify({ from: 'test@example.com', subject: 'Test Subject' }),
        timestamp: new Date().toISOString(),
      });

      await loop.runSynthesisPass();

      const prompt = mockInvoke.mock.calls[0][0].userMessage;
      expect(prompt).toContain('email');
      expect(prompt).toContain(eventId!);
    });

    it('should include instructions for JSON output format', async () => {
      const synthesisResult = createMockSynthesisResult();
      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      await loop.runSynthesisPass();

      const prompt = mockInvoke.mock.calls[0][0].userMessage;
      expect(prompt).toContain('unified_tasks');
      expect(prompt).toContain('events_fully_processed');
      expect(prompt).toContain('ONLY valid JSON');
    });
  });

  describe('Status Reporting', () => {
    it('should update status after synthesis pass', async () => {
      const synthesisResult = createMockSynthesisResult({
        unified_tasks: [
          {
            title: 'Task 1',
            description: 'Desc',
            confidence: 0.8,
            urgency: 'medium',
            domain: 'general',
            sourceEvents: [],
          },
          {
            title: 'Task 2',
            description: 'Desc',
            confidence: 0.7,
            urgency: 'low',
            domain: 'general',
            sourceEvents: [],
          },
        ],
        task_updates: [{ taskId: 'existing', updates: {}, newSourceEvents: [], rationale: 'Test' }],
      });

      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();
      await wm.addEvent(createMockWorkingMemoryEvent({ content: 'Test' }));

      await loop.runSynthesisPass();

      const status = loop.getStatus();
      expect(status.taskCount).toBe(3); // 2 new + 1 update
      expect(status.lastSynthesisAt).not.toBeNull();
      expect(status.lastSynthesisAt).toBeGreaterThan(0);
    });

    it('should track nextSynthesisAt when running', () => {
      const loop = new SynthesisLoop({ intervalMs: 30000 });

      expect(loop.getStatus().nextSynthesisAt).toBeNull();

      loop.start();
      const status = loop.getStatus();

      expect(status.nextSynthesisAt).not.toBeNull();
      expect(status.nextSynthesisAt).toBeGreaterThan(Date.now());

      loop.stop();
    });
  });

  describe('Singleton Management', () => {
    it('should return same instance from getSynthesisLoop()', () => {
      const loop1 = getSynthesisLoop();
      const loop2 = getSynthesisLoop();

      expect(loop1).toBe(loop2);
    });

    it('should create new instance after resetSynthesisLoop()', () => {
      const loop1 = getSynthesisLoop();
      loop1.start();

      resetSynthesisLoop();

      const loop2 = getSynthesisLoop();

      expect(loop1).not.toBe(loop2);
      expect(loop2.getStatus().isRunning).toBe(false);
    });

    it('should stop running loop on reset', () => {
      const loop = getSynthesisLoop();
      loop.start();

      expect(loop.getStatus().isRunning).toBe(true);

      resetSynthesisLoop();

      // Original loop should be stopped
      expect(loop.getStatus().isRunning).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle working memory errors gracefully', async () => {
      // This test verifies the loop handles errors from getStats()
      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });

      // Reset working memory to create error condition
      resetWorkingMemory();
      Database.resetInstance();

      // Without initializing database, getWorkingMemory will fail
      await expect(loop.runSynthesisPass()).rejects.toThrow();
    });

    it('should not mark events if synthesis result is null', async () => {
      // Return invalid JSON that will parse to null
      mockInvoke.mockResolvedValue({
        content: '{incomplete',
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      const loop = new SynthesisLoop({ minEventsForSynthesis: 1 });
      const wm = getWorkingMemory();

      // addEvent returns the actual ID used in the database
      const eventId = await wm.addEvent({
        source: 'email',
        content: 'Test event content',
        timestamp: new Date().toISOString(),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await loop.runSynthesisPass();
      consoleSpy.mockRestore();

      // Event should still be unprocessed
      const unprocessed = await wm.getUnprocessed(10);
      expect(unprocessed).toHaveLength(1);
      expect(unprocessed[0].id).toBe(eventId);
    });
  });

  describe('Integration with Working Memory', () => {
    it('should correctly integrate synthesis results with working memory', async () => {
      const loop = new SynthesisLoop({ minEventsForSynthesis: 2 });
      const wm = getWorkingMemory();

      // Add events and capture the actual IDs returned by working memory
      const eventId1 = await wm.addEvent({
        source: 'email',
        content: 'Event 1 content',
        timestamp: new Date().toISOString(),
      });
      const eventId2 = await wm.addEvent({
        source: 'imessage',
        content: 'Event 2 content',
        timestamp: new Date().toISOString(),
      });

      // Now create synthesis result using the actual event IDs
      const synthesisResult = createMockSynthesisResult({
        synthesis_summary: 'Processed 2 events',
        unified_tasks: [
          {
            title: 'Combined Task',
            description: 'From both events',
            confidence: 0.85,
            urgency: 'medium',
            domain: 'productivity',
            sourceEvents: [eventId1!, eventId2!],
          },
        ],
        events_fully_processed: [eventId1!, eventId2!],
      });

      mockInvoke.mockResolvedValue({
        content: JSON.stringify(synthesisResult),
        tokensUsed: { total: 100 },
        latencyMs: 500,
      });

      // Verify events are unprocessed initially
      let unprocessed = await wm.getUnprocessed(10);
      expect(unprocessed).toHaveLength(2);

      // Run synthesis
      const result = await loop.runSynthesisPass();

      expect(result).not.toBeNull();
      expect(result?.unified_tasks).toHaveLength(1);
      expect(result?.events_fully_processed).toContain(eventId1);
      expect(result?.events_fully_processed).toContain(eventId2);

      // Verify events are now processed
      unprocessed = await wm.getUnprocessed(10);
      expect(unprocessed).toHaveLength(0);
    });
  });
});
