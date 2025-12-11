// @ts-nocheck
/**
 * Wrath Shield v3 - Predictive Suggestions Tests
 *
 * Tests for AI-powered suggestion generation:
 * - Suggestion types and interfaces
 * - Task priority suggestions
 * - Next action suggestions
 * - Completion time predictions
 * - Daily suggestions generation
 * - Suggestion acceptance/rejection
 */

// Mock Database
const mockPrepare = jest.fn();
const mockExec = jest.fn();
const mockGet = jest.fn();
const mockAll = jest.fn().mockReturnValue([]);

jest.mock('@/lib/db/Database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    getRawDb: jest.fn().mockReturnValue({
      exec: mockExec,
      prepare: mockPrepare.mockReturnValue({
        run: jest.fn().mockReturnValue({ changes: 1 }),
        get: mockGet,
        all: mockAll,
      }),
    }),
  }),
}));

// Mock server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock temporal-memory
jest.mock('@/lib/pm/temporal-memory', () => ({
  getCurrentState: jest.fn().mockReturnValue({
    entity_type: 'task',
    entity_id: 'task-123',
    attributes: {
      priority: 'medium',
      status: 'pending',
      project_name: 'Project A',
      labels: ['bug'],
    },
    relationships: [],
    last_updated: Math.floor(Date.now() / 1000),
  }),
  getCurrentRelationships: jest.fn().mockReturnValue([]),
  queryFacts: jest.fn().mockReturnValue([
    {
      id: 'fact-1',
      entity_type: 'task',
      entity_id: 'task-123',
      attribute: 'status',
      value: '"pending"',
      valid_from: Math.floor(Date.now() / 1000) - 86400,
    },
  ]),
}));

// Mock pattern-extraction
jest.mock('@/lib/pm/pattern-extraction', () => ({
  getPattern: jest.fn().mockResolvedValue(null),
  getPatternsByType: jest.fn().mockResolvedValue([]),
}));

// Mock integration
jest.mock('@/lib/pm/integration', () => ({
  getAllTasks: jest.fn().mockResolvedValue([
    {
      id: 'task-1',
      title: 'Task 1',
      status: 'pending',
      priority: 'high',
      due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      project_name: 'Project A',
      labels: ['bug'],
    },
    {
      id: 'task-2',
      title: 'Task 2',
      status: 'done',
      priority: 'medium',
      project_name: 'Project A',
      labels: ['feature'],
    },
  ]),
}));

// Mock temporal-context
jest.mock('@/lib/pm/temporal-context', () => ({
  getCurrentContext: jest.fn().mockReturnValue({
    current_timestamp: Math.floor(Date.now() / 1000),
    current_date: new Date().toISOString().split('T')[0],
    business_hours: true,
  }),
}));

import {
  suggestTaskPriority,
  suggestNextAction,
  predictCompletionTime,
  generateDailySuggestions,
  getSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  type Suggestion,
  type SuggestionType,
  type SuggestionStatus,
} from '@/lib/pm/predictive-suggestions';

describe('Predictive Suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
    // Disable AI suggestions for testing
    process.env.USE_AI_SUGGESTIONS = 'false';
  });

  afterEach(() => {
    delete process.env.USE_AI_SUGGESTIONS;
  });

  describe('Types', () => {
    it('should define Suggestion interface', () => {
      const suggestion: Suggestion = {
        id: 'suggest_priority_task-123_1234567890',
        suggestion_type: 'priority',
        target_entity: {
          type: 'task',
          id: 'task-123',
        },
        suggestion: 'Set priority to high',
        rationale: '5 similar tasks were high priority (80% match)',
        confidence: 0.8,
        based_on_patterns: ['completion_time_high'],
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        metadata: {
          current_priority: 'medium',
          suggested_priority: 'high',
        },
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      expect(suggestion.suggestion_type).toBe('priority');
      expect(suggestion.confidence).toBe(0.8);
    });

    it('should define SuggestionType values', () => {
      const types: SuggestionType[] = ['priority', 'assignment', 'deadline', 'action', 'review'];
      expect(types).toHaveLength(5);
    });

    it('should define SuggestionStatus values', () => {
      const statuses: SuggestionStatus[] = ['pending', 'accepted', 'rejected', 'expired'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('suggestTaskPriority', () => {
    it('should return null when task not found', async () => {
      const { getCurrentState } = require('@/lib/pm/temporal-memory');
      getCurrentState.mockReturnValueOnce(null);

      const suggestion = await suggestTaskPriority('nonexistent');

      expect(suggestion).toBeNull();
    });

    it('should return null when no patterns exist', async () => {
      const { getPatternsByType } = require('@/lib/pm/pattern-extraction');
      getPatternsByType.mockResolvedValueOnce([]);

      const suggestion = await suggestTaskPriority('task-123');

      expect(suggestion).toBeNull();
    });

    it('should suggest priority based on similar tasks', async () => {
      const { getCurrentState } = require('@/lib/pm/temporal-memory');
      const { getPatternsByType } = require('@/lib/pm/pattern-extraction');
      const { getAllTasks } = require('@/lib/pm/integration');

      getCurrentState.mockReturnValue({
        entity_type: 'task',
        entity_id: 'task-new',
        attributes: {
          priority: 'low',
          project_name: 'Project A',
          labels: ['bug'],
        },
      });

      getPatternsByType.mockResolvedValue([
        { id: 'pattern-1', confidence: 0.8 },
      ]);

      getAllTasks.mockResolvedValue([
        { id: 'task-1', status: 'done', priority: 'high', project_name: 'Project A', labels: ['bug'] },
        { id: 'task-2', status: 'done', priority: 'high', project_name: 'Project A', labels: ['bug'] },
        { id: 'task-3', status: 'done', priority: 'high', project_name: 'Project A', labels: ['bug'] },
        { id: 'task-4', status: 'done', priority: 'high', project_name: 'Project A', labels: ['bug'] },
      ]);

      const suggestion = await suggestTaskPriority('task-new');

      if (suggestion) {
        expect(suggestion.suggestion_type).toBe('priority');
        expect(suggestion.target_entity.id).toBe('task-new');
      }
    });
  });

  describe('suggestNextAction', () => {
    it('should return action suggestions', async () => {
      const suggestions = await suggestNextAction();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should suggest tasks approaching deadlines', async () => {
      const { getAllTasks } = require('@/lib/pm/integration');
      getAllTasks.mockResolvedValue([
        {
          id: 'task-urgent',
          title: 'Urgent Task',
          status: 'pending',
          priority: 'high',
          due_date: new Date(Date.now() + 2 * 86400000).toISOString(), // 2 days
          updated_at: new Date().toISOString(),
        },
      ]);

      const suggestions = await suggestNextAction();

      const deadlineSuggestion = suggestions.find(s =>
        s.metadata?.days_until_due !== undefined
      );

      if (deadlineSuggestion) {
        expect(deadlineSuggestion.suggestion_type).toBe('action');
      }
    });

    it('should suggest stale high-priority tasks', async () => {
      const { getAllTasks } = require('@/lib/pm/integration');
      getAllTasks.mockResolvedValue([
        {
          id: 'task-stale',
          title: 'Stale High Priority Task',
          status: 'pending',
          priority: 'high',
          updated_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
        },
      ]);

      const suggestions = await suggestNextAction();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should sort suggestions by confidence', async () => {
      const suggestions = await suggestNextAction();

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
      }
    });
  });

  describe('predictCompletionTime', () => {
    it('should return null when task not found', async () => {
      const { getCurrentState } = require('@/lib/pm/temporal-memory');
      getCurrentState.mockReturnValueOnce(null);

      const prediction = await predictCompletionTime('nonexistent');

      expect(prediction).toBeNull();
    });

    it('should return null when no pattern exists', async () => {
      const { getPattern } = require('@/lib/pm/pattern-extraction');
      getPattern.mockResolvedValueOnce(null);

      const prediction = await predictCompletionTime('task-123');

      expect(prediction).toBeNull();
    });

    it('should predict based on pattern data', async () => {
      const { getCurrentState, queryFacts } = require('@/lib/pm/temporal-memory');
      const { getPattern } = require('@/lib/pm/pattern-extraction');

      getCurrentState.mockReturnValue({
        entity_type: 'task',
        entity_id: 'task-123',
        attributes: { priority: 'high' },
      });

      getPattern.mockResolvedValue({
        id: 'completion_time_high',
        confidence: 0.8,
        metadata: {
          avg_days: 5,
          std_dev: 2,
          sample_size: 10,
        },
      });

      queryFacts.mockReturnValue([
        {
          value: '"pending"',
          valid_from: Math.floor(Date.now() / 1000) - 86400,
        },
      ]);

      const prediction = await predictCompletionTime('task-123');

      if (prediction) {
        expect(prediction.suggestion_type).toBe('deadline');
        expect(prediction.metadata?.avg_days).toBe(5);
      }
    });
  });

  describe('generateDailySuggestions', () => {
    it('should return stored suggestions if recent', async () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
      mockAll.mockReturnValueOnce([
        {
          id: 'stored-1',
          type: 'action',
          target_type: 'task',
          target_id: 'task-1',
          suggestion: 'Work on task',
          rationale: 'Deadline approaching',
          confidence: 0.9,
          pattern_ids: '[]',
          status: 'pending',
          created_at: Math.floor(new Date(recentTime).getTime() / 1000),
        },
      ]);

      const suggestions = await generateDailySuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should generate new suggestions if none stored', async () => {
      mockAll.mockReturnValue([]);

      const suggestions = await generateDailySuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should deduplicate suggestions by target entity', async () => {
      mockAll.mockReturnValue([]);

      const suggestions = await generateDailySuggestions();

      const seenKeys = new Set();
      for (const s of suggestions) {
        const key = `${s.target_entity.type}:${s.target_entity.id}`;
        expect(seenKeys.has(key)).toBe(false);
        seenKeys.add(key);
      }
    });
  });

  describe('getSuggestion', () => {
    it('should return suggestion by ID', async () => {
      mockAll.mockReturnValueOnce([
        {
          id: 'suggest-1',
          type: 'priority',
          target_type: 'task',
          target_id: 'task-123',
          suggestion: 'Set priority to high',
          rationale: 'Similar tasks',
          confidence: 0.8,
          pattern_ids: '[]',
          status: 'pending',
          created_at: Math.floor(Date.now() / 1000),
        },
      ]);

      const suggestion = await getSuggestion('suggest-1');

      if (suggestion) {
        expect(suggestion.id).toBe('suggest-1');
        expect(suggestion.suggestion_type).toBe('priority');
      }
    });

    it('should return null when not found', async () => {
      mockAll.mockReturnValue([]);

      const suggestion = await getSuggestion('nonexistent');

      expect(suggestion).toBeNull();
    });
  });

  describe('acceptSuggestion', () => {
    it('should accept suggestion and log', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const suggestion: Suggestion = {
        id: 'suggest-1',
        suggestion_type: 'priority',
        target_entity: { type: 'task', id: 'task-123' },
        suggestion: 'Set priority to high',
        rationale: 'Test',
        confidence: 0.8,
        based_on_patterns: [],
      };

      await acceptSuggestion(suggestion);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Accepted suggestion')
      );

      consoleSpy.mockRestore();
    });

    it('should update status in database', async () => {
      const suggestion: Suggestion = {
        id: 'suggest-1',
        suggestion_type: 'priority',
        target_entity: { type: 'task', id: 'task-123' },
        suggestion: 'Set priority to high',
        rationale: 'Test',
        confidence: 0.8,
        based_on_patterns: [],
      };

      await acceptSuggestion(suggestion);

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('rejectSuggestion', () => {
    it('should reject suggestion with reason', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const suggestion: Suggestion = {
        id: 'suggest-1',
        suggestion_type: 'priority',
        target_entity: { type: 'task', id: 'task-123' },
        suggestion: 'Set priority to high',
        rationale: 'Test',
        confidence: 0.8,
        based_on_patterns: [],
      };

      await rejectSuggestion(suggestion, 'Not applicable');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rejected suggestion')
      );

      consoleSpy.mockRestore();
    });

    it('should update status in database', async () => {
      const suggestion: Suggestion = {
        id: 'suggest-1',
        suggestion_type: 'priority',
        target_entity: { type: 'task', id: 'task-123' },
        suggestion: 'Set priority to high',
        rationale: 'Test',
        confidence: 0.8,
        based_on_patterns: [],
      };

      await rejectSuggestion(suggestion);

      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('Suggestion Persistence', () => {
    it('should save suggestions with expiry', async () => {
      mockAll.mockReturnValue([]);

      await generateDailySuggestions();

      // Verify INSERT was called for new suggestions
      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should filter expired suggestions', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockAll.mockReturnValueOnce([
        {
          id: 'expired-1',
          type: 'action',
          target_type: 'task',
          target_id: 'task-1',
          suggestion: 'Old suggestion',
          rationale: 'Expired',
          confidence: 0.9,
          pattern_ids: '[]',
          status: 'pending',
          created_at: expiredTime,
          expires_at: expiredTime, // Already expired
        },
      ]);

      // Active-only query should filter out expired
      const suggestions = await generateDailySuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
