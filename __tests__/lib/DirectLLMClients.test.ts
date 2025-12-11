// @ts-nocheck
/**
 * Wrath Shield v3 - DirectLLMClients Tests
 *
 * Tests for direct LLM API clients (OpenAI, xAI, OpenRouter, Ollama)
 * with prompt caching support for Claude models.
 */

import { DirectLLMClients } from '@/lib/DirectLLMClients';
import type { ConstructedPrompt } from '@/lib/PromptBuilder';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Ollama
jest.mock('ollama', () => ({
  Ollama: jest.fn().mockImplementation(() => ({
    chat: jest.fn(),
  })),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

describe('DirectLLMClients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.OPENAI_API_KEY_DIRECT;
    delete process.env.XAI_API_KEY_DIRECT;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_HOST;
  });

  const mockPrompt: ConstructedPrompt = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  };

  describe('openaiChat', () => {
    it('should throw error when API key not set', async () => {
      await expect(
        DirectLLMClients.openaiChat(mockPrompt, 'gpt-4')
      ).rejects.toThrow('OPENAI_API_KEY_DIRECT not set');
    });

    it('should make successful API call', async () => {
      process.env.OPENAI_API_KEY_DIRECT = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Hello! How can I help you?' },
            finish_reason: 'stop',
          }],
          model: 'gpt-4',
        }),
      });

      const result = await DirectLLMClients.openaiChat(mockPrompt, 'gpt-4');

      expect(result).toEqual({
        content: 'Hello! How can I help you?',
        model: 'gpt-4',
        finish_reason: 'stop',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          },
        })
      );
    });

    it('should handle API errors', async () => {
      process.env.OPENAI_API_KEY_DIRECT = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(
        DirectLLMClients.openaiChat(mockPrompt, 'gpt-4')
      ).rejects.toThrow('OpenAI API error 429: Rate limit exceeded');
    });

    it('should handle missing content in response', async () => {
      process.env.OPENAI_API_KEY_DIRECT = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{}] }),
      });

      await expect(
        DirectLLMClients.openaiChat(mockPrompt, 'gpt-4')
      ).rejects.toThrow('OpenAI response missing content');
    });

    it('should use max_completion_tokens for newer models', async () => {
      process.env.OPENAI_API_KEY_DIRECT = 'test-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
            finish_reason: 'stop',
          }],
          model: 'gpt-5.1',
        }),
      });

      await DirectLLMClients.openaiChat(mockPrompt, 'gpt-5.1');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.max_completion_tokens).toBe(1000);
      expect(callBody.max_tokens).toBeUndefined();
    });
  });

  describe('xaiChat', () => {
    it('should throw error when API key not set', async () => {
      await expect(
        DirectLLMClients.xaiChat(mockPrompt, 'grok-2')
      ).rejects.toThrow('XAI_API_KEY_DIRECT not set');
    });

    it('should use XAI_API_KEY_DIRECT first, then fallback to XAI_API_KEY', async () => {
      process.env.XAI_API_KEY = 'fallback-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Grok response' },
            finish_reason: 'stop',
          }],
          model: 'grok-2',
        }),
      });

      await DirectLLMClients.xaiChat(mockPrompt, 'grok-2');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fallback-key',
          }),
        })
      );
    });

    it('should make successful xAI API call', async () => {
      process.env.XAI_API_KEY_DIRECT = 'test-xai-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Grok says hello!' },
            finish_reason: 'stop',
          }],
          model: 'grok-2',
        }),
      });

      const result = await DirectLLMClients.xaiChat(mockPrompt, 'grok-2');

      expect(result).toEqual({
        content: 'Grok says hello!',
        model: 'grok-2',
        finish_reason: 'stop',
      });
    });

    it('should handle xAI API errors', async () => {
      process.env.XAI_API_KEY_DIRECT = 'test-xai-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(
        DirectLLMClients.xaiChat(mockPrompt, 'grok-2')
      ).rejects.toThrow('xAI API error 500: Internal server error');
    });
  });

  describe('openRouterChat', () => {
    it('should throw error when API key not set', async () => {
      await expect(
        DirectLLMClients.openRouterChat(mockPrompt, 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('OPENROUTER_API_KEY not set');
    });

    it('should make successful API call', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'OpenRouter response' },
            finish_reason: 'stop',
          }],
          model: 'anthropic/claude-3.5-sonnet',
        }),
      });

      const result = await DirectLLMClients.openRouterChat(mockPrompt, 'anthropic/claude-3.5-sonnet');

      expect(result).toEqual({
        content: 'OpenRouter response',
        model: 'anthropic/claude-3.5-sonnet',
        finish_reason: 'stop',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            'HTTP-Referer': 'https://wrath-shield.com',
            'X-Title': 'Wrath Shield Link',
          }),
        })
      );
    });

    it('should apply prompt caching for Claude models when enabled', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const promptWithCaching: ConstructedPrompt = {
        ...mockPrompt,
        enablePromptCaching: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Cached response' },
            finish_reason: 'stop',
          }],
          model: 'anthropic/claude-3.5-sonnet',
          usage: {
            cache_read_input_tokens: 500,
            cache_creation_input_tokens: 100,
          },
          cache_discount: 0.9,
        }),
      });

      const result = await DirectLLMClients.openRouterChat(promptWithCaching, 'anthropic/claude-3.5-sonnet');

      expect(result.cache_read_tokens).toBe(500);
      expect(result.cache_write_tokens).toBe(100);
      expect(result.cache_discount).toBe(0.9);

      // Verify system message was converted for caching
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toEqual([{
        type: 'text',
        text: 'You are a helpful assistant.',
        cache_control: { type: 'ephemeral' },
      }]);
    });

    it('should not apply prompt caching for non-Claude models', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const promptWithCaching: ConstructedPrompt = {
        ...mockPrompt,
        enablePromptCaching: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
            finish_reason: 'stop',
          }],
          model: 'openai/gpt-4',
        }),
      });

      await DirectLLMClients.openRouterChat(promptWithCaching, 'openai/gpt-4');

      // Verify system message was NOT converted for caching
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should handle OpenRouter API errors', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        text: async () => 'Insufficient credits',
      });

      await expect(
        DirectLLMClients.openRouterChat(mockPrompt, 'anthropic/claude-3.5-sonnet')
      ).rejects.toThrow('OpenRouter API error 402: Insufficient credits');
    });
  });

  describe('ollamaChat', () => {
    const { Ollama } = require('ollama');

    it('should make successful Ollama call', async () => {
      const mockOllamaChat = jest.fn().mockResolvedValue({
        message: { content: 'Local Ollama response' },
        done: true,
      });

      Ollama.mockImplementation(() => ({
        chat: mockOllamaChat,
      }));

      const result = await DirectLLMClients.ollamaChat(mockPrompt, 'llama3.2');

      expect(result).toEqual({
        content: 'Local Ollama response',
        model: 'llama3.2',
        finish_reason: 'stop',
      });
    });

    it('should use custom OLLAMA_HOST', async () => {
      process.env.OLLAMA_HOST = 'http://custom:11434';

      const mockOllamaChat = jest.fn().mockResolvedValue({
        message: { content: 'Response' },
        done: true,
      });

      Ollama.mockImplementation(() => ({
        chat: mockOllamaChat,
      }));

      await DirectLLMClients.ollamaChat(mockPrompt, 'llama3.2');

      expect(Ollama).toHaveBeenCalledWith({ host: 'http://custom:11434' });
    });

    it('should handle timeout', async () => {
      process.env.OLLAMA_TIMEOUT_MS = '100';

      const mockOllamaChat = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      Ollama.mockImplementation(() => ({
        chat: mockOllamaChat,
      }));

      await expect(
        DirectLLMClients.ollamaChat(mockPrompt, 'llama3.2')
      ).rejects.toThrow('Ollama error: Ollama request timeout');
    });

    it('should handle missing content in response', async () => {
      const mockOllamaChat = jest.fn().mockResolvedValue({
        message: {},
        done: true,
      });

      Ollama.mockImplementation(() => ({
        chat: mockOllamaChat,
      }));

      await expect(
        DirectLLMClients.ollamaChat(mockPrompt, 'llama3.2')
      ).rejects.toThrow('Ollama error: Ollama response missing content');
    });

    it('should handle Ollama connection errors', async () => {
      Ollama.mockImplementation(() => ({
        chat: jest.fn().mockRejectedValue(new Error('Connection refused')),
      }));

      await expect(
        DirectLLMClients.ollamaChat(mockPrompt, 'llama3.2')
      ).rejects.toThrow('Ollama error: Connection refused');
    });

    it('should convert multipart content to string', async () => {
      const multipartPrompt: ConstructedPrompt = {
        messages: [
          {
            role: 'system',
            content: [
              { type: 'text', text: 'Part 1' },
              { type: 'text', text: 'Part 2' },
            ] as any,
          },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      };

      const mockOllamaChat = jest.fn().mockResolvedValue({
        message: { content: 'Response' },
        done: true,
      });

      Ollama.mockImplementation(() => ({
        chat: mockOllamaChat,
      }));

      await DirectLLMClients.ollamaChat(multipartPrompt, 'llama3.2');

      expect(mockOllamaChat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'Part 1\nPart 2' },
            { role: 'user', content: 'Hello' },
          ],
        })
      );
    });
  });
});
