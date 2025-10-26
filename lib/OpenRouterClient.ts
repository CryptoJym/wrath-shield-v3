/**
 * Wrath Shield v3 - OpenRouter API Client
 *
 * Provides coaching responses using OpenRouter's LLM routing service.
 *
 * Features:
 * - Sends prompts constructed by PromptBuilder to OpenRouter API
 * - Uses claude-3-5-sonnet-20241022 for coaching responses
 * - Parses and validates LLM responses
 * - Handles API errors with retries
 * - Server-side only enforcement
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import type { ConstructedPrompt, ChatMessage } from './PromptBuilder';

// Prevent client-side imports
ensureServerOnly('lib/OpenRouterClient');

/**
 * OpenRouter API response structure
 * Based on OpenAI-compatible chat completions format
 */
interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Parsed coaching response
 */
export interface CoachingResponse {
  content: string;
  model: string;
  finish_reason: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata: {
    request_id: string;
    timestamp: string;
  };
}

/**
 * OpenRouter client for coaching responses
 */
export class OpenRouterClient {
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'anthropic/claude-3.5-sonnet:beta';
  private readonly maxRetries = 2;
  private apiKey: string | null = null;

  /**
   * Get OpenRouter API key from config
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    const { getConfig } = await import('./config');
    const config = getConfig();

    if (!config.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    this.apiKey = config.OPENROUTER_API_KEY;
    return this.apiKey;
  }

  /**
   * Make request to OpenRouter API with retry logic
   *
   * @param prompt - Constructed prompt from PromptBuilder
   * @param retryCount - Current retry attempt (internal use)
   * @returns Parsed OpenRouter API response
   */
  private async request(
    prompt: ConstructedPrompt,
    retryCount: number = 0
  ): Promise<OpenRouterResponse> {
    const apiKey = await this.getApiKey();

    const requestBody = {
      model: this.model,
      messages: prompt.messages,
      temperature: prompt.temperature,
      max_tokens: prompt.max_tokens,
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://wrath-shield.com',
        'X-Title': 'Wrath Shield v3',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle rate limits and server errors with retry
    if (response.status === 429 || response.status >= 500) {
      if (retryCount < this.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(prompt, retryCount + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data as OpenRouterResponse;
  }

  /**
   * Get coaching response from LLM
   *
   * @param prompt - Constructed prompt from PromptBuilder
   * @returns Parsed coaching response with metadata
   * @throws Error if API call fails or response is invalid
   */
  async getCoachingResponse(prompt: ConstructedPrompt): Promise<CoachingResponse> {
    // Validate prompt structure
    if (!prompt.messages || prompt.messages.length === 0) {
      throw new Error('Invalid prompt: messages array is empty');
    }

    if (!prompt.messages[0] || prompt.messages[0].role !== 'system') {
      throw new Error('Invalid prompt: first message must be system prompt');
    }

    if (!prompt.messages[1] || prompt.messages[1].role !== 'user') {
      throw new Error('Invalid prompt: second message must be user message');
    }

    // Make API request
    const response = await this.request(prompt);

    // Validate response structure
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Invalid response: no choices returned');
    }

    const choice = response.choices[0];

    if (!choice.message || !choice.message.content) {
      throw new Error('Invalid response: no content in message');
    }

    // Construct parsed response
    return {
      content: choice.message.content.trim(),
      model: response.model,
      finish_reason: choice.finish_reason,
      usage: response.usage,
      metadata: {
        request_id: response.id,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate coaching response content
   *
   * Ensures the response is reasonable and not obviously malformed.
   *
   * @param response - Coaching response to validate
   * @returns True if response appears valid
   */
  validateResponse(response: CoachingResponse): boolean {
    // Check minimum content length (at least 50 characters for a meaningful response)
    if (response.content.length < 50) {
      return false;
    }

    // Check that content doesn't appear to be an error message
    const lowerContent = response.content.toLowerCase();
    const errorPatterns = [
      'error',
      'failed',
      'unable to',
      'cannot process',
      'invalid request',
    ];

    for (const pattern of errorPatterns) {
      if (lowerContent.includes(pattern)) {
        return false;
      }
    }

    // Check finish reason
    if (response.finish_reason !== 'stop' && response.finish_reason !== 'length') {
      return false;
    }

    return true;
  }
}

/**
 * Singleton instance for server-side use
 */
let clientInstance: OpenRouterClient | null = null;

/**
 * Get singleton OpenRouter client instance
 *
 * @returns Singleton OpenRouterClient
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!clientInstance) {
    clientInstance = new OpenRouterClient();
  }
  return clientInstance;
}
