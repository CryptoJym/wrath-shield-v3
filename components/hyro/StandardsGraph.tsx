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
    standards: any[];
    mastery: any[];
    onNodeClick?: (node: any) => void;
}

export default function StandardsGraph({ standards, mastery, onNodeClick }: StandardsGraphProps) {
    const fgRef = useRef<any>();
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
    const [viewMode, setViewMode] = useState<'standard' | 'truth' | 'synapse'>('standard');

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Transform data for graph
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];
        const addedNodeIds = new Set<string>();

        // 1. Standard Nodes (Always present, but style depends on view)
        standards.forEach(std => {
            const m = mastery.find(x => x.standard_id === std.id);
            const isMastered = (m?.mastery_level || 0) >= 100;
            const isUnlocked = m?.status === 'unlocked' || m?.status === 'practicing' || isMastered;

            // Determine color
            let color = '#52525b'; // Zinc-600 (Locked)
            if (isMastered) color = '#10b981'; // Emerald-500 (Mastered)
            else if (m?.status === 'practicing') color = '#f59e0b'; // Amber-500 (Practicing)
            else if (isUnlocked) color = '#3b82f6'; // Blue-500 (Unlocked)

            // TRUTH VIEW overrides
            if (viewMode === 'truth') {
                if (isMastered) color = '#059669'; // Darker Emerald (faded)
                else color = '#27272a'; // Zinc-800 (Faded background)
            }

            const val = viewMode === 'truth' ? 3 : 5 + (m?.evidence_count || 0);

            nodes.push({
                ...std,
                name: std.id,
                desc: std.description,
                group: std.domain,
                color,
                val,
                status: m?.status || 'locked',
                type: 'standard'
            });
            addedNodeIds.add(std.id);
        });

        // 2. Standard Links
        standards.forEach(std => {
            if (std.prerequisites && Array.isArray(std.prerequisites)) {
                std.prerequisites.forEach(preId => {
                    if (standards.find(s => s.id === preId)) {
                        links.push({
                            source: preId,
                            target: std.id,
                            color: viewMode === 'truth' ? '#18181b' : '#3f3f46', // Very subtle in truth view
                            width: 1
                        });
                    }
                });
            }
        });

        // 3. TRUTH VIEW: Add Concepts and Truth Edges
        if (viewMode === 'truth') {
            // This is a mockup of concept data injection since we don't have the full graph prop yet.
            // In a real implementation, we would pass `concepts` and `mappings` as props.
            // For now, we allow the "Energy" concept to exist if any standard relates to it.

            // Hardcoded "Truth" nodes for visual verification of the architecture
            const truths = [
                { id: 'concept_conservation_of_energy', name: 'Conservation of Energy', color: '#d946ef', desc: 'The Universal Truth (Energy cannot be created/destroyed)' },
                { id: 'concept_archetypes', name: 'Archetypal Resonance', color: '#d946ef', desc: 'The Hidden Patterns of Story' }
            ];

            truths.forEach(truth => {
                nodes.push({
                    id: truth.id,
                    name: 'TRUTH: ' + truth.name,
                    desc: truth.desc,
                    group: 'truth',
                    color: truth.color,
                    val: 12, // Huge node
                    type: 'truth'
                });

                // Link Truth to Standards (Mockup based on known mappings)
                if (truth.id === 'concept_conservation_of_energy') {
                    ['MS-PS3-1', 'MS-PS3-2', 'MS-PS3-5'].forEach(stdId => {
                        if (addedNodeIds.has(stdId)) {
                            links.push({ source: truth.id, target: stdId, color: '#d946ef', width: 3, dashed: true });
                        }
                    });
                }
                if (truth.id === 'concept_archetypes') {
                    // Link to ELA standards
                    standards.filter(s => s.id.startsWith('RL.6')).forEach(s => {
                        links.push({ source: truth.id, target: s.id, color: '#d946ef', width: 3, dashed: true });
                    });
                }
            });
        }

        // 4. SYNAPSE VIEW: Cross-Pollination
        if (viewMode === 'synapse') {
            // Highlight cross-domain potential
            // Mocking "Synapse" edges that don't exist in the standard hierarchy

            // Link Science (Energy) to Math (Equations)
            const scienceToMath = { source: 'MS-PS3-1', target: '6.EE.A.2', desc: 'Energy formulas requires Algebraic expressions' };

            // Link Literature (Theme) to History (if we had history standards) or Science (Pattern Recognition)
            const litToScience = { source: '6.RL.2', target: 'MS-PS3-5', desc: 'Archetypes (Theme) mirror Energy Conservation (Pattern)' };

            [scienceToMath, litToScience].forEach(link => {
                if (addedNodeIds.has(link.source) && addedNodeIds.has(link.target)) {
                    links.push({
                        source: link.source,
                        target: link.target,
                        color: '#a855f7', // Purple-500 (Synapse)
                        width: 4,
                        val: 5,
                        dashed: true,
                        particles: 3 // Visual flair for active synapse
                    });
                }
            });

            // Dim non-connected nodes
            nodes.forEach(n => {
                const isConnected = links.some(l =>
                    (l.source === n.id || l.target === n.id) && l.color === '#a855f7'
                );
                if (!isConnected) {
                    n.color = '#27272a'; // Fade out
                    n.val = 1;
                } else {
                    n.color = '#d8b4fe'; // Purple-300 highlight
                    n.val = 10;
                }
            });
        }

        return { nodes, links };
    }, [standards, mastery, viewMode]);

    return (
        <div ref={containerRef} className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950 w-full h-full min-h-[500px] relative">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                    onClick={() => setViewMode('standard')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${viewMode === 'standard' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'}`}
                >
                    Standard View
                </button>
                <button
                    onClick={() => setViewMode('truth')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${viewMode === 'truth' ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]' : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'}`}
                >
                    👁️ Truth View
                </button>
                <button
                    onClick={() => setViewMode('synapse')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${viewMode === 'synapse' ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-zinc-900/80 border-white/10 text-zinc-400 hover:text-white'}`}
                >
                    🧠 Synapse View
                </button>
            </div>

            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeLabel={(node: any) => `${node.name}: ${node.desc?.substring(0, 60)}...`}
                nodeColor={(node: any) => node.color}
                linkColor={(link: any) => link.color}
                linkWidth={(link: any) => link.width || 1}
                linkLineDash={(link: any) => link.dashed ? [4, 2] : null}
                backgroundColor="#09090b" // Zinc-950
                onNodeClick={onNodeClick}
                nodeRelSize={6}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
            />
        </div>
    );
}
