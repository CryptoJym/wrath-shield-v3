import { getSchedulerSpecs } from '../../lib/schedulers';
import { armOnce } from '../../lib/schedulerRunner';

describe('schedulers spec builder', () => {
  jest.useFakeTimers();

  test('returns four schedulers with expected kinds', () => {
    const specs = getSchedulerSpecs({ minuteOffset: 15 });
    const names = specs.map(s => s.name);
    expect(names).toEqual(['hourly-scan', 'midday-ping', 'nightly-rollup', 'sanity-gpt5']);
  });

  test('hourly-scan callback fires via runner', () => {
    const specs = getSchedulerSpecs({ minuteOffset: 1 });
    const hourly = specs.find(s => s.name === 'hourly-scan');
    expect(hourly).toBeTruthy();
    const now = new Date('2025-10-30T09:00:00.000Z');
    const spy = jest.fn(hourly!.callback as any);
    const { timeoutMs, start } = armOnce(now, { ...hourly!, callback: spy });
    const handle = start();
    jest.advanceTimersByTime(timeoutMs + 1);
    expect(spy).toHaveBeenCalled();
    clearTimeout(handle);
  });
});
