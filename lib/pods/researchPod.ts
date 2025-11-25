import { PodInput, PodOutput } from './types';

/**
 * Research / context pod (stub)
 * - pulls long-context briefs, supporting material
 */
export async function runResearchPod(input: PodInput): Promise<PodOutput> {
  const notes = [`ResearchPod stub; events seen: ${input.events.length}`];
  return { actions: [], notes, confidence: 0.0 };
}
