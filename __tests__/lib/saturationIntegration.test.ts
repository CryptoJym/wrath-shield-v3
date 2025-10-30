import { nextInterval } from '../../lib/saturationIntegration';

describe('saturation integration (feature-flagged)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD_ENV }; });
  afterAll(() => { process.env = OLD_ENV; });

  test('disabled by default → no-op result', () => {
    delete process.env.SATURATION_ENABLED;
    const out = nextInterval({ correctStreak: 3, ease: 2, lastIntervalMinutes: 15 });
    expect(out.nextIntervalMinutes).toBe(15);
    expect(out.confidence).toBeCloseTo(0.5, 2);
  });

  test('enabled → computes increased interval', () => {
    process.env.SATURATION_ENABLED = 'true';
    const out = nextInterval({ correctStreak: 3, ease: 2, lastIntervalMinutes: 15 });
    expect(out.nextIntervalMinutes).toBeGreaterThan(15);
    expect(out.confidence).toBeGreaterThan(0.5);
  });
});
