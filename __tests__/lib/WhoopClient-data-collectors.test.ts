/**
 * Wrath Shield v3 - WhoopClient Data Collectors Tests
 *
 * Comprehensive tests for WHOOP data fetchers, parsers, and normalizers
 * Covers: pagination, parsing, normalization, pipelines, and resilience
 */

import { WhoopClient } from '@/lib/WhoopClient';
import type { ParsedCycle, ParsedRecovery, ParsedSleep } from '@/lib/WhoopClient';

// Disable server-only guard for testing
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  cfg: jest.fn(() => ({
    whoop: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
  })),
}));

// Mock crypto functions
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace('encrypted_', '')),
}));

// Mock database functions
let mockTokens: Record<string, any> = {};

jest.mock('@/lib/db/queries', () => ({
  getToken: jest.fn((provider: string) => mockTokens[provider] || null),
  insertTokens: jest.fn((tokens: any[]) => {
    tokens.forEach((token) => {
      mockTokens[token.provider] = token;
    });
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('WhoopClient Data Collectors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const now = Math.floor(Date.now() / 1000);
    mockTokens = {
      whoop: {
        provider: 'whoop',
        access_token_enc: 'encrypted_valid_token',
        refresh_token_enc: 'encrypted_refresh_token',
        expires_at: now + 3600, // Valid for 1 hour
      },
    };
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Pagination Tests', () => {
    it('should fetch all pages of cycle data', async () => {
      // Mock paginated responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 1, score: { strain: 10.5 } },
              { id: 2, score: { strain: 12.0 } },
            ],
            next_token: 'page2_token',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 3, score: { strain: 15.5 } },
            ],
            next_token: null, // Last page
          }),
        });

      const client = new WhoopClient();
      const cycles = await client.fetchCycles('2024-01-01', '2024-01-31');

      expect(cycles).toHaveLength(3);
      expect(cycles[0].id).toBe(1);
      expect(cycles[2].id).toBe(3);

      // Verify pagination requests
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toContain('start=2024-01-01');
      expect(calls[1][0]).toContain('nextToken=page2_token');
    });

    it('should fetch all pages of recovery data with optional dates', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 100, score: { recovery_score: 85 } },
            ],
            next_token: 'recovery_page2',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 101, score: { recovery_score: 72 } },
            ],
            next_token: null,
          }),
        });

      const client = new WhoopClient();
      const recoveries = await client.fetchRecoveries();

      expect(recoveries).toHaveLength(2);
      expect(recoveries[0].id).toBe(100);
      expect(recoveries[1].id).toBe(101);
    });

    it('should handle empty pagination response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const sleeps = await client.fetchSleeps();

      expect(sleeps).toEqual([]);
    });

    it('should fetch all pages of sleep data with includeStages parameter', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 500, score: { stage_summary: { total_in_bed_time_milli: 28800000 } } },
            ],
            next_token: 'sleep_page2',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              { id: 501, score: { stage_summary: { total_in_bed_time_milli: 25200000 } } },
            ],
            next_token: null,
          }),
        });

      const client = new WhoopClient();
      const sleeps = await client.fetchSleeps('2024-01-01', '2024-01-31');

      expect(sleeps).toHaveLength(2);

      // Verify includeStages parameter
      const firstCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(firstCall).toContain('includeStages=true');
    });
  });

  describe('Parsing Tests', () => {
    it('should parse cycle data with strain classification', async () => {
      const rawCycle = {
        id: 12345,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        score: {
          strain: 15.2,
          kilojoule: 12500, // Singular, not plural
          average_heart_rate: 135,
          max_heart_rate: 178,
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseCycle(rawCycle);

      expect(parsed).toEqual({
        id: 12345,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        strain: 15.2,
        strain_level: 'overdrive', // >14
        kilojoules: 12500,
        avg_heart_rate: 135,
        max_heart_rate: 178,
      });
    });

    it('should classify strain levels correctly', async () => {
      const client = new WhoopClient();

      const lightCycle = { id: 1, start: '', end: '', score: { strain: 8.5 } };
      const moderateCycle = { id: 2, start: '', end: '', score: { strain: 12.0 } };
      const overdriveCycle = { id: 3, start: '', end: '', score: { strain: 16.5 } };

      expect((client as any).parseCycle(lightCycle).strain_level).toBe('light');
      expect((client as any).parseCycle(moderateCycle).strain_level).toBe('moderate');
      expect((client as any).parseCycle(overdriveCycle).strain_level).toBe('overdrive');
    });

    it('should parse recovery data with recovery level classification', async () => {
      const rawRecovery = {
        id: 67890,
        cycle_id: 12345,
        created_at: '2024-01-16T08:00:00Z',
        score: {
          recovery_score: 72,
          hrv_rmssd_milli: 45.5,
          resting_heart_rate: 52,
          spo2_percentage: 97.5,
          skin_temp_celsius: 33.2,
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseRecovery(rawRecovery);

      expect(parsed).toEqual({
        id: 67890,
        cycle_id: 12345,
        created_at: '2024-01-16T08:00:00Z',
        score_percentage: 72,
        recovery_level: 'high', // >=70
        hrv_rmssd_ms: 45.5,
        resting_heart_rate: 52,
        spo2_percentage: 97.5,
        skin_temp_celsius: 33.2,
      });
    });

    it('should classify recovery levels correctly', async () => {
      const client = new WhoopClient();

      const lowRecovery = { id: 1, created_at: '', score: { recovery_score: 35 } };
      const mediumRecovery = { id: 2, created_at: '', score: { recovery_score: 55 } };
      const highRecovery = { id: 3, created_at: '', score: { recovery_score: 85 } };

      expect((client as any).parseRecovery(lowRecovery).recovery_level).toBe('low');
      expect((client as any).parseRecovery(mediumRecovery).recovery_level).toBe('medium');
      expect((client as any).parseRecovery(highRecovery).recovery_level).toBe('high');
    });

    it('should parse sleep data with millisecond to minute conversions', async () => {
      const rawSleep = {
        id: 99999,
        start: '2024-01-15T22:00:00Z',
        end: '2024-01-16T06:30:00Z',
        score: {
          stage_summary: {
            total_rem_sleep_time_milli: 5400000, // 90 minutes
            total_slow_wave_sleep_time_milli: 3600000, // 60 minutes
            total_light_sleep_time_milli: 10800000, // 180 minutes
            total_awake_time_milli: 1800000, // 30 minutes
          },
          sleep_performance_percentage: 88,
          respiratory_rate: 14.5,
          sleep_needed: {
            total_sleep_needed_milli: 900000, // 15 minutes
          },
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseSleep(rawSleep);

      expect(parsed).toEqual({
        id: 99999,
        start: '2024-01-15T22:00:00Z',
        end: '2024-01-16T06:30:00Z',
        rem_minutes: 90,
        slow_wave_sleep_minutes: 60,
        light_sleep_minutes: 180,
        awake_minutes: 30,
        performance_percentage: 88,
        respiratory_rate: 14.5,
        sleep_debt_minutes: 15,
      });
    });

    it('should handle missing optional fields with defaults', async () => {
      const incompleteCycle = {
        id: 1,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        score: {
          strain: 10.0,
          // Missing: kilojoules, average_heart_rate, max_heart_rate
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseCycle(incompleteCycle);

      expect(parsed.kilojoules).toBe(0);
      expect(parsed.avg_heart_rate).toBe(0);
      expect(parsed.max_heart_rate).toBe(0);
      expect(parsed.strain).toBe(10.0);
    });

    it('should handle deeply nested null values', async () => {
      const incompleteRecovery = {
        id: 1,
        created_at: '2024-01-16T08:00:00Z',
        score: {
          recovery_score: 50,
          // All other fields missing
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseRecovery(incompleteRecovery);

      expect(parsed.score_percentage).toBe(50);
      expect(parsed.hrv_rmssd_ms).toBe(0);
      expect(parsed.resting_heart_rate).toBe(0);
      expect(parsed.spo2_percentage).toBe(0);
      expect(parsed.skin_temp_celsius).toBe(0);
    });
  });

  describe('Normalization Tests', () => {
    it('should normalize cycle data to database format', async () => {
      const parsedCycle: ParsedCycle = {
        id: 12345,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        strain: 15.2,
        strain_level: 'overdrive',
        kilojoules: 12500,
        avg_heart_rate: 135,
        max_heart_rate: 178,
      };

      const client = new WhoopClient();
      const normalized = (client as any).normalizeCycleForDb(parsedCycle);

      expect(normalized).toEqual({
        id: '12345', // Converted to string
        date: '2024-01-15', // Extracted from ISO timestamp
        strain: 15.2,
        kilojoules: 12500,
        avg_hr: 135, // Field renamed
        max_hr: 178, // Field renamed
      });
    });

    it('should normalize recovery data to database format', async () => {
      const parsedRecovery: ParsedRecovery = {
        id: 67890,
        cycle_id: 12345,
        created_at: '2024-01-16T08:00:00Z',
        score_percentage: 72,
        recovery_level: 'high',
        hrv_rmssd_ms: 45.5,
        resting_heart_rate: 52,
        spo2_percentage: 97.5,
        skin_temp_celsius: 33.2,
      };

      const client = new WhoopClient();
      const normalized = (client as any).normalizeRecoveryForDb(parsedRecovery);

      expect(normalized).toEqual({
        id: '67890', // Converted to string
        date: '2024-01-16', // Extracted from ISO timestamp
        score: 72, // Field renamed
        hrv: 45.5, // Field renamed
        rhr: 52, // Field renamed
        spo2: 97.5, // Field renamed
        skin_temp: 33.2, // Field renamed
      });
    });

    it('should normalize sleep data to database format', async () => {
      const parsedSleep: ParsedSleep = {
        id: 99999,
        start: '2024-01-15T22:00:00Z',
        end: '2024-01-16T06:30:00Z',
        rem_minutes: 90,
        slow_wave_sleep_minutes: 60,
        light_sleep_minutes: 180,
        awake_minutes: 30,
        performance_percentage: 88,
        respiratory_rate: 14.5,
        sleep_debt_minutes: 15,
      };

      const client = new WhoopClient();
      const normalized = (client as any).normalizeSleepForDb(parsedSleep);

      expect(normalized).toEqual({
        id: '99999', // Converted to string
        date: '2024-01-15', // Extracted from ISO timestamp
        performance: 88, // Field renamed
        rem_min: 90, // Field renamed
        sws_min: 60, // Field renamed
        light_min: 180, // Field renamed
        respiration: 14.5, // Field renamed
        sleep_debt_min: 15, // Field renamed
      });
    });

    it('should handle date extraction from various ISO formats', async () => {
      const client = new WhoopClient();

      const cycle1: ParsedCycle = {
        id: 1,
        start: '2024-01-15T10:00:00.000Z',
        end: '',
        strain: 10,
        strain_level: 'moderate',
        kilojoules: 0,
        avg_heart_rate: 0,
        max_heart_rate: 0,
      };

      const cycle2: ParsedCycle = {
        id: 2,
        start: '2024-12-31T23:59:59Z',
        end: '',
        strain: 10,
        strain_level: 'moderate',
        kilojoules: 0,
        avg_heart_rate: 0,
        max_heart_rate: 0,
      };

      expect((client as any).normalizeCycleForDb(cycle1).date).toBe('2024-01-15');
      expect((client as any).normalizeCycleForDb(cycle2).date).toBe('2024-12-31');
    });

    it('should handle edge cases with zeros and nulls', async () => {
      const parsedCycle: ParsedCycle = {
        id: 0, // Edge case: zero ID
        start: '2024-01-15T00:00:00Z',
        end: '2024-01-15T00:00:00Z',
        strain: 0,
        strain_level: 'light',
        kilojoules: 0,
        avg_heart_rate: 0,
        max_heart_rate: 0,
      };

      const client = new WhoopClient();
      const normalized = (client as any).normalizeCycleForDb(parsedCycle);

      expect(normalized.id).toBe('0');
      expect(normalized.strain).toBe(0);
      expect(normalized.kilojoules).toBe(0);
    });
  });

  describe('Pipeline Tests', () => {
    it('should fetch, parse, and normalize cycles in single call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 100,
              start: '2024-01-15T10:00:00Z',
              end: '2024-01-15T18:00:00Z',
              score: {
                strain: 12.5,
                kilojoule: 10000, // Singular, not plural
                average_heart_rate: 130,
                max_heart_rate: 175,
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const cycles = await client.fetchCyclesForDb('2024-01-01', '2024-01-31');

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual({
        id: '100', // Normalized to string
        date: '2024-01-15', // Extracted from timestamp
        strain: 12.5,
        kilojoules: 10000,
        avg_hr: 130, // Field renamed
        max_hr: 175, // Field renamed
      });
    });

    it('should fetch, parse, and normalize recoveries in single call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 200,
              cycle_id: 100,
              created_at: '2024-01-16T08:00:00Z',
              score: {
                recovery_score: 80,
                hrv_rmssd_milli: 50.0,
                resting_heart_rate: 50,
                spo2_percentage: 98.0,
                skin_temp_celsius: 33.5,
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const recoveries = await client.fetchRecoveriesForDb();

      expect(recoveries).toHaveLength(1);
      expect(recoveries[0]).toEqual({
        id: '200',
        date: '2024-01-16',
        score: 80,
        hrv: 50.0,
        rhr: 50,
        spo2: 98.0,
        skin_temp: 33.5,
      });
    });

    it('should fetch, parse, and normalize sleeps in single call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            {
              id: 300,
              start: '2024-01-15T22:00:00Z',
              end: '2024-01-16T06:00:00Z',
              score: {
                stage_summary: {
                  total_rem_sleep_time_milli: 5400000,
                  total_slow_wave_sleep_time_milli: 3600000,
                  total_light_sleep_time_milli: 10800000,
                  total_awake_time_milli: 1800000,
                },
                sleep_performance_percentage: 90,
                respiratory_rate: 15.0,
                sleep_needed: {
                  total_sleep_needed_milli: 600000, // 10 minutes in milliseconds
                },
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const sleeps = await client.fetchSleepsForDb('2024-01-01', '2024-01-31');

      expect(sleeps).toHaveLength(1);
      expect(sleeps[0]).toEqual({
        id: '300',
        date: '2024-01-15',
        performance: 90,
        rem_min: 90,
        sws_min: 60,
        light_min: 180,
        respiration: 15.0,
        sleep_debt_min: 10,
      });
    });

    it('should handle multi-page pipeline with normalization', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              {
                id: 1,
                start: '2024-01-15T10:00:00Z',
                end: '2024-01-15T18:00:00Z',
                score: { strain: 10.0 },
              },
            ],
            next_token: 'page2',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            records: [
              {
                id: 2,
                start: '2024-01-16T10:00:00Z',
                end: '2024-01-16T18:00:00Z',
                score: { strain: 12.0 },
              },
            ],
            next_token: null,
          }),
        });

      const client = new WhoopClient();
      const cycles = await client.fetchCyclesForDb('2024-01-01', '2024-01-31');

      expect(cycles).toHaveLength(2);
      expect(cycles[0].id).toBe('1');
      expect(cycles[1].id).toBe('2');
      expect(cycles[0].date).toBe('2024-01-15');
      expect(cycles[1].date).toBe('2024-01-16');
    });
  });

  describe('Resilience Tests', () => {
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const client = new WhoopClient();

      await expect(client.fetchCycles('2024-01-01', '2024-01-31')).rejects.toThrow(
        'WHOOP API error: 500 Internal Server Error'
      );
    });

    it('should handle network failures', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network request failed'));

      const client = new WhoopClient();

      await expect(client.fetchRecoveries()).rejects.toThrow('Network request failed');
    });

    it('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing 'records' field
          next_token: null,
        }),
      });

      const client = new WhoopClient();

      // Should handle missing records gracefully by returning empty array
      const sleeps = await client.fetchSleeps();
      expect(sleeps).toEqual([]);
    });

    it('should handle empty string dates in normalization', async () => {
      const parsedCycle: ParsedCycle = {
        id: 1,
        start: '', // Edge case: empty timestamp
        end: '',
        strain: 10,
        strain_level: 'moderate',
        kilojoules: 0,
        avg_heart_rate: 0,
        max_heart_rate: 0,
      };

      const client = new WhoopClient();
      const normalized = (client as any).normalizeCycleForDb(parsedCycle);

      // Should extract empty string before 'T' (which doesn't exist)
      expect(normalized.date).toBe('');
    });

    it('should handle parsing with completely missing score objects', async () => {
      const rawCycle = {
        id: 1,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        // score object completely missing
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseCycle(rawCycle);

      // Should use defaults from optional chaining
      expect(parsed.strain).toBe(0);
      expect(parsed.kilojoules).toBe(0);
      expect(parsed.avg_heart_rate).toBe(0);
      expect(parsed.max_heart_rate).toBe(0);
      expect(parsed.strain_level).toBe('light'); // Classified based on 0
    });

    it('should handle very large numeric values', async () => {
      const rawCycle = {
        id: 999999999,
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T18:00:00Z',
        score: {
          strain: 99.9,
          kilojoule: 999999, // Singular, not plural - matches WHOOP API
          average_heart_rate: 200,
          max_heart_rate: 220,
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseCycle(rawCycle);
      const normalized = (client as any).normalizeCycleForDb(parsed);

      expect(normalized.id).toBe('999999999');
      expect(normalized.strain).toBe(99.9);
      expect(normalized.kilojoules).toBe(999999);
      expect(normalized.avg_hr).toBe(200);
      expect(normalized.max_hr).toBe(220);
    });

    it('should handle fractional millisecond sleep durations', async () => {
      const rawSleep = {
        id: 1,
        start: '2024-01-15T22:00:00Z',
        end: '2024-01-16T06:00:00Z',
        score: {
          stage_summary: {
            total_rem_sleep_time_milli: 5400123, // 90.002 minutes, Math.round() = 90
            total_slow_wave_sleep_time_milli: 3600789, // 60.013 minutes, Math.round() = 60
            total_light_sleep_time_milli: 10800456, // 180.008 minutes, Math.round() = 180
            total_awake_time_milli: 1800999, // 30.017 minutes, Math.round() = 30
          },
          sleep_performance_percentage: 88.5,
          respiratory_rate: 14.7,
          sleep_needed: {
            total_sleep_needed_milli: 900000, // 15 minutes
          },
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseSleep(rawSleep);

      // WhoopClient uses Math.round() for millisecond to minute conversions
      expect(parsed.rem_minutes).toBe(90);
      expect(parsed.slow_wave_sleep_minutes).toBe(60);
      expect(parsed.light_sleep_minutes).toBe(180);
      expect(parsed.awake_minutes).toBe(30);
      expect(parsed.sleep_debt_minutes).toBe(15);
    });

    it('should handle null values in deeply nested sleep stage data', async () => {
      const rawSleep = {
        id: 1,
        start: '2024-01-15T22:00:00Z',
        end: '2024-01-16T06:00:00Z',
        score: {
          stage_summary: {
            // Some fields null
            total_rem_sleep_time_milli: null,
            total_slow_wave_sleep_time_milli: 3600000,
            total_light_sleep_time_milli: null,
            total_awake_time_milli: 1800000,
          },
          sleep_performance_percentage: null,
          respiratory_rate: 14.5,
          sleep_debt_minutes: null,
        },
      };

      const client = new WhoopClient();
      const parsed = (client as any).parseSleep(rawSleep);

      expect(parsed.rem_minutes).toBe(0);
      expect(parsed.slow_wave_sleep_minutes).toBe(60);
      expect(parsed.light_sleep_minutes).toBe(0);
      expect(parsed.awake_minutes).toBe(30);
      expect(parsed.performance_percentage).toBe(0);
      expect(parsed.sleep_debt_minutes).toBe(0);
    });
  });
});
