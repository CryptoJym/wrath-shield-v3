/**
 * PM Agent Chat API
 *
 * POST /api/pm/chat - Chat with the PM agent
 *
 * Provides a conversational interface to the PM agent for:
 * - Asking about tasks and projects
 * - Getting status updates
 * - Creating new tasks
 * - Managing priorities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLocalTasks, createLocalTask, getLocalTaskStats } from '@/lib/pm/local-task-store';
import { listRecentEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the PM (Project Manager) agent for a personal AI assistant system called Wrath Shield.

Your responsibilities:
- Help manage tasks and projects
- Provide status updates on work items
- Answer questions about priorities and deadlines
- Create new tasks when requested
- Suggest organizational improvements

You have access to:
- Local tasks database
- Events from email, iMessage, and lifelogs
- Project and repository information

When the user asks you to do something, analyze their request and respond helpfully.
If they want to create a task, extract the title, description, and priority.
If they want to check status, summarize the relevant information.

Be concise but informative. Use markdown for formatting when appropriate.

Current context will be provided with each message.`;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wrath-shield.com',
      'X-Title': 'Wrath Shield PM Chat',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response generated';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'message is required' },
        { status: 400 }
      );
    }

    // Build context from current state
    const stats = getLocalTaskStats();
    const recentTasks = getLocalTasks({ limit: 10 });
    const recentEvents = listRecentEvents(20);

    const contextSummary = `
## Current State

### Task Stats
- Total tasks: ${stats.total}
- Pending: ${stats.pending}
- In Progress: ${stats.in_progress}
- Done: ${stats.done}

### Recent Tasks
${recentTasks.map(t => `- [${t.status}] ${t.title}`).join('\n')}

### Recent Events
${recentEvents.slice(0, 5).map(e => `- [${e.source}] ${e.subject || e.preview?.substring(0, 50) || 'No subject'}`).join('\n')}
`;

    // Build message history
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextSummary },
    ];

    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) { // Keep last 10 messages
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call LLM
    const response = await callLLM(messages);

    // Check if the response contains task creation intent
    let taskCreated = null;
    if (message.toLowerCase().includes('create task') ||
        message.toLowerCase().includes('add task') ||
        message.toLowerCase().includes('new task')) {
      // Try to extract task details from the message
      const extractMessages: ChatMessage[] = [{
        role: 'user',
        content: `Extract task details from this message. Return JSON with title, description, priority (high/medium/low):
"${message}"

Return only valid JSON, nothing else.`
      }];

      try {
        const extractResponse = await callLLM(extractMessages);
        const jsonMatch = extractResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const taskData = JSON.parse(jsonMatch[0]);
          if (taskData.title) {
            taskCreated = createLocalTask({
              title: taskData.title,
              description: taskData.description || '',
              priority: taskData.priority || 'medium',
            });
          }
        }
      } catch {
        // Ignore extraction errors
      }
    }

    return NextResponse.json({
      ok: true,
      response,
      task_created: taskCreated,
    });
  } catch (error) {
    console.error('[PM Chat API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
