/**
 * Personalization Detection and Neutral Stance Tests
 */

import {
  detectPersonalization,
  buildSecondAgreementPrompt,
  generateNeutralStanceLines,
} from '@/lib/personalization';

jest.mock('@/lib/server-only-guard', () => ({ ensureServerOnly: jest.fn() }));
jest.mock('@/lib/config', () => ({ getConfig: jest.fn(() => ({ OPENROUTER_API_KEY: 'test-openrouter-key' })) }));

// Mock global fetch used by OpenRouterClient
global.fetch = jest.fn();

describe('personalization detection', () => {
  it('detects personalization cues and computes density/severity', () => {
    const text = 'I feel like this is probably wrong, but in my opinion it might work for me.';
    const result = detectPersonalization(text);

    expect(result.hasPersonalization).toBe(true);
    expect(result.cues.length).toBeGreaterThanOrEqual(2);
    expect(result.density).toBeGreaterThan(0);
    expect(result.averageSeverity).toBeGreaterThan(0);
  });
});

describe('SECOND_AGREEMENT_CHECK prompt', () => {
  it('builds a server-only prompt with system and user messages', () => {
    const cues = [
      { phrase: 'I feel', snippet: '...I feel like...', severity: 2 as const, position: 5 },
    ];
    const prompt = buildSecondAgreementPrompt('I feel like we should wait.', cues);

    expect(prompt.messages[0].role).toBe('system');
    expect(prompt.messages[1].role).toBe('user');
    expect(prompt.temperature).toBeLessThanOrEqual(0.3);
  });
});

describe('neutral stance generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls OpenRouter and returns up to 5 trimmed lines', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-xyz',
        model: 'anthropic/claude-3.5-sonnet:beta',
        choices: [
          {
            index: 0,
            message: { role: 'assistant' as const, content: '- One.\n- Two.\n- Three.' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 80, completion_tokens: 60, total_tokens: 140 },
      }),
    });

    const { lines, cues } = await generateNeutralStanceLines(
      'I feel like this might not be the best approach for me.'
    );

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(cues.length).toBeGreaterThanOrEqual(1);
  });
});

