/**
 * Wrath Shield v3 - WHOOP End-to-End Simulation Test
 *
 * This test simulates the complete OAuth flow and data fetching process
 * to verify the full integration works correctly without requiring actual
 * WHOOP credentials or network access.
 */

// Disable server-only guard
jest.mock('@/lib/server-only-guard', () => ({
  ensureServerOnly: jest.fn(),
}));

// Mock https-proxy-request
jest.mock('@/lib/https-proxy-request', () => ({
  httpsRequest: jest.fn(),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  cfg: jest.fn(() => ({
    whoop: {
      clientId: '09d7de49-f87e-4c41-a93c-8f7acba1ce40',
      clientSecret: '0d9a53f760f6c47e105c5286e6c61d42509faf42091c61d5c494620190b55320',
      redirectUri: 'http://localhost:3000/api/whoop/oauth/callback',
    },
    openRouter: { apiKey: 'test-key' },
    encryption: { key: 'test-encryption-key-32-bytes-long!' },
  })),
}));

// Mock crypto
jest.mock('@/lib/crypto', () => ({
  encryptData: jest.fn((data: string) => `encrypted_${data}`),
  decryptData: jest.fn((data: string) => data.replace('encrypted_', '')),
}));

// Mock database
const mockTokens: any[] = [];
jest.mock('@/lib/db/queries', () => ({
  getToken: jest.fn(() => {
    const token = mockTokens.find((t) => t.provider === 'whoop');
    return token || null;
  }),
  insertTokens: jest.fn((tokens: any[]) => {
    mockTokens.push(...tokens);
  }),
}));

import { WhoopClient } from '@/lib/WhoopClient';
import { httpsRequest } from '@/lib/https-proxy-request';
import { GET as OAuthCallback } from '@/app/api/whoop/oauth/callback/route';
import { NextRequest } from 'next/server';

describe('WHOOP End-to-End Simulation', () => {
  const mockHttpsRequest = httpsRequest as jest.MockedFunction<typeof httpsRequest>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.length = 0; // Clear tokens array
  });

  describe('Complete OAuth Flow Simulation', () => {
    it('should complete full OAuth flow: callback → token storage → data fetch', async () => {
      // ==========================================
      // STEP 1: Simulate OAuth Callback
      // ==========================================
      console.log('\n=== STEP 1: OAuth Callback ===');

      // Mock the token exchange response from WHOOP
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          access_token: 'whoop_access_token_abc123xyz',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'whoop_refresh_token_def456uvw',
          scope: 'read:recovery read:cycles read:sleep',
        }),
      });

      // Simulate OAuth callback request
      const callbackRequest = {
        url: 'http://localhost:3000/api/whoop/oauth/callback?code=auth_code_123&state=valid_state',
        headers: new Headers({ host: 'localhost:3000' }),
        cookies: {
          get: jest.fn((name: string) =>
            name === 'oauth_state' ? { value: 'valid_state' } : undefined
          ),
          set: jest.fn(),
          delete: jest.fn(),
        },
      } as unknown as NextRequest;

      const callbackResponse = await OAuthCallback(callbackRequest);

      expect(callbackResponse.status).toBe(302); // Redirect to success page
      expect(mockTokens.length).toBe(1);
      expect(mockTokens[0].provider).toBe('whoop');
      console.log('✓ OAuth tokens stored successfully');
      console.log(`  - Access token: ${mockTokens[0].access_token_enc.substring(0, 30)}...`);
      console.log(`  - Refresh token: ${mockTokens[0].refresh_token_enc.substring(0, 30)}...`);
      console.log(`  - Expires at: ${new Date(mockTokens[0].expires_at * 1000).toISOString()}`);

      // ==========================================
      // STEP 2: Fetch WHOOP Cycle Data
      // ==========================================
      console.log('\n=== STEP 2: Fetch Cycle Data ===');

      // Mock cycle data response
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            {
              id: 1234567,
              user_id: 9876543,
              created_at: '2024-11-05T10:00:00Z',
              updated_at: '2024-11-05T18:00:00Z',
              start: '2024-11-05T06:00:00Z',
              end: '2024-11-05T17:30:00Z',
              timezone_offset: '-08:00',
              score_state: 'SCORED',
              score: {
                strain: 15.6,
                kilojoule: 12500,
                average_heart_rate: 110,
                max_heart_rate: 175,
              },
            },
            {
              id: 1234568,
              user_id: 9876543,
              created_at: '2024-11-06T10:00:00Z',
              updated_at: '2024-11-06T18:00:00Z',
              start: '2024-11-06T06:00:00Z',
              end: '2024-11-06T17:30:00Z',
              timezone_offset: '-08:00',
              score_state: 'SCORED',
              score: {
                strain: 8.2,
                kilojoule: 6800,
                average_heart_rate: 95,
                max_heart_rate: 155,
              },
            },
          ],
          next_token: null,
        }),
      });

      const client = new WhoopClient();
      const startDate = '2024-11-05T00:00:00Z';
      const endDate = '2024-11-07T00:00:00Z';
      const cycles = await client.fetchCycles(startDate, endDate);

      expect(cycles).toHaveLength(2);
      expect(cycles[0].score.strain).toBe(15.6);
      expect(cycles[1].score.strain).toBe(8.2);

      // Test classification methods
      const strain1Level = client.classifyStrain(cycles[0].score.strain);
      const strain2Level = client.classifyStrain(cycles[1].score.strain);
      expect(strain1Level).toBe('overdrive'); // > 14
      expect(strain2Level).toBe('light'); // < 10

      console.log(`✓ Fetched ${cycles.length} cycles`);
      console.log(`  - Cycle 1: Strain ${cycles[0].score.strain} (${strain1Level})`);
      console.log(`  - Cycle 2: Strain ${cycles[1].score.strain} (${strain2Level})`);

      // ==========================================
      // STEP 3: Fetch WHOOP Recovery Data
      // ==========================================
      console.log('\n=== STEP 3: Fetch Recovery Data ===');

      // Mock recovery data response
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            {
              cycle_id: 1234567,
              sleep_id: 8765432,
              user_id: 9876543,
              created_at: '2024-11-05T08:00:00Z',
              updated_at: '2024-11-05T08:30:00Z',
              score_state: 'SCORED',
              score: {
                user_calibrating: false,
                recovery_score: 85,
                resting_heart_rate: 52,
                hrv_rmssd_milli: 75,
                spo2_percentage: 97.5,
                skin_temp_celsius: 34.2,
              },
            },
            {
              cycle_id: 1234568,
              sleep_id: 8765433,
              user_id: 9876543,
              created_at: '2024-11-06T08:00:00Z',
              updated_at: '2024-11-06T08:30:00Z',
              score_state: 'SCORED',
              score: {
                user_calibrating: false,
                recovery_score: 45,
                resting_heart_rate: 58,
                hrv_rmssd_milli: 42,
                spo2_percentage: 96.8,
                skin_temp_celsius: 34.5,
              },
            },
          ],
          next_token: null,
        }),
      });

      const recoveries = await client.fetchRecoveries(startDate, endDate);

      expect(recoveries).toHaveLength(2);
      expect(recoveries[0].score.recovery_score).toBe(85);
      expect(recoveries[1].score.recovery_score).toBe(45);

      // Test classification methods
      const recovery1Level = client.classifyRecoveryScore(recoveries[0].score.recovery_score);
      const recovery2Level = client.classifyRecoveryScore(recoveries[1].score.recovery_score);
      expect(recovery1Level).toBe('high'); // >= 67
      expect(recovery2Level).toBe('medium'); // 34-66

      console.log(`✓ Fetched ${recoveries.length} recoveries`);
      console.log(`  - Recovery 1: Score ${recoveries[0].score.recovery_score}% (${recovery1Level})`);
      console.log(`  - Recovery 2: Score ${recoveries[1].score.recovery_score}% (${recovery2Level})`);

      // ==========================================
      // STEP 4: Fetch WHOOP Sleep Data
      // ==========================================
      console.log('\n=== STEP 4: Fetch Sleep Data ===');

      // Mock sleep data response
      mockHttpsRequest.mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          records: [
            {
              id: 8765432,
              user_id: 9876543,
              created_at: '2024-11-04T23:00:00Z',
              updated_at: '2024-11-05T07:00:00Z',
              start: '2024-11-04T23:00:00Z',
              end: '2024-11-05T07:00:00Z',
              timezone_offset: '-08:00',
              nap: false,
              score_state: 'SCORED',
              score: {
                stage_summary: {
                  total_in_bed_time_milli: 28800000, // 8 hours
                  total_awake_time_milli: 1800000, // 30 min
                  total_no_data_time_milli: 0,
                  total_light_sleep_time_milli: 14400000, // 4 hours
                  total_slow_wave_sleep_time_milli: 7200000, // 2 hours
                  total_rem_sleep_time_milli: 5400000, // 1.5 hours
                  sleep_cycle_count: 5,
                  disturbance_count: 8,
                },
                sleep_needed: {
                  baseline_milli: 27000000,
                  need_from_sleep_debt_milli: 1800000,
                  need_from_recent_strain_milli: 0,
                  need_from_recent_nap_milli: 0,
                },
                respiratory_rate: 14.5,
                sleep_performance_percentage: 92,
                sleep_consistency_percentage: 88,
                sleep_efficiency_percentage: 94,
              },
            },
          ],
          next_token: null,
        }),
      });

      const sleeps = await client.fetchSleeps(startDate, endDate);

      expect(sleeps).toHaveLength(1);
      expect(sleeps[0].score.sleep_performance_percentage).toBe(92);
      expect(sleeps[0].score.sleep_efficiency_percentage).toBe(94);
      console.log(`✓ Fetched ${sleeps.length} sleep sessions`);
      console.log(`  - Sleep 1: Performance ${sleeps[0].score.sleep_performance_percentage}%, Efficiency ${sleeps[0].score.sleep_efficiency_percentage}%`);
      console.log(`  - Duration: ${sleeps[0].score.stage_summary.total_in_bed_time_milli / 1000 / 60 / 60} hours`);
      console.log(`  - REM: ${sleeps[0].score.stage_summary.total_rem_sleep_time_milli / 1000 / 60} min, SWS: ${sleeps[0].score.stage_summary.total_slow_wave_sleep_time_milli / 1000 / 60} min`);

      // ==========================================
      // VERIFICATION
      // ==========================================
      console.log('\n=== VERIFICATION ===');
      console.log('✓ OAuth flow: PASSED');
      console.log('✓ Token storage: PASSED');
      console.log('✓ Cycle fetching: PASSED');
      console.log('✓ Recovery fetching: PASSED');
      console.log('✓ Sleep fetching: PASSED');
      console.log('✓ Data parsing: PASSED');
      console.log('✓ Classification: PASSED');
      console.log('\n🎉 FULL END-TO-END INTEGRATION: VERIFIED\n');

      // Verify all httpsRequest calls used proxy-aware implementation
      expect(mockHttpsRequest).toHaveBeenCalledTimes(4); // token + cycles + recoveries + sleeps
    });
  });

  describe('Proxy Integration Verification', () => {
    it('should verify all WHOOP requests go through httpsRequest (proxy-aware)', async () => {
      console.log('\n=== Proxy Integration Check ===');

      // Setup mock token
      mockTokens.push({
        provider: 'whoop',
        access_token_enc: 'encrypted_test_access_token',
        refresh_token_enc: 'encrypted_test_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      // Mock API responses
      mockHttpsRequest.mockResolvedValue({
        status: 200,
        data: JSON.stringify({ records: [], next_token: null }),
      });

      const client = new WhoopClient();
      const start = '2024-11-05T00:00:00Z';
      const end = '2024-11-07T00:00:00Z';
      await client.fetchCycles(start, end);
      await client.fetchRecoveries(start, end);
      await client.fetchSleeps(start, end);

      // Verify all calls went through httpsRequest (not fetch)
      expect(mockHttpsRequest).toHaveBeenCalledTimes(3);

      // Verify Bearer token authentication
      const callArgs = mockHttpsRequest.mock.calls;
      callArgs.forEach((call, index) => {
        expect(call[1]?.headers?.Authorization).toMatch(/^Bearer /);
        console.log(`✓ Request ${index + 1}: Used httpsRequest with Bearer token`);
      });

      console.log('✓ All requests use proxy-aware httpsRequest implementation\n');
    });
  });
});
