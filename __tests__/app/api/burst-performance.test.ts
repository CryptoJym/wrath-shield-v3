/**
 * Wrath Shield v3 - Burst API Performance Tests
 *
 * Validates that PRIME and LOCK ritual flows complete quickly enough
 * to support the 5-minute combined user experience target.
 *
 * Performance Targets:
 * - PRIME ritual: <100ms API response
 * - LOCK ritual: <200ms API response (includes flag lookup)
 * - GET ritual state: <50ms API response
 * - Combined API time: <500ms (leaves 4.5 min for user interaction)
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/burst/route';
import { Database } from '@/lib/db/Database';
import {
  insertFlags,
  insertTweaks,
  updateFlagStatus,
  getFlag,
  getPendingFlags,
  getSetting,
  insertSettings,
} from '@/lib/db/queries';
import type { FlagInput } from '@/lib/db/types';

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
  insertFlags: jest.fn(),
  insertTweaks: jest.fn(),
  updateFlagStatus: jest.fn(),
  getFlag: jest.fn(),
  getPendingFlags: jest.fn(),
  getSetting: jest.fn(),
  insertSettings: jest.fn(),
}));

const mockInsertFlags = insertFlags as jest.MockedFunction<typeof insertFlags>;
const mockInsertTweaks = insertTweaks as jest.MockedFunction<typeof insertTweaks>;
const mockUpdateFlagStatus = updateFlagStatus as jest.MockedFunction<typeof updateFlagStatus>;
const mockGetFlag = getFlag as jest.MockedFunction<typeof getFlag>;
const mockGetPendingFlags = getPendingFlags as jest.MockedFunction<typeof getPendingFlags>;
const mockGetSetting = getSetting as jest.MockedFunction<typeof getSetting>;
const mockInsertSettings = insertSettings as jest.MockedFunction<typeof insertSettings>;

describe('Burst API Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockReturnValue(null);
    mockGetPendingFlags.mockReturnValue([]);
  });

  describe('GET /api/burst Performance', () => {
    it('should complete in under 50ms', async () => {
      // Mock ritual state
      mockGetSetting.mockImplementation((key) => {
        if (key === 'last_prime_completed') {
          return { key, value_enc: Math.floor(Date.now() / 1000).toString() };
        }
        if (key === 'last_lock_completed') {
          return { key, value_enc: Math.floor(Date.now() / 1000).toString() };
        }
        return null;
      });

      mockGetPendingFlags.mockReturnValue([
        {
          id: 'flag-1',
          original_text: 'Test manipulation',
          severity: 3,
          manipulation_type: 'gaslighting',
          status: 'pending',
          detected_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/burst');

      const startTime = performance.now();
      const response = await GET(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('prime_completed');
      expect(data).toHaveProperty('lock_completed');
      expect(data).toHaveProperty('pending_flags');
    });

    it('should handle multiple pending flags efficiently', async () => {
      // Create 10 pending flags
      const flags = Array.from({ length: 10 }, (_, i) => ({
        id: `flag-${i}`,
        original_text: `Manipulation ${i}`,
        severity: Math.floor(Math.random() * 5) + 1,
        manipulation_type: 'gaslighting',
        status: 'pending' as const,
        detected_at: Math.floor(Date.now() / 1000),
      }));

      mockGetPendingFlags.mockReturnValue(flags);

      const request = new NextRequest('http://localhost:3000/api/burst');

      const startTime = performance.now();
      const response = await GET(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.pending_flags).toHaveLength(10);
    });
  });

  describe('PRIME Ritual Performance', () => {
    it('should complete in under 100ms', async () => {
      const body = {
        ritual_type: 'PRIME',
        assured_line: 'I deserve respect and will not tolerate manipulation.',
        micro_action: 'Practice 5 minutes of assertiveness visualization',
        no_permission_enabled: true,
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
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
      expect(data.ritual_type).toBe('PRIME');

      // Verify batch insert was called once
      expect(mockInsertSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle minimal PRIME ritual efficiently', async () => {
      const body = {
        ritual_type: 'PRIME',
        assured_line: 'I am strong.',
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
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
    });

    it('should process very long assured lines without slowdown', async () => {
      // Create a 500-character assured line
      const longLine = 'I '.repeat(250).trim();

      const body = {
        ritual_type: 'PRIME',
        assured_line: longLine,
        micro_action: 'Practice deep breathing',
        no_permission_enabled: true,
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
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
    });
  });

  describe('LOCK Ritual Performance', () => {
    it('should complete in under 200ms with flag rewrite', async () => {
      // Mock flag lookup
      mockGetFlag.mockReturnValue({
        id: 'flag-123',
        original_text: 'You always overreact',
        severity: 4,
        manipulation_type: 'gaslighting',
        status: 'pending',
        detected_at: Math.floor(Date.now() / 1000),
      });

      const body = {
        ritual_type: 'LOCK',
        proof_text: 'Successfully navigated a difficult conversation with boundaries',
        rewrite_flag_id: 'flag-123',
        rewrite_assured_text: 'I respond appropriately to situations. My reactions are valid and measured.',
        tomorrow_preempt: 'I will maintain my boundaries with confidence tomorrow',
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.ritual_type).toBe('LOCK');
      expect(data.rewrite_completed).toBe(true);

      // Verify operations were batched
      expect(mockInsertTweaks).toHaveBeenCalledTimes(1);
      expect(mockUpdateFlagStatus).toHaveBeenCalledTimes(1);
      expect(mockInsertSettings).toHaveBeenCalledTimes(1);
    });

    it('should handle minimal LOCK ritual efficiently', async () => {
      const body = {
        ritual_type: 'LOCK',
        proof_text: 'Had a good day',
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200);
      expect(response.status).toBe(200);
    });

    it('should calculate delta UIX efficiently', async () => {
      mockGetFlag.mockReturnValue({
        id: 'flag-456',
        original_text: 'Test',
        severity: 5,
        manipulation_type: 'guilt',
        status: 'pending',
        detected_at: Math.floor(Date.now() / 1000),
      });

      // Test with various rewrite lengths
      const rewriteLengths = [5, 10, 15, 20, 25];

      for (const wordCount of rewriteLengths) {
        const rewriteText = 'word '.repeat(wordCount).trim();

        const body = {
          ritual_type: 'LOCK',
          rewrite_flag_id: 'flag-456',
          rewrite_assured_text: rewriteText,
        };

        const request = new NextRequest('http://localhost:3000/api/burst', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        });

        const startTime = performance.now();
        const response = await POST(request);
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(200);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Combined Ritual Flow Performance', () => {
    it('should complete both rituals in under 300ms total', async () => {
      // PRIME ritual
      const primeBody = {
        ritual_type: 'PRIME',
        assured_line: 'I am worthy of respect',
        micro_action: 'Morning visualization',
        no_permission_enabled: true,
      };

      const primeRequest = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify(primeBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const primeStart = performance.now();
      const primeResponse = await POST(primeRequest);
      const primeEnd = performance.now();
      const primeDuration = primeEnd - primeStart;

      expect(primeResponse.status).toBe(200);

      // LOCK ritual
      mockGetFlag.mockReturnValue({
        id: 'flag-789',
        original_text: 'Test manipulation',
        severity: 3,
        manipulation_type: 'minimization',
        status: 'pending',
        detected_at: Math.floor(Date.now() / 1000),
      });

      const lockBody = {
        ritual_type: 'LOCK',
        proof_text: 'Maintained boundaries today',
        rewrite_flag_id: 'flag-789',
        rewrite_assured_text: 'I trust my judgment and perceptions',
        tomorrow_preempt: 'Tomorrow I will continue to honor my needs',
      };

      const lockRequest = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify(lockBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const lockStart = performance.now();
      const lockResponse = await POST(lockRequest);
      const lockEnd = performance.now();
      const lockDuration = lockEnd - lockStart;

      expect(lockResponse.status).toBe(200);

      const totalDuration = primeDuration + lockDuration;
      expect(totalDuration).toBeLessThan(300);
    });
  });

  describe('Error Handling Performance', () => {
    it('should fail fast on validation errors', async () => {
      const body = {
        ritual_type: 'PRIME',
        // Missing required assured_line
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const startTime = performance.now();
      const response = await POST(request);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50); // Should be very fast
      expect(response.status).toBe(400);
    });

    it('should handle missing flags efficiently', async () => {
      mockGetFlag.mockReturnValue(null); // Flag not found

      const body = {
        ritual_type: 'LOCK',
        rewrite_flag_id: 'nonexistent',
        rewrite_assured_text: 'Test',
      };

      const request = new NextRequest('http://localhost:3000/api/burst', {
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

  describe('Stress Testing', () => {
    it('should handle 10 consecutive PRIME rituals without degradation', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const body = {
          ritual_type: 'PRIME',
          assured_line: `Assured line ${i}`,
          micro_action: `Action ${i}`,
          no_permission_enabled: i % 2 === 0,
        };

        const request = new NextRequest('http://localhost:3000/api/burst', {
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

      // Verify no significant performance degradation
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(150); // Allow some variance
    });

    it('should handle 10 consecutive LOCK rituals without degradation', async () => {
      mockGetFlag.mockImplementation((id) => ({
        id,
        original_text: 'Test',
        severity: 3,
        manipulation_type: 'guilt',
        status: 'pending',
        detected_at: Math.floor(Date.now() / 1000),
      }));

      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const body = {
          ritual_type: 'LOCK',
          proof_text: `Proof ${i}`,
          rewrite_flag_id: `flag-${i}`,
          rewrite_assured_text: `Rewrite ${i}`,
          tomorrow_preempt: `Preempt ${i}`,
        };

        const request = new NextRequest('http://localhost:3000/api/burst', {
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

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(200);
      expect(maxDuration).toBeLessThan(300); // Allow some variance
    });
  });
});
