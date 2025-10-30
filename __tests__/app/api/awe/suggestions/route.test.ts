/**
 * Tests for AWE Suggestions API Endpoint
 *
 * POST /api/awe/suggestions
 */

import { POST } from '@/app/api/awe/suggestions/route';
import { NextRequest } from 'next/server';
import * as AWE from '@/lib/assuredWordEngine';

// Mock the AWE module
jest.mock('@/lib/assuredWordEngine', () => ({
  getSuggestion: jest.fn(),
}));

describe('POST /api/awe/suggestions', () => {
  const mockedGetSuggestion = AWE.getSuggestion as jest.MockedFunction<typeof AWE.getSuggestion>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock requests
  const createRequest = (body: any): NextRequest => {
    return {
      json: async () => body,
    } as NextRequest;
  };

  describe('Valid Requests', () => {
    it('should return suggestion for valid phrase', async () => {
      const mockSuggestion = {
        original_phrase: 'maybe',
        assured_alt: 'I will',
        options: ['I will', 'I decide', "I'm proceeding"],
        lift_score: 0.18,
        category: 'hedges' as const,
        context_tags: ['work', 'co-parent', 'planning'],
      };

      mockedGetSuggestion.mockReturnValue(mockSuggestion);

      const request = createRequest({ phrase: 'maybe' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.suggestion).toEqual(mockSuggestion);
      expect(mockedGetSuggestion).toHaveBeenCalledWith('maybe');
    });

    it('should trim whitespace from phrase', async () => {
      const mockSuggestion = {
        original_phrase: 'I guess',
        assured_alt: 'I know',
        options: ['I know', "I'm clear that", "I've decided"],
        lift_score: 0.16,
        category: 'hedges' as const,
        context_tags: ['work', 'decision'],
      };

      mockedGetSuggestion.mockReturnValue(mockSuggestion);

      const request = createRequest({ phrase: '  I guess  ' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockedGetSuggestion).toHaveBeenCalledWith('I guess');
    });

    it('should handle partial phrase matches', async () => {
      const mockSuggestion = {
        original_phrase: 'maybe',
        assured_alt: 'I will',
        options: ['I will', 'I decide', "I'm proceeding"],
        lift_score: 0.18,
        category: 'hedges' as const,
        context_tags: ['work', 'co-parent', 'planning'],
      };

      mockedGetSuggestion.mockReturnValue(mockSuggestion);

      const request = createRequest({ phrase: 'maybe we should do this' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.suggestion).toEqual(mockSuggestion);
    });

    it('should handle phrases with learned assured_fit scores', async () => {
      const mockSuggestion = {
        original_phrase: 'maybe',
        assured_alt: 'I will',
        options: ['I will', 'I decide', "I'm proceeding"],
        lift_score: 0.27, // adjusted by assured_fit
        category: 'hedges' as const,
        context_tags: ['work', 'co-parent', 'planning'],
      };

      mockedGetSuggestion.mockReturnValue(mockSuggestion);

      const request = createRequest({ phrase: 'maybe' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.suggestion.lift_score).toBeGreaterThan(0.18); // shows learning effect
    });
  });

  describe('No Suggestion Found', () => {
    it('should return 404 when no suggestion exists', async () => {
      mockedGetSuggestion.mockReturnValue(null);

      const request = createRequest({ phrase: 'definitely' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No suggestion found');
      expect(data.message).toContain('definitely');
    });

    it('should return 404 for unknown phrases', async () => {
      mockedGetSuggestion.mockReturnValue(null);

      const request = createRequest({ phrase: 'xyz123' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('Missing or Invalid Fields', () => {
    it('should return 400 when phrase is missing', async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing or invalid "phrase" field');
      expect(mockedGetSuggestion).not.toHaveBeenCalled();
    });

    it('should return 400 when phrase is null', async () => {
      const request = createRequest({ phrase: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when phrase is not a string', async () => {
      const request = createRequest({ phrase: 123 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when phrase is an object', async () => {
      const request = createRequest({ phrase: { text: 'maybe' } });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when phrase is empty string', async () => {
      const request = createRequest({ phrase: '' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Empty phrase');
    });

    it('should return 400 when phrase is only whitespace', async () => {
      const request = createRequest({ phrase: '   \n\t  ' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Empty phrase');
    });
  });

  describe('Malformed Requests', () => {
    it('should return 400 for invalid JSON', async () => {
      const request = {
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid JSON');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const request = {
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      } as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on unexpected errors', async () => {
      mockedGetSuggestion.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = createRequest({ phrase: 'maybe' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockedGetSuggestion.mockImplementation(() => {
        throw new Error('Test error');
      });

      const request = createRequest({ phrase: 'maybe' });
      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'AWE suggestions API error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long phrases', async () => {
      const longPhrase = 'maybe '.repeat(100);
      mockedGetSuggestion.mockReturnValue({
        original_phrase: 'maybe',
        assured_alt: 'I will',
        options: ['I will', 'I decide', "I'm proceeding"],
        lift_score: 0.18,
        category: 'hedges' as const,
        context_tags: ['work'],
      });

      const request = createRequest({ phrase: longPhrase });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle special characters in phrases', async () => {
      mockedGetSuggestion.mockReturnValue(null);

      const request = createRequest({ phrase: '!@#$%^&*()' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should handle unicode characters', async () => {
      mockedGetSuggestion.mockReturnValue(null);

      const request = createRequest({ phrase: '你好' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(mockedGetSuggestion).toHaveBeenCalledWith('你好');
    });

    it('should handle emojis in phrases', async () => {
      mockedGetSuggestion.mockReturnValue(null);

      const request = createRequest({ phrase: 'maybe 😊' });
      const response = await POST(request);

      expect(response.status).toBe(404);
      expect(mockedGetSuggestion).toHaveBeenCalledWith('maybe 😊');
    });
  });

  describe('Response Format', () => {
    it('should include all required fields in success response', async () => {
      const mockSuggestion = {
        original_phrase: 'maybe',
        assured_alt: 'I will',
        options: ['I will', 'I decide', "I'm proceeding"],
        lift_score: 0.18,
        category: 'hedges' as const,
        context_tags: ['work', 'co-parent', 'planning'],
      };

      mockedGetSuggestion.mockReturnValue(mockSuggestion);

      const request = createRequest({ phrase: 'maybe' });
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('suggestion');
      expect(data.suggestion).toHaveProperty('original_phrase');
      expect(data.suggestion).toHaveProperty('assured_alt');
      expect(data.suggestion).toHaveProperty('options');
      expect(data.suggestion).toHaveProperty('lift_score');
      expect(data.suggestion).toHaveProperty('category');
      expect(data.suggestion).toHaveProperty('context_tags');
    });

    it('should include error details in error responses', async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });
  });
});
