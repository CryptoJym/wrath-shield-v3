/**
 * Wrath Shield v3 - Deck API Performance Tests
 *
 * Validates that deck interactions complete quickly enough
 * to support the 5-minute combined ritual + deck experience target.
 *
 * Performance Targets:
 * - GET deck state: <50ms API response
 * - Complete task: <100ms API response
 * - Stomp flag: <150ms API response (includes flag lookup and tweak creation)
 * - Combined deck operations: <500ms for typical workflow
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/deck/route';
import {
  getSetting,
  insertSettings,
  insertTweaks,
  updateFlagStatus,
  getFlag,
  getPendingFlags,
  getTweaksLastNHours,
  getTotalUIXScore,
} from '@/lib/db/queries';
import type { Setting, Tweak, Flag } from '@/lib/db/types';

// Disable server-only guard for testing
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock database queries
jest.mock('@/lib/db/queries', () => ({
  getSetting: jest.fn(),
  insertSettings: jest.fn(),
  insertTweaks: jest.fn(),
  updateFlagStatus: jest.fn(),
  getFlag: jest.fn(),
  getPendingFlags: jest.fn(),
  getTweaksLastNHours: jest.fn(),
  getTotalUIXScore: jest.fn(),
}));

const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;
const mockInsertSettings = insertSettings as jest.MockedFunction<typeof insertSettings>;
const mockInsertTweaks = insertTweaks as jest.MockedFunction<typeof insertTweaks>;
const mockUpdateFlagStatus = updateFlagStatus as jest.MockedFunction<typeof updateFlagStatus>;
const mockGetFlag = getFlag as jest.MockedFunction<typeof getFlag>;
const mockGetPendingFlags = getPendingFlags as jest.MockedFunction<typeof getPendingFlags>;
const mockGetTweaksLastNHours = getTweaksLastNHours as jest.MockedFunction<typeof getTweaksLastNHours>;
const mockGetTotalUIXScore = getTotalUIXScore as jest.MockedFunction<typeof getTotalUIXScore>;

describe('Deck API Performance Tests', () => {
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: deck not gated
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'deck_flags_stomped') {
        return { key, value_enc: '0' } as Setting;
      }
      return null;
    });

    mockGetTweaksLastNHours.mockReturnValue([
      { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 75, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
      { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 80, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
    ]);

    mockGetTotalUIXScore.mockReturnValue(155);
  });

  describe('GET /api/deck Performance', () => {
    it('should complete in under 50ms', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck');

      const startTime = performance.now();
      const response = await GET(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('gating');
    });

    it('should handle gated state calculation efficiently', async () => {
      // Simulate gated state
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return { key, value_enc: '1' } as Setting;
        }
        return null;
      });

      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);

      mockGetTotalUIXScore.mockReturnValue(125);

      const request = new NextRequest('http://localhost:3000/api/deck');

      const startTime = performance.now();
      const response = await GET(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(true);
    });

    it('should handle 10 consecutive GET requests without degradation', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const request = new NextRequest('http://localhost:3000/api/deck');

        const startTime = performance.now();
        const response = await GET(request);
        const endTime = performance.now();

        durations.push(endTime - startTime);
        expect(response.status).toBe(200);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(50);
      expect(maxDuration).toBeLessThan(75); // Allow some variance
    });
  });

  describe('Task Completion Performance', () => {
    it('should complete task in under 100ms', async () => {
      const body = {
        action: 'complete_task',
        task_category: 'word',
      };

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify batch insert was called once
      expect(mockInsertSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle completing all 3 tasks efficiently', async () => {
      const tasks = ['word', 'action', 'body'];
      const durations: number[] = [];

      for (const task of tasks) {
        const body = {
          action: 'complete_task',
          task_category: task,
        };

        const request = new NextRequest('http://localhost:3000/api/deck', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        });

        const startTime = performance.now();
        const response = await POST(request);
        const endTime = performance.now();

        durations.push(endTime - startTime);
        expect(response.status).toBe(200);
      }

      const totalDuration = durations.reduce((a, b) => a + b, 0);
      expect(totalDuration).toBeLessThan(300);
    });
  });

  describe('Flag Stomping Performance', () => {
    it('should stomp flag in under 150ms', async () => {
      // Mock gated state with LOW UIX scores (< 70 for 2 days)
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return { key, value_enc: '2' } as Setting; // 2 flags already stomped
        }
        return null;
      });

      // Set LOW UIX scores to trigger gating
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 40, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 50, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);

      mockGetTotalUIXScore.mockReturnValue(90); // Total is fine, but recent days are low

      mockGetFlag.mockReturnValue({
        id: 'flag-123',
        original_text: 'Test manipulation',
        severity: 4,
        manipulation_type: 'gaslighting',
        status: 'pending',
        detected_at: now,
      } as Flag);

      mockGetPendingFlags.mockReturnValue([{
        id: 'flag-123',
        original_text: 'Test manipulation',
        severity: 4,
        manipulation_type: 'gaslighting',
        status: 'pending',
        detected_at: now,
      } as Flag]);

      const body = {
        action: 'stomp_flag',
        flag_id: 'flag-123',
      };

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(150);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify operations were performed
      expect(mockInsertTweaks).toHaveBeenCalledTimes(1);
      expect(mockUpdateFlagStatus).toHaveBeenCalledTimes(1);
      // Note: insertSettings is called twice when unlocking (increment + reset)
      expect(mockInsertSettings).toHaveBeenCalledTimes(2);
    });

    it('should handle stomping 3 flags to unlock deck efficiently', async () => {
      const durations: number[] = [];

      // Set LOW UIX scores to trigger gating
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 40, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 50, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);

      mockGetTotalUIXScore.mockReturnValue(90);

      for (let i = 0; i < 3; i++) {
        // Update stomped count
        mockGetSetting.mockImplementation((key: string) => {
          if (key === 'deck_flags_stomped') {
            return { key, value_enc: i.toString() } as Setting;
          }
          return null;
        });

        mockGetFlag.mockReturnValue({
          id: `flag-${i}`,
          original_text: `Manipulation ${i}`,
          severity: 3 + i,
          manipulation_type: 'guilt',
          status: 'pending',
          detected_at: now,
        } as Flag);

        mockGetPendingFlags.mockReturnValue([{
          id: `flag-${i}`,
          original_text: `Manipulation ${i}`,
          severity: 3 + i,
          manipulation_type: 'guilt',
          status: 'pending',
          detected_at: now,
        } as Flag]);

        const body = {
          action: 'stomp_flag',
          flag_id: `flag-${i}`,
        };

        const request = new NextRequest('http://localhost:3000/api/deck', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        });

        const startTime = performance.now();
        const response = await POST(request);
        const endTime = performance.now();

        durations.push(endTime - startTime);
        expect(response.status).toBe(200);
      }

      const totalDuration = durations.reduce((a, b) => a + b, 0);
      expect(totalDuration).toBeLessThan(450); // 3 * 150ms
    });

    it('should fail fast on invalid flag ID', async () => {
      // Mock gated state with LOW UIX scores
      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return { key, value_enc: '1' } as Setting;
        }
        return null;
      });

      // Set LOW UIX scores to trigger gating
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 40, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 50, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);

      mockGetTotalUIXScore.mockReturnValue(90);

      // Return empty pending flags array so flag is not found
      mockGetPendingFlags.mockReturnValue([]);

      const body = {
        action: 'stomp_flag',
        flag_id: 'nonexistent',
      };

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(response.status).toBe(404);
    });
  });

  describe('Combined Deck Workflow Performance', () => {
    it('should complete typical deck workflow in under 500ms', async () => {
      let totalDuration = 0;

      // Step 1: Get deck state
      const getRequest = new NextRequest('http://localhost:3000/api/deck');

      const getStart = performance.now();
      const getResponse = await GET(getRequest);
      const getEnd = performance.now();
      totalDuration += getEnd - getStart;

      expect(getResponse.status).toBe(200);

      // Step 2: Complete 3 tasks
      const tasks = ['word', 'action', 'body'];
      for (const task of tasks) {
        const body = {
          action: 'complete_task',
          task_category: task,
        };

        const request = new NextRequest('http://localhost:3000/api/deck', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        });

        const startTime = performance.now();
        const response = await POST(request);
        const endTime = performance.now();
        totalDuration += endTime - startTime;

        expect(response.status).toBe(200);
      }

      // Verify total time is under target
      expect(totalDuration).toBeLessThan(500);
    });
  });

  describe('Error Handling Performance', () => {
    it('should fail fast on validation errors', async () => {
      const body = {
        action: 'invalid_action',
      };

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
      expect(response.status).toBe(400);
    });
  });

  describe('Stress Testing', () => {
    it('should handle 20 rapid deck state checks without degradation', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 20; i++) {
        const request = new NextRequest('http://localhost:3000/api/deck');

        const startTime = performance.now();
        const response = await GET(request);
        const endTime = performance.now();

        durations.push(endTime - startTime);
        expect(response.status).toBe(200);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(50);
      expect(maxDuration).toBeLessThan(100);
    });
  });
});
