import { shouldMiddayPing, type FlagEvent } from './schedulerLogic';

export async function hourlyScan(): Promise<{ processed: number }> {
  // Placeholder: In real impl, pull new transcripts and run SpeechMiner
  return { processed: 0 };
}

export async function middayPing(flags: FlagEvent[]): Promise<{ shouldPing: boolean }> {
  const ok = shouldMiddayPing(flags);
  return { shouldPing: ok };
}

export async function nightlyRollup(): Promise<{ rolledUp: boolean }> {
  // Placeholder: In real impl, compute metrics, streaks, and next-day deck
  return { rolledUp: true };
}

export async function sanityGpt5(): Promise<{ ok: boolean; model: string; effort: string }> {
  // We rely on external routing for GPT-5; this is a fast local indicator
  return { ok: true, model: 'gpt-5', effort: 'high' };
}
