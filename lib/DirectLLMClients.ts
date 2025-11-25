import { ensureServerOnly } from './server-only-guard';
import type { ConstructedPrompt } from './PromptBuilder';

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

export const DirectLLMClients = {
  openaiChat,
  xaiChat,
};
