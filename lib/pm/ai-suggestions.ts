/**
 * AI-Powered Suggestions Engine
 *
 * Replaces statistical pattern analysis with LLM-powered fuzzy logic using:
 * - GPT-5.1 via AgentInvoker for intelligent analysis
 * - Zep memory for historical patterns and context
 * - Life OS config for organizational understanding
 *
 * Suggestion Types:
 * - Priority: What priority should this task have?
 * - Assignment: Who should handle this?
 * - Deadline: When is this likely to be completed?
 * - Action: What should be done next?
 * - Review: What needs attention?
 */

import { ensureServerOnly } from '../server-only-guard';
import { agentInvoker, type AgentResponse } from '../agents/AgentInvoker';
import { getLifeCharter, getDomain } from '../life-os-config';
import { searchPMMemories, addPMMemory } from './pm-memory';
import { getCurrentState, getCurrentRelationships, type EntityType } from './temporal-memory';
import { getAllTasks } from './integration';
import type { UnifiedTask } from './types';
import type { Suggestion, SuggestionType } from './predictive-suggestions';

ensureServerOnly('lib/pm/ai-suggestions');

// ============================================================================
// Types
// ============================================================================

export interface AISuggestion extends Suggestion {
  ai_powered: boolean;
  model_used: string;
  zep_context_used: boolean;
  processing_time_ms: number;
}

interface SuggestionDecision {
  suggestion: string;
  rationale: string;
  confidence: number;
  suggested_value?: unknown;
  alternative_suggestions?: string[];
}

// ============================================================================
// Prompt Construction
// ============================================================================

/**
 * Build context about an entity for the suggestion prompt
 */
async function buildEntityContext(
  entityType: EntityType,
  entityId: string
): Promise<string> {
  const state = getCurrentState(entityType, entityId);
  const relationships = getCurrentRelationships(entityType, entityId);

  let context = `## Entity Context\n`;
  context += `- Type: ${entityType}\n`;
  context += `- ID: ${entityId}\n`;

  if (state && state.attributes) {
    context += `- Current State:\n`;
    for (const [key, value] of Object.entries(state.attributes)) {
      context += `  - ${key}: ${JSON.stringify(value)}\n`;
    }
  }

  if (relationships.length > 0) {
    context += `- Relationships:\n`;
    for (const rel of relationships.slice(0, 5)) {
      context += `  - ${rel.relationship_type} -> ${rel.to_entity_type}:${rel.to_entity_id}\n`;
    }
  }

  return context;
}

/**
 * Build the priority suggestion prompt
 */
function buildPrioritySuggestionPrompt(
  task: UnifiedTask,
  entityContext: string,
  zepContext: string
): string {
  return `You are the PM Agent (Project Maestro) providing intelligent priority suggestions.

## Your Task
Analyze this task and suggest the optimal priority based on:
- The task's content, labels, and project
- Similar tasks and their patterns
- Organizational priorities and deadlines
- Current workload and urgency

## Task Details
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description || 'No description'}
- Current Priority: ${task.priority}
- Status: ${task.status}
- Project: ${task.project_name || 'Unassigned'}
- Labels: ${task.labels?.join(', ') || 'None'}
- Due Date: ${task.due_date || 'Not set'}
- Created: ${task.created_at}
- Updated: ${task.updated_at}

${entityContext}

${zepContext ? `## Historical Context from Memory\n${zepContext}\n` : ''}

## Priority Levels
- **critical**: Legal deadlines, security issues, compliance requirements, family emergencies
- **high**: Key deliverables, client commitments, blocking issues
- **medium**: Standard work, feature development, routine tasks
- **low**: Nice to have, technical debt, exploratory work

## Output Format
Respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):
{
  "suggestion": "Set priority to high",
  "rationale": "This task involves client deliverable with upcoming deadline",
  "confidence": 0.85,
  "suggested_value": "high",
  "alternative_suggestions": ["Consider breaking into smaller tasks", "Link to related project"]
}`;
}

/**
 * Build the assignment suggestion prompt
 */
function buildAssignmentSuggestionPrompt(
  task: UnifiedTask,
  entityContext: string,
  zepContext: string
): string {
  return `You are the PM Agent (Project Maestro) providing intelligent assignment suggestions.

## Your Task
Suggest who should handle this task based on:
- The task's domain and required expertise
- Historical assignment patterns
- Team member availability and specialization

## Task Details
- ID: ${task.id}
- Title: ${task.title}
- Description: ${task.description || 'No description'}
- Current Assignee: ${task.assignee || 'Unassigned'}
- Project: ${task.project_name || 'Unassigned'}
- Labels: ${task.labels?.join(', ') || 'None'}
- Priority: ${task.priority}

${entityContext}

${zepContext ? `## Historical Context from Memory\n${zepContext}\n` : ''}

## Output Format
Respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):
{
  "suggestion": "Assign to James for technical implementation",
  "rationale": "Task involves core platform work that James typically handles",
  "confidence": 0.75,
  "suggested_value": "james",
  "alternative_suggestions": ["Could delegate sub-tasks to contractors"]
}`;
}

/**
 * Build the action suggestion prompt
 */
function buildActionSuggestionPrompt(
  tasks: UnifiedTask[],
  zepContext: string
): string {
  const taskSummaries = tasks.slice(0, 10).map(t =>
    `- [${t.priority}] ${t.title} (${t.status}, due: ${t.due_date || 'not set'})`
  ).join('\n');

  return `You are the PM Agent (Project Maestro) providing intelligent next action suggestions.

## Your Task
Analyze the current task list and suggest what should be done next based on:
- Approaching deadlines
- Task priorities and dependencies
- Stale or blocked items
- Productive work patterns

## Current Open Tasks
${taskSummaries}

${zepContext ? `## Historical Context from Memory\n${zepContext}\n` : ''}

## Output Format
Respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):
{
  "suggestions": [
    {
      "suggestion": "Work on [Task Title] - deadline approaching",
      "rationale": "This task is due in 2 days and blocks other work",
      "confidence": 0.9,
      "target_task_id": "task_123",
      "urgency": "high"
    },
    {
      "suggestion": "Review stale high-priority task",
      "rationale": "No activity for 5 days on important item",
      "confidence": 0.7,
      "target_task_id": "task_456",
      "urgency": "medium"
    }
  ]
}`;
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse a single suggestion from AI response
 */
function parseSuggestionResponse(response: string): SuggestionDecision | null {
  try {
    let jsonStr = response.trim();

    // Handle markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    if (!parsed.suggestion || !parsed.rationale) {
      console.warn('[AI Suggestions] Missing required fields:', parsed);
      return null;
    }

    return {
      suggestion: parsed.suggestion,
      rationale: parsed.rationale,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      suggested_value: parsed.suggested_value,
      alternative_suggestions: Array.isArray(parsed.alternative_suggestions)
        ? parsed.alternative_suggestions
        : undefined,
    };
  } catch (error) {
    console.error('[AI Suggestions] Failed to parse response:', error);
    return null;
  }
}

/**
 * Parse multiple action suggestions from AI response
 */
function parseActionSuggestionsResponse(response: string): SuggestionDecision[] {
  try {
    let jsonStr = response.trim();

    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      return [];
    }

    return parsed.suggestions.map((s: any) => ({
      suggestion: s.suggestion,
      rationale: s.rationale,
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
      suggested_value: s.target_task_id,
      alternative_suggestions: undefined,
    })).filter((s: SuggestionDecision) => s.suggestion && s.rationale);
  } catch (error) {
    console.error('[AI Suggestions] Failed to parse action response:', error);
    return [];
  }
}

// ============================================================================
// Main Suggestion Functions
// ============================================================================

/**
 * Generate an AI-powered priority suggestion for a task
 */
export async function suggestTaskPriorityWithAI(taskId: string): Promise<AISuggestion | null> {
  const startTime = Date.now();

  try {
    // Get task details
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.warn('[AI Suggestions] Task not found:', taskId);
      return null;
    }

    // Build entity context
    const entityContext = await buildEntityContext('task', taskId);

    // Query Zep for relevant context
    let zepContext = '';
    let zepContextUsed = false;

    try {
      const searchQuery = `priority suggestions ${task.project_name || ''} ${task.labels?.join(' ') || ''} ${task.title}`.trim();
      const memories = await searchPMMemories(searchQuery, 5);

      if (memories.length > 0) {
        zepContextUsed = true;
        zepContext = '### Similar Tasks & Priority Patterns:\n' +
          memories.map((m, i) => `${i + 1}. ${m.text}`).join('\n');
      }
    } catch (zepError) {
      console.warn('[AI Suggestions] Zep context fetch failed:', zepError);
    }

    // Build prompt and call AI
    const prompt = buildPrioritySuggestionPrompt(task, entityContext, zepContext);

    const agentResponse: AgentResponse = await agentInvoker.invoke({
      agentId: 'agent.pm',
      userMessage: prompt,
      providerOverride: 'openai',
      modelOverride: 'gpt-4.1-2025-04-14',
      context: {
        skipMemory: true,
        metadata: {
          operation: 'suggestion',
          suggestion_type: 'priority',
          task_id: taskId,
        },
      },
    });

    // Parse response
    const decision = parseSuggestionResponse(agentResponse.content);

    if (!decision) {
      return null;
    }

    // Skip if current priority matches suggestion
    if (decision.suggested_value === task.priority) {
      return null;
    }

    const result: AISuggestion = {
      id: `suggest_priority_${taskId}_${Date.now()}`,
      suggestion_type: 'priority',
      target_entity: { type: 'task', id: taskId },
      suggestion: decision.suggestion,
      rationale: decision.rationale,
      confidence: decision.confidence,
      based_on_patterns: [],
      ai_powered: true,
      model_used: agentResponse.model,
      zep_context_used: zepContextUsed,
      processing_time_ms: Date.now() - startTime,
      metadata: {
        current_priority: task.priority,
        suggested_priority: decision.suggested_value,
        alternative_suggestions: decision.alternative_suggestions,
      },
    };

    // Persist for learning
    try {
      await addPMMemory(
        `Priority suggestion for task "${task.title}": ${decision.suggestion}. ` +
        `Confidence: ${decision.confidence.toFixed(2)}. Rationale: ${decision.rationale}`,
        'suggestion',
        {
          task_id: taskId,
          suggestion_type: 'priority',
          current_value: task.priority,
          suggested_value: decision.suggested_value,
          confidence: decision.confidence,
        }
      );
    } catch (memoryError) {
      console.warn('[AI Suggestions] Failed to persist to Zep:', memoryError);
    }

    return result;
  } catch (error) {
    console.error('[AI Suggestions] Error generating priority suggestion:', error);
    return null;
  }
}

/**
 * Generate AI-powered assignment suggestion for a task
 */
export async function suggestAssignmentWithAI(taskId: string): Promise<AISuggestion | null> {
  const startTime = Date.now();

  try {
    const tasks = await getAllTasks();
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      return null;
    }

    const entityContext = await buildEntityContext('task', taskId);

    let zepContext = '';
    let zepContextUsed = false;

    try {
      const searchQuery = `assignment ${task.project_name || ''} ${task.labels?.join(' ') || ''}`.trim();
      const memories = await searchPMMemories(searchQuery, 5);

      if (memories.length > 0) {
        zepContextUsed = true;
        zepContext = '### Assignment Patterns:\n' +
          memories.map((m, i) => `${i + 1}. ${m.text}`).join('\n');
      }
    } catch (zepError) {
      console.warn('[AI Suggestions] Zep context fetch failed:', zepError);
    }

    const prompt = buildAssignmentSuggestionPrompt(task, entityContext, zepContext);

    const agentResponse: AgentResponse = await agentInvoker.invoke({
      agentId: 'agent.pm',
      userMessage: prompt,
      providerOverride: 'openai',
      modelOverride: 'gpt-4.1-2025-04-14',
      context: {
        skipMemory: true,
        metadata: {
          operation: 'suggestion',
          suggestion_type: 'assignment',
          task_id: taskId,
        },
      },
    });

    const decision = parseSuggestionResponse(agentResponse.content);

    if (!decision) {
      return null;
    }

    return {
      id: `suggest_assignment_${taskId}_${Date.now()}`,
      suggestion_type: 'assignment',
      target_entity: { type: 'task', id: taskId },
      suggestion: decision.suggestion,
      rationale: decision.rationale,
      confidence: decision.confidence,
      based_on_patterns: [],
      ai_powered: true,
      model_used: agentResponse.model,
      zep_context_used: zepContextUsed,
      processing_time_ms: Date.now() - startTime,
      metadata: {
        current_assignee: task.assignee,
        suggested_assignee: decision.suggested_value,
      },
    };
  } catch (error) {
    console.error('[AI Suggestions] Error generating assignment suggestion:', error);
    return null;
  }
}

/**
 * Generate AI-powered next action suggestions
 */
export async function suggestNextActionsWithAI(): Promise<AISuggestion[]> {
  const startTime = Date.now();

  try {
    // Get all open tasks
    const tasks = await getAllTasks();
    const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

    if (openTasks.length === 0) {
      return [];
    }

    // Query Zep for work pattern context
    let zepContext = '';
    let zepContextUsed = false;

    try {
      const memories = await searchPMMemories('next action work patterns productivity', 5);

      if (memories.length > 0) {
        zepContextUsed = true;
        zepContext = '### Work Patterns & History:\n' +
          memories.map((m, i) => `${i + 1}. ${m.text}`).join('\n');
      }
    } catch (zepError) {
      console.warn('[AI Suggestions] Zep context fetch failed:', zepError);
    }

    const prompt = buildActionSuggestionPrompt(openTasks, zepContext);

    const agentResponse: AgentResponse = await agentInvoker.invoke({
      agentId: 'agent.pm',
      userMessage: prompt,
      providerOverride: 'openai',
      modelOverride: 'gpt-4.1-2025-04-14',
      context: {
        skipMemory: true,
        metadata: {
          operation: 'suggestion',
          suggestion_type: 'action',
        },
      },
    });

    const decisions = parseActionSuggestionsResponse(agentResponse.content);

    return decisions.map((decision, index) => ({
      id: `suggest_action_${Date.now()}_${index}`,
      suggestion_type: 'action' as SuggestionType,
      target_entity: {
        type: 'task' as EntityType,
        id: decision.suggested_value as string || 'system',
      },
      suggestion: decision.suggestion,
      rationale: decision.rationale,
      confidence: decision.confidence,
      based_on_patterns: [],
      ai_powered: true,
      model_used: agentResponse.model,
      zep_context_used: zepContextUsed,
      processing_time_ms: Date.now() - startTime,
    }));
  } catch (error) {
    console.error('[AI Suggestions] Error generating action suggestions:', error);
    return [];
  }
}

/**
 * Generate all daily suggestions using AI
 */
export async function generateDailySuggestionsWithAI(): Promise<AISuggestion[]> {
  const startTime = Date.now();
  const suggestions: AISuggestion[] = [];

  try {
    // Get action suggestions
    const actionSuggestions = await suggestNextActionsWithAI();
    suggestions.push(...actionSuggestions);

    // Get priority suggestions for open tasks
    const tasks = await getAllTasks();
    const openTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

    // Limit to 5 tasks to avoid excessive API calls
    for (const task of openTasks.slice(0, 5)) {
      const prioritySuggestion = await suggestTaskPriorityWithAI(task.id);
      if (prioritySuggestion) {
        suggestions.push(prioritySuggestion);
      }
    }

    // Deduplicate by target entity
    const seen = new Set<string>();
    const unique = suggestions.filter(s => {
      const key = `${s.target_entity.type}:${s.target_entity.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(
      `[AI Suggestions] Generated ${unique.length} suggestions in ${Date.now() - startTime}ms`
    );

    return unique.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    console.error('[AI Suggestions] Error generating daily suggestions:', error);
    return [];
  }
}

/**
 * Check if AI suggestions are enabled
 */
export function isAISuggestionsEnabled(): boolean {
  return process.env.USE_AI_SUGGESTIONS !== 'false';
}
