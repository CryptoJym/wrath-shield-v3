/**
 * Anchors API Route Tests
 * Tests for /api/anchors endpoint - Anchor Memories (Grounding Truths)
 */

import { GET, POST } from '@/app/api/anchors/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/MemoryWrapper', () => ({
  getAnchors: jest.fn(),
  addAnchor: jest.fn(),
}));

jest.mock('@/lib/auth/user', () => ({
  currentUserOrThrow: jest.fn(),
}));

const { getAnchors, addAnchor } = require('@/lib/MemoryWrapper');
const { currentUserOrThrow } = require('@/lib/auth/user');

describe('Anchors API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUserOrThrow.mockReturnValue({ userId: 'test-user-id' });
  });

  const mockAnchors = [
    {
      id: 'anchor-1',
      text: 'I am worthy of love and respect',
      category: 'self-worth',
      date: '2025-01-31',
      created_at: '2025-01-31T10:00:00Z',
    },
    {
      id: 'anchor-2',
      text: 'My time is valuable',
      category: 'boundaries',
      date: '2025-01-30',
      created_at: '2025-01-30T09:00:00Z',
    },
    {
      id: 'anchor-3',
      text: 'I trust my intuition',
      category: 'self-trust',
      date: '2025-01-29',
      created_at: '2025-01-29T08:00:00Z',
    },
  ];

  describe('GET /api/anchors', () => {
    it('should return all anchors', async () => {
      getAnchors.mockResolvedValue(mockAnchors);

      const request = new NextRequest('http://localhost/api/anchors');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.anchors).toEqual(mockAnchors);
      expect(getAnchors).toHaveBeenCalledWith('test-user-id', {
        since: undefined,
        category: undefined,
      });
    });

    it('should filter by since date', async () => {
      getAnchors.mockResolvedValue([mockAnchors[0]]);

      const request = new NextRequest('http://localhost/api/anchors?since=2025-01-31');
      const response = await GET(request);

      expect(getAnchors).toHaveBeenCalledWith('test-user-id', {
        since: '2025-01-31',
        category: undefined,
      });
    });

    it('should filter by category', async () => {
      getAnchors.mockResolvedValue([mockAnchors[1]]);

      const request = new NextRequest('http://localhost/api/anchors?category=boundaries');
      const response = await GET(request);

      expect(getAnchors).toHaveBeenCalledWith('test-user-id', {
        since: undefined,
        category: 'boundaries',
      });
    });

    it('should combine since and category filters', async () => {
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/anchors?since=2025-01-30&category=self-worth');
      const response = await GET(request);

      expect(getAnchors).toHaveBeenCalledWith('test-user-id', {
        since: '2025-01-30',
        category: 'self-worth',
      });
    });

    it('should return empty array when no anchors', async () => {
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/anchors');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.anchors).toEqual([]);
    });

    it('should set Cache-Control header', async () => {
      getAnchors.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/anchors');
      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('private, max-age=0');
    });

    it('should return 500 on error', async () => {
      getAnchors.mockRejectedValue(new Error('Memory service error'));

      const request = new NextRequest('http://localhost/api/anchors');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.anchors).toEqual([]);
      expect(data.error).toBe('Failed to fetch anchors');
    });
  });

  describe('POST /api/anchors', () => {
    const validAnchor = {
      text: 'I deserve to rest',
      category: 'self-care',
      date: '2025-01-31',
    };

    it('should create anchor successfully', async () => {
      addAnchor.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify(validAnchor),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toContain('successfully');
      expect(addAnchor).toHaveBeenCalledWith(
        validAnchor.text,
        validAnchor.category,
        validAnchor.date,
        'test-user-id'
      );
    });

    it('should return 400 when text is missing', async () => {
      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify({
          category: 'self-care',
          date: '2025-01-31',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('text');
    });

    it('should return 400 when text is not a string', async () => {
      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify({
          text: 123,
          category: 'self-care',
          date: '2025-01-31',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('text');
    });

    it('should return 400 when category is missing', async () => {
      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test anchor',
          date: '2025-01-31',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('category');
    });

    it('should return 400 when date is missing', async () => {
      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test anchor',
          category: 'self-care',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('date');
    });

    it('should return 400 when date format is invalid', async () => {
      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test anchor',
          category: 'self-care',
          date: '01-31-2025', // Wrong format
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('YYYY-MM-DD');
    });

    it('should return 500 on error', async () => {
      addAnchor.mockRejectedValue(new Error('Memory service error'));

      const request = new NextRequest('http://localhost/api/anchors', {
        method: 'POST',
        body: JSON.stringify(validAnchor),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to add anchor');
    });
  });
});
