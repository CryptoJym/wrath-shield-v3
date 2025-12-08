/**
 * LLM Paste Processing API
 *
 * POST /api/pm/llm-paste - Process a pasted LLM conversation
 *
 * Takes a conversation from an LLM (ChatGPT, Claude, etc.) and:
 * 1. Extracts key information
 * 2. Identifies action items
 * 3. Creates tasks or follows up as needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLocalTask } from '@/lib/pm/local-task-store';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an assistant that analyzes pasted LLM conversations to extract actionable information.

Given a conversation, identify:
1. Action items or tasks that need to be completed
2. Decisions that were made
3. Important information to remember
4. Follow-up questions or clarifications needed

Respond in JSON format:
{
  "summary": "Brief summary of the conversation",
  "action_items": [
    {
      "title": "Task title",
      "description": "Task description",
      "priority": "high|medium|low",
      "due_date": "optional ISO date if mentioned"
    }
  ],
  "decisions": ["List of decisions made"],
  "key_info": ["Important facts or information to remember"],
  "follow_ups": ["Questions that still need answers"]
}`;

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
      'X-Title': 'Wrath Shield LLM Paste',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages,
      temperature: 0.3,
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
    const { conversation } = body;

    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: 'conversation is required' },
        { status: 400 }
      );
    }

    // Use LLM to analyze the conversation
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze this conversation:\n\n${conversation}` },
    ];

    const llmResponse = await callLLM(messages);

    // Parse the response
    let analysis;
    try {
      // Extract JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // If parsing fails, create a basic structure
      analysis = {
        summary: 'Unable to parse conversation',
        action_items: [],
        decisions: [],
        key_info: [],
        follow_ups: [],
      };
    }

    // Create tasks for action items
    const createdTasks = [];
    for (const item of analysis.action_items || []) {
      const task = createLocalTask({
        title: item.title,
        description: item.description,
        priority: item.priority || 'medium',
        due_date: item.due_date,
        labels: ['llm-extracted'],
        metadata: {
          source: 'llm_paste',
          extracted_at: Date.now(),
        },
      });
      createdTasks.push(task);
    }

    return NextResponse.json({
      ok: true,
      analysis,
      tasks_created: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error('[LLM Paste API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
