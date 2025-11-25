"use client";

import React, { useState } from 'react';
import { AGENTS_MOCK, Agent, AgentStatus } from '../agents.mock';
import {
    Gavel,
    Coins,
    ClipboardList,
    Mail,
    Activity,
    RefreshCw,
    Filter,
    ExternalLink,
    Zap,
    Shield,
    Clock,
    Calendar,
    Users,
    Brain
} from 'lucide-react';
import Link from 'next/link';

// Helper to map icon string to Lucide component
const IconMap: Record<string, React.ElementType> = {
    "gavel": Gavel,
    "coins": Coins,
    "clipboard-list": ClipboardList,
    "mail": Mail,
    "calendar": Calendar,
    "users": Users,
    "brain": Brain,
    "activity": Activity
};

// RPG Bar Component
const RpgBar = ({ label, value, colorClass, icon: Icon }: { label: string, value: number, colorClass: string, icon: any }) => (
    <div className="flex items-center gap-2 text-xs mb-1">
        <div className="w-6 font-bold text-muted-foreground flex justify-center">
            <Icon size={12} />
        </div>
        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden relative border border-white/5">
            <div
                className={`h-full ${colorClass} transition-all duration-500 ease-out`}
                style={{ width: `${value}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md">
                {value}/100
            </span>
        </div>
    </div>
);

export default function AgentsRosterPage() {
    const [agents, setAgents] = useState<Agent[]>(AGENTS_MOCK);
    const [filter, setFilter] = useState<AgentStatus | 'all'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        // Simulate network request
        setTimeout(() => {
            setAgents([...AGENTS_MOCK]); // Re-read mock
            setIsRefreshing(false);
        }, 800);
    };

    const filteredAgents = filter === 'all'
        ? agents
        : agents.filter(a => a.status === filter);

    const getStatusColor = (status: AgentStatus) => {
        switch (status) {
            case 'green': return 'text-green-500 border-green-500/30 bg-green-500/10';
            case 'yellow': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
            case 'red': return 'text-red-500 border-red-500/30 bg-red-500/10';
            default: return 'text-gray-500';
        }
    };

    const getStatusBadge = (status: AgentStatus) => {
        switch (status) {
            case 'green': return 'bg-green-500';
            case 'yellow': return 'bg-yellow-500';
            case 'red': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    // Format relative time (simple version)
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date(); // In a real app, use a fixed "now" or library like date-fns
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs < 1) return '< 1h ago';
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header & Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                            Agents Roster
                        </h1>
                        <p className="text-muted-foreground">
                            Manage and monitor your autonomous agent squad.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border">
                            {(['all', 'green', 'yellow', 'red'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === f
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium shadow-sm"
                        >
                            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => {
                        const Icon = IconMap[agent.icon] || Activity;
                        const statusStyle = getStatusColor(agent.status);

                        return (
                            <div
                                key={agent.id}
                                className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col"
                            >
                                {/* Status Stripe */}
                                <div className={`absolute top-0 left-0 w-1 h-full ${getStatusBadge(agent.status)}`} />

                                <div className="p-6 flex-1 flex flex-col">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-lg ${statusStyle} bg-opacity-10`}>
                                                <Icon size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg leading-tight">{agent.name}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                                    <span className={`inline-block w-2 h-2 rounded-full ${getStatusBadge(agent.status)}`} />
                                                    <span className="capitalize">{agent.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded border border-white/5">
                                            Lvl {Math.floor((agent.hp + agent.mp) / 20)}
                                        </div>
                                    </div>

                                    {/* RPG Stats */}
                                    <div className="space-y-2 mb-6 bg-secondary/20 p-3 rounded-lg border border-white/5">
                                        <RpgBar label="HP" value={agent.hp} colorClass="bg-red-500" icon={Activity} />
                                        <RpgBar label="MP" value={agent.mp} colorClass="bg-blue-500" icon={Zap} />
                                    </div>

                                    {/* Capabilities */}
                                    <div className="mb-6 flex-1">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                            <Shield size={12} /> Capabilities
                                        </h4>
                                        <ul className="space-y-1.5">
                                            {agent.capabilities.slice(0, 3).map((cap, i) => (
                                                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                                    <span className="text-primary mt-1">•</span>
                                                    {cap}
                                                </li>
                                            ))}
                                            {agent.capabilities.length > 3 && (
                                                <li className="text-xs text-muted-foreground pl-3 italic">
                                                    +{agent.capabilities.length - 3} more...
                                                </li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-4 border-t border-border flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Last sync: ${agent.last_sync}`}>
                                            <Clock size={12} />
                                            {getRelativeTime(agent.last_sync)}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {agent.open_items > 0 && (
                                                <span className="text-xs font-medium text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                                                    {agent.open_items} open
                                                </span>
                                            )}

                                            <Link
                                                href={agent.link}
                                                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                            >
                                                View <ExternalLink size={14} />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
