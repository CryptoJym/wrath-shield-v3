"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle, ArrowLeft, ZoomIn, ZoomOut, Crosshair, Info, Move, Activity, Gauge, TrendingUp, Clock, Zap, BarChart2, Eye, EyeOff } from 'lucide-react';
import { GraphLegend } from '@/components/agents/GraphLegend';
import { AgentDetailPanel } from '@/components/agents/AgentDetailPanel';
import { GraphFilters } from '@/components/agents/GraphFilters';
import { Agent } from '@/app/agents/agents.mock';

type NodeType = 'agent' | 'integration' | 'llm' | 'memory' | 'cron';

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
  nodeType?: NodeType;
  category?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'data' | 'control' | 'bidirectional' | 'cron' | 'llm' | 'memory';
  healthy: boolean;
  label?: string;
  lastRun?: string;
  errorLog?: string;
  bandwidth?: number;
  volume?: number;
  // Real-time metrics
  latencyMs?: number;       // Current latency in milliseconds
  throughputKBps?: number;  // Throughput in KB/s
  errorRate?: number;       // Error rate 0-1
  requestCount?: number;    // Requests in last minute
}

interface AgentGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: string;
  stats?: {
    totalAgents: number;
    totalIntegrations: number;
    totalConnections: number;
    healthyConnections: number;
    activeDataFlows: number;
  };
  // Real-time system metrics
  metrics?: {
    avgLatencyMs: number;
    totalThroughputKBps: number;
    systemErrorRate: number;
    activeConnections: number;
    requestsPerMinute: number;
    peakLatencyMs: number;
    uptimePercent: number;
  };
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
    { id: "inbox", name: "Inbox", type: "mail", status: "green", lastSeen: new Date().toISOString(), hp: 100, mp: 100, openItems: 3, position: { x: 0, y: 0 }, capabilities: ["Email/iMessage ingest", "Classification"], link: "/inbox", nodeType: 'agent' },
    { id: "finance", name: "Finance", type: "coins", status: "green", lastSeen: new Date().toISOString(), hp: 95, mp: 90, openItems: 2, position: { x: 1, y: -1 }, capabilities: ["Transaction ingest", "Context enrichment"], link: "/finance", nodeType: 'agent' },
    { id: "pm", name: "PM", type: "clipboard-list", status: "yellow", lastSeen: new Date().toISOString(), hp: 80, mp: 70, openItems: 0, position: { x: 2, y: 0 }, capabilities: ["Motion↔GitHub sync", "Project inventory"], link: "/pm", nodeType: 'agent' },
    { id: "legal", name: "Legal", type: "gavel", status: "green", lastSeen: new Date().toISOString(), hp: 90, mp: 85, openItems: 1, position: { x: 1, y: 1 }, capabilities: ["MyCase ingest", "Strategic brief"], link: "/legal/actions", nodeType: 'agent' },
    { id: "grok", name: "Research Hub", type: "brain", status: "green", lastSeen: new Date().toISOString(), hp: 100, mp: 100, openItems: 0, position: { x: 3, y: 0 }, capabilities: ["LLM routing", "Action proposals"], link: "/chat", nodeType: 'llm' },
  ],
  edges: [
    { from: "inbox", to: "finance", type: "data", healthy: true, label: "txns", latencyMs: 45, throughputKBps: 320, errorRate: 0.001, requestCount: 156 },
    { from: "inbox", to: "pm", type: "data", healthy: true, label: "tasks", latencyMs: 78, throughputKBps: 180, errorRate: 0.003, requestCount: 89 },
    { from: "inbox", to: "legal", type: "data", healthy: true, label: "briefs", latencyMs: 120, throughputKBps: 95, errorRate: 0.008, requestCount: 34 },
    { from: "inbox", to: "grok", type: "control", healthy: true, label: "routing", latencyMs: 32, throughputKBps: 512, errorRate: 0.0005, requestCount: 423 },
    { from: "pm", to: "grok", type: "control", healthy: true, label: "planning", latencyMs: 210, throughputKBps: 145, errorRate: 0.015, requestCount: 67 },
    { from: "finance", to: "grok", type: "control", healthy: true, label: "classify", latencyMs: 56, throughputKBps: 278, errorRate: 0.002, requestCount: 198 },
  ],
  metrics: {
    avgLatencyMs: 90,
    totalThroughputKBps: 1530,
    systemErrorRate: 0.005,
    activeConnections: 6,
    requestsPerMinute: 967,
    peakLatencyMs: 210,
    uptimePercent: 99.94,
  },
};

const statusColor = {
  green: '#22c55e',
  yellow: '#fbbf24',
  red: '#f87171',
};

const edgeColor = (healthy: boolean) => (healthy ? '#6ee7b7' : '#f87171');
const edgeOpacity = (healthy: boolean) => (healthy ? 0.9 : 0.5);

// SVG viewBox dimensions - expanded for comprehensive network view
const SVG_WIDTH = 1400;
const SVG_HEIGHT = 800;
const NODE_RADIUS = 45;
const CENTER_X = 600;
const CENTER_Y = 400;
const ORBIT_RADIUS = 420;

// Node type visual styling
const nodeTypeStyles: Record<NodeType, { bg: string; border: string; glow: string; icon: string }> = {
  agent: { bg: 'bg-slate-900/80', border: 'border-violet-500/50', glow: 'shadow-violet-500/20', icon: '🤖' },
  integration: { bg: 'bg-blue-950/80', border: 'border-blue-500/50', glow: 'shadow-blue-500/20', icon: '🔌' },
  llm: { bg: 'bg-amber-950/80', border: 'border-amber-500/50', glow: 'shadow-amber-500/20', icon: '🧠' },
  memory: { bg: 'bg-emerald-950/80', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20', icon: '💾' },
  cron: { bg: 'bg-cyan-950/80', border: 'border-cyan-500/50', glow: 'shadow-cyan-500/20', icon: '⏰' },
};

// Edge type colors
const edgeTypeColors: Record<GraphEdge['type'], string> = {
  data: '#3b82f6',      // blue
  control: '#a855f7',   // purple
  bidirectional: '#6366f1', // indigo
  cron: '#06b6d4',      // cyan
  llm: '#f59e0b',       // amber
  memory: '#10b981',    // emerald
};

export default function AgentGraphPage() {
  const [data, setData] = useState<AgentGraphData>(fallbackGraphData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeAudit | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [showMetrics, setShowMetrics] = useState(true);
  const [metricsMode, setMetricsMode] = useState<'throughput' | 'latency' | 'errors'>('throughput');

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

  // Use server-provided positions or fallback to calculated positions
  const { nodesNorm, edges } = useMemo(() => {
    const nodes = filteredData.nodes;

    const positioned = nodes.map((n, idx) => {
      // Use server-provided position if available
      if (n.position && n.position.x !== 0 && n.position.y !== 0) {
        return { ...n, sx: n.position.x, sy: n.position.y };
      }

      // Fallback positioning if server didn't provide
      if (n.id === 'grok') {
        return { ...n, sx: CENTER_X, sy: CENTER_Y };
      }

      // Calculate fallback positions based on node type
      const otherNodes = nodes.filter(on => on.id !== 'grok');
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
            <div className="flex gap-2 flex-wrap">
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Agents</div>
                <div className="text-xl font-bold text-violet-400">{data.stats?.totalAgents || nodesNorm.filter(n => n.nodeType === 'agent').length}</div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Integrations</div>
                <div className="text-xl font-bold text-blue-400">{data.stats?.totalIntegrations || nodesNorm.filter(n => n.nodeType === 'integration').length}</div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Connections</div>
                <div className="text-xl font-bold text-emerald-400">
                  {data.stats?.healthyConnections || edges.filter(e => e.healthy).length}<span className="text-slate-600 text-sm font-normal">/{data.stats?.totalConnections || edges.length}</span>
                </div>
              </div>
              <div className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/10 backdrop-blur-sm">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Data Flows</div>
                <div className="text-xl font-bold text-cyan-400">{data.stats?.activeDataFlows || edges.filter(e => e.type === 'data').length}</div>
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
            {/* Zoom Controls */}
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
              <div className="h-px bg-white/10 my-1"></div>
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className={`p-2 rounded-md transition-colors ${showMetrics ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title={showMetrics ? "Hide Metrics" : "Show Metrics"}
              >
                {showMetrics ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            {/* Metrics Mode Selector */}
            {showMetrics && (
              <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg p-1 flex flex-col gap-1 shadow-xl">
                <button
                  onClick={() => setMetricsMode('throughput')}
                  className={`p-2 rounded-md transition-colors ${metricsMode === 'throughput' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="Throughput View"
                >
                  <TrendingUp size={18} />
                </button>
                <button
                  onClick={() => setMetricsMode('latency')}
                  className={`p-2 rounded-md transition-colors ${metricsMode === 'latency' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="Latency View"
                >
                  <Clock size={18} />
                </button>
                <button
                  onClick={() => setMetricsMode('errors')}
                  className={`p-2 rounded-md transition-colors ${metricsMode === 'errors' ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="Error Rate View"
                >
                  <AlertCircle size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Real-Time Metrics Panel (Top Left) */}
          {showMetrics && (
            <div className="absolute top-4 left-4 z-20">
              <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Gauge size={14} className="text-cyan-400" />
                    Live Metrics
                  </h3>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>

                <div className="space-y-3">
                  {/* Latency */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} /> Avg Latency
                    </span>
                    <span className={`text-sm font-mono font-bold ${
                      (data.metrics?.avgLatencyMs || 45) < 100 ? 'text-emerald-400' :
                      (data.metrics?.avgLatencyMs || 45) < 500 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {data.metrics?.avgLatencyMs || 45}ms
                    </span>
                  </div>

                  {/* Throughput */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <TrendingUp size={12} /> Throughput
                    </span>
                    <span className="text-sm font-mono font-bold text-cyan-400">
                      {((data.metrics?.totalThroughputKBps || 256) / 1000).toFixed(1)} MB/s
                    </span>
                  </div>

                  {/* Error Rate */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <AlertCircle size={12} /> Error Rate
                    </span>
                    <span className={`text-sm font-mono font-bold ${
                      (data.metrics?.systemErrorRate || 0.02) < 0.01 ? 'text-emerald-400' :
                      (data.metrics?.systemErrorRate || 0.02) < 0.05 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {((data.metrics?.systemErrorRate || 0.02) * 100).toFixed(2)}%
                    </span>
                  </div>

                  {/* Requests/min */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Zap size={12} /> Req/min
                    </span>
                    <span className="text-sm font-mono font-bold text-violet-400">
                      {data.metrics?.requestsPerMinute || 1247}
                    </span>
                  </div>

                  {/* Uptime */}
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Uptime</span>
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {data.metrics?.uptimePercent || 99.97}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${data.metrics?.uptimePercent || 99.97}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-xl max-w-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Node Types</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>🤖</span><span className="text-violet-400">Agents</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>🔌</span><span className="text-blue-400">Integrations</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>🧠</span><span className="text-amber-400">LLM Providers</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>💾</span><span className="text-emerald-400">Memory</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>⏰</span><span className="text-cyan-400">Cron Jobs</span>
                </div>
              </div>
              <div className="h-px bg-white/10 my-2"></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Connection Types</h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-6 h-0.5 bg-blue-500"></div><span>Data Flow</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-6 h-0.5 bg-indigo-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, #6366f1 0, #6366f1 4px, transparent 4px, transparent 8px)'}}></div><span>Bidirectional</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-6 h-0.5 bg-amber-500"></div><span>LLM Inference</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-6 h-0.5 bg-emerald-500"></div><span>Memory Persist</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-6 h-0.5 bg-cyan-500" style={{backgroundImage: 'repeating-linear-gradient(90deg, #06b6d4 0, #06b6d4 6px, transparent 6px, transparent 10px)'}}></div><span>Cron Trigger</span>
                </div>
              </div>
              <div className="h-px bg-white/10 my-2"></div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status</h3>
              <div className="flex gap-3">
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span><span>OK</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span><span>Warn</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span><span>Error</span>
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

              // Calculate Bezier curve with slight offset for overlapping edges
              const midX = (from.sx + to.sx) / 2;
              const midY = (from.sy + to.sy) / 2;

              const pathD = `M ${from.sx} ${from.sy} Q ${midX} ${midY} ${to.sx} ${to.sy}`;

              // Get edge color based on type and metrics mode
              let edgeStrokeColor = e.healthy
                ? edgeTypeColors[e.type] || edgeTypeColors.data
                : '#ef4444';

              // Adjust color based on metrics mode
              if (showMetrics && e.healthy) {
                if (metricsMode === 'latency') {
                  const latency = e.latencyMs || 50;
                  edgeStrokeColor = latency < 100 ? '#22c55e' : latency < 300 ? '#f59e0b' : '#ef4444';
                } else if (metricsMode === 'errors') {
                  const errorRate = e.errorRate || 0;
                  edgeStrokeColor = errorRate < 0.01 ? '#22c55e' : errorRate < 0.05 ? '#f59e0b' : '#ef4444';
                } else if (metricsMode === 'throughput') {
                  const throughput = e.throughputKBps || 100;
                  edgeStrokeColor = throughput > 500 ? '#22c55e' : throughput > 100 ? '#06b6d4' : '#6366f1';
                }
              }

              // Calculate stroke width based on throughput (thicker = more data)
              const baseWidth = 2;
              const throughputWidth = showMetrics && metricsMode === 'throughput'
                ? Math.max(1.5, Math.min(6, baseWidth + (e.throughputKBps || 100) / 200))
                : baseWidth;

              // Calculate animation speed based on latency (faster = lower latency)
              const baseSpeed = 3;
              const animSpeed = showMetrics && metricsMode === 'latency'
                ? Math.max(0.5, Math.min(5, baseSpeed * (e.latencyMs || 50) / 100))
                : Math.max(1, 4 - (e.bandwidth || 0) / 1000);

              // Different dash patterns for different edge types
              const dashArray =
                e.type === 'cron' ? '8 4' :
                e.type === 'control' ? '4 4' :
                e.type === 'llm' ? '2 2' :
                'none';

              // Particle size based on request count
              const particleSize = showMetrics
                ? Math.max(2, Math.min(5, 3 + (e.requestCount || 10) / 50))
                : 3;

              return (
                <g key={`${e.from}-${e.to}-${idx}`} className="group" onClick={() => setSelectedEdge(edgeAuditFor(e))}>
                  {/* Hover Hit Area */}
                  <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" className="cursor-pointer" />

                  {/* Glow effect for high throughput */}
                  {showMetrics && metricsMode === 'throughput' && (e.throughputKBps || 100) > 300 && (
                    <path
                      d={pathD}
                      stroke={edgeStrokeColor}
                      strokeWidth={throughputWidth + 4}
                      strokeOpacity={0.15}
                      fill="none"
                      filter="url(#glow)"
                    />
                  )}

                  {/* Base Line */}
                  <path
                    d={pathD}
                    stroke={edgeStrokeColor}
                    strokeWidth={throughputWidth}
                    strokeOpacity={e.healthy ? 0.7 : 0.3}
                    fill="none"
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                  />

                  {/* Animated Pulse (Data Packet) */}
                  {e.healthy && (
                    <circle r={particleSize} fill={edgeStrokeColor} filter={showMetrics ? 'url(#glow)' : undefined}>
                      <animateMotion dur={`${animSpeed}s`} repeatCount="indefinite" path={pathD} />
                    </circle>
                  )}

                  {/* Second particle for high-throughput connections */}
                  {e.healthy && showMetrics && (e.throughputKBps || 100) > 200 && (
                    <circle r={particleSize * 0.7} fill={edgeStrokeColor} opacity={0.6}>
                      <animateMotion dur={`${animSpeed}s`} repeatCount="indefinite" path={pathD} begin={`${animSpeed / 2}s`} />
                    </circle>
                  )}

                  {/* Metrics badge on edge (when metrics mode is active) */}
                  {showMetrics && (
                    <foreignObject x={midX - 30} y={midY - 24} width={60} height={48} className="overflow-visible pointer-events-none">
                      <div className="flex flex-col items-center gap-0.5">
                        {metricsMode === 'latency' && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold backdrop-blur-sm ${
                            (e.latencyMs || 50) < 100 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            (e.latencyMs || 50) < 300 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {e.latencyMs || 50}ms
                          </span>
                        )}
                        {metricsMode === 'throughput' && (
                          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-mono font-bold backdrop-blur-sm">
                            {((e.throughputKBps || 100) / 1000).toFixed(1)}MB/s
                          </span>
                        )}
                        {metricsMode === 'errors' && (e.errorRate || 0) > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold backdrop-blur-sm ${
                            (e.errorRate || 0) < 0.01 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            (e.errorRate || 0) < 0.05 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {((e.errorRate || 0) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </foreignObject>
                  )}

                  {/* Label (visible when metrics mode is off) */}
                  {!showMetrics && e.label && (
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
              const nodeType = n.nodeType || 'agent';
              const style = nodeTypeStyles[nodeType];

              // Size based on node type
              const size = isGrok ? 160 : nodeType === 'agent' ? 110 : 90;
              const offset = size / 2;

              // Shape based on node type (agents circular, integrations hexagonal, etc.)
              const isCircular = nodeType === 'agent' || nodeType === 'llm';

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
                    {/* Outer Ring (Rotating for agents) */}
                    <div className={`absolute inset-0 ${isCircular ? 'rounded-full' : 'rounded-lg'} border border-dashed ${style.border} ${n.status === 'green' && nodeType === 'agent' ? 'animate-[spin_10s_linear_infinite]' : ''}`} />

                    {/* Inner Glow Ring */}
                    <div className={`absolute inset-2 ${isCircular ? 'rounded-full' : 'rounded-md'} border ${style.border} ${style.bg} backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-105 group-hover:border-white/30 ${style.glow}`}></div>

                    {/* Content Container */}
                    <div className="relative z-10 flex flex-col items-center justify-center text-center px-1">
                      {/* Icon/Type Indicator */}
                      <div className={`mb-0.5 ${n.status === 'green' ? 'text-emerald-400' :
                        n.status === 'yellow' ? 'text-amber-400' :
                          'text-red-400'
                        }`}>
                        <div className="text-lg">
                          {style.icon}
                        </div>
                      </div>

                      {/* Name */}
                      <div className="text-[10px] font-bold text-white tracking-wide shadow-black drop-shadow-md leading-tight max-w-[80px] truncate">{n.name}</div>

                      {/* Category Badge for non-agents */}
                      {nodeType !== 'agent' && (
                        <div className="text-[8px] text-slate-400 uppercase tracking-wider mt-0.5">{nodeType}</div>
                      )}

                      {/* Stats (HP/MP) - only for agents */}
                      {nodeType === 'agent' && (
                        <div className="flex gap-1 mt-1">
                          <div className="w-6 h-1 bg-slate-700 rounded-full overflow-hidden" title={`HP: ${n.hp}%`}>
                            <div className="h-full bg-emerald-500" style={{ width: `${n.hp}%` }} />
                          </div>
                          <div className="w-6 h-1 bg-slate-700 rounded-full overflow-hidden" title={`MP: ${n.mp}%`}>
                            <div className="h-full bg-blue-500" style={{ width: `${n.mp}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Dot */}
                    <div className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${n.status === 'green' ? 'bg-emerald-500 animate-pulse' :
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
