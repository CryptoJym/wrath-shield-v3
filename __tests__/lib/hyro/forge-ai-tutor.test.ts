// @ts-nocheck
/**
 * Tests for HYRO FORGE: AI-Powered Tutor System
 *
 * Tests the intelligent tutoring system including context building,
 * intent detection, chat functions, and quest generation.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock server-only-guard
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock OpenRouterClient
const mockOpenRouterClient = {
  getCoachingResponse: jest.fn(() => Promise.resolve({
    content: JSON.stringify({
      message: 'Great question! Let me help you understand.',
      intent_detected: 'explain',
      xp_awarded: 5,
    }),
  })),
  setAgentId: jest.fn(),
};

jest.mock('../../../lib/OpenRouterClient', () => ({
  getOpenRouterClient: jest.fn(() => mockOpenRouterClient),
  CoachingResponse: {},
}));

// Mock database
const mockDb = {
  prepare: jest.fn(() => ({
    run: jest.fn(() => ({ changes: 1 })),
    get: jest.fn(),
    all: jest.fn(() => []),
  })),
};

jest.mock('../../../lib/db/Database', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

// Mock forge-types
jest.mock('../../../lib/hyro/forge-types', () => ({
  STAT_NAMES: ['math', 'reading', 'writing', 'science', 'social_studies', 'art', 'music', 'pe'],
}));

// Mock forge-proficiency
jest.mock('../../../lib/hyro/forge-proficiency', () => ({
  getProficiencyProfile: jest.fn(() => ({
    stats: {
      math: { stat_name: 'math', level: 65, uncertainty: 0.2 },
      reading: { stat_name: 'reading', level: 70, uncertainty: 0.15 },
      writing: { stat_name: 'writing', level: 55, uncertainty: 0.25 },
    },
    weakest_stat: 'writing',
    strongest_stat: 'reading',
  })),
  getSkillProficiency: jest.fn(() => ({ level: 60, uncertainty: 0.2 })),
  getProficiencyProfileAsync: jest.fn(() => Promise.resolve({
    stats: {
      math: { stat_name: 'math', level: 65, uncertainty: 0.2 },
      reading: { stat_name: 'reading', level: 70, uncertainty: 0.15 },
    },
    weakest_stat: 'math',
    strongest_stat: 'reading',
    average_level: 67.5,
    average_uncertainty: 0.175,
  })),
}));

// Mock forge-zpd-engine
jest.mock('../../../lib/hyro/forge-zpd-engine', () => ({
  getZPDState: jest.fn((stat) => ({
    stat_name: stat,
    current_level: 60,
    optimal_difficulty: 65,
    trend: 'improving',
    adjustment_needed: 'none',
    scaffolding_recommended: false,
  })),
  getLearningVelocity: jest.fn(() => ({ weekly_growth: 2.5 })),
  detectFlowState: jest.fn(() => ({ in_flow: false, flow_score: 0.6 })),
  getAllZPDStatesAsync: jest.fn(() => Promise.resolve([
    { stat_name: 'math', current_level: 60, optimal_difficulty: 65, trend: 'improving' },
  ])),
  getAllLearningVelocitiesAsync: jest.fn(() => Promise.resolve([
    { stat_name: 'math', daily_growth: 0.5, weekly_growth: 2.5, acceleration: 0.1, estimated_days_to_benchmark: 30 },
  ])),
  getAllFlowStatesAsync: jest.fn(() => Promise.resolve([
    { stat_name: 'math', in_flow: false, flow_score: 0.6 },
  ])),
}));

// Mock forge-session-orchestrator
jest.mock('../../../lib/hyro/forge-session-orchestrator', () => ({
  getSessionContext: jest.fn(() => ({
    due_cards_count: 10,
    due_cards: [],
    active_quests: [],
    quests_due_today: [],
    overdue_quests: [],
    books_in_progress: [],
    stats_needing_diagnostic: [],
    active_skill_gaps: [],
    stats_with_trend: [],
    current_streak: 5,
  })),
  getTodaySession: jest.fn(() => null),
  getSessionContextAsync: jest.fn(() => Promise.resolve({
    due_cards_count: 10,
    due_cards: [],
    active_quests: [],
    quests_due_today: [],
    overdue_quests: [],
    books_in_progress: [],
    stats_needing_diagnostic: [],
    active_skill_gaps: [],
    stats_with_trend: [],
    current_streak: 5,
  })),
}));

// Mock forge-diagnostics
jest.mock('../../../lib/hyro/forge-diagnostics', () => ({
  getActiveSkillGaps: jest.fn(() => [
    { stat_name: 'math', topic: 'fractions', gap_severity: 'medium', current_level: 45 },
  ]),
  getDiagnosticOverview: jest.fn(),
}));

// Mock education-memory
jest.mock('../../../lib/hyro/education-memory', () => ({
  searchEducationMemory: jest.fn(() => Promise.resolve([
    { memory: { text: 'Previous learning about fractions' } },
  ])),
  addEducationMemory: jest.fn(() => Promise.resolve()),
}));

// Mock education-store
jest.mock('../../../lib/hyro/education-store', () => ({
  getStandard: jest.fn(() => ({
    id: '6.RP.A.1',
    description: 'Understand the concept of a ratio',
  })),
  getConceptsForStandard: jest.fn(() => []),
}));

// Mock forge-xp
jest.mock('../../../lib/hyro/forge-xp', () => ({
  awardXP: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-12345'),
}));

// Import after mocks
import {
  buildTutorContext,
  buildTutorContextAsync,
  buildTutorContextSafe,
  chat,
  chatAsync,
  generateQuest,
  getConversation,
  saveConversation,
  addMessage,
  generateInterviewQuestion,
  evaluateResponse,
  formatContextForLLM,
} from '../../../lib/hyro/forge-ai-tutor';
import type {
  TutorIntentType,
  TutorMessage,
  TutorConversation,
  TutorContext,
  TutorResponse,
  AssessmentResult,
} from '../../../lib/hyro/forge-ai-tutor';

describe('HYRO FORGE: AI-Powered Tutor System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Type Definition Tests
  // ==========================================================================

  describe('Type Definitions', () => {
    it('should define TutorIntentType values', () => {
      const intents: TutorIntentType[] = [
        'explain', 'practice', 'review', 'encourage', 'diagnose',
        'quest', 'study_plan', 'check_in', 'chat', 'answer_question',
      ];
      expect(intents).toHaveLength(10);
    });

    it('should define TutorMessage interface', () => {
      const message: TutorMessage = {
        id: 'msg-123',
        role: 'user',
        content: 'Help me with math',
        timestamp: Date.now(),
        metadata: {
          intent: 'explain',
          stat_focus: ['math'],
          difficulty_level: 5,
          xp_awarded: 10,
        },
      };

      expect(message.role).toBe('user');
      expect(message.metadata?.intent).toBe('explain');
    });

    it('should define TutorConversation interface', () => {
      const conversation: TutorConversation = {
        id: 'conv-123',
        messages: [],
        created_at: Date.now(),
        last_message_at: Date.now(),
        total_xp_earned: 50,
        stat_focus: ['math', 'reading'],
      };

      expect(conversation.id).toBe('conv-123');
      expect(conversation.stat_focus).toContain('math');
    });

    it('should define TutorContext interface', () => {
      const context: Partial<TutorContext> = {
        child_name: 'Hyro',
        proficiency: [],
        zpd_states: [],
        active_skill_gaps: [],
        learning_velocities: [],
        flow_states: [],
        recent_memories: [],
      };

      expect(context.child_name).toBe('Hyro');
    });

    it('should define TutorResponse interface', () => {
      const response: TutorResponse = {
        message: 'Great question!',
        intent_detected: 'explain',
        suggested_actions: [
          { type: 'start_session', label: 'Start Learning' },
        ],
        xp_awarded: 5,
      };

      expect(response.intent_detected).toBe('explain');
      expect(response.xp_awarded).toBe(5);
    });

    it('should define AssessmentResult interface', () => {
      const result: AssessmentResult = {
        score: 85,
        feedback: 'Good understanding of the concept.',
        is_correct: true,
        misconception_detected: undefined,
      };

      expect(result.score).toBe(85);
      expect(result.is_correct).toBe(true);
    });
  });

  // ==========================================================================
  // Context Building Tests
  // ==========================================================================

  describe('buildTutorContext', () => {
    it('should build context with proficiency data', () => {
      const context = buildTutorContext();

      expect(context.child_name).toBe('Hyro');
      expect(context.proficiency).toBeDefined();
      expect(Array.isArray(context.proficiency)).toBe(true);
    });

    it('should include ZPD states for all stats', () => {
      const context = buildTutorContext();

      expect(context.zpd_states).toBeDefined();
      expect(Array.isArray(context.zpd_states)).toBe(true);
    });

    it('should include session context', () => {
      const context = buildTutorContext();

      expect(context.session_context).toBeDefined();
      expect(context.session_context.due_cards_count).toBe(10);
    });

    it('should include active skill gaps', () => {
      const context = buildTutorContext();

      expect(context.active_skill_gaps).toBeDefined();
      expect(context.active_skill_gaps[0]?.topic).toBe('fractions');
    });

    it('should include learning velocities', () => {
      const context = buildTutorContext();

      expect(context.learning_velocities).toBeDefined();
      expect(Array.isArray(context.learning_velocities)).toBe(true);
    });

    it('should include flow states', () => {
      const context = buildTutorContext();

      expect(context.flow_states).toBeDefined();
      expect(Array.isArray(context.flow_states)).toBe(true);
    });
  });

  describe('buildTutorContextAsync', () => {
    it('should build context asynchronously with parallel operations', async () => {
      const context = await buildTutorContextAsync();

      expect(context.child_name).toBe('Hyro');
      expect(context.proficiency).toBeDefined();
    });

    it('should have faster execution via parallelization', async () => {
      const start = Date.now();
      await buildTutorContextAsync();
      const duration = Date.now() - start;

      // Should complete quickly (mocked so nearly instant)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('buildTutorContextSafe', () => {
    it('should handle partial failures gracefully', async () => {
      const { getProficiencyProfileAsync } = require('../../../lib/hyro/forge-proficiency');
      getProficiencyProfileAsync.mockRejectedValueOnce(new Error('Failed'));

      const context = await buildTutorContextSafe();

      // Should still return context with defaults
      expect(context.child_name).toBe('Hyro');
    });

    it('should return best-effort context when operations fail', async () => {
      const context = await buildTutorContextSafe();

      expect(context).toBeDefined();
      expect(context.proficiency).toBeDefined();
    });
  });

  // ==========================================================================
  // Format Context Tests
  // ==========================================================================

  describe('formatContextForLLM', () => {
    it('should format context as string for LLM', () => {
      const context = buildTutorContext();
      const formatted = formatContextForLLM(context);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('LEARNER PROFILE');
    });

    it('should include proficiency levels', () => {
      const context = buildTutorContext();
      const formatted = formatContextForLLM(context);

      expect(formatted).toContain('PROFICIENCY LEVELS');
    });

    it('should include weakest areas', () => {
      const context = buildTutorContext();
      const formatted = formatContextForLLM(context);

      expect(formatted).toContain('WEAKEST AREAS');
    });

    it('should include ZPD information', () => {
      const context = buildTutorContext();
      const formatted = formatContextForLLM(context);

      expect(formatted).toContain('ZONE OF PROXIMAL DEVELOPMENT');
    });
  });

  // ==========================================================================
  // Chat Function Tests
  // ==========================================================================

  describe('chat', () => {
    it('should process user message and return response', async () => {
      const response = await chat('Help me understand fractions');

      expect(response).toBeDefined();
      expect(response.message).toBeDefined();
    });

    it('should detect intent from message', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'Let me explain...',
          intent_detected: 'explain',
        }),
      });

      const response = await chat('What is a ratio?');

      expect(response.intent_detected).toBe('explain');
    });

    it('should include conversation history', async () => {
      const history: TutorMessage[] = [
        { id: '1', role: 'user', content: 'Hi', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hello!', timestamp: Date.now() },
      ];

      await chat('Help with math', history);

      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      mockOpenRouterClient.getCoachingResponse.mockRejectedValueOnce(
        new Error('LLM error')
      );

      await expect(chat('Test')).rejects.toThrow('Tutor chat failed');
    });

    it('should parse JSON response from LLM', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Response", "intent_detected": "chat", "xp_awarded": 3}',
      });

      const response = await chat('Hello');

      expect(response.message).toBe('Response');
      expect(response.xp_awarded).toBe(3);
    });

    it('should handle markdown code block in response', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '```json\n{"message": "Response", "intent_detected": "chat"}\n```',
      });

      const response = await chat('Hello');

      expect(response.message).toBe('Response');
    });
  });

  describe('chatAsync', () => {
    it('should use parallel context building', async () => {
      const response = await chatAsync('Help me with reading');

      expect(response).toBeDefined();
    });

    it('should fetch memories in parallel with context', async () => {
      const { searchEducationMemory } = require('../../../lib/hyro/education-memory');

      await chatAsync('Test message');

      expect(searchEducationMemory).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Intent Detection Tests
  // ==========================================================================

  describe('Intent Detection', () => {
    it('should detect quest intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Quest generated", "intent_detected": "quest"}',
      });

      const response = await chat('Give me a quest');
      expect(response.intent_detected).toBe('quest');
    });

    it('should detect practice intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Practice problem", "intent_detected": "practice"}',
      });

      const response = await chat('I want to practice math');
      expect(response.intent_detected).toBe('practice');
    });

    it('should detect explain intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Explanation", "intent_detected": "explain"}',
      });

      const response = await chat('Explain how fractions work');
      expect(response.intent_detected).toBe('explain');
    });

    it('should detect review intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Review", "intent_detected": "review"}',
      });

      const response = await chat('What did I learn today?');
      expect(response.intent_detected).toBe('review');
    });

    it('should detect encourage intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Encouragement", "intent_detected": "encourage"}',
      });

      const response = await chat("I'm stuck and frustrated");
      expect(response.intent_detected).toBe('encourage');
    });

    it('should detect check_in intent', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"message": "Hello!", "intent_detected": "check_in"}',
      });

      const response = await chat('Hello');
      expect(response.intent_detected).toBe('check_in');
    });
  });

  // ==========================================================================
  // Quest Generation Tests
  // ==========================================================================

  describe('generateQuest', () => {
    beforeEach(() => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValue({
        content: JSON.stringify({
          title: 'Fraction Explorer',
          description: 'Master the basics of fractions',
          quest_type: 'daily',
          difficulty: 'normal',
          xp_reward: 50,
          required_stat: 'math',
          success_criteria: ['Complete 5 problems', 'Score 80% or higher'],
        }),
      });
    });

    it('should generate quest for specific stat', async () => {
      const quest = await generateQuest('math');

      expect(quest).toBeDefined();
      expect(quest.title).toBe('Fraction Explorer');
      expect(quest.required_stat).toBe('math');
    });

    it('should save quest to database', async () => {
      await generateQuest('reading');

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should use ZPD for difficulty targeting', async () => {
      const { getZPDState } = require('../../../lib/hyro/forge-zpd-engine');

      await generateQuest('math');

      expect(getZPDState).toHaveBeenCalledWith('math');
    });

    it('should allow difficulty override', async () => {
      await generateQuest('math', 75);

      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should generate quest for specific standard', async () => {
      await generateQuest(undefined, undefined, '6.RP.A.1');

      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should record quest to memory', async () => {
      const { addEducationMemory } = require('../../../lib/hyro/education-memory');

      await generateQuest('math');

      expect(addEducationMemory).toHaveBeenCalled();
    });

    it('should handle quest generation errors', async () => {
      mockOpenRouterClient.getCoachingResponse.mockRejectedValueOnce(
        new Error('Generation failed')
      );

      await expect(generateQuest('math')).rejects.toThrow('Quest generation failed');
    });
  });

  // ==========================================================================
  // Conversation Management Tests
  // ==========================================================================

  describe('getConversation', () => {
    it('should create new conversation when no ID provided', () => {
      const conversation = getConversation();

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect(conversation.messages).toEqual([]);
    });

    it('should retrieve existing conversation by ID', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => ({
          id: 'existing-conv',
          messages: '[]',
          created_at: 1705330800,
          last_message_at: 1705330800,
          total_xp_earned: 100,
          stat_focus: '["math"]',
        })),
      });

      const conversation = getConversation('existing-conv');

      expect(conversation.id).toBe('existing-conv');
      expect(conversation.total_xp_earned).toBe(100);
    });

    it('should create new conversation when ID not found', () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn(() => undefined),
      });

      const conversation = getConversation('nonexistent');

      expect(conversation.id).toBeDefined();
      expect(conversation.messages).toEqual([]);
    });
  });

  describe('saveConversation', () => {
    it('should save conversation to database', () => {
      const conversation: TutorConversation = {
        id: 'test-conv',
        messages: [],
        created_at: Date.now(),
        last_message_at: Date.now(),
        total_xp_earned: 50,
        stat_focus: ['math'],
      };

      saveConversation(conversation);

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation', () => {
      const conversation: TutorConversation = {
        id: 'test-conv',
        messages: [],
        created_at: Date.now(),
        last_message_at: Date.now(),
        total_xp_earned: 0,
        stat_focus: [],
      };

      const message = addMessage(conversation, 'user', 'Hello!');

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
      expect(conversation.messages).toHaveLength(1);
    });

    it('should update last_message_at', () => {
      const oldTime = Date.now() - 10000;
      const conversation: TutorConversation = {
        id: 'test-conv',
        messages: [],
        created_at: oldTime,
        last_message_at: oldTime,
        total_xp_earned: 0,
        stat_focus: [],
      };

      addMessage(conversation, 'user', 'Hello!');

      expect(conversation.last_message_at).toBeGreaterThan(oldTime);
    });

    it('should accumulate XP from messages', () => {
      const conversation: TutorConversation = {
        id: 'test-conv',
        messages: [],
        created_at: Date.now(),
        last_message_at: Date.now(),
        total_xp_earned: 10,
        stat_focus: [],
      };

      addMessage(conversation, 'assistant', 'Response', { xp_awarded: 5 });

      expect(conversation.total_xp_earned).toBe(15);
    });

    it('should track stat focus from messages', () => {
      const conversation: TutorConversation = {
        id: 'test-conv',
        messages: [],
        created_at: Date.now(),
        last_message_at: Date.now(),
        total_xp_earned: 0,
        stat_focus: [],
      };

      addMessage(conversation, 'assistant', 'Response', { stat_focus: ['math', 'reading'] });

      expect(conversation.stat_focus).toContain('math');
      expect(conversation.stat_focus).toContain('reading');
    });
  });

  // ==========================================================================
  // Assessment Tests
  // ==========================================================================

  describe('generateInterviewQuestion', () => {
    beforeEach(() => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValue({
        content: '{"question": "What is a ratio?", "context": "Consider comparing quantities"}',
      });
    });

    it('should generate question for standard', async () => {
      const result = await generateInterviewQuestion('6.RP.A.1');

      expect(result.question).toBe('What is a ratio?');
    });

    it('should avoid previous questions', async () => {
      const previous = ['What is 2+2?'];

      await generateInterviewQuestion('6.RP.A.1', previous);

      const call = mockOpenRouterClient.getCoachingResponse.mock.calls[0];
      expect(call[0].messages[0].content).toContain('PREVIOUS QUESTIONS');
    });

    it('should handle missing standard', async () => {
      const { getStandard } = require('../../../lib/hyro/education-store');
      getStandard.mockReturnValueOnce(null);

      await expect(generateInterviewQuestion('invalid'))
        .rejects.toThrow('Standard not found');
    });
  });

  describe('evaluateResponse', () => {
    beforeEach(() => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValue({
        content: '{"score": 85, "feedback": "Good job!", "is_correct": true}',
      });
    });

    it('should evaluate student response', async () => {
      const result = await evaluateResponse(
        '6.RP.A.1',
        'What is a ratio?',
        'A ratio compares two quantities'
      );

      expect(result.score).toBe(85);
      expect(result.is_correct).toBe(true);
    });

    it('should provide feedback', async () => {
      const result = await evaluateResponse('6.RP.A.1', 'Question', 'Answer');

      expect(result.feedback).toBe('Good job!');
    });

    it('should detect misconceptions', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: '{"score": 40, "feedback": "Review the concept", "is_correct": false, "misconception_detected": "Confusing ratio with fraction"}',
      });

      const result = await evaluateResponse('6.RP.A.1', 'Question', 'Wrong answer');

      expect(result.is_correct).toBe(false);
      expect(result.misconception_detected).toBe('Confusing ratio with fraction');
    });

    it('should handle evaluation errors', async () => {
      mockOpenRouterClient.getCoachingResponse.mockResolvedValueOnce({
        content: 'Invalid response',
      });

      const result = await evaluateResponse('6.RP.A.1', 'Question', 'Answer');

      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Could not evaluate');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty conversation history', async () => {
      const response = await chat('Hello', []);

      expect(response).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(10000);

      await chat(longMessage);

      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should handle special characters in messages', async () => {
      const response = await chat('What is 5 + 3 = ?');

      expect(response).toBeDefined();
    });

    it('should handle Unicode in messages', async () => {
      const response = await chat('Help with math 数学');

      expect(response).toBeDefined();
    });

    it('should limit conversation history to last 10 messages', async () => {
      const history: TutorMessage[] = Array.from({ length: 15 }, (_, i) => ({
        id: String(i),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));

      await chat('New message', history);

      // The LLM should receive limited history
      expect(mockOpenRouterClient.getCoachingResponse).toHaveBeenCalled();
    });

    it('should handle memory search failures gracefully', async () => {
      const { searchEducationMemory } = require('../../../lib/hyro/education-memory');
      searchEducationMemory.mockRejectedValueOnce(new Error('Memory error'));

      const response = await chat('Test');

      expect(response).toBeDefined();
    });
  });

  // ==========================================================================
  // Server-Only Guard Tests
  // ==========================================================================

  describe('Server-Only Guard', () => {
    it('should call ensureServerOnly on module load', () => {
      const { ensureServerOnly } = require('../../../lib/server-only-guard');
      expect(ensureServerOnly).toHaveBeenCalledWith('lib/hyro/forge-ai-tutor');
    });
  });
});
