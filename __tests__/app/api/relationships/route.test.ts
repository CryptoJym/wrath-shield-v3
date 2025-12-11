/**
 * Relationships API Route Tests
 * Tests for /api/relationships endpoint - Relationship Data
 */

import { GET } from '@/app/api/relationships/route';

// Mock dependencies
jest.mock('@/lib/relationshipDb', () => ({
  topContacts: jest.fn(),
  listRelationshipSummaries: jest.fn(),
}));

const { topContacts, listRelationshipSummaries } = require('@/lib/relationshipDb');

describe('Relationships API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockContacts = [
    {
      id: 'contact-1',
      display_name: 'Alice Smith',
      handle: 'alice@example.com',
      last_ts: 1706700000,
    },
    {
      id: 'contact-2',
      display_name: 'Bob Jones',
      handle: 'bob@example.com',
      last_ts: 1706600000,
    },
  ];

  const mockSummaries = [
    {
      id: 'summary-1',
      contact_id: 'contact-1',
      summary: 'Close collaborator on engineering projects',
      updated_at: '2025-01-31T10:00:00Z',
    },
    {
      id: 'summary-2',
      contact_id: 'contact-2',
      summary: 'Occasional business contact',
      updated_at: '2025-01-30T09:00:00Z',
    },
  ];

  describe('GET /api/relationships', () => {
    it('should return contacts and summaries', async () => {
      topContacts.mockReturnValue(mockContacts);
      listRelationshipSummaries.mockReturnValue(mockSummaries);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contacts).toEqual(mockContacts);
      expect(data.summaries).toEqual(mockSummaries);
    });

    it('should request 100 top contacts', async () => {
      topContacts.mockReturnValue([]);
      listRelationshipSummaries.mockReturnValue([]);

      await GET();

      expect(topContacts).toHaveBeenCalledWith(100);
    });

    it('should return empty arrays when no data', async () => {
      topContacts.mockReturnValue([]);
      listRelationshipSummaries.mockReturnValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contacts).toEqual([]);
      expect(data.summaries).toEqual([]);
    });

    it('should call both data sources', async () => {
      topContacts.mockReturnValue(mockContacts);
      listRelationshipSummaries.mockReturnValue(mockSummaries);

      await GET();

      expect(topContacts).toHaveBeenCalled();
      expect(listRelationshipSummaries).toHaveBeenCalled();
    });
  });
});
