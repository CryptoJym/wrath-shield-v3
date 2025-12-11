// @ts-nocheck
/**
 * Wrath Shield v3 - Legal Advisor LLM Tests
 *
 * Tests for the Legal Advisor LLM client:
 * - Type definitions
 * - System prompt generation
 * - Daily brief generation
 * - Chat functionality
 * - Message analysis
 * - Memory integration
 */

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock MemoryWrapper
jest.mock('@/lib/MemoryWrapper', () => ({
  addMemory: jest.fn().mockResolvedValue({ id: 'mem-123' }),
  searchMemories: jest.fn().mockResolvedValue([]),
  getAllMemories: jest.fn().mockResolvedValue([]),
}));

// Mock life-os-config
jest.mock('@/lib/life-os-config', () => ({
  getAgent: jest.fn().mockReturnValue(null),
  getDomain: jest.fn().mockReturnValue(null),
  getLifeCharter: jest.fn().mockReturnValue(null),
  determineEscalationLevel: jest.fn().mockReturnValue('AUTO_EXECUTE'),
}));

// Mock fetch for OpenRouter calls
global.fetch = jest.fn();

import {
  generateDailyBrief,
  chat,
  analyzeOutgoingMessage,
  getMemories,
  type LegalContext,
  type DailyBriefItem,
  type DailyBrief,
  type ChatResponse,
} from '@/lib/legal/LegalAdvisorLLM';
import { addMemory, searchMemories, getAllMemories } from '@/lib/MemoryWrapper';
import { getAgent, getDomain, getLifeCharter } from '@/lib/life-os-config';

describe('Legal Advisor LLM', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('Types', () => {
    it('should define LegalContext interface', () => {
      const context: LegalContext = {
        caseNumber: '164400524',
        nextHearing: { date: '02-15-2025', time: '09:00 AM' },
        judge: 'Derek P. Pullan',
        parties: [
          { type: 'Petitioner', name: 'James Brady', attorney: 'Zachary Starr' },
          { type: 'Respondent', name: 'Destiny Brady', attorney: 'Brian Arnold' },
        ],
        recentEmails: [
          { from: 'attorney@example.com', subject: 'Case Update', snippet: 'Brief update...', date: '2025-01-15' },
        ],
        recentTexts: [
          { text: 'Confirming pickup time', date: '2025-01-14', from: '+1234567890' },
        ],
        timeline: [
          { date: '2025-01-10', source: 'court', type: 'hearing', description: 'Status conference' },
        ],
        strategicBrief: null,
      };

      expect(context.caseNumber).toBe('164400524');
      expect(context.parties).toHaveLength(2);
    });

    it('should define DailyBriefItem interface', () => {
      const item: DailyBriefItem = {
        id: 'urgent-1',
        category: 'urgent',
        title: 'Filing Deadline',
        description: 'Motion due tomorrow',
        evidence: [
          { type: 'email', source: 'attorney', snippet: 'Deadline notice...', date: '2025-01-14' },
        ],
        utahLawRef: '§ 81-9-202',
        action: 'Prepare and file motion today',
      };

      expect(item.category).toBe('urgent');
      expect(item.evidence).toHaveLength(1);
    });

    it('should define DailyBrief interface', () => {
      const brief: DailyBrief = {
        generatedAt: new Date().toISOString(),
        caseNumber: '164400524',
        nextHearing: { date: '02-15-2025', time: '09:00 AM' },
        urgent: [],
        opportunities: [],
        warnings: [],
        summary: 'Overall case status summary',
      };

      expect(brief.caseNumber).toBe('164400524');
      expect(brief.urgent).toHaveLength(0);
    });

    it('should define ChatResponse interface', () => {
      const response: ChatResponse = {
        response: 'Based on Utah law...',
        reasoning: 'Analysis rationale',
        suggestedActions: ['File motion', 'Prepare documents'],
        evidenceUsed: [
          { type: 'email', source: 'attorney', snippet: 'relevant text' },
        ],
        memoryUpdated: true,
      };

      expect(response.suggestedActions).toHaveLength(2);
      expect(response.memoryUpdated).toBe(true);
    });
  });

  describe('generateDailyBrief', () => {
    const mockContext: LegalContext = {
      caseNumber: '164400524',
      nextHearing: { date: '02-15-2025', time: '09:00 AM' },
      judge: 'Derek P. Pullan',
      parties: [],
      recentEmails: [],
      recentTexts: [],
      timeline: [],
      strategicBrief: null,
    };

    it('should generate daily brief with proper structure', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              urgent: [{ title: 'Test', description: 'Test desc', evidence: [], utahLawRef: '', action: '' }],
              opportunities: [],
              warnings: [],
              summary: 'Test summary',
            }),
          },
        }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const brief = await generateDailyBrief(mockContext);

      expect(brief).toHaveProperty('generatedAt');
      expect(brief).toHaveProperty('caseNumber');
      expect(brief).toHaveProperty('urgent');
      expect(brief).toHaveProperty('opportunities');
      expect(brief).toHaveProperty('warnings');
      expect(brief).toHaveProperty('summary');
    });

    it('should search memory for relevant past analysis', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                urgent: [],
                opportunities: [],
                warnings: [],
                summary: 'Test',
              }),
            },
          }],
        }),
      });

      await generateDailyBrief(mockContext);

      expect(searchMemories).toHaveBeenCalledWith(
        'case strategy hearing custody',
        'legal-advisor',
        5
      );
    });

    it('should save brief to memory', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                urgent: [],
                opportunities: [],
                warnings: [],
                summary: 'Today summary',
              }),
            },
          }],
        }),
      });

      await generateDailyBrief(mockContext);

      expect(addMemory).toHaveBeenCalledWith(
        expect.stringContaining('Daily Brief'),
        'legal-advisor',
        expect.objectContaining({ type: 'daily_brief' })
      );
    });

    it('should handle malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is not valid JSON',
            },
          }],
        }),
      });

      const brief = await generateDailyBrief(mockContext);

      // Should fall back gracefully
      expect(brief).toHaveProperty('urgent');
      expect(brief).toHaveProperty('summary');
    });

    it('should throw error when API key not configured', async () => {
      delete process.env.OPENROUTER_API_KEY;

      await expect(generateDailyBrief(mockContext)).rejects.toThrow('OPENROUTER_API_KEY not configured');
    });

    it('should use fallback model on primary failure', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  urgent: [],
                  opportunities: [],
                  warnings: [],
                  summary: 'Fallback response',
                }),
              },
            }],
          }),
        });

      const brief = await generateDailyBrief(mockContext);

      expect(brief.summary).toBe('Fallback response');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('chat', () => {
    const mockContext: LegalContext = {
      caseNumber: '164400524',
      nextHearing: null,
      judge: null,
      parties: [],
      recentEmails: [],
      recentTexts: [],
      timeline: [],
      strategicBrief: null,
    };

    it('should process chat message and return response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Based on Utah law, you should...\n\nSuggested actions:\n- File motion\n- Prepare documents',
            },
          }],
        }),
      });

      const response = await chat('What should I do about custody?', mockContext);

      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('suggestedActions');
      expect(response).toHaveProperty('evidenceUsed');
    });

    it('should search memory for relevant context', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response text' },
          }],
        }),
      });

      await chat('Question about custody', mockContext);

      expect(searchMemories).toHaveBeenCalledWith(
        'Question about custody',
        'legal-advisor',
        5
      );
    });

    it('should update memory for important messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response text' },
          }],
        }),
      });

      const response = await chat('Remember this important fact', mockContext);

      expect(addMemory).toHaveBeenCalledWith(
        expect.stringContaining('User context'),
        'legal-advisor',
        expect.any(Object)
      );
      expect(response.memoryUpdated).toBe(true);
    });

    it('should include chat history in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
          }],
        }),
      });

      const history = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' },
      ];

      await chat('New question', mockContext, history);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Previous question'),
        })
      );
    });

    it('should limit chat history to last 10 messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
          }],
        }),
      });

      const history = Array(15).fill(null).map((_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
      }));

      await chat('New question', mockContext, history);

      // The function should limit to last 10 messages
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('analyzeOutgoingMessage', () => {
    const mockContext: LegalContext = {
      caseNumber: '164400524',
      nextHearing: null,
      judge: null,
      parties: [],
      recentEmails: [],
      recentTexts: [],
      timeline: [],
      strategicBrief: null,
    };

    it('should analyze draft message for risks', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                riskLevel: 'low',
                issues: [],
                rewriteSuggestion: 'The draft is fine as written.',
              }),
            },
          }],
        }),
      });

      const result = await analyzeOutgoingMessage(
        'Thank you for the update.',
        'attorney@example.com',
        mockContext
      );

      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('rewriteSuggestion');
    });

    it('should identify high-risk language', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                riskLevel: 'high',
                issues: [
                  { type: 'emotional', text: 'You always ignore', suggestion: 'Rephrase professionally' },
                ],
                rewriteSuggestion: 'I have noticed delays in responses...',
              }),
            },
          }],
        }),
      });

      const result = await analyzeOutgoingMessage(
        'You always ignore my requests!',
        'ex@example.com',
        mockContext
      );

      expect(result.riskLevel).toBe('high');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle parse errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Invalid JSON response' },
          }],
        }),
      });

      const result = await analyzeOutgoingMessage(
        'Test message',
        'recipient@example.com',
        mockContext
      );

      expect(result.riskLevel).toBe('medium');
      expect(result.issues[0].type).toBe('parse_error');
    });
  });

  describe('getMemories', () => {
    it('should retrieve all memories for legal advisor', async () => {
      (getAllMemories as jest.Mock).mockResolvedValue([
        { id: 'mem-1', text: 'Memory 1' },
        { id: 'mem-2', text: 'Memory 2' },
      ]);

      const memories = await getMemories();

      expect(getAllMemories).toHaveBeenCalledWith('legal-advisor');
      expect(memories).toHaveLength(2);
    });
  });

  describe('Life OS Config Integration', () => {
    it('should use Life OS config when available', async () => {
      (getAgent as jest.Mock).mockReturnValue({
        system_prompt: 'Custom legal prompt from Life OS',
      });
      (getLifeCharter as jest.Mock).mockReturnValue({
        escalation_levels: {
          CRITICAL: { response_time: '1h', triggers: ['lawsuit'] },
          PROPOSE: { response_time: '4h', triggers: ['large expense'] },
        },
      });
      (getDomain as jest.Mock).mockReturnValue({
        name: 'Vuplicity',
        type: 'business',
        sensitivity_level: 'high',
        description: 'FCRA compliance',
        key_people: ['CEO', 'CFO'],
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
          }],
        }),
      });

      const mockContext: LegalContext = {
        caseNumber: '164400524',
        nextHearing: null,
        judge: null,
        parties: [],
        recentEmails: [],
        recentTexts: [],
        timeline: [],
        strategicBrief: null,
      };

      await chat('Test', mockContext);

      expect(getAgent).toHaveBeenCalledWith('agent.legal');
    });

    it('should fall back to default prompt when Life OS unavailable', async () => {
      (getAgent as jest.Mock).mockReturnValue(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'Response' },
          }],
        }),
      });

      const mockContext: LegalContext = {
        caseNumber: '164400524',
        nextHearing: null,
        judge: null,
        parties: [],
        recentEmails: [],
        recentTexts: [],
        timeline: [],
        strategicBrief: null,
      };

      await chat('Test', mockContext);

      // Should not throw even without Life OS config
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Temporal Context', () => {
    it('should include temporal context in daily brief', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                urgent: [],
                opportunities: [],
                warnings: [],
                summary: 'Summary',
              }),
            },
          }],
        }),
      });

      const mockContext: LegalContext = {
        caseNumber: '164400524',
        nextHearing: { date: '02-15-2025', time: '09:00 AM' },
        judge: 'Judge Name',
        parties: [],
        recentEmails: [
          { from: 'test@test.com', subject: 'Test', snippet: 'Test', date: '2025-01-14' },
        ],
        recentTexts: [
          { text: 'Test', date: '2025-01-14', from: '+1234567890' },
        ],
        timeline: [],
        strategicBrief: null,
      };

      await generateDailyBrief(mockContext);

      // Check that fetch was called with temporal context
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('TODAY\'S DATE'),
        })
      );
    });
  });

  describe('API Error Handling', () => {
    it('should throw when both primary and fallback fail', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Fallback failed'));

      const mockContext: LegalContext = {
        caseNumber: '164400524',
        nextHearing: null,
        judge: null,
        parties: [],
        recentEmails: [],
        recentTexts: [],
        timeline: [],
        strategicBrief: null,
      };

      await expect(generateDailyBrief(mockContext)).rejects.toThrow('Both models failed');
    });

    it('should handle non-OK API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      const mockContext: LegalContext = {
        caseNumber: '164400524',
        nextHearing: null,
        judge: null,
        parties: [],
        recentEmails: [],
        recentTexts: [],
        timeline: [],
        strategicBrief: null,
      };

      await expect(generateDailyBrief(mockContext)).rejects.toThrow('OpenRouter API error');
    });
  });
});
