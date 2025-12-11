/**
 * Limitless Webhook API Route Tests
 * Tests for /api/limitless/webhook endpoint - Lifelog Ingestion
 */

import { GET, POST } from '@/app/api/limitless/webhook/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/cortex/event-ingestor', () => ({
  ingestLimitless: jest.fn(),
}));

const { ingestLimitless } = require('@/lib/cortex/event-ingestor');

describe('Limitless Webhook API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    id: 'lifelog-123',
    startTime: '2025-01-31T10:00:00Z',
    endTime: '2025-01-31T11:00:00Z',
    markdown: 'Meeting transcript content here...',
    title: 'Team Standup Meeting',
    isStarred: false,
  };

  describe('GET /api/limitless/webhook', () => {
    it('should return health check information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.message).toContain('active');
      expect(data.endpoint).toBe('/api/limitless/webhook');
      expect(data.method).toBe('POST');
      expect(data).toHaveProperty('expectedPayload');
    });

    it('should describe expected payload structure', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.expectedPayload).toHaveProperty('id');
      expect(data.expectedPayload).toHaveProperty('startTime');
      expect(data.expectedPayload).toHaveProperty('title');
    });
  });

  describe('POST /api/limitless/webhook', () => {
    it('should ingest valid lifelog successfully', async () => {
      ingestLimitless.mockResolvedValue({
        eventId: 'evt-456',
        duplicate: false,
        classification: {
          urgency: 'medium',
          keywords: ['meeting', 'standup'],
        },
        fastPathed: false,
      });

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.eventId).toBe('evt-456');
      expect(data.duplicate).toBe(false);
      expect(data.classification.urgency).toBe('medium');
    });

    it('should handle duplicate lifelog', async () => {
      ingestLimitless.mockResolvedValue({
        duplicate: true,
        eventId: null,
      });

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.duplicate).toBe(true);
      expect(data.message).toContain('duplicate');
    });

    it('should pass correct input to ingestLimitless', async () => {
      ingestLimitless.mockResolvedValue({
        eventId: 'evt-789',
        duplicate: false,
        classification: { urgency: 'low', keywords: [] },
        fastPathed: false,
      });

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      await POST(request);

      expect(ingestLimitless).toHaveBeenCalledWith({
        summary: validPayload.title,
        transcript: validPayload.markdown,
        timestamp: validPayload.startTime,
        lifelogId: validPayload.id,
        context: {
          startTime: validPayload.startTime,
          endTime: validPayload.endTime,
          isStarred: validPayload.isStarred,
          contents: undefined,
          updatedAt: undefined,
        },
      });
    });

    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify({
          startTime: '2025-01-31T10:00:00Z',
          title: 'Test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('id');
    });

    it('should return 400 when startTime is missing', async () => {
      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify({
          id: 'lifelog-123',
          title: 'Test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('startTime');
    });

    it('should return 400 when title is missing', async () => {
      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify({
          id: 'lifelog-123',
          startTime: '2025-01-31T10:00:00Z',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toContain('title');
    });

    it('should handle optional fields', async () => {
      const payloadWithOptionals = {
        ...validPayload,
        contents: [{ type: 'segment', text: 'Test' }],
        updatedAt: '2025-01-31T12:00:00Z',
      };

      ingestLimitless.mockResolvedValue({
        eventId: 'evt-111',
        duplicate: false,
        classification: { urgency: 'low', keywords: [] },
        fastPathed: false,
      });

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(payloadWithOptionals),
      });

      await POST(request);

      expect(ingestLimitless).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            contents: payloadWithOptionals.contents,
            updatedAt: payloadWithOptionals.updatedAt,
          }),
        })
      );
    });

    it('should return fastPathed status', async () => {
      ingestLimitless.mockResolvedValue({
        eventId: 'evt-urgent',
        duplicate: false,
        classification: { urgency: 'critical', keywords: ['urgent'] },
        fastPathed: true,
      });

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.fastPathed).toBe(true);
    });

    it('should return 500 on ingestor error', async () => {
      ingestLimitless.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Database connection failed');
    });

    it('should handle unknown errors gracefully', async () => {
      ingestLimitless.mockRejectedValue('Unknown failure');

      const request = new NextRequest('http://localhost/api/limitless/webhook', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Unknown error');
    });
  });
});
