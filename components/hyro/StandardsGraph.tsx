'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Standard, StandardMastery } from '@/lib/hyro/education-store';

// Dynamic import for client-side only graph library
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full flex items-center justify-center text-zinc-500">Loading curriculum map...</div>
});

interface StandardsGraphProps {
    standards: Standard[];
    mastery: StandardMastery[];
    onSelectNode?: (node: any) => void;
    width?: number;
    height?: number;
}

export default function StandardsGraph({ standards, mastery, onSelectNode, width, height }: StandardsGraphProps) {
    const fgRef = useRef<any>();

    // Transform data for graph
    const graphData = useMemo(() => {
        const nodes = standards.map(std => {
            const m = mastery.find(x => x.standard_id === std.id);
            const isMastered = (m?.mastery_level || 0) >= 100;
            const isUnlocked = m?.status === 'unlocked' || m?.status === 'practicing' || isMastered;

            // Determine color
            let color = '#52525b'; // Zinc-600 (Locked)
            if (isMastered) color = '#10b981'; // Emerald-500 (Mastered)
            else if (m?.status === 'practicing') color = '#f59e0b'; // Amber-500 (Practicing)
            else if (isUnlocked) color = '#3b82f6'; // Blue-500 (Unlocked)

            // Determine size (evidence count logic could go here)
            const val = 5 + (m?.evidence_count || 0);

            return {
                ...std,
                name: std.id, // Label
                desc: std.description, // Tooltip?
                group: std.domain,
                color,
                val,
                status: m?.status || 'locked'
            };
        });

        const links: any[] = [];
        standards.forEach(std => {
            if (std.prerequisites && Array.isArray(std.prerequisites)) {
                std.prerequisites.forEach(preId => {
                    // Verify target exists to avoid graph crash
                    if (standards.find(s => s.id === preId)) {
                        links.push({
                            source: preId,
                            target: std.id,
                            color: '#3f3f46' // Zinc-700
                        });
                    }
                });
            }
        });

        return { nodes, links };
    }, [standards, mastery]);

    return (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950">
            <ForceGraph2D
                ref={fgRef}
                width={width}
                height={height || 500}
                graphData={graphData}
                nodeLabel={(node: any) => `${node.id}: ${node.desc.substring(0, 50)}...`}
                nodeColor={(node: any) => node.color}
                linkColor={() => '#3f3f46'}
                backgroundColor="#09090b" // Zinc-950
                onNodeClick={(node) => {
                    if (onSelectNode) onSelectNode(node);
                    // Center view on node
                    fgRef.current?.centerAt(node.x, node.y, 1000);
                    fgRef.current?.zoom(2, 2000);
                }}
                nodeRelSize={4}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
            />
        </div>
    );
}
