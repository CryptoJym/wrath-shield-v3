/**
 * Wrath Shield v3 - OpenRouter Client Tests
 *
 * Tests for OpenRouter API integration and response parsing
 */

import { OpenRouterClient, getOpenRouterClient } from '@/lib/OpenRouterClient';
import type { ConstructedPrompt, CoachingResponse } from '@/lib/OpenRouterClient';

// Mock dependencies
jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(() => ({
    OPENROUTER_API_KEY: 'test-openrouter-key',
  })),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;

  beforeEach(() => {
    client = new OpenRouterClient();
    jest.clearAllMocks();
  });

  const mockPrompt: ConstructedPrompt = {
    messages: [
      {
        role: 'system',
        content: 'You are a relentless confidence coach.',
      },
      {
        role: 'user',
        content: '# Daily Coaching Brief - 2025-01-31\n\n**WHOOP Metrics:**\n- Recovery: 78% [HIGH]',
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
    metadata: {
      date: '2025-01-31',
      has_whoop_data: true,
      has_manipulations: false,
      wrath_deployed: false,
      memory_count: 0,
      anchor_count: 0,
    },
  };

  const mockOpenRouterResponse = {
    id: 'chatcmpl-123',
    model: 'anthropic/claude-3.5-sonnet:beta',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content:
            'Excellent recovery at 78% puts you in prime position for growth. Your body is well-rested and ready for challenge. Use this high recovery wisely - it\'s your green light for pushing boundaries while maintaining assertive boundaries.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 150,
      completion_tokens: 45,
      total_tokens: 195,
    },
  };

  describe('API Integration', () => {
    it('should make successful API call with correct headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      await client.getCoachingResponse(mockPrompt);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-openrouter-key',
            'HTTP-Referer': 'https://wrath-shield.com',
            'X-Title': 'Wrath Shield v3',
          },
        })
      );
    });

    it('should send correct request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      await client.getCoachingResponse(mockPrompt);

      const requestBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );

      expect(requestBody).toEqual({
        model: 'anthropic/claude-3.5-sonnet:beta',
        messages: mockPrompt.messages,
        temperature: 0.7,
        max_tokens: 500,
      });
    });

    it('should parse response correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe(mockOpenRouterResponse.choices[0].message.content);
      expect(response.model).toBe('anthropic/claude-3.5-sonnet:beta');
      expect(response.finish_reason).toBe('stop');
      expect(response.usage).toEqual(mockOpenRouterResponse.usage);
      expect(response.metadata.request_id).toBe('chatcmpl-123');
      expect(response.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should trim whitespace from response content', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: '  \n  This has whitespace.  \n  ',
              },
            },
          ],
        }),
      });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe('This has whitespace.');
    });
  });

  describe('Error Handling', () => {
    it('should throw error if API key not configured', async () => {
      const { getConfig } = require('@/lib/config');
      getConfig.mockReturnValueOnce({ OPENROUTER_API_KEY: undefined });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'OPENROUTER_API_KEY not configured'
      );
    });

    it('should throw error on 400 bad request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid request body',
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'OpenRouter API error (400): Invalid request body'
      );
    });

    it('should throw error on 401 unauthorized', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'OpenRouter API error (401): Invalid API key'
      );
    });

    it('should throw error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'Network error'
      );
    });

    it('should throw error if response has no choices', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [],
        }),
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'Invalid response: no choices returned'
      );
    });

    it('should throw error if choice has no content', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant' as const,
                content: '',
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'Invalid response: no content in message'
      );
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 rate limit with exponential backoff', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        });

      const startTime = Date.now();
      const response = await client.getCoachingResponse(mockPrompt);
      const endTime = Date.now();

      expect(response.content).toBe(mockOpenRouterResponse.choices[0].message.content);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      // Should wait ~1 second for first retry
      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
    });

    it('should retry on 500 server error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe(mockOpenRouterResponse.choices[0].message.content);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 service unavailable', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe(mockOpenRouterResponse.choices[0].message.content);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'OpenRouter API error (500): Server error'
      );

      // Initial attempt + 2 retries = 3 total calls
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 400 bad request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      });

      await expect(client.getCoachingResponse(mockPrompt)).rejects.toThrow(
        'OpenRouter API error (400): Bad request'
      );

      // Should not retry
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Prompt Validation', () => {
    it('should reject empty messages array', async () => {
      const invalidPrompt: ConstructedPrompt = {
        ...mockPrompt,
        messages: [],
      };

      await expect(client.getCoachingResponse(invalidPrompt)).rejects.toThrow(
        'Invalid prompt: messages array is empty'
      );
    });

    it('should reject prompt without system message', async () => {
      const invalidPrompt: ConstructedPrompt = {
        ...mockPrompt,
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
      };

      await expect(client.getCoachingResponse(invalidPrompt)).rejects.toThrow(
        'Invalid prompt: first message must be system prompt'
      );
    });

    it('should reject prompt without user message', async () => {
      const invalidPrompt: ConstructedPrompt = {
        ...mockPrompt,
        messages: [
          {
            role: 'system',
            content: 'test',
          },
        ],
      };

      await expect(client.getCoachingResponse(invalidPrompt)).rejects.toThrow(
        'Invalid prompt: second message must be user message'
      );
    });
  });

  describe('Response Validation', () => {
    const validResponse: CoachingResponse = {
      content:
        'Excellent recovery at 78% puts you in prime position for growth. Your body is well-rested and ready for challenge.',
      model: 'anthropic/claude-3.5-sonnet:beta',
      finish_reason: 'stop',
      metadata: {
        request_id: 'chatcmpl-123',
        timestamp: '2025-01-31T10:00:00.000Z',
      },
    };

    it('should validate valid response', () => {
      const isValid = client.validateResponse(validResponse);
      expect(isValid).toBe(true);
    });

    it('should reject response that is too short', () => {
      const shortResponse: CoachingResponse = {
        ...validResponse,
        content: 'Too short.',
      };

      const isValid = client.validateResponse(shortResponse);
      expect(isValid).toBe(false);
    });

    it('should reject response with error keywords', () => {
      const errorResponses = [
        'Error occurred while processing request.',
        'Failed to generate response.',
        'Unable to provide coaching.',
        'Cannot process this request.',
        'Invalid request parameters.',
      ];

      errorResponses.forEach((content) => {
        const errorResponse: CoachingResponse = {
          ...validResponse,
          content,
        };

        const isValid = client.validateResponse(errorResponse);
        expect(isValid).toBe(false);
      });
    });

    it('should reject response with invalid finish_reason', () => {
      const invalidResponse: CoachingResponse = {
        ...validResponse,
        finish_reason: 'content_filter',
      };

      const isValid = client.validateResponse(invalidResponse);
      expect(isValid).toBe(false);
    });

    it('should accept response with finish_reason=length', () => {
      const lengthResponse: CoachingResponse = {
        ...validResponse,
        finish_reason: 'length',
      };

      const isValid = client.validateResponse(lengthResponse);
      expect(isValid).toBe(true);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getOpenRouterClient();
      const instance2 = getOpenRouterClient();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle response without usage data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          usage: undefined,
        }),
      });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.usage).toBeUndefined();
    });

    it('should handle very long response content', async () => {
      const longContent = 'A'.repeat(5000);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: longContent,
              },
            },
          ],
        }),
      });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe(longContent);
    });

    it('should handle special characters in response', async () => {
      const specialContent = 'Recovery: 78% ✓\nWrath deployed! 🔥\n"Boundaries" matter.';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: specialContent,
              },
            },
          ],
        }),
      });

      const response = await client.getCoachingResponse(mockPrompt);

      expect(response.content).toBe(specialContent);
    });
  });
});
