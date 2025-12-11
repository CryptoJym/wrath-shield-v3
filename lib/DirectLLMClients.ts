import { ensureServerOnly } from './server-only-guard';
import type { ConstructedPrompt } from './PromptBuilder';
import { Ollama } from 'ollama';

ensureServerOnly('lib/DirectLLMClients');

export interface DirectChatResponse {
  content: string;
  model: string;
  finish_reason: string;
}

async function openaiChat(prompt: ConstructedPrompt, model: string): Promise<DirectChatResponse> {
  const key = process.env.OPENAI_API_KEY_DIRECT;
  if (!key) throw new Error('OPENAI_API_KEY_DIRECT not set');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: prompt.messages,
      temperature: prompt.temperature,
      // OpenAI GPT‑5.1 expects max_completion_tokens, not max_tokens.
      max_completion_tokens: prompt.max_tokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error ${resp.status}: ${await resp.text()}`);
  const data: any = await resp.json();
  const choice = data?.choices?.[0];
  if (!choice?.message?.content) throw new Error('OpenAI response missing content');
  return {
    content: choice.message.content,
    model: data.model,
    finish_reason: choice.finish_reason,
  };
}

async function xaiChat(prompt: ConstructedPrompt, model: string): Promise<DirectChatResponse> {
  const key = process.env.XAI_API_KEY_DIRECT || process.env.XAI_API_KEY;
  if (!key) throw new Error('XAI_API_KEY_DIRECT not set');
  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: prompt.messages,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`xAI API error ${resp.status}: ${await resp.text()}`);
  const data: any = await resp.json();
  const choice = data?.choices?.[0];
  if (!choice?.message?.content) throw new Error('xAI response missing content');
  return {
    content: choice.message.content,
    model: data.model,
    finish_reason: choice.finish_reason,
  };
}

/**
 * Extended response interface with cache usage stats
 */
export interface DirectChatResponseWithCache extends DirectChatResponse {
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cache_discount?: number;
}

/**
 * Check if model is a Claude model (supports prompt caching)
 */
function isClaudeModel(model: string): boolean {
  return model.toLowerCase().includes('claude') || model.toLowerCase().includes('anthropic');
}

/**
 * Apply cache_control to system message content for Anthropic prompt caching.
 * This marks large, stable content for caching (up to 5 min TTL).
 *
 * @see https://openrouter.ai/docs/guides/best-practices/prompt-caching
 */
function applyPromptCaching(messages: ConstructedPrompt['messages']): ConstructedPrompt['messages'] {
  return messages.map((msg, index) => {
    // Only cache system messages (most stable, largest content)
    if (msg.role === 'system' && typeof msg.content === 'string') {
      // Convert to multipart format with cache_control
      return {
        ...msg,
        content: [{
          type: 'text' as const,
          text: msg.content,
          cache_control: { type: 'ephemeral' as const },
        }],
      };
    }
    return msg;
  });
}

async function openRouterChat(prompt: ConstructedPrompt, model: string): Promise<DirectChatResponseWithCache> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set');

  // Apply prompt caching for Claude models when enabled
  const shouldCache = prompt.enablePromptCaching && isClaudeModel(model);
  const messages = shouldCache ? applyPromptCaching(prompt.messages) : prompt.messages;

  if (shouldCache) {
    console.log(`[DirectLLMClients] Prompt caching enabled for ${model}`);
  }

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://wrath-shield.com',
      'X-Title': 'Wrath Shield Link'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
      response_format: { type: 'json_object' },
      // Request usage stats to track cache effectiveness
      ...(shouldCache && { usage: { include: true } }),
    }),
  });
  if (!resp.ok) throw new Error(`OpenRouter API error ${resp.status}: ${await resp.text()}`);
  const data: any = await resp.json();
  const choice = data?.choices?.[0];
  if (!choice?.message?.content) throw new Error('OpenRouter response missing content');

  // Extract cache usage stats if available
  const cacheStats: Partial<DirectChatResponseWithCache> = {};
  if (data.usage?.cache_read_input_tokens) {
    cacheStats.cache_read_tokens = data.usage.cache_read_input_tokens;
    console.log(`[DirectLLMClients] Cache read: ${cacheStats.cache_read_tokens} tokens`);
  }
  if (data.usage?.cache_creation_input_tokens) {
    cacheStats.cache_write_tokens = data.usage.cache_creation_input_tokens;
    console.log(`[DirectLLMClients] Cache write: ${cacheStats.cache_write_tokens} tokens`);
  }
  if (data.cache_discount !== undefined) {
    cacheStats.cache_discount = data.cache_discount;
    console.log(`[DirectLLMClients] Cache discount: ${(cacheStats.cache_discount! * 100).toFixed(1)}%`);
  }

  return {
    content: choice.message.content,
    model: data.model || model,
    finish_reason: choice.finish_reason,
    ...cacheStats,
  };
}

/**
 * Extract string content from a message that may have multipart content
 * Handles both simple strings and ContentBlock arrays
 */
function extractStringContent(content: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>): string {
  if (typeof content === 'string') {
    return content;
  }
  // ContentBlock array - join all text parts
  return content.map(block => block.text).join('\n');
}

/**
 * Call Ollama API locally
 * Requires Ollama server running at OLLAMA_HOST (default: http://localhost:11434)
 */
async function ollamaChat(prompt: ConstructedPrompt, model: string): Promise<DirectChatResponse> {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';

  try {
    const ollama = new Ollama({ host });

    // Convert chat messages to Ollama format (Ollama requires string content)
    const messages = prompt.messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: extractStringContent(msg.content),
    }));

    // Set timeout for local inference (30 seconds default)
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '30000', 10);

    const response = await Promise.race([
      ollama.chat({
        model,
        messages,
        options: {
          temperature: prompt.temperature,
          num_predict: prompt.max_tokens,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ollama request timeout')), timeoutMs)
      ),
    ]);

    if (!response?.message?.content) {
      throw new Error('Ollama response missing content');
    }

    return {
      content: response.message.content,
      model: model,
      finish_reason: response.done ? 'stop' : 'length',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Ollama error: ${errorMessage}`);
  }
}

export const DirectLLMClients = {
  openaiChat,
  xaiChat,
  openRouterChat,
  ollamaChat,
};
