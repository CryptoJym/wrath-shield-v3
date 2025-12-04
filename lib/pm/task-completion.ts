/**
 * Task Completion Intelligence
 *
 * Handles intelligent task completion with:
 * - LLM-generated completion summaries
 * - GitHub issue comments before closing
 * - Zep memory persistence for learning
 */

import { ensureServerOnly } from '@/lib/server-only-guard';
import githubClient from '@/lib/integrations/GitHubClient';
import { addPMMemory } from './pm-memory';

// Prevent client-side imports
ensureServerOnly('lib/pm/task-completion');

interface TaskCompletionContext {
  taskId: string;
  title: string;
  description: string | null;
  repoFullName: string;
  issueNumber: number;
  completionNote?: string;
}

interface CompletionResult {
  success: boolean;
  summary: string;
  commentUrl?: string;
  error?: string;
}

/**
 * Generate a completion summary using LLM via OpenRouter
 */
async function generateCompletionSummary(
  title: string,
  description: string | null,
  completionNote?: string
): Promise<string> {
  const prompt = `You are a PM assistant. Generate a brief, professional completion summary for this task.

Task: ${title}
${description ? `Description: ${description}` : ''}
${completionNote ? `User note: ${completionNote}` : ''}

Generate a 1-2 sentence completion summary that:
1. Confirms what was accomplished
2. Notes any key outcomes or deliverables
3. Is suitable for a GitHub issue closing comment

Keep it concise and professional. Do not include "Task completed" or similar - just the summary.`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('[Task Completion] No OpenRouter API key configured');
      return completionNote || `Completed: ${title}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://wrath-shield.com',
        'X-Title': 'Wrath Shield PM Agent',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [
          { role: 'system', content: 'You are a concise PM assistant. Generate brief, professional completion summaries.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return content?.trim() || completionNote || `Completed: ${title}`;
  } catch (error) {
    console.error('[Task Completion] LLM error:', error);
    // Fallback to simple summary
    return completionNote || `Completed: ${title}`;
  }
}

/**
 * Complete a task with intelligence
 */
export async function completeTaskWithIntelligence(
  context: TaskCompletionContext
): Promise<CompletionResult> {
  const { taskId, title, description, repoFullName, issueNumber, completionNote } = context;

  try {
    // 1. Generate completion summary via LLM
    const summary = await generateCompletionSummary(title, description, completionNote);

    // 2. Add completion comment to GitHub issue
    const [owner, repo] = repoFullName.split('/');
    let commentUrl: string | undefined;

    try {
      const comment = await githubClient.addIssueComment(owner, repo, issueNumber, `## Task Completed

${summary}

---
*Closed via PM Agent*`);
      commentUrl = comment.html_url;
    } catch (commentError) {
      console.warn('[Task Completion] Failed to add comment:', commentError);
      // Continue anyway - closing is more important than the comment
    }

    // 3. Close the GitHub issue
    await githubClient.closeIssue(owner, repo, issueNumber);

    // 4. Persist to Zep memory for learning
    try {
      await addPMMemory(
        `Task completed: "${title}" in ${repoFullName}. Summary: ${summary}`,
        'decision',
        {
          action: 'task_completed',
          task_id: taskId,
          repo_full_name: repoFullName,
          issue_number: issueNumber,
          summary,
          completed_at: new Date().toISOString(),
        }
      );
    } catch (memoryError) {
      console.warn('[Task Completion] Failed to persist to memory:', memoryError);
    }

    return {
      success: true,
      summary,
      commentUrl,
    };
  } catch (error) {
    console.error('[Task Completion] Error:', error);
    return {
      success: false,
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Start a task with context
 */
export async function startTaskWithContext(
  context: Omit<TaskCompletionContext, 'completionNote'>
): Promise<{ success: boolean; error?: string }> {
  const { taskId, title, repoFullName, issueNumber } = context;

  try {
    const [owner, repo] = repoFullName.split('/');

    // Add a "started" comment to GitHub issue
    try {
      await githubClient.addIssueComment(owner, repo, issueNumber, `## Task Started

Work has begun on this task.

---
*Updated via PM Agent*`);
    } catch (commentError) {
      console.warn('[Task Start] Failed to add comment:', commentError);
    }

    // Persist to Zep memory
    try {
      await addPMMemory(
        `Task started: "${title}" in ${repoFullName}`,
        'sync',
        {
          action: 'task_started',
          task_id: taskId,
          repo_full_name: repoFullName,
          issue_number: issueNumber,
          started_at: new Date().toISOString(),
        }
      );
    } catch (memoryError) {
      console.warn('[Task Start] Failed to persist to memory:', memoryError);
    }

    return { success: true };
  } catch (error) {
    console.error('[Task Start] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
