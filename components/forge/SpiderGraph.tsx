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
      <ResponsiveContainer width={dimensions.width} height={dimensions.height}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid
            stroke="#374151"
            strokeOpacity={0.5}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: '#9CA3AF',
              fontSize: size === 'sm' ? 10 : 12,
            }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: '#6B7280', fontSize: 10 }}
            tickCount={5}
            axisLine={false}
          />

          {/* Benchmark overlay (6th grade average) */}
          {showBenchmark && (
            <Radar
              name="Grade 6 Average"
              dataKey="benchmark"
              stroke="#6B7280"
              fill="#6B7280"
              fillOpacity={0.1}
              strokeDasharray="5 5"
              strokeWidth={1}
            />
          )}

          {/* Player stats */}
          <Radar
            name="Hyro's Stats"
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.4}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: '#3B82F6',
              stroke: '#1E40AF',
              strokeWidth: 1,
            }}
          />

          <Tooltip
            content={({ payload, label }) => {
              if (!payload || payload.length === 0) return null;
              const playerValue = payload.find((p) => p.dataKey === 'value')?.value;
              const benchmarkValue = payload.find((p) => p.dataKey === 'benchmark')?.value;

              return (
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
                  <p className="text-white font-semibold mb-1">{label}</p>
                  <p className="text-blue-400">
                    Current: <span className="font-bold">{playerValue}</span>
                  </p>
                  {showBenchmark && (
                    <p className="text-gray-400 text-sm">
                      Grade 6 Avg: {benchmarkValue}
                    </p>
                  )}
                  {playerValue !== undefined && benchmarkValue !== undefined && (
                    <p className={`text-sm mt-1 ${
                      Number(playerValue) >= Number(benchmarkValue)
                        ? 'text-green-400'
                        : 'text-yellow-400'
                    }`}>
                      {Number(playerValue) >= Number(benchmarkValue)
                        ? 'Above average'
                        : 'Room to grow'}
                    </p>
                  )}
                </div>
              );
            }}
          />

          {showBenchmark && (
            <Legend
              wrapperStyle={{
                paddingTop: '10px',
              }}
              formatter={(value) => (
                <span className="text-gray-300 text-sm">{value}</span>
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
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-300">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white">{value}</span>
          {trend && (
            <span className={`text-xs ${
              trend === 'up' ? 'text-green-400' :
              trend === 'down' ? 'text-red-400' :
              'text-gray-400'
            }`}>
              {trend === 'up' ? '+' : trend === 'down' ? '-' : '='}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        {/* Benchmark marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: `${benchmarkPercentage}%` }}
        />
        {/* Value bar */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            value >= benchmark ? 'bg-blue-500' : 'bg-yellow-500'
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
