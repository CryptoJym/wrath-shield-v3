// @ts-nocheck
/**
 * Tests for forge-memory-client.ts
 * TypeScript client for the Memory Layer service (Mem0)
 */

import {
  getMemoryClient,
  ForgeMemoryClient,
  recordItemResponse,
  recordSessionComplete,
  recordMisconceptionFromResponse,
  getGenerationContext,
} from '@/lib/hyro/forge-memory-client';
import type {
  MemoryAddRequest,
  MemorySearchRequest,
  MemoryResponse,
  MisconceptionRecord,
  PerformanceEvent,
  StudentContext,
  HealthStatus,
} from '@/lib/hyro/forge-memory-client';

// ============================================================================
// Mocks
// ============================================================================

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Reset module singleton between tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// ============================================================================
// Type Tests
// ============================================================================

describe('forge-memory-client types', () => {
  describe('MemoryAddRequest interface', () => {
    it('should have required properties', () => {
      const request: MemoryAddRequest = {
        student_id: 'student-123',
        content: 'Learning content',
      };

      expect(request.student_id).toBeDefined();
      expect(request.content).toBeDefined();
    });

    it('should support optional properties', () => {
      const request: MemoryAddRequest = {
        student_id: 'student-123',
        content: 'Learning content',
        metadata: { topic: 'algebra' },
        stat: 'math',
        session_id: 'session-456',
      };

      expect(request.metadata).toBeDefined();
      expect(request.stat).toBe('math');
      expect(request.session_id).toBe('session-456');
    });
  });

  describe('MemorySearchRequest interface', () => {
    it('should have required properties', () => {
      const request: MemorySearchRequest = {
        student_id: 'student-123',
        query: 'algebra concepts',
      };

      expect(request.student_id).toBeDefined();
      expect(request.query).toBeDefined();
    });

    it('should support optional properties', () => {
      const request: MemorySearchRequest = {
        student_id: 'student-123',
        query: 'algebra concepts',
        stat: 'math',
        limit: 10,
      };

      expect(request.stat).toBe('math');
      expect(request.limit).toBe(10);
    });
  });

  describe('MemoryResponse interface', () => {
    it('should support success response', () => {
      const response: MemoryResponse<string[]> = {
        success: true,
        data: ['memory1', 'memory2'],
      };

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
    });

    it('should support error response', () => {
      const response: MemoryResponse = {
        success: false,
        error: 'Connection failed',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Connection failed');
    });
  });

  describe('MisconceptionRecord interface', () => {
    it('should have required properties', () => {
      const record: MisconceptionRecord = {
        student_id: 'student-123',
        stat: 'math',
        strand: 'algebra',
        misconception: 'Order of operations error',
      };

      expect(record.student_id).toBeDefined();
      expect(record.stat).toBeDefined();
      expect(record.strand).toBeDefined();
      expect(record.misconception).toBeDefined();
    });

    it('should support optional properties', () => {
      const record: MisconceptionRecord = {
        student_id: 'student-123',
        stat: 'math',
        strand: 'algebra',
        misconception: 'Order of operations error',
        item_id: 'item-789',
        severity: 0.7,
      };

      expect(record.item_id).toBe('item-789');
      expect(record.severity).toBe(0.7);
    });
  });

  describe('PerformanceEvent interface', () => {
    it('should have required properties', () => {
      const event: PerformanceEvent = {
        student_id: 'student-123',
        stat: 'math',
        event_type: 'item_response',
        data: { correct: true },
      };

      expect(event.student_id).toBeDefined();
      expect(event.stat).toBeDefined();
      expect(event.event_type).toBeDefined();
      expect(event.data).toBeDefined();
    });

    it('should support all event types', () => {
      const eventTypes = [
        'item_response',
        'session_complete',
        'mastery_achieved',
        'struggle_detected',
        'zpd_updated',
      ];

      eventTypes.forEach((type) => {
        const event: PerformanceEvent = {
          student_id: 'student-123',
          stat: 'math',
          event_type: type,
          data: {},
        };
        expect(event.event_type).toBe(type);
      });
    });
  });

  describe('StudentContext interface', () => {
    it('should have required properties', () => {
      const context: StudentContext = {
        student_id: 'student-123',
        stat: 'math',
        memories: [],
        misconceptions: [],
        recent_events: [],
        generated_at: new Date().toISOString(),
      };

      expect(context.student_id).toBeDefined();
      expect(context.memories).toBeDefined();
      expect(context.misconceptions).toBeDefined();
      expect(context.recent_events).toBeDefined();
    });

    it('should support null stat', () => {
      const context: StudentContext = {
        student_id: 'student-123',
        stat: null,
        memories: [],
        misconceptions: [],
        recent_events: [],
        generated_at: new Date().toISOString(),
      };

      expect(context.stat).toBeNull();
    });
  });

  describe('HealthStatus interface', () => {
    it('should have required properties', () => {
      const status: HealthStatus = {
        status: 'healthy',
        mem0_available: true,
        mem0_initialized: true,
        timestamp: new Date().toISOString(),
      };

      expect(status.status).toBeDefined();
      expect(status.mem0_available).toBeDefined();
      expect(status.mem0_initialized).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });
  });
});

// ============================================================================
// ForgeMemoryClient Tests
// ============================================================================

describe('ForgeMemoryClient', () => {
  describe('constructor', () => {
    it('should create client with default values', () => {
      const client = new ForgeMemoryClient();
      expect(client).toBeDefined();
    });

    it('should create client with custom URL', () => {
      const client = new ForgeMemoryClient('http://custom:9000');
      expect(client).toBeDefined();
    });

    it('should create disabled client', () => {
      const client = new ForgeMemoryClient('http://localhost:8789', false);
      expect(client).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should return null when disabled', async () => {
      const client = new ForgeMemoryClient('http://localhost:8789', false);

      const result = await client.checkHealth();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return health status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          mem0_available: true,
          mem0_initialized: true,
          timestamp: new Date().toISOString(),
        }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.checkHealth();

      expect(result).not.toBeNull();
      expect(result?.status).toBe('healthy');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const client = new ForgeMemoryClient();
      const result = await client.checkHealth();

      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const client = new ForgeMemoryClient();
      const result = await client.checkHealth();

      expect(result).toBeNull();
    });
  });

  describe('isAvailable', () => {
    it('should return false when disabled', async () => {
      const client = new ForgeMemoryClient('http://localhost:8789', false);

      const result = await client.isAvailable();

      expect(result).toBe(false);
    });

    it('should check health if not already checked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should cache health check result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });

      const client = new ForgeMemoryClient();

      await client.isAvailable();
      await client.isAvailable();

      // Should only call fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('addMemory', () => {
    it('should send memory add request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 'mem-123' } }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.addMemory({
        student_id: 'student-123',
        content: 'Test memory',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/add'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    it('should return error when disabled', async () => {
      const client = new ForgeMemoryClient('http://localhost:8789', false);

      const result = await client.addMemory({
        student_id: 'student-123',
        content: 'Test memory',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Memory service disabled');
    });
  });

  describe('searchMemory', () => {
    it('should send memory search request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [{ content: 'result' }] }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.searchMemory({
        student_id: 'student-123',
        query: 'test query',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/search'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getMemoryHistory', () => {
    it('should fetch memory history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.getMemoryHistory('student-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/history/student-123'),
        expect.any(Object)
      );
    });
  });

  describe('recordMisconception', () => {
    it('should send misconception record', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.recordMisconception({
        student_id: 'student-123',
        stat: 'math',
        strand: 'algebra',
        misconception: 'Test misconception',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/misconception/record'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getMisconceptions', () => {
    it('should fetch misconceptions without stat filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const client = new ForgeMemoryClient();
      await client.getMisconceptions('student-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/misconception/get/student-123'),
        expect.any(Object)
      );
    });

    it('should fetch misconceptions with stat filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const client = new ForgeMemoryClient();
      await client.getMisconceptions('student-123', 'math');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('stat=math'),
        expect.any(Object)
      );
    });
  });

  describe('recordEvent', () => {
    it('should send event record', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.recordEvent({
        student_id: 'student-123',
        stat: 'math',
        event_type: 'item_response',
        data: { correct: true },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/event/record'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getEventTimeline', () => {
    it('should fetch event timeline without filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const client = new ForgeMemoryClient();
      await client.getEventTimeline('student-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/event/timeline/student-123'),
        expect.any(Object)
      );
    });

    it('should fetch event timeline with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });

      const client = new ForgeMemoryClient();
      await client.getEventTimeline('student-123', 'math', 'item_response', 10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/stat=math.*event_type=item_response.*limit=10/),
        expect.any(Object)
      );
    });
  });

  describe('getStudentContext', () => {
    it('should fetch student context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            student_id: 'student-123',
            stat: 'math',
            memories: [],
            misconceptions: [],
            recent_events: [],
            generated_at: new Date().toISOString(),
          },
        }),
      });

      const client = new ForgeMemoryClient();
      const result = await client.getStudentContext('student-123', 'math');

      expect(result.success).toBe(true);
      expect(result.data?.student_id).toBe('student-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile/context'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = new ForgeMemoryClient();
      const result = await client.addMemory({
        student_id: 'student-123',
        content: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new ForgeMemoryClient();
      const result = await client.addMemory({
        student_id: 'student-123',
        content: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

// ============================================================================
// getMemoryClient Tests
// ============================================================================

describe('getMemoryClient', () => {
  it('should return singleton instance', () => {
    const client1 = getMemoryClient();
    const client2 = getMemoryClient();

    expect(client1).toBe(client2);
  });
});

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('convenience functions', () => {
  describe('recordItemResponse', () => {
    it('should skip recording when service unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not available'));

      await recordItemResponse(
        'student-123',
        'math',
        'item-456',
        true,
        5000,
        1.5,
        0.5
      );

      // Should handle gracefully without throwing
    });

    it('should record item response when available', async () => {
      // First call: health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
      // Second call: record event
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await recordItemResponse(
        'student-123',
        'math',
        'item-456',
        true,
        5000,
        1.5,
        0.5
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordSessionComplete', () => {
    it('should skip when service unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not available'));

      await recordSessionComplete(
        'student-123',
        'math',
        'session-789',
        10,
        0.8,
        1.5,
        0.3
      );

      // Should handle gracefully
    });

    it('should record session and add memory when available', async () => {
      // Health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
      // Record event
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      // Add memory
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await recordSessionComplete(
        'student-123',
        'math',
        'session-789',
        10,
        0.8,
        1.5,
        0.3
      );

      // Should call event record and memory add
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('recordMisconceptionFromResponse', () => {
    it('should skip when service unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not available'));

      await recordMisconceptionFromResponse(
        'student-123',
        'math',
        'algebra',
        'Test misconception',
        'item-456'
      );

      // Should handle gracefully
    });

    it('should record misconception when available', async () => {
      // Health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
      // Record misconception
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await recordMisconceptionFromResponse(
        'student-123',
        'math',
        'algebra',
        'Test misconception',
        'item-456',
        0.7
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getGenerationContext', () => {
    it('should return null when service unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not available'));

      const result = await getGenerationContext('student-123', 'math');

      expect(result).toBeNull();
    });

    it('should return context when available', async () => {
      // Health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
      // Get context
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            student_id: 'student-123',
            stat: 'math',
            memories: [],
            misconceptions: [],
            recent_events: [],
            generated_at: new Date().toISOString(),
          },
        }),
      });

      const result = await getGenerationContext('student-123', 'math');

      expect(result).not.toBeNull();
      expect(result?.student_id).toBe('student-123');
    });

    it('should return null on API error', async () => {
      // Health check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      });
      // Get context fails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Not found' }),
      });

      const result = await getGenerationContext('student-123', 'math');

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty response data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const client = new ForgeMemoryClient();
    const result = await client.getMemoryHistory('student-123');

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('should handle special characters in student ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const client = new ForgeMemoryClient();
    await client.getMemoryHistory('student-123+test@email.com');

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle very long content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const client = new ForgeMemoryClient();
    const longContent = 'x'.repeat(10000);

    const result = await client.addMemory({
      student_id: 'student-123',
      content: longContent,
    });

    expect(result.success).toBe(true);
  });

  it('should handle null metadata values', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const client = new ForgeMemoryClient();
    const result = await client.addMemory({
      student_id: 'student-123',
      content: 'Test',
      metadata: { key: null, other: undefined },
    });

    expect(result.success).toBe(true);
  });
});
