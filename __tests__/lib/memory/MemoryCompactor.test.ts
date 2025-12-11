// @ts-nocheck
/**
 * Wrath Shield v3 - Memory Compactor Tests
 *
 * Tests for the memory compaction/summarization system:
 * - compactMemories function
 * - Chunking logic
 * - LLM summarization with fallback
 * - Memory deletion after compaction
 */

// Mock MemoryWrapper
const mockGetAllMemories = jest.fn();
const mockAddMemory = jest.fn();
const mockDeleteMemory = jest.fn();

jest.mock('@/lib/MemoryWrapper', () => ({
  getAllMemories: mockGetAllMemories,
  addMemory: mockAddMemory,
  deleteMemory: mockDeleteMemory,
}));

// Mock DirectLLMClients
const mockOpenaiChat = jest.fn();
const mockXaiChat = jest.fn();

jest.mock('@/lib/DirectLLMClients', () => ({
  DirectLLMClients: {
    openaiChat: mockOpenaiChat,
    xaiChat: mockXaiChat,
  },
}));

import { compactMemories } from '@/lib/memory/MemoryCompactor';

describe('Memory Compactor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddMemory.mockResolvedValue(undefined);
    mockDeleteMemory.mockResolvedValue(undefined);
  });

  describe('compactMemories', () => {
    it('should return early if memories are within keep limit', async () => {
      mockGetAllMemories.mockResolvedValueOnce(
        Array.from({ length: 30 }, (_, i) => ({
          id: `mem-${i}`,
          text: `Memory ${i}`,
        }))
      );

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(0);
      expect(result.deleted).toBe(0);
      expect(mockOpenaiChat).not.toHaveBeenCalled();
    });

    it('should compact memories when over limit', async () => {
      const memories = Array.from({ length: 70 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
        metadata: { type: 'general' },
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: '- Summary bullet 1\n- Summary bullet 2' });

      const result = await compactMemories('user-123', 50);

      // Should have compacted the 20 oldest memories (70 - 50 = 20)
      expect(result.summarized).toBe(20);
      expect(mockAddMemory).toHaveBeenCalled();
    });

    it('should use default keepRecent value of 50', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123');

      // Should compact 10 memories (60 - 50 default)
      expect(result.summarized).toBe(10);
    });

    it('should chunk old memories in groups of 20', async () => {
      const memories = Array.from({ length: 100 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      await compactMemories('user-123', 50);

      // 50 old memories, chunked into 3 groups (20, 20, 10)
      expect(mockOpenaiChat).toHaveBeenCalledTimes(3);
    });

    it('should delete memories after successful summarization', async () => {
      const memories = Array.from({ length: 70 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123', 50);

      expect(result.deleted).toBe(20);
      expect(mockDeleteMemory).toHaveBeenCalledTimes(20);
    });

    it('should include metadata in summarization prompt', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
        metadata: { type: 'task', date: '2025-01-15' },
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      await compactMemories('user-123', 50);

      const callArgs = mockOpenaiChat.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('[task]');
      expect(callArgs.messages[1].content).toContain('(2025-01-15)');
    });

    it('should add summarized memory with compaction metadata', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary of 10 memories' });

      await compactMemories('user-123', 50);

      expect(mockAddMemory).toHaveBeenCalledWith(
        'Summary of 10 memories',
        'user-123',
        expect.objectContaining({
          type: 'memory_compaction',
          count: 10,
        })
      );
    });

    it('should use fallback model when primary fails', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockRejectedValueOnce(new Error('OpenAI error'));
      mockXaiChat.mockResolvedValueOnce({ content: 'Fallback summary' });

      const result = await compactMemories('user-123', 50);

      expect(mockXaiChat).toHaveBeenCalled();
      expect(result.summarized).toBe(10);
    });

    it('should not delete memories when both models fail', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockRejectedValueOnce(new Error('Primary error'));
      mockXaiChat.mockRejectedValueOnce(new Error('Fallback error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(0);
      expect(result.deleted).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[memory] compaction models failed'),
        expect.any(Error),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle memories without IDs gracefully', async () => {
      const memories = [
        ...Array.from({ length: 50 }, (_, i) => ({
          id: `mem-${i}`,
          text: `Memory ${i}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          // No ID
          text: `Memory without ID ${i}`,
        })),
      ];
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123', 50);

      // Should still summarize but deleted count may be lower
      expect(result.summarized).toBe(10);
    });

    it('should handle deleteMemory errors gracefully', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });
      mockDeleteMemory.mockRejectedValue(new Error('Delete error'));

      // Should not throw
      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(10);
      // deleted count will be 0 because all deletes failed
      expect(result.deleted).toBe(0);
    });

    it('should process multiple chunks independently', async () => {
      const memories = Array.from({ length: 110 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);

      // First chunk succeeds, second fails, third succeeds
      mockOpenaiChat
        .mockResolvedValueOnce({ content: 'Summary 1' })
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ content: 'Summary 3' });
      mockXaiChat.mockRejectedValueOnce(new Error('Fallback error'));

      const result = await compactMemories('user-123', 50);

      // 60 old memories: 20 + 20 + 20
      // First chunk (20) and third chunk (20) succeed
      // Second chunk fails so 0
      expect(result.summarized).toBe(40);
    });

    it('should use correct temperature and max_tokens', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      await compactMemories('user-123', 50);

      expect(mockOpenaiChat).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          max_tokens: 400,
        }),
        expect.any(String)
      );
    });

    it('should include system prompt for summarization', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      await compactMemories('user-123', 50);

      const callArgs = mockOpenaiChat.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toContain('Summarize');
      expect(callArgs.messages[0].content).toContain('3-5 bullets');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty memories array', async () => {
      mockGetAllMemories.mockResolvedValueOnce([]);

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should handle exactly keepRecent memories', async () => {
      const memories = Array.from({ length: 50 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should handle keepRecent of 0', async () => {
      const memories = Array.from({ length: 30 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123', 0);

      // All 30 memories should be compacted
      expect(result.summarized).toBe(30);
    });

    it('should handle special characters in memory text', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory with "quotes", <tags>, & special chars: €£¥ ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(10);
    });

    it('should handle very long memory text', async () => {
      const longText = 'A'.repeat(10000);
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: i < 10 ? longText : `Short ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      const result = await compactMemories('user-123', 50);

      expect(result.summarized).toBe(10);
    });
  });

  describe('Model Configuration', () => {
    it('should use environment variables for model names', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockResolvedValue({ content: 'Summary' });

      await compactMemories('user-123', 50);

      // Should use primary model (default or from env)
      expect(mockOpenaiChat).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringMatching(/gpt-5\.1|PRIMARY_MODEL/)
      );
    });

    it('should use fallback model on primary failure', async () => {
      const memories = Array.from({ length: 60 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
      }));
      mockGetAllMemories.mockResolvedValueOnce(memories);
      mockOpenaiChat.mockRejectedValue(new Error('Primary failed'));
      mockXaiChat.mockResolvedValue({ content: 'Fallback summary' });

      await compactMemories('user-123', 50);

      expect(mockXaiChat).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringMatching(/grok-4-1-fast|FALLBACK_MODEL/)
      );
    });
  });
});
