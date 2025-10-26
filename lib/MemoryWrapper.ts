/**
 * Wrath Shield v3 - Mem0 Memory Wrapper
 *
 * Local-only memory system using Qdrant vector store with in-memory fallback.
 * No data is sent to Mem0 cloud. Embeddings are generated locally.
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import { cfg } from './config';
import { Memory } from 'mem0ai';

// Prevent client-side imports
ensureServerOnly('lib/MemoryWrapper');

type VectorStoreType = 'qdrant' | 'in-memory';

interface MemoryConfig {
  vectorStore: VectorStoreType;
  qdrantUrl?: string;
  qdrantCollection?: string;
  embeddingsProvider: 'openai' | 'local';
  embeddingsApiKey?: string;
}

/**
 * Singleton Mem0 instance with automatic Qdrant/in-memory fallback
 */
class MemoryWrapper {
  private memory: Memory | null = null;
  private config: MemoryConfig | null = null;

  /**
   * Initialize Mem0 with Qdrant as primary, in-memory as fallback
   */
  async initialize(): Promise<void> {
    if (this.memory) {
      return; // Already initialized
    }

    const appConfig = cfg();
    const qdrantUrl = `http://${appConfig.qdrant.host}:${appConfig.qdrant.port}`;

    // Try Qdrant first
    try {
      await this.tryQdrant(qdrantUrl);
      this.config = {
        vectorStore: 'qdrant',
        qdrantUrl,
        qdrantCollection: 'wrath_shield_memories',
        embeddingsProvider: appConfig.openai.apiKey ? 'openai' : 'local',
        embeddingsApiKey: appConfig.openai.apiKey,
      };
      console.log('[MemoryWrapper] Successfully connected to Qdrant vector store');
    } catch (error) {
      // Fall back to in-memory
      console.warn('[MemoryWrapper] Qdrant unavailable, falling back to in-memory vector store');
      await this.useInMemory();
      this.config = {
        vectorStore: 'in-memory',
        embeddingsProvider: appConfig.openai.apiKey ? 'openai' : 'local',
        embeddingsApiKey: appConfig.openai.apiKey,
      };
    }
  }

  /**
   * Attempt to connect to Qdrant
   */
  private async tryQdrant(url: string): Promise<void> {
    const { QdrantClient } = await import('qdrant-client');
    const client = new QdrantClient({ url });

    // Test connection by getting collections (will throw if unreachable)
    await client.getCollections();

    // Initialize Mem0 with Qdrant configuration
    this.memory = new Memory({
      vector_store: {
        provider: 'qdrant',
        config: {
          url,
          collection_name: 'wrath_shield_memories',
        },
      },
      embedder: this.getEmbedderConfig(),
      version: 'v1.0', // Ensures no cloud sync
    });
  }

  /**
   * Use in-memory vector store
   */
  private async useInMemory(): Promise<void> {
    this.memory = new Memory({
      vector_store: {
        provider: 'chroma',
        config: {
          path: ':memory:', // In-memory mode
        },
      },
      embedder: this.getEmbedderConfig(),
      version: 'v1.0', // Ensures no cloud sync
    });
  }

  /**
   * Get embedder configuration based on available API keys
   */
  private getEmbedderConfig() {
    const appConfig = cfg();

    if (appConfig.openai.apiKey) {
      return {
        provider: 'openai',
        config: {
          api_key: appConfig.openai.apiKey,
          model: 'text-embedding-3-small',
        },
      };
    }

    // Default to local embeddings (requires local model setup)
    return {
      provider: 'ollama',
      config: {
        model: 'nomic-embed-text',
      },
    };
  }

  /**
   * Get current memory instance (initializes if needed)
   */
  async getInstance(): Promise<Memory> {
    if (!this.memory) {
      await this.initialize();
    }
    return this.memory!;
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryConfig | null {
    return this.config;
  }

  /**
   * Add a memory to the system
   *
   * @param text - The text content to remember
   * @param userId - User or session identifier
   * @param metadata - Optional metadata to attach
   */
  async add(text: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    const mem = await this.getInstance();
    await mem.add(text, { user_id: userId, metadata });
  }

  /**
   * Search memories by query
   *
   * @param query - Search query text
   * @param userId - User or session identifier
   * @param limit - Maximum number of results (default: 5)
   */
  async search(query: string, userId: string, limit: number = 5): Promise<any[]> {
    const mem = await this.getInstance();
    const results = await mem.search(query, { user_id: userId, limit });
    return results;
  }

  /**
   * Get all memories for a user
   *
   * @param userId - User or session identifier
   */
  async getAll(userId: string): Promise<any[]> {
    const mem = await this.getInstance();
    const memories = await mem.getAll({ user_id: userId });
    return memories;
  }

  /**
   * Delete a specific memory
   *
   * @param memoryId - Memory identifier
   */
  async delete(memoryId: string): Promise<void> {
    const mem = await this.getInstance();
    await mem.delete(memoryId);
  }

  /**
   * Reset the wrapper (primarily for testing)
   */
  reset(): void {
    this.memory = null;
    this.config = null;
  }
}

/**
 * Singleton instance
 */
const memoryWrapper = new MemoryWrapper();

/**
 * Export singleton instance methods
 */
export const initializeMemory = () => memoryWrapper.initialize();
export const getMemory = () => memoryWrapper.getInstance();
export const getMemoryConfig = () => memoryWrapper.getConfig();
export const addMemory = (text: string, userId: string, metadata?: Record<string, any>) =>
  memoryWrapper.add(text, userId, metadata);
export const searchMemories = (query: string, userId: string, limit?: number) =>
  memoryWrapper.search(query, userId, limit);
export const getAllMemories = (userId: string) => memoryWrapper.getAll(userId);
export const deleteMemory = (memoryId: string) => memoryWrapper.delete(memoryId);
export const resetMemory = () => memoryWrapper.reset();

/**
 * App-specific helper: Add daily summary memory
 *
 * @param text - Summary text
 * @param userId - User or session identifier
 * @param metadata - Optional metadata (date defaults to today in YYYY-MM-DD format)
 */
export const addDailySummary = (
  text: string,
  userId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  const date = metadata.date ?? new Date().toISOString().slice(0, 10);
  return addMemory(text, userId, {
    ...metadata,
    type: 'daily_summary',
    date,
  });
};

/**
 * App-specific helper: Add anchor memory
 *
 * @param desc - Anchor description
 * @param category - Anchor category
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User or session identifier
 */
export const addAnchor = (
  desc: string,
  category: string,
  date: string,
  userId: string
): Promise<void> => {
  return addMemory(desc, userId, {
    type: 'anchor',
    category,
    date,
  });
};

/**
 * App-specific helper: Get filtered anchors
 *
 * @param userId - User or session identifier
 * @param opts - Optional filters (since date, category)
 * @returns Sorted array of anchor memories (newest first)
 */
export const getAnchors = async (
  userId: string,
  opts?: { since?: string; category?: string }
): Promise<any[]> => {
  const all = await getAllMemories(userId);

  return all
    .filter((m) => m?.metadata?.type === 'anchor')
    .filter((m) => !opts?.since || (m?.metadata?.date && m.metadata.date >= opts.since))
    .filter((m) => !opts?.category || m?.metadata?.category === opts.category)
    .sort((a, b) => (b?.metadata?.date ?? '').localeCompare(a?.metadata?.date ?? '')); // newest first
};

/**
 * Export type for external use
 */
export type { MemoryConfig, VectorStoreType };
