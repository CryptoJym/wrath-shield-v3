/**
 * Legal Chat API Route Tests
 *
 * Tests for the /api/legal/chat endpoint.
 */

// Mock the store before importing the routes
jest.mock('../../../../lib/legal/store', () => ({
  saveChatMessage: jest.fn((input) => ({
    id: 'test-msg-id',
    role: input.role,
    content: input.content,
    metadata: input.metadata || null,
    created_at: new Date().toISOString(),
  })),
  listChatMessages: jest.fn(() => []),
  clearChatMessages: jest.fn(() => 5),
  createPendingAction: jest.fn((input) => ({
    id: 'test-action-id',
    action_type: input.action_type,
    title: input.title,
    status: 'pending',
    created_at: new Date().toISOString(),
  })),
  createNotification: jest.fn(),
  listLegalContextRequests: jest.fn(() => []),
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => ''),
}));

import { GET, POST, DELETE } from '../../../../app/api/legal/chat/route';

describe('/api/legal/chat route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns messages array', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
  });

  test('POST validates message input', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({ json: async () => ({}) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Message required');
  });

  test('POST validates message is string', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({ json: async () => ({ message: 123 }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Message required');
  });

  test('POST returns reply for valid message', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Hello, what can you help with?' }),
    });
    const data = await res.json();
    expect(data.reply).toBeDefined();
    expect(typeof data.reply).toBe('string');
  });

  test('POST recognizes order summary request (10/21)', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Tell me about the 10/21 order' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('October');
  });

  test('POST recognizes order summary request (order)', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'What does the order say?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('October');
  });

  test('POST recognizes next steps request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'What should I do next?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('Next Steps');
  });

  test('POST recognizes next steps request (what do i)', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'What do I need to do?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('Next Steps');
  });

  test('POST recognizes violation request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'What violations occurred in July?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('July');
  });

  test('POST recognizes violation keyword', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Were there any violations?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('Violation');
  });

  test('POST creates action for email draft request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Please draft email to Zack about the case' }),
    });
    const data = await res.json();
    expect(data.actionsCreated).toBe(true);
    expect(data.metadata?.actionId).toBeDefined();
  });

  test('POST creates action for create action request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Create action to file a motion' }),
    });
    const data = await res.json();
    expect(data.actionsCreated).toBe(true);
  });

  test('POST creates action for send to zack request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'Send to Zack a summary of the case' }),
    });
    const data = await res.json();
    expect(data.actionsCreated).toBe(true);
  });

  test('POST recognizes pending items request', async () => {
    // @ts-ignore - emulate Request
    const res = await POST({
      json: async () => ({ message: 'What items are pending?' }),
    });
    const data = await res.json();
    expect(data.reply).toContain('pending');
  });

  test('DELETE clears chat messages', async () => {
    const res = await DELETE();
    const data = await res.json();
    expect(data.cleared).toBeDefined();
    expect(typeof data.cleared).toBe('number');
    expect(data.cleared).toBe(5);
  });
});
