'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    GitBranch,
    GitCommit,
    GitPullRequest,
    AlertCircle,
    CheckCircle,
    Clock,
    Folder,
    ChevronRight,
    ChevronDown,
    Github,
    Star,
    Activity
} from 'lucide-react';

interface RepoNode {
    id: string;
    name: string;
    type: 'org' | 'project' | 'repo';
    status: 'active' | 'archived' | 'error';
    children?: RepoNode[];
    meta?: {
        stars?: number;
        issues?: number;
        prs?: number;
        lastUpdate?: string;
        language?: string;
    };
}

// MOCK_REPO_TREE removed.

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function RepoMindMap() {
    const { data, isLoading } = useSWR('/api/pm/repos', fetcher);
    // Use server data or fallback to empty array
    const treeData: RepoNode[] = data?.tree || [];

    // Auto-expand top level domains on load
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Effect to expand initial nodes once data loads
    const [hasInitialized, setHasInitialized] = useState(false);
    if (treeData.length > 0 && !hasInitialized) {
        const initialIds = treeData.map(n => n.id);
        setExpandedNodes(new Set(initialIds));
        setHasInitialized(true);
    }

    const toggleNode = (id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderNode = (node: RepoNode, depth: number = 0) => {
        const isExpanded = expandedNodes.has(node.id);
        const hasChildren = node.children && node.children.length > 0;
        const isRepo = node.type === 'repo';

        return (
            <div key={node.id} className="relative">
                {/* Connection Line to Parent */}
                {depth > 0 && (
                    <div className="absolute top-8 left-[-24px] w-6 h-px bg-slate-800" />
                )}

                {/* Node Connection Line Vertical (for siblings) */}
                {depth > 0 && (
                    <div className="absolute top-[-20px] left-[-24px] w-px h-[calc(100%+20px)] bg-slate-800 last:h-[40px]" />
                )}

                <div className={`
          relative ml-6 mb-4 p-3 rounded-xl border transition-all duration-300 group
          ${isRepo
                        ? 'bg-slate-900/50 border-white/5 hover:border-indigo-500/30 hover:bg-slate-800/50'
                        : 'bg-slate-950/80 border-white/10 hover:border-white/20'
                    }
        `}>
                    {/* Active Status Indicator */}
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 -ml-[1px] w-1 h-8 rounded-r-full transition-colors
            ${node.status === 'active' ? 'bg-emerald-500/50' : 'bg-slate-700'}
          `} />

                    <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => hasChildren ? toggleNode(node.id) : null}
                    >
                        {/* Icon */}
                        <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center border shadow-lg
              ${node.type === 'org' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
                                node.type === 'project' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' :
                                    'bg-slate-800 border-slate-700 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10'}
            `}>
                            {node.type === 'org' ? <Github size={20} /> :
                                node.type === 'project' ? <Folder size={20} /> :
                                    <GitBranch size={18} />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-200 text-sm">{node.name}</span>
                                {node.type === 'repo' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                        {node.meta?.language}
                                    </span>
                                )}
                            </div>

                            {node.type === 'repo' && node.meta ? (
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1"><Star size={10} /> {node.meta.stars}</span>
                                    <span className="flex items-center gap-1"><AlertCircle size={10} /> {node.meta.issues}</span>
                                    <span className="flex items-center gap-1"><GitPullRequest size={10} /> {node.meta.prs}</span>
                                    <span className="flex items-center gap-1 ml-2 text-slate-600"><Clock size={10} /> {node.meta.lastUpdate}</span>
                                </div>
                            ) : (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    {hasChildren ? `${node.children?.length} Items` : 'Empty'}
                                </div>
                            )}
                        </div>

                        {/* Expand Toggle */}
                        {hasChildren && (
                            <div className={`p-1 rounded-full hover:bg-white/10 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                                <ChevronRight size={16} className="text-slate-500" />
                            </div>
                        )}
                    </div>

                    {/* Connectors for children */}
                    {hasChildren && isExpanded && (
                        <div className="absolute bottom-[-18px] left-[24px] w-px h-5 bg-slate-800" />
                    )}
                </div>

                {/* Children Render */}
                <AnimatePresence>
                    {hasChildren && isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-8 border-l border-slate-800/50 pl-0"
                        >
                            <div className="pt-2">
                                {node.children!.map((child) => renderNode(child, depth + 1))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="w-full bg-slate-950/50 rounded-xl border border-white/5 p-6 overflow-x-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <GitBranch className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Repository Overview</h3>
                        <p className="text-xs text-slate-500">
                            Mind Map View • {isLoading ? 'Loading...' : `${treeData.reduce((acc, curr) => acc + (curr.children?.reduce((a, c) => a + (c.children?.length || 0), 0) || 0), 0)} Repositories`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setExpandedNodes(new Set(treeData.map(n => n.id)))}
                        className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
                    >
                        Reset View
                    </button>
                    <button
                        onClick={() => {
                            // Manual revalidate
                            const mutate = (window as any).mutate;
                            // mutate('/api/pm/repos'); 
                            // Since we don't have mutate imported, we can just reload the page or rely on auto-refresh
                            window.location.reload();
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
                    >
                        Force Sync
                    </button>
                </div>
            </div>

            <div className="min-w-[600px] pl-4">
                {isLoading && (
                    <div className="flex items-center justify-center p-12 text-slate-500 gap-3">
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Mapping System Truth...
                    </div>
                )}
                {!isLoading && treeData.length === 0 && (
                    <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        No domains or repositories found in System Config.
                    </div>
                )}
                {treeData.map(node => renderNode(node))}
            </div>
        </div>
    );
}
