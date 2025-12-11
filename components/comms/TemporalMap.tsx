'use client';

import React from 'react';

interface TemporalMapProps {
  data: Record<string, number>;
  days?: number;
}

export function TemporalMap({ data, days = 30 }: TemporalMapProps) {
  // Generate array of last N days
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });

  // Calculate max value for scaling
  const maxVal = Math.max(...Object.values(data), 1);

  // Helper for color intensity
  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-800/50';
    const intensity = count / maxVal;
    if (intensity < 0.25) return 'bg-nano-green/20';
    if (intensity < 0.5) return 'bg-nano-green/40';
    if (intensity < 0.75) return 'bg-nano-green/60';
    return 'bg-nano-green';
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Temporal Memory Map</h3>
          <p className="text-xs text-slate-400">Communication density over time (Entropy Compression)</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-slate-800/50" />
            <div className="w-3 h-3 rounded-sm bg-nano-green/20" />
            <div className="w-3 h-3 rounded-sm bg-nano-green/60" />
            <div className="w-3 h-3 rounded-sm bg-nano-green" />
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="flex gap-1 min-w-max pb-2">
          {dates.map((date) => {
            const count = data[date] || 0;
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
            const showLabel = dateObj.getDay() === 1; // Show label on Mondays

            return (
              <div key={date} className="flex flex-col items-center gap-1 group relative">
                <div
                  className={`w-3 h-12 rounded-sm transition-all hover:scale-110 ${getColor(count)}`}
                />
                {showLabel && (
                  <span className="text-[10px] text-slate-500 font-mono absolute -bottom-4">
                    {dateObj.getDate()}
                  </span>
                )}

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap border border-slate-700 shadow-lg">
                  {date}: {count} memories
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
