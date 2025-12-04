// @ts-nocheck
/**
 * Hyro Forge: AI Evaluator Tests
 * Tests for Phase 1 - AI-powered comprehension evaluation with cascading strategy
 */

import { Database } from '../../../lib/db/Database';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';

// Disable server-only guard for testing
jest.mock('../../../lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock OpenRouterClient
const mockGetCoachingResponse = jest.fn();
jest.mock('../../../lib/OpenRouterClient', () => ({
  getOpenRouterClient: () => ({
    getCoachingResponse: mockGetCoachingResponse,
  }),
  OpenRouterClient: jest.fn().mockImplementation(() => ({
    getCoachingResponse: mockGetCoachingResponse,
  })),
}));

// Mock education memory
jest.mock('../../../lib/hyro/education-memory', () => ({
  searchEducationMemory: jest.fn().mockResolvedValue([]),
  addEducationMemory: jest.fn().mockResolvedValue(undefined),
}));

// Helper to apply all Hyro Forge migrations
function applyForgeHyroMigration(db: Database) {
  // Apply the base Forge RPG migration
  const migrationPath = join(process.cwd(), 'migrations', '012_hyro_forge_rpg.sql');
  if (existsSync(migrationPath)) {
    const sql = readFileSync(migrationPath, 'utf8');
    db.exec(sql);
  }
  // Apply phase 3 mastery migration (contains comprehension tables)
  const phase3Path = join(process.cwd(), 'migrations', '015_hyro_phase3_mastery.sql');
  if (existsSync(phase3Path)) {
    const sql = readFileSync(phase3Path, 'utf8');
    db.exec(sql);
  }
}

describe('Hyro Forge AI Evaluator', () => {
  const testDbPath = join(process.cwd(), '.data', 'forge-ai-eval-test.db');
  const testMigrationsPath = join(process.cwd(), 'migrations');

  beforeEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
    Database.resetInstance();

    // Reset mocks
    mockGetCoachingResponse.mockReset();
  });

  afterEach(() => {
    Database.resetInstance();
    if (existsSync(testDbPath)) rmSync(testDbPath);
    if (existsSync(testDbPath + '-wal')) rmSync(testDbPath + '-wal');
    if (existsSync(testDbPath + '-shm')) rmSync(testDbPath + '-shm');
  });

  describe('evaluateComprehensionResponse', () => {
    it('should be importable', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');
      expect(typeof evaluateComprehensionResponse).toBe('function');
    });

    it('should fall back to LLM when no rubric or history match', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Mock LLM response
      mockGetCoachingResponse.mockResolvedValue({
        content: JSON.stringify({
          score: 75,
          feedback: 'Good work!',
          strengths: ['Clear thinking'],
          growth_areas: ['Add more detail'],
          depth_rating: 'moderate',
          rubric_scores: {
            evidence_use: 18,
            reasoning: 19,
            analysis_depth: 18,
            connection: 20,
          },
        }),
      });

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      const prompt = {
        id: 'test-prompt-1',
        book_id: 'book-1',
        prompt_type: 'inference' as const,
        prompt_text: 'What do you think will happen next?',
        difficulty: 5,
        xp_value: 20,
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      const result = await evaluateComprehensionResponse(prompt, 'I think the character will discover the secret.');

      expect(result).toBeDefined();
      expect(result.source).toBe('llm');
      expect(result.score).toBe(75);
      expect(result.feedback).toBe('Good work!');
    });

    it('should use rubric match when clear pattern found', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      const prompt = {
        id: 'test-prompt-2',
        book_id: 'book-1',
        prompt_type: 'main_idea' as const,
        prompt_text: 'What is the main idea?',
        difficulty: 3,
        xp_value: 15,
        evaluation_rubric: JSON.stringify({
          required_keywords: 'friendship, adventure, courage',
        }),
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      const result = await evaluateComprehensionResponse(
        prompt,
        'The story is about friendship and adventure, showing courage in difficult times.'
      );

      expect(result).toBeDefined();
      expect(result.source).toBe('rubric');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Cascading Evaluation Strategy', () => {
    it('should prioritize rubric over history over LLM', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      // Create prompt with rubric
      const prompt = {
        id: 'cascade-test',
        book_id: 'book-1',
        prompt_type: 'vocabulary' as const,
        prompt_text: 'Define the word "ephemeral"',
        difficulty: 4,
        xp_value: 15,
        evaluation_rubric: JSON.stringify({
          required_keywords: 'temporary, short-lived, brief',
        }),
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      // Response with all keywords - should match rubric
      const result = await evaluateComprehensionResponse(
        prompt,
        'Ephemeral means something that is temporary and short-lived, lasting only a brief moment.'
      );

      expect(result.source).toBe('rubric');
      // LLM should not be called when rubric matches
      expect(mockGetCoachingResponse).not.toHaveBeenCalled();
    });
  });

  describe('Educational Prompts', () => {
    it('should import educational prompts module', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const {
        getEvaluationSystemPrompt,
        buildEducationalContext,
      } = await import('../../../lib/hyro/forge-educational-prompts');

      expect(typeof getEvaluationSystemPrompt).toBe('function');
      expect(typeof buildEducationalContext).toBe('function');
    });

    it('should generate age-appropriate system prompts', async () => {
      const { getEvaluationSystemPrompt } = await import('../../../lib/hyro/forge-educational-prompts');

      const prompt = getEvaluationSystemPrompt('inference');

      expect(prompt).toContain('10-year-old');
      expect(prompt.toLowerCase()).toContain('educational');
    });

    it('should build context with child name', async () => {
      const { buildEducationalContext } = await import('../../../lib/hyro/forge-educational-prompts');

      const context = buildEducationalContext({
        childName: 'Hyro',
        currentStats: { math: 65, reading: 72 },
      });

      expect(context).toContain('Hyro');
    });
  });

  describe('Score Distribution', () => {
    it('should distribute scores across rubric dimensions', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Mock LLM response with specific scores
      mockGetCoachingResponse.mockResolvedValue({
        content: JSON.stringify({
          score: 80,
          feedback: 'Great analysis!',
          strengths: ['Strong reasoning'],
          growth_areas: [],
          depth_rating: 'deep',
          rubric_scores: {
            evidence_use: 20,
            reasoning: 20,
            analysis_depth: 20,
            connection: 20,
          },
        }),
      });

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      const prompt = {
        id: 'score-dist-test',
        book_id: 'book-1',
        prompt_type: 'analysis' as const,
        prompt_text: 'Analyze the character development.',
        difficulty: 7,
        xp_value: 25,
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      const result = await evaluateComprehensionResponse(prompt, 'The character grows throughout the story.');

      expect(result.rubric_scores).toBeDefined();
      expect(result.rubric_scores.evidence_use).toBeGreaterThanOrEqual(0);
      expect(result.rubric_scores.reasoning).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when LLM fails and no fallback', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Mock LLM failure
      mockGetCoachingResponse.mockRejectedValue(new Error('LLM unavailable'));

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      const prompt = {
        id: 'error-test',
        book_id: 'book-1',
        prompt_type: 'prediction' as const,
        prompt_text: 'What do you predict?',
        difficulty: 3,
        xp_value: 10,
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      await expect(
        evaluateComprehensionResponse(prompt, 'My prediction is...')
      ).rejects.toThrow();
    });

    it('should handle malformed LLM response gracefully', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      // Mock malformed response
      mockGetCoachingResponse.mockResolvedValue({
        content: 'This is not valid JSON',
      });

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      const prompt = {
        id: 'malformed-test',
        book_id: 'book-1',
        prompt_type: 'summary' as const,
        prompt_text: 'Summarize the chapter.',
        difficulty: 4,
        xp_value: 15,
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      await expect(
        evaluateComprehensionResponse(prompt, 'The chapter was about...')
      ).rejects.toThrow();
    });
  });

  describe('Depth Rating', () => {
    it('should return appropriate depth rating based on score', async () => {
      const db = Database.getInstance(testDbPath, testMigrationsPath);
      applyForgeHyroMigration(db);

      const { evaluateComprehensionResponse } = await import('../../../lib/hyro/forge-ai-evaluator');

      // Test with rubric match for high score
      const prompt = {
        id: 'depth-test',
        book_id: 'book-1',
        prompt_type: 'theme' as const,
        prompt_text: 'What is the theme?',
        difficulty: 5,
        xp_value: 20,
        evaluation_rubric: JSON.stringify({
          required_keywords: 'perseverance, determination, success',
        }),
        exemplar_response: 'The theme is about perseverance and determination leading to success.',
        created_at: Math.floor(Date.now() / 1000),
        active: true,
      };

      const result = await evaluateComprehensionResponse(
        prompt,
        'The theme is about perseverance and determination leading to success through hard work.'
      );

      expect(['surface', 'moderate', 'deep']).toContain(result.depth_rating);
    });
  });
});
