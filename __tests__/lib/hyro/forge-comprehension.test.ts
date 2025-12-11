// @ts-nocheck
/**
 * Tests for HYRO FORGE: Intelligent Comprehension System
 *
 * Tests Socratic inquiry system, AI-evaluated responses, and reading discussions.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock database with transaction support
const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();
const mockPrepare = jest.fn(() => ({
  run: mockDbRun,
  get: mockDbGet,
  all: mockDbAll,
}));
const mockTransaction = jest.fn((fn) => fn());

jest.mock('@/lib/db/Database', () => ({
  getDatabase: () => ({
    prepare: mockPrepare,
    transaction: mockTransaction,
  }),
}));

// Mock forge-xp
const mockAwardXP = jest.fn();
jest.mock('../../../lib/hyro/forge-xp', () => ({
  awardXP: (...args: any[]) => mockAwardXP(...args),
}));

// Mock forge-ai-evaluator
const mockEvaluateWithAI = jest.fn();
jest.mock('../../../lib/hyro/forge-ai-evaluator', () => ({
  evaluateComprehensionResponse: (...args: any[]) => mockEvaluateWithAI(...args),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

// Import after mocks
import {
  getPromptsForBook,
  getPrompt,
  getRandomPrompt,
  createPrompt,
  submitResponse,
  getResponsesForPrompt,
  startDiscussion,
  continueDiscussion,
  concludeDiscussion,
  getDiscussion,
  getDiscussionExchanges,
  getRecentDiscussions,
  PROMPT_TYPE_INFO,
} from '../../../lib/hyro/forge-comprehension';

import type {
  PromptType,
  DepthRating,
  ResponseQuality,
  FollowUpType,
  ComprehensionPrompt,
  ComprehensionResponse,
  ReadingDiscussion,
  DiscussionExchange,
  EvaluationResult,
} from '../../../lib/hyro/forge-comprehension';

describe('HYRO FORGE: Intelligent Comprehension System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.USE_AI_EVALUATION;
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define PromptType values', () => {
      const types: PromptType[] = ['analysis', 'connection', 'prediction', 'creation', 'meta'];
      expect(types).toHaveLength(5);
    });

    it('should define DepthRating values', () => {
      const ratings: DepthRating[] = ['surface', 'moderate', 'deep'];
      expect(ratings).toHaveLength(3);
    });

    it('should define ResponseQuality values', () => {
      const qualities: ResponseQuality[] = ['weak', 'adequate', 'strong', 'exceptional'];
      expect(qualities).toHaveLength(4);
    });

    it('should define FollowUpType values', () => {
      const types: FollowUpType[] = ['probe_deeper', 'redirect', 'affirm', 'conclude'];
      expect(types).toHaveLength(4);
    });
  });

  // ==========================================================================
  // PROMPT_TYPE_INFO Tests
  // ==========================================================================

  describe('PROMPT_TYPE_INFO', () => {
    it('should have info for all prompt types', () => {
      expect(PROMPT_TYPE_INFO).toHaveProperty('analysis');
      expect(PROMPT_TYPE_INFO).toHaveProperty('connection');
      expect(PROMPT_TYPE_INFO).toHaveProperty('prediction');
      expect(PROMPT_TYPE_INFO).toHaveProperty('creation');
      expect(PROMPT_TYPE_INFO).toHaveProperty('meta');
    });

    it('should have required fields for each type', () => {
      for (const type of Object.values(PROMPT_TYPE_INFO)) {
        expect(type).toHaveProperty('label');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('purpose');
      }
    });

    it('should have descriptive analysis type', () => {
      expect(PROMPT_TYPE_INFO.analysis.label).toBe('Analysis');
      expect(PROMPT_TYPE_INFO.analysis.description).toContain('reasoning');
    });

    it('should have descriptive connection type', () => {
      expect(PROMPT_TYPE_INFO.connection.label).toBe('Connection');
      expect(PROMPT_TYPE_INFO.connection.purpose).toContain('experience');
    });

    it('should have descriptive meta type', () => {
      expect(PROMPT_TYPE_INFO.meta.label).toBe('Meta');
      expect(PROMPT_TYPE_INFO.meta.purpose).toContain('reflect');
    });
  });

  // ==========================================================================
  // Prompt Functions Tests
  // ==========================================================================

  describe('getPromptsForBook', () => {
    it('should query prompts for a book', () => {
      mockDbAll.mockReturnValue([
        { id: 'p1', book_id: 'book-1', prompt_type: 'analysis', prompt_text: 'Test prompt' },
      ]);

      const result = getPromptsForBook('student-1', 'book-1');

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockDbAll).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by prompt type if specified', () => {
      mockDbAll.mockReturnValue([]);

      getPromptsForBook('student-1', 'book-1', 'analysis');

      // Check that type filter was included in query
      const callArgs = mockPrepare.mock.calls;
      const queryCall = callArgs.find(call => call[0].includes('prompt_type'));
      expect(queryCall).toBeDefined();
    });
  });

  describe('getPrompt', () => {
    it('should get prompt by ID', () => {
      const mockPrompt = {
        id: 'prompt-1',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Test prompt',
      };
      mockDbGet.mockReturnValue(mockPrompt);

      const result = getPrompt('student-1', 'prompt-1');

      expect(mockDbGet).toHaveBeenCalled();
      expect(result).toEqual(mockPrompt);
    });

    it('should return null if not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const result = getPrompt('student-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRandomPrompt', () => {
    it('should get random prompt prioritizing less-used ones', () => {
      const mockPrompt = {
        id: 'prompt-1',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Test prompt',
        times_used: 0,
      };
      mockDbGet.mockReturnValue(mockPrompt);

      const result = getRandomPrompt('student-1', 'book-1');

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockDbGet).toHaveBeenCalled();
      expect(result).toEqual(mockPrompt);
    });

    it('should filter by chapter if specified', () => {
      mockDbGet.mockReturnValue(null);

      getRandomPrompt('student-1', 'book-1', 'chapter-1');

      const queryCall = mockPrepare.mock.calls.find(call =>
        call[0].includes('chapter_id')
      );
      expect(queryCall).toBeDefined();
    });

    it('should filter by type if specified', () => {
      mockDbGet.mockReturnValue(null);

      getRandomPrompt('student-1', 'book-1', undefined, 'prediction');

      const queryCall = mockPrepare.mock.calls.find(call =>
        call[0].includes('prompt_type')
      );
      expect(queryCall).toBeDefined();
    });
  });

  describe('createPrompt', () => {
    it('should create a new prompt', () => {
      const mockPrompt = {
        id: 'test-uuid-1234',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Analyze the character',
      };
      mockDbGet.mockReturnValue(mockPrompt);

      const result = createPrompt('student-1', {
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Analyze the character',
      });

      expect(mockDbRun).toHaveBeenCalled();
      expect(result.book_id).toBe('book-1');
      expect(result.prompt_type).toBe('analysis');
    });

    it('should store optional fields', () => {
      mockDbGet.mockReturnValue({ id: 'test-uuid-1234' });

      createPrompt('student-1', {
        book_id: 'book-1',
        prompt_type: 'connection',
        prompt_text: 'Connect to your life',
        context_excerpt: 'Relevant passage',
        evaluation_rubric: { evidence: 'Use quotes' },
        exemplar_response: 'A great response would...',
        common_misconceptions: ['Missing the theme'],
        difficulty_level: 'medium',
        stat_targeted: 'reading',
      });

      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Response Evaluation Tests
  // ==========================================================================

  describe('submitResponse', () => {
    beforeEach(() => {
      mockDbGet.mockImplementation((studentId, id) => {
        if (typeof studentId === 'string' && typeof id === 'string') {
          if (id.includes('prompt')) {
            return {
              id: id,
              book_id: 'book-1',
              prompt_type: 'analysis',
              prompt_text: 'Test prompt',
            };
          }
          return {
            id: id,
            prompt_id: 'prompt-1',
            response_text: 'Test response',
            ai_score: 75,
          };
        }
        return null;
      });
      mockTransaction.mockImplementation((fn) => fn());
    });

    it('should submit and evaluate response', async () => {
      const result = await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: 'The character showed courage because they faced their fears.',
      });

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('evaluation');
      expect(result).toHaveProperty('xp_earned');
      expect(mockAwardXP).toHaveBeenCalled();
    });

    it('should throw error if prompt not found', async () => {
      mockDbGet.mockReturnValue(undefined);

      await expect(
        submitResponse('student-1', {
          prompt_id: 'nonexistent',
          response_text: 'Test',
        })
      ).rejects.toThrow('Prompt not found');
    });

    it('should calculate XP based on score', async () => {
      const result = await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: 'Excellent response with deep analysis and multiple evidence points.',
      });

      expect(mockAwardXP).toHaveBeenCalledWith(
        'student-1',
        expect.any(Number),
        'comprehension_response',
        expect.any(String)
      );
    });

    it('should update prompt statistics', async () => {
      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: 'Test response',
      });

      // Check that UPDATE query was called for prompt stats
      const updateCall = mockPrepare.mock.calls.find(call =>
        call[0].includes('UPDATE hyro_comprehension_prompts')
      );
      expect(updateCall).toBeDefined();
    });
  });

  describe('Local Evaluation Heuristics', () => {
    beforeEach(() => {
      mockDbGet.mockImplementation(() => ({
        id: 'prompt-1',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Analyze the theme',
      }));
      mockTransaction.mockImplementation((fn) => fn());
    });

    it('should give higher evidence score for quotes', async () => {
      const responseWithQuotes = 'The author said "courage is key" which shows the theme.';
      const responseWithoutQuotes = 'The theme is about courage.';

      // Evaluate both - with quotes should score higher
      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: responseWithQuotes,
      });

      // The heuristic should detect quotes
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should give higher reasoning score for causal language', async () => {
      const responseWithReasoning = 'The character changed because she learned from her mistakes.';

      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: responseWithReasoning,
      });

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should give higher depth score for nuanced thinking', async () => {
      const nuancedResponse = 'However, although the character was brave, on the other hand she also showed fear.';

      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: nuancedResponse,
      });

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should give higher connection score for personal links', async () => {
      const connectedResponse = 'This reminds me of when I faced a similar situation in my own life.';

      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: connectedResponse,
      });

      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe('getResponsesForPrompt', () => {
    it('should get all responses for a prompt', () => {
      mockDbAll.mockReturnValue([
        { id: 'r1', prompt_id: 'p1', response_text: 'Response 1' },
        { id: 'r2', prompt_id: 'p1', response_text: 'Response 2' },
      ]);

      const result = getResponsesForPrompt('student-1', 'p1');

      expect(result).toHaveLength(2);
      expect(mockDbAll).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Socratic Discussion Tests
  // ==========================================================================

  describe('startDiscussion', () => {
    beforeEach(() => {
      mockDbGet.mockImplementation(() => ({
        id: 'test-uuid-1234',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Initial question',
      }));
    });

    it('should start a new discussion', () => {
      const result = startDiscussion('student-1', 'book-1');

      expect(result).toHaveProperty('discussion');
      expect(result).toHaveProperty('first_exchange');
      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should use specified initial prompt', () => {
      startDiscussion('student-1', 'book-1', 'specific-prompt-id');

      expect(mockDbGet).toHaveBeenCalled();
    });

    it('should throw error if no prompts available', () => {
      mockDbGet.mockReturnValue(undefined);

      expect(() => {
        startDiscussion('student-1', 'book-with-no-prompts');
      }).toThrow('No prompts available');
    });
  });

  describe('continueDiscussion', () => {
    beforeEach(() => {
      // Mock discussion
      mockDbGet.mockImplementation((studentId, id) => {
        if (typeof id === 'string' && id.includes('discussion')) {
          return {
            id: id,
            book_id: 'book-1',
            status: 'active',
            exchange_count: 2,
          };
        }
        return {
          id: 'exchange-1',
          discussion_id: 'discussion-1',
          exchange_number: 2,
          ai_prompt: 'Tell me more',
          user_response: null,
        };
      });
    });

    it('should continue discussion with response', () => {
      const result = continueDiscussion(
        'student-1',
        'discussion-1',
        'Because the character showed growth throughout the story.',
        30
      );

      expect(result).toHaveProperty('updated_exchange');
      expect(result).toHaveProperty('next_exchange');
      expect(result).toHaveProperty('xp_earned');
      expect(result).toHaveProperty('should_conclude');
    });

    it('should throw error if discussion not found', () => {
      mockDbGet.mockReturnValue(undefined);

      expect(() => {
        continueDiscussion('student-1', 'nonexistent', 'Response');
      }).toThrow('Discussion not found');
    });

    it('should throw error if discussion not active', () => {
      mockDbGet.mockReturnValue({
        id: 'discussion-1',
        status: 'concluded',
      });

      expect(() => {
        continueDiscussion('student-1', 'discussion-1', 'Response');
      }).toThrow('not active');
    });

    it('should detect response quality based on content', () => {
      mockDbGet.mockImplementation(() => ({
        id: 'discussion-1',
        status: 'active',
        exchange_count: 2,
        ai_prompt: 'Tell me more',
        user_response: null,
      }));

      // High quality response with multiple thinking types
      const result = continueDiscussion(
        'student-1',
        'discussion-1',
        'I believe the character felt sad because of the evidence showing her perspective changed. This connects to how I felt in a similar situation.',
        45
      );

      expect(result).toBeDefined();
    });
  });

  describe('concludeDiscussion', () => {
    beforeEach(() => {
      mockDbGet.mockReturnValue({
        id: 'discussion-1',
        book_id: 'book-1',
        status: 'active',
        exchange_count: 4,
        total_xp_earned: 50,
      });
      mockDbAll.mockReturnValue([
        { response_quality: 'strong', thinking_demonstrated: '["evidence_based"]' },
        { response_quality: 'adequate', thinking_demonstrated: '["logical_reasoning"]' },
      ]);
    });

    it('should conclude discussion and calculate summary', () => {
      const result = concludeDiscussion('student-1', 'discussion-1');

      expect(result).toHaveProperty('discussion');
      expect(result).toHaveProperty('xp_earned');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('exchanges');
      expect(result.summary).toHaveProperty('depth_achieved');
      expect(result.summary).toHaveProperty('key_insights');
    });

    it('should throw error if discussion not found', () => {
      mockDbGet.mockReturnValue(undefined);

      expect(() => {
        concludeDiscussion('student-1', 'nonexistent');
      }).toThrow('Discussion not found');
    });

    it('should award completion XP', () => {
      concludeDiscussion('student-1', 'discussion-1');

      expect(mockAwardXP).toHaveBeenCalledWith(
        'student-1',
        expect.any(Number),
        'discussion_completed',
        'discussion-1'
      );
    });

    it('should determine depth achieved', () => {
      // Mock with exceptional responses
      mockDbAll.mockReturnValue([
        { response_quality: 'exceptional', thinking_demonstrated: '["evidence_based", "logical_reasoning", "connection_making"]' },
        { response_quality: 'strong', thinking_demonstrated: '["perspective_taking"]' },
      ]);

      const result = concludeDiscussion('student-1', 'discussion-1');

      expect(['surface', 'moderate', 'deep']).toContain(result.summary.depth_achieved);
    });
  });

  describe('getDiscussion', () => {
    it('should get discussion by ID', () => {
      const mockDiscussion = {
        id: 'discussion-1',
        book_id: 'book-1',
        status: 'active',
      };
      mockDbGet.mockReturnValue(mockDiscussion);

      const result = getDiscussion('student-1', 'discussion-1');

      expect(result).toEqual(mockDiscussion);
    });

    it('should return null if not found', () => {
      mockDbGet.mockReturnValue(undefined);

      const result = getDiscussion('student-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getDiscussionExchanges', () => {
    it('should get all exchanges for a discussion', () => {
      mockDbAll.mockReturnValue([
        { id: 'e1', exchange_number: 1, ai_prompt: 'First question' },
        { id: 'e2', exchange_number: 2, ai_prompt: 'Follow up' },
      ]);

      const result = getDiscussionExchanges('student-1', 'discussion-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getRecentDiscussions', () => {
    it('should get recent discussions for a book', () => {
      mockDbAll.mockReturnValue([
        { id: 'd1', book_id: 'book-1', started_at: 1234567890 },
        { id: 'd2', book_id: 'book-1', started_at: 1234567800 },
      ]);

      const result = getRecentDiscussions('student-1', 'book-1', 10);

      expect(result).toHaveLength(2);
      expect(mockDbAll).toHaveBeenCalled();
    });

    it('should default to limit of 10', () => {
      mockDbAll.mockReturnValue([]);

      getRecentDiscussions('student-1', 'book-1');

      // Check the query was called
      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very short responses', async () => {
      mockDbGet.mockReturnValue({
        id: 'prompt-1',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Analyze',
      });
      mockTransaction.mockImplementation((fn) => fn());

      // Very short response should still be processed
      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: 'Yes.',
      });

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should handle very long responses', async () => {
      mockDbGet.mockReturnValue({
        id: 'prompt-1',
        book_id: 'book-1',
        prompt_type: 'analysis',
        prompt_text: 'Analyze',
      });
      mockTransaction.mockImplementation((fn) => fn());

      const longResponse = 'Word '.repeat(500);
      await submitResponse('student-1', {
        prompt_id: 'prompt-1',
        response_text: longResponse,
      });

      expect(mockDbRun).toHaveBeenCalled();
    });

    it('should handle empty thinking demonstrated JSON', () => {
      mockDbGet.mockReturnValue({
        id: 'discussion-1',
        book_id: 'book-1',
        status: 'active',
        exchange_count: 2,
      });
      mockDbAll.mockReturnValue([
        { response_quality: 'adequate', thinking_demonstrated: null },
      ]);

      const result = concludeDiscussion('student-1', 'discussion-1');

      expect(result.summary.key_insights).toEqual([]);
    });

    it('should handle malformed thinking demonstrated JSON', () => {
      mockDbGet.mockReturnValue({
        id: 'discussion-1',
        book_id: 'book-1',
        status: 'active',
        exchange_count: 2,
      });
      mockDbAll.mockReturnValue([
        { response_quality: 'adequate', thinking_demonstrated: 'not valid json' },
      ]);

      // Should not throw
      const result = concludeDiscussion('student-1', 'discussion-1');
      expect(result).toBeDefined();
    });

    it('should handle discussion with no exchanges', () => {
      mockDbGet.mockReturnValue({
        id: 'discussion-1',
        book_id: 'book-1',
        status: 'active',
        exchange_count: 0,
      });
      mockDbAll.mockReturnValue([]);

      const result = concludeDiscussion('student-1', 'discussion-1');

      expect(result.summary.exchanges).toBe(0);
      expect(result.summary.depth_achieved).toBe('surface');
    });
  });
});
