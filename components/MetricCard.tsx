/**
 * Wrath Shield v3 - Metric Card Component
 *
 * Reusable card component for displaying individual metrics with status colors.
 */

import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  value: number | string | null;
  unit?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
  compact?: boolean;
}

export default function MetricCard({
  title,
  value,
  unit,
  status = 'info',
  subtitle,
  compact = false,
}: MetricCardProps) {
  const displayValue = value !== null ? value : '--';

  return (
    <div className={`${styles.card} ${compact ? styles.compact : ''} ${styles[status]}`}>
      <div className={styles.title}>{title}</div>
      <div className={styles.value}>
        {displayValue}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
