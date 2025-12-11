/**
 * Proactive Executor - Automatic Action Execution
 *
 * This module evaluates and executes high-confidence actions automatically
 * based on cognitive synthesis recommendations. It implements escalation logic
 * to determine whether actions should be auto-executed, proposed for approval,
 * or deferred for more context.
 *
 * Execution Flow:
 * 1. Evaluate action confidence vs. requirements and impact
 * 2. AUTO_EXECUTE: High confidence + low/medium impact → execute immediately
 * 3. PROPOSE: Moderate confidence OR high impact → queue for approval
 * 4. DEFER: Low confidence → skip and wait for more context
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from '../server-only-guard';
import type {
  ProactiveAction,
  UnifiedTask,
  SynthesisResult,
} from './types';
import { agentInvoker } from '../agents/AgentInvoker';
import type { AgentId } from '../memory/zep';

// Prevent client-side imports
ensureServerOnly('lib/cortex/executor');

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Escalation level for action execution
 */
export type ExecutionEscalationLevel =
  | 'AUTO_EXECUTE'  // High confidence, execute immediately
  | 'PROPOSE'       // Moderate confidence or high impact, needs approval
  | 'DEFER';        // Low confidence, skip for now

/**
 * Decision on whether to execute an action
 */
export interface ExecutionDecision {
  /** Whether the action should be executed automatically */
  shouldExecute: boolean;

  /** Reason for the decision */
  reason: string;

  /** Escalation level determined */
  escalationLevel: ExecutionEscalationLevel;
}

/**
 * Result of executing a proactive action
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Agent ID that executed the action */
  agentId: string;

  /** Response from the agent (if successful) */
  response?: string;

  /** Error message (if failed) */
  error?: string;

  /** Timestamp of execution */
  executedAt: number;
}

/**
 * Summary of batch action execution
 */
export interface ExecutionSummary {
  /** Number of actions executed automatically */
  executed: number;

  /** Number of actions proposed for approval */
  proposed: number;

  /** Number of actions deferred */
  deferred: number;

  /** Details of each execution */
  executionDetails: Array<{
    actionType: string;
    escalationLevel: ExecutionEscalationLevel;
    result?: ExecutionResult;
    approvalId?: string;
  }>;
}

// ============================================================================
// ProactiveExecutor Class
// ============================================================================

/**
 * ProactiveExecutor - Executes high-confidence actions automatically
 *
 * This class evaluates actions from the synthesis engine and executes them
 * based on confidence thresholds and impact levels. It ensures that only
 * safe, high-confidence actions are auto-executed while escalating risky
 * or uncertain actions for human approval.
 */
export class ProactiveExecutor {
  private static instance: ProactiveExecutor | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): ProactiveExecutor {
    if (!ProactiveExecutor.instance) {
      ProactiveExecutor.instance = new ProactiveExecutor();
    }
    return ProactiveExecutor.instance;
  }

  /**
   * Evaluate whether an action should be executed, proposed, or deferred
   *
   * Decision Logic:
   * - AUTO_EXECUTE: confidence > action.confidenceRequired AND impact != 'high'
   * - PROPOSE: confidence > 0.6 AND (impact == 'high' OR involves priority contact)
   * - DEFER: confidence <= 0.6 OR other conditions not met
   *
   * @param action - The proactive action to evaluate
   * @param task - The unified task this action belongs to
   * @returns ExecutionDecision with shouldExecute, reason, and escalationLevel
   */
  evaluateAction(action: ProactiveAction, task: UnifiedTask): ExecutionDecision {
    const { confidence } = task;
    const { confidenceRequired, estimatedImpact, type } = action;

    // Check if action involves priority contacts (high-stakes scenarios)
    const involvesPriorityContact = this.checkPriorityContactInvolvement(task);

    // AUTO_EXECUTE: High confidence + low/medium impact
    if (confidence > confidenceRequired && estimatedImpact !== 'high') {
      return {
        shouldExecute: true,
        reason: `High confidence (${confidence.toFixed(2)}) exceeds required threshold (${confidenceRequired}) with ${estimatedImpact} impact`,
        escalationLevel: 'AUTO_EXECUTE',
      };
    }

    // PROPOSE: Moderate confidence OR high impact OR priority contact
    if (confidence > 0.6 && (estimatedImpact === 'high' || involvesPriorityContact)) {
      const reasons: string[] = [];
      if (estimatedImpact === 'high') {
        reasons.push('high impact');
      }
      if (involvesPriorityContact) {
        reasons.push('involves priority contact');
      }
      if (confidence <= confidenceRequired) {
        reasons.push(`confidence (${confidence.toFixed(2)}) below required (${confidenceRequired})`);
      }

      return {
        shouldExecute: false,
        reason: `Action requires approval: ${reasons.join(', ')}`,
        escalationLevel: 'PROPOSE',
      };
    }

    // DEFER: Low confidence or other conditions not met
    return {
      shouldExecute: false,
      reason: `Insufficient confidence (${confidence.toFixed(2)}) for ${type} action`,
      escalationLevel: 'DEFER',
    };
  }

  /**
   * Execute a proactive action immediately
   *
   * Routes the action to the appropriate agent and handles different action types.
   * Uses agentInvoker.invoke() with forceExecute=true to bypass escalation checks.
   *
   * @param action - The action to execute
   * @param task - The unified task this action belongs to
   * @returns ExecutionResult with success status and response/error
   */
  async executeAction(action: ProactiveAction, task: UnifiedTask): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Build the prompt based on action type
      const userMessage = this.buildActionPrompt(action, task);

      // Invoke the agent with forceExecute to bypass escalation
      const response = await agentInvoker.invoke({
        agentId: action.targetAgentId,
        userMessage,
        forceExecute: true, // Bypass escalation checks
        context: {
          domainId: task.domain,
          metadata: {
            taskId: task.id,
            actionType: action.type,
            confidence: task.confidence,
            synthesisSource: 'cognitive-synthesis',
          },
          skipMemory: false, // Allow memory retrieval for context
        },
      });

      // Mark action as executed
      action.executed = true;
      action.executedAt = new Date().toISOString();
      action.executionResult = {
        success: true,
        message: response.content,
      };

      console.log(`[ProactiveExecutor] Executed ${action.type} action for task ${task.id} via ${action.targetAgentId}`);

      return {
        success: true,
        agentId: action.targetAgentId,
        response: response.content,
        executedAt: startTime,
      };
    } catch (error) {
      console.error(`[ProactiveExecutor] Failed to execute ${action.type} action:`, error);

      // Mark action as failed
      action.executed = true;
      action.executedAt = new Date().toISOString();
      action.executionResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      return {
        success: false,
        agentId: action.targetAgentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: startTime,
      };
    }
  }

  /**
   * Propose an action for user approval
   *
   * Adds the action to the pending escalations queue via agentInvoker.
   * Returns an approval ID that can be used to track the proposal.
   *
   * @param action - The action to propose
   * @param task - The unified task this action belongs to
   * @returns Promise<string> - Approval ID for tracking
   */
  async proposeAction(action: ProactiveAction, task: UnifiedTask): Promise<string> {
    try {
      // Build the proposal message
      const proposalMessage = this.buildProposalMessage(action, task);

      // Invoke the agent WITHOUT forceExecute to trigger escalation
      const response = await agentInvoker.invoke({
        agentId: action.targetAgentId,
        userMessage: proposalMessage,
        forceExecute: false, // Trigger escalation - will be added to pending queue
        context: {
          domainId: task.domain,
          metadata: {
            taskId: task.id,
            actionType: action.type,
            confidence: task.confidence,
            estimatedImpact: action.estimatedImpact,
            rationale: action.rationale,
            synthesisSource: 'cognitive-synthesis',
          },
        },
      });

      // Get the request ID as the approval ID
      const approvalId = response.requestId;

      console.log(`[ProactiveExecutor] Proposed ${action.type} action for approval: ${approvalId}`);

      return approvalId;
    } catch (error) {
      console.error(`[ProactiveExecutor] Failed to propose ${action.type} action:`, error);
      throw error;
    }
  }

  /**
   * Handle all actions from a synthesis result
   *
   * Evaluates each action and either executes it, proposes it for approval,
   * or defers it based on confidence and impact levels.
   *
   * @param result - The synthesis result containing proposed actions
   * @returns ExecutionSummary with counts and details of all actions
   */
  async handleSynthesisActions(result: SynthesisResult): Promise<ExecutionSummary> {
    const summary: ExecutionSummary = {
      executed: 0,
      proposed: 0,
      deferred: 0,
      executionDetails: [],
    };

    // Process each proposed action
    for (const action of result.proposed_actions) {
      // Find the task this action belongs to (if any)
      const task = this.findTaskForAction(action, result);

      if (!task) {
        console.warn(`[ProactiveExecutor] No task found for action ${action.type}, deferring`);
        summary.deferred++;
        summary.executionDetails.push({
          actionType: action.type,
          escalationLevel: 'DEFER',
        });
        continue;
      }

      // Evaluate the action
      const decision = this.evaluateAction(action, task);

      if (decision.escalationLevel === 'AUTO_EXECUTE') {
        // Execute immediately
        const result = await this.executeAction(action, task);
        summary.executed++;
        summary.executionDetails.push({
          actionType: action.type,
          escalationLevel: 'AUTO_EXECUTE',
          result,
        });
      } else if (decision.escalationLevel === 'PROPOSE') {
        // Propose for approval
        const approvalId = await this.proposeAction(action, task);
        summary.proposed++;
        summary.executionDetails.push({
          actionType: action.type,
          escalationLevel: 'PROPOSE',
          approvalId,
        });
      } else {
        // Defer
        summary.deferred++;
        summary.executionDetails.push({
          actionType: action.type,
          escalationLevel: 'DEFER',
        });
      }
    }

    console.log(`[ProactiveExecutor] Synthesis actions processed: ${summary.executed} executed, ${summary.proposed} proposed, ${summary.deferred} deferred`);

    return summary;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if task involves priority contacts
   * (This is a placeholder - implement based on your contact priority system)
   */
  private checkPriorityContactInvolvement(task: UnifiedTask): boolean {
    // Check task metadata for priority contact flags
    const metadata = task.metadata || {};
    return metadata.involvesPriorityContact === true;
  }

  /**
   * Build the action prompt for agent invocation
   * Customize based on action type
   */
  private buildActionPrompt(action: ProactiveAction, task: UnifiedTask): string {
    const { type, payload, rationale } = action;

    let prompt = `# Proactive Action Execution\n\n`;
    prompt += `**Task:** ${task.title}\n`;
    prompt += `**Description:** ${task.description}\n\n`;
    prompt += `**Action Type:** ${type}\n`;
    prompt += `**Rationale:** ${rationale}\n\n`;

    // Customize prompt based on action type
    switch (type) {
      case 'reply':
        prompt += `**Action:** Compose and send a reply.\n`;
        prompt += `**Recipient:** ${payload.recipient || 'Unknown'}\n`;
        prompt += `**Context:** ${payload.context || 'None'}\n`;
        break;

      case 'create_task':
        prompt += `**Action:** Create a new task in the external system.\n`;
        prompt += `**System:** ${payload.system || 'Motion/Todoist'}\n`;
        prompt += `**Task Title:** ${payload.title || task.title}\n`;
        prompt += `**Due Date:** ${payload.dueDate || 'Not specified'}\n`;
        break;

      case 'schedule':
        prompt += `**Action:** Schedule a calendar event.\n`;
        prompt += `**Event Title:** ${payload.eventTitle || task.title}\n`;
        prompt += `**Date/Time:** ${payload.dateTime || 'To be determined'}\n`;
        prompt += `**Duration:** ${payload.duration || '30 minutes'}\n`;
        break;

      case 'delegate':
        prompt += `**Action:** Delegate to another agent or person.\n`;
        prompt += `**Delegate To:** ${payload.delegateTo || 'Unknown'}\n`;
        prompt += `**Instructions:** ${payload.instructions || 'None'}\n`;
        break;

      case 'archive':
        prompt += `**Action:** Archive/dismiss this task.\n`;
        prompt += `**Reason:** ${payload.reason || 'No longer relevant'}\n`;
        break;

      case 'escalate':
        prompt += `**Action:** Flag for immediate human attention.\n`;
        prompt += `**Urgency:** ${task.urgency}\n`;
        prompt += `**Reason:** ${payload.reason || 'Requires immediate review'}\n`;
        break;

      case 'research':
        prompt += `**Action:** Trigger research agent for more information.\n`;
        prompt += `**Research Query:** ${payload.query || task.description}\n`;
        prompt += `**Focus Areas:** ${(payload.focusAreas as string[] || []).join(', ') || 'General'}\n`;
        break;

      case 'summarize':
        prompt += `**Action:** Generate a summary document.\n`;
        prompt += `**Summary Type:** ${payload.summaryType || 'General'}\n`;
        prompt += `**Include:** ${(payload.include as string[] || []).join(', ') || 'All relevant details'}\n`;
        break;

      default:
        prompt += `**Payload:** ${JSON.stringify(payload, null, 2)}\n`;
    }

    prompt += `\n**Instructions:** Execute this action based on the context above.`;

    return prompt;
  }

  /**
   * Build the proposal message for user approval
   */
  private buildProposalMessage(action: ProactiveAction, task: UnifiedTask): string {
    let message = `# Action Approval Request\n\n`;
    message += `**Task:** ${task.title}\n`;
    message += `**Confidence:** ${task.confidence.toFixed(2)}\n`;
    message += `**Urgency:** ${task.urgency}\n`;
    message += `**Impact:** ${action.estimatedImpact}\n\n`;
    message += `**Proposed Action:** ${action.type}\n`;
    message += `**Rationale:** ${action.rationale}\n\n`;

    // Add action-specific details
    if (action.type === 'reply' && action.payload.recipient) {
      message += `**Recipient:** ${action.payload.recipient}\n`;
    } else if (action.type === 'delegate' && action.payload.delegateTo) {
      message += `**Delegate To:** ${action.payload.delegateTo}\n`;
    }

    message += `\n**This action requires your approval before execution.**`;

    return message;
  }

  /**
   * Find the task that an action belongs to
   * (Actions in proposed_actions[] are standalone - match by context)
   */
  private findTaskForAction(action: ProactiveAction, result: SynthesisResult): UnifiedTask | null {
    // Check if the action payload contains a taskId
    if (action.payload.taskId && typeof action.payload.taskId === 'string') {
      const taskId = action.payload.taskId;
      const task = result.unified_tasks.find(t => (t as any).id === taskId);
      if (task) {
        // Construct a minimal UnifiedTask from the partial result
        // Spread task first so explicit properties can override
        return {
          ...task,
          id: taskId,
          status: 'ready',
          createdAt: new Date().toISOString(),
          refinementCount: 0,
          proposedAction: action,
        } as UnifiedTask;
      }
    }

    // Fallback: Create a minimal task from the first unified task
    // (This assumes actions are related to the first task in the synthesis)
    if (result.unified_tasks.length > 0) {
      const firstTask = result.unified_tasks[0];
      // Spread firstTask first so explicit properties can override
      return {
        ...firstTask,
        id: `task_${Date.now()}`,
        status: 'ready',
        createdAt: new Date().toISOString(),
        refinementCount: 0,
        proposedAction: action,
      } as UnifiedTask;
    }

    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton instance
 */
export const proactiveExecutor = ProactiveExecutor.getInstance();

/**
 * Convenience function to evaluate an action
 */
export function evaluateAction(action: ProactiveAction, task: UnifiedTask): ExecutionDecision {
  return proactiveExecutor.evaluateAction(action, task);
}

/**
 * Convenience function to execute an action
 */
export async function executeAction(action: ProactiveAction, task: UnifiedTask): Promise<ExecutionResult> {
  return proactiveExecutor.executeAction(action, task);
}

/**
 * Convenience function to propose an action
 */
export async function proposeAction(action: ProactiveAction, task: UnifiedTask): Promise<string> {
  return proactiveExecutor.proposeAction(action, task);
}

/**
 * Convenience function to handle synthesis actions
 */
export async function handleSynthesisActions(result: SynthesisResult): Promise<ExecutionSummary> {
  return proactiveExecutor.handleSynthesisActions(result);
}
