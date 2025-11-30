/**
 * Wrath Shield v3 - Unified Memory Wrapper
 *
 * Memory system backends:
 * 1. Zep Cloud (primary) - Unified memory for all agents
 * 2. SQLite (fallback) - Local storage when Zep unavailable
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';

// Prevent client-side imports
ensureServerOnly('lib/MemoryWrapper');

type VectorStoreType = 'zep' | 'sqlite';

interface MemoryConfig {
  vectorStore: VectorStoreType;
  zepApiKey?: string;
}

class MemoryWrapper {
  private memory: any | null = null;
  private config: MemoryConfig | null = null;

  /**
   * Initialize memory with preferred backend (Zep > SQLite)
   */
  async initialize(): Promise<void> {
    if (this.memory) {
      return; // Already initialized
    }

    const zepApiKey = process.env.ZEP_API_KEY || process.env.ZEP_LEGAL_API_KEY;
    const hasZepKey = !!zepApiKey && zepApiKey.length > 0;
    const inTest = process.env.NODE_ENV === 'test';

    console.log(`[MemoryWrapper] init: ZEP_API_KEY set=${hasZepKey}`);

    // Try Zep first (preferred unified memory)
    if (hasZepKey && !inTest) {
      try {
        await this.tryZep();
        this.config = {
          vectorStore: 'zep',
          zepApiKey: zepApiKey,
        };
        console.log('[MemoryWrapper] Successfully connected to Zep Cloud');
        return;
      } catch (error) {
        console.warn('[MemoryWrapper] Zep unavailable, falling back to SQLite:', error);
      }
    }

    // Fallback to SQLite
    await this.useSqlite();
    this.config = {
      vectorStore: 'sqlite',
    };
    console.log('[MemoryWrapper] Using SQLite memory store');
  }

  /**
   * Attempt to connect to Zep Cloud
   */
  private async tryZep(): Promise<void> {
    const {
      initializeZep,
      addZepMemory,
      searchZepMemory,
      getRecentZepMemories,
      getZepContext,
    } = await import('./memory/zep');

    // Initialize Zep client
    await initializeZep();

    // Create adapter that matches the existing memory interface
    this.memory = {
      add: async (text: string, opts: { user_id: string; metadata?: any }) => {
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
        console.warn('[MemoryWrapper] Zep delete requires sessionId - operation skipped');
      },
      getContext: async (userId: string) => {
        const agentId = this.mapUserIdToAgent(userId);
        return await getZepContext(agentId);
      },
    };
  }

  /**
   * Map user_id to AgentId format
   * Converts formats like 'finance', 'legal', 'pm' to 'finance-agent', etc.
   */
  private mapUserIdToAgent(userId: string): any {
    if (userId.endsWith('-agent')) {
      return userId;
    }

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
   * Use SQLite-backed memory store
   */
  private async useSqlite(): Promise<void> {
    // In test mode, use a simple in-memory store
    if (process.env.NODE_ENV === 'test') {
      const store: Record<string, any[]> = {};
      this.memory = {
        add: async (text: string, opts: { user_id: string; metadata?: any }) => {
          const uid = opts.user_id || 'default';
          (store[uid] ||= []).unshift({
            id: crypto.randomUUID(),
            text,
            metadata: opts.metadata,
          });
        },
        search: async (query: string, opts: { user_id: string; limit?: number }) => {
          const uid = opts.user_id || 'default';
          const q = (query || '').toLowerCase();
          return (store[uid] || [])
            .filter((m) => (m.text || '').toLowerCase().includes(q))
            .slice(0, opts.limit ?? 5);
        },
        getAll: async (opts: { user_id: string }) => store[opts.user_id] || [],
        delete: async (id: string) => {
          for (const k of Object.keys(store)) {
            store[k] = store[k].filter((m) => m.id !== id);
          }
        },
      };
      return;
    }

    // Production: SQLite-backed memory
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

    this.memory = {
      add: async (text: string, opts: { user_id: string; metadata?: any }) => {
        const stmt = db.prepare('INSERT INTO memories (id, user_id, text, metadata) VALUES (?, ?, ?, ?)');
        stmt.run(crypto.randomUUID(), opts.user_id, text, opts.metadata ? JSON.stringify(opts.metadata) : null);
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
   */
  async add(text: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    const mem = await this.getInstance();
    await mem.add(text, { user_id: userId, metadata });
  }

  /**
   * Search memories by query
   */
  async search(query: string, userId: string, limit: number = 5): Promise<any[]> {
    const mem = await this.getInstance();
    return await mem.search(query, { user_id: userId, limit });
  }

  /**
   * Get all memories for a user
   */
  async getAll(userId: string): Promise<any[]> {
    const mem = await this.getInstance();
    return await mem.getAll({ user_id: userId });
  }

  /**
   * Delete a specific memory
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
    .sort((a, b) => (b?.metadata?.date ?? '').localeCompare(a?.metadata?.date ?? ''));
};

/**
 * Export type for external use
 */
export type { MemoryConfig, VectorStoreType };
