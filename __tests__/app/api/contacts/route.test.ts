/**
 * Contacts API Route Tests
 * Tests for /api/contacts endpoint - Contact Management
 */

import { GET, POST, PATCH } from '@/app/api/contacts/route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/relationshipDb', () => ({
  topContacts: jest.fn(),
  getRelationshipDb: jest.fn(),
}));

jest.mock('@/lib/contacts/resolver', () => ({
  resolveContact: jest.fn(),
  getContactById: jest.fn(),
  calculateSimilarity: jest.fn(),
  normalizeName: jest.fn((name) => name?.toLowerCase() || ''),
}));

const { topContacts, getRelationshipDb } = require('@/lib/relationshipDb');
const { resolveContact, getContactById, calculateSimilarity, normalizeName } = require('@/lib/contacts/resolver');

describe('Contacts API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockContacts = [
    {
      id: 'contact-1',
      display_name: 'Alice Smith',
      handle: 'alice@example.com',
      canonical_handle: 'alice@example.com',
      last_ts: 1706700000,
    },
    {
      id: 'contact-2',
      display_name: 'Bob Jones',
      handle: 'bob@example.com',
      canonical_handle: 'bob@example.com',
      last_ts: 1706600000,
    },
    {
      id: 'contact-3',
      display_name: 'Charlie Brown',
      handle: 'charlie@slack.com',
      canonical_handle: 'charlie@slack.com',
      last_ts: 1706500000,
    },
  ];

  describe('GET /api/contacts', () => {
    it('should return recent contacts by default', async () => {
      topContacts.mockReturnValue(mockContacts);

      const request = new NextRequest('http://localhost/api/contacts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contacts).toEqual(mockContacts);
      expect(data.count).toBe(3);
      expect(topContacts).toHaveBeenCalledWith(50);
    });

    it('should respect limit parameter', async () => {
      topContacts.mockReturnValue([mockContacts[0]]);

      const request = new NextRequest('http://localhost/api/contacts?limit=1');
      const response = await GET(request);

      expect(topContacts).toHaveBeenCalledWith(1);
    });

    it('should return single contact by id', async () => {
      getContactById.mockReturnValue(mockContacts[0]);

      const request = new NextRequest('http://localhost/api/contacts?id=contact-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contact).toEqual(mockContacts[0]);
    });

    it('should return 404 for unknown contact id', async () => {
      getContactById.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts?id=unknown');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Contact not found');
    });

    it('should search contacts by query', async () => {
      const mockDb = {
        prepare: jest.fn(() => ({
          all: jest.fn(() => mockContacts),
        })),
      };
      getRelationshipDb.mockReturnValue(mockDb);
      calculateSimilarity.mockReturnValue(0.8);

      const request = new NextRequest('http://localhost/api/contacts?q=alice');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contacts.length).toBeGreaterThan(0);
    });

    it('should return empty results when db unavailable for search', async () => {
      getRelationshipDb.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts?q=alice');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contacts).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should filter search results by similarity threshold', async () => {
      const mockDb = {
        prepare: jest.fn(() => ({
          all: jest.fn(() => mockContacts),
        })),
      };
      getRelationshipDb.mockReturnValue(mockDb);
      // First contact high similarity, others low
      calculateSimilarity
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.2)
        .mockReturnValueOnce(0.2);

      const request = new NextRequest('http://localhost/api/contacts?q=alice');
      const response = await GET(request);
      const data = await response.json();

      // Only contacts with similarity >= 0.3 should be returned
      expect(data.contacts.length).toBeLessThan(3);
    });

    it('should handle GET errors gracefully', async () => {
      topContacts.mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new NextRequest('http://localhost/api/contacts');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/contacts - Resolve Contact', () => {
    it('should resolve contact from handle', async () => {
      const match = {
        contact: mockContacts[0],
        confidence: 0.95,
        method: 'exact',
      };
      resolveContact.mockReturnValue(match);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ handle: 'alice@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.resolved).toBe(true);
      expect(data.match).toEqual(match);
    });

    it('should pass display name to resolver', async () => {
      resolveContact.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          handle: 'unknown@example.com',
          displayName: 'Unknown User',
        }),
      });

      await POST(request);

      expect(resolveContact).toHaveBeenCalledWith(
        'unknown@example.com',
        'Unknown User',
        expect.any(Object)
      );
    });

    it('should pass autoCreate option', async () => {
      resolveContact.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          handle: 'new@example.com',
          autoCreate: false,
        }),
      });

      await POST(request);

      expect(resolveContact).toHaveBeenCalledWith(
        'new@example.com',
        undefined,
        expect.objectContaining({ autoCreate: false })
      );
    });

    it('should pass minConfidence option', async () => {
      resolveContact.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          handle: 'test@example.com',
          minConfidence: 0.9,
        }),
      });

      await POST(request);

      expect(resolveContact).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
        expect.objectContaining({ minConfidence: 0.9 })
      );
    });

    it('should return 400 when handle is missing', async () => {
      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('handle is required');
    });

    it('should handle no match found', async () => {
      resolveContact.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ handle: 'unknown@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.resolved).toBe(false);
      expect(data.message).toContain('No matching contact');
    });

    it('should handle POST errors gracefully', async () => {
      resolveContact.mockImplementation(() => {
        throw new Error('Resolver failed');
      });

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ handle: 'test@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Resolver failed');
    });
  });

  describe('PATCH /api/contacts - Update Contact', () => {
    const mockDb = {
      prepare: jest.fn(() => ({
        run: jest.fn(),
      })),
    };

    beforeEach(() => {
      getRelationshipDb.mockReturnValue(mockDb);
    });

    it('should update contact display name', async () => {
      getContactById.mockReturnValue({ ...mockContacts[0], display_name: 'Alice Updated' });

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'contact-1',
          displayName: 'Alice Updated',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.contact.display_name).toBe('Alice Updated');
    });

    it('should update contact handle', async () => {
      getContactById.mockReturnValue({ ...mockContacts[0], handle: 'alice.new@example.com' });

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'contact-1',
          handle: 'alice.new@example.com',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('should update canonical handle', async () => {
      getContactById.mockReturnValue(mockContacts[0]);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'contact-1',
          canonicalHandle: 'alice.canonical@example.com',
        }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(200);
    });

    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: 'Test' }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('id is required');
    });

    it('should return 400 when no updates provided', async () => {
      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'contact-1' }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('No updates provided');
    });

    it('should return 500 when database unavailable', async () => {
      getRelationshipDb.mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'contact-1',
          displayName: 'Test',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Database not available');
    });

    it('should handle PATCH errors gracefully', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Update failed');
      });

      const request = new NextRequest('http://localhost/api/contacts', {
        method: 'PATCH',
        body: JSON.stringify({
          id: 'contact-1',
          displayName: 'Test',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.ok).toBe(false);
      expect(data.error).toBe('Update failed');
    });
  });
});
