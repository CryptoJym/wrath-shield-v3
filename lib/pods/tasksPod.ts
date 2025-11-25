import { PodInput, PodOutput } from './types';

/**
 * Tasks / planning pod (stub)
 * - extracts tasks from signals, assigns workspace/project
 */
export async function runTasksPod(input: PodInput): Promise<PodOutput> {
  const notes = [`TasksPod stub; events seen: ${input.events.length}`];
  return { actions: [], notes, confidence: 0.0 };
}
