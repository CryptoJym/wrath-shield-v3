/**
 * Wrath Shield v3 - Limitless API Client
 *
 * Features:
 * - Automatic rate limiting (180 requests/minute)
 * - Cursor-based pagination for lifelog fetching
 * - Server-only enforcement
 * - Encrypted API key retrieval
 *
 * SECURITY: This module must ONLY be imported in server-side code.
 */

import { ensureServerOnly } from './server-only-guard';
import { decryptData } from './crypto';
import { getSetting } from './db/queries';
import type { LifelogInput } from './db/types';
import { httpsRequest } from './https-proxy-request';

// Prevent client-side imports
ensureServerOnly('lib/LimitlessClient');

const LIMITLESS_API_BASE = 'https://api.limitless.ai';

/**
 * Rate limiter for Limitless API (180 requests/minute)
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond
  private lastRefill: number;

  constructor(requestsPerMinute: number = 180) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Wait until a token is available, then consume it
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      const tryAcquire = () => {
        this.refill();

        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          // Calculate wait time until next token
          const waitMs = Math.ceil(1 / this.refillRate);
          setTimeout(tryAcquire, waitMs);
        }
      };

      tryAcquire();
    });
  }
}

/**
 * Limitless Lifelog Response
 */
interface LifelogResponse {
  lifelogs: Array<{
    id: string;
    start_time: string; // ISO 8601
    end_time: string; // ISO 8601
    transcript: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }>;
  cursor?: string | null;
}

/**
 * Parsed Lifelog
 */
export interface ParsedLifelog {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  transcript: string;
  summary: string | null;
  raw_json: string; // Serialized full response
}

/**
 * Limitless API Client with rate limiting and pagination
 */
class LimitlessClient {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter(180); // 180 requests/minute
  }

  /**
   * Get decrypted Limitless API key from settings
   */
  private getApiKey(): string {
    const setting = getSetting('limitless_api_key');

    if (!setting) {
      throw new Error('No Limitless API key found. Configure via POST /api/settings first.');
    }

    return decryptData(setting.value_enc);
  }

  /**
   * Make rate-limited request to Limitless API
   */
  private async request(endpoint: string, params?: Record<string, string>): Promise<any> {
    // Wait for rate limit token
    await this.rateLimiter.acquire();

    const apiKey = this.getApiKey();
    const url = new URL(`${LIMITLESS_API_BASE}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    console.log('[LimitlessClient] Requesting:', url.toString());

    let response;
    try {
      response = await httpsRequest(url.toString(), {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey, // Limitless uses X-API-Key, NOT Authorization Bearer!
        },
      });
    } catch (error) {
      console.error('[LimitlessClient] Request error:', error);
      throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (response.status !== 200 && response.status !== 204) {
      console.error('[LimitlessClient] Error response:', response.data);
      throw new Error(`Limitless API error: ${response.status} ${response.data}`);
    }

    return JSON.parse(response.data);
  }

  /**
   * Fetch all lifelogs with cursor-based pagination
   *
   * @param opts - Optional filters: start_date, end_date
   * @returns Array of all lifelogs
   */
  async fetchLifelogs(opts?: {
    start_date?: string; // YYYY-MM-DD
    end_date?: string; // YYYY-MM-DD
  }): Promise<LifelogResponse['lifelogs']> {
    const allLifelogs: LifelogResponse['lifelogs'] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const params: Record<string, string> = {
        limit: '100', // Max items per page
      };

      if (opts?.start_date) {
        params.start_date = opts.start_date;
      }

      if (opts?.end_date) {
        params.end_date = opts.end_date;
      }

      if (cursor) {
        params.cursor = cursor;
      }

      const response: LifelogResponse = await this.request('/v1/lifelogs', params);

      allLifelogs.push(...response.lifelogs);
      cursor = response.cursor;
    } while (cursor);

    return allLifelogs;
  }

  /**
   * Parse raw lifelog into database-ready format
   */
  parseLifelog(raw: LifelogResponse['lifelogs'][0]): ParsedLifelog {
    return {
      id: raw.id,
      date: raw.start_time.split('T')[0], // Extract YYYY-MM-DD from ISO timestamp
      start_time: raw.start_time,
      end_time: raw.end_time,
      transcript: raw.transcript,
      summary: raw.summary ?? null,
      raw_json: JSON.stringify(raw),
    };
  }

  /**
   * Fetch and parse lifelogs in one call
   */
  async fetchAndParseLifelogs(opts?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ParsedLifelog[]> {
    const raw = await this.fetchLifelogs(opts);
    return raw.map((lifelog) => this.parseLifelog(lifelog));
  }

  /**
   * Normalize parsed lifelog into database-ready format
   *
   * Note: manipulation_count and wrath_deployed are initialized to 0
   * They will be updated by the manipulation detection pipeline (Task #11)
   */
  normalizeLifelogForDb(parsed: ParsedLifelog): LifelogInput {
    return {
      id: parsed.id,
      date: parsed.date,
      title: parsed.summary, // Map summary -> title
      manipulation_count: 0, // Will be populated by Task #11 detection pipeline
      wrath_deployed: 0, // Will be set to 1 if wrath was used
      raw_json: parsed.raw_json,
    };
  }

  /**
   * Fetch, parse, and normalize lifelogs for database insertion
   *
   * @returns Database-ready lifelog records for use with insertLifelogs()
   */
  async fetchLifelogsForDb(opts?: {
    start_date?: string;
    end_date?: string;
  }): Promise<LifelogInput[]> {
    const parsed = await this.fetchAndParseLifelogs(opts);
    return parsed.map((lifelog) => this.normalizeLifelogForDb(lifelog));
  }

  /**
   * Fetch new lifelogs since last successful pull
   *
   * Implements incremental sync by:
   * 1. Reading last_successful_pull timestamp from settings
   * 2. Fetching lifelogs since that timestamp
   * 3. Storing them in database
   * 4. Updating last_successful_pull timestamp
   *
   * @returns Number of new lifelogs fetched and stored
   */
  async syncNewLifelogs(): Promise<number> {
    const { getSetting, insertSettings } = await import('./db/queries');
    const { insertLifelogs } = await import('./db/queries');

    // Get last successful pull timestamp (ISO 8601 date string YYYY-MM-DD)
    const lastPullSetting = getSetting('limitless_last_pull');
    const startDate = lastPullSetting
      ? decryptData(lastPullSetting.value_enc)
      : undefined;

    // Fetch lifelogs since last pull (or all if never pulled before)
    const lifelogs = await this.fetchLifelogsForDb({
      start_date: startDate,
    });

    if (lifelogs.length === 0) {
      return 0;
    }

    // Store lifelogs in database
    insertLifelogs(lifelogs);

    // Update last_successful_pull timestamp to today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const { encryptData } = await import('./crypto');
    insertSettings([
      {
        key: 'limitless_last_pull',
        value_enc: encryptData(today),
      },
    ]);

    return lifelogs.length;
  }
}

/**
 * Singleton instance (server-only)
 */
let limitlessClientInstance: LimitlessClient | null = null;

export function getLimitlessClient(): LimitlessClient {
  if (!limitlessClientInstance) {
    limitlessClientInstance = new LimitlessClient();
  }
  return limitlessClientInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetLimitlessClient(): void {
  limitlessClientInstance = null;
}

export { LimitlessClient };
