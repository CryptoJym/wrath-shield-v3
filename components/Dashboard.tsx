'use client';

/**
 * Wrath Shield v3 - Dashboard Component
 *
 * Fetches and displays aggregated metrics from the /api/metrics endpoint.
 *
 * Displays:
 * - Today's latest metrics (recovery, cycle, sleep, lifelogs)
 * - 7-day aggregated trends
 * - 30-day aggregated trends
 * - Unbending score
 */

import { useEffect, useState } from 'react';
import TodayMetrics from './TodayMetrics';
import TrendsMetrics from './TrendsMetrics';
import AssuredHUD from './AssuredHUD';
import styles from './Dashboard.module.css';

interface MetricsResponse {
  today: {
    date: string;
    recovery: any;
    cycle: any;
    sleep: any;
    lifelogs: {
      count: number;
      total_manipulations: number;
      wrath_deployed: boolean;
    };
    unbending_score: number | null;
  };
  last7Days: {
    averages: {
      recovery_score: number | null;
      strain: number | null;
      sleep_performance: number | null;
    };
    totals: {
      manipulation_count: number;
      wrath_deployed: number;
    };
    unbending_score_avg: number | null;
  };
  last30Days: {
    averages: {
      recovery_score: number | null;
      strain: number | null;
      sleep_performance: number | null;
    };
    totals: {
      manipulation_count: number;
      wrath_deployed: number;
    };
    unbending_score_avg: number | null;
  };
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/metrics');

        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  if (loading) {
    return <div className="loading">Loading metrics...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!metrics) {
    return <div className="error">No metrics data available</div>;
  }

  return (
    <div className={styles.dashboard}>
      <TodayMetrics today={metrics.today} />

      <AssuredHUD />

      <div className={styles.trendsGrid}>
        <TrendsMetrics
          title="7-Day Trends"
          averages={metrics.last7Days.averages}
          totals={metrics.last7Days.totals}
          unbendingScore={metrics.last7Days.unbending_score_avg}
        />
        <TrendsMetrics
          title="30-Day Trends"
          averages={metrics.last30Days.averages}
          totals={metrics.last30Days.totals}
          unbendingScore={metrics.last30Days.unbending_score_avg}
        />
      </div>
    </div>
  );
}
