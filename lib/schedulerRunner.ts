import { getNextRun, type ScheduleSpec } from './scheduler';

export type RunnerCallback = () => Promise<void> | void;

export interface RunnerSpec extends ScheduleSpec {
  name: string;
  callback: RunnerCallback;
}

export interface RunnerHandle {
  name: string;
  nextAt: Date;
  cancel: () => void;
}

/**
 * Create a one-shot timeout for the next run time. The caller owns re-arming.
 * This keeps behavior deterministic for tests and avoids global side-effects.
 */
export function armOnce(now: Date, spec: RunnerSpec): { nextAt: Date; timeoutMs: number; start: (onFire?: () => void) => NodeJS.Timeout } {
  const nextAt = getNextRun(now, spec);
  const timeoutMs = Math.max(0, nextAt.getTime() - now.getTime());
  const start = (onFire?: () => void) => setTimeout(async () => {
    try {
      await spec.callback();
    } finally {
      onFire?.();
    }
  }, timeoutMs);
  return { nextAt, timeoutMs, start };
}
