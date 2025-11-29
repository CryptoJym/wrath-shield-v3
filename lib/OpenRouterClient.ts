/**
 * Wrath Shield v3 - OpenRouter API Client
 *
 * Provides coaching responses using OpenRouter's LLM routing service.
 * Now integrated with AgentInvoker for Life OS config routing.
 *
 * Features:
 * - Delegates to AgentInvoker when agentId is provided (Life OS routing)
 * - Falls back to direct OpenRouter calls for backward compatibility
 * - Parses and validates LLM responses
 * - Handles API errors with retries
 * - Server-side only enforcement
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import type { ConstructedPrompt, ChatMessage } from './PromptBuilder';
import { invokeAgent, type AgentResponse } from './agents/AgentInvoker';
import { AGENT_PROVIDER_MAP } from './agents/types';

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
    escalationLevel?: 'CRITICAL' | 'PROPOSE' | 'AUTO_EXECUTE';
    detectedDomain?: string;
  };
}

/**
 * OpenRouter client for coaching responses
 * Now with Life OS AgentInvoker integration
 */
export class OpenRouterClient {
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = AGENT_PROVIDER_MAP.default.model;
  private readonly maxRetries = 2;
  private apiKey: string | null = null;
  private agentId: string | null = null;

  /**
   * Configure this client to use a specific agent (enables Life OS routing)
   */
  setAgentId(agentId: string): this {
    this.agentId = agentId;
    return this;
  }

  /**
   * Get OpenRouter API key from config
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    const { getConfig } = await import('./config');
    const config = getConfig();

    if (!config.openrouter?.apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    this.apiKey = config.openrouter.apiKey;
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
      model: this.defaultModel,
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
   * If an agentId is set, delegates to AgentInvoker for Life OS routing.
   * Otherwise falls back to direct OpenRouter API call.
   *
   * @param prompt - Constructed prompt from PromptBuilder
   * @param domainId - Optional domain ID for Life OS context
   * @returns Parsed coaching response with metadata
   * @throws Error if API call fails or response is invalid
   */
  async getCoachingResponse(prompt: ConstructedPrompt, domainId?: string): Promise<CoachingResponse> {
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

    // If agentId is set, use AgentInvoker for Life OS routing
    if (this.agentId) {
      return this.invokeViaLifeOS(prompt, domainId);
    }

    // Legacy path: direct OpenRouter call
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
   * Invoke via AgentInvoker (Life OS routing)
   */
  private async invokeViaLifeOS(prompt: ConstructedPrompt, domainId?: string): Promise<CoachingResponse> {
    const userMessage = prompt.messages.find(m => m.role === 'user')?.content || '';

    const response = await invokeAgent({
      agentId: this.agentId!,
      userMessage,
      context: domainId ? { domainId } : undefined,
    });

    return {
      content: response.content,
      model: response.model,
      finish_reason: 'stop',
      usage: {
        prompt_tokens: response.tokensUsed.prompt,
        completion_tokens: response.tokensUsed.completion,
        total_tokens: response.tokensUsed.total,
      },
      metadata: {
        request_id: response.requestId,
        timestamp: new Date().toISOString(),
        escalationLevel: response.escalationLevel,
        detectedDomain: response.detectedDomain,
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
