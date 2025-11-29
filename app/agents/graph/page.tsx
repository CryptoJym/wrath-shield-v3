"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertCircle, CheckCircle, ArrowLeft, ZoomIn, ZoomOut, Crosshair, Info, Move } from 'lucide-react';
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <Link href="/agents/roster" className="text-muted-foreground hover:text-foreground flex items-center gap-2 mb-3 transition-colors">
              <ArrowLeft size={18} /> Back to Roster
            </Link>
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Agent Network Graph
            </h1>
            <p className="text-muted-foreground">
              Visualize agent connections and data flow across your autonomous network.
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="border border-border bg-card rounded-xl p-4 hover:border-primary/50 transition-all shadow-sm">
            <div className="text-muted-foreground text-sm font-medium mb-1">Nodes</div>
            <div className="text-3xl font-bold text-primary">{nodesNorm.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Active agents</div>
          </div>
          <div className="border border-border bg-card rounded-xl p-4 hover:border-primary/50 transition-all shadow-sm">
            <div className="text-muted-foreground text-sm font-medium mb-1">Edges</div>
            <div className="text-3xl font-bold">
              {edges.length}
              <span className="text-sm text-green-500 ml-2">({edges.filter(e => e.healthy).length} healthy)</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Network connections</div>
          </div>
          <div className="border border-border bg-card rounded-xl p-4 hover:border-primary/50 transition-all shadow-sm">
            <div className="text-muted-foreground text-sm font-medium mb-1">Last updated</div>
            <div className="text-lg font-semibold text-foreground">{new Date(data.timestamp).toLocaleTimeString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{new Date(data.timestamp).toLocaleDateString()}</div>
          </div>
        </div>

        {error && (
          <div className="border border-amber-500/40 bg-amber-500/10 text-amber-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <AlertCircle size={20} className="flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1">Error loading live graph</div>
              <div className="text-sm text-amber-300/80">Showing fallback data. {error}</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground p-4 bg-card border border-border rounded-xl">
            <RefreshCw className="animate-spin" size={18} />
            <span>Loading graph data...</span>
          </div>
        )}

        {!loading && (
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left sidebar - Filters & Legend */}
            <div className="lg:col-span-3 space-y-4">
              <GraphFilters
                statusFilter={statusFilter}
                typeFilter={typeFilter}
                onStatusFilterChange={setStatusFilter}
                onTypeFilterChange={setTypeFilter}
                availableTypes={availableTypes}
              />
              <GraphLegend />
            </div>

            {/* Main Graph */}
            <div className="lg:col-span-9 space-y-4">
              <div className="border border-border bg-card rounded-xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Network Topology</h2>
                    <span className="text-xs text-muted-foreground">
                      ({nodesNorm.length} nodes, {edges.length} connections)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">
                      <Move size={12} className="inline mr-1" />Drag to pan
                    </span>
                    <button
                      aria-label="Zoom in"
                      className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
                      onClick={zoomIn}
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button
                      aria-label="Zoom out"
                      className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
                      onClick={zoomOut}
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      aria-label="Reset view"
                      className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition-all"
                      onClick={resetView}
                    >
                      <Crosshair size={14} />
                    </button>
                    <span className="text-xs text-muted-foreground ml-2">
                      {Math.round((SVG_WIDTH / viewBox.w) * 100)}%
                    </span>
                  </div>
                </div>
                <div
                  className="relative w-full h-[600px] bg-gradient-to-br from-slate-900/50 via-slate-900/30 to-slate-800/20 border-2 border-border rounded-lg overflow-hidden shadow-inner"
                  style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
                >
                  <svg
                    ref={svgRef}
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                    className="w-full h-full"
                    onWheel={onWheel}
                    onMouseDown={startPan}
                    onMouseMove={doPan}
                    onMouseUp={endPan}
                    onMouseLeave={endPan}
                    style={{ touchAction: 'none' }}
                  >
                    {/* Background grid for visual reference */}
                    <defs>
                      <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect x="-1000" y="-1000" width="4000" height="4000" fill="url(#grid)" />

                    {/* Render edges first so they appear behind nodes */}
                    {edges.map((e, idx) => {
                      const from = nodesNorm.find(n => n.id === e.from);
                      const to = nodesNorm.find(n => n.id === e.to);
                      if (!from || !to) return null;
                      const dashArray = e.type === 'control' ? '12 8' : (!e.healthy ? '8 6' : undefined);
                      const midX = (from.sx + to.sx) / 2;
                      const midY = (from.sy + to.sy) / 2;
                      return (
                        <g key={idx} className="cursor-pointer" onClick={() => setSelectedEdge(edgeAuditFor(e))}>
                          {/* Edge glow effect */}
                          <line
                            x1={from.sx}
                            y1={from.sy}
                            x2={to.sx}
                            y2={to.sy}
                            stroke={edgeColor(e.healthy)}
                            strokeWidth={8}
                            strokeDasharray={dashArray}
                            opacity={0.15}
                            strokeLinecap="round"
                          />
                          {/* Main edge line */}
                          <line
                            x1={from.sx}
                            y1={from.sy}
                            x2={to.sx}
                            y2={to.sy}
                            stroke={edgeColor(e.healthy)}
                            strokeWidth={e.healthy ? 3 : 4}
                            strokeDasharray={dashArray}
                            opacity={edgeOpacity(e.healthy)}
                            strokeLinecap="round"
                          />
                          {e.label && (
                            <>
                              <rect
                                x={midX - 35}
                                y={midY - 12}
                                width="70"
                                height="24"
                                fill="rgba(15, 23, 42, 0.95)"
                                stroke={edgeColor(e.healthy)}
                                strokeWidth="1.5"
                                rx="6"
                              />
                              <text
                                x={midX}
                                y={midY + 1}
                                fill="#e5e7eb"
                                fontSize={14}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontWeight="600"
                              >
                                {e.label}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}

                    {/* Render nodes on top */}
                    {nodesNorm.map((n) => (
                      <g
                        key={n.id}
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setSelectedNode(n); }}
                        style={{ transition: 'transform 0.15s ease' }}
                      >
                        {/* Node outer glow */}
                        <circle
                          cx={n.sx}
                          cy={n.sy}
                          r={NODE_RADIUS + 8}
                          fill="none"
                          stroke={statusColor[n.status]}
                          strokeWidth={2}
                          opacity={0.3}
                          className={n.status === 'green' ? 'animate-pulse' : ''}
                        />
                        {/* Node background */}
                        <circle
                          cx={n.sx}
                          cy={n.sy}
                          r={NODE_RADIUS}
                          fill="#0f172a"
                          stroke={statusColor[n.status]}
                          strokeWidth={4}
                        />
                        {/* Node name */}
                        <text
                          x={n.sx}
                          y={n.sy - NODE_RADIUS - 20}
                          fill="#f1f5f9"
                          fontSize={18}
                          textAnchor="middle"
                          fontWeight="700"
                        >
                          {n.name}
                        </text>
                        {/* Status indicator */}
                        <text
                          x={n.sx}
                          y={n.sy + 5}
                          fill={statusColor[n.status]}
                          fontSize={14}
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {n.status.toUpperCase()}
                        </text>
                        {/* Open items count */}
                        <text
                          x={n.sx}
                          y={n.sy + NODE_RADIUS + 25}
                          fill="#94a3b8"
                          fontSize={13}
                          textAnchor="middle"
                        >
                          {n.openItems} open items
                        </text>
                        {/* HP bar background */}
                        <rect
                          x={n.sx - 30}
                          y={n.sy + NODE_RADIUS + 35}
                          width="60"
                          height="6"
                          rx="3"
                          fill="rgba(255,255,255,0.1)"
                        />
                        {/* HP bar fill */}
                        <rect
                          x={n.sx - 30}
                          y={n.sy + NODE_RADIUS + 35}
                          width={(n.hp / 100) * 60}
                          height="6"
                          rx="3"
                          fill={n.hp >= 80 ? '#10b981' : n.hp >= 50 ? '#f59e0b' : '#ef4444'}
                        />
                        {/* MP bar background */}
                        <rect
                          x={n.sx - 30}
                          y={n.sy + NODE_RADIUS + 45}
                          width="60"
                          height="6"
                          rx="3"
                          fill="rgba(255,255,255,0.1)"
                        />
                        {/* MP bar fill */}
                        <rect
                          x={n.sx - 30}
                          y={n.sy + NODE_RADIUS + 45}
                          width={(n.mp / 100) * 60}
                          height="6"
                          rx="3"
                          fill="#3b82f6"
                        />
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Connection List */}
              <div className="border border-border bg-card rounded-xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Network Connections</h2>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {edges.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Info size={32} className="mx-auto mb-2 opacity-50" />
                      <p>No connections match the current filters</p>
                    </div>
                  ) : (
                    edges.map((e, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedEdge(edgeAuditFor(e))}
                        className={`w-full text-left border bg-card rounded-lg p-3 flex items-center justify-between transition-all hover:shadow-md ${
                          selectedEdge?.id === `${e.from}-${e.to}`
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="text-foreground font-medium text-sm mb-1">
                            {e.from} → {e.to}
                            <span className="text-xs text-muted-foreground ml-2">({e.type})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{e.label || 'link'}</span>
                            {(e.bandwidth !== undefined || e.volume !== undefined) && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-primary font-medium">
                                  {e.bandwidth !== undefined && `${e.bandwidth}KB/s`}
                                  {e.bandwidth !== undefined && e.volume !== undefined && ' • '}
                                  {e.volume !== undefined && `${e.volume}i`}
                                </span>
                              </>
                            )}
                            <span className="text-muted-foreground">·</span>
                            <span className={e.healthy ? 'text-green-500 font-medium' : 'text-red-500 font-medium'}>
                              {e.healthy ? 'Healthy' : 'Degraded'}
                            </span>
                          </div>
                        </div>
                        {e.healthy ? (
                          <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                        ) : (
                          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Edge Details Panel */}
              {selectedEdge && (
                <div className="border-2 border-primary bg-card rounded-lg p-5 text-sm space-y-4 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="flex items-center gap-2 text-foreground font-bold text-base">
                      <Info size={16} className="text-primary" /> Connection Telemetry
                    </div>
                    {selectedEdge.healthy ? (
                      <CheckCircle className="text-green-500" size={20} />
                    ) : (
                      <AlertCircle className="text-red-500" size={20} />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="bg-secondary/30 p-3 rounded-lg space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Route Information</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Route:</span>
                        <span className="text-foreground font-medium text-sm">{selectedEdge.from} → {selectedEdge.to}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Type:</span>
                        <span className="text-foreground font-medium text-sm capitalize">{selectedEdge.type}</span>
                      </div>
                      {selectedEdge.label && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Label:</span>
                          <span className="text-foreground font-medium text-sm">{selectedEdge.label}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-secondary/30 p-3 rounded-lg space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Health Metrics</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Status:</span>
                        <span className={`font-bold text-sm ${selectedEdge.healthy ? 'text-green-500' : 'text-red-500'}`}>
                          {selectedEdge.healthy ? '✓ Healthy' : '✗ Degraded'}
                        </span>
                      </div>
                      {selectedEdge.lastRun && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Last Run:</span>
                          <span className="text-foreground text-xs">{new Date(selectedEdge.lastRun).toLocaleString()}</span>
                        </div>
                      )}
                      {selectedEdge.bandwidth !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Bandwidth:</span>
                          <span className="text-primary font-medium text-sm">{selectedEdge.bandwidth} KB/s</span>
                        </div>
                      )}
                      {selectedEdge.volume !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">Volume:</span>
                          <span className="text-primary font-medium text-sm">{selectedEdge.volume} items</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedEdge.errorLog && (
                    <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-lg">
                      <div className="text-xs font-semibold text-red-400 mb-2">Error Log:</div>
                      <div className="text-xs text-red-300 font-mono">
                        {selectedEdge.errorLog}
                      </div>
                    </div>
                  )}

                  <div className="bg-secondary/30 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Open items (endpoints):</span>
                      <span className="text-foreground font-medium text-sm">{selectedEdge.openItems ?? 0} items</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href={`/agents/audit?edge=${selectedEdge.id}`}
                      className="text-sm text-primary hover:text-primary/80 flex items-center gap-2 font-medium transition-colors"
                    >
                      View full audit log →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent Detail Slide-out Panel */}
      {selectedNode && (
        <AgentDetailPanel
          agent={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}
