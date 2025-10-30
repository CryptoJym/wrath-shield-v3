import { computeNextInterval, type SaturationInput, type SaturationOutput } from './saturation';

export interface SaturationOptions {
  enabled?: boolean; // defaults to process.env.SATURATION_ENABLED === 'true'
}

export function nextInterval(
  input: SaturationInput,
  opts: SaturationOptions = {}
): SaturationOutput | { nextIntervalMinutes: number; confidence: number } {
  const enabled = typeof opts.enabled === 'boolean' ? opts.enabled : process.env.SATURATION_ENABLED === 'true';
  if (!enabled) {
    // No-op: preserve previous interval and conservative confidence
    return { nextIntervalMinutes: input.lastIntervalMinutes, confidence: 0.5 };
  }
  return computeNextInterval(input);
}
