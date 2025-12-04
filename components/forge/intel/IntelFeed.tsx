'use client';

/**
 * IntelFeed Component
 * Daily personalized educational content feed with stat boosts
 * Aggregates curated articles, videos, and facts relevant to learning goals
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Newspaper, Video, Lightbulb, ExternalLink, CheckCircle,
  Clock, Target, Filter, TrendingUp, Star, ChevronDown
} from 'lucide-react';

export interface IntelItem {
  id: string;
  title: string;
  summary: string;
  content_type: 'article' | 'video' | 'fact' | 'quote' | 'challenge';
  source_name?: string;
  source_url?: string;
  image_url?: string;
  stat_primary?: string;
  stat_boost?: number;
  difficulty?: number;
  estimated_minutes?: number;
  tags?: string[];
  is_read: boolean;
  xp_value: number;
  published_at: number;
}

interface IntelFeedProps {
  items: IntelItem[];
  onReadItem: (itemId: string) => Promise<{ xp_earned: number }>;
  onRefresh?: () => Promise<void>;
  loading?: boolean;
}

type FilterType = 'all' | 'article' | 'video' | 'fact' | 'challenge';
type SortType = 'newest' | 'xp' | 'difficulty';

const contentTypeConfig: Record<string, { icon: typeof Newspaper; color: string; label: string }> = {
  article: { icon: Newspaper, color: '#3b82f6', label: 'Article' },
  video: { icon: Video, color: '#ef4444', label: 'Video' },
  fact: { icon: Lightbulb, color: '#f59e0b', label: 'Fun Fact' },
  quote: { icon: Star, color: '#a78bfa', label: 'Quote' },
  challenge: { icon: Target, color: '#10b981', label: 'Challenge' },
};

const statColors: Record<string, string> = {
  strength: '#ef4444',
  intelligence: '#3b82f6',
  wisdom: '#a78bfa',
  charisma: '#f59e0b',
  dexterity: '#10b981',
  constitution: '#ec4899',
};

export function IntelFeed({ items, onReadItem, onRefresh, loading }: IntelFeedProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    // Filter
    if (filter !== 'all') {
      result = result.filter((item) => item.content_type === filter);
    }

    // Sort
    switch (sortBy) {
      case 'xp':
        result.sort((a, b) => b.xp_value - a.xp_value);
        break;
      case 'difficulty':
        result.sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1));
        break;
      case 'newest':
      default:
        result.sort((a, b) => b.published_at - a.published_at);
    }

    return result;
  }, [items, filter, sortBy]);

  const unreadCount = useMemo(() => items.filter((i) => !i.is_read).length, [items]);

  const handleMarkRead = useCallback(async (item: IntelItem) => {
    if (item.is_read || markingRead) return;

    setMarkingRead(item.id);
    try {
      await onReadItem(item.id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setMarkingRead(null);
    }
  }, [onReadItem, markingRead]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>Daily Intel</h2>
          {unreadCount > 0 && (
            <span style={styles.unreadBadge}>{unreadCount} new</span>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={styles.filterToggle}
        >
          <Filter size={16} />
          Filter
          <ChevronDown
            size={14}
            style={{
              transform: showFilters ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Type:</span>
            <div style={styles.filterButtons}>
              {(['all', 'article', 'video', 'fact', 'challenge'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...styles.filterButton,
                    ...(filter === f ? styles.filterButtonActive : {}),
                  }}
                >
                  {f === 'all' ? 'All' : contentTypeConfig[f]?.label || f}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Sort:</span>
            <div style={styles.filterButtons}>
              {([
                { value: 'newest', label: 'Newest' },
                { value: 'xp', label: 'XP Value' },
                { value: 'difficulty', label: 'Difficulty' },
              ] as { value: SortType; label: string }[]).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  style={{
                    ...styles.filterButton,
                    ...(sortBy === s.value ? styles.filterButtonActive : {}),
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feed Items */}
      <div style={styles.feed}>
        {filteredAndSorted.length === 0 ? (
          <div style={styles.emptyState}>
            <Newspaper size={48} style={{ opacity: 0.3 }} />
            <h3>No Intel Available</h3>
            <p style={{ color: '#888' }}>
              {filter !== 'all'
                ? `No ${filter}s found. Try a different filter.`
                : 'Check back later for new content.'}
            </p>
          </div>
        ) : (
          filteredAndSorted.map((item) => {
            const config = contentTypeConfig[item.content_type] || contentTypeConfig.article;
            const Icon = config.icon;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  ...styles.card,
                  ...(item.is_read ? styles.cardRead : {}),
                }}
              >
                {/* Card Header */}
                <div style={styles.cardHeader}>
                  <div
                    style={{
                      ...styles.typeBadge,
                      background: `${config.color}20`,
                      color: config.color,
                    }}
                  >
                    <Icon size={14} />
                    {config.label}
                  </div>
                  <div style={styles.cardMeta}>
                    {item.estimated_minutes && (
                      <span style={styles.metaItem}>
                        <Clock size={12} />
                        {item.estimated_minutes}m
                      </span>
                    )}
                    <span style={styles.xpBadge}>+{item.xp_value} XP</span>
                  </div>
                </div>

                {/* Card Content */}
                <div
                  style={styles.cardContent}
                  onClick={() => toggleExpand(item.id)}
                >
                  {item.image_url && (
                    <div style={styles.thumbnail}>
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={styles.thumbnailImage}
                      />
                    </div>
                  )}
                  <div style={styles.cardText}>
                    <h3 style={styles.cardTitle}>{item.title}</h3>
                    <p style={styles.cardSummary}>
                      {isExpanded
                        ? item.summary
                        : item.summary.length > 120
                        ? `${item.summary.substring(0, 120)}...`
                        : item.summary}
                    </p>
                  </div>
                </div>

                {/* Stat Boost */}
                {item.stat_primary && item.stat_boost && (
                  <div style={styles.statBoost}>
                    <TrendingUp size={14} color={statColors[item.stat_primary] || '#888'} />
                    <span
                      style={{
                        color: statColors[item.stat_primary] || '#888',
                        textTransform: 'capitalize',
                      }}
                    >
                      {item.stat_primary}
                    </span>
                    <span style={styles.boostValue}>+{item.stat_boost}%</span>
                  </div>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div style={styles.tags}>
                    {item.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Actions */}
                <div style={styles.cardActions}>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.sourceLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={14} />
                      {item.source_name || 'Read More'}
                    </a>
                  )}
                  <button
                    onClick={() => handleMarkRead(item)}
                    disabled={item.is_read || markingRead === item.id}
                    style={{
                      ...styles.readButton,
                      ...(item.is_read ? styles.readButtonDone : {}),
                    }}
                  >
                    <CheckCircle size={16} />
                    {item.is_read ? 'Completed' : markingRead === item.id ? 'Saving...' : 'Mark Complete'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  unreadBadge: {
    padding: '0.25rem 0.625rem',
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#f59e0b',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  filterToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.875rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#ccc',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
    background: '#1a1a1a',
    borderRadius: '0.75rem',
    border: '1px solid #333',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: '0.75rem',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '40px',
  },
  filterButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  filterButton: {
    padding: '0.375rem 0.75rem',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '999px',
    color: '#888',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterButtonActive: {
    background: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    color: '#f59e0b',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    gap: '1rem',
    textAlign: 'center',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.75rem',
    transition: 'all 0.2s ease',
  },
  cardRead: {
    opacity: 0.6,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    color: '#888',
  },
  xpBadge: {
    padding: '0.25rem 0.5rem',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  cardContent: {
    display: 'flex',
    gap: '1rem',
    cursor: 'pointer',
  },
  thumbnail: {
    width: '80px',
    height: '60px',
    borderRadius: '0.375rem',
    overflow: 'hidden',
    flexShrink: 0,
    background: '#333',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    margin: '0 0 0.375rem 0',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.3,
  },
  cardSummary: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#888',
    lineHeight: 1.5,
  },
  statBoost: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: '#0f0f0f',
    borderRadius: '0.375rem',
    fontSize: '0.8125rem',
  },
  boostValue: {
    fontWeight: 600,
    color: '#fff',
    marginLeft: 'auto',
  },
  tags: {
    display: 'flex',
    gap: '0.375rem',
    flexWrap: 'wrap',
  },
  tag: {
    padding: '0.25rem 0.5rem',
    background: '#333',
    borderRadius: '999px',
    fontSize: '0.6875rem',
    color: '#888',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid #333',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  sourceLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: '0.8125rem',
  },
  readButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid #10b981',
    borderRadius: '0.5rem',
    color: '#10b981',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  readButtonDone: {
    background: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'transparent',
    cursor: 'default',
  },
};

export default IntelFeed;
