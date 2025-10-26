/**
 * Wrath Shield v3 - Today's Metrics Component
 *
 * Displays today's latest WHOOP data and lifelog summary.
 */

import MetricCard from './MetricCard';
import styles from './TodayMetrics.module.css';

interface TodayMetricsProps {
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
}

export default function TodayMetrics({ today }: TodayMetricsProps) {
  const hasWhoopData = today.recovery || today.cycle || today.sleep;

  return (
    <section className={styles.todaySection}>
      <h2>Today - {today.date}</h2>

      {!hasWhoopData && (
        <div className={styles.noData}>
          No WHOOP data available for today. Sync your WHOOP data to see metrics.
        </div>
      )}

      <div className={styles.metricsGrid}>
        {/* Recovery */}
        {today.recovery && (
          <MetricCard
            title="Recovery"
            value={today.recovery.score}
            unit="%"
            status={getRecoveryStatus(today.recovery.score)}
            subtitle={`HRV: ${today.recovery.hrv}ms | RHR: ${today.recovery.rhr}bpm`}
          />
        )}

        {/* Strain */}
        {today.cycle && (
          <MetricCard
            title="Strain"
            value={today.cycle.strain?.toFixed(1)}
            status={getStrainStatus(today.cycle.strain)}
            subtitle={`Avg HR: ${today.cycle.avg_hr}bpm | Max: ${today.cycle.max_hr}bpm`}
          />
        )}

        {/* Sleep */}
        {today.sleep && (
          <MetricCard
            title="Sleep Performance"
            value={today.sleep.performance}
            unit="%"
            status={getSleepStatus(today.sleep.performance)}
            subtitle={`${Math.round(
              (today.sleep.rem_min + today.sleep.sws_min + today.sleep.light_min) / 60
            )}h ${Math.round(
              (today.sleep.rem_min + today.sleep.sws_min + today.sleep.light_min) % 60
            )}m total`}
          />
        )}

        {/* Lifelogs */}
        <MetricCard
          title="Manipulation Detection"
          value={today.lifelogs.total_manipulations}
          unit={today.lifelogs.total_manipulations === 1 ? 'phrase' : 'phrases'}
          status={
            today.lifelogs.total_manipulations === 0
              ? 'success'
              : today.lifelogs.wrath_deployed
              ? 'warning'
              : 'danger'
          }
          subtitle={
            today.lifelogs.wrath_deployed
              ? '⚡ Wrath deployed'
              : today.lifelogs.count > 0
              ? `${today.lifelogs.count} lifelog${today.lifelogs.count === 1 ? '' : 's'} analyzed`
              : 'No lifelogs today'
          }
        />

        {/* Unbending Score */}
        {today.unbending_score !== null && (
          <MetricCard
            title="Unbending Score"
            value={today.unbending_score}
            unit="%"
            status={getUnbendingStatus(today.unbending_score)}
            subtitle="Assertiveness ratio"
          />
        )}
      </div>
    </section>
  );
}

// Helper functions for status determination
function getRecoveryStatus(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'warning';
  return 'danger';
}

function getStrainStatus(strain: number): 'success' | 'warning' | 'danger' {
  if (strain < 10) return 'success';
  if (strain <= 14) return 'warning';
  return 'danger';
}

function getSleepStatus(performance: number): 'success' | 'warning' | 'danger' {
  if (performance >= 85) return 'success';
  if (performance >= 70) return 'warning';
  return 'danger';
}

function getUnbendingStatus(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}
