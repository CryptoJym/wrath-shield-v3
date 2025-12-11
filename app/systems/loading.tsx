/**
 * Loading Skeleton for Systems Page
 *
 * Displays a shimmer effect while telemetry data is being fetched.
 * Matches the layout structure of the main systems page.
 */

export default function SystemsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="w-12 h-12 rounded-lg" />
            <div>
              <SkeletonBlock className="w-48 h-7 mb-2" />
              <SkeletonBlock className="w-64 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <SkeletonBlock className="w-32 h-8 rounded-md" />
            <SkeletonBlock className="w-24 h-8 rounded-md" />
          </div>
        </div>

        {/* Health Status Bar Skeleton */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <SkeletonBlock className="w-3 h-3 rounded-full" />
                  <SkeletonBlock className="w-24 h-4" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="w-20 h-6 rounded-full" />
          </div>
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Memory & Synthesis */}
          <div className="col-span-4 space-y-6">
            <PanelSkeleton title={true} rows={5} />
            <PanelSkeleton title={true} rows={4} />
          </div>

          {/* Center Column - Decisions */}
          <div className="col-span-4 space-y-6">
            <PanelSkeleton title={true} rows={3} />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <DecisionCardSkeleton key={i} />
              ))}
            </div>
          </div>

          {/* Right Column - Learning & Cron */}
          <div className="col-span-4 space-y-6">
            <PanelSkeleton title={true} rows={4} />
            <CronTimelineSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Skeleton Components
// =============================================================================

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-800/50 animate-pulse rounded ${className}`}
      aria-hidden="true"
    />
  );
}

function PanelSkeleton({ title, rows }: { title?: boolean; rows: number }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
      {title && <SkeletonBlock className="w-40 h-6 mb-4" />}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <SkeletonBlock className="w-24 h-4" />
            <SkeletonBlock className="w-16 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionCardSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <SkeletonBlock className="w-48 h-5" />
        <SkeletonBlock className="w-16 h-5 rounded-full" />
      </div>
      <SkeletonBlock className="w-full h-4 mb-2" />
      <SkeletonBlock className="w-3/4 h-4 mb-4" />
      <div className="flex items-center justify-between">
        <SkeletonBlock className="w-20 h-4" />
        <SkeletonBlock className="w-24 h-4" />
      </div>
    </div>
  );
}

function CronTimelineSkeleton() {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
      <SkeletonBlock className="w-32 h-6 mb-4" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <SkeletonBlock className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="w-32 h-4 mb-1" />
              <SkeletonBlock className="w-24 h-3" />
            </div>
            <SkeletonBlock className="w-12 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
