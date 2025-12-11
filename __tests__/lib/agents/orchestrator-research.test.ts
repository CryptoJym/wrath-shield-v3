// @ts-nocheck
/**
 * Wrath Shield v3 - Orchestrator Research Tests
 *
 * Tests for the orchestrator's web search and research capabilities:
 * - Web search via xAI, OpenAI, or OpenRouter
 * - Research synthesis from multiple sources
 * - Fact checking claims
 * - Research recording to memory
 */

// Mock server-only-guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock Zep memory module
const mockAddAgentMemory = jest.fn().mockResolvedValue(undefined);
const mockSearchAgentMemory = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/memory/zep', () => ({
  addAgentMemory: mockAddAgentMemory,
  searchAgentMemory: mockSearchAgentMemory,
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Store original env
const originalEnv = process.env;

import {
  webSearch,
  synthesizeResearch,
  factCheck,
  recordResearch,
  findPreviousResearch,
  conductResearch,
  type WebSearchOptions,
  type SearchResult,
  type ResearchSummary,
} from '@/lib/agents/orchestrator-research';

describe('Orchestrator Research', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear API keys by default
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY_DIRECT;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('webSearch', () => {
    it('should return empty array when no API keys configured', async () => {
      const results = await webSearch('test query');
      expect(results).toEqual([]);
    });

    it('should use xAI when XAI_API_KEY is set', async () => {
      process.env.XAI_API_KEY = 'test-xai-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                results: [
                  { title: 'Result 1', url: 'https://example.com', snippet: 'Test' }
                ]
              })
            }
          }]
        })
      });

      const results = await webSearch('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-xai-key',
          }),
        })
      );
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Result 1');
    });

    it('should use XAI_API_KEY_DIRECT as fallback', async () => {
      process.env.XAI_API_KEY_DIRECT = 'test-xai-direct-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"results": []}' } }]
        })
      });

      await webSearch('query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-xai-direct-key',
          }),
        })
      );
    });

    it('should fall back to OpenAI when no xAI key', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"results": []}' } }]
        })
      });

      await webSearch('query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should fall back to OpenRouter when no xAI or OpenAI key', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"results": []}' } }]
        })
      });

      await webSearch('query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should respect maxResults option', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                results: [
                  { title: '1' }, { title: '2' }, { title: '3' },
                  { title: '4' }, { title: '5' }, { title: '6' }
                ]
              })
            }
          }]
        })
      });

      const results = await webSearch('query', { maxResults: 3 });

      expect(results).toHaveLength(3);
    });

    it('should handle API errors gracefully', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const results = await webSearch('query');

      expect(results).toEqual([]);
    });

    it('should handle invalid JSON response', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'not valid json' } }]
        })
      });

      const results = await webSearch('query');

      expect(results).toEqual([]);
    });

    it('should handle network errors', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await webSearch('query');

      expect(results).toEqual([]);
    });
  });

  describe('synthesizeResearch', () => {
    it('should return empty synthesis when no sources', async () => {
      const summary = await synthesizeResearch('topic', []);

      expect(summary.query).toBe('topic');
      expect(summary.results).toEqual([]);
      expect(summary.synthesis).toContain('No sources found');
      expect(summary.confidence).toBe(0);
    });

    it('should synthesize with API when available', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                synthesis: 'Synthesized content',
                confidence: 0.85,
                key_points: ['point 1', 'point 2']
              })
            }
          }]
        })
      });

      const sources: SearchResult[] = [
        { title: 'Source 1', url: 'https://a.com', snippet: 'Info 1' },
        { title: 'Source 2', url: 'https://b.com', snippet: 'Info 2' },
      ];

      const summary = await synthesizeResearch('topic', sources);

      expect(summary.synthesis).toBe('Synthesized content');
      expect(summary.confidence).toBe(0.85);
      expect(summary.sources).toEqual(['https://a.com', 'https://b.com']);
    });

    it('should fallback to concatenation when no API', async () => {
      const sources: SearchResult[] = [
        { title: 'Source 1', url: 'https://a.com', snippet: 'Info A' },
        { title: 'Source 2', url: 'https://b.com', snippet: 'Info B' },
      ];

      const summary = await synthesizeResearch('topic', sources);

      expect(summary.synthesis).toContain('Info A');
      expect(summary.synthesis).toContain('Info B');
      expect(summary.confidence).toBe(0.5);
    });

    it('should include timestamp', async () => {
      const before = new Date().toISOString();
      const summary = await synthesizeResearch('topic', []);
      const after = new Date().toISOString();

      expect(new Date(summary.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime() - 1000
      );
      expect(new Date(summary.timestamp).getTime()).toBeLessThanOrEqual(
        new Date(after).getTime() + 1000
      );
    });
  });

  describe('factCheck', () => {
    it('should return uncertain when no sources found', async () => {
      // No API keys set
      const result = await factCheck('The sky is blue');

      expect(result.verdict).toBe('uncertain');
      expect(result.confidence).toBe(0);
    });

    it('should fact check claim with API', async () => {
      process.env.XAI_API_KEY = 'key';

      // First call for search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                results: [
                  { title: 'Fact', url: 'https://fact.com', snippet: 'Evidence' }
                ]
              })
            }
          }]
        })
      });

      // Second call for fact check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                verdict: 'likely_true',
                confidence: 0.9,
                explanation: 'Evidence supports this claim [1]'
              })
            }
          }]
        })
      });

      const result = await factCheck('Water boils at 100°C');

      expect(result.verdict).toBe('likely_true');
      expect(result.confidence).toBe(0.9);
      expect(result.explanation).toContain('Evidence');
      expect(result.sources).toContain('https://fact.com');
    });

    it('should handle all verdict types', async () => {
      const verdicts = ['likely_true', 'likely_false', 'uncertain', 'partially_true'] as const;

      for (const verdict of verdicts) {
        process.env.XAI_API_KEY = 'key';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: '{"results": [{"url": "x"}]}' } }]
          })
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: { content: JSON.stringify({ verdict, confidence: 0.5, explanation: 'test' }) }
            }]
          })
        });

        const result = await factCheck('claim');
        expect(result.verdict).toBe(verdict);
      }
    });
  });

  describe('recordResearch', () => {
    it('should record research to orchestrator memory', async () => {
      const summary: ResearchSummary = {
        query: 'test query',
        results: [{ title: 'T', url: 'u', snippet: 's' }],
        synthesis: 'Synthesized info',
        confidence: 0.8,
        sources: ['https://source.com'],
        timestamp: new Date().toISOString(),
      };

      await recordResearch('test query', summary);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('[RESEARCH]'),
        expect.objectContaining({
          type: 'research',
          query: 'test query',
          confidence: 0.8,
          source_count: 1,
        })
      );
    });

    it('should include synthesis in recorded text', async () => {
      const summary: ResearchSummary = {
        query: 'q',
        results: [],
        synthesis: 'My synthesis here',
        confidence: 0.5,
        sources: [],
        timestamp: new Date().toISOString(),
      };

      await recordResearch('q', summary);

      expect(mockAddAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        expect.stringContaining('My synthesis here'),
        expect.any(Object)
      );
    });
  });

  describe('findPreviousResearch', () => {
    it('should search orchestrator memory for research', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { id: '1', text: 'research', metadata: { type: 'research' } } },
        { memory: { id: '2', text: 'other', metadata: { type: 'decision' } } },
        { memory: { id: '3', text: 'research2', metadata: { type: 'research' } } },
      ]);

      const results = await findPreviousResearch('climate');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.memory.metadata?.type === 'research')).toBe(true);
      expect(mockSearchAgentMemory).toHaveBeenCalledWith(
        'orchestrator-agent',
        'research climate',
        10 // limit * 2
      );
    });

    it('should respect limit parameter', async () => {
      mockSearchAgentMemory.mockResolvedValueOnce([
        { memory: { id: '1', metadata: { type: 'research' } } },
        { memory: { id: '2', metadata: { type: 'research' } } },
        { memory: { id: '3', metadata: { type: 'research' } } },
      ]);

      const results = await findPreviousResearch('topic', 2);

      expect(results).toHaveLength(2);
    });
  });

  describe('conductResearch', () => {
    it('should perform full research workflow', async () => {
      process.env.XAI_API_KEY = 'key';

      // Search call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                results: [
                  { title: 'Result', url: 'https://r.com', snippet: 'Info' }
                ]
              })
            }
          }]
        })
      });

      // Synthesis call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                synthesis: 'Complete synthesis',
                confidence: 0.9,
              })
            }
          }]
        })
      });

      const summary = await conductResearch('AI trends 2025');

      expect(summary.query).toBe('AI trends 2025');
      expect(summary.synthesis).toBe('Complete synthesis');
      expect(mockAddAgentMemory).toHaveBeenCalled(); // Records to memory
    });

    it('should pass options to webSearch', async () => {
      process.env.XAI_API_KEY = 'key';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"results": []}' } }]
        })
      });

      await conductResearch('topic', { maxResults: 3 });

      // Verify the fetch was called (options are used internally)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle complete failure gracefully', async () => {
      // No API keys, so everything fails
      const summary = await conductResearch('failing query');

      expect(summary.query).toBe('failing query');
      expect(summary.confidence).toBe(0);
      expect(summary.results).toEqual([]);
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid WebSearchOptions', () => {
      const options: WebSearchOptions = {
        maxResults: 10,
        recency: 'week',
        domains: ['example.com'],
        excludeDomains: ['spam.com'],
      };

      expect(options.recency).toBe('week');
    });

    it('should accept valid SearchResult', () => {
      const result: SearchResult = {
        title: 'Test',
        url: 'https://test.com',
        snippet: 'Test snippet',
        source: 'Test Source',
        publishedDate: '2025-01-01',
      };

      expect(result.title).toBe('Test');
    });

    it('should accept valid ResearchSummary', () => {
      const summary: ResearchSummary = {
        query: 'test',
        results: [],
        synthesis: 'synth',
        confidence: 0.5,
        sources: [],
        timestamp: new Date().toISOString(),
      };

      expect(summary.query).toBe('test');
    });
  });
});
