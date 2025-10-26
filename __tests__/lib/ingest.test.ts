/**
 * Wrath Shield v3 - Daily Ingestion and Summary Tests
 *
 * Tests for manipulation detection and daily summary composition
 */

import {
  analyzeLifelog,
  analyzeLifelogs,
  composeDailySummary,
  composeDailySummaries,
  type DailyData,
  type AnalyzedLifelog,
} from '@/lib/ingest';
import * as ManipulationDetector from '@/lib/ManipulationDetector';
import type { Recovery, Cycle, Sleep, Lifelog } from '@/lib/db/types';

// Mock ManipulationDetector
jest.mock('@/lib/ManipulationDetector', () => ({
  analyzeLifelogFromRaw: jest.fn(),
}));

describe('analyzeLifelog', () => {
  const mockAnalyzeLifelogFromRaw = ManipulationDetector.analyzeLifelogFromRaw as jest.MockedFunction<
    typeof ManipulationDetector.analyzeLifelogFromRaw
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should analyze a lifelog with raw JSON', () => {
    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Morning conversation',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": [{"speaker": "other", "text": "You are overreacting", "timestamp": "2025-01-31T10:00:00Z"}]}',
    };

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 1,
      wrath_deployed: 0,
      flags: [
        {
          timestamp: '2025-01-31T10:00:00Z',
          text: 'You are overreacting',
          tags: ['gaslighting'],
          severity: 3,
        },
      ],
    });

    const result = analyzeLifelog(lifelog);

    expect(result.lifelog).toBe(lifelog);
    expect(result.analysis.manipulation_count).toBe(1);
    expect(result.analysis.wrath_deployed).toBe(0);
    expect(mockAnalyzeLifelogFromRaw).toHaveBeenCalledWith(lifelog.raw_json);
  });

  it('should handle lifelog without raw_json', () => {
    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Empty conversation',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: null,
    };

    const result = analyzeLifelog(lifelog);

    expect(result.analysis.manipulation_count).toBe(0);
    expect(result.analysis.wrath_deployed).toBe(0);
    expect(result.analysis.flags).toEqual([]);
    expect(mockAnalyzeLifelogFromRaw).not.toHaveBeenCalled();
  });

  it('should analyze multiple lifelogs', () => {
    const lifelogs: Lifelog[] = [
      {
        id: 'lifelog_1',
        date: '2025-01-31',
        title: 'Morning',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: '{"contents": []}',
      },
      {
        id: 'lifelog_2',
        date: '2025-01-31',
        title: 'Afternoon',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: '{"contents": []}',
      },
    ];

    mockAnalyzeLifelogFromRaw
      .mockReturnValueOnce({ manipulation_count: 1, wrath_deployed: 0, flags: [] })
      .mockReturnValueOnce({ manipulation_count: 2, wrath_deployed: 1, flags: [] });

    const results = analyzeLifelogs(lifelogs);

    expect(results).toHaveLength(2);
    expect(results[0].analysis.manipulation_count).toBe(1);
    expect(results[1].analysis.manipulation_count).toBe(2);
  });
});

describe('composeDailySummary', () => {
  const mockAnalyzeLifelogFromRaw = ManipulationDetector.analyzeLifelogFromRaw as jest.MockedFunction<
    typeof ManipulationDetector.analyzeLifelogFromRaw
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should compose summary with all WHOOP metrics', () => {
    const recovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 78,
      hrv: 55,
      rhr: 62,
      spo2: 98,
      skin_temp: 72.5,
    };

    const cycle: Cycle = {
      id: 'cycle_1',
      date: '2025-01-31',
      strain: 12.4,
      kilojoules: 1500,
      avg_hr: 120,
      max_hr: 180,
    };

    const sleep: Sleep = {
      id: 'sleep_1',
      date: '2025-01-31',
      performance: 85,
      rem_min: 90,
      sws_min: 75,
      light_min: 180,
      respiration: 16,
      sleep_debt_min: 30,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      recovery,
      cycle,
      sleep,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.date).toBe('2025-01-31');
    expect(result.summary).toBe(
      '2025-01-31: Recovery 78%, Strain 12.4, Sleep 85%. No manipulative interactions detected.'
    );
    expect(result.metrics.recovery_score).toBe(78);
    expect(result.metrics.strain).toBe(12.4);
    expect(result.metrics.sleep_performance).toBe(85);
    expect(result.metrics.total_manipulations).toBe(0);
    expect(result.metrics.wrath_deployed).toBe(false);
  });

  it('should handle missing WHOOP data', () => {
    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toBe(
      '2025-01-31: No WHOOP data available. No manipulative interactions detected.'
    );
    expect(result.metrics.recovery_score).toBeNull();
    expect(result.metrics.strain).toBeNull();
    expect(result.metrics.sleep_performance).toBeNull();
  });

  it('should handle partial WHOOP data', () => {
    const recovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 45,
      hrv: null,
      rhr: null,
      spo2: null,
      skin_temp: null,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      recovery,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toBe(
      '2025-01-31: Recovery 45%. No manipulative interactions detected.'
    );
    expect(result.metrics.recovery_score).toBe(45);
    expect(result.metrics.strain).toBeNull();
    expect(result.metrics.sleep_performance).toBeNull();
  });

  it('should compose summary with manipulations detected', () => {
    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Morning conversation',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": []}',
    };

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 3,
      wrath_deployed: 0,
      flags: [],
    });

    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs: [lifelog],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toBe(
      '2025-01-31: No WHOOP data available. 3 manipulative phrases detected. No assertive boundary response detected.'
    );
    expect(result.metrics.total_manipulations).toBe(3);
    expect(result.metrics.wrath_deployed).toBe(false);
  });

  it('should compose summary with wrath deployed', () => {
    const recovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 78,
      hrv: null,
      rhr: null,
      spo2: null,
      skin_temp: null,
    };

    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Afternoon conversation',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": []}',
    };

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 2,
      wrath_deployed: 1,
      flags: [],
    });

    const dailyData: DailyData = {
      date: '2025-01-31',
      recovery,
      lifelogs: [lifelog],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toBe(
      '2025-01-31: Recovery 78%. 2 manipulative phrases detected. Deployed assertive boundaries in response.'
    );
    expect(result.metrics.total_manipulations).toBe(2);
    expect(result.metrics.wrath_deployed).toBe(true);
  });

  it('should handle single manipulation correctly', () => {
    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Evening conversation',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": []}',
    };

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 1,
      wrath_deployed: 0,
      flags: [],
    });

    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs: [lifelog],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('1 manipulative phrase detected');
    expect(result.metrics.total_manipulations).toBe(1);
  });

  it('should aggregate manipulations from multiple lifelogs', () => {
    const lifelogs: Lifelog[] = [
      {
        id: 'lifelog_1',
        date: '2025-01-31',
        title: 'Morning',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: '{"contents": []}',
      },
      {
        id: 'lifelog_2',
        date: '2025-01-31',
        title: 'Afternoon',
        manipulation_count: 0,
        wrath_deployed: 0,
        raw_json: '{"contents": []}',
      },
    ];

    mockAnalyzeLifelogFromRaw
      .mockReturnValueOnce({ manipulation_count: 2, wrath_deployed: 0, flags: [] })
      .mockReturnValueOnce({ manipulation_count: 3, wrath_deployed: 1, flags: [] });

    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs,
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('5 manipulative phrases detected');
    expect(result.metrics.total_manipulations).toBe(5);
    expect(result.metrics.wrath_deployed).toBe(true);
  });

  it('should round fractional metrics properly', () => {
    const recovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 78.7,
      hrv: null,
      rhr: null,
      spo2: null,
      skin_temp: null,
    };

    const sleep: Sleep = {
      id: 'sleep_1',
      date: '2025-01-31',
      performance: 84.3,
      rem_min: null,
      sws_min: null,
      light_min: null,
      respiration: null,
      sleep_debt_min: null,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      recovery,
      sleep,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('Recovery 79%');
    expect(result.summary).toContain('Sleep 84%');
  });

  it('should format strain with one decimal place', () => {
    const cycle: Cycle = {
      id: 'cycle_1',
      date: '2025-01-31',
      strain: 15.67,
      kilojoules: null,
      avg_hr: null,
      max_hr: null,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      cycle,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('Strain 15.7');
  });

  it('should include analyzed lifelogs in result', () => {
    const lifelog: Lifelog = {
      id: 'lifelog_1',
      date: '2025-01-31',
      title: 'Test',
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": []}',
    };

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 1,
      wrath_deployed: 0,
      flags: [
        {
          timestamp: '2025-01-31T10:00:00Z',
          text: 'Test manipulation',
          tags: ['gaslighting'],
          severity: 3,
        },
      ],
    });

    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs: [lifelog],
    };

    const result = composeDailySummary(dailyData);

    expect(result.analyzed_lifelogs).toHaveLength(1);
    expect(result.analyzed_lifelogs[0].lifelog).toBe(lifelog);
    expect(result.analyzed_lifelogs[0].analysis.flags).toHaveLength(1);
  });
});

describe('composeDailySummaries', () => {
  const mockAnalyzeLifelogFromRaw = ManipulationDetector.analyzeLifelogFromRaw as jest.MockedFunction<
    typeof ManipulationDetector.analyzeLifelogFromRaw
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 0,
      wrath_deployed: 0,
      flags: [],
    });
  });

  it('should compose summaries for multiple days', () => {
    const dailyDataArray: DailyData[] = [
      {
        date: '2025-01-30',
        recovery: { id: 'rec_1', date: '2025-01-30', score: 70, hrv: null, rhr: null, spo2: null, skin_temp: null },
        lifelogs: [],
      },
      {
        date: '2025-01-31',
        recovery: { id: 'rec_2', date: '2025-01-31', score: 80, hrv: null, rhr: null, spo2: null, skin_temp: null },
        lifelogs: [],
      },
    ];

    const results = composeDailySummaries(dailyDataArray);

    expect(results).toHaveLength(2);
    expect(results[0].date).toBe('2025-01-30');
    expect(results[1].date).toBe('2025-01-31');
    expect(results[0].summary).toContain('2025-01-30');
    expect(results[1].summary).toContain('2025-01-31');
  });

  it('should handle empty array', () => {
    const results = composeDailySummaries([]);

    expect(results).toEqual([]);
  });
});

describe('Edge Cases', () => {
  const mockAnalyzeLifelogFromRaw = ManipulationDetector.analyzeLifelogFromRaw as jest.MockedFunction<
    typeof ManipulationDetector.analyzeLifelogFromRaw
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle zero values in WHOOP metrics', () => {
    const recovery: Recovery = {
      id: 'rec_1',
      date: '2025-01-31',
      score: 0,
      hrv: 0,
      rhr: 0,
      spo2: 0,
      skin_temp: 0,
    };

    const cycle: Cycle = {
      id: 'cycle_1',
      date: '2025-01-31',
      strain: 0,
      kilojoules: 0,
      avg_hr: 0,
      max_hr: 0,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      recovery,
      cycle,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('Recovery 0%');
    expect(result.summary).toContain('Strain 0.0');
  });

  it('should handle very high strain values', () => {
    const cycle: Cycle = {
      id: 'cycle_1',
      date: '2025-01-31',
      strain: 21.5,
      kilojoules: null,
      avg_hr: null,
      max_hr: null,
    };

    const dailyData: DailyData = {
      date: '2025-01-31',
      cycle,
      lifelogs: [],
    };

    const result = composeDailySummary(dailyData);

    expect(result.summary).toContain('Strain 21.5');
  });

  it('should handle very large manipulation counts', () => {
    const lifelogs: Lifelog[] = Array.from({ length: 10 }, (_, i) => ({
      id: `lifelog_${i}`,
      date: '2025-01-31',
      title: `Conversation ${i}`,
      manipulation_count: 0,
      wrath_deployed: 0,
      raw_json: '{"contents": []}',
    }));

    mockAnalyzeLifelogFromRaw.mockReturnValue({
      manipulation_count: 5,
      wrath_deployed: 0,
      flags: [],
    });

    const dailyData: DailyData = {
      date: '2025-01-31',
      lifelogs,
    };

    const result = composeDailySummary(dailyData);

    expect(result.metrics.total_manipulations).toBe(50);
    expect(result.summary).toContain('50 manipulative phrases detected');
  });
});
