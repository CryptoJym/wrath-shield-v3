import { getNextRun, getUpcomingRuns } from '../../lib/scheduler';

describe('scheduler scaffolding', () => {
  test('hourly next run at minute offset', () => {
    const from = new Date('2025-10-30T09:15:10.000Z');
    const next = getNextRun(from, { kind: 'hourly', minuteOffset: 20 });
    expect(next.toISOString()).toBe('2025-10-30T09:20:00.000Z');
  });

  test('hourly rolls to next hour when past offset', () => {
    const from = new Date('2025-10-30T09:21:00.000Z');
    const next = getNextRun(from, { kind: 'hourly', minuteOffset: 20 });
    expect(next.toISOString()).toBe('2025-10-30T10:20:00.000Z');
  });

  test('midday returns next 12:00 local-equivalent snapshot', () => {
    const from = new Date('2025-10-30T13:00:00.000Z');
    const next = getNextRun(from, { kind: 'midday' });
    // We only assert monotonicity (next is after from) and second precision
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getSeconds()).toBe(0);
  });

  test('nightly returns next 02:00 local-equivalent snapshot', () => {
    const from = new Date('2025-10-30T05:00:00.000Z');
    const next = getNextRun(from, { kind: 'nightly' });
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(next.getMinutes()).toBe(0);
    expect(next.getSeconds()).toBe(0);
  });

  test('upcoming runs returns strictly increasing times', () => {
    const from = new Date('2025-10-30T00:00:00.000Z');
    const runs = getUpcomingRuns(from, { kind: 'hourly', minuteOffset: 0 }, 3);
    expect(runs).toHaveLength(3);
    expect(runs[0].getTime()).toBeLessThan(runs[1].getTime());
    expect(runs[1].getTime()).toBeLessThan(runs[2].getTime());
  });
});
