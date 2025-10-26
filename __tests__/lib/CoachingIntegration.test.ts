/**
 * Wrath Shield v3 - Coaching Engine Integration Tests
 *
 * Tests for complete coaching pipeline integration:
 * Context Assembly → Prompt Construction → OpenRouter API → Caching
 *
 * This tests Task 14 (subtasks 14.1-14.4) working together end-to-end.
 */

import { assembleCoachingContext, buildDailyContext } from '@/lib/CoachingEngine';
import { constructCoachingPrompt } from '@/lib/PromptBuilder';
import { getOpenRouterClient } from '@/lib/OpenRouterClient';
import { getCoachingCache, getTimePeriod, hashContext } from '@/lib/CoachingCache';
import type { Recovery, Cycle, Sleep, Lifelog } from '@/lib/db/types';
import type { CoachingResponse } from '@/lib/OpenRouterClient';

// Mock all dependencies
jest.mock('@/lib/db/queries', () => ({
  getLatestRecovery: jest.fn(),
  getLatestCycle: jest.fn(),
  getLatestSleep: jest.fn(),
  getLifelogsForDate: jest.fn(),
}));

jest.mock('@/lib/MemoryWrapper', () => ({
  searchMemories: jest.fn(),
  getAnchors: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn(() => ({
    OPENROUTER_API_KEY: 'test-openrouter-key',
  })),
}));

// Mock global fetch
global.fetch = jest.fn();

// Import mocked modules
const { getLatestRecovery, getLatestCycle, getLatestSleep, getLifelogsForDate } =
  require('@/lib/db/queries');
const { searchMemories, getAnchors } = require('@/lib/MemoryWrapper');

describe('Coaching Engine Integration', () => {
  let cache: ReturnType<typeof getCoachingCache>;
  let openRouterClient: ReturnType<typeof getOpenRouterClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Explicitly reset fetch mock to clear any queued responses
    (global.fetch as jest.Mock).mockReset();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-31T10:00:00Z')); // 10 AM UTC
    cache = getCoachingCache();
    cache.clear();
    openRouterClient = getOpenRouterClient();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Test data fixtures
  const mockRecovery: Recovery = {
    id: 'rec_1',
    date: '2025-01-31',
    score: 78,
    hrv: 45,
    rhr: 58,
    spo2: 98,
    skin_temp: 98.2,
  };

  const mockCycle: Cycle = {
    id: 'cycle_1',
    date: '2025-01-31',
    strain: 12.4,
    kilojoules: 8500,
    avg_hr: 85,
    max_hr: 165,
  };

  const mockSleep: Sleep = {
    id: 'sleep_1',
    date: '2025-01-31',
    performance: 85,
    rem_min: 120,
    sws_min: 90,
    light_min: 180,
    respiration: 15,
    sleep_debt_min: 0,
  };

  const mockLifelogs: Lifelog[] = [
    {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Morning conversation',
      manipulation_count: 2,
      wrath_deployed: 1,
      raw_json: '{}',
    },
  ];

  const mockOpenRouterResponse = {
    id: 'chatcmpl-123',
    model: 'anthropic/claude-3.5-sonnet:beta',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant' as const,
          content:
            'Excellent recovery at 78% puts you in prime position for growth. Your moderate strain of 12.4 shows balanced effort. The 2 manipulations met with assertive boundaries demonstrate strong resolve. Keep leveraging this high recovery for continued boundary enforcement.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 250,
      completion_tokens: 60,
      total_tokens: 310,
    },
  };

  describe('Full Pipeline Integration', () => {
    it('should execute complete pipeline: context → prompt → API → cache', async () => {
      // Setup database mocks
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);

      // Setup memory mocks
      const mockMemories = [
        {
          id: 'mem_1',
          text: 'Previous high recovery day',
          metadata: { type: 'daily_summary', date: '2025-01-30' },
          score: 0.9,
        },
      ];
      const mockAnchors = [
        {
          id: 'anchor_1',
          text: 'Boundaries are non-negotiable',
          metadata: { type: 'anchor', category: 'boundaries', date: '2025-01-15' },
        },
      ];
      searchMemories.mockResolvedValue(mockMemories);
      getAnchors.mockResolvedValue(mockAnchors);

      // Setup OpenRouter API mock
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      // Step 1: Assemble context
      const context = await assembleCoachingContext('2025-01-31', 'test_user');

      // Verify context assembly
      expect(context.dailyContext.recovery).toEqual(mockRecovery);
      expect(context.dailyContext.cycle).toEqual(mockCycle);
      expect(context.dailyContext.sleep).toEqual(mockSleep);
      expect(context.dailyContext.totalManipulations).toBe(2);
      expect(context.dailyContext.wrathDeployed).toBe(true);
      expect(context.relevantMemories).toHaveLength(1);
      expect(context.anchors).toHaveLength(1);

      // Step 2: Construct prompt
      const prompt = constructCoachingPrompt(context);

      // Verify prompt structure
      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[1].role).toBe('user');
      expect(prompt.messages[1].content).toContain('2025-01-31');
      expect(prompt.messages[1].content).toContain('Recovery: 78%');
      expect(prompt.messages[1].content).toContain('Strain: 12.4');
      expect(prompt.temperature).toBe(0.7);
      expect(prompt.max_tokens).toBe(500);
      expect(prompt.metadata.has_whoop_data).toBe(true);
      expect(prompt.metadata.has_manipulations).toBe(true);
      expect(prompt.metadata.wrath_deployed).toBe(true);

      // Step 3: Get coaching response from OpenRouter
      const response = await openRouterClient.getCoachingResponse(prompt);

      // Verify response
      expect(response.content).toContain('recovery at 78%');
      expect(response.model).toBe('anthropic/claude-3.5-sonnet:beta');
      expect(response.finish_reason).toBe('stop');

      // Step 4: Cache the response
      const contextHash = hashContext(context);
      cache.set('2025-01-31', 'AM', contextHash, response);

      // Verify cache storage
      const cachedResponse = cache.get('2025-01-31', 'AM', contextHash);
      expect(cachedResponse).toEqual(response);
    });

    it('should use cached response when available', async () => {
      // Setup database mocks
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // First request - cache miss
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);
      const response1 = await openRouterClient.getCoachingResponse(prompt);

      // Cache the response
      cache.setForContext(context, response1);

      // Second request - cache hit (no API call)
      const cachedResponse = cache.getForContext(context);

      expect(cachedResponse).toEqual(response1);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only one API call
    });

    it('should make new API call when context changes', async () => {
      // First context with high recovery
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context1 = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt1 = constructCoachingPrompt(context1);
      const response1 = await openRouterClient.getCoachingResponse(prompt1);
      cache.setForContext(context1, response1);

      // Second context with low recovery (different hash)
      const lowRecovery: Recovery = { ...mockRecovery, score: 35 };
      getLatestRecovery.mockReturnValue(lowRecovery);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: 'Low recovery requires rest and boundary protection.',
              },
            },
          ],
        }),
      });

      const context2 = await assembleCoachingContext('2025-01-31', 'test_user');

      // Verify contexts have different hashes
      expect(hashContext(context1)).not.toBe(hashContext(context2));

      // Cache miss - different context
      const cachedResponse = cache.getForContext(context2);
      expect(cachedResponse).toBeNull();

      // New API call needed
      const prompt2 = constructCoachingPrompt(context2);
      const response2 = await openRouterClient.getCoachingResponse(prompt2);

      expect(response2.content).toContain('Low recovery');
      expect(global.fetch).toHaveBeenCalledTimes(2); // Two API calls
    });
  });

  describe('Cache Behavior Integration', () => {
    it('should use same cache for same context in AM period', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // 9 AM - mock getHours() for local time
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);
      const response1 = await openRouterClient.getCoachingResponse(prompt);
      cache.setForContext(context, response1);

      // 11 AM - still AM period
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(11);

      const cachedResponse = cache.getForContext(context);
      expect(cachedResponse).toEqual(response1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should create new cache entry when time period changes', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // 10 AM - mock getHours() for local time
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      expect(getTimePeriod()).toBe('AM');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);
      const response1 = await openRouterClient.getCoachingResponse(prompt);
      cache.setForContext(context, response1);

      // 2 PM - PM period
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      expect(getTimePeriod()).toBe('PM');

      // Cache miss due to different time period
      const cachedResponse = cache.getForContext(context);
      expect(cachedResponse).toBeNull();

      // New API call needed
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: 'PM coaching response',
              },
            },
          ],
        }),
      });

      const response2 = await openRouterClient.getCoachingResponse(prompt);
      expect(response2.content).toBe('PM coaching response');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle cache expiration after TTL', async () => {
      const shortTtlCache = getCoachingCache();
      shortTtlCache.clear();

      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);
      const response1 = await openRouterClient.getCoachingResponse(prompt);

      const contextHash = hashContext(context);
      shortTtlCache.set('2025-01-31', 'AM', contextHash, response1);

      // Verify cached
      let cachedResponse = shortTtlCache.get('2025-01-31', 'AM', contextHash);
      expect(cachedResponse).toEqual(response1);

      // Advance time by 25 hours (past 24h TTL)
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Cache expired
      cachedResponse = shortTtlCache.get('2025-01-31', 'AM', contextHash);
      expect(cachedResponse).toBeNull();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully', async () => {
      getLatestRecovery.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(assembleCoachingContext('2025-01-31', 'test_user')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle Mem0 errors gracefully', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(null);
      getLatestSleep.mockReturnValue(null);
      getLifelogsForDate.mockReturnValue([]);

      searchMemories.mockRejectedValue(new Error('Mem0 service unavailable'));
      getAnchors.mockResolvedValue([]);

      await expect(assembleCoachingContext('2025-01-31', 'test_user')).rejects.toThrow(
        'Mem0 service unavailable'
      );
    });

    it('should handle OpenRouter API errors with retries', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(null);
      getLatestSleep.mockReturnValue(null);
      getLifelogsForDate.mockReturnValue([]);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // Fail twice with 500, succeed on third attempt
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOpenRouterResponse,
        });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);

      // Start the request (don't await yet)
      const responsePromise = openRouterClient.getCoachingResponse(prompt);

      // Advance timers for retry delays (1s + 2s)
      await jest.advanceTimersByTimeAsync(1000); // First retry delay
      await jest.advanceTimersByTimeAsync(2000); // Second retry delay

      const response = await responsePromise;

      expect(response.content).toContain('recovery at 78%');
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should fail after max retries exhausted', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(null);
      getLatestSleep.mockReturnValue(null);
      getLifelogsForDate.mockReturnValue([]);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // All attempts fail
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);

      // Start the request (don't await yet)
      const responsePromise = openRouterClient.getCoachingResponse(prompt);

      // Attach rejection handler FIRST (before rejection occurs)
      const rejectionPromise = expect(responsePromise).rejects.toThrow(
        'OpenRouter API error (500): Server error'
      );

      // Run all pending timers (both retry delays) and allow promises to settle
      await jest.runAllTimersAsync();

      // Await the rejection handler
      await rejectionPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Data Variation Integration', () => {
    it('should handle minimal data (no WHOOP, no lifelogs)', async () => {
      getLatestRecovery.mockReturnValue(null);
      getLatestCycle.mockReturnValue(null);
      getLatestSleep.mockReturnValue(null);
      getLifelogsForDate.mockReturnValue([]);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content: 'No WHOOP data available. Focus on basic boundary maintenance.',
              },
            },
          ],
        }),
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);

      // Verify prompt includes default query
      expect(context.query).toBe('daily coaching');
      expect(prompt.metadata.has_whoop_data).toBe(false);
      expect(prompt.metadata.has_manipulations).toBe(false);

      const response = await openRouterClient.getCoachingResponse(prompt);
      expect(response.content).toContain('No WHOOP data');
    });

    it('should handle high manipulation count with no wrath', async () => {
      const highManipulationLogs: Lifelog[] = [
        {
          id: 'log_1',
          date: '2025-01-31',
          title: 'Manipulation 1',
          manipulation_count: 5,
          wrath_deployed: 0,
          raw_json: null,
        },
        {
          id: 'log_2',
          date: '2025-01-31',
          title: 'Manipulation 2',
          manipulation_count: 3,
          wrath_deployed: 0,
          raw_json: null,
        },
      ];

      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(null);
      getLifelogsForDate.mockReturnValue(highManipulationLogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content:
                  '8 manipulations detected with no assertive response. This is a red flag requiring immediate boundary enforcement.',
              },
            },
          ],
        }),
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');

      expect(context.dailyContext.totalManipulations).toBe(8);
      expect(context.dailyContext.wrathDeployed).toBe(false);
      expect(context.query).toContain('manipulation');

      const prompt = constructCoachingPrompt(context);
      expect(prompt.metadata.has_manipulations).toBe(true);
      expect(prompt.metadata.wrath_deployed).toBe(false);

      const response = await openRouterClient.getCoachingResponse(prompt);
      expect(response.content).toContain('red flag');
    });

    it('should handle low recovery + high strain combination', async () => {
      const lowRecovery: Recovery = { ...mockRecovery, score: 25 };
      const highStrain: Cycle = { ...mockCycle, strain: 18.5 };

      getLatestRecovery.mockReturnValue(lowRecovery);
      getLatestCycle.mockReturnValue(highStrain);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue([]);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockOpenRouterResponse,
          choices: [
            {
              ...mockOpenRouterResponse.choices[0],
              message: {
                role: 'assistant' as const,
                content:
                  'Low recovery (25%) paired with high strain (18.5) is unsustainable. Prioritize rest and strict boundary protection.',
              },
            },
          ],
        }),
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');

      // Verify query construction includes both concerns
      expect(context.query).toContain('low recovery');
      expect(context.query).toContain('high strain');

      const prompt = constructCoachingPrompt(context);
      const response = await openRouterClient.getCoachingResponse(prompt);
      expect(response.content).toContain('unsustainable');
    });
  });

  describe('Cache Statistics Integration', () => {
    it('should track cache statistics across pipeline usage', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      // Empty cache
      let stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.oldestEntryAge).toBeNull();
      expect(stats.newestEntryAge).toBeNull();

      // Add first response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context1 = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt1 = constructCoachingPrompt(context1);
      const response1 = await openRouterClient.getCoachingResponse(prompt1);
      cache.setForContext(context1, response1);

      stats = cache.getStats();
      expect(stats.size).toBe(1);
      expect(stats.oldestEntryAge).toBe(0); // Just added
      expect(stats.newestEntryAge).toBe(0);

      // Add second response (different date)
      jest.advanceTimersByTime(60 * 1000); // 1 minute

      const lowRecovery: Recovery = { ...mockRecovery, score: 35 };
      getLatestRecovery.mockReturnValue(lowRecovery);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context2 = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt2 = constructCoachingPrompt(context2);
      const response2 = await openRouterClient.getCoachingResponse(prompt2);
      cache.setForContext(context2, response2);

      stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.oldestEntryAge).toBe(60000); // 1 minute
      expect(stats.newestEntryAge).toBe(0); // Just added
    });

    it('should prune expired entries', async () => {
      getLatestRecovery.mockReturnValue(mockRecovery);
      getLatestCycle.mockReturnValue(mockCycle);
      getLatestSleep.mockReturnValue(mockSleep);
      getLifelogsForDate.mockReturnValue(mockLifelogs);
      searchMemories.mockResolvedValue([]);
      getAnchors.mockResolvedValue([]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOpenRouterResponse,
      });

      const context = await assembleCoachingContext('2025-01-31', 'test_user');
      const prompt = constructCoachingPrompt(context);
      const response = await openRouterClient.getCoachingResponse(prompt);
      cache.setForContext(context, response);

      expect(cache.getStats().size).toBe(1);

      // Advance time past TTL
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      // Prune expired entries
      const removed = cache.prune();
      expect(removed).toBe(1);
      expect(cache.getStats().size).toBe(0);
    });
  });
});
