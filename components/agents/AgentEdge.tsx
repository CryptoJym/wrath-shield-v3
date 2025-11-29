"use client";

import React from 'react';

export interface AgentEdgeProps {
    from: { x: number; y: number };
    to: { x: number; y: number };
    type: 'data' | 'control' | 'bidirectional';
    healthy: boolean;
    animated?: boolean;
    label?: string;
    bandwidth?: number;
    volume?: number;
    onClick?: () => void;
}

export const AgentEdge: React.FC<AgentEdgeProps> = ({
    from,
    to,
    type,
    healthy,
    animated = true,
    label,
    bandwidth,
    volume,
    onClick
}) => {
    const strokeColor = healthy ? '#10b981' : '#ef4444';
    const strokeOpacity = healthy ? 0.7 : 0.4;
    const strokeWidth = type === 'bidirectional' ? 3 : 2.5;

    // Safely extract coordinates with defaults to avoid NaN
    const fromX = from?.x ?? 0;
    const fromY = from?.y ?? 0;
    const toX = to?.x ?? 0;
    const toY = to?.y ?? 0;

    // Calculate midpoint for label
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    // Calculate angle for arrow
    const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);

    // Create path for curved line
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dr = Math.sqrt(dx * dx + dy * dy) || 1; // Prevent division by zero

    // Add slight curve for bidirectional
    const curve = type === 'bidirectional' ? dr * 0.1 : 0;

    const getThroughputColor = () => {
        if (!bandwidth) return strokeColor;
        if (bandwidth > 800) return '#10b981'; // high throughput - green
        if (bandwidth > 400) return '#3b82f6'; // medium - blue
        return '#f59e0b'; // low - yellow
    };

    const throughputColor = getThroughputColor();

    return (
        <g className="agent-edge cursor-pointer" onClick={onClick}>
            {/* Glow effect for healthy connections */}
            {healthy && (
                <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth + 5}
                    strokeOpacity={0.15}
                    className={animated ? "animate-pulse" : ""}
                />
            )}

            {/* Main line */}
            {type === 'bidirectional' ? (
                <path
                    d={`M ${fromX},${fromY} Q ${midX},${midY - curve} ${toX},${toY}`}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    fill="none"
                    className={animated ? "animate-flow" : ""}
                />
            ) : (
                <line
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={type === 'control' ? '5,5' : undefined}
                    className={animated ? "animate-flow" : ""}
                />
            )}

            {/* Arrow marker for non-bidirectional */}
            {type !== 'bidirectional' && (
                <g transform={`translate(${toX}, ${toY}) rotate(${angle})`}>
                    <polygon
                        points="-10,-5 -10,5 0,0"
                        fill={strokeColor}
                        opacity={strokeOpacity}
                    />
                </g>
            )}

            {/* Bidirectional arrows */}
            {type === 'bidirectional' && (
                <>
                    <g transform={`translate(${toX}, ${toY}) rotate(${angle})`}>
                        <polygon
                            points="-10,-5 -10,5 0,0"
                            fill={strokeColor}
                            opacity={strokeOpacity}
                        />
                    </g>
                    <g transform={`translate(${fromX}, ${fromY}) rotate(${angle + 180})`}>
                        <polygon
                            points="-10,-5 -10,5 0,0"
                            fill={strokeColor}
                            opacity={strokeOpacity}
                        />
                    </g>
                </>
            )}

            {/* Data flow animation dots */}
            {animated && healthy && (
                <>
                    <circle r="3" fill={strokeColor} opacity="0.8">
                        <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={
                                type === 'bidirectional'
                                    ? `M ${from.x},${from.y} Q ${midX},${midY - curve} ${to.x},${to.y}`
                                    : `M ${from.x},${from.y} L ${to.x},${to.y}`
                            }
                        />
                    </circle>
                    {type === 'bidirectional' && (
                        <circle r="3" fill={strokeColor} opacity="0.8">
                            <animateMotion
                                dur="3s"
                                repeatCount="indefinite"
                                path={`M ${to.x},${to.y} Q ${midX},${midY + curve} ${from.x},${from.y}`}
                            />
                        </circle>
                    )}
                </>
            )}

            {/* Enhanced Label with metrics */}
            {label && (
                <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                        x="-32"
                        y="-12"
                        width="64"
                        height="24"
                        fill="rgba(17, 24, 39, 0.95)"
                        stroke={strokeColor}
                        strokeWidth="1.5"
                        rx="5"
                        opacity="0.95"
                    />
                    {/* Main label */}
                    <text
                        textAnchor="middle"
                        y="-2"
                        fontSize="9"
                        fontWeight="700"
                        fill="white"
                    >
                        {label}
                    </text>
                    {/* Metrics line */}
                    {(bandwidth !== undefined || volume !== undefined) && (
                        <text
                            textAnchor="middle"
                            y="7"
                            fontSize="7"
                            fontWeight="500"
                            fill={throughputColor}
                        >
                            {bandwidth !== undefined && `${bandwidth}KB/s`}
                            {bandwidth !== undefined && volume !== undefined && ' • '}
                            {volume !== undefined && `${volume}i`}
                        </text>
                    )}
                </g>
            )}

            {/* Throughput indicator (small dot on the line) */}
            {bandwidth !== undefined && bandwidth > 600 && (
                <circle
                    cx={midX + 10}
                    cy={midY - 18}
                    r="3"
                    fill={throughputColor}
                    opacity="0.9"
                    className="animate-pulse"
                />
            )}
        </g>
    );
};

export default AgentEdge;
