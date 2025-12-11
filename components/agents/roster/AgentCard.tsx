'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    Activity,
    Zap,
    Shield,
    Clock,
    ExternalLink,
    Gavel,
    Coins,
    ClipboardList,
    Mail,
    Users,
    Brain,
} from 'lucide-react';
import { Agent, AgentStatus } from '@/app/agents/agents.mock';

// Helper to map icon string to Lucide component
const IconMap: Record<string, React.ElementType> = {
    "gavel": Gavel,
    "coins": Coins,
    "clipboard-list": ClipboardList,
    "mail": Mail,
    "calendar": ClipboardList, // Fallback
    "users": Users,
    "brain": Brain,
    "activity": Activity
};

// RPG Bar Component - Nano Banana Style
const RpgBar = ({ label, value, colorClass, icon: Icon }: { label: string, value: number, colorClass: string, icon: any }) => (
    <div className="flex items-center gap-2 text-xs mb-1 group/bar">
        <div className="w-6 font-bold text-nano-green flex justify-center transition-transform group-hover/bar:scale-110">
            <Icon size={12} />
        </div>
        <div className="flex-1 h-4 bg-slate-900/80 rounded-sm overflow-hidden relative border border-nano-green/20 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            {/* Grid overlay for data-punk aesthetic */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_49%,rgba(57,255,20,0.05)_50%,transparent_51%,transparent_100%)] bg-[length:8px_100%]" />
            <div
                className={`h-full ${colorClass} transition-all duration-500 ease-out relative overflow-hidden`}
                style={{ width: `${value}%` }}
            >
                {/* Scan line effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-data-scan" />
            </div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
                {value}/100
            </span>
        </div>
    </div>
);

interface AgentCardProps {
    agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
    const Icon = IconMap[agent.icon] || Activity;

    // Nano Banana status colors - high vibrancy with glow effects
    const getStatusColor = (status: AgentStatus) => {
        switch (status) {
            case 'green': return 'text-nano-green border-nano-green/40 bg-nano-green/10 shadow-[0_0_15px_rgba(57,255,20,0.15)]';
            case 'yellow': return 'text-banana-400 border-banana-400/40 bg-banana-400/10 shadow-[0_0_15px_rgba(250,204,21,0.15)]';
            case 'red': return 'text-brutalist-accent border-brutalist-accent/40 bg-brutalist-accent/10 shadow-[0_0_15px_rgba(255,51,102,0.15)]';
            default: return 'text-gray-500';
        }
    };

    const getStatusBadge = (status: AgentStatus) => {
        switch (status) {
            case 'green': return 'bg-nano-green shadow-[0_0_8px_rgba(57,255,20,0.6)]';
            case 'yellow': return 'bg-banana-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
            case 'red': return 'bg-brutalist-accent shadow-[0_0_8px_rgba(255,51,102,0.6)]';
            default: return 'bg-gray-500';
        }
    };

    const getRelativeTime = (dateStr: string) => {
        if (!dateStr) return 'Never';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs < 1) return '< 1h ago';
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    const statusStyle = getStatusColor(agent.status);

    return (
        <div
            className="group relative bg-slate-900/80 border-2 border-slate-700/50 rounded-sm overflow-hidden hover:border-nano-green/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] flex flex-col backdrop-blur-sm"
        >
            {/* Status Stripe - Glowing */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${getStatusBadge(agent.status)}`} />
            {/* Corner accent - Neo-brutalist */}
            <div className="absolute top-0 right-0 w-8 h-8 border-b-2 border-l-2 border-nano-green/20 bg-gradient-to-br from-nano-green/5 to-transparent" />

            <div className="p-6 flex-1 flex flex-col">
                {/* Card Header - Nano Banana style */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`relative w-16 h-16 rounded-sm ${statusStyle} flex items-center justify-center overflow-hidden border-2 group-hover:animate-nano-pulse transition-all`}>
                            {/* Use Icon as fallback if avatar fails or is placeholder */}
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                                <Icon size={32} className="opacity-60 text-nano-green" />
                            </div>
                            <Image
                                src={agent.avatar}
                                alt={agent.name}
                                width={64}
                                height={64}
                                className="object-cover w-full h-full animate-float pixelated z-10"
                                onError={(e) => {
                                    // Hide image on error to show icon
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight text-white group-hover:text-nano-green transition-colors">{agent.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs font-mono mt-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${getStatusBadge(agent.status)} animate-pulse`} />
                                <span className="uppercase tracking-wider text-slate-400">{agent.status}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs font-mono text-banana-400 bg-banana-400/10 px-2 py-1 rounded-sm border border-banana-400/30">
                        LVL {Math.floor((agent.hp + agent.mp) / 20)}
                    </div>
                </div>

                {/* RPG Stats - Data-punk style */}
                <div className="space-y-2 mb-6 bg-slate-800/50 p-3 rounded-sm border-2 border-slate-700/50">
                    <RpgBar label="HP" value={agent.hp} colorClass="bg-gradient-to-r from-brutalist-accent to-red-400" icon={Activity} />
                    <RpgBar label="MP" value={agent.mp} colorClass="bg-gradient-to-r from-nano-cyan to-blue-400" icon={Zap} />
                </div>

                {/* Capabilities - Neo-brutalist list */}
                <div className="mb-6 flex-1">
                    <h4 className="text-xs font-mono font-bold text-nano-green uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Shield size={12} className="text-nano-green" /> CAPABILITIES
                    </h4>
                    <ul className="space-y-1.5">
                        {agent.capabilities.slice(0, 3).map((cap: string, i: number) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2 font-mono">
                                <span className="text-nano-green mt-0.5">&gt;</span>
                                {cap}
                            </li>
                        ))}
                        {agent.capabilities.length > 3 && (
                            <li className="text-xs text-nano-green/50 pl-4 font-mono">
                                +{agent.capabilities.length - 3} more...
                            </li>
                        )}
                    </ul>
                </div>

                {/* Footer - Data-punk style */}
                <div className="pt-4 border-t-2 border-slate-700/50 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500" title={`Last sync: ${agent.last_sync}`}>
                        <Clock size={12} className="text-nano-cyan" />
                        {getRelativeTime(agent.last_sync)}
                    </div>

                    <div className="flex items-center gap-3">
                        {agent.open_items > 0 && (
                            <span className="text-xs font-mono font-bold text-banana-400 bg-banana-400/10 px-2 py-0.5 rounded-sm border border-banana-400/30 shadow-[0_0_8px_rgba(250,204,21,0.2)]">
                                {agent.open_items} OPEN
                            </span>
                        )}

                        <Link
                            href={`/pm?anatomy_focus=${agent.id}`}
                            className="flex items-center gap-1.5 text-sm font-mono font-bold text-nano-green hover:text-nano-cyan transition-colors hover:shadow-[0_0_10px_rgba(57,255,20,0.3)]"
                        >
                            ANATOMY <ExternalLink size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
