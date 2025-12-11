"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
    Activity,
    Brain,
    Clock,
    Database,
    GitBranch,
    Lightbulb,
    MessageSquare,
    RefreshCw,
    Zap,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Timer,
    ChevronRight,
    Cpu,
    Network,
    ArrowRight,
    Radio,
} from 'lucide-react';
import Link from 'next/link';
import type { TelemetryData, HealthStatus } from '@/lib/types/systems-telemetry';
import { formatTimeUntil } from '@/lib/types/systems-telemetry';

// Animated pulse for active systems
const PulseIndicator = ({ active, color }: { active: boolean; color: string }) => (
    <div className="relative">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        {active && (
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${color} animate-ping opacity-75`} />
        )}
    </div>
);

// Status badge component
const StatusBadge = ({ status }: { status: 'healthy' | 'degraded' | 'critical' | boolean }) => {
    const config = typeof status === 'boolean'
        ? status
            ? { icon: CheckCircle2, text: 'Online', bg: 'bg-nano-green/20', border: 'border-nano-green', color: 'text-nano-green' }
            : { icon: XCircle, text: 'Offline', bg: 'bg-brutalist-accent/20', border: 'border-brutalist-accent', color: 'text-brutalist-accent' }
        : status === 'healthy'
            ? { icon: CheckCircle2, text: 'Healthy', bg: 'bg-nano-green/20', border: 'border-nano-green', color: 'text-nano-green' }
            : status === 'degraded'
                ? { icon: AlertTriangle, text: 'Degraded', bg: 'bg-banana-400/20', border: 'border-banana-400', color: 'text-banana-400' }
                : { icon: XCircle, text: 'Critical', bg: 'bg-brutalist-accent/20', border: 'border-brutalist-accent', color: 'text-brutalist-accent' };

    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border ${config.bg} ${config.border}`}>
            <Icon size={12} className={config.color} />
            <span className={`text-xs font-mono font-bold uppercase ${config.color}`}>{config.text}</span>
        </div>
    );
};

// System card component
const SystemCard = ({
    title,
    icon: Icon,
    online,
    children,
    accentColor = 'nano-green'
}: {
    title: string;
    icon: React.ElementType;
    online: boolean;
    children: React.ReactNode;
    accentColor?: string;
}) => (
    <div className={`bg-slate-900/60 backdrop-blur-sm border-2 ${online ? `border-${accentColor}/30` : 'border-slate-700'} rounded-sm p-4 transition-all hover:shadow-lg ${online ? `hover:shadow-${accentColor}/10` : ''}`}>
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-sm ${online ? `bg-${accentColor}/20` : 'bg-slate-800'}`}>
                    <Icon size={18} className={online ? `text-${accentColor}` : 'text-slate-500'} />
                </div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
                    {title}
                </h3>
            </div>
            <PulseIndicator active={online} color={online ? `bg-${accentColor}` : 'bg-slate-600'} />
        </div>
        {children}
    </div>
);

// Event source visualization
const EventSourceBar = ({ source, count, maxCount }: { source: string; count: number; maxCount: number }) => {
    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
    const colors: Record<string, string> = {
        'imessage': 'bg-nano-cyan',
        'email': 'bg-nano-green',
        'calendar': 'bg-banana-400',
        'limitless': 'bg-purple-400',
        'legal': 'bg-brutalist-accent',
        'finance': 'bg-emerald-400',
        'proactive': 'bg-orange-400',
    };
    const color = colors[source.toLowerCase()] || 'bg-slate-500';

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-400 w-20 truncate">{source}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="font-mono text-slate-300 w-8 text-right">{count}</span>
        </div>
    );
};

// Decision priority indicator
const PriorityBadge = ({ priority, count }: { priority: string; count: number }) => {
    const colors: Record<string, string> = {
        critical: 'bg-brutalist-accent text-white',
        high: 'bg-orange-500 text-white',
        medium: 'bg-banana-400 text-slate-900',
        low: 'bg-slate-600 text-slate-200',
    };

    return (
        <div className={`px-2 py-0.5 rounded-sm text-xs font-mono font-bold ${colors[priority] || 'bg-slate-700'}`}>
            {priority.toUpperCase()}: {count}
        </div>
    );
};

// Cron job row
const CronJobRow = ({ job }: { job: TelemetryData['cronJobs'][0] }) => {
    const nextRunDate = job.nextRun ? new Date(job.nextRun) : null;
    const timeUntil = nextRunDate ? Math.max(0, (nextRunDate.getTime() - Date.now()) / 1000) : null;

    const formatTimeUntil = (seconds: number) => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    };

    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
            <div className="flex items-center gap-3">
                <Clock size={12} className="text-nano-cyan" />
                <div>
                    <span className="text-xs font-mono text-slate-200">{job.name}</span>
                    <span className="text-xs text-slate-500 ml-2">({job.schedule})</span>
                </div>
            </div>
            {timeUntil !== null && (
                <div className="flex items-center gap-2">
                    <Timer size={10} className="text-slate-500" />
                    <span className="text-xs font-mono text-nano-green">{formatTimeUntil(timeUntil)}</span>
                </div>
            )}
        </div>
    );
};

// Learning insight card
const InsightCard = ({ insight }: { insight: NonNullable<TelemetryData['learningSystem']>['recentInsights'][0] }) => {
    const typeColors: Record<string, string> = {
        pattern_to_rule: 'bg-nano-cyan/20 border-nano-cyan text-nano-cyan',
        decision_to_correction: 'bg-banana-400/20 border-banana-400 text-banana-400',
        preference_update: 'bg-nano-green/20 border-nano-green text-nano-green',
    };

    return (
        <div className="bg-slate-800/50 rounded-sm p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm border ${typeColors[insight.type] || 'bg-slate-700 border-slate-600 text-slate-300'}`}>
                    {insight.type.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                        {insight.source} → {insight.target}
                    </span>
                    {insight.applied ? (
                        <CheckCircle2 size={12} className="text-nano-green" />
                    ) : (
                        <Clock size={12} className="text-slate-500" />
                    )}
                </div>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2">{insight.description}</p>
        </div>
    );
};

export default function SystemsPage() {
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchTelemetry = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch('/api/systems/telemetry');
            if (!res.ok) throw new Error('Failed to fetch telemetry');
            const data = await res.json();
            if (data.success) {
                setTelemetry(data.telemetry);
                setError(null);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load telemetry');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setLastRefresh(new Date());
        }
    }, []);

    useEffect(() => {
        fetchTelemetry();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchTelemetry, 30000);
        return () => clearInterval(interval);
    }, [fetchTelemetry]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex items-center gap-3 text-nano-green">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="font-mono text-sm">LOADING_SYSTEMS...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-foreground p-8 font-sans relative overflow-hidden">
            {/* Subtle grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(57,255,20,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
            {/* Radial glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-nano-cyan/5 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-nano-cyan/20 pb-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-nano-cyan via-nano-green to-banana-300 bg-clip-text text-transparent">
                            SYSTEMS TELEMETRY
                        </h1>
                        <p className="text-nano-cyan/60 font-mono text-sm tracking-wide">
                            // life_os.observe_internals()
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {telemetry?.health && (
                            <StatusBadge status={telemetry.health.overallStatus} />
                        )}

                        <Link
                            href="/agents/graph"
                            className="flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all font-mono text-sm uppercase tracking-wider bg-slate-900/50 border-slate-700 text-slate-400 hover:text-nano-green hover:border-nano-green/50"
                        >
                            <Network size={16} />
                            Network
                        </Link>

                        <button
                            onClick={fetchTelemetry}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-nano-cyan text-slate-900 rounded-sm font-mono font-bold text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50 border-2 border-nano-cyan"
                        >
                            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-brutalist-accent/20 border-2 border-brutalist-accent rounded-sm p-4 flex items-center gap-3">
                        <AlertTriangle size={20} className="text-brutalist-accent" />
                        <span className="font-mono text-sm text-brutalist-accent">{error}</span>
                    </div>
                )}

                {/* Data Flow Visualization */}
                <div className="bg-slate-900/40 border-2 border-slate-700 rounded-sm p-6">
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                        <GitBranch size={16} className="text-nano-cyan" />
                        Data Flow Pipeline
                    </h2>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        {/* Sources */}
                        <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 rounded-sm border border-slate-700">
                            <Radio size={24} className="text-nano-green" />
                            <span className="text-xs font-mono text-slate-400">SOURCES</span>
                            <span className="text-lg font-bold text-nano-green">
                                {telemetry?.memoryPipeline?.workingMemory?.eventsBySource
                                    ? Object.keys(telemetry.memoryPipeline.workingMemory.eventsBySource).length
                                    : 0}
                            </span>
                        </div>

                        <ArrowRight className="text-slate-600" />

                        {/* Working Memory */}
                        <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 rounded-sm border border-nano-cyan/30">
                            <Database size={24} className="text-nano-cyan" />
                            <span className="text-xs font-mono text-slate-400">WORKING MEMORY</span>
                            <span className="text-lg font-bold text-nano-cyan">
                                {telemetry?.memoryPipeline?.workingMemory?.unprocessedEvents || 0}
                            </span>
                            <span className="text-xs text-slate-500">unprocessed</span>
                        </div>

                        <ArrowRight className="text-slate-600" />

                        {/* Synthesis */}
                        <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 rounded-sm border border-banana-400/30">
                            <Brain size={24} className="text-banana-400" />
                            <span className="text-xs font-mono text-slate-400">SYNTHESIS</span>
                            <span className="text-lg font-bold text-banana-400">
                                {telemetry?.memoryPipeline?.synthesis?.taskCount || 0}
                            </span>
                            <span className="text-xs text-slate-500">tasks</span>
                        </div>

                        <ArrowRight className="text-slate-600" />

                        {/* Decisions */}
                        <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 rounded-sm border border-brutalist-accent/30">
                            <MessageSquare size={24} className="text-brutalist-accent" />
                            <span className="text-xs font-mono text-slate-400">DECISIONS</span>
                            <span className="text-lg font-bold text-brutalist-accent">
                                {telemetry?.decisionSystem?.pendingDecisions || 0}
                            </span>
                            <span className="text-xs text-slate-500">pending</span>
                        </div>

                        <ArrowRight className="text-slate-600" />

                        {/* Learning */}
                        <div className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 rounded-sm border border-purple-400/30">
                            <Lightbulb size={24} className="text-purple-400" />
                            <span className="text-xs font-mono text-slate-400">LEARNING</span>
                            <span className="text-lg font-bold text-purple-400">
                                {telemetry?.learningSystem?.appliedInsights || 0}
                            </span>
                            <span className="text-xs text-slate-500">insights</span>
                        </div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Working Memory */}
                    <SystemCard
                        title="Working Memory"
                        icon={Database}
                        online={telemetry?.health?.workingMemoryOnline || false}
                        accentColor="nano-cyan"
                    >
                        {telemetry?.memoryPipeline?.workingMemory ? (
                            <div className="space-y-4">
                                {/* Buffer utilization */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400 font-mono">Buffer Utilization</span>
                                        <span className="text-nano-cyan font-mono font-bold">
                                            {telemetry.memoryPipeline.workingMemory.bufferUtilization}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-nano-cyan to-nano-green transition-all duration-500"
                                            style={{ width: `${telemetry.memoryPipeline.workingMemory.bufferUtilization}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/50 rounded-sm p-2">
                                        <span className="text-xs text-slate-400 font-mono">Total</span>
                                        <p className="text-lg font-bold text-slate-200">
                                            {telemetry.memoryPipeline.workingMemory.totalEvents}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-sm p-2">
                                        <span className="text-xs text-slate-400 font-mono">Processed/24h</span>
                                        <p className="text-lg font-bold text-nano-green">
                                            {telemetry.memoryPipeline.workingMemory.processedLast24h}
                                        </p>
                                    </div>
                                </div>

                                {/* Events by source */}
                                <div>
                                    <span className="text-xs text-slate-400 font-mono mb-2 block">By Source</span>
                                    <div className="space-y-2">
                                        {Object.entries(telemetry.memoryPipeline.workingMemory.eventsBySource || {})
                                            .sort(([, a], [, b]) => b - a)
                                            .slice(0, 5)
                                            .map(([source, count]) => (
                                                <EventSourceBar
                                                    key={source}
                                                    source={source}
                                                    count={count}
                                                    maxCount={Math.max(...Object.values(telemetry.memoryPipeline.workingMemory?.eventsBySource || {}))}
                                                />
                                            ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-500 text-sm">No data available</div>
                        )}
                    </SystemCard>

                    {/* Synthesis Loop */}
                    <SystemCard
                        title="Synthesis Engine"
                        icon={Brain}
                        online={telemetry?.health?.synthesisOnline || false}
                        accentColor="banana-400"
                    >
                        {telemetry?.memoryPipeline?.synthesis ? (
                            <div className="space-y-4">
                                {/* Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-mono">Status</span>
                                    <div className={`flex items-center gap-2 px-2 py-1 rounded-sm ${
                                        telemetry.memoryPipeline.synthesis.isRunning
                                            ? 'bg-nano-green/20 text-nano-green'
                                            : 'bg-slate-700 text-slate-300'
                                    }`}>
                                        <Activity size={12} />
                                        <span className="text-xs font-mono font-bold">
                                            {telemetry.memoryPipeline.synthesis.isRunning ? 'RUNNING' : 'IDLE'}
                                        </span>
                                    </div>
                                </div>

                                {/* Last synthesis */}
                                <div className="bg-slate-800/50 rounded-sm p-3">
                                    <span className="text-xs text-slate-400 font-mono">Last Synthesis</span>
                                    <p className="text-sm text-slate-200 font-mono">
                                        {telemetry.memoryPipeline.synthesis.lastSynthesisAt
                                            ? new Date(telemetry.memoryPipeline.synthesis.lastSynthesisAt).toLocaleString()
                                            : 'Never'}
                                    </p>
                                    {telemetry.memoryPipeline.synthesis.taskCount > 0 && (
                                        <p className="text-xs text-nano-green mt-1">
                                            Generated {telemetry.memoryPipeline.synthesis.taskCount} tasks
                                        </p>
                                    )}
                                </div>

                                {/* Next synthesis */}
                                {telemetry.memoryPipeline.synthesis.nextSynthesisAt && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Timer size={12} />
                                        <span>Next: {new Date(telemetry.memoryPipeline.synthesis.nextSynthesisAt).toLocaleTimeString()}</span>
                                    </div>
                                )}

                                {/* LLM Model info */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                                    <Cpu size={12} className="text-banana-400" />
                                    <span className="text-xs font-mono text-slate-400">claude-sonnet-4.5</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-500 text-sm">No data available</div>
                        )}
                    </SystemCard>

                    {/* Decision Queue */}
                    <SystemCard
                        title="Decision Queue"
                        icon={MessageSquare}
                        online={telemetry?.health?.decisionQueueOnline || false}
                        accentColor="brutalist-accent"
                    >
                        {telemetry?.decisionSystem ? (
                            <div className="space-y-4">
                                {/* Priority breakdown */}
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(telemetry.decisionSystem.byPriority || {}).map(([priority, count]) => (
                                        <PriorityBadge key={priority} priority={priority} count={count as number} />
                                    ))}
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-800/50 rounded-sm p-2 text-center">
                                        <span className="text-xs text-slate-400 font-mono">Pending</span>
                                        <p className="text-lg font-bold text-banana-400">
                                            {telemetry.decisionSystem.pendingDecisions}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-sm p-2 text-center">
                                        <span className="text-xs text-slate-400 font-mono">Resolved</span>
                                        <p className="text-lg font-bold text-nano-green">
                                            {telemetry.decisionSystem.resolvedDecisions}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-sm p-2 text-center">
                                        <span className="text-xs text-slate-400 font-mono">Expired</span>
                                        <p className="text-lg font-bold text-slate-400">
                                            {telemetry.decisionSystem.expiredDecisions}
                                        </p>
                                    </div>
                                </div>

                                {/* Avg resolution time */}
                                {telemetry.decisionSystem.avgResolutionTimeMs > 0 && (
                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700">
                                        <span className="text-slate-400 font-mono">Avg Resolution</span>
                                        <span className="text-nano-green font-mono font-bold">
                                            {Math.round(telemetry.decisionSystem.avgResolutionTimeMs / 60000)}m
                                        </span>
                                    </div>
                                )}

                                {/* Critical alert */}
                                {telemetry.decisionSystem.pendingCritical > 0 && (
                                    <div className="bg-brutalist-accent/20 border border-brutalist-accent rounded-sm p-2 flex items-center gap-2">
                                        <AlertTriangle size={14} className="text-brutalist-accent" />
                                        <span className="text-xs font-mono text-brutalist-accent">
                                            {telemetry.decisionSystem.pendingCritical} critical decisions pending
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-500 text-sm">No data available</div>
                        )}
                    </SystemCard>

                    {/* Learning System */}
                    <SystemCard
                        title="Semantic Learning"
                        icon={Lightbulb}
                        online={telemetry?.health?.learningBridgeOnline || false}
                        accentColor="purple-400"
                    >
                        {telemetry?.learningSystem ? (
                            <div className="space-y-4">
                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/50 rounded-sm p-2">
                                        <span className="text-xs text-slate-400 font-mono">Insights</span>
                                        <p className="text-lg font-bold text-slate-200">
                                            {telemetry.learningSystem.totalInsights}
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-sm p-2">
                                        <span className="text-xs text-slate-400 font-mono">Applied</span>
                                        <p className="text-lg font-bold text-purple-400">
                                            {telemetry.learningSystem.appliedInsights}/{telemetry.learningSystem.totalInsights}
                                        </p>
                                    </div>
                                </div>

                                {/* Recent insights */}
                                {telemetry.learningSystem.recentInsights.length > 0 && (
                                    <div>
                                        <span className="text-xs text-slate-400 font-mono mb-2 block">Recent Insights</span>
                                        <div className="space-y-2">
                                            {telemetry.learningSystem.recentInsights.slice(0, 3).map((insight) => (
                                                <InsightCard key={insight.id} insight={insight} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Last cycle */}
                                <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-700">
                                    <Clock size={12} />
                                    <span>
                                        Last cycle: {telemetry.learningSystem.lastLearningCycle
                                            ? new Date(telemetry.learningSystem.lastLearningCycle).toLocaleString()
                                            : 'Never'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-500 text-sm">No data available</div>
                        )}
                    </SystemCard>

                    {/* Cron Jobs */}
                    <SystemCard
                        title="Scheduled Jobs"
                        icon={Clock}
                        online={true}
                        accentColor="nano-green"
                    >
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {telemetry?.cronJobs?.map((job) => (
                                <CronJobRow key={job.name} job={job} />
                            ))}
                        </div>
                    </SystemCard>

                    {/* System Health */}
                    <SystemCard
                        title="System Health"
                        icon={Activity}
                        online={telemetry?.health?.overallStatus === 'healthy'}
                        accentColor="nano-green"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-mono">Working Memory</span>
                                <StatusBadge status={telemetry?.health?.workingMemoryOnline || false} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-mono">Synthesis Engine</span>
                                <StatusBadge status={telemetry?.health?.synthesisOnline || false} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-mono">Decision Queue</span>
                                <StatusBadge status={telemetry?.health?.decisionQueueOnline || false} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-mono">Learning Bridge</span>
                                <StatusBadge status={telemetry?.health?.learningBridgeOnline || false} />
                            </div>

                            {/* Last refresh */}
                            <div className="pt-3 border-t border-slate-700">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-mono">Last Refresh</span>
                                    <span className="text-slate-400 font-mono">
                                        {lastRefresh?.toLocaleTimeString() || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs mt-1">
                                    <span className="text-slate-500 font-mono">Fetch Latency</span>
                                    <span className="text-nano-green font-mono">
                                        {telemetry?.latencyMs || 0}ms
                                    </span>
                                </div>
                            </div>
                        </div>
                    </SystemCard>
                </div>

                {/* Footer */}
                <div className="border-t-2 border-nano-cyan/20 pt-6 mt-8">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                        <span>LIFE_OS_TELEMETRY v1.0</span>
                        <span>AUTO_REFRESH: 30s</span>
                        <span>TIMESTAMP: {telemetry?.timestamp || 'N/A'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
