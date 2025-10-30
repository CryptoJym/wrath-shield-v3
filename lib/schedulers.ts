import { type RunnerSpec } from './schedulerRunner';
import { hourlyScan, middayPing, nightlyRollup, sanityGpt5 } from './schedulerHandlers';

export interface BuildSchedulersOptions {
  minuteOffset?: number; // for hourly
}

export function getSchedulerSpecs(opts: BuildSchedulersOptions = {}): RunnerSpec[] {
  const minuteOffset = Math.max(0, Math.min(59, opts.minuteOffset ?? 0));
  return [
    {
      name: 'hourly-scan',
      kind: 'hourly',
      minuteOffset,
      callback: () => hourlyScan(),
    },
    {
      name: 'midday-ping',
      kind: 'midday',
      callback: () => middayPing([]), // Call-site can pass real flags source
    },
    {
      name: 'nightly-rollup',
      kind: 'nightly',
      callback: () => nightlyRollup(),
    },
    {
      name: 'sanity-gpt5',
      kind: 'nightly',
      callback: () => sanityGpt5(),
    },
  ];
}
