/**
 * Test Suite: Tweak API Route
 *
 * Tests the confidence rewrite API that logs tweaks and resolves manipulation flags.
 * Covers:
 * - Rewrite actions with assured text
 * - Dismiss false positives
 * - Escalate for review
 * - UIX delta calculations
 * - Flag status updates
 */

import { POST } from '@/app/api/tweak/route';
import { NextRequest } from 'next/server';
import * as queries from '@/lib/db/queries';
import { Flag } from '@/lib/db/types';

// Mock database queries
jest.mock('@/lib/db/queries');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-tweak-id'),
}));

describe('Tweak API Route', () => {
  const mockFlag: Flag = {
    id: 'flag-1',
    lifelog_id: 'lifelog-1',
    original_text: 'You always overreact',
    manipulation_type: 'gaslighting',
    severity: 3,
    status: 'pending',
    timestamp: Math.floor(Date.now() / 1000),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (queries.getFlag as jest.Mock).mockReturnValue(mockFlag);
    (queries.insertTweaks as jest.Mock).mockImplementation(() => {});
    (queries.updateFlagStatus as jest.Mock).mockImplementation(() => {});
  });

  describe('POST /api/tweak - Rewrite Actions', () => {
    it('should log rewrite with assured text and calculate UIX delta', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'I understand you see it differently, but I experienced it this way',
          action_type: 'rewrite',
          context: 'Responding to gaslighting attempt',
          user_notes: 'Stayed calm and assertive',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tweak_id).toBe('test-tweak-id');
      expect(data.flag_id).toBe('flag-1');
      expect(data.flag_status).toBe('resolved');
      expect(data.delta_uix).toBeGreaterThan(0);
      expect(data.action_type).toBe('rewrite');

      // Verify tweak was inserted
      expect(queries.insertTweaks).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'test-tweak-id',
          flag_id: 'flag-1',
          assured_text: 'I understand you see it differently, but I experienced it this way',
          action_type: 'rewrite',
          context: 'Responding to gaslighting attempt',
          delta_uix: expect.any(Number),
          user_notes: 'Stayed calm and assertive',
        }),
      ]);

      // Verify flag was resolved
      expect(queries.updateFlagStatus).toHaveBeenCalledWith('flag-1', 'resolved');
    });

    it('should calculate higher UIX delta for longer rewrites', async () => {
      const shortRewrite = 'I disagree';
      const longRewrite = 'I understand you see it differently, but from my perspective, this is what happened, and I need you to respect that my experience is valid even if it differs from yours';

      // Test short rewrite
      const shortRequest = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: shortRewrite,
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const shortResponse = await POST(shortRequest);
      const shortData = await shortResponse.json();

      // Test long rewrite
      const longRequest = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: longRewrite,
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const longResponse = await POST(longRequest);
      const longData = await longResponse.json();

      expect(longData.delta_uix).toBeGreaterThan(shortData.delta_uix);
    });

    it('should calculate higher UIX delta for higher severity flags', async () => {
      const lowSeverityFlag: Flag = { ...mockFlag, severity: 1 };
      const highSeverityFlag: Flag = { ...mockFlag, severity: 5 };

      // Test low severity
      (queries.getFlag as jest.Mock).mockReturnValue(lowSeverityFlag);
      const lowRequest = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'I understand your concern',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const lowResponse = await POST(lowRequest);
      const lowData = await lowResponse.json();

      // Test high severity
      (queries.getFlag as jest.Mock).mockReturnValue(highSeverityFlag);
      const highRequest = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'I understand your concern',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const highResponse = await POST(highRequest);
      const highData = await highResponse.json();

      expect(highData.delta_uix).toBeGreaterThan(lowData.delta_uix);
    });

    it('should cap UIX delta at 30 points', async () => {
      const veryHighSeverityFlag: Flag = { ...mockFlag, severity: 5 };
      (queries.getFlag as jest.Mock).mockReturnValue(veryHighSeverityFlag);

      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'This is a very long and thoughtful rewrite with more than twenty words to demonstrate the maximum UIX score calculation and the cap at thirty points total',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.delta_uix).toBeLessThanOrEqual(30);
    });

    it('should reject rewrite without assured_text', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: '',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('assured_text is required');
    });
  });

  describe('POST /api/tweak - Dismiss Actions', () => {
    it('should dismiss false positive with 0 UIX delta', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: null,
          action_type: 'dismiss',
          context: 'False positive - this was actually a joke',
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.delta_uix).toBe(0);
      expect(data.flag_status).toBe('dismissed');

      // Verify flag was dismissed (not resolved)
      expect(queries.updateFlagStatus).toHaveBeenCalledWith('flag-1', 'dismissed');
    });

    it('should allow dismiss with null assured_text', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: null,
          action_type: 'dismiss',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/tweak - Escalate Actions', () => {
    it('should escalate flag with +5 UIX delta', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: null,
          action_type: 'escalate',
          context: 'Need to discuss this pattern with therapist',
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.delta_uix).toBe(5);
      expect(data.flag_status).toBe('resolved');

      // Verify flag was resolved (not dismissed)
      expect(queries.updateFlagStatus).toHaveBeenCalledWith('flag-1', 'resolved');
    });
  });

  describe('POST /api/tweak - Validation', () => {
    it('should reject missing flag_id', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject missing action_type', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject invalid action_type', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          action_type: 'invalid',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid action_type');
    });

    it('should reject non-existent flag', async () => {
      (queries.getFlag as jest.Mock).mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'non-existent-flag',
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Flag not found');
    });

    it('should reject already resolved flag', async () => {
      const resolvedFlag: Flag = { ...mockFlag, status: 'resolved' };
      (queries.getFlag as jest.Mock).mockReturnValue(resolvedFlag);

      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already resolved');
      expect(data.current_status).toBe('resolved');
    });
  });

  describe('POST /api/tweak - Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: 'not json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });

    it('should handle database errors during tweak insert', async () => {
      (queries.insertTweaks as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });

    it('should handle database errors during flag status update', async () => {
      (queries.updateFlagStatus as jest.Mock).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('POST /api/tweak - Integration Scenarios', () => {
    it('should handle complete rewrite workflow', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'I appreciate your input, but I need to trust my own judgment here',
          action_type: 'rewrite',
          context: 'Family dinner conflict',
          user_notes: 'Maintained composure despite provocation',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify complete workflow execution
      expect(queries.getFlag).toHaveBeenCalledWith('flag-1');
      expect(queries.insertTweaks).toHaveBeenCalledTimes(1);
      expect(queries.updateFlagStatus).toHaveBeenCalledTimes(1);

      // Verify tweak data structure
      const tweakCall = (queries.insertTweaks as jest.Mock).mock.calls[0][0][0];
      expect(tweakCall).toMatchObject({
        id: 'test-tweak-id',
        flag_id: 'flag-1',
        assured_text: 'I appreciate your input, but I need to trust my own judgment here',
        action_type: 'rewrite',
        context: 'Family dinner conflict',
        delta_uix: expect.any(Number),
        user_notes: 'Maintained composure despite provocation',
      });
    });

    it('should handle dismiss workflow', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: null,
          action_type: 'dismiss',
          context: 'Context shows this was playful banter',
          user_notes: 'Both parties laughing',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flag_status).toBe('dismissed');
      expect(data.delta_uix).toBe(0);
    });

    it('should handle escalate workflow', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: null,
          action_type: 'escalate',
          context: 'Needs professional guidance',
          user_notes: 'Pattern detected over multiple interactions',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.flag_status).toBe('resolved');
      expect(data.delta_uix).toBe(5);
    });
  });

  describe('POST /api/tweak - Cache-Control Headers', () => {
    it('should include Cache-Control header for private data', async () => {
      const request = new NextRequest('http://localhost:3000/api/tweak', {
        method: 'POST',
        body: JSON.stringify({
          flag_id: 'flag-1',
          assured_text: 'Some text',
          action_type: 'rewrite',
          context: null,
          user_notes: null,
        }),
      });

      const response = await POST(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });
  });
});
