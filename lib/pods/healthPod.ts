import { PodInput, PodOutput } from './types';

/**
 * Health / lifelog pod (stub)
 * - watches lifelog/WHOOP signals for anomalies or routines
 */
export async function runHealthPod(input: PodInput): Promise<PodOutput> {
  const notes = [`HealthPod stub; events seen: ${input.events.length}`];
  return { actions: [], notes, confidence: 0.0 };
}
