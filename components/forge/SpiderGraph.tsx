'use client';

/**
 * HYRO FORGE: SpiderGraph Component
 * Radar/Spider chart for visualizing the 8 character stats
 */

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

interface StatData {
  name: string;
  displayName: string;
  value: number;
  benchmark: number;
  fullMark: number;
}

interface SpiderGraphProps {
  stats: StatData[];
  showBenchmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 280, height: 280 },
  md: { width: 400, height: 400 },
  lg: { width: 500, height: 500 },
};

export function SpiderGraph({
  stats,
  showBenchmark = true,
  size = 'md',
  className = '',
}: SpiderGraphProps) {
  const dimensions = SIZE_MAP[size];

  // Format data for Recharts
  const chartData = stats.map((stat) => ({
    subject: stat.displayName,
    value: stat.value,
    benchmark: stat.benchmark,
    fullMark: stat.fullMark,
  }));

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
          <PolarGrid
            stroke="#52525b" // zinc-600
            strokeOpacity={0.3}
            strokeDasharray="4 4"
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: '#a1a1aa', // zinc-400
              fontSize: 11,
              fontWeight: 600,
            }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: '#71717a', fontSize: 9 }} // zinc-500
            tickCount={5}
            axisLine={false}
          />

          {/* Benchmark overlay (6th grade average) */}
          {showBenchmark && (
            <Radar
              name="Grade 6 Average"
              dataKey="benchmark"
              stroke="#71717a"
              fill="#71717a"
              fillOpacity={0.1}
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}

          {/* Player stats - Holographic look */}
          <defs>
            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <Radar
            name="Hyro's Stats"
            dataKey="value"
            stroke="#22d3ee" // cyan-400
            fill="url(#radarFill)"
            fillOpacity={1}
            strokeWidth={2}
            dot={{
              r: 3,
              fill: '#22d3ee',
              strokeWidth: 0,
            }}
            activeDot={{
              r: 5,
              fill: '#fff',
              stroke: '#22d3ee',
              strokeWidth: 2,
            }}
          />

          <Tooltip
            cursor={false}
            content={({ payload, label }) => {
              if (!payload || payload.length === 0) return null;
              const playerValue = payload.find((p) => p.dataKey === 'value')?.value;
              const benchmarkValue = payload.find((p) => p.dataKey === 'benchmark')?.value;

              return (
                <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl z-50">
                  <p className="text-white font-bold mb-2 text-sm uppercase tracking-wider">{label}</p>
                  <div className="space-y-1">
                    <p className="text-cyan-400 flex justify-between gap-4 text-sm">
                      <span>Current:</span>
                      <span className="font-bold font-mono">{playerValue}</span>
                    </p>
                    {showBenchmark && (
                      <p className="text-zinc-500 flex justify-between gap-4 text-xs">
                        <span>Grade 6 Avg:</span>
                        <span className="font-mono">{benchmarkValue}</span>
                      </p>
                    )}
                  </div>
                  {playerValue !== undefined && benchmarkValue !== undefined && (
                    <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-md inline-block ${Number(playerValue) >= Number(benchmarkValue)
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                      }`}>
                      {Number(playerValue) >= Number(benchmarkValue)
                        ? 'Above Average'
                        : 'Room for Growth'}
                    </div>
                  )}
                </div>
              );
            }}
          />

          {showBenchmark && (
            <Legend
              wrapperStyle={{
                paddingTop: '0px',
                marginTop: '-5px',
                fontSize: '10px'
              }}
              formatter={(value) => (
                <span className="text-zinc-400 text-[10px] uppercase tracking-wider font-medium">{value}</span>
              )}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Compact stat display for mobile/sidebar
 */
export function StatBar({
  name,
  value,
  benchmark,
  trend,
}: {
  name: string;
  value: number;
  benchmark: number;
  trend?: 'up' | 'down' | 'stable';
}) {
  const percentage = Math.min(100, (value / 100) * 100);
  const benchmarkPercentage = Math.min(100, (benchmark / 100) * 100);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-mono text-white">{value}</span>
          {trend && (
            <span className={`text-[10px] ${trend === 'up' ? 'text-emerald-400' :
              trend === 'down' ? 'text-rose-400' :
                'text-zinc-500'
              }`}>
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '−'}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        {/* Benchmark marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-zinc-600 z-10"
          style={{ left: `${benchmarkPercentage}%` }}
        />
        {/* Value bar */}
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${value >= benchmark ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Compact stat list for sidebar
 */
export function StatList({
  stats,
}: {
  stats: Array<{
    displayName: string;
    value: number;
    benchmark: number;
    trend?: 'up' | 'down' | 'stable';
  }>;
}) {
  return (
    <div className="space-y-1">
      {stats.map((stat) => (
        <StatBar
          key={stat.displayName}
          name={stat.displayName}
          value={stat.value}
          benchmark={stat.benchmark}
          trend={stat.trend}
        />
      ))}
    </div>
  );
}
