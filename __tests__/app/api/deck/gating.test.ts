/**
 * Wrath Shield v3 - Deck Gating Behavioral Tests
 *
 * Tests for gating enforcement: UIX drops, activation, flag stomping, unlocking
 * Requirements:
 * - UIX < 70 for 2 consecutive days triggers gate
 * - Deck locked until 3 flags stomped
 * - Tasks disabled when gated
 * - Unlock workflow resets counter
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/deck/route';
import * as queries from '@/lib/db/queries';
import type { Tweak, Flag, Setting } from '@/lib/db/types';

// Mock database queries
jest.mock('@/lib/db/queries');

describe('Deck Gating Behavioral Tests', () => {
  let mockGetTotalUIXScore: jest.MockedFunction<typeof queries.getTotalUIXScore>;
  let mockGetTweaksLastNHours: jest.MockedFunction<typeof queries.getTweaksLastNHours>;
  let mockGetPendingFlags: jest.MockedFunction<typeof queries.getPendingFlags>;
  let mockGetSetting: jest.MockedFunction<typeof queries.getSetting>;
  let mockInsertSettings: jest.MockedFunction<typeof queries.insertSettings>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetTotalUIXScore = queries.getTotalUIXScore as jest.MockedFunction<typeof queries.getTotalUIXScore>;
    mockGetTweaksLastNHours = queries.getTweaksLastNHours as jest.MockedFunction<typeof queries.getTweaksLastNHours>;
    mockGetPendingFlags = queries.getPendingFlags as jest.MockedFunction<typeof queries.getPendingFlags>;
    mockGetSetting = queries.getSetting as jest.MockedFunction<typeof queries.getSetting>;
    mockInsertSettings = queries.insertSettings as jest.MockedFunction<typeof queries.insertSettings>;

    // Default mocks
    mockGetTotalUIXScore.mockReturnValue(100);
    mockGetTweaksLastNHours.mockReturnValue([]);
    mockGetPendingFlags.mockReturnValue([]);
    mockGetSetting.mockReturnValue(null);
    mockInsertSettings.mockImplementation(() => {});
  });

  describe('Gating Activation', () => {
    it('should NOT gate deck when UIX >= 70 for both days', async () => {
      // Yesterday: 80 UIX
      // Day before: 85 UIX
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 80, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 85, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(165);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.consecutive_low_days).toBe(0);
      expect(data.gating.reason).toBeNull();
    });

    it('should NOT gate deck with only 1 consecutive low day', async () => {
      // Yesterday: 60 UIX (low)
      // Day before: 80 UIX (high)
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 80, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(140);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.consecutive_low_days).toBe(1);
    });

    it('should GATE deck when UIX < 70 for 2 consecutive days', async () => {
      // Yesterday: 60 UIX (low)
      // Day before: 65 UIX (low)
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(125);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.consecutive_low_days).toBe(2);
      expect(data.gating.flags_stomped).toBe(0);
      expect(data.gating.flags_required).toBe(3);
      expect(data.gating.reason).toContain('UIX < 70 for 2 days');
    });

    it('should track consecutive_low_days correctly with multiple tweaks per day', async () => {
      // Yesterday: 30 + 35 = 65 UIX total (low)
      // Day before: 40 + 20 = 60 UIX total (low)
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 30, user_notes: null, created_at: now - 8 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 35, user_notes: null, created_at: now - 16 * 3600 } as Tweak,
        { id: '3', flag_id: 'f3', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 40, user_notes: null, created_at: now - 30 * 3600 } as Tweak,
        { id: '4', flag_id: 'f4', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 20, user_notes: null, created_at: now - 42 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(125);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.consecutive_low_days).toBe(2);
    });
  });

  describe('Flag Stomping', () => {
    beforeEach(() => {
      // Setup gated state (UIX < 70 for 2 days)
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(125);

      // Mock pending flags
      mockGetPendingFlags.mockReturnValue([
        { id: 'flag-1', original_text: 'Test flag 1', severity: 3, manipulation_type: 'gaslighting', status: 'pending', created_at: now - 3600 } as Flag,
        { id: 'flag-2', original_text: 'Test flag 2', severity: 4, manipulation_type: 'guilt', status: 'pending', created_at: now - 7200 } as Flag,
        { id: 'flag-3', original_text: 'Test flag 3', severity: 2, manipulation_type: 'obligation', status: 'pending', created_at: now - 10800 } as Flag,
      ]);
    });

    it('should stomp first flag and update counter', async () => {
      mockGetSetting.mockReturnValue(null); // No previous stomps

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(1);
      expect(data.flags_required).toBe(3);
      expect(data.unlocked).toBe(false);
      expect(data.message).toContain('2 more to unlock');
      expect(mockInsertSettings).toHaveBeenCalledWith([{
        key: 'deck_flags_stomped',
        value_enc: '1',
      }]);
    });

    it('should stomp second flag and update counter', async () => {
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: '1' } as Setting);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-2',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(2);
      expect(data.unlocked).toBe(false);
      expect(data.message).toContain('1 more to unlock');
      expect(mockInsertSettings).toHaveBeenCalledWith([{
        key: 'deck_flags_stomped',
        value_enc: '2',
      }]);
    });

    it('should stomp third flag and UNLOCK deck', async () => {
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: '2' } as Setting);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-3',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.flags_stomped).toBe(3);
      expect(data.unlocked).toBe(true);
      expect(data.message).toBe('Deck unlocked! All 3 flags stomped.');

      // Verify counter was reset
      expect(mockInsertSettings).toHaveBeenCalledTimes(2);
      expect(mockInsertSettings).toHaveBeenCalledWith([{
        key: 'deck_flags_stomped',
        value_enc: '3',
      }]);
      expect(mockInsertSettings).toHaveBeenCalledWith([{
        key: 'deck_flags_stomped',
        value_enc: '0',
      }]);
    });

    it('should reject stomping non-existent flag', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'non-existent-flag',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toContain('not found');
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });

    it('should reject flag stomping when deck is NOT gated', async () => {
      // Mock high UIX (not gated)
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 80, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(180);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('not gated');
      expect(mockInsertSettings).not.toHaveBeenCalled();
    });
  });

  describe('Unlock Workflow', () => {
    it('should unlock deck after 3 flags stomped and show unlocked state', async () => {
      // Setup: 2 flags already stomped
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(125);
      mockGetPendingFlags.mockReturnValue([
        { id: 'flag-3', original_text: 'Last flag', severity: 3, manipulation_type: 'gaslighting', status: 'pending', created_at: now - 3600 } as Flag,
      ]);
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: '2' } as Setting);

      // Stomp third flag
      const stompRequest = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          flag_id: 'flag-3',
        }),
      });

      const stompResponse = await POST(stompRequest);
      const stompData = await stompResponse.json();

      expect(stompData.unlocked).toBe(true);

      // Now check gating state - should show unlocked (counter reset to 0)
      // Simulate UIX has improved (>= 70) so deck stays unlocked
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: '0' } as Setting);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '3', flag_id: 'f3', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 75, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '4', flag_id: 'f4', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 80, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(155);

      const getRequest = new NextRequest('http://localhost:3000/api/deck');
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();

      // UIX has recovered (>= 70 for 2 days) AND counter is 0, so unlocked
      expect(getData.gating.is_gated).toBe(false);
      expect(getData.gating.consecutive_low_days).toBe(0);
      expect(getData.gating.flags_stomped).toBe(0);
    });

    it('should re-gate deck if UIX drops again after unlock', async () => {
      // User unlocked deck, but UIX drops again for 2 days
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '3', flag_id: 'f3', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 55, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '4', flag_id: 'f4', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 50, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(105);
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: '0' } as Setting); // Counter was reset

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(true);
      expect(data.gating.consecutive_low_days).toBe(2);
      expect(data.gating.flags_stomped).toBe(0);
      expect(data.gating.reason).toContain('Stomp 3 more flags');
    });
  });

  describe('Task Completion with Gating', () => {
    it('should allow task completion when deck is NOT gated', async () => {
      // High UIX, not gated
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 85, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(185);
      mockGetSetting.mockReturnValue(null); // No task state yet

      const request = new NextRequest('http://localhost:3000/api/deck', {
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
      expect(data.message).toContain('marked as completed');
      expect(data.tasks_completed).toBe(1);
      expect(mockInsertSettings).toHaveBeenCalled();
    });

    it('should allow task completion even when gated (UI enforces disable, not backend)', async () => {
      // Gated state
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);

      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'complete_task',
          task_category: 'action',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Backend allows it (gating is UI enforcement)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing flag_id gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
        method: 'POST',
        body: JSON.stringify({
          action: 'stomp_flag',
          // flag_id missing
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('flag_id is required');
    });

    it('should handle invalid action type', async () => {
      const request = new NextRequest('http://localhost:3000/api/deck', {
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

    it('should handle corrupted stomped count in settings', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 60, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 65, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetSetting.mockReturnValue({ key: 'deck_flags_stomped', value_enc: 'not-a-number' } as Setting);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      // Should default to 0 when parsing fails
      expect(data.gating.flags_stomped).toBe(0);
      expect(data.gating.is_gated).toBe(true);
    });

    it('should handle exactly UIX = 70 (boundary)', async () => {
      // Exactly 70 should NOT gate
      const now = Math.floor(Date.now() / 1000);
      mockGetTweaksLastNHours.mockReturnValue([
        { id: '1', flag_id: 'f1', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 70, user_notes: null, created_at: now - 12 * 3600 } as Tweak,
        { id: '2', flag_id: 'f2', assured_text: '', action_type: 'rewrite', context: null, delta_uix: 70, user_notes: null, created_at: now - 36 * 3600 } as Tweak,
      ]);
      mockGetTotalUIXScore.mockReturnValue(140);

      const request = new NextRequest('http://localhost:3000/api/deck');
      const response = await GET(request);
      const data = await response.json();

      expect(data.gating.is_gated).toBe(false);
      expect(data.gating.consecutive_low_days).toBe(0);
    });
  });
});
