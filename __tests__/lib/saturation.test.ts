import { computeNextInterval } from '../../lib/saturation';

describe('saturation learning scaffolding', () => {
  test('grows interval with streak and ease', () => {
    const a = computeNextInterval({ correctStreak: 0, ease: 2, lastIntervalMinutes: 10 });
    const b = computeNextInterval({ correctStreak: 5, ease: 3, lastIntervalMinutes: 10 });
    expect(b.nextIntervalMinutes).toBeGreaterThan(a.nextIntervalMinutes);
    expect(b.confidence).toBeGreaterThan(a.confidence);
  });

  test('bounds and determinism', () => {
    const x = computeNextInterval({ correctStreak: 100, ease: 3, lastIntervalMinutes: 1 });
    const y = computeNextInterval({ correctStreak: 100, ease: 3, lastIntervalMinutes: 1 });
    expect(x).toEqual(y);
    expect(x.confidence).toBeLessThanOrEqual(0.98);
    expect(x.confidence).toBeGreaterThanOrEqual(0.2);
  });
});
