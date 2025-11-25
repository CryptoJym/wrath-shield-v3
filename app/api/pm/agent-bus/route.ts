/**
 * Agent Bus API
 *
 * GET /api/pm/agent-bus - List messages with optional filters
 * POST /api/pm/agent-bus - Actions: markRead, acknowledge, markAllRead, seed, clear
 */

import { NextResponse } from 'next/server';
import {
  loadBusStore,
  getAllMessages,
  getMessagesFor,
  getStats,
  markRead,
  acknowledge,
  markAllRead,
  seedExampleMessages,
  clearMessages,
  type AgentId,
  type MessageCategory,
  type MessagePriority,
} from '../../../../lib/agent_bus';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const agent = searchParams.get('agent') as AgentId | null;
    const category = searchParams.get('category') as MessageCategory | null;
    const priority = searchParams.get('priority') as MessagePriority | null;
    const unreadOnly = searchParams.get('unread') === 'true';

    let messages;
    if (agent) {
      messages = getMessagesFor(agent, { unreadOnly, limit });
    } else {
      messages = getAllMessages({ limit, category: category || undefined, priority: priority || undefined });
      if (unreadOnly) {
        messages = messages.filter((m) => !m.read);
      }
    }

    const stats = getStats();

    return NextResponse.json({
      success: true,
      messages,
      stats,
      count: messages.length,
    });
  } catch (error) {
    console.error('[Agent Bus API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action, messageId } = await request.json();

    switch (action) {
      case 'markRead': {
        if (!messageId) {
          return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 });
        }
        const result = markRead(messageId);
        return NextResponse.json({ success: result, message: result ? 'Marked as read' : 'Message not found' });
      }

      case 'acknowledge': {
        if (!messageId) {
          return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 });
        }
        const result = acknowledge(messageId);
        return NextResponse.json({ success: result, message: result ? 'Acknowledged' : 'Message not found' });
      }

      case 'markAllRead': {
        const count = markAllRead();
        return NextResponse.json({ success: true, message: `Marked ${count} messages as read`, count });
      }

      case 'seed': {
        const added = seedExampleMessages();
        return NextResponse.json({ success: true, message: `Added ${added} example messages`, added });
      }

      case 'clear': {
        clearMessages();
        return NextResponse.json({ success: true, message: 'All messages cleared' });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: markRead, acknowledge, markAllRead, seed, clear' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Agent Bus API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
