import { armOnce } from '../../lib/schedulerRunner';

describe('scheduler runner', () => {
  jest.useFakeTimers();

  test('arms and fires a one-shot runner', () => {
    const now = new Date('2025-10-30T09:00:00.000Z');
    const fired: number[] = [];
    const { timeoutMs, start, nextAt } = armOnce(now, {
      name: 'hourly-20',
      kind: 'hourly',
      minuteOffset: 20,
      callback: () => fired.push(Date.now())
    });

    expect(timeoutMs).toBe((20 * 60) * 1000); // 20 minutes in ms
    expect(nextAt.toISOString()).toBe('2025-10-30T09:20:00.000Z');

    const handle = start();
    jest.advanceTimersByTime(timeoutMs + 1);
    expect(fired.length).toBe(1);
    clearTimeout(handle);
  });
});
