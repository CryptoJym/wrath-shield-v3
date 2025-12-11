"use client";

import React, { useEffect, useState } from 'react';
import { Agent, AgentStatus } from '../agents.mock';
import AssuredHUD from '@/components/AssuredHUD';
import { PMStatusCard } from '@/components/pm/PMStatusCard';
import { AgentCard } from '@/components/agents/roster/AgentCard';
import {
    Activity,
    RefreshCw,
    Share2
} from 'lucide-react';
import Link from 'next/link';

export default function AgentsRosterPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<AgentStatus | 'all'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showHUD, setShowHUD] = useState(false);

    const fetchAgents = async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch('/api/agents/status');
            if (res.ok) {
                const data = await res.json();
                setAgents(data);
            }
        } catch (error) {
            console.error("Failed to fetch agents", error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const filteredAgents = filter === 'all'
        ? agents
        : agents.filter(a => a.status === filter);

    return (
        <div className="min-h-screen bg-slate-950 text-foreground p-8 font-sans relative overflow-hidden">
            {/* Subtle grid background for data-punk aesthetic */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(57,255,20,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.02)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
            {/* Radial glow from top */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-nano-green/5 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">

                {/* Header & Toolbar - Neo-brutalist style */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-nano-green/20 pb-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight mb-2 bg-gradient-to-r from-nano-green via-banana-300 to-nano-cyan bg-clip-text text-transparent animate-banana-glow">
                            AGENTS ROSTER
                        </h1>
                        <p className="text-nano-green/60 font-mono text-sm tracking-wide">
                            // autonomous_squad.monitor()
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowHUD(!showHUD)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all font-mono text-sm uppercase tracking-wider ${showHUD
                                ? 'bg-nano-green/20 border-nano-green text-nano-green shadow-[0_0_15px_rgba(57,255,20,0.3)]'
                                : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:text-nano-green hover:border-nano-green/50 hover:shadow-[0_0_10px_rgba(57,255,20,0.2)]'}`}
                        >
                            <Activity size={16} />
                            {showHUD ? 'Hide HUD' : 'Squad Health'}
                        </button>

                        <Link href="/agents/graph" className="flex items-center gap-2 px-4 py-2 rounded-sm border-2 transition-all font-mono text-sm uppercase tracking-wider bg-slate-900/50 border-slate-700 text-slate-400 hover:text-nano-cyan hover:border-nano-cyan/50 hover:shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                            <Share2 size={16} />
                            Network Graph
                        </Link>

                        {/* Status filter - Neo-brutalist segmented control */}
                        <div className="flex items-center bg-slate-900/80 rounded-sm p-1 border-2 border-slate-700">
                            {(['all', 'green', 'yellow', 'red'] as const).map((f) => {
                                const filterColors = {
                                    all: 'bg-slate-700 text-white',
                                    green: 'bg-nano-green text-slate-900 shadow-[0_0_10px_rgba(57,255,20,0.4)]',
                                    yellow: 'bg-banana-400 text-slate-900 shadow-[0_0_10px_rgba(250,204,21,0.4)]',
                                    red: 'bg-brutalist-accent text-white shadow-[0_0_10px_rgba(255,51,102,0.4)]'
                                };
                                return (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`px-3 py-1.5 rounded-sm text-xs font-mono font-bold uppercase tracking-wider transition-all ${filter === f
                                            ? filterColors[f]
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={fetchAgents}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-nano-green text-slate-900 rounded-sm font-mono font-bold text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all disabled:opacity-50 border-2 border-nano-green"
                        >
                            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                            Sync
                        </button>
                    </div>
                </div>

                {/* AssuredHUD Section */}
                {showHUD && (
                    <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                        <AssuredHUD />
                    </div>
                )}

                {/* PM Status Card - Always visible for quick PM status */}
                <div className="mb-8 max-w-md">
                    <PMStatusCard />
                </div>

                {/* Grid - Agent Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-12 text-nano-green/60 font-mono">
                            <div className="inline-flex items-center gap-2">
                                <RefreshCw size={16} className="animate-spin" />
                                LOADING_AGENTS...
                            </div>
                        </div>
                    ) : filteredAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} />
                    ))}
                </div>

                {/* Footer stats bar */}
                <div className="border-t-2 border-nano-green/20 pt-6 mt-8">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                        <span>TOTAL_AGENTS: {agents.length}</span>
                        <span>ACTIVE: {agents.filter(a => a.status === 'green').length}</span>
                        <span>WARNINGS: {agents.filter(a => a.status === 'yellow').length}</span>
                        <span>CRITICAL: {agents.filter(a => a.status === 'red').length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
