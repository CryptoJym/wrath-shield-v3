/**
 * Orchestrator Gateway - Multi-Agent Coordination Endpoint
 *
 * Enables coordinating multiple agents on complex tasks:
 * - Sequential: Agents work one after another, each seeing prior results
 * - Parallel: Agents work simultaneously, results combined
 * - Handoff: First agent works, then explicitly hands off to next
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentInvoker, type AgentInvocation, type AgentResponse } from '@/lib/agents/AgentInvoker';
import { getAgent } from '@/lib/life-os-config';

// =============================================================================
// Types
// =============================================================================

interface CoordinateRequest {
  workflow: 'sequential' | 'parallel' | 'handoff';
  task: string;
  agents: string[];
  context?: Record<string, any>;
  timeout?: number;
}

interface AgentResult {
  agentId: string;
  agentName: string;
  response: string;
  escalationLevel: string;
  wasExecuted: boolean;
  latencyMs: number;
  error?: string;
}

interface HandoffInfo {
  from: string;
  to: string;
  context: string;
  timestamp: string;
}

interface CoordinateResponse {
  success: boolean;
  workflowId: string;
  workflow: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  results: AgentResult[];
  handoffs?: HandoffInfo[];
  summary?: string;
  totalLatencyMs: number;
  error?: string;
}

// =============================================================================
// Coordination Logic
// =============================================================================

/**
 * Run agents sequentially, each seeing the accumulated context
 */
async function runSequential(
  task: string,
  agents: string[],
  context?: Record<string, any>
): Promise<{ results: AgentResult[]; handoffs: HandoffInfo[] }> {
  const results: AgentResult[] = [];
  const handoffs: HandoffInfo[] = [];
  let accumulatedContext = context || {};

  for (let i = 0; i < agents.length; i++) {
    const agentId = agents[i];
    const agentDef = getAgent(agentId);
    const agentName = agentDef?.name || agentId;

    // Build message with accumulated context
    let message = task;
    if (results.length > 0) {
      const priorResults = results
        .map(r => `[${r.agentName}]: ${r.response.substring(0, 500)}`)
        .join('\n\n');
      message = `${task}\n\n--- Prior Agent Responses ---\n${priorResults}`;
    }

    try {
      const invocation: AgentInvocation = {
        agentId,
        userMessage: message,
        context: {
          metadata: {
            ...accumulatedContext,
            workflow: 'sequential',
            position: i + 1,
            totalAgents: agents.length,
          },
        },
      };

      const response: AgentResponse = await agentInvoker.invoke(invocation);

      results.push({
        agentId,
        agentName,
        response: response.content,
        escalationLevel: response.escalationLevel,
        wasExecuted: response.shouldExecute,
        latencyMs: response.latencyMs,
      });

      // Record handoff if there's a next agent
      if (i < agents.length - 1) {
        handoffs.push({
          from: agentId,
          to: agents[i + 1],
          context: `Processed by ${agentName}, passing results to next agent`,
          timestamp: new Date().toISOString(),
        });
      }

      // Update accumulated context
      accumulatedContext = {
        ...accumulatedContext,
        [`${agentId}_response`]: response.content,
        [`${agentId}_escalation`]: response.escalationLevel,
      };
    } catch (error) {
      results.push({
        agentId,
        agentName,
        response: '',
        escalationLevel: 'CRITICAL',
        wasExecuted: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue to next agent even if one fails
    }
  }

  return { results, handoffs };
}

/**
 * Run agents in parallel, combining results
 */
async function runParallel(
  task: string,
  agents: string[],
  context?: Record<string, any>,
  timeout?: number
): Promise<{ results: AgentResult[] }> {
  const timeoutMs = timeout || 60000;

  const promises = agents.map(async (agentId) => {
    const agentDef = getAgent(agentId);
    const agentName = agentDef?.name || agentId;

    try {
      const invocation: AgentInvocation = {
        agentId,
        userMessage: task,
        context: {
          metadata: {
            ...context,
            workflow: 'parallel',
            totalAgents: agents.length,
          },
        },
      };

      const response: AgentResponse = await agentInvoker.invoke(invocation);

      return {
        agentId,
        agentName,
        response: response.content,
        escalationLevel: response.escalationLevel,
        wasExecuted: response.shouldExecute,
        latencyMs: response.latencyMs,
      };
    } catch (error) {
      return {
        agentId,
        agentName,
        response: '',
        escalationLevel: 'CRITICAL' as const,
        wasExecuted: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Add timeout wrapper
  const timeoutPromise = new Promise<AgentResult[]>((_, reject) => {
    setTimeout(() => reject(new Error(`Parallel coordination timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const results = await Promise.race([
      Promise.all(promises),
      timeoutPromise,
    ]);
    return { results: results as AgentResult[] };
  } catch (error) {
    // Return partial results if we have any
    const settledResults = await Promise.allSettled(promises);
    const partialResults = settledResults
      .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === 'fulfilled')
      .map(r => r.value);
    return { results: partialResults };
  }
}

/**
 * Run agents with explicit handoffs (first completes, hands off to second, etc.)
 */
async function runHandoff(
  task: string,
  agents: string[],
  context?: Record<string, any>
): Promise<{ results: AgentResult[]; handoffs: HandoffInfo[] }> {
  const results: AgentResult[] = [];
  const handoffs: HandoffInfo[] = [];
  let currentContext = context || {};
  let handoffMessage = task;

  for (let i = 0; i < agents.length; i++) {
    const agentId = agents[i];
    const agentDef = getAgent(agentId);
    const agentName = agentDef?.name || agentId;

    // For handoff, explicitly ask agent to prepare handoff
    const isLastAgent = i === agents.length - 1;
    const nextAgent = isLastAgent ? null : getAgent(agents[i + 1]);

    let message = handoffMessage;
    if (!isLastAgent && nextAgent) {
      message += `\n\n[HANDOFF INSTRUCTION: After your analysis, prepare a clear handoff summary for ${nextAgent.name} (${nextAgent.role}) who will continue this task.]`;
    }

    try {
      const invocation: AgentInvocation = {
        agentId,
        userMessage: message,
        context: {
          metadata: {
            ...currentContext,
            workflow: 'handoff',
            position: i + 1,
            totalAgents: agents.length,
            isLastAgent,
            nextAgent: nextAgent?.name,
          },
        },
      };

      const response: AgentResponse = await agentInvoker.invoke(invocation);

      results.push({
        agentId,
        agentName,
        response: response.content,
        escalationLevel: response.escalationLevel,
        wasExecuted: response.shouldExecute,
        latencyMs: response.latencyMs,
      });

      // Extract handoff for next agent
      if (!isLastAgent) {
        // Use the response as the handoff message for the next agent
        handoffMessage = `[HANDOFF FROM ${agentName}]\n\nOriginal Task: ${task}\n\nPrevious Agent's Analysis:\n${response.content}`;

        handoffs.push({
          from: agentId,
          to: agents[i + 1],
          context: response.content.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      // Update context
      currentContext = {
        ...currentContext,
        [`${agentId}_handoff`]: response.content,
      };
    } catch (error) {
      results.push({
        agentId,
        agentName,
        response: '',
        escalationLevel: 'CRITICAL',
        wasExecuted: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // In handoff mode, stop if an agent fails
      break;
    }
  }

  return { results, handoffs };
}

/**
 * Generate summary of coordination results
 */
function generateSummary(workflow: string, results: AgentResult[]): string {
  const successful = results.filter(r => !r.error && r.wasExecuted);
  const failed = results.filter(r => r.error);
  const blocked = results.filter(r => !r.error && !r.wasExecuted);

  let summary = `${workflow.toUpperCase()} Coordination Complete:\n`;
  summary += `- ${successful.length} agents responded successfully\n`;

  if (blocked.length > 0) {
    summary += `- ${blocked.length} agents blocked by escalation (${blocked.map(b => b.escalationLevel).join(', ')})\n`;
  }

  if (failed.length > 0) {
    summary += `- ${failed.length} agents failed\n`;
  }

  // Add key insights from each agent
  summary += '\nKey Points:\n';
  for (const result of successful.slice(0, 3)) {
    // Extract first sentence or first 100 chars as key point
    const firstSentence = result.response.split(/[.!?]/)[0] || result.response.substring(0, 100);
    summary += `- ${result.agentName}: ${firstSentence}...\n`;
  }

  return summary;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: CoordinateRequest = await request.json();
    const { workflow, task, agents, context, timeout } = body;

    // Validation
    if (!workflow || !task || !agents || agents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'workflow, task, and agents are required' },
        { status: 400 }
      );
    }

    if (!['sequential', 'parallel', 'handoff'].includes(workflow)) {
      return NextResponse.json(
        { success: false, error: `Unknown workflow type: ${workflow}` },
        { status: 400 }
      );
    }

    // Validate agents exist
    const invalidAgents = agents.filter(a => !getAgent(a));
    if (invalidAgents.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unknown agents: ${invalidAgents.join(', ')}` },
        { status: 400 }
      );
    }

    const workflowId = `coord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let results: AgentResult[] = [];
    let handoffs: HandoffInfo[] | undefined;

    // Execute based on workflow type
    switch (workflow) {
      case 'sequential': {
        const seqResult = await runSequential(task, agents, context);
        results = seqResult.results;
        handoffs = seqResult.handoffs;
        break;
      }
      case 'parallel': {
        const parResult = await runParallel(task, agents, context, timeout);
        results = parResult.results;
        break;
      }
      case 'handoff': {
        const handoffResult = await runHandoff(task, agents, context);
        results = handoffResult.results;
        handoffs = handoffResult.handoffs;
        break;
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    const hasErrors = results.some(r => r.error);
    const allExecuted = results.every(r => r.wasExecuted && !r.error);

    const response: CoordinateResponse = {
      success: !hasErrors || results.some(r => r.wasExecuted),
      workflowId,
      workflow,
      status: hasErrors ? (results.some(r => r.wasExecuted) ? 'partial' : 'failed') : 'completed',
      results,
      handoffs: handoffs && handoffs.length > 0 ? handoffs : undefined,
      summary: generateSummary(workflow, results),
      totalLatencyMs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Gateway Coordinate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        workflowId: `coord_error_${Date.now()}`,
        workflow: 'unknown',
        status: 'failed',
        results: [],
        totalLatencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
