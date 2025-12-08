'use client';

/**
 * Temporal Map - Communication Density Visualization
 *
 * A heatmap/timeline component showing communication density over time.
 * Similar to GitHub's contribution graph - color intensity represents
 * communication volume for each time period.
 *
 * Features:
 * - Heatmap grid view (weeks x days)
 * - Clickable cells to view messages from that period
 * - Aggregation by hour/day
 * - Powered by Zep temporal graph data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TemporalBucket {
  date: string; // ISO date string (YYYY-MM-DD)
  hour?: number; // 0-23 for hourly view
  count: number;
  sources: Record<string, number>;
  classifications: Record<string, number>;
}

interface TemporalData {
  buckets: TemporalBucket[];
  range: {
    start: string;
    end: string;
  };
  totals: {
    total: number;
    bySource: Record<string, number>;
    byClassification: Record<string, number>;
  };
  granularity: 'hour' | 'day';
}

interface MessagePreview {
  id: string;
  source: string;
  channel: string;
  subject: string | null;
  preview: string | null;
  ts: number;
  classification: string | null;
  contact: string | null;
}

interface TemporalDetailResponse {
  date: string;
  hour?: number;
  messages: MessagePreview[];
  total: number;
}

// ============================================================================
// Constants
// ============================================================================

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Color intensity levels (cyan accent theme)
const INTENSITY_COLORS = [
  'bg-slate-800/50', // 0 - no activity
  'bg-cyan-900/40', // 1 - low
  'bg-cyan-800/50', // 2 - medium-low
  'bg-cyan-700/60', // 3 - medium
  'bg-cyan-600/70', // 4 - medium-high
  'bg-cyan-500/80', // 5 - high
  'bg-cyan-400/90', // 6 - very high
];

// ============================================================================
// Helpers
// ============================================================================

function getIntensityLevel(count: number, maxCount: number): number {
  if (count === 0) return 0;
  if (maxCount === 0) return 1;
  const ratio = count / maxCount;
  if (ratio < 0.1) return 1;
  if (ratio < 0.25) return 2;
  if (ratio < 0.4) return 3;
  if (ratio < 0.6) return 4;
  if (ratio < 0.8) return 5;
  return 6;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  const now = Date.now();
  const diff = now - ts * 1000;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeeksArray(data: TemporalData): TemporalBucket[][] {
  if (!data.buckets.length) return [];

  // Create a map for quick lookup
  const bucketMap = new Map<string, TemporalBucket>();
  for (const bucket of data.buckets) {
    bucketMap.set(bucket.date, bucket);
  }

  // Generate all dates in range
  const startDate = new Date(data.range.start);
  const endDate = new Date(data.range.end);

  // Adjust start to beginning of week (Sunday)
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());

  const weeks: TemporalBucket[][] = [];
  let currentWeek: TemporalBucket[] = [];
  const current = new Date(adjustedStart);

  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const bucket = bucketMap.get(dateStr) || {
      date: dateStr,
      count: 0,
      sources: {},
      classifications: {},
    };

    currentWeek.push(bucket);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    current.setDate(current.getDate() + 1);
  }

  // Add remaining days
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      const dateStr = current.toISOString().split('T')[0];
      currentWeek.push({
        date: dateStr,
        count: 0,
        sources: {},
        classifications: {},
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function getMonthLabels(weeks: TemporalBucket[][]): { month: string; weekIndex: number }[] {
  const labels: { month: string; weekIndex: number }[] = [];
  let lastMonth = -1;

  weeks.forEach((week, weekIndex) => {
    const firstDay = new Date(week[0].date);
    const month = firstDay.getMonth();

    if (month !== lastMonth) {
      labels.push({ month: MONTHS[month], weekIndex });
      lastMonth = month;
    }
  });

  return labels;
}

// ============================================================================
// Components
// ============================================================================

interface CellProps {
  bucket: TemporalBucket;
  maxCount: number;
  onClick: (bucket: TemporalBucket) => void;
  isSelected: boolean;
}

function HeatmapCell({ bucket, maxCount, onClick, isSelected }: CellProps) {
  const level = getIntensityLevel(bucket.count, maxCount);
  const color = INTENSITY_COLORS[level];
  const isToday = bucket.date === new Date().toISOString().split('T')[0];

  return (
    <button
      onClick={() => onClick(bucket)}
      className={`
        w-3 h-3 rounded-sm transition-all duration-150
        ${color}
        ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950' : ''}
        ${isToday ? 'ring-1 ring-amber-500' : ''}
        hover:ring-1 hover:ring-slate-500
      `}
      title={`${formatDate(bucket.date)}: ${bucket.count} messages`}
    />
  );
}

interface LegendProps {
  maxCount: number;
}

function HeatmapLegend({ maxCount }: LegendProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span>Less</span>
      <div className="flex gap-0.5">
        {INTENSITY_COLORS.map((color, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${color}`} />
        ))}
      </div>
      <span>More</span>
      {maxCount > 0 && <span className="ml-2 text-slate-500">(max: {maxCount})</span>}
    </div>
  );
}

interface DetailPanelProps {
  bucket: TemporalBucket | null;
  messages: MessagePreview[];
  loading: boolean;
  onClose: () => void;
}

function DetailPanel({ bucket, messages, loading, onClose }: DetailPanelProps) {
  if (!bucket) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{formatDate(bucket.date)}</h4>
          <p className="text-xs text-slate-400">{bucket.count} communications</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Source breakdown */}
      {Object.keys(bucket.sources).length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">By Source</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(bucket.sources)
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => (
                <span key={source} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-300">
                  {source}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Messages list */}
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Messages</div>
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">No messages found for this period</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="p-2 rounded bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm text-slate-200 font-medium truncate flex-1">
                  {msg.subject || msg.preview?.slice(0, 50) || '(no subject)'}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">{formatTimestamp(msg.ts)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-cyan-400">{msg.source}</span>
                {msg.contact && <span className="text-slate-500">{msg.contact}</span>}
                {msg.classification && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{msg.classification}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StatsSummaryProps {
  totals: TemporalData['totals'];
}

function StatsSummary({ totals }: StatsSummaryProps) {
  const topSources = Object.entries(totals.bySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topClassifications = Object.entries(totals.byClassification)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {/* Total count */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-3xl font-bold text-cyan-400">{totals.total.toLocaleString()}</div>
        <div className="text-sm text-slate-400">Total Communications</div>
      </div>

      {/* Top sources */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top Sources</div>
        <div className="space-y-1">
          {topSources.map(([source, count]) => (
            <div key={source} className="flex justify-between text-sm">
              <span className="text-slate-300">{source}</span>
              <span className="text-slate-500">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top classifications */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Top Categories</div>
        <div className="space-y-1">
          {topClassifications.map(([cls, count]) => (
            <div key={cls} className="flex justify-between text-sm">
              <span className="text-slate-300">{cls}</span>
              <span className="text-slate-500">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface TemporalMapProps {
  days?: number; // Number of days to show (default: 90)
  className?: string;
}

export function TemporalMap({ days = 90, className = '' }: TemporalMapProps) {
  const [data, setData] = useState<TemporalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<TemporalBucket | null>(null);
  const [detailMessages, setDetailMessages] = useState<MessagePreview[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch temporal data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/comms/temporal?days=${days}`);
      if (!res.ok) throw new Error('Failed to load temporal data');

      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Fetch messages for selected bucket
  const loadBucketDetails = useCallback(async (bucket: TemporalBucket) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/comms/temporal?date=${bucket.date}&detail=true`);
      if (!res.ok) throw new Error('Failed to load messages');

      const json: TemporalDetailResponse = await res.json();
      setDetailMessages(json.messages);
    } catch (e) {
      console.error('Failed to load bucket details:', e);
      setDetailMessages([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Handle cell click
  const handleCellClick = useCallback(
    (bucket: TemporalBucket) => {
      if (selectedBucket?.date === bucket.date) {
        // Toggle off if clicking same cell
        setSelectedBucket(null);
        setDetailMessages([]);
      } else {
        setSelectedBucket(bucket);
        if (bucket.count > 0) {
          loadBucketDetails(bucket);
        } else {
          setDetailMessages([]);
        }
      }
    },
    [selectedBucket, loadBucketDetails]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute weeks and max count
  const { weeks, maxCount, monthLabels } = useMemo(() => {
    if (!data) return { weeks: [], maxCount: 0, monthLabels: [] };

    const w = getWeeksArray(data);
    const max = Math.max(...data.buckets.map((b) => b.count), 0);
    const labels = getMonthLabels(w);

    return { weeks: w, maxCount: max, monthLabels: labels };
  }, [data]);

  // Loading state
  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-6 ${className}`}>
        <div className="h-6 bg-slate-700 rounded w-1/4 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex gap-1">
              {[...Array(13)].map((_, j) => (
                <div key={j} className="w-3 h-3 bg-slate-800 rounded-sm animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-2xl border border-red-800 bg-red-900/20 p-6 ${className}`}>
        <p className="text-red-300 font-medium mb-2">Failed to load temporal map</p>
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 rounded-lg text-red-200 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={className}>
      {/* Stats summary */}
      <StatsSummary totals={data.totals} />

      {/* Heatmap card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Temporal Map</h3>
            <p className="text-sm text-slate-400">Communication density over {days} days</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Month labels */}
        <div className="flex mb-1 ml-8">
          {monthLabels.map(({ month, weekIndex }, i) => (
            <div
              key={`${month}-${i}`}
              className="text-xs text-slate-500"
              style={{
                marginLeft: i === 0 ? `${weekIndex * 14}px` : `${(weekIndex - (monthLabels[i - 1]?.weekIndex || 0)) * 14 - 20}px`,
              }}
            >
              {month}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] mr-2">
            {DAYS_OF_WEEK.map((day, i) => (
              <div key={day} className="h-3 text-xs text-slate-500 leading-3">
                {i % 2 === 1 ? day : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-[2px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[2px]">
                {week.map((bucket, dayIndex) => (
                  <HeatmapCell
                    key={`${weekIndex}-${dayIndex}`}
                    bucket={bucket}
                    maxCount={maxCount}
                    onClick={handleCellClick}
                    isSelected={selectedBucket?.date === bucket.date}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-end">
          <HeatmapLegend maxCount={maxCount} />
        </div>

        {/* Detail panel */}
        <DetailPanel
          bucket={selectedBucket}
          messages={detailMessages}
          loading={detailLoading}
          onClose={() => {
            setSelectedBucket(null);
            setDetailMessages([]);
          }}
        />
      </div>
    </div>
  );
}

export default TemporalMap;
