/**
 * Cortex API Route Tests
 * Tests for /api/cortex endpoint - Cognitive Synthesis Engine
 */

import { GET, POST } from '@/app/api/cortex/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

jest.mock('@/lib/auth/user', () => ({
  currentUserOrThrow: jest.fn(),
}));

jest.mock('@/lib/cortex/synthesis-loop', () => ({
  getSynthesisLoop: jest.fn(),
}));

jest.mock('@/lib/cortex/working-memory', () => ({
  getWorkingMemory: jest.fn(),
}));

const { currentUserOrThrow } = require('@/lib/auth/user');
const { getSynthesisLoop } = require('@/lib/cortex/synthesis-loop');
const { getWorkingMemory } = require('@/lib/cortex/working-memory');

describe('Cortex API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth mock
    currentUserOrThrow.mockReturnValue({ userId: 'test-user-id' });
  });

  const mockSynthesisLoop = {
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };

  const mockWorkingMemory = {
    getStats: jest.fn(),
  };

  describe('GET /api/cortex - Status', () => {
    beforeEach(() => {
      getSynthesisLoop.mockReturnValue(mockSynthesisLoop);
      getWorkingMemory.mockReturnValue(mockWorkingMemory);
    });

    it('should return cortex status with complete structure', async () => {
      mockSynthesisLoop.getStatus.mockReturnValue({
        isRunning: true,
        lastSynthesisAt: '2025-01-31T12:00:00Z',
        nextSynthesisAt: '2025-01-31T12:05:00Z',
        taskCount: 5,
      });

      mockWorkingMemory.getStats.mockResolvedValue({
        unprocessedEvents: 10,
        totalEvents: 100,
        eventsBySource: { email: 50, calendar: 30, chat: 20 },
        processedLast24h: 45,
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('lastSynthesisAt');
      expect(data).toHaveProperty('nextSynthesisAt');
      expect(data).toHaveProperty('eventCount');
      expect(data).toHaveProperty('totalEventCount');
      expect(data).toHaveProperty('taskCount');
      expect(data).toHaveProperty('eventsBySource');
      expect(data).toHaveProperty('processedLast24h');
      expect(data).toHaveProperty('config');
    });

    it('should return active status when processing events', async () => {
      mockSynthesisLoop.getStatus.mockReturnValue({
        isRunning: true,
        lastSynthesisAt: '2025-01-31T12:00:00Z',
        nextSynthesisAt: '2025-01-31T12:05:00Z',
        taskCount: 3,
      });

      mockWorkingMemory.getStats.mockResolvedValue({
        unprocessedEvents: 5, // >= 3 triggers active
        totalEvents: 50,
        eventsBySource: {},
        processedLast24h: 20,
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('active');
    });

    it('should return idle status when few events pending', async () => {
      mockSynthesisLoop.getStatus.mockReturnValue({
        isRunning: true,
        lastSynthesisAt: '2025-01-31T12:00:00Z',
        nextSynthesisAt: '2025-01-31T12:05:00Z',
        taskCount: 0,
      });

      mockWorkingMemory.getStats.mockResolvedValue({
        unprocessedEvents: 1, // < 3 triggers idle
        totalEvents: 50,
        eventsBySource: {},
        processedLast24h: 20,
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('idle');
    });

    it('should return disabled status when loop not running', async () => {
      mockSynthesisLoop.getStatus.mockReturnValue({
        isRunning: false,
        lastSynthesisAt: null,
        nextSynthesisAt: null,
        taskCount: 0,
      });

      mockWorkingMemory.getStats.mockResolvedValue({
        unprocessedEvents: 10,
        totalEvents: 50,
        eventsBySource: {},
        processedLast24h: 0,
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);
      const data = await response.json();

      expect(data.status).toBe('disabled');
    });

    it('should return 401 when unauthorized', async () => {
      currentUserOrThrow.mockImplementation(() => {
        throw new Error('unauthorized');
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.ok).toBe(false);
    });

    it('should return 500 on internal error', async () => {
      mockSynthesisLoop.getStatus.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/cortex');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Failed to get cortex status');
    });
  });

  describe('POST /api/cortex - Control Loop', () => {
    beforeEach(() => {
      getSynthesisLoop.mockReturnValue(mockSynthesisLoop);
    });

    it('should start the synthesis loop', async () => {
      mockSynthesisLoop.getStatus.mockReturnValue({
        isRunning: true,
        nextSynthesisAt: '2025-01-31T12:05:00Z',
      });

      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.status).toBe('active');
      expect(data.message).toBe('Synthesis loop started');
      expect(mockSynthesisLoop.start).toHaveBeenCalledTimes(1);
    });

    it('should stop the synthesis loop', async () => {
      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'stop' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.status).toBe('disabled');
      expect(data.message).toBe('Synthesis loop stopped');
      expect(mockSynthesisLoop.stop).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when action is missing', async () => {
      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Missing action parameter');
    });

    it('should return 400 for unknown action', async () => {
      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknown' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('Unknown action');
    });

    it('should return 501 for configure action without restart', async () => {
      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({
          action: 'configure',
          config: { intervalMs: 60000 },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(501);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('restart');
    });

    it('should return 400 for configure action without config', async () => {
      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'configure' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Missing config parameter');
    });

    it('should return 401 when unauthorized', async () => {
      currentUserOrThrow.mockImplementation(() => {
        throw new Error('unauthorized');
      });

      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 500 on internal error', async () => {
      mockSynthesisLoop.start.mockImplementation(() => {
        throw new Error('Failed to start loop');
      });

      const request = new NextRequest('http://localhost/api/cortex', {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.ok).toBe(false);
    });
  });
});
