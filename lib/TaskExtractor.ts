/**
 * Wrath Shield v3 - Task Extractor (Sherlock Engine)
 *
 * Analyzes lifelogs using Grok/Claude to identify actionable tasks and projects.
 * Uses "Sherlock" reasoning to connect dots across multiple logs.
 *
 * SECURITY: Server-side only.
 */

import { ensureServerOnly } from './server-only-guard';
import { getOpenRouterClient } from './OpenRouterClient';
import { PromptBuilder } from './PromptBuilder';
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

export class TaskExtractor {
  private model: string;

  constructor() {
    this.model = process.env.ANALYSIS_MODEL || 'xai/grok-4-1-fast';
  }

  /**
   * Analyze lifelogs and extract structured tasks
   */
  async extractFromLogs(lifelogs: Lifelog[]): Promise<ExtractedProject[]> {
    if (lifelogs.length === 0) return [];

    const client = getOpenRouterClient();
    const builder = new PromptBuilder();

    // 1. Construct Context
    const logsText = lifelogs.map(l => 
      `[${l.date} ${l.title || 'Untitled'}]\n${this.getTranscriptSample(l)}`
    ).join('\n\n');

    builder.addSystem(`
      You are Sherlock, an advanced AI analyst for Wrath Shield.
      Your goal is to analyze the user's life logs for continuity, open loops, and actionable needs.
      
      Analyze the provided logs and extract specific PROJECTS and TASKS.
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
    `);

    builder.addUser(`Here are my recent life logs. Analyze them for continuity and actionable tasks:\n\n${logsText}`);

    // 2. Call LLM with specific model
    console.log(`[TaskExtractor] Analyzing ${lifelogs.length} logs using ${this.model}...`);
    const response = await client.getCoachingResponse(builder.build());

    // 3. Parse Response
    try {
      // Strip Markdown code blocks if present
      const cleanJson = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);
      
      if (!data.projects || !Array.isArray(data.projects)) {
        throw new Error('Invalid JSON structure: missing "projects" array');
      }

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
