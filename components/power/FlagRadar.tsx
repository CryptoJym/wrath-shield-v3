/**
 * Wrath Shield v3 - FlagRadar Component
 *
 * Visualizes manipulation flags with severity levels and categories.
 * Color coding: red for pending/threat, green for resolved/deploy.
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { Flag } from '@/lib/db/types';

export interface FlagRadarProps {
  /** Callback when a flag is selected */
  onFlagSelect?: (flag: Flag) => void;
  /** Show only pending flags (default: false shows all) */
  pendingOnly?: boolean;
  /** Additional CSS class name */
  className?: string;
}

interface FlagStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
  bySeverity: Record<number, number>;
  byType: Record<string, number>;
}

export default function FlagRadar({
  onFlagSelect,
  pendingOnly = false,
  className = ''
}: FlagRadarProps) {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, [pendingOnly]);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/flags');
      if (!response.ok) {
        throw new Error('Failed to fetch flags');
      }

      const data = await response.json();
      const allFlags = data.flags || [];

      // Filter based on pendingOnly prop
      const filteredFlags = pendingOnly
        ? allFlags.filter((f: Flag) => f.status === 'pending')
        : allFlags;

      setFlags(filteredFlags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (): FlagStats => {
    const stats: FlagStats = {
      total: flags.length,
      pending: 0,
      resolved: 0,
      dismissed: 0,
      bySeverity: {},
      byType: {},
    };

    flags.forEach(flag => {
      // Count by status
      if (flag.status === 'pending') stats.pending++;
      else if (flag.status === 'resolved') stats.resolved++;
      else if (flag.status === 'dismissed') stats.dismissed++;

      // Count by severity
      stats.bySeverity[flag.severity] = (stats.bySeverity[flag.severity] || 0) + 1;

      // Count by type (include unknown)
      const type = flag.manipulation_type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  };

  const getFilteredFlags = (): Flag[] => {
    return flags.filter(flag => {
      if (selectedSeverity !== null && flag.severity !== selectedSeverity) {
        return false;
      }
      if (selectedType !== null && flag.manipulation_type !== selectedType) {
        return false;
      }
      return true;
    });
  };

  const getSeverityColor = (severity: number): string => {
    if (severity >= 4) return 'var(--color-danger)';
    if (severity === 3) return 'var(--color-warning)';
    return 'var(--color-info)';
  };

  const getStatusColor = (status: string): string => {
    if (status === 'pending') return 'var(--color-danger)';
    if (status === 'resolved') return 'var(--color-success)';
    return 'var(--color-text-muted)';
  };

  const formatDate = (timestamp: number): string => {
    // Accept milliseconds or seconds
    const millis = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
    const then = new Date(millis);
    const diffMs = Date.now() - millis;
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

    if (diffHours < 24) {
      const label = diffHours === 1 ? 'hour' : 'hours';
      return `${diffHours} ${label} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      const label = diffDays === 1 ? 'day' : 'days';
      return `${diffDays} ${label} ago`;
    }
    // ISO (YYYY-MM-DD)
    return then.toISOString().slice(0, 10);
  };

  const handleFlagClick = (flag: Flag) => {
    if (onFlagSelect) {
      onFlagSelect(flag);
    }
  };

  const handleSeverityFilter = (severity: number) => {
    setSelectedSeverity(selectedSeverity === severity ? null : severity);
  };

  const handleTypeFilter = (type: string) => {
    setSelectedType(selectedType === type ? null : type);
  };

  if (loading) {
    return (
      <div className={`flag-radar ${className}`} role="status" aria-live="polite">
        <div className="loading">Loading flags...</div>
        <style jsx>{`
          .flag-radar {
            padding: var(--spacing-md);
            background-color: var(--color-bg-card);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
          }
          .loading {
            text-align: center;
            color: var(--color-text-secondary);
            padding: var(--spacing-lg);
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flag-radar ${className}`} role="alert">
        <div className="error">Error: {error}</div>
        <button className="retry-button" onClick={fetchFlags} aria-label="Retry">Retry</button>
        <style jsx>{`
          .flag-radar {
            padding: var(--spacing-md);
            background-color: var(--color-bg-card);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
          }
          .error {
            padding: var(--spacing-md);
            background-color: rgba(239, 68, 68, 0.1);
            border: 1px solid var(--color-danger);
            border-radius: var(--radius-sm);
            color: var(--color-danger);
          }
          .retry-button {
            margin-top: var(--spacing-sm);
            padding: var(--spacing-xs) var(--spacing-sm);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            background: var(--color-bg-secondary);
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  // Explicit empty state
  if (!loading && !error && flags.length === 0) {
    return (
      <div className={`flag-radar ${className}`} role="region" aria-label="Flag Radar">
        <div className="empty">No flags detected yet</div>
        <style jsx>{`
          .flag-radar {
            padding: var(--spacing-md);
            background-color: var(--color-bg-card);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
          }
          .empty {
            text-align: center;
            color: var(--color-text-muted);
            padding: var(--spacing-lg);
            font-style: italic;
          }
        `}</style>
      </div>
    );
  }

  const stats = calculateStats();
  const filteredFlags = getFilteredFlags();

  return (
    <div className={`flag-radar ${className}`} role="region" aria-label="Flag Radar">
      {/* Statistics Overview */}
      <div className="stats-overview">
        <h2 className="stats-title">Flag Distribution</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Flags</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card resolved">
            <div className="stat-value">{stats.resolved}</div>
            <div className="stat-label">Resolved</div>
          </div>
          <div className="stat-card dismissed">
            <div className="stat-value">{stats.dismissed}</div>
            <div className="stat-label">Dismissed</div>
          </div>
        </div>
      </div>

      {/* Severity Filters */}
      <div className="filters-section">
        <h3 className="filter-title">Filter by Severity</h3>
        <div className="severity-filters" role="group" aria-label="Severity filters">
          {/* All button */}
          <button
            onClick={() => setSelectedSeverity(null)}
            className={`severity-button ${selectedSeverity === null ? 'active' : ''}`}
            aria-pressed={selectedSeverity === null}
          >
            <span className="severity-label">All</span>
            <span className="severity-count">({stats.total})</span>
          </button>
          {[1, 2, 3, 4, 5].map(severity => (
            <button
              key={severity}
              onClick={() => handleSeverityFilter(severity)}
              className={`severity-button ${selectedSeverity === severity ? 'active' : ''}`}
              style={{
                borderColor: getSeverityColor(severity),
                backgroundColor: selectedSeverity === severity ? getSeverityColor(severity) : 'transparent',
                color: selectedSeverity === severity ? 'var(--color-bg-primary)' : getSeverityColor(severity)
              }}
              aria-pressed={selectedSeverity === severity}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSeverityFilter(severity);
                }
              }}
            >
              <span className="severity-label">{severity}</span>
              <span className="severity-count">({stats.bySeverity[severity] || 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Manipulation Type Filters */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="filters-section">
          <h3 className="filter-title">Filter by Type</h3>
          <div className="type-filters" role="group" aria-label="Manipulation type filters">
            {Object.entries(stats.byType).map(([type, count]) => (
              <button
                key={type}
                onClick={() => handleTypeFilter(type)}
                className={`type-button ${selectedType === type ? 'active' : ''}`}
                aria-pressed={selectedType === type}
              >
                <span className="type-label">{type}</span>
                <span className="type-count">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Flag List */}
      <div className="flags-section">
        <div className="flags-header">
          <h3 className="flags-title">
            {filteredFlags.length === flags.length
              ? `All Flags (${filteredFlags.length})`
              : `Filtered Flags (${filteredFlags.length} of ${flags.length})`
            }
          </h3>
          {(selectedSeverity !== null || selectedType !== null) && (
            <button
              onClick={() => {
                setSelectedSeverity(null);
                setSelectedType(null);
              }}
              className="clear-filters"
              aria-label="Clear all filters"
            >
              Clear Filters
            </button>
          )}
        </div>

        {filteredFlags.length === 0 ? (
          <div className="no-flags">No flags match the selected filters.</div>
        ) : (
          <ul className="flags-list" role="list">
            {filteredFlags.map(flag => (
              <li
                key={flag.id}
                className="flag-item"
                role="button"
                tabIndex={0}
                aria-label={`Flag: ${flag.manipulation_type || 'unknown'}`}
                onClick={() => handleFlagClick(flag)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleFlagClick(flag);
                  }
                }}
              >
                <div className="flag-button">
                  <div className="flag-header">
                    <div
                      className="flag-severity"
                      style={{ backgroundColor: getSeverityColor(flag.severity) }}
                      aria-label={`Severity ${flag.severity}`}
                    >
                      {flag.severity}
                    </div>
                    <span className="sr-only">Severity: {flag.severity}</span>
                    <div
                      className="flag-status"
                      style={{ color: getStatusColor(flag.status) }}
                    >
                      {flag.status}
                    </div>
                    <span className="sr-only">Status: {flag.status}</span>
                    <div className="flag-time">{formatDate(flag.detected_at)}</div>
                  </div>
                  <div className="flag-text">{flag.original_text}</div>
                  <div className="flag-type">{flag.manipulation_type || 'unknown'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .flag-radar {
          padding: var(--spacing-md);
          background-color: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }

        .stats-overview {
          margin-bottom: var(--spacing-lg);
        }

        .stats-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: var(--spacing-sm);
          color: var(--color-text-primary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: var(--spacing-sm);
        }

        .stat-card {
          padding: var(--spacing-sm);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          text-align: center;
        }

        .stat-card.pending {
          border-left: 3px solid var(--color-danger);
        }

        .stat-card.resolved {
          border-left: 3px solid var(--color-success);
        }

        .stat-card.dismissed {
          border-left: 3px solid var(--color-text-muted);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          margin-top: var(--spacing-xs);
        }

        .filters-section {
          margin-bottom: var(--spacing-lg);
        }

        .filter-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: var(--spacing-sm);
          color: var(--color-text-secondary);
        }

        .severity-filters,
        .type-filters {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-xs);
        }

        .severity-button,
        .type-button {
          padding: var(--spacing-xs) var(--spacing-sm);
          border: 2px solid;
          border-radius: var(--radius-sm);
          background-color: transparent;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .severity-button:hover,
        .type-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .severity-button:focus,
        .type-button:focus {
          outline: 2px solid var(--color-info);
          outline-offset: 2px;
        }

        .severity-label,
        .type-label {
          font-size: 0.875rem;
        }

        .severity-count,
        .type-count {
          font-size: 0.75rem;
          opacity: 0.8;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .type-button {
          border-color: var(--color-border);
          color: var(--color-text-primary);
        }

        .type-button.active {
          background-color: var(--color-info);
          border-color: var(--color-info);
          color: var(--color-bg-primary);
        }

        .flags-section {
          margin-top: var(--spacing-lg);
        }

        .flags-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-sm);
        }

        .flags-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .clear-filters {
          padding: var(--spacing-xs) var(--spacing-sm);
          background-color: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .clear-filters:hover {
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }

        .clear-filters:focus {
          outline: 2px solid var(--color-info);
          outline-offset: 2px;
        }

        .no-flags {
          padding: var(--spacing-lg);
          text-align: center;
          color: var(--color-text-muted);
          font-style: italic;
        }

        .flags-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .flag-item {
          margin: 0;
        }

        .flag-button {
          width: 100%;
          padding: var(--spacing-sm);
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .flag-button:hover {
          background-color: var(--color-bg-primary);
          border-color: var(--color-info);
          transform: translateX(4px);
        }

        .flag-button:focus {
          outline: 2px solid var(--color-info);
          outline-offset: 2px;
        }

        .flag-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xs);
        }

        .flag-severity {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--color-bg-primary);
        }

        .flag-status {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .flag-time {
          margin-left: auto;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .flag-text {
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-xs);
          line-height: 1.4;
        }

        .flag-type {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          font-style: italic;
        }

        @media (max-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .severity-filters,
          .type-filters {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
