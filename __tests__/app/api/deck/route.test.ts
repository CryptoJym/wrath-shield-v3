/**
 * Tests for Deck API Route (app/api/deck/route.ts)
 * Daily task management and UIX gating enforcement
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/deck/route';
import * as queries from '@/lib/db/queries';
import type { Flag, Setting, Tweak } from '@/lib/db/types';

// Mock dependencies
jest.mock('@/lib/db/queries');

describe('Deck API Route', () => {
  const mockPendingFlags: Flag[] = [
    {
      id: 'flag-1',
      status: 'pending',
      original_text: 'Manipulative phrase 1',
      detected_at: Math.floor(Date.now() / 1000) - 7200,
      severity: 3,
      manipulation_type: 'gaslighting',
      created_at: Math.floor(Date.now() / 1000) - 7200,
      updated_at: Math.floor(Date.now() / 1000) - 7200,
    },
    {
      id: 'flag-2',
      status: 'pending',
      original_text: 'Manipulative phrase 2',
      detected_at: Math.floor(Date.now() / 1000) - 3600,
      severity: 4,
      manipulation_type: 'guilt',
      created_at: Math.floor(Date.now() / 1000) - 3600,
      updated_at: Math.floor(Date.now() / 1000) - 3600,
    },
    {
      id: 'flag-3',
      status: 'pending',
      original_text: 'Manipulative phrase 3',
      detected_at: Math.floor(Date.now() / 1000) - 1800,
      severity: 2,
      manipulation_type: 'blame',
      created_at: Math.floor(Date.now() / 1000) - 1800,
      updated_at: Math.floor(Date.now() / 1000) - 1800,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (queries.getTotalUIXScore as jest.Mock).mockReturnValue(100);
    (queries.getTweaksLastNHours as jest.Mock).mockReturnValue([]);
    (queries.getPendingFlags as jest.Mock).mockReturnValue(mockPendingFlags);
    (queries.getSetting as jest.Mock).mockReturnValue(null);
    (queries.insertSettings as jest.Mock).mockImplementation(() => {});
  });

  describe('GET /api/deck', () => {
    it('should return default tasks when no state exists', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tasks).toHaveLength(3);
      expect(data.tasks[0]).toEqual({
        category: 'word',
        title: 'Mindful Communication',
        description: 'Speak one truth that feels uncomfortable but necessary',
        completed: false,
      });
      expect(data.tasks[1]).toEqual({
        category: 'action',
        title: 'Boundary Enforcement',
        description: 'Say "no" to one request that compromises your values',
        completed: false,
      });
      expect(data.tasks[2]).toEqual({
        category: 'body',
        title: 'Physical Grounding',
        description: 'Complete 10 minutes of intentional movement or breathwork',
        completed: false,
      });
      expect(data.today_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return tasks with completion state from settings', async () => {
      const today = new Date().toISOString().split('T')[0];
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === `deck_tasks_${today}`) {
          return {
            key: `deck_tasks_${today}`,
            value_enc: JSON.stringify([
              { category: 'word', completed: true },
              { category: 'action', completed: false },
              { category: 'body', completed: true },
            ]),
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tasks[0].completed).toBe(true);
      expect(data.tasks[1].completed).toBe(false);
      expect(data.tasks[2].completed).toBe(true);
    });

    it('should return not gated when UIX high both days', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        // Yesterday: UIX 80
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 80, user_notes: null, created_at: oneDayAgo + 100 },
        // Day before: UIX 75
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 75, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.consecutive_low_days).toBe(0);
      expect(data.gating.reason).toBe(null);
    });

    it('should return not gated when UIX low only one day', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        // Yesterday: UIX 65 (low)
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        // Day before: UIX 75 (high)
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 75, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.consecutive_low_days).toBe(1);
      expect(data.gating.reason).toBe(null);
    });

    it('should return gated when UIX low two consecutive days', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        // Yesterday: UIX 65 (low)
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        // Day before: UIX 60 (low)
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.consecutive_low_days).toBe(2);
      expect(data.gating.flags_stomped).toBe(0);
      expect(data.gating.flags_required).toBe(3);
      expect(data.gating.reason).toContain('UIX < 70 for 2 days');
      expect(data.gating.reason).toContain('Stomp 3 more flags');
    });

    it('should track flag stomps when gated', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return {
            key: 'deck_flags_stomped',
            value_enc: '2',
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.flags_stomped).toBe(2);
      expect(data.gating.reason).toContain('Stomp 1 more flag');
    });

    it('should unlock when 3 flags stomped', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return {
            key: 'deck_flags_stomped',
            value_enc: '3',
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.reason).toBe(null);
    });

    it('should handle empty tweaks (no UIX data)', async () => {
      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue([]);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      const data = await response.json();
      expect(data.gating.consecutive_low_days).toBe(2); // 0 < 70 for both days
      expect(data.gating.is_gated).toBe(true);
    });

    it('should include Cache-Control header', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });

    it('should handle database errors gracefully', async () => {
      (queries.getSetting as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.tasks).toEqual([]);
      expect(data.gating.is_gated).toBe(false);
    });
  });

  describe('POST /api/deck - Complete Task', () => {
    it('should complete word task', async () => {
      const today = new Date().toISOString().split('T')[0];

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'word',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('word');
      expect(data.message).toContain('completed');
      expect(data.tasks_completed).toBe(1);
      expect(data.total_tasks).toBe(3);

      // Verify database call
      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: `deck_tasks_${today}`,
            value_enc: expect.stringContaining('"completed":true'),
          }),
        ])
      );
    });

    it('should complete action task', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'action',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('action');
    });

    it('should complete body task', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'body',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('body');
    });

    it('should preserve existing task completions', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Set up existing task state with word already completed
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === `deck_tasks_${today}`) {
          return {
            key: `deck_tasks_${today}`,
            value_enc: JSON.stringify([
              { category: 'word', completed: true },
              { category: 'action', completed: false },
              { category: 'body', completed: false },
            ]),
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'action',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.tasks_completed).toBe(2); // word + action
    });

    it('should reject invalid task category', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'invalid',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid task_category');
    });

    it('should reject missing task_category', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('task_category is required');
    });
  });

  describe('POST /api/deck - Stomp Flag', () => {
    it('should stomp flag when gated', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      // Set up gated state
      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(1);
      expect(data.flags_required).toBe(3);
      expect(data.unlocked).toBe(false);
      expect(data.message).toContain('2 more to unlock');

      // Verify stomp counter updated
      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'deck_flags_stomped',
            value_enc: '1',
          }),
        ])
      );
    });

    it('should unlock after stomping 3rd flag', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      // Already stomped 2 flags
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return {
            key: 'deck_flags_stomped',
            value_enc: '2',
          } as Setting;
        }
        return null;
      });

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(3);
      expect(data.unlocked).toBe(true);
      expect(data.message).toContain('Deck unlocked');
      expect(data.message).toContain('All 3 flags stomped');

      // Verify counter was reset
      expect(queries.insertSettings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'deck_flags_stomped',
            value_enc: '0',
          }),
        ])
      );
    });

    it('should reject stomp when not gated', async () => {
      // Set up non-gated state (high UIX)
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 80, user_notes: null, created_at: oneDayAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('not gated');
    });

    it('should reject non-existent flag', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'nonexistent',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('not found');
    });

    it('should reject missing flag_id', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('flag_id is required');
    });
  });

  describe('POST /api/deck - Error Handling', () => {
    it('should reject invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid_action',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid action');
    });

    it('should reject missing action', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Invalid action');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
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

    it('should handle database errors during task completion', async () => {
      (queries.insertSettings as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'word',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('Internal server error');
    });

    it('should handle database errors during flag stomp', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);
      (queries.insertSettings as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
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
    it('should support full daily workflow: complete tasks then check gating', async () => {
      // Complete all three tasks
      const tasks = ['word', 'action', 'body'];
      for (const task of tasks) {
        const request = new NextRequest('http://localhost:3000/api/deck', {
          method: 'POST',
          body: JSON.stringify({
            action: 'complete_task',
            task_category: task,
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
      }

      // Check gating state
      const getRequest = new NextRequest('http://localhost:3000/api/deck');
      const getResponse = await GET(getRequest);
      expect(getResponse.status).toBe(200);

      const data = await getResponse.json();
      expect(data.gating).toBeDefined();
      expect(data.tasks).toBeDefined();
    });

    it('should support unlock workflow: stomp 3 flags sequentially', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 3600;
      const twoDaysAgo = now - 48 * 3600;

      const mockTweaks: Tweak[] = [
        { id: '1', flag_id: 'f1', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 65, user_notes: null, created_at: oneDayAgo + 100 },
        { id: '2', flag_id: 'f2', assured_text: 'test', action_type: 'rewrite', context: '', delta_uix: 60, user_notes: null, created_at: twoDaysAgo + 100 },
      ];

      (queries.getTweaksLastNHours as jest.Mock).mockReturnValue(mockTweaks);

      let currentStompCount = 0;
      (queries.getSetting as jest.Mock).mockImplementation((key: string) => {
        if (key === 'deck_flags_stomped') {
          return {
            key: 'deck_flags_stomped',
            value_enc: currentStompCount.toString(),
          } as Setting;
        }
        return null;
      });

      // Stomp 3 flags
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/deck', {
          method: 'POST',
          body: JSON.stringify({
            action: 'stomp_flag',
            flag_id: `flag-${i + 1}`,
          }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        currentStompCount = data.flags_stomped;

        if (i === 2) {
          expect(data.unlocked).toBe(true);
        } else {
          expect(data.unlocked).toBe(false);
        }
      }
    });
  });
});
