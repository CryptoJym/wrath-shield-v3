"use client";
import React, { useMemo, useRef, useState } from 'react';

type Props = {
  title: string;
  values: number[];
  labels?: string[]; // dates or x labels, same length as values
  width?: number;
  height?: number;
  color?: string;
  decimals?: number; // numeric formatting precision
  suffix?: string;   // e.g., "%" for percentages
};

export default function PsychSparkline({
  title,
  values,
  labels,
  width = 300,
  height = 60,
  color,
  decimals,
  suffix,
}: Props) {
  const pad = 6;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { path, pts, vmin, vmax } = useMemo(() => {
    const n = values.length;
    const clean = values.map(v => (Number.isFinite(v) ? v : 0));
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const iv = max === min ? [min, min + 1] : [min, max];
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const step = n > 1 ? innerW / (n - 1) : 0;
    const points: Array<[number, number]> = clean.map((v, i) => {
      const x = pad + i * step;
      const norm = (v - iv[0]) / (iv[1] - iv[0]);
      const y = height - pad - norm * innerH;
      return [x, y];
    });
    const p = points.length ? `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') : '';
    return { path: p, pts: points, vmin: iv[0], vmax: iv[1] };
  }, [values, width, height]);

  const onMove: React.MouseEventHandler<SVGRectElement> = (e) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const innerW = width - pad * 2;
    const n = values.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round(((x - pad) / innerW) * (n - 1))));
    setHoverIdx(idx);
  };

  const onLeave = () => setHoverIdx(null);

  const marker = hoverIdx != null && pts[hoverIdx] ? (
    <g>
      <circle cx={pts[hoverIdx][0]} cy={pts[hoverIdx][1]} r={3} fill={color || 'currentColor'} />
    </g>
  ) : null;

  const hoverVal = hoverIdx != null ? values[hoverIdx] : null;
  const hoverLabel = hoverIdx != null && labels && labels[hoverIdx] ? labels[hoverIdx] : undefined;

  const fmt = (val: number) => {
    const d = Number.isFinite(decimals as any) ? (decimals as number) : 2;
    return (Number.isFinite(val) ? val.toFixed(d) : '—') + (suffix ?? '');
  };

  return (
    <div ref={containerRef} className="mt-1">
      <div className="flex items-center justify-between">
        <strong>{title}</strong>
        <div className="text-secondary text-xs">
          min {fmt(vmin)} • max {fmt(vmax)}
        </div>
      </div>
      <div className="relative">
        <svg width="100%" height={height + ''} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path d={path} stroke={color || 'currentColor'} fill="none" strokeWidth={2} />
          {marker}
          <rect x={0} y={0} width={width} height={height} fill="transparent" onMouseMove={onMove} onMouseLeave={onLeave} />
        </svg>
        {hoverIdx != null && hoverVal != null && (
          <div className="absolute -mt-1 px-2 py-1 text-xs rounded bg-black/70 text-white" style={{ left: `${(pts[hoverIdx][0] / width) * 100}%`, top: 0, transform: 'translate(-50%, -100%)' }}>
            {hoverLabel ? (<div className="mb-0.5 opacity-80">{hoverLabel}</div>) : null}
            <div>{fmt(hoverVal)}</div>
          </div>
        )}
      </div>
      <div className="text-secondary text-xs mt-1">Range: {values.length} pts</div>
    </div>
  );
}
