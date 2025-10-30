/**
 * Tests for UIX Metrics API Route (app/api/uix/route.ts)
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/uix/route';
import * as queries from '@/lib/db/queries';
import * as metrics from '@/lib/metrics';
import type { UIXMetrics } from '@/lib/metrics';
import type { Tweak, Flag, Recovery } from '@/lib/db/types';

// Mock dependencies
jest.mock('@/lib/db/queries');
jest.mock('@/lib/metrics');

describe('UIX Metrics API Route', () => {
  const mockTweaks: Tweak[] = [
    {
      id: 'tweak-1',
      flag_id: 'flag-1',
      assured_text: 'Confident response',
      action_type: 'rewrite',
      context: null,
      delta_uix: 20,
      user_notes: null,
      created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      updated_at: Math.floor(Date.now() / 1000) - 3600,
    },
  ];

  const mockFlags: Flag[] = [
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
  ];

  const mockRecovery: Recovery = {
    id: 'recovery-1',
    date: '2025-01-31',
    score: 78,
    hrv: 65,
    rhr: 55,
    spo2: 98,
    skin_temp: 33.5,
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  };

  const mockUIXMetrics: UIXMetrics = {
    overall_score: 65,
    pillars: {
      word: 20,
      action: 0,
      body: 78,
    },
    delta: 5,
    open_flags: 1,
    penalties: {
      open_flags_penalty: 1,
      recency_factor: 0.95,
    },
    top_fixes: [
      {
        flag_id: 'flag-1',
        original_text: 'Manipulative phrase',
        suggested_lift: 15,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (queries.getTweaksLastNHours as jest.Mock).mockResolvedValue(mockTweaks);
    (queries.getAllFlags as jest.Mock).mockResolvedValue(mockFlags);
    (queries.getLatestRecovery as jest.Mock).mockResolvedValue(mockRecovery);
    (metrics.getPreviousUIXScore as jest.Mock).mockResolvedValue(60);
    (metrics.calculateUIXMetrics as jest.Mock).mockReturnValue(mockUIXMetrics);
  });

  describe('GET /api/uix', () => {
    it('should return comprehensive UIX metrics with all fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();

      expect(data).toEqual(mockUIXMetrics);
      expect(data.overall_score).toBe(65);
      expect(data.pillars.word).toBe(20);
      expect(data.pillars.action).toBe(0);
      expect(data.pillars.body).toBe(78);
      expect(data.delta).toBe(5);
      expect(data.open_flags).toBe(1);
      expect(data.top_fixes).toHaveLength(1);
    });

    it('should fetch tweaks from last 72 hours', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(queries.getTweaksLastNHours).toHaveBeenCalledWith(72);
    });

    it('should fetch all flags', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(queries.getAllFlags).toHaveBeenCalledTimes(1);
    });

    it('should fetch latest recovery data', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(queries.getLatestRecovery).toHaveBeenCalledTimes(1);
    });

    it('should calculate previous UIX score', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(metrics.getPreviousUIXScore).toHaveBeenCalledWith(
        mockTweaks,
        mockFlags,
        78 // recovery score
      );
    });

    it('should calculate current UIX metrics with all parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(metrics.calculateUIXMetrics).toHaveBeenCalledWith(
        mockTweaks,
        mockFlags,
        60, // previous score
        78 // recovery score
      );
    });

    it('should handle null recovery data', async () => {
      (queries.getLatestRecovery as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/uix');
      await GET(request);

      expect(metrics.getPreviousUIXScore).toHaveBeenCalledWith(
        mockTweaks,
        mockFlags,
        null
      );
      expect(metrics.calculateUIXMetrics).toHaveBeenCalledWith(
        mockTweaks,
        mockFlags,
        60,
        null
      );
    });

    it('should handle empty tweaks array', async () => {
      (queries.getTweaksLastNHours as jest.Mock).mockResolvedValue([]);
      (metrics.calculateUIXMetrics as jest.Mock).mockReturnValue({
        ...mockUIXMetrics,
        overall_score: 50, // Base score when no tweaks
        pillars: { word: 0, action: 0, body: 78 },
      });

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      const data = await response.json();
      expect(data.overall_score).toBe(50);
      expect(data.pillars.word).toBe(0);
      expect(data.pillars.action).toBe(0);
    });

    it('should handle no open flags', async () => {
      const resolvedFlags = mockFlags.map((f) => ({ ...f, status: 'resolved' as const }));
      (queries.getAllFlags as jest.Mock).mockResolvedValue(resolvedFlags);
      (metrics.calculateUIXMetrics as jest.Mock).mockReturnValue({
        ...mockUIXMetrics,
        open_flags: 0,
        penalties: { ...mockUIXMetrics.penalties, open_flags_penalty: 0 },
        top_fixes: [],
      });

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      const data = await response.json();
      expect(data.open_flags).toBe(0);
      expect(data.penalties.open_flags_penalty).toBe(0);
      expect(data.top_fixes).toHaveLength(0);
    });

    it('should include Cache-Control header', async () => {
      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=60');
    });
  });

  describe('Error Handling', () => {
    it('should handle getTweaksLastNHours error', async () => {
      (queries.getTweaksLastNHours as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error while calculating UIX metrics');
    });

    it('should handle getAllFlags error', async () => {
      (queries.getAllFlags as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle getLatestRecovery error', async () => {
      (queries.getLatestRecovery as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle getPreviousUIXScore error', async () => {
      (metrics.getPreviousUIXScore as jest.Mock).mockRejectedValue(
        new Error('Calculation error')
      );

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle calculateUIXMetrics error', async () => {
      (metrics.calculateUIXMetrics as jest.Mock).mockImplementation(() => {
        throw new Error('Calculation error');
      });

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle high confidence scenario (many recent tweaks, no flags)', async () => {
      const manyTweaks = Array.from({ length: 10 }, (_, i) => ({
        ...mockTweaks[0],
        id: `tweak-${i}`,
        delta_uix: 10,
      }));
      (queries.getTweaksLastNHours as jest.Mock).mockResolvedValue(manyTweaks);
      (queries.getAllFlags as jest.Mock).mockResolvedValue([]);
      (metrics.calculateUIXMetrics as jest.Mock).mockReturnValue({
        ...mockUIXMetrics,
        overall_score: 95,
        open_flags: 0,
        top_fixes: [],
      });

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      const data = await response.json();
      expect(data.overall_score).toBe(95);
      expect(data.open_flags).toBe(0);
    });

    it('should handle low confidence scenario (no tweaks, many flags)', async () => {
      (queries.getTweaksLastNHours as jest.Mock).mockResolvedValue([]);
      const manyFlags = Array.from({ length: 5 }, (_, i) => ({
        ...mockFlags[0],
        id: `flag-${i}`,
        severity: 4,
      }));
      (queries.getAllFlags as jest.Mock).mockResolvedValue(manyFlags);
      (metrics.calculateUIXMetrics as jest.Mock).mockReturnValue({
        ...mockUIXMetrics,
        overall_score: 25,
        open_flags: 5,
        penalties: {
          open_flags_penalty: 5,
          recency_factor: 0,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/uix');
      const response = await GET(request);

      const data = await response.json();
      expect(data.overall_score).toBe(25);
      expect(data.open_flags).toBe(5);
    });
  });
});
