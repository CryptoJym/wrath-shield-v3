/**
 * HYRO FORGE: Multi-Mode Redis Client
 * Supports Upstash (production) and Mock (development) modes
 */

import { ensureServerOnly } from './server-only-guard';
ensureServerOnly('lib/redis');

// ============================================================================
// Types
// ============================================================================

type RedisMode = 'upstash' | 'mock';
type SubscriptionCallback = (data: unknown, channel: string) => void;

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expirySeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: SubscriptionCallback): () => void;
  ping(): Promise<boolean>;
}

// ============================================================================
// Mock Redis Client (Development)
// ============================================================================

class MockRedisClient implements RedisClient {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();
  private subscriptions: Map<string, Set<SubscriptionCallback>> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    const expiresAt = expirySeconds
      ? Date.now() + expirySeconds * 1000
      : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async publish(channel: string, message: string): Promise<void> {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      const data = JSON.parse(message);
      callbacks.forEach((cb) => {
        try {
          cb(data, channel);
        } catch (err) {
          console.error(`[MockRedis] Subscription callback error:`, err);
        }
      });
    }
  }

  subscribe(channel: string, callback: SubscriptionCallback): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  // Debug helper
  getStats(): { keys: number; channels: number } {
    return {
      keys: this.store.size,
      channels: this.subscriptions.size,
    };
  }
}

// ============================================================================
// Upstash Redis Client (Production)
// ============================================================================

class UpstashRedisClient implements RedisClient {
  private baseUrl: string;
  private token: string;
  private subscriptions: Map<string, Set<SubscriptionCallback>> = new Map();

  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL || '';
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

    if (!this.baseUrl || !this.token) {
      throw new Error('[UpstashRedis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    }
  }

  private async command(cmd: string[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cmd),
    });

    if (!response.ok) {
      throw new Error(`[UpstashRedis] Command failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  async get(key: string): Promise<string | null> {
    return await this.command(['GET', key]);
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (expirySeconds) {
      await this.command(['SET', key, value, 'EX', expirySeconds.toString()]);
    } else {
      await this.command(['SET', key, value]);
    }
  }

  async del(key: string): Promise<void> {
    await this.command(['DEL', key]);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.command(['EXISTS', key]);
    return result === 1;
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.command(['PUBLISH', channel, message]);

    // Also notify local subscriptions (for same-process listeners)
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      const data = JSON.parse(message);
      callbacks.forEach((cb) => {
        try {
          cb(data, channel);
        } catch (err) {
          console.error(`[UpstashRedis] Subscription callback error:`, err);
        }
      });
    }
  }

  subscribe(channel: string, callback: SubscriptionCallback): () => void {
    // Note: Upstash REST API doesn't support true pub/sub subscriptions
    // This is a local-only subscription for same-process notifications
    // For cross-process pub/sub, use SSE or polling
    console.warn(
      `[UpstashRedis] Local subscription only. For cross-instance pub/sub, use SSE.`
    );

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.command(['PING']);
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let redisClient: RedisClient | null = null;
let currentMode: RedisMode = 'mock';

function detectMode(): RedisMode {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return 'upstash';
  }
  return 'mock';
}

export function getRedisClient(): RedisClient {
  if (!redisClient) {
    currentMode = detectMode();
    console.log(`[Redis] Initializing in ${currentMode.toUpperCase()} mode`);

    if (currentMode === 'upstash') {
      redisClient = new UpstashRedisClient();
    } else {
      redisClient = new MockRedisClient();
    }
  }
  return redisClient;
}

export async function publishEvent<T>(channel: string, data: T): Promise<void> {
  const client = getRedisClient();
  await client.publish(channel, JSON.stringify(data));
}

export function subscribeToChannel(
  channel: string,
  callback: SubscriptionCallback
): () => void {
  const client = getRedisClient();
  return client.subscribe(channel, callback);
}

export function isRedisMode(): RedisMode {
  if (!redisClient) {
    getRedisClient(); // Initialize to detect mode
  }
  return currentMode;
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    return await client.ping();
  } catch {
    return false;
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(
  key: string,
  value: T,
  expirySeconds?: number
): Promise<void> {
  const client = getRedisClient();
  await client.set(key, JSON.stringify(value), expirySeconds);
}

export { MockRedisClient, UpstashRedisClient };
