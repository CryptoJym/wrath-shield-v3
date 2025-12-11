/**
 * Deck API Route Tests
 * Tests for /api/deck endpoint - Daily Tasks & UIX Gating
 */

import { GET, POST } from '@/app/api/deck/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/db/queries', () => ({
  getTotalUIXScore: jest.fn(),
  getTweaksLastNHours: jest.fn(),
  getPendingFlags: jest.fn(),
  getSetting: jest.fn(),
  insertSettings: jest.fn(),
  insertTweaks: jest.fn(),
  updateFlagStatus: jest.fn(),
}));

const {
  getTotalUIXScore,
  getTweaksLastNHours,
  getPendingFlags,
  getSetting,
  insertSettings,
  insertTweaks,
  updateFlagStatus,
} = require('@/lib/db/queries');

describe('Deck API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default healthy state (not gated)
    getTotalUIXScore.mockReturnValue(85);
    getTweaksLastNHours.mockReturnValue([]);
    getPendingFlags.mockReturnValue([]);
    getSetting.mockReturnValue(null);
  });

  const mockPendingFlags = [
    {
      id: 'flag-1',
      original_text: 'Dismissive language detected',
      severity: 2,
      status: 'pending',
    },
    {
      id: 'flag-2',
      original_text: 'Boundary violation pattern',
      severity: 3,
      status: 'pending',
    },
    {
      id: 'flag-3',
      original_text: 'Self-gaslighting detected',
      severity: 1,
      status: 'pending',
    },
  ];

  describe('GET /api/deck', () => {
    it('should return default tasks when none completed', async () => {
      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toHaveLength(3);
      expect(data.tasks[0]).toMatchObject({
        category: 'word',
        completed: false,
      });
      expect(data.tasks[1]).toMatchObject({
        category: 'action',
        completed: false,
      });
      expect(data.tasks[2]).toMatchObject({
        category: 'body',
        completed: false,
      });
    });

    it('should include today_date in response', async () => {
      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.today_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return gating state', async () => {
      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating).toHaveProperty('is_gated');
      expect(data.gating).toHaveProperty('uix_score');
      expect(data.gating).toHaveProperty('consecutive_low_days');
      expect(data.gating).toHaveProperty('flags_stomped');
      expect(data.gating).toHaveProperty('flags_required');
    });

    it('should detect gated state when UIX low for 2 days', async () => {
      const now = Math.floor(Date.now() / 1000);
      getTweaksLastNHours.mockReturnValue([
        // Yesterday - low UIX
        { created_at: now - 12 * 3600, delta_uix: 50 },
        // Day before - also low UIX
        { created_at: now - 36 * 3600, delta_uix: 40 },
      ]);

      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.consecutive_low_days).toBe(2);
      expect(data.gating.reason).toContain('Stomp');
    });

    it('should not be gated when UIX is healthy', async () => {
      const now = Math.floor(Date.now() / 1000);
      getTotalUIXScore.mockReturnValue(85);
      // Provide healthy UIX scores (>=70) for both days
      getTweaksLastNHours.mockReturnValue([
        // Yesterday - healthy UIX
        { created_at: now - 12 * 3600, delta_uix: 80 },
        // Day before - also healthy UIX
        { created_at: now - 36 * 3600, delta_uix: 75 },
      ]);

      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.reason).toBeNull();
    });

    it('should restore task completion state from settings', async () => {
      const today = new Date().toISOString().split('T')[0];
      getSetting.mockImplementation((key: string) => {
        if (key === `deck_tasks_${today}`) {
          return {
            value_enc: JSON.stringify([
              { category: 'word', completed: true },
              { category: 'action', completed: false },
              { category: 'body', completed: true },
            ]),
          };
        }
        return null;
      });

      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.tasks[0].completed).toBe(true);
      expect(data.tasks[1].completed).toBe(false);
      expect(data.tasks[2].completed).toBe(true);
    });

    it('should set Cache-Control header', async () => {
      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });

    it('should handle errors gracefully', async () => {
      getTotalUIXScore.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.tasks).toEqual([]);
      expect(data.gating.is_gated).toBe(false);
    });
  });

  describe('POST /api/deck - Complete Task', () => {
    it('should complete a task successfully', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'word',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('word');
      expect(data.tasks_completed).toBe(1);
      expect(insertSettings).toHaveBeenCalled();
    });

    it('should return 400 for invalid action', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid_action',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid action');
    });

    it('should return 400 when task_category missing', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('task_category');
    });

    it('should return 400 for invalid task_category', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'invalid',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Invalid task_category');
    });

    it('should update existing task state', async () => {
      const today = new Date().toISOString().split('T')[0];
      getSetting.mockImplementation((key: string) => {
        if (key === `deck_tasks_${today}`) {
          return {
            value_enc: JSON.stringify([
              { category: 'word', completed: true },
              { category: 'action', completed: false },
              { category: 'body', completed: false },
            ]),
          };
        }
        return null;
      });

      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'action',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks_completed).toBe(2); // word + action now completed
    });
  });

  describe('POST /api/deck - Stomp Flag', () => {
    beforeEach(() => {
      // Set up gated state
      const now = Math.floor(Date.now() / 1000);
      getTweaksLastNHours.mockReturnValue([
        { created_at: now - 12 * 3600, delta_uix: 50 },
        { created_at: now - 36 * 3600, delta_uix: 40 },
      ]);
      getPendingFlags.mockReturnValue(mockPendingFlags);
    });

    it('should stomp a flag successfully', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(1);
      expect(insertTweaks).toHaveBeenCalled();
      expect(updateFlagStatus).toHaveBeenCalledWith('flag-1', 'resolved');
    });

    it('should return 400 when flag_id missing', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('flag_id');
    });

    it('should return 400 when deck not gated', async () => {
      // Reset to healthy state with good UIX scores
      const now = Math.floor(Date.now() / 1000);
      getTweaksLastNHours.mockReturnValue([
        // Yesterday - healthy UIX (>=70)
        { created_at: now - 12 * 3600, delta_uix: 80 },
        // Day before - also healthy UIX (>=70)
        { created_at: now - 36 * 3600, delta_uix: 75 },
      ]);

      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('not gated');
    });

    it('should return 404 when flag not found', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'nonexistent-flag',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toContain('not found');
    });

    it('should unlock deck after 3 flags stomped', async () => {
      // Set up with 2 flags already stomped
      getSetting.mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return { value_enc: '2' };
        }
        return null;
      });

      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-3',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.unlocked).toBe(true);
      expect(data.message).toContain('unlocked');
      // Should reset counter
      expect(insertSettings).toHaveBeenCalledWith([
        expect.objectContaining({ key: 'deck_flags_stomped', value_enc: '0' }),
      ]);
    });

    it('should calculate UIX delta based on flag severity', async () => {
      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-2', // severity 3
        }),
      });

      await POST(request);

      expect(insertTweaks).toHaveBeenCalledWith([
        expect.objectContaining({
          flag_id: 'flag-2',
          delta_uix: 45, // 3 * 15
        }),
      ]);
    });

    it('should increment stomped count correctly', async () => {
      getSetting.mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return { value_enc: '1' };
        }
        return null;
      });

      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.flags_stomped).toBe(2);
      expect(data.unlocked).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on POST errors', async () => {
      getSetting.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const request = new NextRequest('http://localhost/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'word',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Internal server error');
    });
  });
});
