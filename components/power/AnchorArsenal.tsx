/**
 * Wrath Shield v3 - AnchorArsenal Component
 *
 * Manages anchors (grounding memories) and notes related to bursts and flags.
 * Anchors are personal truths and affirmations stored in Mem0.
 */

'use client';

import React, { useState, useEffect } from 'react';

export interface AnchorMemory {
  id: string;
  text: string;
  category: string;
  date: string;
  metadata?: Record<string, any>;
}

export interface AnchorArsenalProps {
  /** Callback when an anchor is selected */
  onAnchorSelect?: (anchor: AnchorMemory) => void;
  /** Show only specific category (default: show all) */
  categoryFilter?: string;
  /** Additional CSS class name */
  className?: string;
}

interface AnchorStats {
  total: number;
  byCategory: Record<string, number>;
  recentCount: number; // Last 7 days
}

const ANCHOR_CATEGORIES = [
  'truth',
  'boundary',
  'strength',
  'affirmation',
  'insight',
  'other'
];

export default function AnchorArsenal({
  onAnchorSelect,
  categoryFilter,
  className = ''
}: AnchorArsenalProps) {
  const [anchors, setAnchors] = useState<AnchorMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFilter || null);
  const [isAddingAnchor, setIsAddingAnchor] = useState(false);
  const [newAnchorText, setNewAnchorText] = useState('');
  const [newAnchorCategory, setNewAnchorCategory] = useState('truth');

  useEffect(() => {
    fetchAnchors();
  }, []);

  const fetchAnchors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/anchors');
      if (!response.ok) {
        throw new Error('Failed to fetch anchors');
      }

      const data = await response.json();
      setAnchors(data.anchors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnchor = async () => {
    if (!newAnchorText.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/anchors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newAnchorText.trim(),
          category: newAnchorCategory,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add anchor');
      }

      // Reset form
      setNewAnchorText('');
      setNewAnchorCategory('truth');
      setIsAddingAnchor(false);

      // Refresh anchors
      fetchAnchors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add anchor');
    }
  };

  const calculateStats = (): AnchorStats => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const stats: AnchorStats = {
      total: anchors.length,
      byCategory: {},
      recentCount: 0
    };

    anchors.forEach(anchor => {
      // Count by category
      const cat = anchor.category || 'other';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // Count recent
      if (anchor.date >= sevenDaysAgoStr) {
        stats.recentCount++;
      }
    });

    return stats;
  };

  const getFilteredAnchors = (): AnchorMemory[] => {
    let filtered = anchors;

    // Filter by selected category
    if (selectedCategory) {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    // Sort by date descending (newest first)
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  };

  const stats = calculateStats();
  const filteredAnchors = getFilteredAnchors();

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'truth': return 'text-green';
      case 'boundary': return 'text-red';
      case 'strength': return 'text-purple-500';
      case 'affirmation': return 'text-blue-500';
      case 'insight': return 'text-yellow-500';
      default: return 'text-secondary';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'truth': return '✓';
      case 'boundary': return '⚔';
      case 'strength': return '⬢';
      case 'affirmation': return '✦';
      case 'insight': return '◆';
      default: return '•';
    }
  };

  if (loading) {
    return (
      <div className={`anchor-arsenal ${className}`}>
        <div className="loading-state">
          <p className="text-secondary">Loading anchors...</p>
        </div>
        <style jsx>{`
          .anchor-arsenal {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .loading-state {
            padding: 2rem;
            text-align: center;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`anchor-arsenal ${className}`}>
        <div className="error-state">
          <p className="text-red">Error: {error}</p>
          <button onClick={fetchAnchors} className="retry-button">
            Retry
          </button>
        </div>
        <style jsx>{`
          .anchor-arsenal {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .error-state {
            padding: 2rem;
            text-align: center;
          }
          .retry-button {
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background: transparent;
            border: 1px solid var(--green);
            color: var(--green);
            cursor: pointer;
            font-family: inherit;
          }
          .retry-button:hover {
            background: var(--green);
            color: var(--bg-primary);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`anchor-arsenal ${className}`}>
      {/* Statistics Overview */}
      <div className="stats-overview">
        <div className="stat-item">
          <span className="stat-label">Total Anchors</span>
          <span className="stat-value text-green">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Recent (7 days)</span>
          <span className="stat-value text-green">{stats.recentCount}</span>
        </div>
      </div>

      {/* Category Filters */}
      <div className="category-filters">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`category-button ${selectedCategory === null ? 'active' : ''}`}
          aria-label="Show all categories"
          aria-pressed={selectedCategory === null}
        >
          All ({stats.total})
        </button>
        {ANCHOR_CATEGORIES.map(cat => {
          const count = stats.byCategory[cat] || 0;
          if (count === 0) return null;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`category-button ${selectedCategory === cat ? 'active' : ''} ${getCategoryColor(cat)}`}
              aria-label={`Show ${cat} anchors`}
              aria-pressed={selectedCategory === cat}
            >
              {getCategoryIcon(cat)} {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Add Anchor Button */}
      <div className="actions">
        {!isAddingAnchor ? (
          <button
            onClick={() => setIsAddingAnchor(true)}
            className="add-anchor-button"
            aria-label="Add new anchor"
          >
            + Add Anchor
          </button>
        ) : (
          <div className="add-anchor-form">
            <select
              value={newAnchorCategory}
              onChange={(e) => setNewAnchorCategory(e.target.value)}
              className="category-select"
              aria-label="Anchor category"
            >
              {ANCHOR_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {getCategoryIcon(cat)} {cat}
                </option>
              ))}
            </select>
            <textarea
              value={newAnchorText}
              onChange={(e) => setNewAnchorText(e.target.value)}
              placeholder="Enter your anchor (truth, boundary, affirmation...)"
              className="anchor-input"
              rows={3}
              aria-label="Anchor text"
              autoFocus
            />
            <div className="form-actions">
              <button
                onClick={handleAddAnchor}
                className="save-button"
                disabled={!newAnchorText.trim()}
                aria-label="Save anchor"
              >
                Save Anchor
              </button>
              <button
                onClick={() => {
                  setIsAddingAnchor(false);
                  setNewAnchorText('');
                }}
                className="cancel-button"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Anchors List */}
      <div className="anchors-list">
        {filteredAnchors.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">
              {selectedCategory
                ? `No ${selectedCategory} anchors found.`
                : 'No anchors yet. Add your first anchor to begin building your arsenal.'}
            </p>
          </div>
        ) : (
          filteredAnchors.map(anchor => (
            <div
              key={anchor.id}
              className="anchor-item"
              onClick={() => onAnchorSelect?.(anchor)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAnchorSelect?.(anchor);
                }
              }}
              aria-label={`Anchor: ${anchor.text}`}
            >
              <div className="anchor-header">
                <span className={`anchor-category ${getCategoryColor(anchor.category)}`}>
                  {getCategoryIcon(anchor.category)} {anchor.category}
                </span>
                <span className="anchor-date">{anchor.date}</span>
              </div>
              <p className="anchor-text">{anchor.text}</p>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .anchor-arsenal {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          font-family: 'Courier New', monospace;
        }

        .stats-overview {
          display: flex;
          gap: 2rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .category-button {
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-primary);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .category-button:hover {
          border-color: var(--green);
        }

        .category-button.active {
          background: var(--bg-secondary);
          border-color: var(--green);
          box-shadow: 0 0 8px var(--green);
        }

        .category-button:focus-visible {
          outline: 2px solid var(--green);
          outline-offset: 2px;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .add-anchor-button {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: 1px solid var(--green);
          color: var(--green);
          cursor: pointer;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.2s;
          align-self: flex-start;
        }

        .add-anchor-button:hover {
          background: var(--green);
          color: var(--bg-primary);
        }

        .add-anchor-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
        }

        .category-select {
          padding: 0.5rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.875rem;
        }

        .anchor-input {
          padding: 0.75rem;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 1rem;
          resize: vertical;
        }

        .anchor-input:focus {
          outline: 2px solid var(--green);
          outline-offset: 2px;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
        }

        .save-button {
          padding: 0.5rem 1rem;
          background: var(--green);
          border: none;
          color: var(--bg-primary);
          cursor: pointer;
          font-family: inherit;
          font-weight: bold;
        }

        .save-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cancel-button {
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer;
          font-family: inherit;
        }

        .cancel-button:hover {
          border-color: var(--red);
          color: var(--red);
        }

        .anchors-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
        }

        .anchor-item {
          padding: 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: all 0.2s;
        }

        .anchor-item:hover {
          border-color: var(--green);
          box-shadow: 0 0 8px var(--green);
        }

        .anchor-item:focus-visible {
          outline: 2px solid var(--green);
          outline-offset: 2px;
        }

        .anchor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }

        .anchor-category {
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .anchor-date {
          color: var(--text-secondary);
        }

        .anchor-text {
          color: var(--text-primary);
          font-size: 1rem;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 768px) {
          .stats-overview {
            flex-direction: column;
            gap: 1rem;
          }

          .category-filters {
            flex-direction: column;
          }

          .category-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
