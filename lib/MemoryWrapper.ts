/**
 * Wrath Shield v3 - Unified Memory Wrapper
 *
 * Memory system with multiple backend support:
 * 1. Zep Cloud (preferred) - Unified memory for all agents
 * 2. Grok-backed memory service (fallback)
 * 3. Qdrant vector store (fallback)
 * 4. SQLite in-memory store (final fallback)
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import { cfg } from './config';
// Support multiple mem0ai export shapes across versions
// NOTE: mem0ai import is done lazily inside initialize() to avoid build-time
// compatibility errors when the package shape changes. Do not import at top level.

// Prevent client-side imports
ensureServerOnly('lib/MemoryWrapper');

type VectorStoreType = 'zep' | 'qdrant' | 'in-memory' | 'grok';

interface MemoryConfig {
  vectorStore: VectorStoreType;
  qdrantUrl?: string;
  qdrantCollection?: string;
  embeddingsProvider: 'openai' | 'local';
  embeddingsApiKey?: string;
  zepApiKey?: string;
}

/**
 * Singleton Mem0 instance with automatic Qdrant/in-memory fallback
 */
type Mem0Ctor = new (...args: any[]) => any;

class MemoryWrapper {
  private memory: any | null = null;
  private config: MemoryConfig | null = null;

  /**
   * Initialize memory with preferred backend (Zep > Grok > Qdrant > SQLite)
   */
  async initialize(): Promise<void> {
    if (this.memory) {
      return; // Already initialized
    }

    const appConfig = cfg();
    const qdrantUrl = `http://${appConfig.qdrant.host}:${appConfig.qdrant.port}`;
    const hasMem0Key = !!process.env.MEM0_API_KEY && process.env.MEM0_API_KEY.length > 0;
    // Check for ZEP_API_KEY or ZEP_LEGAL_API_KEY (fallback)
    const zepApiKey = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;
    const hasZepKey = !!zepApiKey && zepApiKey.length > 0;
    const grokUrl = process.env.AGENTIC_GROK_URL || 'http://localhost:8001';
    console.log(`[MemoryWrapper] init: ZEP_API_KEY set=${hasZepKey}, MEM0_API_KEY set=${hasMem0Key}, Qdrant=${qdrantUrl}, Grok=${grokUrl}`);

    const inTest = process.env.NODE_ENV === 'test';

    // Try Zep first (preferred unified memory)
    if (hasZepKey && !inTest) {
      try {
        await this.tryZep();
        this.config = {
          vectorStore: 'zep',
          embeddingsProvider: 'openai', // Zep handles embeddings
          zepApiKey: zepApiKey,
        };
        console.log('[MemoryWrapper] Successfully connected to Zep Cloud');
        return;
      } catch (error) {
        console.warn('[MemoryWrapper] Zep unavailable, falling back to other options:', error);
      }
    }

    // Prefer Grok-backed memory if service is reachable (skip in test)
    const grokHealth = inTest ? null : await fetch(`${grokUrl}/api/agentic/health`).catch(() => null);
    if (grokHealth && grokHealth.ok) {
      this.memory = {
        add: async (text: string, opts: { user_id: string; metadata?: any }) => {
          const r = await fetch(`${grokUrl}/api/agentic/memory/add`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, user_id: opts.user_id, metadata: opts.metadata }),
          });
          if (!r.ok) throw new Error(`Grok memory add failed: ${await r.text()}`);
        },
        search: async (query: string, opts: { user_id: string; limit?: number }) => {
          const r = await fetch(`${grokUrl}/api/agentic/memory/search`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ query, user_id: opts.user_id, limit: opts.limit ?? 5 }),
          });
          if (!r.ok) throw new Error(`Grok memory search failed: ${await r.text()}`);
          const data = await r.json();
          return data.results || [];
        },
        getAll: async (opts: { user_id: string }) => {
          const r = await fetch(`${grokUrl}/api/agentic/memory/list?user_id=${encodeURIComponent(opts.user_id)}`);
          if (!r.ok) throw new Error(`Grok memory list failed: ${await r.text()}`);
          const data = await r.json();
          return data.results || [];
        },
        delete: async (id: string) => {
          // Not implemented on Grok side yet; noop
        },
      };
      this.config = {
        vectorStore: 'qdrant',
        qdrantUrl,
        qdrantCollection: 'wrath_shield_memories',
        embeddingsProvider: appConfig.openai.apiKey ? 'openai' : 'local',
        embeddingsApiKey: appConfig.openai.apiKey,
      };
      console.log('[MemoryWrapper] Using Grok-backed memory endpoints');
      return;
    }

    // Try Qdrant next
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
      // Fall back to local SQLite store
      console.warn('[MemoryWrapper] Qdrant unavailable, using local SQLite memory store');
      await this.useInMemory();
      this.config = {
        vectorStore: 'in-memory',
        embeddingsProvider: appConfig.openai.apiKey ? 'openai' : 'local',
        embeddingsApiKey: appConfig.openai.apiKey,
      };
    }
  }

  /**
   * Attempt to connect to Zep Cloud
   */
  private async tryZep(): Promise<void> {
    try {
      const {
        initializeZep,
        addZepMemory,
        searchZepMemory,
        getRecentZepMemories,
        deleteZepMemory,
        getZepContext,
      } = await import('./memory/zep');

      // Initialize Zep client
      await initializeZep();

      // Create adapter that matches the existing memory interface
      this.memory = {
        add: async (text: string, opts: { user_id: string; metadata?: any }) => {
          // Map user_id to agent format if needed
          const agentId = this.mapUserIdToAgent(opts.user_id);
          await addZepMemory(agentId, text, opts.metadata);
        },
        search: async (query: string, opts: { user_id: string; limit?: number }) => {
          const agentId = this.mapUserIdToAgent(opts.user_id);
          const results = await searchZepMemory(agentId, query, opts.limit ?? 5);
          return results.map(r => ({
            id: r.memory.id,
            text: r.memory.text,
            metadata: r.memory.metadata,
            score: r.score,
          }));
        },
        getAll: async (opts: { user_id: string }) => {
          const agentId = this.mapUserIdToAgent(opts.user_id);
          const memories = await getRecentZepMemories(agentId, 100);
          return memories.map(m => ({
            id: m.id,
            text: m.text,
            metadata: m.metadata,
          }));
        },
        delete: async (id: string) => {
          // For deletion, we need sessionId - this is a simplified version
          // In production, you'd track sessionId with the memory
          console.warn('[MemoryWrapper] Zep delete requires sessionId - operation skipped');
        },
        getContext: async (userId: string) => {
          const agentId = this.mapUserIdToAgent(userId);
          return await getZepContext(agentId);
        },
      };
    } catch (error) {
      console.error('[MemoryWrapper] Zep initialization failed:', error);
      throw error;
    }
  }

  /**
   * Map user_id to AgentId format
   * Converts formats like 'finance', 'legal', 'pm' to 'finance-agent', etc.
   */
  private mapUserIdToAgent(userId: string): any {
    // If already in agent format, return as-is
    if (userId.endsWith('-agent')) {
      return userId;
    }

    // Map common agent names
    const agentMap: Record<string, string> = {
      finance: 'finance-agent',
      legal: 'legal-agent',
      pm: 'pm-agent',
      ea: 'ea-agent',
      comms: 'comms-agent',
      hyro: 'hyro-agent',
      grok: 'hyro-agent',
      relationships: 'relationships-agent',
      eeg: 'eeg-agent',
    };

    return agentMap[userId.toLowerCase()] || `${userId}-agent`;
  }

  /**
   * Attempt to connect to Qdrant (HTTP health check)
   */
  private async tryQdrant(url: string): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      // Use the low-level Api class from qdrant-client package
      const { Api } = await import('qdrant-client');
      const client = new Api({ baseUrl: url });
      await client.collections.getCollections();
      // Minimal stub memory for test environment (behaves like Mem0 interface)
      const store: Record<string, any[]> = {};
      this.memory = {
        add: async (text: string, opts: { user_id: string; metadata?: any }) => {
          const uid = opts.user_id || 'default';
          (store[uid] ||= []).unshift({ id: crypto.randomUUID().replace(/-/g, ''), text, metadata: opts.metadata });
        },
        search: async (query: string, opts: { user_id: string; limit?: number }) => {
          const uid = opts.user_id || 'default';
          const q = (query || '').toLowerCase();
          return (store[uid] || []).filter((m) => (m.text || '').toLowerCase().includes(q)).slice(0, opts.limit ?? 5);
        },
        getAll: async (opts: { user_id: string }) => store[opts.user_id] || [],
        delete: async (id: string) => {
          for (const k of Object.keys(store)) store[k] = store[k].filter((m) => m.id !== id);
        },
      };
    } else {
      const healthUrl = `${url.replace(/\/$/, '')}/healthz`;
      const res = await fetch(healthUrl).catch(() => null);
      if (!res || !res.ok) {
        throw new Error(`Qdrant not reachable at ${healthUrl}`);
      }
    }

    // Initialize Mem0 with Qdrant configuration
    if (process.env.NODE_ENV !== 'test') {
      try {
        const mem0 = await import('mem0ai').catch(() => null);
        const MemoryClass: Mem0Ctor | null =
          mem0 && ((mem0 as any).Memory || (mem0 as any).MemoryClient || (mem0 as any).default);
        if (!MemoryClass) throw new Error('mem0ai not available');
        this.memory = new MemoryClass({
          api_key: process.env.MEM0_API_KEY || undefined,
          vector_store: {
            provider: 'qdrant',
            config: {
              url,
              collection_name: 'wrath_shield_memories',
            },
          },
          embedder: this.getEmbedderConfig(),
          version: 'v1.0',
        });
      } catch (e) {
        console.warn('[MemoryWrapper] mem0ai unavailable, falling back to in-memory store');
        await this.useInMemory();
      }
    }
  }

  /**
   * Use in-memory vector store
   */
  private async useInMemory(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      const mem0 = await import('mem0ai').catch(() => null);
      const MemoryClass: Mem0Ctor | null =
        mem0 && ((mem0 as any).Memory || (mem0 as any).MemoryClient || (mem0 as any).default);
      if (MemoryClass) {
        this.memory = new MemoryClass({});
      } else {
        this.memory = null;
      }
      return;
    }

    // Fallback: lightweight local SQLite-backed memory (no external deps) for dev/prod
    const { Database } = await import('./db/Database');
    const db = Database.getInstance(undefined, undefined).getRawDb();
    db.exec(`CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, created_at DESC);`);

    const randomId = () => crypto.randomUUID();

    this.memory = {
      add: async (text: string, opts: { user_id: string; metadata?: any }) => {
        const stmt = db.prepare('INSERT INTO memories (id, user_id, text, metadata) VALUES (?, ?, ?, ?)');
        stmt.run(randomId(), opts.user_id, text, opts.metadata ? JSON.stringify(opts.metadata) : null);
      },
      search: async (query: string, opts: { user_id: string; limit?: number }) => {
        const limit = opts.limit ?? 5;
        const stmt = db.prepare(
          `SELECT id, user_id, text, metadata, created_at FROM memories WHERE user_id = ? AND text LIKE ? ORDER BY created_at DESC LIMIT ?`
        );
        const rows = stmt.all(opts.user_id, `%${query}%`, limit) as any[];
        return rows.map(r => ({ id: r.id, text: r.text, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
      },
      getAll: async (opts: { user_id: string }) => {
        const stmt = db.prepare(`SELECT id, user_id, text, metadata, created_at FROM memories WHERE user_id = ? ORDER BY created_at DESC`);
        const rows = stmt.all(opts.user_id) as any[];
        return rows.map(r => ({ id: r.id, text: r.text, metadata: r.metadata ? JSON.parse(r.metadata) : undefined }));
      },
      delete: async (id: string) => {
        db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      },
    };
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
  async getInstance(): Promise<any> {
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
    // Support both Mem0 MemoryClient (cloud) and local fallback
    if (typeof mem.add === 'function' && mem.add.length >= 2) {
      await mem.add(text, { user_id: userId, metadata });
    } else if (typeof mem.add === 'function') {
      await mem.add(text, { user_id: userId, metadata });
    }
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
