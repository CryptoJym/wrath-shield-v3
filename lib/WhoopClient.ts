/**
 * Wrath Shield v3 - WHOOP API Client
 *
 * Handles API requests to WHOOP with automatic token refresh.
 */

import { cfg } from '@/lib/config';
import { decryptData, encryptData } from '@/lib/crypto';
import { getToken, insertTokens } from '@/lib/db/queries';
import { ensureServerOnly } from '@/lib/server-only-guard';
import type { CycleInput, RecoveryInput, SleepInput } from '@/lib/db/types';
import { httpsRequest } from '@/lib/https-proxy-request';

ensureServerOnly();

const WHOOP_API_BASE = 'https://api.prod.whoop.com';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const TOKEN_REFRESH_BUFFER_SECONDS = 60; // Refresh 60 seconds before expiry

/**
 * WHOOP Token Refresh Response
 */
interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Seconds until expiration
  refresh_token: string;
  scope: string;
}

/**
 * WHOOP Paginated API Response
 */
interface PaginatedResponse<T> {
  records: T[];
  next_token?: string | null;
}

/**
 * Strain classification levels
 */
export type StrainLevel = 'light' | 'moderate' | 'overdrive';

/**
 * Recovery score classification levels
 */
export type RecoveryLevel = 'high' | 'medium' | 'low';

/**
 * Parsed Cycle Data
 */
export interface ParsedCycle {
  id: number;
  start: string;
  end: string;
  strain: number;
  strain_level: StrainLevel;
  kilojoules: number;
  avg_heart_rate: number;
  max_heart_rate: number;
}

/**
 * Parsed Recovery Data
 */
export interface ParsedRecovery {
  id: number;
  cycle_id: number;
  created_at: string;
  score_percentage: number;
  recovery_level: RecoveryLevel;
  hrv_rmssd_ms: number;
  resting_heart_rate: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
}

/**
 * Parsed Sleep Data
 */
export interface ParsedSleep {
  id: number;
  start: string;
  end: string;
  rem_minutes: number;
  slow_wave_sleep_minutes: number;
  light_sleep_minutes: number;
  awake_minutes: number;
  performance_percentage: number;
  respiratory_rate: number;
  sleep_debt_minutes: number;
}

/**
 * WHOOP API Client with automatic token refresh
 */
export class WhoopClient {
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<void> | null = null;

  /**
   * Get the current access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    const tokenRecord = getToken('whoop');

    if (!tokenRecord) {
      throw new Error('No WHOOP token found. User must authenticate first.');
    }

    const now = Math.floor(Date.now() / 1000);
    const needsRefresh =
      tokenRecord.expires_at &&
      now >= tokenRecord.expires_at - TOKEN_REFRESH_BUFFER_SECONDS;

    if (needsRefresh) {
      await this.refreshToken();
      // Get the updated token
      const updatedToken = getToken('whoop');
      if (!updatedToken) {
        throw new Error('Token refresh succeeded but token not found in database');
      }
      return decryptData(updatedToken.access_token_enc);
    }

    return decryptData(tokenRecord.access_token_enc);
  }

  /**
   * Refresh the WHOOP access token using the refresh token
   */
  async refreshToken(): Promise<void> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    // Set refreshing flag and create new refresh promise
    this.isRefreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method to perform the actual token refresh
   */
  private async _performRefresh(): Promise<void> {
    const tokenRecord = getToken('whoop');

    if (!tokenRecord || !tokenRecord.refresh_token_enc) {
      throw new Error('No refresh token available. User must re-authenticate.');
    }

    const refreshToken = decryptData(tokenRecord.refresh_token_enc);
    const config = cfg();

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.whoop.clientId,
      client_secret: config.whoop.clientSecret,
    });

    console.log('[WhoopClient] Refreshing access token');

    const response = await httpsRequest(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (response.status !== 200) {
      console.error('[WhoopClient] Token refresh failed:', response.status, response.data);
      throw new Error(`Token refresh failed: ${response.status} ${response.data}`);
    }

    const tokenData = JSON.parse(response.data) as TokenRefreshResponse;

    // Encrypt new tokens
    const accessTokenEnc = encryptData(tokenData.access_token);
    const refreshTokenEnc = encryptData(tokenData.refresh_token);

    // Calculate new expiration timestamp
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    // Update tokens in database
    insertTokens([
      {
        provider: 'whoop',
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        expires_at: expiresAt,
      },
    ]);

    console.log('[WhoopClient] Token refresh successful');
  }

  /**
   * Make an authenticated GET request to the WHOOP API
   */
  async get<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Make an authenticated POST request to the WHOOP API
   */
  async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Make an authenticated request to the WHOOP API with automatic token refresh on 401
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    retryCount: number = 0
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = `${WHOOP_API_BASE}${path}`;

    const requestOptions: any = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await httpsRequest(url, requestOptions);

    // Handle 401 Unauthorized - token might be expired despite our refresh logic
    if (response.status === 401 && retryCount === 0) {
      console.log('[WhoopClient] Got 401, refreshing token and retrying');
      await this.refreshToken();
      // Retry once with new token
      return this.request<T>(method, path, body, retryCount + 1);
    }

    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`WHOOP API error: ${response.status} ${response.data}`);
    }

    return JSON.parse(response.data) as T;
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<any> {
    return this.get('/developer/v1/user/profile/basic');
  }

  /**
   * Get user's recovery data for a specific date or date range
   */
  async getRecovery(params?: { start?: string; end?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.start) queryParams.set('start', params.start);
    if (params?.end) queryParams.set('end', params.end);

    const query = queryParams.toString();
    return this.get(`/developer/v1/recovery${query ? `?${query}` : ''}`);
  }

  /**
   * Get user's cycle data (strain, activity)
   */
  async getCycles(params?: { start?: string; end?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.start) queryParams.set('start', params.start);
    if (params?.end) queryParams.set('end', params.end);

    const query = queryParams.toString();
    return this.get(`/developer/v1/cycle${query ? `?${query}` : ''}`);
  }

  /**
   * Get user's sleep data
   */
  async getSleep(params?: { start?: string; end?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.start) queryParams.set('start', params.start);
    if (params?.end) queryParams.set('end', params.end);

    const query = queryParams.toString();
    return this.get(`/developer/v1/activity/sleep${query ? `?${query}` : ''}`);
  }

  /**
   * Generic pagination helper for WHOOP v2 API endpoints
   * Fetches all pages and returns combined records array
   */
  private async fetchPaginated<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const allRecords: T[] = [];
    let nextToken: string | null | undefined = undefined;

    do {
      // Build query parameters
      const queryParams = new URLSearchParams(params);
      if (nextToken) {
        queryParams.set('nextToken', nextToken);
      }

      const query = queryParams.toString();
      const url = `${path}${query ? `?${query}` : ''}`;

      // Make API request
      const response = await this.get<PaginatedResponse<T>>(url);

      // Accumulate records
      if (response.records && Array.isArray(response.records)) {
        allRecords.push(...response.records);
      }

      // Update cursor for next iteration
      nextToken = response.next_token;
    } while (nextToken);

    return allRecords;
  }

  /**
   * Fetch all cycles (strain/activity data) for a date range with pagination
   * Uses WHOOP v2 API endpoint
   *
   * @param start - Start date in ISO 8601 format (e.g., '2024-01-01T00:00:00Z')
   * @param end - End date in ISO 8601 format (e.g., '2024-01-31T23:59:59Z')
   * @returns Array of all cycle records across all pages
   */
  async fetchCycles(start: string, end: string): Promise<any[]> {
    return this.fetchPaginated('/developer/v2/cycle', {
      limit: '25',
      start,
      end,
    });
  }

  /**
   * Fetch all recovery data with pagination
   * Uses WHOOP v2 API endpoint
   *
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of all recovery records across all pages
   */
  async fetchRecoveries(start?: string, end?: string): Promise<any[]> {
    const params: Record<string, string> = { limit: '25' };
    if (start) params.start = start;
    if (end) params.end = end;

    return this.fetchPaginated('/developer/v2/recovery', params);
  }

  /**
   * Fetch all sleep data with detailed stage information and pagination
   * Uses WHOOP v2 API endpoint
   *
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of all sleep records with stage details across all pages
   */
  async fetchSleeps(start?: string, end?: string): Promise<any[]> {
    const params: Record<string, string> = {
      limit: '25',
      includeStages: 'true',
    };
    if (start) params.start = start;
    if (end) params.end = end;

    return this.fetchPaginated('/developer/v2/activity/sleep', params);
  }

  /**
   * Classify strain level based on strain value
   * @param strain - Strain value (0-21)
   * @returns Strain level classification
   */
  classifyStrain(strain: number): StrainLevel {
    if (strain < 10) return 'light';
    if (strain <= 14) return 'moderate';
    return 'overdrive';
  }

  /**
   * Classify recovery score level
   * @param score - Recovery score percentage (0-100)
   * @returns Recovery level classification
   */
  classifyRecoveryScore(score: number): RecoveryLevel {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Parse raw cycle data from WHOOP API v2
   * @param rawCycle - Raw cycle object from API
   * @returns Parsed and classified cycle data
   */
  parseCycle(rawCycle: any): ParsedCycle {
    const strain = rawCycle.score?.strain ?? 0;
    return {
      id: rawCycle.id,
      start: rawCycle.start,
      end: rawCycle.end,
      strain,
      strain_level: this.classifyStrain(strain),
      kilojoules: rawCycle.score?.kilojoule ?? 0,
      avg_heart_rate: rawCycle.score?.average_heart_rate ?? 0,
      max_heart_rate: rawCycle.score?.max_heart_rate ?? 0,
    };
  }

  /**
   * Parse raw recovery data from WHOOP API v2
   * @param rawRecovery - Raw recovery object from API
   * @returns Parsed and classified recovery data
   */
  parseRecovery(rawRecovery: any): ParsedRecovery {
    const scoreRaw = rawRecovery.score?.recovery_score;
    const score = typeof scoreRaw === 'string' ? Number(scoreRaw) : (scoreRaw ?? 0);
    const hrvRaw = rawRecovery.score?.hrv_rmssd_milli;
    const rhrRaw = rawRecovery.score?.resting_heart_rate;
    const spo2Raw = rawRecovery.score?.spo2_percentage;
    const skinRaw = rawRecovery.score?.skin_temp_celsius;
    return {
      id: rawRecovery.id,
      cycle_id: rawRecovery.cycle_id,
      created_at: rawRecovery.created_at,
      score_percentage: score,
      recovery_level: this.classifyRecoveryScore(score),
      hrv_rmssd_ms: typeof hrvRaw === 'string' ? Number(hrvRaw) : (hrvRaw ?? 0),
      resting_heart_rate: typeof rhrRaw === 'string' ? Number(rhrRaw) : (rhrRaw ?? 0),
      spo2_percentage: typeof spo2Raw === 'string' ? Number(spo2Raw) : (spo2Raw ?? 0),
      skin_temp_celsius: typeof skinRaw === 'string' ? Number(skinRaw) : (skinRaw ?? 0),
    };
  }

  /**
   * Parse raw sleep data from WHOOP API v2
   * @param rawSleep - Raw sleep object from API
   * @returns Parsed sleep data with stage breakdown
   */
  parseSleep(rawSleep: any): ParsedSleep {
    const stageSummary = rawSleep.score?.stage_summary ?? {};
    return {
      id: rawSleep.id,
      start: rawSleep.start,
      end: rawSleep.end,
      rem_minutes: stageSummary.total_rem_sleep_time_milli
        ? Math.round(stageSummary.total_rem_sleep_time_milli / 1000 / 60)
        : 0,
      slow_wave_sleep_minutes: stageSummary.total_slow_wave_sleep_time_milli
        ? Math.round(stageSummary.total_slow_wave_sleep_time_milli / 1000 / 60)
        : 0,
      light_sleep_minutes: stageSummary.total_light_sleep_time_milli
        ? Math.round(stageSummary.total_light_sleep_time_milli / 1000 / 60)
        : 0,
      awake_minutes: stageSummary.total_awake_time_milli
        ? Math.round(stageSummary.total_awake_time_milli / 1000 / 60)
        : 0,
      performance_percentage: rawSleep.score?.sleep_performance_percentage ?? 0,
      respiratory_rate: rawSleep.score?.respiratory_rate ?? 0,
      sleep_debt_minutes: rawSleep.score?.sleep_needed?.total_sleep_needed_milli
        ? Math.round(rawSleep.score.sleep_needed.total_sleep_needed_milli / 1000 / 60)
        : 0,
    };
  }

  /**
   * Extract YYYY-MM-DD from an ISO-like timestamp. Returns '' if invalid.
   */
  private extractDate(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';
    const candidate = input.length >= 10 ? input.slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
  }

  /**
   * Normalize parsed cycle data to database format
   * @param parsed - Parsed cycle data
   * @returns Database-ready cycle record
   */
  normalizeCycleForDb(parsed: ParsedCycle): CycleInput {
    return {
      id: parsed.id.toString(),
      date: this.extractDate(parsed.start),
      strain: parsed.strain,
      kilojoules: parsed.kilojoules,
      avg_hr: parsed.avg_heart_rate,
      max_hr: parsed.max_heart_rate,
    };
  }

  /**
   * Normalize parsed recovery data to database format
   * @param parsed - Parsed recovery data
   * @returns Database-ready recovery record
   */
  normalizeRecoveryForDb(parsed: ParsedRecovery): RecoveryInput {
    return {
      id: parsed.id.toString(),
      date: this.extractDate(parsed.created_at),
      score: parsed.score_percentage,
      hrv: parsed.hrv_rmssd_ms,
      rhr: parsed.resting_heart_rate,
      spo2: parsed.spo2_percentage,
      skin_temp: parsed.skin_temp_celsius,
    };
  }

  /**
   * Normalize parsed sleep data to database format
   * @param parsed - Parsed sleep data
   * @returns Database-ready sleep record
   */
  normalizeSleepForDb(parsed: ParsedSleep): SleepInput {
    return {
      id: parsed.id.toString(),
      date: this.extractDate(parsed.start),
      performance: parsed.performance_percentage,
      rem_min: parsed.rem_minutes,
      sws_min: parsed.slow_wave_sleep_minutes,
      light_min: parsed.light_sleep_minutes,
      respiration: parsed.respiratory_rate,
      sleep_debt_min: parsed.sleep_debt_minutes,
    };
  }

  /**
   * Fetch and parse all cycles for a date range
   * @param start - Start date in ISO 8601 format
   * @param end - End date in ISO 8601 format
   * @returns Array of parsed and classified cycle data
   */
  async fetchAndParseCycles(start: string, end: string): Promise<ParsedCycle[]> {
    const rawCycles = await this.fetchCycles(start, end);
    return rawCycles.map((cycle) => this.parseCycle(cycle));
  }

  /**
   * Fetch and parse all recoveries for a date range
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of parsed and classified recovery data
   */
  async fetchAndParseRecoveries(start?: string, end?: string): Promise<ParsedRecovery[]> {
    const rawRecoveries = await this.fetchRecoveries(start, end);
    return rawRecoveries.map((recovery) => this.parseRecovery(recovery));
  }

  /**
   * Fetch and parse all sleeps for a date range
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of parsed sleep data with stage breakdowns
   */
  async fetchAndParseSleeps(start?: string, end?: string): Promise<ParsedSleep[]> {
    const rawSleeps = await this.fetchSleeps(start, end);
    return rawSleeps.map((sleep) => this.parseSleep(sleep));
  }

  /**
   * Fetch, parse, and normalize cycles for database upsert
   * @param start - Start date in ISO 8601 format
   * @param end - End date in ISO 8601 format
   * @returns Array of database-ready cycle records
   */
  async fetchCyclesForDb(start: string, end: string): Promise<CycleInput[]> {
    const parsed = await this.fetchAndParseCycles(start, end);
    return parsed.map((cycle) => this.normalizeCycleForDb(cycle));
  }

  /**
   * Fetch, parse, and normalize recoveries for database upsert
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of database-ready recovery records
   */
  async fetchRecoveriesForDb(start?: string, end?: string): Promise<RecoveryInput[]> {
    const parsed = await this.fetchAndParseRecoveries(start, end);
    return parsed.map((recovery) => this.normalizeRecoveryForDb(recovery));
  }

  /**
   * Fetch, parse, and normalize sleeps for database upsert
   * @param start - Optional start date in ISO 8601 format
   * @param end - Optional end date in ISO 8601 format
   * @returns Array of database-ready sleep records
   */
  async fetchSleepsForDb(start?: string, end?: string): Promise<SleepInput[]> {
    const parsed = await this.fetchAndParseSleeps(start, end);
    return parsed.map((sleep) => this.normalizeSleepForDb(sleep));
  }
}

/**
 * Singleton instance for server-side use
 */
let clientInstance: WhoopClient | null = null;

/**
 * Get the singleton WhoopClient instance
 */
export function getWhoopClient(): WhoopClient {
  if (!clientInstance) {
    clientInstance = new WhoopClient();
  }
  return clientInstance;
}
