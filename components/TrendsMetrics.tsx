/**
 * Wrath Shield v3 - Trends Metrics Component
 *
 * Displays aggregated metrics over 7-day or 30-day periods.
 */

import MetricCard from './MetricCard';
import styles from './TrendsMetrics.module.css';

interface TrendsMetricsProps {
  title: string;
  averages: {
    recovery_score: number | null;
    strain: number | null;
    sleep_performance: number | null;
  };
  totals: {
    manipulation_count: number;
    wrath_deployed: number;
  };
  unbendingScore: number | null;
}

export default function TrendsMetrics({
  title,
  averages,
  totals,
  unbendingScore,
}: TrendsMetricsProps) {
  const hasData =
    averages.recovery_score !== null ||
    averages.strain !== null ||
    averages.sleep_performance !== null;

  return (
    <section className={styles.trendsSection}>
      <h3>{title}</h3>

      {!hasData && (
        <div className={styles.noData}>No data available for this period</div>
      )}

      <div className={styles.metricsGrid}>
        {/* Average Recovery */}
        {averages.recovery_score !== null && (
          <MetricCard
            title="Avg Recovery"
            value={averages.recovery_score}
            unit="%"
            status={getRecoveryStatus(averages.recovery_score)}
            compact
          />
        )}

        {/* Average Strain */}
        {averages.strain !== null && (
          <MetricCard
            title="Avg Strain"
            value={averages.strain.toFixed(1)}
            status={getStrainStatus(averages.strain)}
            compact
          />
        )}

        {/* Average Sleep */}
        {averages.sleep_performance !== null && (
          <MetricCard
            title="Avg Sleep"
            value={averages.sleep_performance}
            unit="%"
            status={getSleepStatus(averages.sleep_performance)}
            compact
          />
        )}

        {/* Manipulation Totals */}
        <MetricCard
          title="Manipulations"
          value={totals.manipulation_count}
          unit="total"
          status={totals.manipulation_count === 0 ? 'success' : 'warning'}
          subtitle={`⚡ Wrath: ${totals.wrath_deployed}x`}
          compact
        />

        {/* Unbending Score */}
        {unbendingScore !== null && (
          <MetricCard
            title="Unbending Score"
            value={unbendingScore}
            unit="%"
            status={getUnbendingStatus(unbendingScore)}
            compact
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
