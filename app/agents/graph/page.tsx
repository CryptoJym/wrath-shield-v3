"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle, ArrowLeft, ZoomIn, ZoomOut, Crosshair, Info, Move, Activity } from 'lucide-react';
import { GraphLegend } from '@/components/agents/GraphLegend';
import { AgentDetailPanel } from '@/components/agents/AgentDetailPanel';
import { GraphFilters } from '@/components/agents/GraphFilters';
import { Agent } from '@/app/agents/agents.mock';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  status: 'green' | 'yellow' | 'red';
  lastSeen: string;
  hp: number;
  mp: number;
  openItems: number;
  position?: { x: number; y: number };
  capabilities?: string[];
  link?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'data' | 'control' | 'bidirectional';
  healthy: boolean;
  label?: string;
  lastRun?: string;
  errorLog?: string;
  bandwidth?: number;
  volume?: number;
}

interface AgentGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: string;
}

interface EdgeAudit {
  id: string;
  from: string;
  to: string;
  healthy: boolean;
  type: string;
  label?: string;
  lastSeen?: string;
  openItems?: number;
  lastRun?: string;
  errorLog?: string;
  bandwidth?: number;
  volume?: number;
}

const fallbackGraphData: AgentGraphData = {
  timestamp: new Date().toISOString(),
  nodes: [
    { id: "inbox", name: "Inbox", type: "mail", status: "green", lastSeen: new Date().toISOString(), hp: 100, mp: 100, openItems: 3, position: { x: 0, y: 0 }, capabilities: ["Email/iMessage ingest", "Classification"], link: "/inbox" },
    { id: "finance", name: "Finance", type: "coins", status: "green", lastSeen: new Date().toISOString(), hp: 95, mp: 90, openItems: 2, position: { x: 1, y: -1 }, capabilities: ["Transaction ingest", "Context enrichment"], link: "/finance" },
    { id: "pm", name: "PM", type: "clipboard-list", status: "yellow", lastSeen: new Date().toISOString(), hp: 80, mp: 70, openItems: 0, position: { x: 2, y: 0 }, capabilities: ["Motion↔GitHub sync", "Project inventory"], link: "/pm" },
    { id: "legal", name: "Legal", type: "gavel", status: "green", lastSeen: new Date().toISOString(), hp: 90, mp: 85, openItems: 1, position: { x: 1, y: 1 }, capabilities: ["MyCase ingest", "Strategic brief"], link: "/legal/actions" },
    { id: "grok", name: "Research Hub", type: "brain", status: "green", lastSeen: new Date().toISOString(), hp: 100, mp: 100, openItems: 0, position: { x: 3, y: 0 }, capabilities: ["LLM routing", "Action proposals"], link: "/chat" },
  ],
  edges: [
    { from: "inbox", to: "finance", type: "data", healthy: true, label: "txns" },
    { from: "inbox", to: "pm", type: "data", healthy: true, label: "tasks" },
    { from: "inbox", to: "legal", type: "data", healthy: true, label: "briefs" },
    { from: "inbox", to: "grok", type: "control", healthy: true, label: "routing" },
    { from: "pm", to: "grok", type: "control", healthy: true, label: "planning" },
    { from: "finance", to: "grok", type: "control", healthy: true, label: "classify" },
  ],
};

const statusColor = {
  green: '#22c55e',
  yellow: '#fbbf24',
  red: '#f87171',
};

const edgeColor = (healthy: boolean) => (healthy ? '#6ee7b7' : '#f87171');
const edgeOpacity = (healthy: boolean) => (healthy ? 0.9 : 0.5);

// SVG viewBox dimensions - larger for more spacing
const SVG_WIDTH = 1800;
const SVG_HEIGHT = 1200;
const NODE_RADIUS = 45;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT / 2;
const ORBIT_RADIUS = 420; // Distance from center for satellite nodes - increased for legibility

export default function AgentGraphPage() {
  const [data, setData] = useState<AgentGraphData>(fallbackGraphData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeAudit | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');

  // SVG viewBox state for proper pan/zoom
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; vbX: number; vbY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch('/api/agents/graph', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled && json?.nodes && json?.edges) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'failed to load');
          setData(fallbackGraphData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Filter nodes and edges based on filters
  const filteredData = useMemo(() => {
    let nodes = data.nodes;

    // Apply status filter
    if (statusFilter !== 'all') {
      nodes = nodes.filter(n => n.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      nodes = nodes.filter(n => n.type === typeFilter);
    }

    // Filter edges to only include edges between visible nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = data.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));

    return { nodes, edges };
  }, [data, statusFilter, typeFilter]);

  // Get available types for filter
  const availableTypes = useMemo(() => {
    return Array.from(new Set(data.nodes.map(n => n.type)));
  }, [data.nodes]);

  // Calculate node positions with proper spacing
  // Grok (research hub) in center, others in orbit around it
  const { nodesNorm, edges } = useMemo(() => {
    const nodes = filteredData.nodes;
    const grokNode = nodes.find(n => n.id === 'grok');
    const otherNodes = nodes.filter(n => n.id !== 'grok');

    const positioned = nodes.map((n, idx) => {
      if (n.id === 'grok') {
        // Center position for research hub
        return { ...n, sx: CENTER_X, sy: CENTER_Y };
      }
      // Distribute other nodes evenly in a circle
      const otherIdx = otherNodes.findIndex(on => on.id === n.id);
      const angle = (otherIdx / Math.max(1, otherNodes.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        ...n,
        sx: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
        sy: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
      };
    });

    return { nodesNorm: positioned, edges: filteredData.edges };
  }, [filteredData]);

  const edgeAuditFor = (edge: GraphEdge): EdgeAudit => {
    const fromNode = data.nodes.find(n => n.id === edge.from);
    const toNode = data.nodes.find(n => n.id === edge.to);
    return {
      id: `${edge.from}-${edge.to}`,
      from: edge.from,
      to: edge.to,
      healthy: edge.healthy,
      type: edge.type,
      label: edge.label,
      lastSeen: fromNode?.lastSeen || toNode?.lastSeen,
      openItems: (fromNode?.openItems || 0) + (toNode?.openItems || 0),
      lastRun: edge.lastRun,
      errorLog: edge.errorLog,
      bandwidth: edge.bandwidth,
      volume: edge.volume,
    };
  };

  // Convert screen coordinates to SVG coordinates
  const screenToSVG = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = viewBox.x + (screenX - rect.left) * (viewBox.w / rect.width);
    const y = viewBox.y + (screenY - rect.top) * (viewBox.h / rect.height);
    return { x, y };
  }, [viewBox]);

  // Zoom with mouse wheel - zooms toward cursor position
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87; // Zoom out / in
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to SVG coordinates
    const svgX = viewBox.x + mouseX * (viewBox.w / rect.width);
    const svgY = viewBox.y + mouseY * (viewBox.h / rect.height);

    // Calculate new viewBox dimensions
    const newW = Math.max(200, Math.min(SVG_WIDTH * 3, viewBox.w * zoomFactor));
    const newH = Math.max(150, Math.min(SVG_HEIGHT * 3, viewBox.h * zoomFactor));

    // Adjust viewBox position to keep mouse position fixed
    const newX = svgX - mouseX * (newW / rect.width);
    const newY = svgY - mouseY * (newH / rect.height);

    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox]);

  // Pan handlers
  const startPan = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, vbX: viewBox.x, vbY: viewBox.y });
  }, [viewBox]);

  const doPan = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) * (viewBox.w / rect.width);
    const dy = (e.clientY - panStart.y) * (viewBox.h / rect.height);
    setViewBox(vb => ({ ...vb, x: panStart.vbX - dx, y: panStart.vbY - dy }));
  }, [isPanning, panStart, viewBox]);

  const endPan = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  // Reset view to default
  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: SVG_WIDTH, h: SVG_HEIGHT });
  }, []);

  // Zoom in/out buttons
  const zoomIn = useCallback(() => {
    setViewBox(vb => {
      const factor = 0.8;
      const newW = vb.w * factor;
      const newH = vb.h * factor;
      const dx = (vb.w - newW) / 2;
      const dy = (vb.h - newH) / 2;
      return { x: vb.x + dx, y: vb.y + dy, w: newW, h: newH };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewBox(vb => {
      const factor = 1.25;
      const newW = Math.min(SVG_WIDTH * 3, vb.w * factor);
      const newH = Math.min(SVG_HEIGHT * 3, vb.h * factor);
      const dx = (vb.w - newW) / 2;
      const dy = (vb.h - newH) / 2;
      return { x: vb.x + dx, y: vb.y + dy, w: newW, h: newH };
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-foreground overflow-hidden selection:bg-primary/30">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      <div className="max-w-[1920px] mx-auto px-6 py-8 space-y-6 relative z-10 h-screen flex flex-col">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6 flex-shrink-0">
          <div>
            <Link href="/agents/roster" className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Roster
            </Link>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Neural Network Topology
            </h1>
            <p className="text-slate-400 text-sm">
              Real-time visualization of autonomous agent interactions and data flow.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Nodes</div>
                <div className="text-xl font-bold text-white">{nodesNorm.length}</div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Signal Flow</div>
                <div className="text-xl font-bold text-emerald-400">
                  {edges.filter(e => e.healthy).length}<span className="text-slate-600 text-sm font-normal">/{edges.length}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 border border-red-500/30 bg-red-950/80 backdrop-blur-md text-red-200 rounded-full px-6 py-2 flex items-center gap-3 shadow-lg shadow-red-900/20">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Connection lost. Showing cached topology.</span>
          </div>
        )}

        <div className="flex-1 relative border border-white/5 bg-slate-900/20 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
          {/* Controls Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg p-1 flex flex-col gap-1 shadow-xl">
              <button onClick={zoomIn} className="p-2 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors" title="Zoom In">
                <ZoomIn size={18} />
              </button>
              <button onClick={zoomOut} className="p-2 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors" title="Zoom Out">
                <ZoomOut size={18} />
              </button>
              <button onClick={resetView} className="p-2 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors" title="Reset View">
                <Crosshair size={18} />
              </button>
            </div>
          </div>

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl max-w-xs">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">System Status</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span>Operational</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  <span>Degraded / Warning</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span>Critical Error</span>
                </div>
                <div className="h-px bg-white/10 my-2"></div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                  <span>Active Data Flow</span>
                </div>
              </div>
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full"
            onWheel={onWheel}
            onMouseDown={startPan}
            onMouseMove={doPan}
            onMouseUp={endPan}
            onMouseLeave={endPan}
            style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : 'grab' }}
          >
            {/* Dark Tech Grid Background */}
            <defs>
              <pattern id="tech-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <circle cx="100" cy="100" r="1" fill="rgba(255,255,255,0.1)" />
              </pattern>
              <linearGradient id="edge-gradient" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect x="-2000" y="-2000" width="8000" height="8000" fill="#020617" />
            <rect x="-2000" y="-2000" width="8000" height="8000" fill="url(#tech-grid)" />

            {/* Edges */}
            {edges.map((e, idx) => {
              const from = nodesNorm.find(n => n.id === e.from);
              const to = nodesNorm.find(n => n.id === e.to);
              if (!from || !to) return null;

              // Calculate Bezier curve
              const midX = (from.sx + to.sx) / 2;
              const midY = (from.sy + to.sy) / 2;
              // Add curvature based on index to avoid overlap if multiple edges
              const curvature = 0;

              const pathD = `M ${from.sx} ${from.sy} Q ${midX} ${midY} ${to.sx} ${to.sy}`;

              return (
                <g key={`${e.from}-${e.to}-${idx}`} className="group" onClick={() => setSelectedEdge(edgeAuditFor(e))}>
                  {/* Hover Hit Area */}
                  <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" className="cursor-pointer" />

                  {/* Base Line */}
                  <path
                    d={pathD}
                    stroke={e.healthy ? "url(#edge-gradient)" : "#ef4444"}
                    strokeWidth="2"
                    strokeOpacity="0.3"
                    fill="none"
                    strokeDasharray={e.type === 'control' ? "4 4" : "none"}
                  />

                  {/* Animated Pulse (Data Packet) */}
                  {e.healthy && (
                    <circle r="3" fill="#fff">
                      <animateMotion dur={`${Math.max(1, 4 - (e.bandwidth || 0) / 1000)}s`} repeatCount="indefinite" path={pathD}>
                      </animateMotion>
                    </circle>
                  )}

                  {/* Label (visible on hover or selection) */}
                  {e.label && (
                    <foreignObject x={midX - 40} y={midY - 12} width={80} height={24} className="overflow-visible pointer-events-none">
                      <div className="flex justify-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-950/80 border border-white/10 text-[10px] text-slate-300 font-mono backdrop-blur-sm">
                          {e.label}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodesNorm.map((n) => {
              const isGrok = n.id === 'grok';
              const size = isGrok ? 160 : 120; // Larger size for foreignObject container
              const offset = size / 2;

              return (
                <foreignObject
                  key={n.id}
                  x={n.sx - offset}
                  y={n.sy - offset}
                  width={size}
                  height={size}
                  className="overflow-visible"
                >
                  <div
                    className="w-full h-full flex items-center justify-center cursor-pointer group"
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(n); }}
                  >
                    {/* Outer Ring (Rotating) */}
                    <div className={`absolute inset-0 rounded-full border border-dashed border-white/20 ${n.status === 'green' ? 'animate-[spin_10s_linear_infinite]' : ''}`} />

                    {/* Inner Glow Ring */}
                    <div className={`absolute inset-2 rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:border-white/30 ${n.status === 'green' ? 'shadow-[0_0_20px_rgba(16,185,129,0.2)]' :
                      n.status === 'yellow' ? 'shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                        'shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                      }`}></div>

                    {/* Content Container */}
                    <div className="relative z-10 flex flex-col items-center justify-center text-center">
                      {/* Icon */}
                      <div className={`mb-1 ${n.status === 'green' ? 'text-emerald-400' :
                        n.status === 'yellow' ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                        {/* We can't easily render Lucide icons dynamically in foreignObject without mapping, 
                             so we'll use a generic icon or map them if available in scope. 
                             For now, let's use a generic 'Box' or specific if we can map. 
                             Actually, we can just render the icon component if we map it. 
                         */}
                        <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                          {/* Placeholder for icon - in real implementation we'd map n.type to icon */}
                          <div className="font-bold text-lg font-mono">{n.name.substring(0, 2).toUpperCase()}</div>
                        </div>
                      </div>

                      {/* Name */}
                      <div className="text-xs font-bold text-white tracking-wide shadow-black drop-shadow-md">{n.name}</div>

                      {/* Stats (HP/MP) */}
                      <div className="flex gap-1 mt-1">
                        <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${n.hp}%` }} />
                        </div>
                        <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${n.mp}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Status Dot */}
                    <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-slate-900 ${n.status === 'green' ? 'bg-emerald-500 animate-pulse' :
                      n.status === 'yellow' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}></div>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Agent Detail Slide-out Panel */}
      {selectedNode && (
        <AgentDetailPanel
          agent={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      {/* Edge Detail Panel (Floating) */}
      {selectedEdge && (
        <div className="fixed bottom-8 right-8 w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-2xl z-50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Connection Data
            </h3>
            <button onClick={() => setSelectedEdge(null)} className="text-slate-400 hover:text-white">
              <Crosshair size={16} className="rotate-45" />
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Source</span>
              <span className="text-white font-mono">{selectedEdge.from}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Target</span>
              <span className="text-white font-mono">{selectedEdge.to}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Status</span>
              <span className={selectedEdge.healthy ? "text-emerald-400" : "text-red-400"}>
                {selectedEdge.healthy ? "Active" : "Degraded"}
              </span>
            </div>
            {selectedEdge.bandwidth && (
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Bandwidth</span>
                <span className="text-cyan-400 font-mono">{selectedEdge.bandwidth} KB/s</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
