/**
 * Wrath Shield v3 - AssuredHUD Component
 *
 * Displays comprehensive UIX (User Interface Experience) confidence metrics:
 * - Overall score as large dial/gauge
 * - Three pillar bars (Word, Action, Body)
 * - Delta indicator with trend arrow
 * - Top suggested fixes ("Raise Now" button)
 */

'use client';

import { useEffect, useState } from 'react';
import styles from './AssuredHUD.module.css';
import type { UIXMetrics } from '@/lib/metrics';

export default function AssuredHUD() {
  const [metrics, setMetrics] = useState<UIXMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUIXMetrics() {
      try {
        setLoading(true);
        const response = await fetch('/api/uix');

        if (!response.ok) {
          throw new Error(`Failed to fetch UIX metrics: ${response.statusText}`);
        }

        const data = await response.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching UIX metrics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchUIXMetrics();
    // Refresh metrics every minute
    const interval = setInterval(fetchUIXMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading UIX metrics...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error || 'Failed to load UIX metrics'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>AssuredHUD</h2>

      {/* Overall Score Dial */}
      <div className={styles.scoreSection}>
        <div className={styles.dialContainer}>
          <svg className={styles.dial} viewBox="0 0 200 200">
            {/* Background circle */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="20"
            />
            {/* Foreground arc (score) */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={getScoreColor(metrics.overall_score)}
              strokeWidth="20"
              strokeDasharray={`${(metrics.overall_score / 100) * 502.65} 502.65`}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
            />
            {/* Score text */}
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.scoreText}
              fill={getScoreColor(metrics.overall_score)}
            >
              {metrics.overall_score}
            </text>
          </svg>

          {/* Delta Indicator */}
          <div className={styles.deltaIndicator}>
            {metrics.delta !== 0 && (
              <>
                <span className={metrics.delta > 0 ? styles.deltaUp : styles.deltaDown}>
                  {metrics.delta > 0 ? '↑' : '↓'}
                </span>
                <span className={styles.deltaValue}>
                  {Math.abs(metrics.delta)}
                </span>
              </>
            )}
            {metrics.delta === 0 && (
              <span className={styles.deltaZero}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Three Pillar Bars */}
      <div className={styles.pillarsSection}>
        <h3 className={styles.pillarsTitle}>Confidence Pillars</h3>

        <div className={styles.pillarRow}>
          <div className={styles.pillarLabel}>
            <span className={styles.pillarName}>Word</span>
            <span className={styles.pillarWeight}>(40%)</span>
          </div>
          <div className={styles.pillarBarContainer}>
            <div
              className={styles.pillarBar}
              style={{
                width: `${metrics.pillars.word}%`,
                backgroundColor: getPillarColor(metrics.pillars.word),
              }}
            />
          </div>
          <span className={styles.pillarValue}>{metrics.pillars.word}</span>
        </div>

        <div className={styles.pillarRow}>
          <div className={styles.pillarLabel}>
            <span className={styles.pillarName}>Action</span>
            <span className={styles.pillarWeight}>(40%)</span>
          </div>
          <div className={styles.pillarBarContainer}>
            <div
              className={styles.pillarBar}
              style={{
                width: `${metrics.pillars.action}%`,
                backgroundColor: getPillarColor(metrics.pillars.action),
              }}
            />
          </div>
          <span className={styles.pillarValue}>{metrics.pillars.action}</span>
        </div>

        <div className={styles.pillarRow}>
          <div className={styles.pillarLabel}>
            <span className={styles.pillarName}>Body</span>
            <span className={styles.pillarWeight}>(20%)</span>
          </div>
          <div className={styles.pillarBarContainer}>
            <div
              className={styles.pillarBar}
              style={{
                width: `${metrics.pillars.body}%`,
                backgroundColor: getPillarColor(metrics.pillars.body),
              }}
            />
          </div>
          <span className={styles.pillarValue}>{metrics.pillars.body}</span>
        </div>
      </div>

      {/* Open Flags Count */}
      {metrics.open_flags > 0 && (
        <div className={styles.flagsSection}>
          <div className={styles.flagsWarning}>
            ⚠️ {metrics.open_flags} open {metrics.open_flags === 1 ? 'flag' : 'flags'}
          </div>
        </div>
      )}

      {/* Top Fixes / Raise Now Button */}
      {metrics.top_fixes.length > 0 && (
        <div className={styles.fixesSection}>
          <h3 className={styles.fixesTitle}>Suggested Improvements</h3>
          <div className={styles.fixesList}>
            {metrics.top_fixes.map((fix, index) => (
              <div key={fix.flag_id} className={styles.fixItem}>
                <div className={styles.fixHeader}>
                  <span className={styles.fixNumber}>#{index + 1}</span>
                  <span className={styles.fixLift}>+{fix.suggested_lift} points</span>
                </div>
                <div className={styles.fixText}>{fix.original_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Penalties Info (for observability) */}
      <div className={styles.metaInfo}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Recency Factor:</span>
          <span className={styles.metaValue}>
            {(metrics.penalties.recency_factor * 100).toFixed(0)}%
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Open Flag Penalty:</span>
          <span className={styles.metaValue}>-{metrics.penalties.open_flags_penalty}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper Functions
 */

function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--color-success)';
  if (score >= 40) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function getPillarColor(score: number): string {
  if (score >= 70) return 'var(--color-success)';
  if (score >= 40) return 'var(--color-warning)';
  return 'var(--color-danger)';
}
