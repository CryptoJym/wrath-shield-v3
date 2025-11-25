/**
 * Minimal OpenRouter client to satisfy coaching tests.
 */
import { getConfig } from './config';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type ConstructedPrompt = { messages: ChatMessage[]; temperature: number; max_tokens: number };

export type CoachingResponse = {
  content: string;
  model: string;
  finish_reason: string;
  usage: any;
  metadata: { request_id: string; timestamp: string };
};

export class OpenRouterClient {
  private endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  private model = 'anthropic/claude-3.5-sonnet:beta';

  private assertPrompt(prompt: ConstructedPrompt) {
    if (!prompt.messages || prompt.messages.length === 0) throw new Error('Invalid prompt: messages array is empty');
    if (prompt.messages[0].role !== 'system')
      throw new Error('Invalid prompt: first message must be system prompt');
    if (prompt.messages.length < 2 || prompt.messages[1].role !== 'user')
      throw new Error('Invalid prompt: second message must be user message');
  }

  async getCoachingResponse(prompt: ConstructedPrompt): Promise<CoachingResponse> {
    const cfg = safeGetConfig();
    // If config explicitly present but empty, fail fast (lets tests override even if env has a key).
    if (cfg && 'OPENROUTER_API_KEY' in cfg && !cfg.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }
    const apiKey = cfg?.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
    this.assertPrompt(prompt);

    const body = JSON.stringify({
      model: this.model,
      messages: prompt.messages,
      temperature: prompt.temperature ?? 0.7,
      max_tokens: prompt.max_tokens ?? 500,
    });

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://wrath-shield.com',
      'X-Title': 'Wrath Shield v3',
    } as any;

    const attempt = async () => {
      let res: any;
      try {
        res = await fetch(this.endpoint, { method: 'POST', headers, body });
      } catch (e: any) {
        throw new Error(e?.message || 'Network error');
      }
      if (!res.ok) {
        const msg = await (res.text ? res.text() : Promise.resolve(''));
        throw new Error(`OpenRouter API error (${res.status}): ${msg}`);
      }
      return res.json();
    };

    const shouldRetry = (status: number) => [429, 500, 503].includes(status);
    let lastErr: any;
    for (let i = 0; i < 3; i++) {
      try {
        const json: any = await attempt();
        if (!json?.choices || json.choices.length === 0) throw new Error('Invalid response: no choices returned');
        const choice = json.choices[0];
        const content = (choice.message?.content || '').trim();
        if (!content) throw new Error('Invalid response: no content in message');
        return {
          content,
          model: json.model,
          finish_reason: choice.finish_reason,
          usage: json.usage,
          metadata: {
            request_id: json.id,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e);
        if (msg.startsWith('Network error') || msg.startsWith('Invalid response')) {
          throw e;
        }
        const statusMatch = /OpenRouter API error \((\d+)/.exec(String(e?.message));
        const status = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
        if (status && !shouldRetry(status)) break;
        if (i < 2) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    throw lastErr;
  }

  validateResponse(resp: CoachingResponse): boolean {
    if (!resp?.content || resp.content.trim().length < 20) return false;
    const lower = resp.content.toLowerCase();
    const errorKeywords = ['error', 'failed', 'unable', 'cannot', 'invalid'];
    if (errorKeywords.some((k) => lower.includes(k))) return false;
    if (!resp.finish_reason || !['stop', 'length'].includes(resp.finish_reason)) return false;
    return true;
  }
}

function safeGetConfig(): any {
  try {
    return getConfig() as any;
  } catch {
    return undefined;
  }
}

let singleton: OpenRouterClient | null = null;
export function getOpenRouterClient(): OpenRouterClient {
  if (!singleton) singleton = new OpenRouterClient();
  return singleton;
}
