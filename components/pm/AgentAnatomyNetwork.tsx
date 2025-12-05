'use client';

/**
 * Agent Anatomy Network Visualization
 * 
 * Premium "Ultra-Edge" interactive network graph showing:
 * - "Tech Node" modules with glassmorphism and animated rings
 * - Curved Bezier connection lines with data flow particles
 * - External system interfaces
 * - Real-time activity pulses (driven by actual logs)
 * - Focus Mode for isolating subsystems
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Activity,
  Filter,
  Eye,
  Cpu,
  Database,
  GitBranch,
  Server,
  Brain,
  Globe,
  HardDrive,
  Share2,
  Layers,
  Zap,
  Lock,
  MessageSquare,
  ShieldCheck,
  Wallet
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AgentModule {
  id: string;
  name: string;
  type: 'core' | 'integration' | 'storage' | 'intelligence' | 'api';
  status: 'active' | 'idle' | 'error' | 'disabled';
  description: string;
  filePath: string;
  metrics?: {
    calls?: number;
    avgLatency?: number;
    errorRate?: number;
  };
}

interface ModuleConnection {
  from: string;
  to: string;
  type: 'data' | 'event' | 'command';
  label?: string;
  active: boolean;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  status: 'success' | 'error' | 'pending';
  details?: string;
  duration?: number;
}

interface AnatomyData {
  ok: boolean;
  agent: {
    id: string;
    name: string;
    version: string;
    status: 'healthy' | 'degraded' | 'error';
  };
  modules: AgentModule[];
  connections: ModuleConnection[];
  metrics: {
    totalCalls: number;
    avgResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  recentActivity: ActivityLog[];
}

// === NODE CONFIGURATION ===
// Grid 960x1000 refined for layout flow
const NODE_POSITIONS: Record<string, { x: number; y: number; layer: number }> = {
  // LAYER 0: INCOMING SIGNALS (Top)
  'comms-agent': { x: 120, y: 100, layer: 0 },
  'inbox-agent': { x: 300, y: 100, layer: 0 },
  'legal-agent': { x: 480, y: 100, layer: 0 },
  'finance-agent': { x: 660, y: 100, layer: 0 },
  'eeg-agent': { x: 840, y: 100, layer: 0 },

  // LAYER 1: TRIAGE (Gateway)
  'task-queue': { x: 480, y: 250, layer: 1 },

  // LAYER 2: EXTERNAL APIs (Left/Right Wings)
  'github-api': { x: 150, y: 400, layer: 2 },
  'openrouter-api': { x: 810, y: 400, layer: 2 },
  'zep-api': { x: 480, y: 920, layer: 6 }, // Moved to bottom near storage

  // LAYER 3: CORE PROCESSING (Center)
  'pm-actions': { x: 350, y: 550, layer: 3 },
  'temporal-context': { x: 480, y: 450, layer: 3 }, // Context is central to decision
  'task-completion': { x: 610, y: 550, layer: 3 },

  // LAYER 4: INTELLIGENCE & SERVICES
  'github-client': { x: 150, y: 650, layer: 4 },
  'commit-intelligence': { x: 350, y: 750, layer: 4 },
  'repo-organizer': { x: 610, y: 750, layer: 4 },
  'integration': { x: 480, y: 650, layer: 4 },
  'sync-service': { x: 810, y: 650, layer: 4 },

  // LAYER 5: STORAGE/MEMORY (Bottom)
  'pm-memory': { x: 480, y: 800, layer: 5 },
  'local-task-store': { x: 650, y: 920, layer: 6 },
};

const LAYER_LABELS = [
  { y: 100, label: 'AGENT SWARM' },
  { y: 250, label: 'INGESTION GATEWAY' },
  { y: 400, label: 'EXTERNAL INTERFACES' },
  { y: 550, label: 'CORE LOGIC' },
  { y: 750, label: 'INTELLIGENCE ENGINE' },
  { y: 920, label: 'PERSISTENCE LAYER' },
];

const EXT_SYSTEMS = [
  { id: 'github-api', name: 'GitHub API', color: '#6e5494', icon: Globe, desc: 'Source Control' },
  { id: 'openrouter-api', name: 'OpenRouter LLM', color: '#10b981', icon: Brain, desc: 'Inference' },
  { id: 'zep-api', name: 'Zep Memory', color: '#3b82f6', icon: HardDrive, desc: 'Long-term Mem' },
];

const AGENT_SYSTEMS = [
  { id: 'comms-agent', name: 'Comms', color: '#f97316', icon: MessageSquare },
  { id: 'inbox-agent', name: 'Inbox', color: '#06b6d4', icon: Share2 },
  { id: 'legal-agent', name: 'Legal', color: '#8b5cf6', icon: ShieldCheck },
  { id: 'finance-agent', name: 'Finance', color: '#22c55e', icon: Wallet },
  { id: 'eeg-agent', name: 'EEG', color: '#ec4899', icon: Zap },
];

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  idle: '#64748b',
  error: '#ef4444',
  disabled: '#334155',
};

const CONNECTION_COLORS: Record<string, string> = {
  data: '#3b82f6',
  event: '#8b5cf6',
  command: '#f59e0b',
};

type ConnectionFilter = 'all' | 'data' | 'event' | 'command';

export function AgentAnatomyNetwork() {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(0.85);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<number | null>(null);
  const [activityPulses, setActivityPulses] = useState<string[]>([]);
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const { data, mutate, isLoading } = useSWR<AnatomyData>('/api/pm/anatomy', fetcher, {
    refreshInterval: 5000,
  });

  // Deep Link Handling
  useEffect(() => {
    const focusId = searchParams.get('anatomy_focus');
    if (focusId) {
      setSelectedNode(focusId);
      setExpanded(true); // Auto-expand when focused via link
      // Scroll into view if needed
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchParams]);

  // Pan & Zoom State
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 960, h: 1100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Handle Pan Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const dx = (e.clientX - dragStart.x) * (viewBox.w / container.clientWidth);
      const dy = (e.clientY - dragStart.y) * (viewBox.h / container.clientHeight);

      setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, dragStart, viewBox.w, viewBox.h]);

  // Removed inline handleMouseMove/Up as we use window listeners now

  // Zoom Handling
  const handleZoom = (factor: number) => {
    setViewBox(prev => ({
      ...prev,
      w: prev.w * factor,
      h: prev.h * factor,
      x: prev.x + (prev.w - prev.w * factor) / 2, // Zoom to center
      y: prev.y + (prev.h - prev.h * factor) / 2
    }));
    setZoom(z => z / factor); // Keep track of scale for UI display only
  };

  // Prevent drag from selecting text
  useEffect(() => {
    const preventSelect = (e: Event) => e.preventDefault();
    if (isDragging) window.addEventListener('selectstart', preventSelect);
    return () => window.removeEventListener('selectstart', preventSelect);
  }, [isDragging]);

  // Real-time Activity Monitoring
  const lastProcessedLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.recentActivity || data.recentActivity.length === 0) return;

    // Sort by time descending (newest first)
    const newestLogs = [...data.recentActivity].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latest = newestLogs[0];

    // If we have a new latest log than before
    if (latest.id !== lastProcessedLogRef.current) {
      lastProcessedLogRef.current = latest.id;

      // Trigger pulse for the module in question
      const moduleId = latest.module;
      if (moduleId) {
        setActivityPulses(prev => [...prev, moduleId]);
        setTimeout(() => setActivityPulses(prev => prev.filter(id => id !== moduleId)), 1500);
      }
    }
  }, [data?.recentActivity]);

  const modules = data?.modules || [];
  const connections = data?.connections || [];

  // Augmented Connections
  const allConnections = useMemo(() => {
    const activeIf = (id: string) => modules.find(m => m.id === id)?.status === 'active';

    const ext: ModuleConnection[] = [
      { from: 'github-api', to: 'github-client', type: 'data', label: 'REST/GraphQL', active: activeIf('github-client') },
      { from: 'openrouter-api', to: 'task-completion', type: 'data', label: 'Completion', active: activeIf('task-completion') },
      { from: 'openrouter-api', to: 'commit-intelligence', type: 'data', label: 'Analysis', active: activeIf('commit-intelligence') },
      { from: 'openrouter-api', to: 'repo-organizer', type: 'data', label: 'Intelligence', active: activeIf('repo-organizer') },
      { from: 'zep-api', to: 'pm-memory', type: 'data', label: 'Vector Store', active: activeIf('pm-memory') },
      // Implicit flows
      { from: 'pm-memory', to: 'commit-intelligence', type: 'data', active: activeIf('pm-memory') },
      { from: 'temporal-context', to: 'pm-actions', type: 'event', active: true },
      { from: 'task-queue', to: 'pm-actions', type: 'command', active: activeIf('task-queue') },
    ];
    return [...ext, ...connections];
  }, [modules, connections]);

  const filteredConnections = useMemo(() => {
    if (connectionFilter === 'all') return allConnections;
    return allConnections.filter(c => c.type === connectionFilter);
  }, [allConnections, connectionFilter]);

  // Focus Mode Logic
  const getFocusState = (nodeId: string) => {
    if (!selectedNode && !hoveredNode) return 'normal';
    const focalPoint = hoveredNode || selectedNode;
    if (nodeId === focalPoint) return 'focused';

    // Check if connected
    const isConnected = allConnections.some(c =>
      (c.from === focalPoint && c.to === nodeId) ||
      (c.to === focalPoint && c.from === nodeId)
    );

    return isConnected ? 'connected' : 'dimmed';
  };

  const svgWidth = 960;
  const svgHeight = 1100;

  return (
    <div
      ref={containerRef}
      className={`group relative rounded-xl border border-white/10 bg-slate-950 overflow-hidden transition-all duration-500 shadow-2xl 
         ${expanded ? 'fixed inset-0 z-[1000] m-4 border-indigo-500/30' : 'h-[600px] hover:border-white/20'}`}
    >
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/5 blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/5 blur-[150px] animate-pulse-slow delay-1000" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none select-none"
        style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          backgroundPosition: `${-viewBox.x}px ${-viewBox.y}px`, // Sync grid with pan
          transform: `scale(${1 / zoom})`, // Inverse scale for grid consistency
          transformOrigin: '0 0'
        }}
      />

      {/* UI Controls Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-start justify-between bg-gradient-to-b from-slate-950/90 to-transparent pointer-events-none select-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 backdrop-blur-md">
            <Activity className="text-indigo-400 w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-bold tracking-tight text-shadow-sm">System Anatomy</h3>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ONLINE
              <span className="text-slate-600">|</span>
              {modules.length} NODES
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex bg-slate-900/50 backdrop-blur-md rounded-lg border border-white/5 p-1">
            <button onClick={() => setShowFilters(!showFilters)} className={`p-1.5 rounded-md transition ${showFilters ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-white'}`}>
              <Filter size={16} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button onClick={() => handleZoom(1.2)} className="p-1.5 text-slate-400 hover:text-white"><ZoomOut size={16} /></button>
            <span className="text-[10px] font-mono text-slate-500 w-8 text-center py-1.5">{Math.round(100 / zoom)}%</span>
            <button onClick={() => handleZoom(0.8)} className="p-1.5 text-slate-400 hover:text-white"><ZoomIn size={16} /></button>
          </div>

          <button onClick={() => mutate()} className={`p-2 bg-slate-900/50 backdrop-blur-md rounded-lg border border-white/5 text-slate-400 hover:text-white transition ${isLoading ? 'animate-spin' : ''}`}>
            <RefreshCw size={18} />
          </button>

          <button onClick={() => setExpanded(!expanded)} className="p-2 bg-slate-900/50 backdrop-blur-md rounded-lg border border-white/5 text-slate-400 hover:text-white transition">
            {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`absolute top-20 left-4 z-20 pointer-events-auto transition-all duration-300 ${showFilters ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <div className="flex flex-col gap-1 bg-slate-900/80 backdrop-blur-xl p-2 rounded-lg border border-white/10 shadow-xl">
          {(['all', 'data', 'event', 'command'] as ConnectionFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setConnectionFilter(f)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition w-32 ${connectionFilter === f ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:bg-white/5'
                }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${f === 'all' ? 'bg-slate-400' : ''}`} style={{ backgroundColor: f !== 'all' ? CONNECTION_COLORS[f] : undefined }} />
              <span className="capitalize">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Graph Area */}
      <div
        className={`absolute inset-0 overflow-hidden flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
      >
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          className="w-full h-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="glow-strong">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>
            <mask id="pulse-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="black" />
              <circle cx="50%" cy="50%" r="40%" fill="white" />
            </mask>
          </defs>

          {/* Layer Backgrounds */}
          {LAYER_LABELS.map((layer, i) => (
            <g key={`layer-${i}`} opacity={0.1}>
              <text
                x={20}
                y={layer.y}
                className="text-[10px] fill-indigo-300 font-mono tracking-[0.2em] font-bold"
                style={{ textShadow: '0 0 10px rgba(99,102,241,0.5)' }}
              >
                // {layer.label}
              </text>
              <line
                x1={160}
                y1={layer.y}
                x2={960 - 20}
                y2={layer.y}
                stroke="#6366f1"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
            </g>
          ))}

          {/* Connections */}
          {filteredConnections.map((conn, i) => {
            const fromPos = NODE_POSITIONS[conn.from];
            const toPos = NODE_POSITIONS[conn.to];
            if (!fromPos || !toPos) return null;

            const focusState = selectedNode || hoveredNode ? (
              (selectedNode === conn.from || selectedNode === conn.to || hoveredNode === conn.from || hoveredNode === conn.to)
                ? 'focused' : 'dimmed'
            ) : 'normal';

            const baseColor = CONNECTION_COLORS[conn.type] || '#64748b';
            const isActive = conn.active;
            const isDimmed = focusState === 'dimmed';

            // Advanced Bezier Logic
            const dy = toPos.y - fromPos.y;
            const dx = toPos.x - fromPos.x;
            // Control points calculated for organic flow
            const cp1x = fromPos.x;
            const cp1y = fromPos.y + (dy * 0.5);
            const cp2x = toPos.x;
            const cp2y = toPos.y - (dy * 0.5);

            const pathD = `M ${fromPos.x} ${fromPos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPos.x} ${toPos.y}`;

            return (
              <g
                key={`conn-${i}`}
                className={`transition-opacity duration-300 ${isDimmed ? 'opacity-10' : 'opacity-100'}`}
                onMouseEnter={() => setHoveredConnection(i)}
                onMouseLeave={() => setHoveredConnection(null)}
              >
                {/* Hit Area */}
                <path d={pathD} stroke="transparent" strokeWidth="30" fill="none" className="cursor-pointer" />

                {/* Base Line */}
                <path
                  d={pathD}
                  stroke={baseColor}
                  strokeWidth={isActive ? 1.5 : 1}
                  strokeOpacity={isActive ? 0.3 : 0.1}
                  fill="none"
                  strokeDasharray={isActive ? 'none' : '4 4'}
                />

                {/* Animated Flow Packet */}
                {isActive && !isDimmed && (
                  <>
                    <path
                      d={pathD}
                      stroke={`url(#edge-gradient)`}
                      strokeWidth="2"
                      strokeDasharray="10 100"
                      strokeLinecap="round"
                      className="animate-flow opacity-60"
                      fill="none"
                      style={{ animationDuration: conn.type === 'data' ? '3s' : '5s' }}
                    >
                      <animate attributeName="stroke-dashoffset" from="110" to="0" dur={conn.type === 'data' ? '2s' : '4s'} repeatCount="indefinite" />
                    </path>
                    {/* Glowing Head */}
                    <circle r="2" fill={baseColor}>
                      <animateMotion dur={conn.type === 'data' ? '2s' : '4s'} repeatCount="indefinite" path={pathD} />
                    </circle>
                  </>
                )}
              </g>
            );
          })}

          {/* Nodes Implementation via ForeignObject for HTML Power */}

          {/* 1. AGENT SWARM NODES */}
          {AGENT_SYSTEMS.map(agent => {
            const pos = NODE_POSITIONS[agent.id];
            if (!pos) return null;
            const focus = getFocusState(agent.id);
            const isDimmed = focus === 'dimmed';
            const isFocused = focus === 'focused';

            return (
              <foreignObject
                key={agent.id}
                x={pos.x - 50}
                y={pos.y - 50}
                width="100"
                height="100"
                className={`transition-opacity duration-300 ${isDimmed ? 'opacity-20 blur-[1px]' : 'opacity-100'}`}
              >
                <div
                  className="w-full h-full flex flex-col items-center justify-center group cursor-pointer"
                  onClick={() => setSelectedNode(selectedNode === agent.id ? null : agent.id)}
                  onMouseEnter={() => setHoveredNode(agent.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <div className={`relative w-12 h-12 rounded-full bg-slate-900 border flex items-center justify-center transition-all duration-300 ${isFocused
                    ? `border-${agent.color} shadow-[0_0_20px_${agent.color}60] scale-110`
                    : `border-slate-700 hover:border-${agent.color} hover:scale-105`
                    }`} style={{ borderColor: isFocused ? agent.color : undefined }}>

                    {/* Ring Animation */}
                    <div className={`absolute inset-0 rounded-full border border-${agent.color} opacity-0 transition-all duration-500 ${isFocused ? 'animate-ping opacity-30' : ''}`} style={{ borderColor: agent.color }} />

                    <agent.icon size={20} color={agent.color} strokeWidth={2.5} />

                    {/* Connection Status Dot */}
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-slate-900 rounded-full border border-slate-700 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                  </div>

                  <div className={`mt-2 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-bold tracking-wider text-slate-300 transition-all ${isFocused ? 'text-white border-white/20' : ''}`}>
                    {agent.name.toUpperCase()}
                  </div>
                </div>
              </foreignObject>
            );
          })}

          {/* 2. EXTERNAL NODES */}
          {EXT_SYSTEMS.map(sys => {
            const pos = NODE_POSITIONS[sys.id];
            if (!pos) return null;
            const focus = getFocusState(sys.id);
            const isDimmed = focus === 'dimmed';
            const isFocused = focus === 'focused';

            return (
              <foreignObject
                key={sys.id}
                x={pos.x - 70}
                y={pos.y - 40}
                width="140"
                height="80"
                className={`transition-opacity duration-300 ${isDimmed ? 'opacity-20 blur-[1px]' : 'opacity-100'}`}
              >
                <div
                  className="w-full h-full flex items-center justify-center"
                  onClick={() => setSelectedNode(selectedNode === sys.id ? null : sys.id)}
                  onMouseEnter={() => setHoveredNode(sys.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <div className={`
                     relative w-full h-[60px] rounded-xl border flex flex-row items-center gap-3 px-3 overflow-hidden cursor-pointer transition-all duration-300 bg-slate-900/90 backdrop-blur-md
                     ${isFocused ? 'border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.1)] scale-105' : 'border-white/10 hover:border-white/20 hover:bg-slate-800/80'}
                   `}
                    style={{ borderColor: isFocused ? sys.color : undefined, boxShadow: isFocused ? `0 0 20px ${sys.color}20` : undefined }}
                  >
                    {/* Hexagon BG pattern */}
                    <div className="absolute right-0 top-0 bottom-0 w-16 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-contain" />

                    <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                      <sys.icon size={18} color={sys.color} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">{sys.name}</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">{sys.desc}</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            );
          })}

          {/* 3. INTERNAL MODULES */}
          {modules.map(mod => {
            const pos = NODE_POSITIONS[mod.id];
            if (!pos) return null;
            const focus = getFocusState(mod.id);
            const isDimmed = focus === 'dimmed';
            const isFocused = focus === 'focused';
            const isPulsing = activityPulses.includes(mod.id);
            const Icon = mod.type === 'core' ? Cpu : mod.type === 'storage' ? Database : mod.type === 'integration' ? GitBranch : mod.type === 'intelligence' ? Brain : Server;

            return (
              <foreignObject
                key={mod.id}
                x={pos.x - 90}
                y={pos.y - 45} // Centered vertically on pos.y
                width="180"
                height="90"
                className={`transition-all duration-500 ${isDimmed ? 'opacity-20 blur-[1px] grayscale' : 'opacity-100'}`}
              >
                <div
                  className="w-full h-full p-2 flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); setSelectedNode(selectedNode === mod.id ? null : mod.id); }}
                  onMouseEnter={() => setHoveredNode(mod.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Main Tech Card */}
                  <div className={`
                      relative w-full h-[60px] flex items-center justify-between px-3 rounded-lg border backdrop-blur-xl transition-all duration-300
                      ${isFocused
                      ? 'bg-indigo-950/40 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-105 z-10'
                      : 'bg-slate-900/80 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-500'
                    }
                      ${isPulsing ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/50' : ''}
                   `}>
                    {/* Active Pulse Border Overlay */}
                    {isPulsing && (
                      <div className="absolute inset-0 rounded-lg border border-emerald-400 opacity-50 animate-ping pointer-events-none" />
                    )}

                    <div className="flex items-center gap-3 z-10">
                      {/* Icon Box */}
                      <div className={`
                           w-8 h-8 rounded flex items-center justify-center border transition-colors
                           ${mod.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}
                         `}>
                        <Icon size={14} className={mod.status === 'active' ? 'text-emerald-400' : 'text-slate-500'} />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className={`text-[11px] font-bold truncate transition-colors ${isFocused ? 'text-white' : 'text-slate-300'}`}>
                          {mod.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${mod.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest">{mod.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini Metrics Bar */}
                    {mod.metrics && (
                      <div className="absolute bottom-[-6px] left-3 right-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-1000"
                          style={{ width: `${Math.min(100, (mod.metrics.calls || 0) / 2)}%` }}
                        />
                      </div>
                    )}

                    {/* Decorative corner accents */}
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr-sm" />
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl-sm" />
                  </div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>

      {/* Overlay: Selection Details Panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 z-30 pointer-events-auto">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">{selectedNode}</h4>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                ID: {selectedNode} | LAYER: {NODE_POSITIONS[selectedNode]?.layer ?? '?'}
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white"><Minimize2 size={14} /></button>
          </div>
          <div className="mt-3 py-2 border-t border-white/5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Status</span>
              <span className="text-emerald-400 font-bold uppercase">Active</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Connections</span>
              <span className="text-indigo-400 font-mono">
                {allConnections.filter(c => c.from === selectedNode || c.to === selectedNode).length} LINKS
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
