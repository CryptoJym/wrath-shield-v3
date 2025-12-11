/**
 * Lightweight scheduler scaffolding for Lane A (Task 9).
 *
 * NOTE: This is an isolated utility and does not attach timers globally.
 * It is safe to import in tests and future runner code without side effects.
 */

export type ScheduleKind = 'hourly' | 'midday' | 'nightly';

export interface ScheduleSpec {
  kind: ScheduleKind;
  // Optional fixed minute offset within the hour for hourly, defaults to :00
  minuteOffset?: number; // 0-59
}

/**
 * Compute the next run time based on a simple schedule kind.
 * - hourly: next top of hour (or minuteOffset within the hour)
 * - midday: next 12:00 local time
 * - nightly: next 02:00 local time (typical maintenance window)
 */
export function getNextRun(from: Date, spec: ScheduleSpec): Date {
  const d = new Date(from.getTime());
  const minuteOffset = Math.max(0, Math.min(59, spec.minuteOffset ?? 0));

  if (spec.kind === 'hourly') {
    const next = new Date(d);
    next.setSeconds(0, 0);
    if (d.getMinutes() < minuteOffset || (d.getMinutes() === minuteOffset && d.getSeconds() === 0)) {
      next.setMinutes(minuteOffset);
    } else {
      next.setHours(d.getHours() + 1, minuteOffset, 0, 0);
    }
    return next;
  }

  if (spec.kind === 'midday') {
    const next = new Date(d);
    next.setSeconds(0, 0);
    next.setHours(12, 0, 0, 0);
    if (d >= next) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // nightly
  const next = new Date(d);
  next.setSeconds(0, 0);
  next.setHours(2, 0, 0, 0);
  if (d >= next) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Compute a small batch of future run times from a start date.
 */
export function getUpcomingRuns(from: Date, spec: ScheduleSpec, count = 3): Date[] {
  const out: Date[] = [];
  let cursor = new Date(from.getTime());
  for (let i = 0; i < count; i++) {
    cursor = getNextRun(cursor, spec);
    out.push(new Date(cursor.getTime()));
    // Advance cursor slightly to avoid returning the same instant repeatedly.
    cursor = new Date(cursor.getTime() + 1000);
  }
  return out;
}
