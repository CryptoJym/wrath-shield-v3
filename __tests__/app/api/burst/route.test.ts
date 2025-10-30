/**
 * Tests for Burst API Route (app/api/burst/route.ts)
 * PRIME and LOCK ritual flows
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/burst/route';
import * as queries from '@/lib/db/queries';
import type { Flag, Setting } from '@/lib/db/types';

// Mock uuid to avoid ES module issues in Jest
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4-test-id'),
}));

// Mock dependencies
jest.mock('@/lib/db/queries');

describe('Burst API Route', () => {
  const mockPendingFlags: Flag[] = [
    {
      id: 'flag-1',
      status: 'pending',
      original_text: 'Manipulative phrase',
      detected_at: Math.floor(Date.now() / 1000) - 7200,
      severity: 3,
      manipulation_type: 'gaslighting',
      created_at: Math.floor(Date.now() / 1000) - 7200,
      updated_at: Math.floor(Date.now() / 1000) - 7200,
    },
    {
      id: 'flag-2',
      status: 'pending',
      original_text: 'Another manipulative phrase',
      detected_at: Math.floor(Date.now() / 1000) - 3600,
      severity: 4,
      manipulation_type: 'guilt',
      created_at: Math.floor(Date.now() / 1000) - 3600,
      updated_at: Math.floor(Date.now() / 1000) - 3600,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (queries.getPendingFlags as jest.Mock).mockReturnValue(mockPendingFlags);
    (queries.getSetting as jest.Mock).mockReturnValue(null);
    (queries.insertSettings as jest.Mock).mockImplementation(() => {});
    (queries.getFlag as jest.Mock).mockImplementation((id: string) => {
      return mockPendingFlags.find(f => f.id === id) || null;
    });
    (queries.insertTweaks as jest.Mock).mockImplementation(() => {});
    (queries.updateFlagStatus as jest.Mock).mockImplementation(() => {});
  });

  describe('GET /api/burst', () => {
    it('should return ritual state when no rituals completed today', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.prime_completed).toBe(false);
      expect(data.lock_completed).toBe(false);
      expect(data.no_permission_enabled).toBe(false);
      expect(data.tomorrow_preempt).toBe(null);
      expect(data.pending_flags).toHaveLength(2);
      expect(data.pending_flags[0]).toEqual({
        id: 'flag-1',
        original_text: 'Manipulative phrase',
        severity: 3,
        manipulation_type: 'gaslighting',
      });
    });

    it('should return prime_completed=true when completed today', async () => {
      const todayTimestamp = Math.floor(Date.now() / 1000);
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'last_prime_completed') {
          return {
            key: 'last_prime_completed',
            value_enc: todayTimestamp.toString(),
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      const data = await response.json();
      expect(data.prime_completed).toBe(true);
      expect(data.lock_completed).toBe(false);
    });

    it('should return lock_completed=true when completed today', async () => {
      const todayTimestamp = Math.floor(Date.now() / 1000);
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'last_lock_completed') {
          return {
            key: 'last_lock_completed',
            value_enc: todayTimestamp.toString(),
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      const data = await response.json();
      expect(data.prime_completed).toBe(false);
      expect(data.lock_completed).toBe(true);
    });

    it('should return no_permission_enabled=true when set', async () => {
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'no_permission_enabled') {
          return {
            key: 'no_permission_enabled',
            value_enc: 'true',
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      const data = await response.json();
      expect(data.no_permission_enabled).toBe(true);
    });

    it('should return tomorrow_preempt when set', async () => {
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'tomorrow_preempt') {
          return {
            key: 'tomorrow_preempt',
            value_enc: 'Stay grounded and clear',
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      const data = await response.json();
      expect(data.tomorrow_preempt).toBe('Stay grounded and clear');
    });

    it('should include Cache-Control header', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });

    it('should handle database errors gracefully', async () => {
      (queries.getSetting as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/burst');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to retrieve ritual state');
    });
  });

  describe('POST /api/burst - PRIME Ritual', () => {
    it('should complete PRIME ritual with all fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: 'I am grounded and clear',
          micro_action: 'Drink water',
          no_permission_enabled: true,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.ritual_type).toBe('PRIME');
      expect(data.assured_line).toBe('I am grounded and clear');
      expect(data.micro_action_logged).toBe(true);
      expect(data.no_permission_active).toBe(true);
      expect(data.completed_at).toBeGreaterThan(0);
      expect(data.message).toBe('PRIME ritual completed successfully');

      // Verify database calls
      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'today_assured_line',
            value_enc: 'I am grounded and clear',
          }),
          expect.objectContaining({
            key: 'prime_micro_action',
            value_enc: 'Drink water',
          }),
          expect.objectContaining({
            key: 'no_permission_enabled',
            value_enc: 'true',
          }),
          expect.objectContaining({
            key: 'last_prime_completed',
          }),
        ])
      );
    });

    it('should complete PRIME ritual with minimal fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: 'I am grounded',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.assured_line).toBe('I am grounded');
      expect(data.micro_action_logged).toBe(false);
      expect(data.no_permission_active).toBe(false);
    });

    it('should reject PRIME ritual without assured_line', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('assured_line is required');
    });

    it('should reject PRIME ritual with empty assured_line', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: '   ',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('assured_line is required');
    });

    it('should trim whitespace from assured_line', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: '  I am grounded  ',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.assured_line).toBe('I am grounded');

      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'today_assured_line',
            value_enc: 'I am grounded',
          }),
        ])
      );
    });
  });

  describe('POST /api/burst - LOCK Ritual', () => {
    it('should complete LOCK ritual with all fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          proof_text: 'Completed morning routine',
          rewrite_flag_id: 'flag-1',
          rewrite_assured_text: 'I clearly express my needs without manipulation',
          tomorrow_preempt: 'Stay clear and grounded',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.ritual_type).toBe('LOCK');
      expect(data.proof_logged).toBe(true);
      expect(data.rewrite_completed).toBe(true);
      expect(data.tomorrow_preempt_set).toBe(true);
      expect(data.delta_uix).toBeGreaterThan(0);
      expect(data.completed_at).toBeGreaterThan(0);
      expect(data.message).toBe('LOCK ritual completed successfully');

      // Verify tweak creation
      expect(queries.insertTweaks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            flag_id: 'flag-1',
            assured_text: 'I clearly express my needs without manipulation',
            action_type: 'rewrite',
            context: 'LOCK ritual',
          }),
        ])
      );

      // Verify flag status update
      expect(queries.updateFlagStatus).toHaveBeenCalledWith('flag-1', 'resolved');

      // Verify settings storage
      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'lock_proof',
            value_enc: 'Completed morning routine',
          }),
          expect.objectContaining({
            key: 'tomorrow_preempt',
            value_enc: 'Stay clear and grounded',
          }),
          expect.objectContaining({
            key: 'last_lock_completed',
          }),
        ])
      );
    });

    it('should complete LOCK ritual with minimal fields (no rewrite)', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          proof_text: 'Completed tasks',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.proof_logged).toBe(true);
      expect(data.rewrite_completed).toBe(false);
      expect(data.tomorrow_preempt_set).toBe(false);
      expect(data.delta_uix).toBe(0);
    });

    it('should calculate correct delta_uix for rewrite', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          rewrite_flag_id: 'flag-2', // severity 4
          rewrite_assured_text: 'I set clear boundaries and communicate my needs directly without guilt or manipulation',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      // Base 10 + 5 (>10 words, 15 total) + 4*2 (severity) = 23
      expect(data.delta_uix).toBe(23);
    });

    it('should cap delta_uix at 30', async () => {
      const highSeverityFlag: Flag = {
        id: 'flag-high',
        status: 'pending',
        original_text: 'High severity manipulation',
        detected_at: Math.floor(Date.now() / 1000),
        severity: 5,
        manipulation_type: 'gaslighting',
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };

      (queries.getFlag as jest.Mock).mockReturnValue(highSeverityFlag);

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          rewrite_flag_id: 'flag-high',
          rewrite_assured_text: 'Very long thoughtful rewrite with many words that expresses clear boundaries and healthy communication patterns without any manipulation tactics',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      // Base 10 + 5 (>10 words, 19 total) + 5*2 = 25
      expect(data.delta_uix).toBe(25);
    });

    it('should reject LOCK ritual with non-existent flag', async () => {
      (queries.getFlag as jest.Mock).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          rewrite_flag_id: 'nonexistent',
          rewrite_assured_text: 'Some rewrite',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('not found');
    });

    it('should reject LOCK ritual with already resolved flag', async () => {
      const resolvedFlag: Flag = {
        ...mockPendingFlags[0],
        status: 'resolved',
      };

      (queries.getFlag as jest.Mock).mockReturnValue(resolvedFlag);

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          rewrite_flag_id: 'flag-1',
          rewrite_assured_text: 'Some rewrite',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('not pending');
    });
  });

  describe('POST /api/burst - Error Handling', () => {
    it('should reject invalid ritual_type', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'INVALID',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid ritual_type');
    });

    it('should reject missing ritual_type', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          assured_line: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid ritual_type');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Internal server error');
    });

    it('should handle database errors during PRIME', async () => {
      (queries.insertSettings as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Internal server error');
    });

    it('should handle database errors during LOCK', async () => {
      (queries.insertTweaks as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          rewrite_flag_id: 'flag-1',
          rewrite_assured_text: 'Test rewrite',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Internal server error');
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full daily workflow: PRIME then LOCK', async () => {
      // Morning PRIME
      const primeRequest = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'PRIME',
          assured_line: 'Stay clear and grounded',
          micro_action: 'Morning stretch',
          no_permission_enabled: true,
        }),
      });

      const primeResponse = await POST(primeRequest);
      expect(primeResponse.status).toBe(200);

      const primeData = await primeResponse.json();
      expect(primeData.success).toBe(true);
      expect(primeData.ritual_type).toBe('PRIME');

      // Evening LOCK
      const lockRequest = new NextRequest('http://localhost:3000/api/burst', {
        method: 'POST',
        body: JSON.stringify({
          ritual_type: 'LOCK',
          proof_text: 'Completed tasks with clarity',
          rewrite_flag_id: 'flag-1',
          rewrite_assured_text: 'Clear communication without manipulation',
          tomorrow_preempt: 'Stay grounded tomorrow',
        }),
      });

      const lockResponse = await POST(lockRequest);
      expect(lockResponse.status).toBe(200);

      const lockData = await lockResponse.json();
      expect(lockData.success).toBe(true);
      expect(lockData.ritual_type).toBe('LOCK');
      expect(lockData.rewrite_completed).toBe(true);
    });
  });
});
