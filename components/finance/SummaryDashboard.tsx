'use client';

import { DollarSign, TrendingUp, TrendingDown, Hash, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

type BucketStats = {
  bucket: string;
  total: number;
  count: number;
};

interface SummaryDashboardProps {
  cycleLabel: string;
  totalReimbursable: number;
  totalSpent: number;
  transactionCount: number;
  previousReimbursable?: number;
  previousSpent?: number;
  previousCount?: number;
  bucketStats: BucketStats[];
  isLoading?: boolean;
}

const BUCKET_LABELS: Record<string, { label: string; color: string }> = {
  work_reimbursable: { label: 'Work Reimbursable', color: 'emerald' },
  personal_ai: { label: 'Personal AI', color: 'blue' },
  family: { label: 'Family', color: 'purple' },
  entertainment: { label: 'Entertainment', color: 'amber' },
  other: { label: 'Other', color: 'slate' },
  unknown: { label: 'Uncategorized', color: 'red' },
};

function DeltaIndicator({ current, previous, isInverted = false }: { current: number; previous?: number; isInverted?: boolean }) {
  if (previous === undefined || previous === 0) return null;

  const delta = current - previous;
  const percentage = ((delta / previous) * 100).toFixed(0);
  const isPositive = delta > 0;
  const isGood = isInverted ? !isPositive : isPositive;

  if (Math.abs(delta) < 0.01) {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Minus className="w-3 h-3" />
        No change
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? '+' : ''}{percentage}% vs prev
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  delta,
  previous,
  isInverted,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number;
  previous?: number;
  isInverted?: boolean;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'text-purple-400' },
    slate: { bg: 'bg-slate-500/10', text: 'text-slate-200', icon: 'text-slate-400' },
  };

  const colors = colorClasses[color] || colorClasses.slate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 ${colors.bg} rounded-lg`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        {subtitle && (
          <span className="text-xs text-slate-500 uppercase tracking-wider">{subtitle}</span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
      {delta !== undefined && previous !== undefined && (
        <div className="mt-2">
          <DeltaIndicator current={delta} previous={previous} isInverted={isInverted} />
        </div>
      )}
    </motion.div>
  );
}

function BucketBar({ bucket, total, maxTotal }: { bucket: string; total: number; maxTotal: number }) {
  const config = BUCKET_LABELS[bucket] || BUCKET_LABELS.other;
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  const barColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    slate: 'bg-slate-500',
    red: 'bg-red-500',
  };

  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400',
    red: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${textColors[config.color] || 'text-slate-400'}`}>
          {config.label}
        </span>
        <span className="text-sm text-slate-300 font-medium">
          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${barColors[config.color] || 'bg-slate-500'}`}
        />
      </div>
    </div>
  );
}

export function SummaryDashboard({
  cycleLabel,
  totalReimbursable,
  totalSpent,
  transactionCount,
  previousReimbursable,
  previousSpent,
  previousCount,
  bucketStats,
  isLoading,
}: SummaryDashboardProps) {
  const maxBucketTotal = Math.max(...bucketStats.map(b => Math.abs(b.total)), 1);

  // Sort buckets: work_reimbursable first, then by total descending
  const sortedBuckets = [...bucketStats].sort((a, b) => {
    if (a.bucket === 'work_reimbursable') return -1;
    if (b.bucket === 'work_reimbursable') return 1;
    return Math.abs(b.total) - Math.abs(a.total);
  });

  if (isLoading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-800 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-slate-800 rounded-xl"></div>
            <div className="h-32 bg-slate-800 rounded-xl"></div>
            <div className="h-32 bg-slate-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{cycleLabel}</h2>
          <p className="text-sm text-slate-400">Expense summary</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Reimbursable"
          value={`$${totalReimbursable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={totalReimbursable}
          previous={previousReimbursable}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Total Spent"
          value={`$${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          delta={totalSpent}
          previous={previousSpent}
          isInverted
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Transactions"
          value={transactionCount.toString()}
          delta={transactionCount}
          previous={previousCount}
          icon={Hash}
          color="purple"
        />
      </div>

      {/* Category Breakdown */}
      {sortedBuckets.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <p className="text-sm font-medium text-slate-400 mb-4">Category Breakdown</p>
          <div className="space-y-4">
            {sortedBuckets.map(bucket => (
              <BucketBar
                key={bucket.bucket}
                bucket={bucket.bucket}
                total={Math.abs(bucket.total)}
                maxTotal={maxBucketTotal}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
