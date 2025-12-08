'use client';

/**
 * Agent Anatomy Card
 * 
 * Premium "Ultra-Edge" visual skeleton showing the PM agent's internal structure.
 * Features:
 * - High-end Glassmorphism
 * - Mini-map visualization in collapsed state
 * - Tech-styled module list items
 * - Real-time "Console" style activity log
 */

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import {
  Activity,
  Box,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  GitBranch,
  Cpu,
  Zap,
  Brain,
  Server,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  Minimize2,
  Maximize2,
  Terminal
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface AgentModule {
  id: string;
  name: string;
  type: 'core' | 'integration' | 'storage' | 'intelligence' | 'api';
  status: 'active' | 'idle' | 'error' | 'disabled';
  description: string;
  filePath: string;
  lastActivity?: string;
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

// Real-time health status from AgentInvoker
type HealthStatus = 'healthy' | 'idle' | 'degraded' | 'offline';

interface HealthData {
  status: HealthStatus;
  lastActivityAgo: string;
  memoryStatus: 'connected' | 'latent' | 'unavailable';
  memoryLatencyMs: number | null;
  recentErrorCount: number;
  totalRecentCalls: number;
  avgTokenUsage: number;
  avgResponseLatencyMs: number;
  healthScore: number;
  tokenUsageTrend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
}

interface AnatomyData {
  ok: boolean;
  agent: {
    id: string;
    name: string;
    version: string;
    status: 'healthy' | 'degraded' | 'error';
    uptime: string;
  };
  modules: AgentModule[];
  connections: ModuleConnection[];
  recentActivity: ActivityLog[];
  metrics: {
    totalCalls: number;
    avgResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
  // Real-time health from AgentInvoker
  health?: HealthData;
}

const MODULE_ICONS: Record<string, any> = {
  core: Cpu,
  integration: GitBranch,
  storage: Database,
  intelligence: Brain,
  api: Server,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.2)]' },
  idle: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', glow: '' },
  error: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_10px_rgba(244,63,94,0.2)]' },
  disabled: { bg: 'bg-slate-800/50', text: 'text-slate-600', border: 'border-slate-700/30', glow: '' },
};

// Health status styling (for real-time agent health)
const HEALTH_STYLES: Record<HealthStatus, { bg: string; text: string; border: string; glow: string; label: string }> = {
  healthy: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]', label: 'HEALTHY' },
  idle: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', glow: '', label: 'IDLE' },
  degraded: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.2)]', label: 'DEGRADED' },
  offline: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_10px_rgba(244,63,94,0.3)]', label: 'OFFLINE' },
};

// Memory status styling
const MEMORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  connected: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-500' },
  latent: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-500' },
  unavailable: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: 'text-rose-500' },
};

export function AgentAnatomyCard({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'modules' | 'connections' | 'activity'>('modules');

  // Always fetch to keep mini-map alive, but maybe with longer interval if collapsed
  const { data, error, mutate } = useSWR<AnatomyData>(
    '/api/pm/anatomy',
    fetcher,
    { refreshInterval: expanded ? 5000 : 15000 }
  );

  const isLoading = !data && !error;
  const agent = data?.agent;
  const modules = data?.modules || [];
  const connections = data?.connections || [];
  const activity = data?.recentActivity || [];
  const metrics = data?.metrics;
  const health = data?.health;

  // Mini-map visualization for collapsed state
  const MiniMap = () => (
    <div className="flex items-center gap-1 h-8 opacity-70">
      {modules.slice(0, 8).map((m, i) => (
        <div key={m.id} className="relative group/dot">
          <div className={`
                w-1.5 h-6 rounded-full transition-all duration-500
                ${m.status === 'active' ? 'bg-emerald-500 h-6' : m.status === 'error' ? 'bg-rose-500 h-6' : 'bg-slate-700 h-3'}
                ${m.status === 'active' ? 'animate-pulse' : ''}
             `} />
          {/* Tooltip */}
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-[10px] text-white rounded opacity-0 group-hover/dot:opacity-100 whitespace-nowrap pointer-events-none z-10">
            {m.name}
          </div>
        </div>
      ))}
      {modules.length > 8 && <div className="w-1.5 h-1.5 rounded-full bg-slate-700 ml-1" />}
    </div>
  );

  if (!expanded) {
    const healthStyle = health ? HEALTH_STYLES[health.status] : null;

    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 hover:bg-slate-900/90 transition-all duration-300 p-4 text-left backdrop-blur-md shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-900 via-transparent to-transparent opacity-50" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Layers size={20} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-200 group-hover:text-white transition-colors tracking-tight">Agent Anatomy</h3>
                {healthStyle && (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${healthStyle.border} ${healthStyle.bg} ${healthStyle.text}`}>
                    {healthStyle.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {data ? (
                  <>
                    <MiniMap />
                    {health && (
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        {health.lastActivityAgo}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{metrics?.activeConnections || 0} LINKS</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">Initializing...</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <div className="text-right">
                <div className="text-[9px] text-slate-500 uppercase">HEALTH</div>
                <div className={`text-sm font-bold ${healthStyle?.text || 'text-slate-400'}`}>{health.healthScore}%</div>
              </div>
            )}
            <ChevronRight size={20} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
          </div>
        </div>
      </button>
    );
  }

  // Group modules by type
  const modulesByType = modules.reduce((acc, mod) => {
    if (!acc[mod.type]) acc[mod.type] = [];
    acc[mod.type].push(mod);
    return acc;
  }, {} as Record<string, AgentModule[]>);

  // Get connections for selected module
  const selectedConnections = selectedModule
    ? connections.filter(c => c.from === selectedModule || c.to === selectedModule)
    : [];

  // Last Sync Logic
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('0s');

  // Update timestamp when data arrives
  useMemo(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  // Tick timer
  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
      setTimeSinceUpdate(diff < 60 ? `${diff}s` : `${Math.floor(diff / 60)}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Get health styling
  const healthStyle = health ? HEALTH_STYLES[health.status] : null;
  const memoryStyle = health ? MEMORY_STYLES[health.memoryStatus] : null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl overflow-hidden shadow-2xl transition-all duration-300">

      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-slate-900/50 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Layers size={20} className="text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white tracking-tight text-lg">Agent Anatomy</h3>
                {/* Real-time health status badge */}
                {healthStyle && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${healthStyle.border} ${healthStyle.bg} ${healthStyle.text} ${healthStyle.glow}`}>
                    {healthStyle.label}
                  </span>
                )}
                {/* Legacy agent status fallback */}
                {!health && agent && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${agent.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    agent.status === 'degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                    {agent.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : health?.status === 'idle' ? 'bg-sky-500' : health?.status === 'degraded' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
                {agent ? `${agent.name.toUpperCase()} v${agent.version}` : 'SYNCING...'}
                {health && <span className="text-slate-500">| Last: {health.lastActivityAgo}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Health Score Badge */}
            {health && (
              <div className={`px-3 py-1.5 rounded-lg border ${healthStyle?.border} ${healthStyle?.bg} mr-2`}>
                <div className="text-[9px] text-slate-400 uppercase tracking-widest">HEALTH</div>
                <div className={`text-lg font-bold ${healthStyle?.text}`}>{health.healthScore}%</div>
              </div>
            )}
            <div className="text-[10px] font-mono text-slate-500 mr-2">
              SYNC: <span className="text-emerald-500">{timeSinceUpdate} ago</span>
            </div>
            <button
              onClick={() => mutate()}
              className={`p-2 rounded-lg bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 text-slate-400 hover:text-white transition ${isLoading ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="p-2 rounded-lg bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Health Metrics Bar - Derived from AgentInvoker */}
        {health && (
          <div className="grid grid-cols-5 gap-2 pt-2 mb-3">
            <div className={`p-2 rounded-lg border ${memoryStyle?.bg || 'bg-slate-900/60'} border-white/5 flex flex-col justify-center`}>
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">ZEP MEMORY</div>
              <div className={`text-sm font-bold flex items-center gap-2 ${memoryStyle?.text || 'text-slate-400'}`}>
                {health.memoryStatus.toUpperCase()}
                <Database size={10} className={memoryStyle?.icon || 'text-slate-500'} />
              </div>
              {health.memoryLatencyMs !== null && (
                <div className="text-[9px] text-slate-500 mt-0.5">{health.memoryLatencyMs}ms latency</div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">CALLS</div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                {health.totalRecentCalls}
                <Activity size={10} className="text-indigo-400" />
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">AVG LATENCY</div>
              <div className={`text-sm font-bold flex items-center gap-2 ${health.avgResponseLatencyMs > 2000 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {health.avgResponseLatencyMs}ms
                <Clock size={10} />
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">ERRORS</div>
              <div className={`text-sm font-bold flex items-center gap-2 ${health.recentErrorCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {health.recentErrorCount}
                <AlertTriangle size={10} />
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">TOKEN TREND</div>
              <div className={`text-sm font-bold flex items-center gap-2 ${health.tokenUsageTrend === 'increasing' ? 'text-amber-400' : health.tokenUsageTrend === 'decreasing' ? 'text-emerald-400' : 'text-slate-300'}`}>
                {health.tokenUsageTrend === 'increasing' ? 'UP' : health.tokenUsageTrend === 'decreasing' ? 'DOWN' : health.tokenUsageTrend === 'stable' ? 'STABLE' : 'N/A'}
                <Zap size={10} />
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">avg: {health.avgTokenUsage}</div>
            </div>
          </div>
        )}

        {/* Legacy Metrics Bar (fallback when health unavailable) */}
        {!health && metrics && (
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              { label: 'TOTAL CALLS', value: metrics.totalCalls, icon: Activity, color: 'text-indigo-400' },
              { label: 'LATENCY', value: `${metrics.avgResponseTime}ms`, icon: Clock, color: 'text-emerald-400' },
              { label: 'LINKS', value: metrics.activeConnections, icon: Zap, color: 'text-amber-400' },
              { label: 'ERRORS', value: `${(metrics.errorRate * 100).toFixed(1)}%`, icon: AlertTriangle, color: metrics.errorRate > 0 ? 'text-rose-400' : 'text-slate-400' }
            ].map((stat, i) => (
              <div key={i} className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-0.5">{stat.label}</div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  {stat.value}
                  <stat.icon size={10} className={stat.color} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-white/5 px-2 bg-slate-900/30">
        {[
          { key: 'modules', label: 'Modules', icon: Box },
          { key: 'connections', label: 'Connections', icon: GitBranch },
          { key: 'activity', label: 'Log', icon: Terminal },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = viewMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition relative ${isActive
                ? 'text-indigo-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
            >
              <Icon size={14} />
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar bg-slate-950/50">
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw size={24} className="text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-500 font-mono">ESTABLISHING NEURAL LINK...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
            <AlertTriangle size={32} className="mx-auto text-rose-400 mb-2" />
            <p className="text-rose-400 font-medium">Neural Link Failed</p>
            <p className="text-xs text-rose-400/70 mt-1">Could not retrieve anatomy data</p>
          </div>
        ) : viewMode === 'modules' ? (
          /* Modules View (Tech Bars) */
          <div className="space-y-6">
            {Object.entries(modulesByType).map(([type, mods]) => {
              const Icon = MODULE_ICONS[type] || Box;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 pb-1 border-b border-white/5">
                    <Icon size={12} className="text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      {type}
                    </span>
                    <span className="ml-auto text-[9px] font-mono text-slate-600">[{mods.length}]</span>
                  </div>
                  <div className="grid gap-2">
                    {mods.map(mod => {
                      const style = STATUS_STYLES[mod.status];
                      const isSelected = selectedModule === mod.id;
                      return (
                        <div key={mod.id} className="relative group">
                          {/* Selection Indicator */}
                          {isSelected && <div className="absolute -left-1 top-2 bottom-2 w-0.5 bg-indigo-500 rounded-full" />}

                          <button
                            onClick={() => setSelectedModule(isSelected ? null : mod.id)}
                            className={`w-full text-left p-3 rounded-md border transition-all duration-200 overflow-hidden ${isSelected
                              ? 'border-indigo-500/50 bg-indigo-500/10'
                              : `border-slate-800 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/80`
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${mod.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
                                  <span className={`font-mono text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{mod.name}</span>
                                </div>
                                {/* Tech Line Decor */}
                                <div className="h-px w-12 bg-slate-800 my-2" />

                                <p className="text-[11px] text-slate-500 truncate group-hover:text-slate-400 transition-colors">{mod.description}</p>

                                {isSelected && (
                                  <div className="mt-3 pt-3 border-t border-white/5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-black/40 p-2 rounded border border-white/5">
                                      <Server size={10} />
                                      <span className="truncate">{mod.filePath}</span>
                                    </div>

                                    {mod.metrics && (
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 rounded bg-slate-800/50 text-center border border-white/5">
                                          <div className="text-[9px] text-slate-500 uppercase">Calls</div>
                                          <div className="text-xs font-bold text-white font-mono">{mod.metrics.calls || 0}</div>
                                        </div>
                                        <div className="p-2 rounded bg-slate-800/50 text-center border border-white/5">
                                          <div className="text-[9px] text-slate-500 uppercase">Lat</div>
                                          <div className="text-xs font-bold text-emerald-400 font-mono">{mod.metrics.avgLatency || 0}ms</div>
                                        </div>
                                        <div className="p-2 rounded bg-slate-800/50 text-center border border-white/5">
                                          <div className="text-[9px] text-slate-500 uppercase">Err</div>
                                          <div className={`text-xs font-bold font-mono ${mod.metrics.errorRate ? 'text-rose-400' : 'text-slate-300'}`}>
                                            {((mod.metrics.errorRate || 0) * 100).toFixed(1)}%
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {selectedConnections.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Links</p>
                                        <div className="space-y-1">
                                          {selectedConnections.map((conn, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-slate-800/30 border border-white/5 font-mono">
                                              <span className={conn.from === mod.id ? 'text-slate-500' : 'text-indigo-300'}>
                                                {conn.from === mod.id ? 'THIS' : conn.from}
                                              </span>
                                              <ArrowRight size={8} className="text-slate-600" />
                                              <span className={conn.to === mod.id ? 'text-slate-500' : 'text-indigo-300'}>
                                                {conn.to === mod.id ? 'THIS' : conn.to}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${style.border} ${style.bg} ${style.text}`}>
                                {mod.status}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'connections' ? (
          /* Connections View */
          <div className="space-y-2">
            {connections.map((conn, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${conn.active
                  ? 'border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50'
                  : 'border-slate-800 bg-slate-900/20 opacity-50'
                  }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${conn.active ? 'bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-300 font-mono font-bold">{conn.from}</span>
                      <ArrowRight size={10} className="text-slate-600" />
                      <span className="text-indigo-300 font-mono font-bold">{conn.to}</span>
                    </div>
                    <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${conn.type === 'data' ? 'border-sky-500/30 text-sky-400 bg-sky-500/10' :
                      conn.type === 'event' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                        'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      }`}>
                      {conn.type}
                    </span>
                  </div>
                  {conn.label && <div className="text-[10px] text-slate-500 mt-1 pl-4 border-l border-slate-700">{conn.label}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Activity View (Console Style) */
          <div className="space-y-1 font-mono text-xs">
            {activity.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl opacity-50">
                <Terminal size={20} className="mx-auto text-slate-500 mb-2" />
                <p className="text-slate-500">System idle. No recent events.</p>
              </div>
            ) : (
              activity.map(log => (
                <div
                  key={log.id}
                  className="flex gap-3 p-2 rounded border border-transparent hover:bg-slate-800/50 hover:border-white/5 transition-colors group"
                >
                  <div className="text-slate-500 whitespace-nowrap opacity-50 w-16">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="flex-1 break-all">
                    <span className={
                      log.status === 'success' ? 'text-emerald-500' :
                        log.status === 'error' ? 'text-rose-500' : 'text-amber-500'
                    }>
                      def {log.module}
                    </span>
                    <span className="text-slate-400">::{log.action}</span>
                    {log.details && <span className="text-slate-600 ml-2"># {log.details}</span>}
                  </div>
                  {log.duration && (
                    <div className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {log.duration}ms
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
