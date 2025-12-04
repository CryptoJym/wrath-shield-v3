import { POST } from '@/app/api/legal/chat/route';
import { NextResponse } from 'next/server';
import { jest } from '@jest/globals';

jest.mock('@/lib/legal/LegalPersonaSystem', () => ({
  detectLegalDomain: jest.fn(() => ({
    domain: 'family_law',
    confidence: 0.82,
    matchedKeywords: ['custody', 'utah'],
    suggestedJurisdiction: 'utah',
  })),
  transfigurePersona: jest.fn(async () => ({
    persona: {
      name: 'Family Law Attorney',
      domain: 'family_law',
      keyStatutes: ['stat1', 'stat2', 'stat3', 'stat4', 'stat5', 'stat6'],
    },
    enrichedSystemPrompt: 'FAMILY LAW PERSONA ACTIVATED',
    matterId: 'matter_test',
  })),
}));

jest.mock('@/lib/legal/store', () => ({
  saveChatMessage: jest.fn(),
  listChatMessages: jest.fn(() => []),
  clearChatMessages: jest.fn(),
  createPendingAction: jest.fn(() => ({ id: 'action_1' })),
  createNotification: jest.fn(),
  listLegalContextRequests: jest.fn(() => []),
}));

describe('Legal chat route', () => {
  const fetchMock = jest.fn();
  const detectLegalDomain = require('@/lib/legal/LegalPersonaSystem').detectLegalDomain as jest.Mock;
  const transfigurePersona = require('@/lib/legal/LegalPersonaSystem').transfigurePersona as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-openrouter';
    process.env.ZEP_API_KEY = 'test-zep';
    (global as any).fetch = fetchMock;
  });

  it('transfigures persona and returns metadata', async () => {
    fetchMock
      // Zep search
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ message: { content: 'd'.repeat(150) } }] }),
      })
      // Primary model success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'primary reply' } }] }),
      });

    const req = { json: async () => ({ message: 'Need custody help in Utah', history: [] }) } as any;
    const res = (await POST(req)) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(detectLegalDomain).toHaveBeenCalled();
    expect(transfigurePersona).toHaveBeenCalled();
    expect(body.metadata.persona).toBe('Family Law Attorney');
    expect(body.metadata.domain).toBe('family_law');
    expect(body.metadata.matterId).toBe('matter_test');
    expect(body.metadata.domainConfidence).toBeGreaterThan(0.3);
    expect(body.metadata.model).toBe('x-ai/grok-4-1-fast');
  });

  it('falls back to secondary model when primary fails', async () => {
    fetchMock
      // Zep search
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ message: { content: 'x'.repeat(150) } }] }),
      })
      // Primary model failure (network/LLM)
      .mockRejectedValueOnce(new Error('primary down'))
      // Fallback model success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'fallback reply' } }] }),
      });

    const req = { json: async () => ({ message: 'Another custody question', history: [] }) } as any;
    const res = (await POST(req)) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.metadata.model).toBe('openai/gpt-5.1');
    expect(body.reply).toContain('fallback reply');
  });
});
