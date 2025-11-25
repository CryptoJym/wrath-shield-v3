import { getAllMemories, addMemory, deleteMemory } from '../MemoryWrapper';

/**
 * Memory Compactor
 *  - Groups memories by type/date and produces condensed summaries.
 *  - Uses GPT-5.1 (primary) with grok-4-1-fast fallback for summarization.
 *  - Keeps the N most recent raw memories; deletes older ones after summarizing.
 */

import { DirectLLMClients } from '../DirectLLMClients';

const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-5.1';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'grok-4-1-fast';

export async function compactMemories(userId: string, keepRecent: number = 50): Promise<{ summarized: number; deleted: number }> {
  const memories = await getAllMemories(userId);
  if (memories.length <= keepRecent) return { summarized: 0, deleted: 0 };

  const old = memories.slice(keepRecent); // older memories
  const chunks = chunk(old, 20);
  let summarized = 0;
  let deleted = 0;

  for (const chunkMem of chunks) {
    const text = chunkMem
      .map((m) => `- ${m.text}${m.metadata?.type ? ` [${m.metadata.type}]` : ''}${m.metadata?.date ? ` (${m.metadata.date})` : ''}`)
      .join('\n');
    const summary = await summarizeChunk(text);
    if (summary) {
      await addMemory(summary, userId, { type: 'memory_compaction', count: chunkMem.length });
      summarized += chunkMem.length;
      for (const m of chunkMem) {
        if (m.id) {
          try {
            await deleteMemory(m.id);
            deleted++;
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  return { summarized, deleted };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function summarizeChunk(text: string): Promise<string | null> {
  const messages = [
    { role: 'system' as const, content: 'Summarize these memory notes into 3-5 bullets. Be concise.' },
    { role: 'user' as const, content: text },
  ];
  const prompt = { messages, temperature: 0.2, max_tokens: 400 };

  const content = await callWithFallback(prompt);
  return content || null;
}

async function callWithFallback(prompt: { messages: any[]; temperature: number; max_tokens: number }): Promise<string> {
  try {
    const r = await DirectLLMClients.openaiChat(prompt as any, PRIMARY_MODEL);
    return r.content;
  } catch (e) {
    try {
      const r = await DirectLLMClients.xaiChat(prompt as any, FALLBACK_MODEL);
      return r.content;
    } catch (e2) {
      console.warn('[memory] compaction models failed', e, e2);
      return '';
    }
  }
}
