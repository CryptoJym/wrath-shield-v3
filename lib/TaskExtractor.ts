/**
 * Wrath Shield v3 - Task Extractor (Sherlock Engine)
 *
 * Analyzes lifelogs using Grok/Claude to identify actionable tasks and projects.
 * Uses "Sherlock" reasoning to connect dots across multiple logs.
 * Now integrated with Life OS config for agent prompts and LLM routing.
 *
 * SECURITY: Server-side only.
 */

import { ensureServerOnly } from './server-only-guard';
import { invokeAgent } from './agents/AgentInvoker';
import { getAgent } from './life-os-config';
import type { Lifelog } from './db/types';

// Prevent client-side imports
ensureServerOnly('lib/TaskExtractor');

export interface ExtractedProject {
  name: string;
  description: string;
  tasks: ExtractedTask[];
}

export interface ExtractedTask {
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4; // 4 is highest
  due_string?: string; // e.g., "tomorrow", "next monday"
}

// Agent ID for task extraction (Sherlock)
const SHERLOCK_AGENT_ID = 'agent.sherlock';

export class TaskExtractor {
  private agentId: string;

  constructor() {
    // Check if agent exists in Life OS config, fallback to orchestrator
    const agent = getAgent(SHERLOCK_AGENT_ID);
    this.agentId = agent ? SHERLOCK_AGENT_ID : 'agent.orchestrator';
  }

  /**
   * Analyze lifelogs and extract structured tasks
   * Uses AgentInvoker for Life OS routing and escalation
   */
  async extractFromLogs(lifelogs: Lifelog[]): Promise<ExtractedProject[]> {
    if (lifelogs.length === 0) return [];

    // 1. Construct Context
    const logsText = lifelogs.map(l =>
      `[${l.date} ${l.title || 'Untitled'}]\n${this.getTranscriptSample(l)}`
    ).join('\n\n');

    const userMessage = `Analyze the following life logs for continuity, open loops, and actionable needs.
Extract specific PROJECTS and TASKS.
- A Project is a high-level goal or ongoing area of focus.
- A Task is a concrete, actionable step.

Return ONLY a JSON object with this structure:
{
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief context",
      "tasks": [
        {
          "content": "Task action",
          "description": "Why this is needed (optional)",
          "priority": 1-4 (4 is urgent),
          "due_string": "natural language due date or null"
        }
      ]
    }
  ]
}

Here are the life logs:

${logsText}`;

    // 2. Call via AgentInvoker (Life OS routing)
    console.log(`[TaskExtractor] Analyzing ${lifelogs.length} logs via ${this.agentId}...`);
    const response = await invokeAgent({
      agentId: this.agentId,
      userMessage,
      forceExecute: true, // Task extraction is always auto-execute
    });

    // 3. Parse Response
    try {
      // Strip Markdown code blocks if present
      const cleanJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);

      if (!data.projects || !Array.isArray(data.projects)) {
        throw new Error('Invalid JSON structure: missing "projects" array');
      }

      console.log(`[TaskExtractor] Extracted ${data.projects.length} projects (escalation: ${response.escalationLevel})`);
      return data.projects;
    } catch (error) {
      console.error('[TaskExtractor] Failed to parse LLM response:', error);
      console.error('[TaskExtractor] Raw response:', response.content);
      return [];
    }
  }

  private getTranscriptSample(log: Lifelog): string {
    if (!log.raw_json) return '';
    try {
      const raw = JSON.parse(log.raw_json);
      // Return summary or truncated transcript
      return raw.markdown || raw.transcript || log.title || '';
    } catch {
      return '';
    }
  }
}

let instance: TaskExtractor | null = null;

export function getTaskExtractor(): TaskExtractor {
  if (!instance) instance = new TaskExtractor();
  return instance;
}
