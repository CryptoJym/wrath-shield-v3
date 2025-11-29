import { NextResponse } from 'next/server';
import { listChatMessages, clearChatMessages } from '@/lib/legal/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const messages = listChatMessages('default', 100);

    // Transform to the format expected by the chat component
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at,
      metadata: msg.metadata,
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error: any) {
    console.error('Failed to load chat history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load chat history', messages: [] },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const count = clearChatMessages('default');
    return NextResponse.json({ ok: true, cleared: count });
  } catch (error: any) {
    console.error('Failed to clear chat history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear chat history' },
      { status: 500 }
    );
  }
}
