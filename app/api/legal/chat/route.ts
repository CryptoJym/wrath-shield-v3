import { NextRequest, NextResponse } from 'next/server';
import {
  saveChatMessage,
  listChatMessages,
  clearChatMessages,
  createPendingAction,
  createNotification,
  listLegalContextRequests,
} from '@/lib/legal/store';
import fs from 'fs';
import path from 'path';

// Load context memo if available
function loadContextMemo(): string {
  // Check monorepo path first, then fallback to env or default
  const monorepoPath = path.resolve(process.cwd(), 'packages', 'legal-scrapers', 'analysis', 'context_memo.md');
  const legacyPath = path.resolve(process.env.LEGAL_AI_PATH || '/Users/jamesbrady/legal-advocate-ai', 'analysis', 'context_memo.md');

  const memoPath = fs.existsSync(monorepoPath) ? monorepoPath : legacyPath;

  try {
    if (fs.existsSync(memoPath)) {
      return fs.readFileSync(memoPath, 'utf-8');
    }
  } catch {}
  return '';
}

// Simple pattern-based response for legal questions
function generateLegalResponse(message: string, contextMemo: string, pendingItems: any[]): { reply: string; actionCreated?: boolean; metadata?: any } {
  const lowerMsg = message.toLowerCase();

  // Check for action creation requests
  if (lowerMsg.includes('create action') || lowerMsg.includes('draft email') || lowerMsg.includes('send to zack')) {
    const actionTitle = lowerMsg.includes('email') ? 'Draft email to Zack Starr' : 'Legal action request';
    const action = createPendingAction({
      action_type: 'email_draft',
      title: actionTitle,
      description: message,
      priority: lowerMsg.includes('urgent') ? 'urgent' : 'normal',
      payload: { originalRequest: message, timestamp: new Date().toISOString() },
    });

    createNotification({
      notification_type: 'action_required',
      title: 'New action pending approval',
      message: actionTitle,
      severity: 'warning',
      related_id: action.id,
    });

    return {
      reply: `I've created a pending action: **${actionTitle}**\n\nThis action requires your approval before execution. You can review and approve it in the "Pending Actions" tab.`,
      actionCreated: true,
      metadata: { actionCreated: true, actionId: action.id },
    };
  }

  // Check for order summary requests
  if (lowerMsg.includes('10/21') || lowerMsg.includes('order') || lowerMsg.includes('october')) {
    return {
      reply: `## Summary of the October 21, 2025 Order

Based on the court documents, here are the key rulings:

### Key Provisions:
1. **Ross v. Ross Controls** - Joint physical custody means Mother cannot relocate without consent or court approval
2. **If Mother Relocates**: Physical custody transfers to Father
3. **Parent Time**: Mother's parent time governed by Utah Code 81-9-209 (including transportation costs)
4. **School**: Child must remain in Canyon Grove hybrid schedule through 2025-2026 academic year
5. **Contact**: Both parties shall encourage phone/virtual contact with non-custodial parent

### Current Status:
- Mother HAS relocated to California
- Father HAS physical custody per the Order
- Child (Hyro) residing with Father in Utah

### Signed By:
- Commissioner Marian Ito (Oct 28, 2025)
- Judge Derek Pullan (Oct 30, 2025)

Would you like me to draft any communications regarding this order?`,
    };
  }

  // Check for next steps
  if (lowerMsg.includes('next step') || lowerMsg.includes('what should') || lowerMsg.includes('what do i')) {
    return {
      reply: `## Recommended Next Steps

Based on the current case status:

### Immediate Priority:
1. **Custody Codification** - File to formally recognize custody transfer
2. **Child Support Modification** - You're now the custodial parent; CS should be modified
3. **Holiday Schedule** - Tie holidays to Alpine School District calendar

### Outstanding Issues:
- **July 4 Makeup Time** - Request time-for-time for denied parent time
- **Income Verification** - Mother's income (including creator-platform) needs documentation
- **Decision Authority** - Request final authority on education/healthcare

### Action Items:
1. Contact Zack about filing strategy
2. Gather documentation for CS modification
3. Compile evidence of current custody arrangement

Would you like me to create an action to email Zack about any of these items?`,
    };
  }

  // Check for July violations
  if (lowerMsg.includes('july') || lowerMsg.includes('violation')) {
    return {
      reply: `## July 2025 Violations Summary

From Zack's July 28, 2025 Motion to Enforce:

### Documented Violations:
1. **July 4**: Mother refused Father's holiday parent-time (claimed orders weren't signed despite June 24 stipulation)
2. **July 7**: Late drop-off without approval
3. **July 11**: Late drop-off without approval
4. **Marital Debt**: Never provided required statements

### Pattern Established:
- Violations began IMMEDIATELY after July 14, 2025 Order
- Same pattern continued with school exclusion (August 2025)
- Culminated in September 12 relocation notice

### Evidence Available:
- Text messages documenting each violation
- Zack's Motion to Enforce filing
- July-August communication thread

This pattern is important for demonstrating non-compliance and predicting future behavior if given distance.`,
    };
  }

  // Check for pending items
  if (lowerMsg.includes('pending') || lowerMsg.includes('queue') || lowerMsg.includes('items')) {
    const pendingCount = pendingItems.length;
    if (pendingCount === 0) {
      return { reply: 'There are currently no pending context requests in the queue.' };
    }
    const itemList = pendingItems.slice(0, 5).map(item => `- **${item.topic || 'Item'}**: ${item.summary?.substring(0, 100) || 'No summary'}...`).join('\n');
    return {
      reply: `## Pending Items (${pendingCount} total)\n\n${itemList}\n\nYou can review all items in the "Context Queue" tab.`,
    };
  }

  // Default response with case context
  return {
    reply: `I'm your Legal Advocate AI assistant for case **164400524 - Brady v. Brady**.

I can help you with:
- **Summarize orders** - "Tell me about the 10/21 Order"
- **Review violations** - "What happened in July?"
- **Next steps** - "What should I do next?"
- **Create actions** - "Draft email to Zack about CS modification"
- **Check pending items** - "What items are pending?"

${contextMemo ? 'I have access to your case context memo and can provide specific information about your situation.' : ''}

How can I assist you today?`,
  };
}

// GET - Retrieve chat history
export async function GET() {
  try {
    const messages = listChatMessages();
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to get chat messages:', error);
    return NextResponse.json({ messages: [] });
  }
}

// POST - Send message and get response
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Save user message
    saveChatMessage({
      role: 'user',
      content: message,
    });

    // Load context
    const contextMemo = loadContextMemo();
    const pendingItems = listLegalContextRequests('pending');

    // Generate response
    const { reply, actionCreated, metadata } = generateLegalResponse(message, contextMemo, pendingItems);

    // Save assistant message
    saveChatMessage({
      role: 'assistant',
      content: reply,
      metadata,
    });

    return NextResponse.json({
      reply,
      actionsCreated: actionCreated,
      metadata,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 });
  }
}

// DELETE - Clear chat history
export async function DELETE() {
  try {
    const deleted = clearChatMessages();
    return NextResponse.json({ cleared: deleted });
  } catch (error) {
    console.error('Failed to clear chat:', error);
    return NextResponse.json({ error: 'Failed to clear' }, { status: 500 });
  }
}
