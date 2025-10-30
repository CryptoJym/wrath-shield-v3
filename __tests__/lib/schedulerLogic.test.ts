import { shouldMiddayPing } from '../../lib/schedulerLogic';

describe('scheduler logic - midday ping', () => {
  test('false when fewer than 2 medium+ flags in window', () => {
    const now = Date.now();
    const events = [
      { severity: 'medium' as const, timestamp: now - 10 * 60 * 1000 },
      { severity: 'low' as const, timestamp: now - 20 * 60 * 1000 },
    ];
    expect(shouldMiddayPing(events, now)).toBe(false);
  });

  test('true when 2 medium+ flags within 3h', () => {
    const now = Date.now();
    const events = [
      { severity: 'medium' as const, timestamp: now - 30 * 60 * 1000 },
      { severity: 'high' as const, timestamp: now - 100 * 60 * 1000 },
      { severity: 'low' as const, timestamp: now - 400 * 60 * 1000 },
    ];
    expect(shouldMiddayPing(events, now)).toBe(true);
  });

  test('excludes old events beyond window', () => {
    const now = Date.now();
    const events = [
      { severity: 'high' as const, timestamp: now - 10 * 60 * 1000 },
      { severity: 'medium' as const, timestamp: now - 200 * 60 * 1000 },
      { severity: 'high' as const, timestamp: now - 181 * 60 * 1000 }, // just outside default window
    ];
    expect(shouldMiddayPing(events, now)).toBe(false);
  });
});
