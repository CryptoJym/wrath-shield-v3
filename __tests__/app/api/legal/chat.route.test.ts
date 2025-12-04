import { GET, POST, DELETE } from '@/app/api/legal/chat/route';
import { jest } from '@jest/globals';

jest.mock('@/lib/legal/store', () => ({
  saveChatMessage: jest.fn((input) => ({
    id: 'msg-id',
    role: input.role,
    content: input.content,
    metadata: input.metadata || null,
    created_at: new Date().toISOString(),
  })),
  listChatMessages: jest.fn(() => []),
  clearChatMessages: jest.fn(() => 3),
  createPendingAction: jest.fn((input) => ({ id: 'action-1', ...input })),
  createNotification: jest.fn(),
  listLegalContextRequests: jest.fn(() => []),
}));

jest.mock('@/lib/legal/LegalPersonaSystem', () => ({
  detectLegalDomain: jest.fn(() => ({
    domain: 'family_law',
    confidence: 0.9,
    matchedKeywords: ['custody'],
    suggestedJurisdiction: 'utah',
  })),
  transfigurePersona: jest.fn(async () => ({
    persona: {
      name: 'Family Law Attorney',
      domain: 'family_law',
      keyStatutes: ['s1', 's2', 's3', 's4', 's5'],
    },
    enrichedSystemPrompt: 'FAMILY LAW PERSONA ACTIVATED',
    matterId: 'matter-test',
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(() => ''),
}));

describe('/api/legal/chat route (new persona flow)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-openrouter';
    process.env.ZEP_API_KEY = 'test-zep';
    (global as any).fetch = fetchMock;
  });

  it('returns messages array on GET', async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it('validates missing message', async () => {
    // @ts-ignore
    const res = await POST({ json: async () => ({}) });
    expect(res.status).toBe(400);
  });

  it('transfigures persona and returns metadata', async () => {
    fetchMock
      // Zep search
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ message: { content: 'd'.repeat(150) } }] }) })
      // Primary LLM success
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'persona reply' } }] }) });

    const res = await POST({ json: async () => ({ message: 'Help with custody in Utah', history: [] }) } as any);
    const body = await res.json();

    expect(body.reply).toContain('persona reply');
    expect(body.metadata.persona).toBe('Family Law Attorney');
    expect(body.metadata.domain).toBe('family_law');
    expect(body.metadata.matterId).toBe('matter-test');
  });

  it('falls back to secondary model when primary fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) }) // Zep search
      .mockRejectedValueOnce(new Error('primary down')) // Primary
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'fallback ok' } }] }) });

    const res = await POST({ json: async () => ({ message: 'fallback path', history: [] }) } as any);
    const body = await res.json();

    expect(body.metadata.model).toBe('openai/gpt-5.1');
    expect(body.reply).toContain('fallback');
  });

  it('creates pending action when drafting email', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'reply' } }] }) });

    const res = await POST({ json: async () => ({ message: 'draft email to Zack about custody' }) } as any);
    const body = await res.json();
    expect(body.actionsCreated).toBe(true);
    expect(body.metadata.actionId).toBeDefined();
  });

  it('clears chat messages on DELETE', async () => {
    const res = await DELETE();
    const body = await res.json();
    expect(body.cleared).toBe(3);
  });
});
