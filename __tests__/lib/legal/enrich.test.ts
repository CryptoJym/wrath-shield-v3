// @ts-nocheck
/**
 * Wrath Shield v3 - Legal Enrich Tests
 *
 * Tests for the legal resolution enrichment:
 * - LegalContextPayload type
 * - applyLegalResolution function
 */

// Mock server-only guard (if needed by store)
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock the store module
const mockUpdateLegalContextRequest = jest.fn();
jest.mock('@/lib/legal/store', () => ({
  updateLegalContextRequest: mockUpdateLegalContextRequest,
  LegalContextRequest: {},
}));

import {
  applyLegalResolution,
  type LegalContextPayload,
} from '@/lib/legal/enrich';

describe('Legal Enrich', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Types', () => {
    it('should define LegalContextPayload interface', () => {
      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Reviewed the contract terms',
        confidence: 0.95,
        action: 'Proceed with signing',
        due_date: '2025-01-20',
        rationale: 'Contract terms are favorable',
        attachments: ['contract.pdf', 'addendum.pdf'],
        status: 'resolved',
      };

      expect(payload.id).toBe('req-123');
      expect(payload.confidence).toBe(0.95);
      expect(payload.status).toBe('resolved');
    });

    it('should allow minimal LegalContextPayload', () => {
      const payload: LegalContextPayload = {
        id: 'req-456',
        summary: 'Quick review completed',
      };

      expect(payload.id).toBe('req-456');
      expect(payload.summary).toBe('Quick review completed');
      expect(payload.confidence).toBeUndefined();
      expect(payload.status).toBeUndefined();
    });

    it('should allow pending status', () => {
      const payload: LegalContextPayload = {
        id: 'req-789',
        summary: 'Still in review',
        status: 'pending',
      };

      expect(payload.status).toBe('pending');
    });
  });

  describe('applyLegalResolution', () => {
    it('should call updateLegalContextRequest with correct parameters', () => {
      const mockResult = {
        id: 'req-123',
        status: 'resolved',
        summary: 'Test resolution',
        confidence: 0.9,
      };
      mockUpdateLegalContextRequest.mockReturnValue(mockResult);

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Test resolution',
        confidence: 0.9,
      };

      const result = applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', {
        status: 'resolved',
        summary: 'Test resolution',
        confidence: 0.9,
        action: undefined,
        due_date: undefined,
        rationale: undefined,
        attachments: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it('should default status to resolved when not provided', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Resolution without status',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        status: 'resolved',
      }));
    });

    it('should use pending status when specified', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Still pending',
        status: 'pending',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        status: 'pending',
      }));
    });

    it('should default confidence to 0.8 when not provided', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'No confidence specified',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        confidence: 0.8,
      }));
    });

    it('should use provided confidence value', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'High confidence resolution',
        confidence: 0.99,
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        confidence: 0.99,
      }));
    });

    it('should allow zero confidence value', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Zero confidence',
        confidence: 0,
      };

      applyLegalResolution('req-123', payload);

      // 0 is falsy but should still be used via nullish coalescing
      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        confidence: 0,
      }));
    });

    it('should pass all optional fields when provided', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Complete resolution',
        confidence: 0.95,
        action: 'File motion by deadline',
        due_date: '2025-02-15',
        rationale: 'Statute requires filing within 30 days',
        attachments: ['motion.pdf', 'exhibit_a.pdf', 'exhibit_b.pdf'],
        status: 'resolved',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', {
        status: 'resolved',
        summary: 'Complete resolution',
        confidence: 0.95,
        action: 'File motion by deadline',
        due_date: '2025-02-15',
        rationale: 'Statute requires filing within 30 days',
        attachments: ['motion.pdf', 'exhibit_a.pdf', 'exhibit_b.pdf'],
      });
    });

    it('should return null when update fails', () => {
      mockUpdateLegalContextRequest.mockReturnValue(null);

      const payload: LegalContextPayload = {
        id: 'non-existent',
        summary: 'Should fail',
      };

      const result = applyLegalResolution('non-existent', payload);

      expect(result).toBeNull();
    });

    it('should handle empty attachments array', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'No attachments',
        attachments: [],
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        attachments: [],
      }));
    });

    it('should handle empty string summary', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: '',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        summary: '',
      }));
    });
  });

  describe('Edge Cases', () => {
    it('should work with different request ID formats', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'uuid-format' });

      const uuidPayload: LegalContextPayload = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        summary: 'UUID format ID',
      };

      applyLegalResolution('a1b2c3d4-e5f6-7890-abcd-ef1234567890', uuidPayload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        expect.any(Object)
      );
    });

    it('should handle special characters in summary', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'Resolution with "quotes", <tags>, & special chars: €£¥',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        summary: 'Resolution with "quotes", <tags>, & special chars: €£¥',
      }));
    });

    it('should handle long summary text', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const longSummary = 'A '.repeat(5000) + 'very long summary';
      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: longSummary,
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        summary: longSummary,
      }));
    });

    it('should handle date formats in due_date', () => {
      mockUpdateLegalContextRequest.mockReturnValue({ id: 'req-123' });

      const payload: LegalContextPayload = {
        id: 'req-123',
        summary: 'With ISO date',
        due_date: '2025-12-31T23:59:59Z',
      };

      applyLegalResolution('req-123', payload);

      expect(mockUpdateLegalContextRequest).toHaveBeenCalledWith('req-123', expect.objectContaining({
        due_date: '2025-12-31T23:59:59Z',
      }));
    });
  });
});
