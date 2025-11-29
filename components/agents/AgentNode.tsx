"use client";

import React from 'react';
import { AgentStatus } from '@/app/agents/agents.mock';
import {
    Gavel,
    Coins,
    ClipboardList,
    Mail,
    Activity,
    Users,
    Brain,
} from 'lucide-react';

const IconMap: Record<string, React.ElementType> = {
    "gavel": Gavel,
    "coins": Coins,
    "clipboard-list": ClipboardList,
    "mail": Mail,
    "calendar": ClipboardList,
    "users": Users,
    "brain": Brain,
    "activity": Activity
};

export interface AgentNodeProps {
    id: string;
    name: string;
    type: string;
    status: AgentStatus;
    hp: number;
    mp: number;
    openItems: number;
    x: number;
    y: number;
    onClick?: (id: string) => void;
}

export const AgentNode: React.FC<AgentNodeProps> = ({
    id,
    name,
    type,
    status,
    hp,
    mp,
    openItems,
    x,
    y,
    onClick
}) => {
    const Icon = IconMap[type] || Activity;

    const getStatusColor = () => {
        switch (status) {
            case 'green': return '#10b981';
            case 'yellow': return '#f59e0b';
            case 'red': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getStatusGlow = () => {
        switch (status) {
            case 'green': return 'url(#glow-green)';
            case 'yellow': return 'url(#glow-yellow)';
            case 'red': return 'url(#glow-red)';
            default: return 'none';
        }
    };

    const getHPBarColor = () => {
        if (hp >= 80) return '#10b981'; // green
        if (hp >= 50) return '#f59e0b'; // yellow
        return '#ef4444'; // red
    };

    const getMPBarColor = () => {
        if (mp >= 80) return '#3b82f6'; // blue
        if (mp >= 50) return '#60a5fa'; // lighter blue
        return '#93c5fd'; // even lighter blue
    };

    const handleClick = () => {
        if (onClick) onClick(id);
    };

    return (
        <g
            transform={`translate(${x}, ${y})`}
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={handleClick}
        >
            {/* Glow effect */}
            <circle
                r="50"
                fill={getStatusGlow()}
                opacity="0.25"
                className="animate-pulse"
            />

            {/* Main circle with gradient */}
            <circle
                r="40"
                fill="rgba(17, 24, 39, 0.95)"
                stroke={getStatusColor()}
                strokeWidth="3.5"
                className="transition-all"
            />

            {/* Icon */}
            <foreignObject x="-22" y="-22" width="44" height="44">
                <div className="flex items-center justify-center w-full h-full">
                    <Icon size={28} color={getStatusColor()} />
                </div>
            </foreignObject>

            {/* Status indicator with pulse */}
            <circle
                cx="28"
                cy="-28"
                r="9"
                fill={getStatusColor()}
                stroke="rgba(17, 24, 39, 0.9)"
                strokeWidth="2.5"
                className={status === 'green' ? 'animate-pulse' : ''}
            />

            {/* Open items badge */}
            {openItems > 0 && (
                <>
                    <circle
                        cx="28"
                        cy="28"
                        r="13"
                        fill="#f59e0b"
                        stroke="rgba(17, 24, 39, 0.9)"
                        strokeWidth="2.5"
                    />
                    <text
                        x="28"
                        y="28"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="11"
                        fontWeight="bold"
                        fill="white"
                    >
                        {openItems > 9 ? '9+' : openItems}
                    </text>
                </>
            )}

            {/* Name label */}
            <text
                y="60"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="white"
                className="pointer-events-none select-none"
            >
                {name.split(' ')[0]}
            </text>

            {/* HP/MP bars with improved visuals */}
            <g transform="translate(-35, 70)">
                {/* HP bar background */}
                <rect x="0" y="0" width="70" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
                {/* HP bar fill */}
                <rect x="0" y="0" width={(hp ?? 0) * 0.7} height="4" rx="2" fill={getHPBarColor()} />
                {/* HP label */}
                <text x="72" y="3" fontSize="7" fill="#ef4444" fontWeight="600">HP</text>

                {/* MP bar background */}
                <rect x="0" y="6" width="70" height="4" rx="2" fill="rgba(255,255,255,0.1)" />
                {/* MP bar fill */}
                <rect x="0" y="6" width={(mp ?? 0) * 0.7} height="4" rx="2" fill={getMPBarColor()} />
                {/* MP label */}
                <text x="72" y="9" fontSize="7" fill="#3b82f6" fontWeight="600">MP</text>
            </g>

            {/* Metric values below bars */}
            <text
                y="86"
                textAnchor="middle"
                fontSize="8"
                fill="rgba(255,255,255,0.6)"
                fontWeight="500"
            >
                {hp}/{mp}
            </text>
        </g>
    );
};

export default AgentNode;
