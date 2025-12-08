/**
 * Synthesis Prompt Builder
 *
 * This module constructs the prompts sent to the LLM for cognitive synthesis.
 * The prompts encourage HOLISTIC thinking across multiple events rather than
 * event-by-event processing.
 *
 * Key Principles:
 * - Present events in scannable format for quick pattern recognition
 * - Emphasize relational thinking over linear processing
 * - Include learned patterns as guidance to reduce hallucination
 * - Specify exact JSON output format for structured synthesis results
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import type {
  WorkingMemoryEvent,
  UnifiedTask,
  SynthesisPattern,
  SynthesisResult,
} from './types';

// Prevent client-side imports
ensureServerOnly('lib/cortex/synthesis-prompt');

// ============================================================================
// System Prompt
// ============================================================================

/**
 * System message establishing the Synthesis Cortex role
 *
 * This defines the persona, capabilities, and behavioral guidelines for the
 * synthesis engine. It emphasizes holistic thinking and pattern recognition.
 */
export const SYNTHESIS_SYSTEM_PROMPT = `You are the Synthesis Cortex, a cognitive engine that processes streams of events from multiple sources (Limitless conversations, emails, iMessages, calendar, GitHub) and synthesizes them into unified, actionable tasks.

YOUR CORE CAPABILITIES:
- Holistic pattern recognition across event streams
- Event consolidation into unified tasks
- Proactive action proposal based on context
- Pattern learning from recurring event sequences
- Task refinement as new context arrives

CRITICAL BEHAVIORAL GUIDELINES:

1. THINK HOLISTICALLY, NOT LINEARLY
   - DO NOT process events individually in sequence
   - SCAN ALL events to identify cross-event patterns
   - Look for events that together reveal insights not visible individually
   - Consider temporal relationships, topic clustering, and causal chains

2. CONSOLIDATE RELATED EVENTS
   - Multiple emails about the same topic → single task
   - Meeting + follow-up messages → single task with full context
   - Calendar event + preparation emails → single task with deadline
   - DO NOT create separate tasks for related events

3. CONFIDENCE AND AUTO-EXECUTION
   - Only propose AUTO_EXECUTE for confidence > 0.85 AND low-risk actions
   - High confidence (0.7-0.85): Propose for human review
   - Medium confidence (0.5-0.7): Propose as optional task
   - Low confidence (<0.5): Flag for more context or archive

4. USE LEARNED PATTERNS
   - Patterns reflect user's actual preferences and corrections
   - When a pattern matches, follow its guidance unless new context overrides
   - Patterns have success rates - weight accordingly

5. TASK REFINEMENT
   - If new events add context to existing tasks, refine rather than duplicate
   - Update urgency, confidence, or proposed actions based on new information
   - Track refinement rationale clearly

6. OUTPUT FORMAT
   - ALWAYS return valid JSON matching the SynthesisResult schema
   - Include clear reasoning for all synthesis decisions
   - Mark events as fully_processed only when incorporated into tasks
   - Flag events needing more context rather than forcing low-confidence tasks

REMEMBER: Your goal is to reduce cognitive load by synthesizing the signal from the noise, not to overwhelm with every possible interpretation.`;

// ============================================================================
// Context Formatting
// ============================================================================

export interface SynthesisContext {
  /** Current focus domain (e.g., "finance", "legal") */
  currentFocusDomain?: string;

  /** Priority contacts to watch for */
  priorityContacts?: string[];

  /** Recent user corrections to learn from */
  recentCorrections?: string[];
}

/**
 * Formats events array into readable text for the prompt
 *
 * Presents events in a scannable table format with source, timestamp, and preview.
 * This allows the LLM to quickly identify patterns across events.
 */
export function formatEventsForPrompt(events: WorkingMemoryEvent[]): string {
  if (events.length === 0) {
    return 'No events in buffer.';
  }

  const eventLines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `EVENTS IN WORKING MEMORY (${events.length} total)`,
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  events.forEach((event, idx) => {
    const timestamp = new Date(event.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const preview = event.content.substring(0, 150).replace(/\n/g, ' ');
    const previewSuffix = event.content.length > 150 ? '...' : '';

    const classification = event.initialClassification
      ? `[${event.initialClassification.domain?.toUpperCase() || 'UNCLASSIFIED'}] [${event.initialClassification.urgency?.toUpperCase() || 'UNKNOWN'}]`
      : '[UNCLASSIFIED]';

    const processedMarker = event.processedBySynthesis ? '✓ PROCESSED' : '○ PENDING';

    eventLines.push(
      `[${idx + 1}] ${processedMarker} | ${event.source.toUpperCase()} | ${timestamp}`,
      `    ID: ${event.id}`,
      `    ${classification}`,
      `    Content: ${preview}${previewSuffix}`,
      ''
    );
  });

  eventLines.push('═══════════════════════════════════════════════════════════════');

  return eventLines.join('\n');
}

/**
 * Formats existing tasks for context in the prompt
 *
 * Shows tasks that might need refinement based on new events.
 * Only includes active/proposed tasks, not completed/archived.
 */
export function formatTasksForPrompt(tasks: UnifiedTask[]): string {
  if (tasks.length === 0) {
    return 'No existing tasks.';
  }

  const taskLines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `EXISTING TASKS (${tasks.length} total)`,
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  tasks.forEach((task, idx) => {
    const lastRefined = task.lastRefinedAt
      ? new Date(task.lastRefinedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Never';

    const deadline = task.deadline
      ? `Deadline: ${new Date(task.deadline).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}`
      : 'No deadline';

    const action = task.proposedAction
      ? `Action: ${task.proposedAction.type} → ${task.proposedAction.targetAgentId}`
      : 'No action proposed';

    taskLines.push(
      `[${idx + 1}] ${task.status.toUpperCase()} | ${task.domain.toUpperCase()} | Confidence: ${(task.confidence * 100).toFixed(0)}%`,
      `    ID: ${task.id}`,
      `    Title: ${task.title}`,
      `    Urgency: ${task.urgency.toUpperCase()} | ${deadline}`,
      `    Description: ${task.description.substring(0, 200)}${task.description.length > 200 ? '...' : ''}`,
      `    Source Events: ${task.sourceEvents.length} events | Refinements: ${task.refinementCount}`,
      `    Last Refined: ${lastRefined}`,
      `    ${action}`,
      ''
    );
  });

  taskLines.push('═══════════════════════════════════════════════════════════════');

  return taskLines.join('\n');
}

/**
 * Formats patterns as guidance for the prompt
 *
 * Shows learned patterns that should influence synthesis decisions.
 * Includes success rates to weight pattern reliability.
 */
export function formatPatternsForPrompt(patterns: SynthesisPattern[]): string {
  if (patterns.length === 0) {
    return 'No learned patterns yet.';
  }

  const patternLines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    `LEARNED PATTERNS (${patterns.length} total)`,
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  patterns.forEach((pattern, idx) => {
    const successRate = (pattern.successRate * 100).toFixed(0);
    const usageText = pattern.usageCount === 1 ? '1 use' : `${pattern.usageCount} uses`;

    const triggers: string[] = [];
    if (pattern.triggerConditions.sources) {
      triggers.push(`Sources: ${pattern.triggerConditions.sources.join(', ')}`);
    }
    if (pattern.triggerConditions.keywords) {
      triggers.push(`Keywords: ${pattern.triggerConditions.keywords.join(', ')}`);
    }
    if (pattern.triggerConditions.temporalWindow) {
      const minutes = Math.floor(pattern.triggerConditions.temporalWindow / 60000);
      triggers.push(`Within: ${minutes} minutes`);
    }
    if (pattern.triggerConditions.minEventCount) {
      triggers.push(`Min Events: ${pattern.triggerConditions.minEventCount}`);
    }
    if (pattern.triggerConditions.customCondition) {
      triggers.push(`Condition: ${pattern.triggerConditions.customCondition}`);
    }

    const behaviors: string[] = [];
    if (pattern.suggestedBehavior.consolidateEvents) {
      behaviors.push('Consolidate related events');
    }
    if (pattern.suggestedBehavior.urgencyOverride) {
      behaviors.push(`Override urgency → ${pattern.suggestedBehavior.urgencyOverride}`);
    }
    if (pattern.suggestedBehavior.domainOverride) {
      behaviors.push(`Override domain → ${pattern.suggestedBehavior.domainOverride}`);
    }
    if (pattern.suggestedBehavior.proposedActionType) {
      behaviors.push(`Suggest action: ${pattern.suggestedBehavior.proposedActionType}`);
    }
    if (pattern.suggestedBehavior.customGuidance) {
      behaviors.push(`Guidance: ${pattern.suggestedBehavior.customGuidance}`);
    }

    patternLines.push(
      `[${idx + 1}] ${pattern.patternType.toUpperCase()} | Success Rate: ${successRate}% (${usageText})`,
      `    ID: ${pattern.id}`,
      `    Description: ${pattern.description}`,
      `    Triggers: ${triggers.join(' | ') || 'None'}`,
      `    Behavior: ${behaviors.join(' | ') || 'None'}`,
      ''
    );
  });

  patternLines.push('═══════════════════════════════════════════════════════════════');

  return patternLines.join('\n');
}

// ============================================================================
// Main Prompt Builder
// ============================================================================

/**
 * Builds the complete synthesis prompt
 *
 * Constructs a structured prompt that:
 * 1. Presents all events in scannable format
 * 2. Shows existing tasks that might need refinement
 * 3. Includes learned patterns as guidance
 * 4. Asks LLM to: scan holistically, synthesize tasks, propose actions, identify patterns
 * 5. Specifies exact JSON output format
 *
 * @param events - Events in working memory buffer
 * @param existingTasks - Current tasks that might be refined
 * @param patterns - Learned patterns to guide synthesis
 * @param context - Additional context (focus domain, priority contacts, corrections)
 * @returns Structured prompt string
 */
export function buildSynthesisPrompt(
  events: WorkingMemoryEvent[],
  existingTasks: UnifiedTask[],
  patterns: SynthesisPattern[],
  context: SynthesisContext = {}
): string {
  const promptSections: string[] = [];

  // Header
  promptSections.push(
    '╔═══════════════════════════════════════════════════════════════╗',
    '║                  COGNITIVE SYNTHESIS REQUEST                 ║',
    '╚═══════════════════════════════════════════════════════════════╝',
    ''
  );

  // Context Section
  if (context.currentFocusDomain || context.priorityContacts || context.recentCorrections) {
    promptSections.push('USER CONTEXT:');

    if (context.currentFocusDomain) {
      promptSections.push(`  • Current Focus Domain: ${context.currentFocusDomain.toUpperCase()}`);
    }

    if (context.priorityContacts && context.priorityContacts.length > 0) {
      promptSections.push(
        `  • Priority Contacts: ${context.priorityContacts.slice(0, 5).join(', ')}${
          context.priorityContacts.length > 5 ? ` (+${context.priorityContacts.length - 5} more)` : ''
        }`
      );
    }

    if (context.recentCorrections && context.recentCorrections.length > 0) {
      promptSections.push('  • Recent Corrections:');
      context.recentCorrections.forEach((correction) => {
        promptSections.push(`    - ${correction}`);
      });
    }

    promptSections.push('');
  }

  // Events Section
  promptSections.push(formatEventsForPrompt(events), '');

  // Tasks Section
  if (existingTasks.length > 0) {
    promptSections.push(formatTasksForPrompt(existingTasks), '');
  }

  // Patterns Section
  if (patterns.length > 0) {
    promptSections.push(formatPatternsForPrompt(patterns), '');
  }

  // Instructions Section
  promptSections.push(
    '╔═══════════════════════════════════════════════════════════════╗',
    '║                     SYNTHESIS INSTRUCTIONS                    ║',
    '╚═══════════════════════════════════════════════════════════════╝',
    '',
    'STEP 1: HOLISTIC SCAN',
    '  • DO NOT process events individually - think relationally',
    '  • Look for events that together reveal patterns not visible individually',
    '  • Identify temporal sequences, topic clusters, and causal chains',
    '  • Consider event sources (related emails + calendar = preparation task)',
    '',
    'STEP 2: SYNTHESIZE UNIFIED TASKS',
    '  • Merge related events into single high-confidence tasks',
    '  • Each task should represent a meaningful action or outcome',
    '  • Avoid creating separate tasks for the same underlying topic',
    '  • Include all relevant context from source events in description',
    '  • Assign confidence based on evidence strength (multiple correlated events = higher)',
    '',
    'STEP 3: REFINE EXISTING TASKS',
    '  • Check if any new events add context to existing tasks',
    '  • Update urgency, confidence, or description if warranted',
    '  • DO NOT duplicate - refine instead',
    '',
    'STEP 4: PROPOSE ACTIONS',
    '  • Only propose AUTO_EXECUTE for:',
    '    - Confidence > 0.85 AND',
    '    - Low-risk actions (archive, create_task, summarize) AND',
    '    - Clear user intent from events',
    '  • Higher-risk actions (reply, delegate, schedule): Propose for review',
    '  • Include clear rationale for each proposed action',
    '',
    'STEP 5: IDENTIFY NEW PATTERNS',
    '  • Note any recurring event sequences or relationships',
    '  • Suggest patterns that could improve future synthesis',
    '  • Base patterns on observable user behavior, not assumptions',
    '',
    '╔═══════════════════════════════════════════════════════════════╗',
    '║                     REQUIRED JSON OUTPUT                      ║',
    '╚═══════════════════════════════════════════════════════════════╝',
    '',
    'Return ONLY valid JSON matching this exact schema:',
    '',
    '{',
    '  "synthesis_summary": "Brief overview of synthesis results",',
    '  ',
    '  "unified_tasks": [',
    '    {',
    '      "title": "Clear, actionable task title",',
    '      "description": "Full context from source events",',
    '      "confidence": 0.85,  // 0-1, how confident in this synthesis',
    '      "urgency": "high",   // critical | high | medium | low | background',
    '      "domain": "finance", // Domain from event classification',
    '      "sourceEvents": ["event-id-1", "event-id-2"],',
    '      "proposedAction": {  // Optional',
    '        "type": "reply",',
    '        "targetAgentId": "agent.comms",',
    '        "payload": { "draft": "..." },',
    '        "confidenceRequired": 0.9,',
    '        "estimatedImpact": "high",',
    '        "rationale": "Why this action makes sense",',
    '        "executed": false',
    '      },',
    '      "deadline": "2025-01-15T17:00:00Z", // Optional ISO 8601',
    '      "relatedTasks": ["task-id-1"]       // Optional',
    '    }',
    '  ],',
    '  ',
    '  "task_updates": [',
    '    {',
    '      "taskId": "existing-task-id",',
    '      "updates": {',
    '        "description": "Updated with new context",',
    '        "urgency": "high",',
    '        "confidence": 0.9',
    '      },',
    '      "newSourceEvents": ["event-id-3"],',
    '      "rationale": "New email adds deadline pressure"',
    '    }',
    '  ],',
    '  ',
    '  "proposed_actions": [',
    '    // Standalone actions not yet assigned to tasks',
    '  ],',
    '  ',
    '  "new_patterns": [',
    '    {',
    '      "patternType": "consolidation",',
    '      "description": "Emails from X followed by calendar event = preparation task",',
    '      "triggerConditions": {',
    '        "sources": ["email", "calendar"],',
    '        "temporalWindow": 86400000,  // 24 hours in ms',
    '        "keywords": ["meeting", "prepare"]',
    '      },',
    '      "suggestedBehavior": {',
    '        "consolidateEvents": true,',
    '        "urgencyOverride": "high",',
    '        "customGuidance": "Treat as preparation task with deadline"',
    '      }',
    '    }',
    '  ],',
    '  ',
    '  "events_fully_processed": ["event-id-1", "event-id-2"],',
    '  "needs_more_context": ["event-id-5"],',
    '  ',
    '  "reasoning": "Optional: Internal reasoning trace for debugging"',
    '}',
    '',
    'CRITICAL REMINDERS:',
    '  • Think holistically - patterns emerge from event relationships',
    '  • Consolidate related events - avoid task duplication',
    '  • High confidence for auto-execute (>0.85) + low-risk only',
    '  • Use learned patterns as guidance',
    '  • Mark events as fully_processed only when incorporated into tasks',
    '',
    'BEGIN SYNTHESIS NOW.'
  );

  return promptSections.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export type { SynthesisContext };
