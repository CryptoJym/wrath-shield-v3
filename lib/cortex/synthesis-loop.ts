/**
 * Cognitive Synthesis Loop - Core Engine
 *
 * This is the heart of the Cognitive Synthesis Engine. It periodically processes
 * events from Working Memory, synthesizes them into unified tasks using an LLM,
 * and returns results for storage by the caller.
 *
 * Key responsibilities:
 * 1. Run synthesis passes on a configurable interval
 * 2. Build prompts with event context and patterns
 * 3. Invoke LLM with retry logic
 * 4. Parse structured JSON responses
 * 5. Mark processed events in working memory
 * 6. Return results to caller for persistence
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import { getWorkingMemory, WorkingMemory } from './working-memory';
import { agentInvoker } from '../agents/AgentInvoker';
import type {
  SynthesisLoopConfig,
  SynthesisResult,
  WorkingMemoryEvent,
  UnifiedTask,
  SynthesisPattern,
  DEFAULT_SYNTHESIS_CONFIG,
} from './types';

ensureServerOnly('lib/cortex/synthesis-loop');

/**
 * Synthesis Loop Status
 */
export interface SynthesisLoopStatus {
  /** Whether the loop is currently running */
  isRunning: boolean;

  /** Timestamp of last synthesis pass (milliseconds since epoch) */
  lastSynthesisAt: number | null;

  /** Number of unprocessed events in buffer */
  eventCount: number;

  /** Number of tasks created/refined in last pass */
  taskCount: number;

  /** Next scheduled synthesis time */
  nextSynthesisAt: number | null;
}

/**
 * Synthesis Loop Configuration with defaults
 */
const DEFAULT_CONFIG: SynthesisLoopConfig = {
  intervalMs: 300000, // 5 minutes
  minEventsForSynthesis: 3,
  maxEventsPerPass: 50,
  confidenceThresholds: {
    autoExecute: 0.9,
    propose: 0.6,
    refine: 0.4,
  },
  enabled: false,
  llmModel: 'anthropic/claude-sonnet-4.5',
  maxTokens: 4000,
  temperature: 0.3,
};

/**
 * Synthesis Loop Engine
 *
 * Periodically processes events from Working Memory and synthesizes them
 * into unified tasks using an LLM.
 */
export class SynthesisLoop {
  private workingMemory: WorkingMemory;
  private config: SynthesisLoopConfig;
  private isRunning: boolean = false;
  private lastSynthesisAt: number = 0;
  private lastTaskCount: number = 0;
  private intervalHandle: NodeJS.Timeout | null = null;
  private nextSynthesisAt: number | null = null;

  /**
   * Initialize the Synthesis Loop
   */
  constructor(config?: Partial<SynthesisLoopConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workingMemory = getWorkingMemory();
    console.log('[SynthesisLoop] Initialized with config:', {
      intervalMs: this.config.intervalMs,
      minEvents: this.config.minEventsForSynthesis,
      maxEvents: this.config.maxEventsPerPass,
      enabled: this.config.enabled,
    });
  }

  /**
   * Start the synthesis loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[SynthesisLoop] Already running, ignoring start()');
      return;
    }

    // Enable the loop when start is called
    this.config.enabled = true;
    this.isRunning = true;
    console.log(`[SynthesisLoop] Starting synthesis loop (interval: ${this.config.intervalMs}ms)`);

    // Schedule first synthesis
    this.nextSynthesisAt = Date.now() + this.config.intervalMs;

    // Start interval
    this.intervalHandle = setInterval(async () => {
      try {
        await this.runSynthesisPass();
        this.nextSynthesisAt = Date.now() + this.config.intervalMs;
      } catch (error) {
        console.error('[SynthesisLoop] Error in synthesis pass:', error);
      }
    }, this.config.intervalMs);
  }

  /**
   * Stop the synthesis loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[SynthesisLoop] Not running, ignoring stop()');
      return;
    }

    this.config.enabled = false;
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.nextSynthesisAt = null;
    console.log('[SynthesisLoop] Stopped synthesis loop');
  }

  /**
   * Run a single synthesis pass
   *
   * This is the core logic that:
   * 1. Checks if we have enough events
   * 2. Fetches unprocessed events and low-confidence tasks
   * 3. Builds a synthesis prompt
   * 4. Invokes the LLM
   * 5. Parses the response
   * 6. Marks events as processed
   * 7. Returns results for the caller to persist
   */
  async runSynthesisPass(): Promise<SynthesisResult | null> {
    const startTime = Date.now();
    console.log('[SynthesisLoop] Starting synthesis pass...');

    try {
      // 1. Check minimum events threshold
      const stats = await this.workingMemory.getStats();
      if (stats.unprocessedEvents < this.config.minEventsForSynthesis) {
        console.log(
          `[SynthesisLoop] Not enough events (${stats.unprocessedEvents}/${this.config.minEventsForSynthesis}), skipping`
        );
        return null;
      }

      // 2. Get unprocessed events
      const events = await this.workingMemory.getUnprocessed(this.config.maxEventsPerPass);
      console.log(`[SynthesisLoop] Retrieved ${events.length} unprocessed events`);

      // 3. Get existing low-confidence tasks needing refinement
      // TODO: Implement task storage and retrieval
      const lowConfidenceTasks: UnifiedTask[] = []; // Placeholder

      // 4. Get patterns from storage
      // TODO: Implement pattern storage and retrieval
      const patterns: SynthesisPattern[] = []; // Placeholder

      // 5. Build synthesis prompt
      const prompt = this.buildSynthesisPrompt(events, lowConfidenceTasks, patterns);

      // 6. Invoke LLM with retry logic
      const llmResponse = await this.invokeLLMWithRetry(prompt, 3);

      // 7. Parse JSON response
      const synthesisResult = this.parseSynthesisResult(llmResponse);

      // 8. Mark processed events in working memory
      if (synthesisResult && synthesisResult.events_fully_processed.length > 0) {
        const synthesisTaskId = `synthesis-${Date.now()}`;
        await this.workingMemory.markProcessed(
          synthesisResult.events_fully_processed,
          synthesisTaskId
        );
        console.log(
          `[SynthesisLoop] Marked ${synthesisResult.events_fully_processed.length} events as processed`
        );
      }

      // 9. Update status
      this.lastSynthesisAt = Date.now();
      this.lastTaskCount =
        (synthesisResult?.unified_tasks.length || 0) + (synthesisResult?.task_updates.length || 0);

      const latencyMs = Date.now() - startTime;
      console.log(
        `[SynthesisLoop] Synthesis pass complete (${latencyMs}ms, ${this.lastTaskCount} tasks)`
      );

      return synthesisResult;
    } catch (error) {
      console.error('[SynthesisLoop] Synthesis pass failed:', error);
      throw error;
    }
  }

  /**
   * Build the synthesis prompt from events, tasks, and patterns
   */
  private buildSynthesisPrompt(
    events: WorkingMemoryEvent[],
    lowConfidenceTasks: UnifiedTask[],
    patterns: SynthesisPattern[]
  ): string {
    // Format events for prompt
    const eventsText = events
      .map(
        (e, i) =>
          `[Event ${i + 1}] (${e.source}, ${e.timestamp})
ID: ${e.id}
Content: ${e.content}
${e.initialClassification ? `Classification: ${JSON.stringify(e.initialClassification)}` : ''}
${e.metadata ? `Metadata: ${JSON.stringify(e.metadata)}` : ''}`
      )
      .join('\n\n');

    // Format low-confidence tasks
    const tasksText =
      lowConfidenceTasks.length > 0
        ? lowConfidenceTasks
            .map(
              (t, i) =>
                `[Task ${i + 1}]
ID: ${t.id}
Title: ${t.title}
Description: ${t.description}
Confidence: ${t.confidence}
Urgency: ${t.urgency}
Domain: ${t.domain}
Source Events: ${t.sourceEvents.join(', ')}`
            )
            .join('\n\n')
        : 'No tasks needing refinement.';

    // Format patterns
    const patternsText =
      patterns.length > 0
        ? patterns
            .map(
              (p, i) =>
                `[Pattern ${i + 1}]
Type: ${p.patternType}
Description: ${p.description}
Success Rate: ${(p.successRate * 100).toFixed(1)}%
Usage Count: ${p.usageCount}
Guidance: ${p.suggestedBehavior.customGuidance || 'N/A'}`
            )
            .join('\n\n')
        : 'No learned patterns yet.';

    // Build the complete prompt
    return `# Cognitive Synthesis Task

You are a cognitive synthesis engine that consolidates events from multiple sources into unified, actionable tasks.

## Your Mission

Analyze the events below and:
1. **Consolidate** related events into unified tasks
2. **Refine** existing low-confidence tasks with new event context
3. **Propose** proactive actions based on event patterns
4. **Learn** new synthesis patterns for future use

## Events to Process

${eventsText}

## Tasks Needing Refinement (confidence < 0.7)

${tasksText}

## Learned Patterns

${patternsText}

## Output Format

Respond with ONLY valid JSON (no markdown, no explanations) in this exact structure:

{
  "synthesis_summary": "Brief summary of what you synthesized",
  "unified_tasks": [
    {
      "title": "Task title",
      "description": "Detailed description with context from events",
      "confidence": 0.85,
      "urgency": "medium",
      "domain": "productivity",
      "sourceEvents": ["event-id-1", "event-id-2"],
      "proposedAction": {
        "type": "create_task",
        "targetAgentId": "pm-agent",
        "payload": {},
        "confidenceRequired": 0.7,
        "estimatedImpact": "medium",
        "rationale": "Why this action is proposed",
        "executed": false
      },
      "deadline": "2025-12-08T17:00:00.000Z"
    }
  ],
  "task_updates": [
    {
      "taskId": "existing-task-id",
      "updates": {
        "description": "Updated description with new context",
        "confidence": 0.75,
        "urgency": "high"
      },
      "newSourceEvents": ["event-id-3"],
      "rationale": "Why this task was updated"
    }
  ],
  "proposed_actions": [],
  "new_patterns": [
    {
      "patternType": "consolidation",
      "description": "Pattern description",
      "triggerConditions": {
        "sources": ["email", "calendar"],
        "keywords": ["meeting"],
        "temporalWindow": 3600000
      },
      "suggestedBehavior": {
        "consolidateEvents": true,
        "customGuidance": "Guidance for future synthesis"
      }
    }
  ],
  "events_fully_processed": ["event-id-1", "event-id-2"],
  "needs_more_context": ["event-id-3"],
  "reasoning": "Optional: Your thought process"
}

## Guidelines

- **Confidence Thresholds**:
  - 0.9+: High confidence, can auto-execute actions
  - 0.6-0.9: Medium confidence, propose for approval
  - 0.4-0.6: Low confidence, needs refinement
  - <0.4: Insufficient data, keep in buffer

- **Urgency Levels**:
  - critical: Requires immediate attention (deadlines, emergencies)
  - high: Important, needs action within 24 hours
  - medium: Standard priority, action within week
  - low: Nice to have, no rush
  - background: FYI only, minimal action needed

- **Domain Classification**:
  - productivity: Tasks, projects, work
  - personal: Personal life, relationships
  - health: Fitness, medical, wellness
  - finance: Money, expenses, investments
  - legal: Legal matters, contracts
  - communication: Messages, emails, calls

- **Action Types**:
  - reply: Draft response to message
  - create_task: Create task in external system
  - schedule: Schedule calendar event
  - delegate: Assign to agent or person
  - archive: Dismiss as irrelevant
  - escalate: Flag for immediate attention
  - research: Trigger research agent
  - summarize: Generate summary document

- **Pattern Learning**:
  - Identify recurring event combinations
  - Note temporal relationships (e.g., email → calendar)
  - Track urgency classification patterns
  - Suggest consolidation rules

**IMPORTANT**: Output ONLY the JSON object. No markdown code blocks, no explanations.`;
  }

  /**
   * Invoke LLM with retry logic
   */
  private async invokeLLMWithRetry(prompt: string, maxRetries: number = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SynthesisLoop] Invoking LLM (attempt ${attempt}/${maxRetries})...`);

        const response = await agentInvoker.invoke({
          agentId: 'agent.orchestrator', // Use orchestrator for synthesis
          userMessage: prompt,
          forceExecute: true, // Always execute synthesis
          context: {
            skipMemory: true, // Don't store synthesis internals in memory
            metadata: {
              type: 'synthesis',
              attempt,
            },
          },
          modelOverride: this.config.llmModel,
        });

        console.log(
          `[SynthesisLoop] LLM response received (${response.tokensUsed.total} tokens, ${response.latencyMs}ms)`
        );

        return response.content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[SynthesisLoop] LLM invocation failed (attempt ${attempt}/${maxRetries}):`,
          lastError.message
        );

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[SynthesisLoop] Retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw new Error(
      `Failed to invoke LLM after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Parse LLM response into SynthesisResult
   *
   * Handles:
   * - Markdown code blocks (```json...```)
   * - Leading/trailing whitespace
   * - Malformed JSON
   */
  private parseSynthesisResult(response: string): SynthesisResult | null {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.trim();

      // Check for markdown JSON code block
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      }

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!this.isValidSynthesisResult(parsed)) {
        console.error('[SynthesisLoop] Invalid synthesis result structure:', parsed);
        return null;
      }

      console.log('[SynthesisLoop] Successfully parsed synthesis result:', {
        tasks: parsed.unified_tasks.length,
        updates: parsed.task_updates.length,
        actions: parsed.proposed_actions.length,
        patterns: parsed.new_patterns.length,
        processed: parsed.events_fully_processed.length,
      });

      return parsed as SynthesisResult;
    } catch (error) {
      console.error('[SynthesisLoop] Failed to parse synthesis result:', error);
      console.error('[SynthesisLoop] Raw response:', response.substring(0, 500));
      return null;
    }
  }

  /**
   * Validate that parsed object matches SynthesisResult structure
   */
  private isValidSynthesisResult(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.synthesis_summary === 'string' &&
      Array.isArray(obj.unified_tasks) &&
      Array.isArray(obj.task_updates) &&
      Array.isArray(obj.proposed_actions) &&
      Array.isArray(obj.new_patterns) &&
      Array.isArray(obj.events_fully_processed) &&
      Array.isArray(obj.needs_more_context)
    );
  }

  /**
   * Get current status of the synthesis loop
   */
  getStatus(): SynthesisLoopStatus {
    return {
      isRunning: this.isRunning,
      lastSynthesisAt: this.lastSynthesisAt || null,
      eventCount: 0, // Caller should fetch from workingMemory.getStats()
      taskCount: this.lastTaskCount,
      nextSynthesisAt: this.nextSynthesisAt,
    };
  }
}

/**
 * Singleton instance
 */
let instance: SynthesisLoop | null = null;

/**
 * Get the singleton instance of SynthesisLoop
 */
export function getSynthesisLoop(config?: Partial<SynthesisLoopConfig>): SynthesisLoop {
  if (!instance) {
    instance = new SynthesisLoop(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSynthesisLoop(): void {
  if (instance) {
    instance.stop();
  }
  instance = null;
}

/**
 * Export the singleton instance
 */
export const synthesisLoop = getSynthesisLoop();
