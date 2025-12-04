import { GET } from '@/app/api/proactive/tick/route';
import { NextResponse } from 'next/server';
import { jest } from '@jest/globals';

const runDueTasks = jest.fn(async () => [{ success: true, wasExecuted: true, escalationLevel: 'AUTO_EXECUTE' }]);
const checkThresholds = jest.fn(async () => []);
const getStatus = jest.fn(async () => ({
  taskCount: 1,
  triggerCount: 0,
  monitorCount: 0,
  dueTasks: 0,
  nextScheduledRun: '2025-12-05T00:00:00Z',
}));

jest.mock('@/lib/agents/ProactiveEnablement', () => ({
  getProactiveEnablement: () => ({
    initialize: jest.fn(async () => {}),
    runDueTasks,
    checkThresholds,
    getStatus,
  }),
}));

jest.mock('@/lib/agents/MetricsCollector', () => ({
  getMetricsCollector: () => ({
    collectAll: jest.fn(async () => ({ sleep_score: 85 })),
  }),
}));

describe('Proactive tick route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'production', PROACTIVE_SECRET: 'secret123' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects when secret is missing', async () => {
    const req = { headers: new Headers(), url: 'http://localhost/api/proactive/tick' } as any;
    const res = (await GET(req)) as NextResponse;
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('runs when secret matches', async () => {
    const req = { headers: new Headers(), url: 'http://localhost/api/proactive/tick?secret=secret123' } as any;
    const res = (await GET(req)) as NextResponse;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(runDueTasks).toHaveBeenCalledTimes(1);
    expect(checkThresholds).toHaveBeenCalledTimes(1);
    expect(body.metrics.sleep_score).toBe(85);
  });
});
