/**
 * Cortex Test Utilities
 *
 * High-fidelity test helpers for Cortex and EA testing.
 * These utilities create real test databases and provide factory functions
 * for creating valid test data.
 */

import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

import type {
  WorkingMemoryEvent,
  EventSource,
  UnifiedTask,
  UnifiedTaskStatus,
  UrgencyLevel,
  SynthesisPattern,
  SynthesisPatternType,
  SynthesisResult,
  ProactiveAction,
  ProactiveActionType,
} from '../../lib/cortex/types';
import type { Domain } from '../../lib/ea/preference-model';

// ============================================================================
// Test Database Management
// ============================================================================

const TEST_DATA_DIR = join(process.cwd(), '.data', 'test');

/**
 * Create a test database directory and return paths
 */
export function createTestDatabasePaths(testName: string): {
  dbPath: string;
  migrationsPath: string;
  cleanup: () => void;
} {
  const testDir = join(TEST_DATA_DIR, testName);
  const dbPath = join(testDir, 'test.db');
  const migrationsPath = join(process.cwd(), 'migrations'); // Use real migrations

  // Ensure test directory exists
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  // Clean up any existing test database
  if (existsSync(dbPath)) {
    rmSync(dbPath);
  }
  if (existsSync(dbPath + '-wal')) {
    rmSync(dbPath + '-wal');
  }
  if (existsSync(dbPath + '-shm')) {
    rmSync(dbPath + '-shm');
  }

  const cleanup = () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  };

  return { dbPath, migrationsPath, cleanup };
}

// ============================================================================
// Working Memory Event Factories
// ============================================================================

/**
 * Create a valid WorkingMemoryEvent for testing
 */
export function createMockWorkingMemoryEvent(
  overrides: Partial<WorkingMemoryEvent> = {}
): WorkingMemoryEvent {
  const id = overrides.id ?? randomUUID();
  const content = overrides.content ?? JSON.stringify({ test: 'data' });

  return {
    id,
    source: 'email' as EventSource,
    timestamp: new Date().toISOString(),
    content,
    contentHash: createHash(content),
    processedBySynthesis: false,
    ...overrides,
  };
}

/**
 * Create an email event
 */
export function createEmailEvent(
  from: string,
  subject: string,
  body: string,
  overrides: Partial<WorkingMemoryEvent> = {}
): WorkingMemoryEvent {
  const content = JSON.stringify({ from, subject, body, timestamp: new Date().toISOString() });
  return createMockWorkingMemoryEvent({
    source: 'email',
    content,
    metadata: { from, subject, messageId: randomUUID() },
    ...overrides,
  });
}

/**
 * Create an iMessage event
 */
export function createIMessageEvent(
  contact: string,
  message: string,
  direction: 'sent' | 'received' = 'received',
  overrides: Partial<WorkingMemoryEvent> = {}
): WorkingMemoryEvent {
  const content = JSON.stringify({ contact, content: message, direction, timestamp: new Date().toISOString() });
  return createMockWorkingMemoryEvent({
    source: 'imessage',
    content,
    metadata: { contact, direction, messageId: randomUUID() },
    ...overrides,
  });
}

/**
 * Create a calendar event
 */
export function createCalendarEvent(
  title: string,
  startTime: Date,
  overrides: Partial<WorkingMemoryEvent> = {}
): WorkingMemoryEvent {
  const content = JSON.stringify({ title, time: startTime.toISOString() });
  return createMockWorkingMemoryEvent({
    source: 'calendar',
    content,
    metadata: { title, eventId: randomUUID() },
    ...overrides,
  });
}

/**
 * Create a Limitless lifelog event
 */
export function createLimitlessEvent(
  summary: string,
  transcript?: string,
  overrides: Partial<WorkingMemoryEvent> = {}
): WorkingMemoryEvent {
  const content = JSON.stringify({ summary, transcript, timestamp: new Date().toISOString() });
  return createMockWorkingMemoryEvent({
    source: 'limitless',
    content,
    metadata: { summary, lifelogId: randomUUID() },
    ...overrides,
  });
}

// ============================================================================
// Unified Task Factories
// ============================================================================

/**
 * Create a valid UnifiedTask for testing
 */
export function createMockUnifiedTask(
  overrides: Partial<UnifiedTask> = {}
): UnifiedTask {
  return {
    id: randomUUID(),
    title: 'Test Task',
    description: 'A test task description',
    confidence: 0.8,
    urgency: 'medium' as UrgencyLevel,
    domain: 'general' as Domain,
    sourceEvents: [randomUUID()],
    status: 'ready' as UnifiedTaskStatus,
    createdAt: new Date().toISOString(),
    refinementCount: 0,
    ...overrides,
  };
}

// ============================================================================
// Synthesis Pattern Factories
// ============================================================================

/**
 * Create a valid SynthesisPattern for testing
 */
export function createMockPattern(
  overrides: Partial<SynthesisPattern> = {}
): SynthesisPattern {
  return {
    id: randomUUID(),
    patternType: 'consolidation' as SynthesisPatternType,
    description: 'Test pattern description',
    triggerConditions: {
      sources: ['email'],
      keywords: ['test'],
    },
    suggestedBehavior: {
      consolidateEvents: true,
    },
    successRate: 0.5,
    usageCount: 0,
    learnedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Proactive Action Factories
// ============================================================================

/**
 * Create a valid ProactiveAction for testing
 */
export function createMockProactiveAction(
  overrides: Partial<ProactiveAction> = {}
): ProactiveAction {
  return {
    type: 'create_task' as ProactiveActionType,
    targetAgentId: 'pm',
    payload: { title: 'Test action' },
    confidenceRequired: 0.7,
    estimatedImpact: 'medium',
    rationale: 'Test rationale',
    executed: false,
    ...overrides,
  };
}

// ============================================================================
// Synthesis Result Factories
// ============================================================================

/**
 * Create a valid SynthesisResult for testing
 */
export function createMockSynthesisResult(
  overrides: Partial<SynthesisResult> = {}
): SynthesisResult {
  return {
    synthesis_summary: 'Test synthesis completed',
    unified_tasks: [],
    task_updates: [],
    proposed_actions: [],
    new_patterns: [],
    events_fully_processed: [],
    needs_more_context: [],
    ...overrides,
  };
}

// ============================================================================
// LLM Response Mocking
// ============================================================================

/**
 * Create a mock LLM response that returns valid JSON
 */
export function createMockLLMResponse(result: SynthesisResult): string {
  return JSON.stringify(result);
}

/**
 * Create a mock LLM response with markdown wrapping (common LLM behavior)
 */
export function createMockLLMResponseWithMarkdown(result: SynthesisResult): string {
  return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
}

/**
 * Create an invalid LLM response for testing error handling
 */
export function createInvalidLLMResponse(type: 'truncated' | 'malformed' | 'missing_fields'): string {
  switch (type) {
    case 'truncated':
      return '{"synthesis_summary": "Test", "unified_tasks": [';
    case 'malformed':
      return '{"synthesis_summary": "Test" unified_tasks: []}';
    case 'missing_fields':
      return '{"synthesis_summary": "Test"}';
    default:
      return '';
  }
}

// ============================================================================
// Mock Zep Client
// ============================================================================

export interface MockZepClient {
  searchMemory: jest.Mock;
  addMemory: jest.Mock;
  getMemory: jest.Mock;
  deleteMemory: jest.Mock;
}

/**
 * Create a mock Zep client for testing
 */
export function createMockZepClient(): MockZepClient {
  return {
    searchMemory: jest.fn().mockResolvedValue([]),
    addMemory: jest.fn().mockResolvedValue({ id: randomUUID() }),
    getMemory: jest.fn().mockResolvedValue(null),
    deleteMemory: jest.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Mock Agent Invoker
// ============================================================================

export interface MockAgentInvoker {
  invoke: jest.Mock;
}

/**
 * Create a mock agent invoker for testing
 */
export function createMockAgentInvoker(defaultResponse?: SynthesisResult): MockAgentInvoker {
  const response = defaultResponse ?? createMockSynthesisResult();
  return {
    invoke: jest.fn().mockResolvedValue(JSON.stringify(response)),
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an event was properly processed
 */
export function assertEventProcessed(
  event: WorkingMemoryEvent,
  expectedTaskId?: string
): void {
  expect(event.processedBySynthesis).toBe(true);
  if (expectedTaskId) {
    expect(event.synthesisTaskId).toBe(expectedTaskId);
  }
}

/**
 * Assert that a pattern was learned with expected properties
 */
export function assertPatternLearned(
  pattern: SynthesisPattern,
  expectedType: SynthesisPatternType
): void {
  expect(pattern.id).toBeDefined();
  expect(pattern.patternType).toBe(expectedType);
  expect(pattern.successRate).toBeGreaterThanOrEqual(0);
  expect(pattern.successRate).toBeLessThanOrEqual(1);
  expect(pattern.usageCount).toBeGreaterThanOrEqual(0);
}

// ============================================================================
// Async Test Helpers
// ============================================================================

/**
 * Wait for a synthesis pass to complete
 */
export async function waitForSynthesisPass(
  checkFn: () => boolean,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<void> {
  const startTime = Date.now();
  while (!checkFn()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Timeout waiting for synthesis pass');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Create a delay for async testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a SHA-256 hash of content (for testing deduplication)
 */
export function createHash(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

/**
 * Generate a batch of events for load testing
 */
export function generateEventBatch(
  count: number,
  source: EventSource = 'email'
): WorkingMemoryEvent[] {
  return Array.from({ length: count }, (_, i) =>
    createMockWorkingMemoryEvent({
      source,
      content: JSON.stringify({ index: i, data: `Test event ${i}` }),
      timestamp: new Date(Date.now() - i * 1000).toISOString(), // Stagger timestamps
    })
  );
}

/**
 * Create events with different urgency levels for testing classification
 */
export function createUrgencyTestEvents(): WorkingMemoryEvent[] {
  return [
    createEmailEvent('boss@company.com', 'URGENT: Need response ASAP', 'Critical issue'),
    createEmailEvent('team@company.com', 'Weekly update', 'FYI - weekly stats'),
    createIMessageEvent('friend', '911 emergency help!'),
    createCalendarEvent('Important Meeting', new Date(Date.now() + 30 * 60 * 1000)), // 30 min from now
    createLimitlessEvent('Casual conversation about weekend plans'),
  ];
}

/**
 * Create events that should be consolidated (same topic from multiple sources)
 */
export function createConsolidatableEvents(): WorkingMemoryEvent[] {
  const projectName = 'Project Alpha';
  return [
    createEmailEvent('pm@company.com', `${projectName} deadline update`, 'Deadline moved to Friday'),
    createIMessageEvent('pm', `Hey, did you see the ${projectName} email?`),
    createCalendarEvent(`${projectName} Review Meeting`, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
  ];
}
